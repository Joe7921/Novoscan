import { getCachedResult, setCachedResult } from '../../localCache';

// 前端调用Next.js API路由
export async function searchDualTrack(keywords: string[], domain: string) {
    const res = await fetch('/api/dual-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, domain })
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Dual-track API error: ${res.status}`);
    }
    return res.json();
}

export async function analyzeWithAI(
    query: string,
    domain: string,
    language: string,
    modelProvider: string,
    onProgress?: (event: 'log' | 'progress' | 'agent_state' | 'agent_stream' | 'agent_thinking' | 'context_ready' | 'error', data: any) => void,
    domainId?: string,
    subDomainId?: string,
    domainHint?: string,
    privacyMode?: boolean,
    signal?: AbortSignal
) {
    // 隐私模式下跳过本地缓存读取
    if (!privacyMode) {
        const cached = getCachedResult(query);
        // 不返回降级/超时的缓存结果，强制重新分析
        if (cached && !cached.isPartial && !cached.arbitration?.isPartial) {
            return { ...cached, fromCache: true, cacheSavedMs: 0 };
        }
    }

    const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, domain, language, modelProvider, domainId, subDomainId, domainHint, privacyMode: privacyMode || false }),
        signal,
    });


    if (!res.ok) {
        let errData: any = {};
        try { errData = await res.json(); } catch (e) { }
        throw new Error(errData.error || `Analyze API error: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('ReadableStream not supported');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalData: any = null;

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'done') {
                    finalData = parsed.data;
                } else if (parsed.type === 'all_agents_failed') {
                    // AI API 不可用，抛出包含模型切换建议的错误
                    const info = parsed.data;
                    const refundMsg = info.refunded ? '（已自动退还消耗的点数）' : '';
                    const modelHint = info.modelProvider ? `\n当前模型 ${info.modelProvider} 可能暂时不可用，建议切换其他模型重试。` : '';
                    throw new Error(`AI_SERVICE_UNAVAILABLE:${info.message || 'AI 服务暂时不可用'}${refundMsg}${modelHint}`);
                } else if (parsed.type === 'error') {
                    // 其他服务器端错误
                    if (onProgress) onProgress('error', parsed.data);
                } else if (onProgress) {
                    onProgress(parsed.type, parsed.data);
                }
            } catch (e) {
                // 区分主动抛出的错误和 JSON 解析错误
                if (e instanceof Error && e.message.startsWith('AI_SERVICE_UNAVAILABLE:')) {
                    throw new Error(e.message.replace('AI_SERVICE_UNAVAILABLE:', ''));
                }
                console.error('[API Client] Failed to parse stream line:', line, e);
            }
        }
    }

    if (!finalData) {
        throw new Error('No final data received from stream.');
    }

    // 只缓存完整（非降级）的分析结果，隐私模式下不缓存
    if (!privacyMode && finalData.success && !finalData.fromCache && !finalData.isPartial && !finalData.arbitration?.isPartial) {
        setCachedResult(query, finalData);
    }

    return finalData;
}

/**
 * Flash 极速模式 API 调用
 * 全并行 Agent + 跳过辩论/跨域/DNA，~70s 内完成
 */
export async function analyzeFlash(
    query: string,
    domain: string,
    language: string,
    modelProvider: string,
    onProgress?: (event: 'log' | 'progress' | 'agent_state' | 'agent_stream' | 'agent_thinking' | 'context_ready' | 'error', data: any) => void,
    domainId?: string,
    subDomainId?: string,
    domainHint?: string,
    privacyMode?: boolean,
    signal?: AbortSignal
) {
    const res = await fetch('/api/flash-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, domain, language, modelProvider, domainId, subDomainId, domainHint, privacyMode: privacyMode || false }),
        signal,
    });

    if (!res.ok) {
        let errData: any = {};
        try { errData = await res.json(); } catch (e) { }
        throw new Error(errData.error || `Flash API error: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('ReadableStream not supported');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalData: any = null;

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'done') {
                    finalData = parsed.data;
                } else if (onProgress) {
                    onProgress(parsed.type, parsed.data);
                }
            } catch (e) {
                console.error('[API Client] Failed to parse flash stream line:', line, e);
            }
        }
    }

    if (!finalData) {
        throw new Error('No final data received from flash stream.');
    }

    return finalData;
}

export async function generateFollowUp(
    query: string,
    arbitrationSummary: string,
    keyFindings: string[] = [],
    redFlags: string[] = [],
    language: string = 'zh',
    modelProvider: string = 'deepseek'
) {
    const res = await fetch('/api/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'generate',
            query,
            arbitrationSummary,
            keyFindings,
            redFlags,
            language,
            modelProvider
        })
    });

    if (!res.ok) {
        let errData: any = {};
        try { errData = await res.json(); } catch (e) { }
        throw new Error(errData.error || `Generate Followup API error: ${res.status}`);
    }

    const data = await res.json();
    return data.questions || [];
}

export async function refineWithFollowUp(
    query: string,
    dualTrackResult: any,
    selectedQuestions: string[],
    userInput: string,
    previousSummary: string,
    language: string,
    modelProvider: string,
    onProgress?: (event: 'log' | 'progress' | 'agent_state' | 'agent_stream' | 'agent_thinking' | 'context_ready' | 'refine_title' | 'error' | 'done', data: any) => void,
    domainId?: string,
    subDomainId?: string,
    domainHint?: string,
    round: number = 1,
    privacyMode: boolean = false,
    parentSearchId?: string
) {
    const res = await fetch('/api/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'refine',
            query,
            dualTrackResult,
            selectedQuestions,
            userInput,
            previousSummary,
            language,
            modelProvider,
            domainId,
            subDomainId,
            domainHint,
            round,
            privacyMode,
            parentSearchId
        })
    });

    if (!res.ok) {
        let errData: any = {};
        try { errData = await res.json(); } catch (e) { }
        throw new Error(errData.error || `Refine Followup API error: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('ReadableStream not supported');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finalData: any = null;

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'done') {
                    finalData = parsed.data;
                } else if (parsed.type === 'all_agents_failed') {
                    const info = parsed.data;
                    const refundMsg = info.refunded ? '（已自动退还消耗的点数）' : '';
                    const modelHint = info.modelProvider ? `\n当前模型 ${info.modelProvider} 可能暂时不可用，建议切换其他模型重试。` : '';
                    throw new Error(`AI_SERVICE_UNAVAILABLE:${info.message || 'AI 服务暂时不可用'}${refundMsg}${modelHint}`);
                }
                if (onProgress) {
                    onProgress(parsed.type, parsed.data);
                }
            } catch (e) {
                if (e instanceof Error && e.message.startsWith('AI_SERVICE_UNAVAILABLE:')) {
                    throw new Error(e.message.replace('AI_SERVICE_UNAVAILABLE:', ''));
                }
                console.error('[API Client] Failed to parse stream line:', line, e);
            }
        }
    }

    if (!finalData) {
        throw new Error('No final data received from refine stream.');
    }

    return finalData;
}

/**
 * 分级重试 — 重试指定的失败 Agent
 * 复用已有检索数据，不消耗额外点数
 */
export async function retryAgents(
    agentIds: string[],
    query: string,
    academicData: any,
    industryData: any,
    modelProvider: string = 'minimax',
    language: string = 'zh',
    domainHint?: string,
    domainId?: string,
    subDomainId?: string,
    existingAgentResults?: Record<string, any>,
): Promise<{ success: boolean; results: Record<string, any>; successCount: number; failureDetails?: Record<string, string> }> {
    const res = await fetch('/api/agent-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agentIds,
            query,
            academicData,
            industryData,
            modelProvider,
            language,
            domainHint,
            domainId,
            subDomainId,
            existingAgentResults,
        })
    });

    if (!res.ok) {
        let errData: any = {};
        try { errData = await res.json(); } catch (e) { }
        throw new Error(errData.error || `Agent Retry API error: ${res.status}`);
    }

    return res.json();
}

/**
 * 完全重试 — 重跑全部 Agent + 仲裁员 + 质量检查
 * 复用已有检索数据，消耗 8 点
 */
export async function fullRetryAgents(
    query: string,
    academicData: any,
    industryData: any,
    modelProvider: string = 'minimax',
    language: string = 'zh',
    domainHint?: string,
    domainId?: string,
    subDomainId?: string,
): Promise<any> {
    const res = await fetch('/api/agent-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'full-retry',
            query,
            academicData,
            industryData,
            modelProvider,
            language,
            domainHint,
            domainId,
            subDomainId,
        })
    });

    if (!res.ok) {
        let errData: any = {};
        try { errData = await res.json(); } catch (e) { }
        // 特殊处理：余额不足
        if (res.status === 402) {
            throw new Error(errData.error || '余额不足，无法进行完全重试');
        }
        throw new Error(errData.error || `Full Retry API error: ${res.status}`);
    }

    return res.json();
}

/** 按 Agent 数量动态计费 — 1个=3点，2个=5点，3个=7点，4个=8点 */
export function calculatePartialRetryCost(agentCount: number): number {
    const costs = [0, 3, 5, 7, 8];
    return costs[Math.min(agentCount, 4)] || 3;
}

/**
 * 部分重试 — 重试指定 Agent + 重算仲裁（动态计费）
 */
export async function partialRetryAgents(
    agentIds: string[],
    query: string,
    academicData: any,
    industryData: any,
    modelProvider: string = 'minimax',
    language: string = 'zh',
    domainHint?: string,
    domainId?: string,
    subDomainId?: string,
    existingAgentResults?: Record<string, any>,
): Promise<any> {
    const res = await fetch('/api/agent-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            mode: 'partial-retry',
            agentIds,
            query,
            academicData,
            industryData,
            modelProvider,
            language,
            domainHint,
            domainId,
            subDomainId,
            existingAgentResults,
        })
    });

    if (!res.ok) {
        let errData: any = {};
        try { errData = await res.json(); } catch (e) { }
        if (res.status === 402) {
            throw new Error(errData.error || '余额不足');
        }
        throw new Error(errData.error || `Partial Retry API error: ${res.status}`);
    }

    return res.json();
}
