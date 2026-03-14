// ============================================================
//  Clawscan — OpenClaw 创新应用查重 核心类型定义
// ============================================================

/** 用户输入 */
export interface ClawscanInput {
    ideaDescription: string;       // 核心：OpenClaw 应用构想描述（必填）
    modelProvider?: string;
    privacyMode?: boolean;
}

/** AI 提取的结构化想法要素 */
export interface ParsedClawIdea {
    coreCapabilities: string[];    // 核心能力点（3-8 个）
    searchKeywords: string[];      // 用于网络搜索的关键词
    synonyms: string[];            // 同义词/英文对照
    platform: string;              // CLI/Web/App/API/Bot/其他
    category: string;              // 工具/服务/框架/插件/其他
    problemStatement: string;      // 想要解决的问题
    targetUser: string;            // 目标用户
}

// ============================================================
//  数据采集层类型
// ============================================================

/** ClawHub Registry 中的 Skill */
export interface RegistrySkill {
    name: string;
    author?: string;
    description?: string;
    tags?: string[];
    installs?: number;
    githubUrl?: string;
    features?: string[];
    /** 预计算搜索索引 */
    _searchIndex?: string;
}

/** 单条网络搜索结果 */
export interface WebSearchResult {
    title: string;
    url: string;
    snippet: string;
    source: 'brave' | 'serpapi';
    age?: string;                  // e.g. "2 days ago"
}

/** GitHub 开源实现 */
export interface GitHubRepo {
    name: string;
    fullName: string;
    description: string;
    url: string;
    stars: number;
    language: string;
    updatedAt: string;
}

/** 聚合的多源搜索信号 */
export interface ClawscanSearchSignals {
    registrySkills: RegistrySkill[];       // ClawHub Registry 候选
    webCaseResults: WebSearchResult[];     // 网络落地案例
    githubRepos: GitHubRepo[];             // GitHub 开源实现
    caseVaultResults?: CaseStudy[];        // CaseVault 案例库匹配
    totalSourcesScanned: number;
    dataSourcesUsed: string[];
}

// ============================================================
//  Agent 评估结果类型
// ============================================================

/** 单个匹配 Skill 的评分结果 */
export interface SkillMatchResult {
    name: string;
    author: string;
    description: string;
    githubUrl: string;
    installs: string;              // 格式化后的安装量
    installsRaw: number;
    similarityPercentage: number;  // 0-100
    reason: string;                // AI 判断理由
    matchedFeatures: string[];     // 匹配的核心功能点
    allFeatures: string[];         // Skill 的全部功能
    tags: string[];
    coverageRate: number;          // 功能覆盖率
}

/** 单个实战案例 */
export interface CaseStudy {
    title: string;
    url: string;
    snippet: string;
    source: string;
    relevanceScore: number;        // 0-100
    keyInsight: string;            // AI 提取的关键洞察
    technologyUsed?: string;       // 使用的技术
    deploymentScale?: string;      // 部署规模
}

/** 功能覆盖分析 */
export interface FeatureCoverage {
    feature: string;
    required: boolean;
    covered: boolean;
    coveredBy: string;
}

// ============================================================
//  最终报告
// ============================================================

/** Clawscan 最终报告 */
export interface ClawscanReport {
    // 解析结果
    parsedIdea: ParsedClawIdea;

    // 综合评估
    overallScore: number;          // 0-100 综合查重分数
    duplicationLevel: 'high' | 'medium' | 'low' | 'none';
    grade: 'S' | 'A' | 'B' | 'C' | 'D';
    verdict: string;               // 一句话结论

    // Registry 匹配
    similarSkills: SkillMatchResult[];
    featureCoverage: FeatureCoverage[];

    // 实战案例
    caseStudies: CaseStudy[];

    // 建议
    recommendation: {
        type: 'use_existing' | 'differentiate' | 'build_new';
        text: string;
        details: string;
        actionText: string;
    };
    strategicAdvice: string;       // 详细战略建议
    riskWarnings: string[];        // 风险红旗

    // Agent 原始输出
    agentOutputs: {
        registryScout: { analysis: string; score: number; keyFindings: string[] };
        caseAnalyst: { analysis: string; score: number; keyFindings: string[] };
        noveltyAuditor: { analysis: string; score: number; keyFindings: string[] };
        strategicArbiter: { analysis: string; score: number; keyFindings: string[] };
    };

    // 元数据
    metadata: {
        searchTimeMs: number;
        registrySize: number;
        candidatesEvaluated: number;
        webResultsFound: number;
        githubReposFound: number;
        modelUsed: string;
        dataSourcesUsed: string[];
        agentTimings: Record<string, number>;
        timeoutsOccurred: string[];
        mode?: 'registry' | 'full';
    };
}

// ============================================================
//  SSE 事件类型
// ============================================================

export type ClawscanSSEEvent =
    | { type: 'progress'; phase: string; message: string; progress: number }
    | { type: 'idea_parsed'; data: ParsedClawIdea; progress: number }
    | { type: 'data_gathered'; data: { registryCount: number; webCasesCount: number; githubCount: number; sourcesScanned: number }; progress: number }
    | { type: 'agent_log'; message: string }
    | { type: 'agent_state'; data: any }
    | { type: 'evaluation_complete'; data: ClawscanReport; progress: number }
    | { type: 'error'; message: string };
