// Multi-Agent 架构类型定义（工业级）
import type { IndustryResult, ModelProvider } from '@/types';
import type { AgentExecutionRecord } from '@/lib/db/schema';

/** 学术检索结果的类型（取自 DualTrackResult.academic） */
export interface DualTrackAcademic {
    source: string;
    results: Array<{
        title?: string;
        year?: number;
        citationCount?: number;
        authors?: string[];
        url?: string;
        pdfUrl?: string;
        isOa?: boolean;
        isOpenAccess?: boolean;
        downloadUrl?: string;
        concepts?: string[];
        venue?: string;
        description?: string;
        [key: string]: unknown;   // 允许各数据源的额外字段
    }>;
    stats: {
        totalPapers: number;
        totalCitations: number;
        openAccessCount: number;
        avgCitation: number;
        bySource: { openAlex: number; arxiv: number; crossref: number; core: number };
        topCategories: string[];
    };
    topConcepts: string[];
}

export interface AgentInput {
    query: string;                      // 用户原始创意
    academicData: DualTrackAcademic;    // 学术检索结果（强类型）
    industryData: IndustryResult;       // 产业检索结果（强类型）
    language: 'zh' | 'en';
    modelProvider: ModelProvider;
    onProgress?: (event: 'log' | 'progress' | 'agent_state' | 'agent_stream' | 'agent_memory', data: Record<string, unknown> | string | number) => void;
    /** 编排器超时取消信号，传递给底层 AI 调用 */
    _abortSignal?: AbortSignal;
    /** 用户选择的一级学科 ID（如 'ENG'），可选 */
    domainId?: string;
    /** 用户选择的子学科 ID（如 'ENG.CS.ML'），可选 */
    subDomainId?: string;
    /** 学科中文提示（如 '工学 > 机器学习'），用于注入 Agent Prompt */
    domainHint?: string;
    /** NovoDNA 搜索前预洞察（DNA → 搜索 方向） */
    dnaInsight?: string;
    /** Agent 记忆进化 — RAG 检索到的相关历史经验上下文 */
    memoryContext?: string;
}

/** 多维评分维度 */
export interface DimensionScore {
    name: string;       // 维度名称
    score: number;      // 0-100
    reasoning: string;  // 该维度评分理由
}

/** NovoStarchart 六维创新性评估雷达图数据 */
export interface InnovationRadarDimension {
    key: string;            // 维度标识键（如 'techBreakthrough'）
    nameZh: string;         // 中文标签
    nameEn: string;         // 英文标签
    score: number;          // 0-100 标准化得分
    reasoning: string;      // 评分理由
}

/** Agent 通用输出（工业级） */
export interface AgentOutput {
    agentName: string;
    analysis: string;                    // 完整分析文本
    score: number;                       // 0-100 综合评分
    confidence: 'high' | 'medium' | 'low';
    confidenceReasoning: string;         // 置信度理由（必填）
    keyFindings: string[];
    redFlags: string[];
    evidenceSources: string[];           // 引用的原始数据来源
    reasoning: string;                   // 推理过程（CoT 留痕）
    dimensionScores: DimensionScore[];   // 多维评分明细
    isFallback?: boolean;                // 是否为超时/异常降级的 fallback 结果（区别于 AI 正常返回的 low confidence）
    innovationRadar?: InnovationRadarDimension[];   // NovoStarchart 六维创新性雷达图（仅创新评估师输出）
    // 学术审查员专用：AI 评估的高相似度论文（语义相似度）
    similarPapers?: Array<{
        title: string;
        year: number;
        similarityScore: number;         // 0-100，AI 语义相似度评估
        keyDifference: string;           // 与用户创意的核心差异
        description: string;             // 论文简述
        authors?: string;
        url?: string;
        citationCount?: number;
        venue?: string;                  // 发表期刊/会议
        authorityLevel?: 'high' | 'medium' | 'low';
    }>;
}

// ==================== 跨域创新迁移引擎类型 ====================

/** 跨域桥梁节点 — 连接不同领域的技术原理 */
export interface CrossDomainBridge {
    sourceField: string;          // 源领域（用户的领域）
    targetField: string;          // 目标领域（航空/材料/游戏等）
    techPrinciple: string;        // 共通的底层技术原理
    sourceExample: string;        // 源领域的具体案例
    targetExample: string;        // 目标领域的具体案例
    reference?: string;           // 参考文献（Nature/Science 等顶刊）
    transferPath: string;         // 迁移路径描述
    noveltyPotential: number;     // 迁移创新潜力 0-100
    feasibility: 'high' | 'medium' | 'low';
    riskLevel: 'low' | 'medium' | 'high';
}

/** 跨域知识图谱节点 */
export interface KnowledgeGraphNode {
    id: string;
    label: string;
    field: string;                // 所属领域
    type: 'technology' | 'application' | 'principle';
}

/** 跨域知识图谱边 */
export interface KnowledgeGraphEdge {
    source: string;
    target: string;
    relation: 'same_principle' | 'analogous' | 'evolved_from' | 'inspires';
    strength: number;             // 0-1 连接强度
}

/** 跨域侦察兵 Agent 输出 */
export interface CrossDomainScoutOutput extends AgentOutput {
    bridges: CrossDomainBridge[];
    knowledgeGraph: {
        nodes: KnowledgeGraphNode[];
        edges: KnowledgeGraphEdge[];
    };
    exploredDomains: string[];    // 已探索的领域列表
    transferSummary: string;      // 跨域迁移总结
}

/** 加权评分明细项 */
export interface WeightedScoreItem {
    raw: number;
    weight: number;
    weighted: number;
    confidence: 'high' | 'medium' | 'low';
}

/** 仲裁结果（工业级） */
export interface ArbitrationResult {
    summary: string;
    overallScore: number;
    recommendation: string;
    conflictsResolved: string[];
    nextSteps: string[];
    isPartial?: boolean;
    reasoningContent?: string;           // DeepSeek R1 思维链（推理过程）
    usedModel?: string;                  // 仲裁员实际使用的模型
    weightedBreakdown: {                 // 加权评分明细
        academic: WeightedScoreItem;
        industry: WeightedScoreItem;
        innovation: WeightedScoreItem;
        competitor: WeightedScoreItem;
    };
    consensusLevel: 'strong' | 'moderate' | 'weak';  // 专家共识度
    dissent: string[];                   // 少数派异议
    crossDomainVerification?: {          // 仲裁员对跨域建议的后处理验证
        overallAssessment: string;       // 总体评价
        verifiedBridges: string[];       // 验证通过的桥梁
        questionableClaims: string[];    // 存疑的案例引用
        enhancedSuggestions: string[];   // 增强的迁移建议
    };
}

export interface QualityCheckResult {
    passed: boolean;
    issues: string[];
    warnings: string[];                  // 非致命警告
    consistencyScore: number;            // 逻辑一致性评分 0-100
    /** 自动修正记录：当检测到明确逻辑矛盾时自动纠正 */
    corrections: Array<{ field: string; from: string; to: string; reason: string }>;
}

// ==================== NovoDebate 对抗辩论架构类型 ====================

/** NovoDebate 单轮辩论交锋记录 */
export interface DebateExchange {
    round: number;                    // 第几轮（1 or 2）
    challenger: string;               // 挑战方 Agent 名称
    challengerArgument: string;       // 挑战论点
    challengerEvidence: string[];     // 引用的证据
    defender: string;                 // 防守方 Agent 名称
    defenderRebuttal: string;         // 反驳论点
    defenderEvidence: string[];       // 引用的反驳证据
    outcome: 'challenger_wins' | 'defender_wins' | 'draw'; // 本轮裁判判定
    outcomeReasoning: string;         // 判定理由
}

/** NovoDebate 单场辩论结果 */
export interface DebateSession {
    sessionId: string;                // 辩论场次标识（如 'academic_vs_competitor'）
    topic: string;                    // 辩论主题
    proAgent: string;                 // 正方 Agent
    conAgent: string;                 // 反方 Agent
    scoreDivergence: number;          // 触发辩论的评分差异
    exchanges: DebateExchange[];      // 交锋记录
    verdict: string;                  // 辩论结论
    keyInsights: string[];            // 辩论过程中发现的新洞察
    scoreAdjustment: {                // 辩论后的评分修正建议
        proAgentDelta: number;        // 正方评分修正（-15 ~ +15）
        conAgentDelta: number;        // 反方评分修正（-15 ~ +15）
    };
}

/** NovoDebate 结构化分歧项 */
export interface DissentItem {
    dimension: string;                // 分歧维度（如"学术空白 vs 市场已有实现"）
    proAgent: string;                 // 正方 Agent
    proPosition: string;              // 正方立场摘要
    conAgent: string;                 // 反方 Agent
    conPosition: string;              // 反方立场摘要
    severity: 'high' | 'medium' | 'low';  // 分歧程度
    resolution: string;               // 裁决结论
    roundsDebated: number;            // 辩论了几轮
    winner: 'pro' | 'con' | 'draw';   // 最终胜方
}

/** NovoDebate 完整辩论记录 */
export interface DebateRecord {
    triggered: boolean;               // 是否触发了辩论
    triggerReason: string;            // 触发/跳过原因
    sessions: DebateSession[];        // 辩论场次列表
    totalDurationMs: number;          // 辩论总耗时
    dissentReport: DissentItem[];     // 结构化分歧报告（核心产出）
    dissentReportText: string;        // 文本版分歧报告（供仲裁员 prompt）
}

export interface FinalReport {
    academicReview: AgentOutput;
    industryAnalysis: AgentOutput;
    innovationEvaluation: AgentOutput;
    competitorAnalysis: AgentOutput;
    crossDomainTransfer?: CrossDomainScoutOutput;  // 跨域创新迁移引擎
    debate: DebateRecord;             // NovoDebate 对抗辩论记录
    arbitration: ArbitrationResult;
    qualityCheck: QualityCheckResult;
    executionRecord?: AgentExecutionRecord;
    /** Agent 记忆进化 — 本次分析使用的历史经验参考 */
    memoryInsight?: {
        experiencesUsed: number;
        relevantQueries: string[];
        contextSummary: string;
    };
}
