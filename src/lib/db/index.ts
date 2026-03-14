import Dexie from 'dexie';
import type { LocalSearchRecord, LocalInnovationCache, AgentExecutionRecord, HistoryReportCacheRecord } from './schema';

export class NovoscanDatabase extends Dexie {
    searchRecords!: Dexie.Table<LocalSearchRecord, number>;
    innovationCache!: Dexie.Table<LocalInnovationCache, string>;

    constructor() {
        super('NovoscanDB');
        this.version(1).stores({
            searchRecords: '++id, queryHash, timestamp, sessionId',
            innovationCache: 'innovationId, keyword, category',
        });

        // 升级到版本 2
        this.version(2).stores({
            searchRecords: '++id, queryHash, timestamp, sessionId',
            innovationCache: 'innovationId, keyword, category',
            agentExecutions: '++id, executionId, queryHash, timestamp, sessionId',
        }).upgrade(() => {
            console.log('[DB] Upgraded to v2');
        });

        // 升级到版本 3：新增搜索历史报告缓存表
        this.version(3).stores({
            searchRecords: '++id, queryHash, timestamp, sessionId',
            innovationCache: 'innovationId, keyword, category',
            agentExecutions: '++id, executionId, queryHash, timestamp, sessionId',
            historyReportCache: 'historyId, cachedAt',
        }).upgrade(() => {
            console.log('[DB] Upgraded to v3: added historyReportCache');
        });
    }

    agentExecutions!: Dexie.Table<AgentExecutionRecord, number>;
    historyReportCache!: Dexie.Table<HistoryReportCacheRecord, string>;
}

export const db = typeof window !== 'undefined'
    ? new NovoscanDatabase()
    : {} as NovoscanDatabase;

export function getSessionId(): string {
    if (typeof window === 'undefined') return 'server';
    let id = sessionStorage.getItem('novoscan_session_id');
    if (!id) {
        id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        sessionStorage.setItem('novoscan_session_id', id);
    }
    return id;
}
