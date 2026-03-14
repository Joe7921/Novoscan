/**
 * 报告撰写 Agent
 *
 * 将多Agent分析结果改写为一篇科研论文风格的专业评估报告，
 * 具有学术严谨性，重点突出，细节丰富。
 */
import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { ModelProvider } from '@/types';

/** 报告章节 */
export interface ReportSection {
    title: string;
    content: string;       // Markdown 格式
    keyFinding?: string;   // 本章节核心发现（高亮展示）
}

/** 专业报告结构 */
export interface ProfessionalReport {
    title: string;
    subtitle: string;
    generatedAt: string;
    query: string;
    language: 'zh' | 'en';

    executiveSummary: string;  // 摘要 Abstract
    overallScore: number;
    industryScore: number;
    credibilityLevel: string;

    keyFindings: string[];     // 3-5 条核心发现
    methodology: string;       // 研究方法简述

    sections: ReportSection[];

    conclusion: string;
    nextSteps: string[];

    usedModel?: string;
    dataSourcesSummary: string;

    // ================= 新增增强字段 =================
    expertConsensus?: {                    // 专家共识面板
        consensusLevel: string;
        dissent: string[];
        conflictsResolved: string[];
    };
    weightedScoreBreakdown?: {             // 加权评分明细
        academic: { raw: number; weight: number; weighted: number };
        industry: { raw: number; weight: number; weighted: number };
        innovation: { raw: number; weight: number; weighted: number };
        competitor: { raw: number; weight: number; weighted: number };
    };
    dimensionScores?: Array<{              // 多维评分
        name: string;
        score: number;
        reasoning: string;
    }>;
    topSimilarPapers?: Array<{             // 高相似度论文 TOP5
        title: string;
        year: number;
        similarityScore: number;
        keyDifference: string;
        citationCount?: number;
        venue?: string;
    }>;
    innovationRadar?: Array<{              // 六维雷达
        key: string;
        nameZh: string;
        nameEn: string;
        score: number;
        reasoning: string;
    }>;
    dataProfile?: {                        // 数据覆盖画像
        totalPapers: number;
        totalCitations: number;
        openAccessCount: number;
        avgCitation: number;
        bySource: Record<string, number>;
        webResultsCount: number;
        githubReposCount: number;
        activeRepos: number;
        totalStars: number;
        topGithubProjects?: Array<{
            name: string;
            stars: number;
            health: string;
        }>;
    };
    qualityAudit?: {                       // 质量审计结果
        passed: boolean;
        consistencyScore: number;
        warnings: string[];
    };
}

/**
 * 构建学术论文风格 AI Prompt
 */
function buildReportPrompt(
    query: string,
    report: any,
    dualResult: any,
    language: 'zh' | 'en',
): string {
    const isZh = language === 'zh';

    const arbitration = report?.arbitration;
    const academicReview = report?.academicReview;
    const industryAnalysis = report?.industryAnalysis;
    const innovationEvaluation = report?.innovationEvaluation;
    const competitorAnalysis = report?.competitorAnalysis;
    const qualityCheck = report?.qualityCheck;
    const crossValidation = dualResult?.crossValidation;
    const finalCredibility = dualResult?.finalCredibility || dualResult?.credibility;
    const academicStats = dualResult?.academic?.stats;
    const industryStats = dualResult?.industry;

    return `
# 系统角色

你是一位资深学术评审专家和科技智库研究员。你的写作风格融合了顶级科研论文的严谨性和专业咨询报告的实用性、详实性。

# 任务

将以下多位 AI 专家的分析数据，深度改写为一篇**具有科研论文风格和高信息密度的深度评估报告**。报告应当：
- 有学术论文的**严谨结构**（摘要→各研究维度→结论与展望）
- 有咨询报告的**决策导向**（核心发现、风险提示、行动建议）
- 段落间有**逻辑递进**，绝不是简单的罗列和堆砌
- **强调数据支撑**：在具体章节中必须极其频繁地引用论文数量、引用频次、项目星标、开源情况、评分明细、置信度等数据，做到言之有物
- 每个章节要有一条最尖锐的核心发现（keyFinding），类似论文的"Highlight"

## 被评估创新点
**"${query}"**

## 原始数据全景（请充分挖掘并引用以下数据细节）

### 1. 仲裁委员会决议
- 综合最终评分：${arbitration?.overallScore ?? report?.noveltyScore ?? 'N/A'}/100
- 专家共识度：${arbitration?.consensusLevel ?? 'N/A'}
- 少数派异议：${(arbitration?.dissent || []).join(' | ') || '无'}
- 综合摘要：${arbitration?.summary || report?.summary || '暂无'}
- 加权评分详情：
${arbitration?.weightedBreakdown ? JSON.stringify(arbitration.weightedBreakdown, null, 2) : '无数据'}

### 2. 各维度独立专家分析
【学术审查员】（评分 ${academicReview?.score ?? 'N/A'}/100，置信度 ${academicReview?.confidence ?? 'N/A'}，依据：${academicReview?.confidenceReasoning || '无'}）
- 关键发现：${(academicReview?.keyFindings || []).join('；') || '无'}
- 多维指标测评：${JSON.stringify(academicReview?.dimensionScores || [], null, 2)}
- 识别到的高相似度论文 TOP5（请重点探讨这些对标）：
${JSON.stringify((academicReview?.similarPapers || []).slice(0, 5), null, 2)}
- 风险：${(academicReview?.redFlags || []).join('；') || '无'}

【产业分析员】（评分 ${industryAnalysis?.score ?? 'N/A'}/100）
- 关键发现：${(industryAnalysis?.keyFindings || []).join('；') || '无'}
- 多维指标测评：${JSON.stringify(industryAnalysis?.dimensionScores || [], null, 2)}

【创新评估师】（评分 ${innovationEvaluation?.score ?? 'N/A'}/100）
- 六维创新雷达数据：${JSON.stringify(innovationEvaluation?.innovationRadar || [], null, 2)}
- 关键发现：${(innovationEvaluation?.keyFindings || []).join('；') || '无'}

【竞品侦探】（评分 ${competitorAnalysis?.score ?? 'N/A'}/100）
- 关键发现：${(competitorAnalysis?.keyFindings || []).join('；') || '无'}

### 3. 七源交叉验证与底层数据画像
- 综合可信度评级：${finalCredibility?.level ?? 'N/A'}（分数 ${finalCredibility?.score ?? 'N/A'}）
- 逻辑一致性（质检仪评估）：${qualityCheck?.consistencyScore ?? 'N/A'}/100 
- 学术支撑强度：${crossValidation?.academicSupport ?? 'N/A'} | 产业支撑强度：${crossValidation?.industrySupport ?? 'N/A'}
- 开源生态验证：${crossValidation?.openSourceVerified ? '已被验证' : '尚未验证'}
- 数据覆盖统计：
  * 学术文献：共检索到 ${academicStats?.totalPapers ?? 'N/A'} 篇关联文献，累计被引 ${academicStats?.totalCitations ?? 'N/A'} 次。（开放获取比例高）
  * 产业热度：全网关联讨论与索引共 ${(industryStats?.webSources?.brave || 0) + (industryStats?.webSources?.serpapi || 0)} 条。
  * 开发者生态：捕获 ${Math.min(20, (industryStats?.githubRepos || []).length)}+ 个关联的 GitHub 开源项目。

# 详尽撰写规范

语言：${isZh ? '中文（学术规范用语，客观严谨）' : 'English (academic and rigorous style)'}

## 核心结构要求

1. **executiveSummary**：类似论文 Abstract，3-4 句话浓缩核心逻辑与结论。
2. **keyFindings**：3-5 条全局**最重要**的核心发现，每条一句话，必须紧密结合具体数据（如分数、篇数）。

3. **sections**（扩展为 **8** 个章节，必须按以下顺序撰写）：
   - **${isZh ? '研究背景与文献定位' : 'Background & Literature Positioning'}**：学术脉络演进、关键论文对标
   - **${isZh ? '多维创新性透视' : 'Multidimensional Innovation Perspective'}**：基于创新雷达六维度及其他维度的微观剖析
   - **${isZh ? '技术核心突破分析' : 'Technical Breakthrough Analysis'}**：深度探讨技术难点攻克机制
   - **${isZh ? '产业应用与商业化进程' : 'Industry Application & Commercialization'}**：基于网络及 GitHub 数据分析落地现状
   - **${isZh ? '竞争态势与生态护城河' : 'Competitive Landscape & Moat'}**：竞品实力对比分析
   - **${isZh ? '交叉验证与证据融合' : 'Cross-validation & Evidence Synthesis'}**：学术基石与产业反馈的一致性与分歧探讨
   - **${isZh ? '专家共识与争议探讨' : 'Expert Consensus & Controversies'}**：基于仲裁员的共识、少数派异议分析
   - **${isZh ? '系统性风险与红旗信号' : 'Systemic Risks & Red Flags'}**：深度风险排查

4. **强制篇幅与细节要求**：
   - 每个 section content **不可少于 300 字**！必须充分展开，使用 Markdown 排版。
   - **数据引证强制要求**：撰写 content 时必须在文中穿插具体数据进行论证（例如：“在学术界已有 X 篇相关文献，以 Y 论文为代表...；多维评测中技术难度获得 Z 分...；GitHub 存在 M 个活跃项目证明了...”）
   - 每个 section 必须含有一条高度提炼的 **keyFinding**（本章最核心一句话）。
5. **conclusion**：2-3 段，总结全局架构，给出最终的定性判断。
6. **nextSteps**：4-6 条按优先级排序的极简行动建议（可操作性强）。

# 最终输出格式

严格输出如下 JSON 格式：
{
  "title": "报告主标题",
  "subtitle": "副标题",
  "executiveSummary": "摘要内容（Markdown）",
  "keyFindings": ["发现1", "发现2", "发现3"],
  "sections": [
    { "title": "章节名称", "content": "极其详细的段落内容（Markdown，300字以上，含数据引用）", "keyFinding": "本章核心一句话" }
  ],
  "conclusion": "结论",
  "nextSteps": ["建议1", "建议2"]
}

⚠️ **极其重要的格式警告**：
- 直接输出 JSON，**不要**用 \`\`\`json 代码块包裹！
- 在 JSON 的 content 等字符串字段中，**严禁使用** \`\`\` 三反引号代码块！如需高亮代码，请使用单反引号 \` 即可。
- 确保输出的是完整、可解析的 JSON，不要截断。
`;
}

/**
 * 生成专业报告（AI 改写）
 */
export async function generateProfessionalReport(
    query: string,
    report: any,
    dualResult: any,
    language: 'zh' | 'en',
    modelProvider: ModelProvider,
): Promise<ProfessionalReport> {
    const isZh = language === 'zh';
    const arbitration = report?.arbitration;
    const industryAnalysis = report?.industryAnalysis;
    const finalCredibility = dualResult?.finalCredibility || dualResult?.credibility;

    const methodologyText = isZh
        ? `本报告基于 NovaScan 多智能体协同分析框架生成。系统采用七源双轨交叉验证方法论，数据覆盖 OpenAlex、arXiv、Crossref、CORE 四大学术数据库（学术轨道）以及 Brave Search、SerpAPI、GitHub 三大产业数据源（产业轨道）。分析流程包含学术审查员、产业分析员、创新评估师、竞品侦探四位独立 AI 专家的平行分析，最终由仲裁引擎进行加权仲裁和质量审计，确保评估结论的全面性与可靠性。`
        : `This report is generated through the NovaScan Multi-Agent Collaborative Analysis Framework, employing a 7-Source Dual-Track Cross-Validation methodology. Data coverage includes 4 academic databases (OpenAlex, arXiv, Crossref, CORE) and 3 industry sources (Brave Search, SerpAPI, GitHub). The pipeline features parallel evaluations by 4 independent AI specialists, followed by weighted arbitration and quality auditing.`;

    try {
        const prompt = buildReportPrompt(query, report, dualResult, language);
        console.log(`[报告撰写Agent] Prompt 长度: ${prompt.length} 字符`);
        // 报告生成需要更大的输出 token 和更长超时（8章节×300+字 ≈ 15000+ tokens）
        const { text, usedModel } = await callAIRaw(
            prompt, modelProvider, 120000, 80000,
            undefined, undefined, 16384
        );
        console.log(`[报告撰写Agent] AI 返回文本长度: ${text.length} 字符, 模型: ${usedModel}`);

        let parsed: {
            title: string;
            subtitle: string;
            executiveSummary: string;
            keyFindings: string[];
            sections: ReportSection[];
            conclusion: string;
            nextSteps: string[];
        };
        try {
            parsed = parseAgentJSON(text);
        } catch (parseErr: any) {
            console.error('[报告撰写Agent] JSON 解析失败:', parseErr.message);
            console.error('[报告撰写Agent] 原始文本前 500 字符:', text.slice(0, 500));
            console.error('[报告撰写Agent] 原始文本后 300 字符:', text.slice(-300));
            throw parseErr;
        }

        // 提取组装新的增强数据集
        const academicStats = dualResult?.academic?.stats;
        const industryStats = dualResult?.industry;
        const topProjects = industryStats?.githubRepos?.slice(0, 3) || [];
        const qualityCheck = report?.qualityCheck;

        return {
            title: parsed.title || (isZh ? `「${query}」创新性深度评估报告` : `Innovation Deep Assessment: "${query}"`),
            subtitle: parsed.subtitle || (isZh ? 'NovaScan 多智能体交叉验证分析' : 'NovaScan Multi-Agent Cross-Validated Analysis'),
            generatedAt: new Date().toISOString(),
            query,
            language,
            executiveSummary: parsed.executiveSummary || '',
            overallScore: arbitration?.overallScore ?? report?.noveltyScore ?? 0,
            industryScore: report?.practicalScore ?? industryAnalysis?.score ?? 0,
            credibilityLevel: finalCredibility?.level || 'medium',
            keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
            methodology: methodologyText,
            sections: Array.isArray(parsed.sections) ? parsed.sections : [],
            conclusion: parsed.conclusion || '',
            nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
            usedModel,
            dataSourcesSummary: isZh
                ? `数据来源：OpenAlex、arXiv、Crossref、CORE（学术轨道）；Brave Search、SerpAPI、GitHub（产业轨道）。分析引擎：NovaScan Multi-Agent System v1.0。`
                : `Data Sources: OpenAlex, arXiv, Crossref, CORE (Academic); Brave Search, SerpAPI, GitHub (Industry). Engine: NovaScan Multi-Agent System v1.0.`,

            // ================= 附加增强数据（供PDF渲染层使用） =================
            expertConsensus: arbitration ? {
                consensusLevel: arbitration.consensusLevel || 'unknown',
                dissent: arbitration.dissent || [],
                conflictsResolved: arbitration.conflictsResolved || []
            } : undefined,
            weightedScoreBreakdown: arbitration?.weightedBreakdown,
            dimensionScores: report?.innovationEvaluation?.dimensionScores || report?.academicReview?.dimensionScores,
            topSimilarPapers: report?.academicReview?.similarPapers?.slice(0, 5) || [],
            innovationRadar: report?.innovationEvaluation?.innovationRadar || report?.innovationRadar,
            dataProfile: {
                totalPapers: academicStats?.totalPapers || 0,
                totalCitations: academicStats?.totalCitations || 0,
                openAccessCount: academicStats?.openAccessCount || 0,
                avgCitation: academicStats?.avgCitation || 0,
                bySource: academicStats?.bySource || {},
                webResultsCount: (industryStats?.webSources?.brave || 0) + (industryStats?.webSources?.serpapi || 0),
                githubReposCount: (industryStats?.githubRepos || []).length,
                activeRepos: (industryStats?.githubRepos || []).filter((r: any) => r.health === 'active').length,
                totalStars: (industryStats?.githubRepos || []).reduce((sum: number, r: any) => sum + (r.stars || 0), 0),
                topGithubProjects: topProjects
            },
            qualityAudit: qualityCheck ? {
                passed: qualityCheck.passed || false,
                consistencyScore: qualityCheck.consistencyScore || 0,
                warnings: qualityCheck.warnings || []
            } : undefined
        };
    } catch (err: any) {
        console.error('[报告撰写Agent] AI 调用失败，使用兜底报告:', err.message);
        return buildFallbackReport(query, report, dualResult, language);
    }
}

/**
 * 兜底报告（AI 调用失败时，从原始数据直接拼装）
 */
function buildFallbackReport(
    query: string,
    report: any,
    dualResult: any,
    language: 'zh' | 'en',
): ProfessionalReport {
    const isZh = language === 'zh';
    const arbitration = report?.arbitration;
    const academicReview = report?.academicReview;
    const industryAnalysis = report?.industryAnalysis;
    const innovationEvaluation = report?.innovationEvaluation;
    const competitorAnalysis = report?.competitorAnalysis;
    const finalCredibility = dualResult?.finalCredibility || dualResult?.credibility;

    const sections: ReportSection[] = [
        {
            title: isZh ? '研究背景与文献定位' : 'Background & Literature Positioning',
            content: academicReview?.analysis || (isZh ? '暂无学术分析数据。' : 'No data available.'),
            keyFinding: (academicReview?.keyFindings || [])[0] || '',
        },
        {
            title: isZh ? '技术创新性分析' : 'Technical Innovation Analysis',
            content: innovationEvaluation?.analysis || (isZh ? '暂无创新评估数据。' : 'No data available.'),
            keyFinding: (innovationEvaluation?.keyFindings || [])[0] || '',
        },
        {
            title: isZh ? '产业应用与市场格局' : 'Industry Application & Market Landscape',
            content: industryAnalysis?.analysis || (isZh ? '暂无产业分析数据。' : 'No data available.'),
            keyFinding: (industryAnalysis?.keyFindings || [])[0] || '',
        },
        {
            title: isZh ? '竞争态势与差异化优势' : 'Competitive Landscape & Differentiation',
            content: competitorAnalysis?.analysis || (isZh ? '暂无竞品分析数据。' : 'No data available.'),
            keyFinding: (competitorAnalysis?.keyFindings || [])[0] || '',
        },
    ];

    return {
        title: isZh ? `「${query}」创新性深度评估报告` : `Innovation Deep Assessment: "${query}"`,
        subtitle: isZh ? 'NovaScan 多智能体交叉验证分析' : 'NovaScan Multi-Agent Cross-Validated Analysis',
        generatedAt: new Date().toISOString(),
        query,
        language,
        executiveSummary: arbitration?.summary || report?.summary || '',
        overallScore: arbitration?.overallScore ?? report?.noveltyScore ?? 0,
        industryScore: report?.practicalScore ?? industryAnalysis?.score ?? 0,
        credibilityLevel: finalCredibility?.level || 'medium',
        keyFindings: [
            ...(academicReview?.keyFindings || []).slice(0, 2),
            ...(industryAnalysis?.keyFindings || []).slice(0, 1),
            ...(innovationEvaluation?.keyFindings || []).slice(0, 1),
        ].filter(Boolean).slice(0, 5),
        methodology: isZh
            ? '本报告基于 NovaScan 多智能体协同分析框架生成，采用七源双轨交叉验证方法论。'
            : 'Generated via NovaScan Multi-Agent Framework using 7-Source Dual-Track Cross-Validation.',
        sections,
        conclusion: arbitration?.recommendation || report?.recommendation || '',
        nextSteps: arbitration?.nextSteps || [],
        usedModel: 'Fallback',
        dataSourcesSummary: isZh
            ? `数据来源：OpenAlex、arXiv、Crossref、CORE；Brave Search、SerpAPI、GitHub。`
            : `Data Sources: OpenAlex, arXiv, Crossref, CORE; Brave Search, SerpAPI, GitHub.`,
    };
}