// ============================================================
//  Bizscan 商业想法创新度查重 — 核心类型定义
// ============================================================

/** 用户输入 */
export interface BizscanInput {
    ideaDescription: string;       // 核心：商业想法描述（必填，100-5000字符）
    targetMarket?: string;         // 可选：目标市场/地域
    businessModel?: string;        // 可选：商业模式（SaaS/平台/DTC等）
    industryVertical?: string;     // 可选：行业垂直领域
}

/** AI提取的结构化商业要素 */
export interface ParsedBusinessIdea {
    problemStatement: string;      // 解决什么问题
    proposedSolution: string;      // 提出什么方案
    targetCustomer: string;        // 目标客户画像
    valueProposition: string;      // 核心价值主张
    revenueModel: string;          // 盈利模式
    keyDifferentiators: string[];  // 差异化亮点
    industryTags: string[];        // 行业标签
    technologyStack: string[];     // 涉及的技术
    searchKeywords: string[];      // 用于数据检索的关键词
}

/** 竞品信息 */
export interface CompetitorInfo {
    name: string;
    description: string;
    url?: string;
    fundingStage?: string;         // "Seed" | "Series A" | "Series B+" | "Pre-IPO" | "Public" | "Bootstrapped"
    estimatedFunding?: string;     // e.g. "$5M"
    similarityScore: number;       // 0-100 语义相似度
    keyOverlap: string[];          // 重叠的核心能力
    keyDifference: string;         // 与用户想法的核心差异
    source: string;                // 数据来源
    threatLevel: 'high' | 'medium' | 'low';
}

/** 各维度评分 */
export interface DimensionAssessment {
    score: number;                 // 0-100
    weight: number;                // 权重（0-1）
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    reasoning: string;             // 评分理由
    evidence: string[];            // 支撑证据
    risks: string[];               // 该维度的风险点
    agentRawText?: string;         // Agent 完整原始分析文本
}

/** 多维评估结果 */
export interface DimensionResults {
    semanticNovelty: DimensionAssessment;      // 语义新颖度
    competitiveLandscape: DimensionAssessment;  // 竞争态势
    marketGap: DimensionAssessment;             // 市场空白
    feasibility: DimensionAssessment;           // 可行性
}

/** 市场洞察 */
export interface MarketInsights {
    marketSize?: string;           // 目标市场规模估算
    growthTrend: 'explosive' | 'growing' | 'stable' | 'declining';
    saturationLevel: 'oversaturated' | 'crowded' | 'moderate' | 'emerging' | 'blue-ocean';
}

/** 最终报告 */
export interface BizscanReport {
    parsedIdea: ParsedBusinessIdea;
    overallBII: number;            // 综合创新指数 0-100
    grade: 'S' | 'A' | 'B' | 'C' | 'D';
    verdict: string;               // 一句话结论
    dimensions: DimensionResults;
    competitors: CompetitorInfo[];
    marketInsights: MarketInsights;
    recommendations: string[];     // AI 建议
    riskWarnings: string[];        // 风险红旗
    strategicAdvice: string;       // 战略建议（详细文本）
    metadata: BizscanMetadata;
    // 交叉验证数据（可选，提升数据利用率）
    crossValidation?: {
        divergences: Array<{ dimension: string; agents: string[]; scoreDelta: number; resolution: string }>;
        calibratedScores: { semanticNovelty: number; competitiveLandscape: number; marketGap: number; feasibility: number };
        consistencyScore: number;
        evidenceConflicts: string[];
    };
    consensusLevel?: 'strong' | 'moderate' | 'weak';
    executionMeta?: {
        totalTimeMs: number;
        timeoutsOccurred: string[];
        agentTimings: Record<string, number>;
    };
}

/** 元数据 */
export interface BizscanMetadata {
    searchTimeMs: number;
    sourcesScanned: number;
    competitorsFound: number;
    modelUsed: string;
    dataSourcesUsed: string[];
}

// ============================================================
//  数据采集层类型
// ============================================================

/** 单个搜索结果（通用） */
export interface MarketSearchResult {
    title: string;
    url: string;
    snippet: string;
    source: 'brave' | 'serpapi' | 'producthunt' | 'github' | 'crowdfunding';
}

/** Product Hunt 产品 */
export interface ProductHuntItem {
    name: string;
    tagline: string;
    url: string;
    votesCount: number;
    topics: string[];
}

/** GitHub 开源替代方案 */
export interface GitHubAlternative {
    name: string;
    fullName: string;
    description: string;
    url: string;
    stars: number;
    language: string;
    updatedAt: string;
}

/** 聚合的市场信号 */
export interface MarketSignals {
    webResults: MarketSearchResult[];
    productHuntItems: ProductHuntItem[];
    githubAlternatives: GitHubAlternative[];
    crowdfundingResults: MarketSearchResult[];
    totalSourcesScanned: number;
    dataSourcesUsed: string[];
}

// ============================================================
//  SSE 事件类型
// ============================================================

export type BizscanSSEEvent =
    | { type: 'progress'; phase: string; message: string; progress: number }
    | { type: 'idea_parsed'; data: ParsedBusinessIdea }
    | { type: 'data_gathered'; data: { competitorsFound: number; sourcesScanned: number } }
    | { type: 'openclaw_detected'; data: { keywords: string[]; confidence: number } }
    | { type: 'evaluation_complete'; data: BizscanReport }
    | { type: 'error'; message: string };
