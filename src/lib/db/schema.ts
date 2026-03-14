export interface LocalSearchRecord {
    id?: number;
    query: string;
    queryHash: string;
    timestamp: number;
    extractedInnovations: {
        innovationId: string;
        keyword: string;
        noveltyScore: number;
        category: string;
        domainId?: string;
        subDomainId?: string;
    }[];
    sessionId: string;
    credibility?: number;     // 新增：双轨验证可信度分数
}

export interface LocalInnovationCache {
    innovationId: string;
    keyword: string;
    noveltyScore: number;
    category: string;
    domainId?: string;
    subDomainId?: string;
    searchCount: number;
    cachedAt: number;
}

export interface AgentResult {
    agentId: string;
    status: 'pending' | 'running' | 'completed' | 'timeout' | 'error';
    startTime: number;
    endTime?: number;
    executionTimeMs?: number;
    output?: {
        score?: number;
        analysis?: string;
        findings?: string[];
        redFlags?: string[];
        dimensionScores?: Array<{ name: string; score: number; reasoning: string }>;
        evidenceSources?: string[];
        reasoning?: string;
        confidenceReasoning?: string;
    };
    error?: { message: string; type: 'timeout' | 'api_error' | 'parse_error' | 'unknown'; };
}

export interface AgentExecutionRecord {
    id?: number;
    executionId: string;
    query: string;
    queryHash: string;
    timestamp: number;
    sessionId: string;
    agents: {
        academicReviewer?: AgentResult;
        industryAnalyst?: AgentResult;
        innovationEvaluator?: AgentResult;
        competitorDetective?: AgentResult;
        crossDomainScout?: AgentResult;
        arbitrator?: AgentResult;
    };
    metadata: {
        totalExecutionTimeMs: number;
        timeoutOccurred: boolean;
        agentsCompleted: number;
        agentsTimedOut: number;
        modelProvider: 'deepseek' | 'minimax' | 'moonshot';
    };
    finalResult?: {
        noveltyScore: number;
        internetNoveltyScore: number;
        credibilityScore: number;
        recommendation: string;
    };
}

/**
 * 搜索历史报告缓存记录
 * 缓存从服务端加载的完整搜索报告，避免重复请求
 */
export interface HistoryReportCacheRecord {
    /** Supabase search_history 表的主键 ID */
    historyId: string;
    /** 搜索关键词 */
    query: string;
    /** 完整的 result JSON */
    result: any;
    /** 缓存时间戳 */
    cachedAt: number;
}
