/**
 * agents.service — Agent SRE 性能水位服务
 *
 * 从 search_history 的 result.executionRecord.agents 提取各 Agent 的运行指标。
 */

import { adminDb } from '@/lib/db/factory';

const AGENT_NAMES = ['academicReviewer', 'industryAnalyst', 'competitorDetective', 'innovationEvaluator', 'arbitrator'] as const;

const DISPLAY_NAMES: Record<string, string> = {
    academicReviewer: '学术审查员',
    industryAnalyst: '产业分析员',
    competitorDetective: '竞品侦探',
    innovationEvaluator: '创新评估师',
    arbitrator: '仲裁员',
};

function getPercentile(arr: number[], q: number): number {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    return sorted[base + 1] !== undefined
        ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
        : sorted[base];
}

/** 单个 Agent 的性能指标 */
export interface AgentMetrics {
    name: string;
    displayName: string;
    totalRuns: number;
    completedRate: string;   // "95.0"
    timeoutRate: string;     // "5.0"
    avgMs: number;
    p90Ms: number;
    avgScore: string;        // "7.5" 或 "-"
}

export interface AgentPerformanceResult {
    agents: AgentMetrics[];
    sampleSize: number;
    updatedAt: string;
}

/**
 * 获取 Agent 性能水位
 */
export async function getAgentPerformance(sampleSize = 300): Promise<AgentPerformanceResult> {
    const { data, error } = await adminDb.from('search_history')
        .select('result')
        .order('created_at', { ascending: false })
        .limit(sampleSize);

    if (error) throw new Error(`查询失败: ${error.message}`);

    const agentStats: Record<string, {
        totalRuns: number; completed: number; timedOut: number;
        timeMsArray: number[]; totalScore: number; scoreCount: number;
    }> = {};

    for (const name of AGENT_NAMES) {
        agentStats[name] = { totalRuns: 0, completed: 0, timedOut: 0, timeMsArray: [], totalScore: 0, scoreCount: 0 };
    }

    for (const record of data || []) {
        const execRecord = record.result?.executionRecord;
        if (!execRecord?.agents) continue;

        for (const name of AGENT_NAMES) {
            const agent = execRecord.agents[name];
            if (!agent) continue;

            const st = agentStats[name];
            st.totalRuns++;
            if (agent.status === 'completed') st.completed++;
            if (agent.status === 'timeout') st.timedOut++;
            if (agent.executionTimeMs && agent.executionTimeMs > 0) {
                st.timeMsArray.push(agent.executionTimeMs);
            }
            if (agent.output?.score != null) {
                st.totalScore += agent.output.score;
                st.scoreCount++;
            }
        }
    }

    const agents: AgentMetrics[] = AGENT_NAMES.map(name => {
        const s = agentStats[name];
        return {
            name,
            displayName: DISPLAY_NAMES[name] || name,
            totalRuns: s.totalRuns,
            completedRate: s.totalRuns > 0 ? ((s.completed / s.totalRuns) * 100).toFixed(1) : '0',
            timeoutRate: s.totalRuns > 0 ? ((s.timedOut / s.totalRuns) * 100).toFixed(1) : '0',
            avgMs: s.timeMsArray.length > 0
                ? Math.round(s.timeMsArray.reduce((a, b) => a + b, 0) / s.timeMsArray.length) : 0,
            p90Ms: Math.round(getPercentile(s.timeMsArray, 0.9)),
            avgScore: s.scoreCount > 0 ? (s.totalScore / s.scoreCount).toFixed(1) : '-',
        };
    });

    return {
        agents,
        sampleSize: data?.length || 0,
        updatedAt: new Date().toISOString(),
    };
}
