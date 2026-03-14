/**
 * Agent 记忆进化服务（Evolving Agent Memory Service）
 * 
 * 核心能力：
 *   1. saveExperience — 分析完成后将 Agent 判断过程存入经验数据库
 *   2. retrieveRelevantExperiences — 分析前通过 RAG 检索相关历史经验
 *   3. getMemoryStats — 获取经验库统计信息
 * 
 * 使用 PostgreSQL tsvector + ts_rank 做全文检索 RAG，零外部依赖。
 */

import { adminDb } from '@/lib/db/factory';
import type { FinalReport } from '@/agents/types';

// ==================== 上下文管理配置 ====================

/** 
 * Agent 记忆上下文管理配置
 * 控制所有字段长度、Prompt 注入预算，防止上下文溢出导致 Agent 失败
 */
const MEMORY_CONTEXT_CONFIG = {
    /** 注入 Agent Prompt 的上下文最大字符数（约 1500 tokens） */
    maxContextChars: 3000,
    /** 单条经验上下文最大字符数 */
    maxPerExperienceChars: 800,
    /** 单条经验教训最大字符数 */
    maxLessonChars: 100,
    /** 经验教训最大条数 */
    maxLessonsPerExperience: 3,
    /** 辩论摘要最大字符数 */
    maxDebateSummaryChars: 200,
    /** 查询文本保存最大字符数 */
    maxQueryChars: 500,
    /** RAG 检索超时（毫秒） */
    retrievalTimeoutMs: 5000,
    /** 技术标签最多保留几个 */
    maxTagsPerExperience: 5,
} as const;

// ==================== 类型定义 ====================

/** 结构化 Agent 判断摘要 */
interface AgentJudgmentSummary {
    agentName: string;
    score: number;
    confidence: string;
    keyFindings: string[];
    redFlags: string[];
    /** 推理链摘要（截断，避免过大） */
    reasoningSummary: string;
    isFallback: boolean;
}

/** 检索结果 */
export interface RetrievedExperience {
    query: string;
    finalScore: number;
    recommendation: string;
    lessonsLearned: string[];
    tags: string[];
    debateSummary: string;
    relevanceRank: number;
    createdAt: string;
}

/** 检索输出（供编排器注入） */
export interface ExperienceRetrievalResult {
    count: number;
    queries: string[];
    context: string;
    experiences: RetrievedExperience[];
}

/** 经验库统计 */
export interface MemoryStats {
    totalExperiences: number;
    domainDistribution: Record<string, number>;
    avgScore: number;
    recentCount: number;
}

// ==================== 工具函数 ====================

/** 简单哈希（与 innovationService 保持一致） */
function hashQuery(query: string): string {
    let hash = 0;
    const str = query.slice(0, MEMORY_CONTEXT_CONFIG.maxQueryChars);
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return `exp_${Math.abs(hash)}`;
}

/** 安全截断文本，不破坏 UTF-8 字符 */
function safeTruncate(text: string, maxLen: number): string {
    if (!text || text.length <= maxLen) return text || '';
    return text.slice(0, maxLen) + '…';
}

/** 清洗用户输入，防止 PostgreSQL tsquery 注入 */
function sanitizeForTsQuery(token: string): string {
    // 只保留中文、英文、数字，去掉所有特殊字符
    return token.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').slice(0, 30);
}

/** 从分析报告中提取技术标签 */
function extractTags(query: string, report: FinalReport): string[] {
    const tags = new Set<string>();

    // 从查询中提取关键词（简单分词）
    const queryTokens = query
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 2);
    queryTokens.slice(0, 5).forEach(t => tags.add(t));

    // 从各 Agent 的 keyFindings 中提取
    const allFindings = [
        ...(report.academicReview?.keyFindings || []),
        ...(report.industryAnalysis?.keyFindings || []),
        ...(report.innovationEvaluation?.keyFindings || []),
        ...(report.competitorAnalysis?.keyFindings || []),
    ];

    // 提取高频出现的关键词作为标签
    const wordFreq: Record<string, number> = {};
    allFindings.forEach(finding => {
        const words = finding
            .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 2 && w.length <= 20);
        words.forEach(w => {
            wordFreq[w] = (wordFreq[w] || 0) + 1;
        });
    });

    Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .forEach(([word]) => tags.add(word));

    return Array.from(tags).slice(0, 15);
}

/** 从 FinalReport 中提取 Agent 判断摘要 */
function extractAgentJudgments(report: FinalReport): AgentJudgmentSummary[] {
    const agents = [
        report.academicReview,
        report.industryAnalysis,
        report.innovationEvaluation,
        report.competitorAnalysis,
    ].filter(Boolean);

    return agents.map(agent => ({
        agentName: agent.agentName,
        score: agent.score,
        confidence: agent.confidence,
        keyFindings: agent.keyFindings.slice(0, 3),
        redFlags: agent.redFlags.slice(0, 2),
        reasoningSummary: (agent.reasoning || '').slice(0, 500),
        isFallback: !!agent.isFallback,
    }));
}

/** AI 自动生成经验教训（基于规则，无需额外 AI 调用） */
function generateLessonsLearned(report: FinalReport): string[] {
    const lessons: string[] = [];
    const { arbitration, qualityCheck, debate, academicReview, industryAnalysis, competitorAnalysis, innovationEvaluation } = report;

    // 评分分布分析
    const scores = [
        academicReview?.score, industryAnalysis?.score,
        innovationEvaluation?.score, competitorAnalysis?.score
    ].filter((s): s is number => typeof s === 'number');

    if (scores.length >= 2) {
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        if (max - min > 30) {
            lessons.push(`专家评分分歧较大（极差${max - min}），需特别关注各维度的差异原因`);
        }
    }

    // 降级检测
    const fallbackCount = [academicReview, industryAnalysis, innovationEvaluation, competitorAnalysis]
        .filter(a => a?.isFallback).length;
    if (fallbackCount > 0) {
        lessons.push(`有${fallbackCount}个Agent超时降级，此类查询可能需要更长的分析时间`);
    }

    // 辩论洞察
    if (debate?.triggered && debate.sessions.length > 0) {
        const insights = debate.sessions.flatMap(s => s.keyInsights).slice(0, 2);
        if (insights.length > 0) {
            lessons.push(`对抗辩论发现：${insights.join('；')}`);
        }
    }

    // 质量检查洞察
    if (qualityCheck && !qualityCheck.passed) {
        lessons.push(`质量检查未通过：${qualityCheck.issues.slice(0, 2).join('；')}`);
    }
    if (qualityCheck?.warnings?.length > 0) {
        lessons.push(`质量警告：${qualityCheck.warnings.slice(0, 2).join('；')}`);
    }

    // 高分 / 低分洞察
    if (arbitration.overallScore >= 80) {
        lessons.push(`该方向创新性较高（${arbitration.overallScore}分），后续类似查询可参考`);
    } else if (arbitration.overallScore <= 30) {
        lessons.push(`该方向创新性较低（${arbitration.overallScore}分），已有大量相关研究或竞品`);
    }

    // 跨域迁移洞察
    if (report.crossDomainTransfer && !report.crossDomainTransfer.isFallback) {
        const bridgeCount = report.crossDomainTransfer.bridges?.length || 0;
        if (bridgeCount > 0) {
            lessons.push(`发现${bridgeCount}条跨域创新路径，可从其他领域借鉴`);
        }
    }

    return lessons.slice(0, 6);
}

// ==================== 核心 API ====================

/**
 * 保存分析经验到数据库
 * 
 * @param query - 用户查询
 * @param report - 完整分析报告
 * @param domainId - 学科领域 ID（可选）
 * @param subDomainId - 子学科 ID（可选）
 * @param executionTimeMs - 分析耗时
 * @param modelProvider - 使用的模型
 */
export async function saveExperience(
    query: string,
    report: FinalReport,
    domainId?: string,
    subDomainId?: string,
    executionTimeMs?: number,
    modelProvider?: string,
): Promise<void> {
    try {
        const queryHash = hashQuery(query);
        const judgments = extractAgentJudgments(report);
        const tags = extractTags(query, report);
        const lessonsLearned = generateLessonsLearned(report);

        // 辩论摘要（截断）
        let debateSummary = '';
        if (report.debate?.triggered) {
            const rawSummary = report.debate.dissentReportText ||
                `触发${report.debate.sessions.length}场辩论，原因：${report.debate.triggerReason}`;
            debateSummary = safeTruncate(rawSummary, MEMORY_CONTEXT_CONFIG.maxDebateSummaryChars);
        }

        // 质量标记
        const qualityFlags = [
            ...(report.qualityCheck?.issues || []),
            ...(report.qualityCheck?.warnings || []),
        ].slice(0, 10);

        const { error } = await adminDb.from('agent_experiences').upsert({
            query: safeTruncate(query, MEMORY_CONTEXT_CONFIG.maxQueryChars),
            query_hash: queryHash,
            domain_id: domainId || null,
            sub_domain_id: subDomainId || null,
            agent_judgments: judgments,
            final_score: report.arbitration.overallScore,
            recommendation: report.arbitration.recommendation,
            lessons_learned: lessonsLearned.map(l => safeTruncate(l, MEMORY_CONTEXT_CONFIG.maxLessonChars)),
            quality_flags: qualityFlags,
            debate_summary: debateSummary,
            tags,
            usefulness_score: 0.5,
            model_provider: modelProvider || 'unknown',
            execution_time_ms: executionTimeMs || 0,
        }, {
            onConflict: 'query_hash',
        });

        if (error) {
            console.error('[AgentMemory] 经验保存失败:', error.message);
        } else {
            console.log(`[AgentMemory] ✅ 经验已保存 (tags: ${tags.slice(0, 5).join(', ')})`);
        }
    } catch (e: unknown) {
        console.error('[AgentMemory] 经验保存异常:', (e instanceof Error ? e.message : String(e)));
    }
}

/**
 * RAG 检索相关历史经验
 * 
 * 使用 PostgreSQL 全文检索 + 领域过滤，返回格式化的经验上下文
 * 
 * @param query - 当前用户查询
 * @param domainId - 当前学科领域（可选，用于加权）
 * @param limit - 返回条数上限
 */
export async function retrieveRelevantExperiences(
    query: string,
    domainId?: string,
    limit: number = 3,
): Promise<ExperienceRetrievalResult> {
    const emptyResult: ExperienceRetrievalResult = {
        count: 0,
        queries: [],
        context: '',
        experiences: [],
    };

    try {
        // 构建检索关键词（分词 + 清洗，防注入）
        const searchTokens = query
            .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
            .split(/\s+/)
            .map(sanitizeForTsQuery)
            .filter(t => t.length >= 2)
            .slice(0, 6);

        if (searchTokens.length === 0) return emptyResult;

        // 使用 OR 连接各关键词
        const tsQuery = searchTokens.join(' | ');

        // 构建查询：全文检索 + 排名
        let queryBuilder = adminDb
            .from('agent_experiences')
            .select('query,final_score,recommendation,lessons_learned,tags,debate_summary,query_hash,created_at,domain_id')
            .textSearch('search_vector', tsQuery, { type: 'plain' })
            .order('created_at', { ascending: false })
            .limit(limit * 2); // 多取一些，后面过滤

        // 如果有领域 ID，优先同领域的经验
        if (domainId) {
            queryBuilder = queryBuilder.or(`domain_id.eq.${domainId},domain_id.is.null`);
        }

        const { data, error } = await queryBuilder;

        if (error) {
            console.warn('[AgentMemory] RAG 检索失败:', error.message);
            return emptyResult;
        }

        if (!data || data.length === 0) return emptyResult;

        // 排除与当前查询完全相同的记录
        const currentHash = hashQuery(query);
        const filtered = data
            .filter(exp => exp.query_hash !== currentHash)
            .slice(0, limit);

        if (filtered.length === 0) return emptyResult;

        // 格式化经验（截断各字段，控制总量）
        const { maxPerExperienceChars, maxLessonChars, maxLessonsPerExperience, maxTagsPerExperience, maxDebateSummaryChars, maxContextChars } = MEMORY_CONTEXT_CONFIG;

        const experiences: RetrievedExperience[] = filtered.map((exp, idx) => ({
            query: safeTruncate(exp.query, 200),
            finalScore: exp.final_score,
            recommendation: safeTruncate(exp.recommendation, 50),
            lessonsLearned: (exp.lessons_learned || []).slice(0, maxLessonsPerExperience).map((l: string) => safeTruncate(l, maxLessonChars)),
            tags: (exp.tags || []).slice(0, maxTagsPerExperience),
            debateSummary: safeTruncate(exp.debate_summary || '', maxDebateSummaryChars),
            relevanceRank: idx + 1,
            createdAt: exp.created_at,
        }));

        // 生成注入 Prompt 的上下文字符串（逐条构建，严控总长度）
        const contextParts: string[] = [];
        let totalLen = 0;
        const headerText = `以下是平台积累的 ${experiences.length} 条相关历史分析经验：\n\n`;
        totalLen += headerText.length;

        for (const exp of experiences) {
            const lessonsStr = exp.lessonsLearned.length > 0
                ? `\n  经验教训：${exp.lessonsLearned.join('；')}`
                : '';
            const part = `案例${exp.relevanceRank}：「${exp.query}」\n  最终评分：${exp.finalScore}/100（${exp.recommendation}）\n  技术标签：${exp.tags.join('、')}${lessonsStr}`;

            // 单条经验超限则截断
            const trimmedPart = safeTruncate(part, maxPerExperienceChars);

            // 总上下文超限则停止添加更多经验
            if (totalLen + trimmedPart.length + 100 > maxContextChars) {
                break;
            }
            contextParts.push(trimmedPart);
            totalLen += trimmedPart.length + 2; // +2 for \n\n
        }

        if (contextParts.length === 0) return emptyResult;

        const footerText = '\n\n请参考以上历史经验进行分析，但必须基于当前数据独立判断，不可直接复制历史评分。';
        const context = safeTruncate(
            headerText + contextParts.join('\n\n') + footerText,
            maxContextChars
        );

        return {
            count: contextParts.length,
            queries: experiences.slice(0, contextParts.length).map(e => e.query),
            context,
            experiences: experiences.slice(0, contextParts.length),
        };
    } catch (e: unknown) {
        console.error('[AgentMemory] RAG 检索异常:', (e instanceof Error ? e.message : String(e)));
        return emptyResult;
    }
}

/**
 * 获取经验库统计信息
 */
export async function getMemoryStats(): Promise<MemoryStats> {
    try {
        const { count } = await adminDb
            .from('agent_experiences')
            .select('*', { count: 'exact', head: true });

        const { data: domainData } = await adminDb
            .from('agent_experiences')
            .select('domain_id');

        const domainDistribution: Record<string, number> = {};
        (domainData || []).forEach(d => {
            const key = d.domain_id || 'unknown';
            domainDistribution[key] = (domainDistribution[key] || 0) + 1;
        });

        const { data: scoreData } = await adminDb
            .from('agent_experiences')
            .select('final_score');

        const scores = (scoreData || []).map(d => d.final_score);
        const avgScore = scores.length > 0
            ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
            : 0;

        // 最近 7 天的经验数量
        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const { count: recentCount } = await adminDb
            .from('agent_experiences')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', weekAgo);

        return {
            totalExperiences: count || 0,
            domainDistribution,
            avgScore,
            recentCount: recentCount || 0,
        };
    } catch (e: unknown) {
        console.error('[AgentMemory] 统计查询异常:', (e instanceof Error ? e.message : String(e)));
        return {
            totalExperiences: 0,
            domainDistribution: {},
            avgScore: 0,
            recentCount: 0,
        };
    }
}
