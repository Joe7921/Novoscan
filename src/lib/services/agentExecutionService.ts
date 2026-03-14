import { db } from '../db';
import { AgentExecutionRecord, AgentResult } from '../db/schema';

export const agentExecutionService = {
    async createExecution(query: string, modelProvider: 'deepseek' | 'minimax' | 'moonshot') {
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const record: AgentExecutionRecord = {
            executionId,
            query,
            queryHash: Array.from(query).reduce((hash, char) => 0 | (31 * hash + char.charCodeAt(0)), 0).toString(),
            timestamp: Date.now(),
            sessionId: 'server', // 后续可以跟前端 sessionId 关联，暂时用 server
            agents: {},
            metadata: {
                totalExecutionTimeMs: 0,
                timeoutOccurred: false,
                agentsCompleted: 0,
                agentsTimedOut: 0,
                modelProvider,
            }
        };
        if (typeof window !== 'undefined' && db.agentExecutions) {
            await db.agentExecutions.add(record);
        }
        return executionId;
    },

    async updateAgentStatus(executionId: string, agentId: keyof AgentExecutionRecord['agents'], update: Partial<AgentResult>) {
        try {
            if (typeof window === 'undefined' || !db.agentExecutions) return;
            const record = await db.agentExecutions.where('executionId').equals(executionId).first();
            if (record) {
                record.agents[agentId] = {
                    ...(record.agents[agentId] || { agentId, status: 'pending', startTime: Date.now() }),
                    ...update
                } as AgentResult;
                await db.agentExecutions.put(record);
            }
        } catch (e) {
            console.error('[AgentExecutionService] 状态更新异常:', e);
        }
    },

    async completeExecution(executionId: string, finalResult: any, metadata: any) {
        try {
            if (typeof window === 'undefined' || !db.agentExecutions) return;
            const record = await db.agentExecutions.where('executionId').equals(executionId).first();
            if (record) {
                record.finalResult = finalResult;
                record.metadata = { ...record.metadata, ...metadata };
                await db.agentExecutions.put(record);
            }
        } catch (e) {
            console.error('[AgentExecutionService] 完成状态写入异常:', e);
        }
    },

    async getRecentExecutions(limit: number = 10) {
        try {
            if (typeof window === 'undefined' || !db.agentExecutions) return [];
            return await db.agentExecutions.orderBy('timestamp').reverse().limit(limit).toArray();
        } catch (e) {
            console.error('[AgentExecutionService] 读取历史记录异常:', e);
            return [];
        }
    },

    async saveExecutionRecord(record: AgentExecutionRecord) {
        if (typeof window === 'undefined' || !db.agentExecutions) return;
        try {
            // 这里传进来的是已经组装好的服务端记录，直接作为一条新的完整记录写入即可
            await db.agentExecutions.put(record);
        } catch (e) {
            console.error('[AgentExecutionService] 保存历史记录异常:', e);
        }
    }
};
