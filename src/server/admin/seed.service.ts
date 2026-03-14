/**
 * seed.service — 测试数据注入/清除服务
 *
 * 注入带 [TEST] 标记的测试数据，便于验证运维功能。
 */

import { supabaseAdmin } from '@/lib/supabase';

const TEST_PREFIX = '[TEST] ';

export interface SeedResult {
    success: boolean;
    message: string;
    details?: Record<string, string>;
}

/**
 * 注入测试数据
 */
export async function injectTestData(): Promise<SeedResult> {
    const now = Date.now();
    const details: Record<string, string> = {};

    // 1. search_history 测试记录
    const searchRecords = [
        {
            query: `${TEST_PREFIX}基于深度学习的蛋白质结构预测`,
            domain: 'biology',
            model_provider: 'minimax',
            search_time_ms: 145000,
            result: {
                success: true, isMultiAgent: true, isPartial: false, noveltyScore: 72,
                executionRecord: {
                    agents: {
                        academicReviewer: { status: 'completed', executionTimeMs: 28000, output: { score: 65 } },
                        industryAnalyst: { status: 'completed', executionTimeMs: 22000, output: { score: 70 } },
                        competitorDetective: { status: 'completed', executionTimeMs: 18000, output: { score: 75 } },
                        innovationEvaluator: { status: 'completed', executionTimeMs: 25000, output: { score: 72 } },
                        arbitrator: { status: 'completed', executionTimeMs: 15000, output: { score: 72 } },
                    }
                },
            },
            created_at: new Date(now - 3600000).toISOString(),
        },
        {
            query: `${TEST_PREFIX}量子纠错码与拓扑量子计算`,
            domain: 'physics',
            model_provider: 'deepseek',
            search_time_ms: 89000,
            result: {
                success: true, isMultiAgent: true, isPartial: false, noveltyScore: 88,
                executionRecord: {
                    agents: {
                        academicReviewer: { status: 'completed', executionTimeMs: 20000, output: { score: 90 } },
                        industryAnalyst: { status: 'completed', executionTimeMs: 15000, output: { score: 85 } },
                        competitorDetective: { status: 'completed', executionTimeMs: 12000, output: { score: 88 } },
                        innovationEvaluator: { status: 'completed', executionTimeMs: 18000, output: { score: 92 } },
                        arbitrator: { status: 'completed', executionTimeMs: 10000, output: { score: 88 } },
                    }
                },
            },
            created_at: new Date(now - 7200000).toISOString(),
        },
        {
            query: `${TEST_PREFIX}自主飞行器群体智能协同`,
            domain: 'engineering',
            model_provider: 'minimax',
            search_time_ms: 45000,
            result: {
                success: false, error: 'AllAgentsFailedError: 所有 AI 模型 API 调用均超时',
                errorType: 'AllAgentsFailedError', isPartial: true,
            },
            created_at: new Date(now - 1800000).toISOString(),
        },
        {
            query: `${TEST_PREFIX}可解释 AI 在医疗诊断中的应用`,
            domain: 'medical',
            model_provider: 'minimax',
            search_time_ms: 200000,
            result: {
                success: true, isMultiAgent: true, isPartial: true, noveltyScore: 55,
                executionRecord: {
                    agents: {
                        academicReviewer: { status: 'completed', executionTimeMs: 35000, output: { score: 60 } },
                        industryAnalyst: { status: 'timeout', executionTimeMs: 60000, output: null },
                        competitorDetective: { status: 'completed', executionTimeMs: 28000, output: { score: 50 } },
                        innovationEvaluator: { status: 'timeout', executionTimeMs: 60000, output: null },
                        arbitrator: { status: 'completed', executionTimeMs: 20000, output: { score: 55 } },
                    }
                },
            },
            created_at: new Date(now - 5400000).toISOString(),
        },
    ];

    const { error: searchErr } = await supabaseAdmin.from('search_history').insert(searchRecords);
    details.search_history = searchErr
        ? `失败: ${searchErr.message}`
        : `${searchRecords.length} 条记录`;

    // 2. api_call_logs 测试记录
    const apiRecords = [];
    const providers = ['minimax', 'deepseek'];
    const callTypes = ['academic_review', 'industry_analysis', 'innovation_eval', 'arbitration'];

    for (let i = 0; i < 20; i++) {
        apiRecords.push({
            provider: providers[i % 2],
            call_type: `${TEST_PREFIX}${callTypes[i % 4]}`,
            response_time_ms: 3000 + Math.floor(Math.random() * 25000),
            is_success: true,
            estimated_tokens: 800 + Math.floor(Math.random() * 4000),
            called_at: new Date(now - Math.floor(Math.random() * 86400000)).toISOString(),
        });
    }

    for (let i = 0; i < 5; i++) {
        apiRecords.push({
            provider: providers[i % 2],
            call_type: `${TEST_PREFIX}${callTypes[i % 4]}`,
            response_time_ms: 30000 + Math.floor(Math.random() * 10000),
            is_success: false,
            error_message: ['503 Service Unavailable', 'Request timeout', 'Rate limit exceeded'][i % 3],
            estimated_tokens: 0,
            called_at: new Date(now - Math.floor(Math.random() * 86400000)).toISOString(),
        });
    }

    const { error: apiErr } = await supabaseAdmin.from('api_call_logs').insert(apiRecords);
    if (apiErr) {
        details.api_call_logs = apiErr.message.includes('does not exist')
            ? '表不存在，跳过'
            : `失败: ${apiErr.message}`;
    } else {
        details.api_call_logs = `${apiRecords.length} 条记录`;
    }

    const hasErr = searchErr && apiErr;
    return {
        success: !hasErr,
        message: hasErr ? '部分数据注入失败' : '测试数据注入成功',
        details,
    };
}

/**
 * 清除测试数据
 */
export async function cleanTestData(): Promise<SeedResult> {
    const details: Record<string, string> = {};

    // search_history
    const { count: searchCount } = await supabaseAdmin.from('search_history')
        .select('*', { count: 'exact', head: true })
        .like('query', `${TEST_PREFIX}%`);

    const { error: searchErr } = await supabaseAdmin.from('search_history')
        .delete()
        .like('query', `${TEST_PREFIX}%`);

    details.search_history = searchErr
        ? `失败: ${searchErr.message}`
        : `已清除 ${searchCount || 0} 条`;

    // api_call_logs
    const { count: apiCount } = await supabaseAdmin.from('api_call_logs')
        .select('*', { count: 'exact', head: true })
        .like('call_type', `${TEST_PREFIX}%`);

    if (apiCount !== null) {
        const { error: apiErr } = await supabaseAdmin.from('api_call_logs')
            .delete()
            .like('call_type', `${TEST_PREFIX}%`);

        details.api_call_logs = apiErr
            ? `失败: ${apiErr.message}`
            : `已清除 ${apiCount || 0} 条`;
    }

    return {
        success: true,
        message: '测试数据清除完成',
        details,
    };
}
