/**
 * seed — 注入/清除测试数据
 *
 * 用法：
 *   seed                   注入测试数据（带 [TEST] 标记）
 *   seed clean             清除所有 [TEST] 标记的测试数据
 *
 * 别名: t, test
 *
 * 注入的数据包含：
 *   - search_history: 成功/失败/部分完成的分析记录
 *   - api_call_logs: 各 Provider 的成功/失败 API 调用记录
 */

import chalk from 'chalk';
import { supabase } from '../lib/supabase.js';

const TEST_PREFIX = '[TEST] ';

export default async function seed(args: string[]) {
    if (args[0] === 'clean' || args[0] === 'clear') {
        return cleanTestData();
    }
    return injectTestData();
}

async function injectTestData() {
    console.log(chalk.bold('\n  🌱 注入测试数据\n'));

    const now = Date.now();

    // ==================== 1. search_history 测试记录 ====================
    const searchRecords = [
        // 成功记录
        {
            query: `${TEST_PREFIX}基于深度学习的蛋白质结构预测`,
            domain: 'biology',
            model_provider: 'minimax',
            search_time_ms: 145000,
            result: {
                success: true,
                isMultiAgent: true,
                isPartial: false,
                noveltyScore: 72,
                summary: '该研究方向已有大量前沿工作，但仍有优化空间。',
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
            created_at: new Date(now - 3600000).toISOString(), // 1小时前
        },
        {
            query: `${TEST_PREFIX}量子纠错码与拓扑量子计算`,
            domain: 'physics',
            model_provider: 'deepseek',
            search_time_ms: 89000,
            result: {
                success: true,
                isMultiAgent: true,
                isPartial: false,
                noveltyScore: 88,
                summary: '高度创新的方向，现有文献覆盖有限。',
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
            created_at: new Date(now - 7200000).toISOString(), // 2小时前
        },
        // 失败记录
        {
            query: `${TEST_PREFIX}自主飞行器群体智能协同`,
            domain: 'engineering',
            model_provider: 'minimax',
            search_time_ms: 45000,
            result: {
                success: false,
                error: 'AllAgentsFailedError: 所有 AI 模型 API 调用均超时',
                errorType: 'AllAgentsFailedError',
                failedAgents: ['academicReviewer', 'industryAnalyst'],
                isPartial: true,
            },
            created_at: new Date(now - 1800000).toISOString(), // 30分钟前
        },
        {
            query: `${TEST_PREFIX}脑机接口非侵入式信号增强`,
            domain: 'neuroscience',
            model_provider: 'gemini',
            search_time_ms: 12000,
            result: {
                success: false,
                error: 'FatalError: 双轨检索超时',
                errorType: 'FatalError',
                isPartial: true,
            },
            created_at: new Date(now - 600000).toISOString(), // 10分钟前
        },
        // 部分完成
        {
            query: `${TEST_PREFIX}可解释 AI 在医疗诊断中的应用`,
            domain: 'medical',
            model_provider: 'minimax',
            search_time_ms: 200000,
            result: {
                success: true,
                isMultiAgent: true,
                isPartial: true,
                noveltyScore: 55,
                summary: '部分 Agent 超时，结果可能不完整。',
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
            created_at: new Date(now - 5400000).toISOString(), // 1.5小时前
        },
    ];

    const { error: searchErr } = await supabase.from('search_history').insert(searchRecords);
    if (searchErr) {
        console.error(chalk.red(`  ❌ search_history 写入失败: ${searchErr.message}`));
    } else {
        console.log(chalk.green(`  ✅ search_history: ${searchRecords.length} 条记录`));
    }

    // ==================== 2. api_call_logs 测试记录 ====================
    const apiRecords = [];
    const providers = ['minimax', 'deepseek', 'gemini'];
    const callTypes = ['academic_review', 'industry_analysis', 'innovation_eval', 'arbitration'];

    // 成功调用
    for (let i = 0; i < 20; i++) {
        const provider = providers[i % 3];
        const callType = callTypes[i % 4];
        apiRecords.push({
            provider,
            call_type: `${TEST_PREFIX}${callType}`,
            response_time_ms: 3000 + Math.floor(Math.random() * 25000),
            is_success: true,
            estimated_tokens: 800 + Math.floor(Math.random() * 4000),
            called_at: new Date(now - Math.floor(Math.random() * 86400000)).toISOString(),
        });
    }

    // 失败调用
    const errorMessages = [
        '503 Service Unavailable',
        'Request timeout after 30000ms',
        'Rate limit exceeded',
        'Invalid API key',
        'Model overloaded, please retry',
    ];
    for (let i = 0; i < 5; i++) {
        apiRecords.push({
            provider: providers[i % 3],
            call_type: `${TEST_PREFIX}${callTypes[i % 4]}`,
            response_time_ms: 30000 + Math.floor(Math.random() * 10000),
            is_success: false,
            error_message: errorMessages[i],
            estimated_tokens: 0,
            called_at: new Date(now - Math.floor(Math.random() * 86400000)).toISOString(),
        });
    }

    const { error: apiErr } = await supabase.from('api_call_logs').insert(apiRecords);
    if (apiErr) {
        if (apiErr.message.includes('does not exist') || apiErr.code === '42P01') {
            console.log(chalk.yellow(`  ⚠️  api_call_logs 表不存在，跳过 API 调用测试数据`));
        } else {
            console.error(chalk.red(`  ❌ api_call_logs 写入失败: ${apiErr.message}`));
        }
    } else {
        console.log(chalk.green(`  ✅ api_call_logs: ${apiRecords.length} 条记录 (${20} 成功 + ${5} 失败)`));
    }

    console.log(chalk.bold('\n  📋 注入汇总'));
    console.log(`  search_history:  ${chalk.green('3 成功')} + ${chalk.red('2 失败')} + ${chalk.yellow('1 部分完成')}`);
    console.log(`  api_call_logs:   ${chalk.green('20 成功')} + ${chalk.red('5 失败')}`);
    console.log(chalk.dim(`\n  所有测试数据均以 "${TEST_PREFIX}" 开头`));
    console.log(chalk.dim(`  验证完毕后: npm run cli seed clean\n`));
}

async function cleanTestData() {
    console.log(chalk.bold('\n  🧹 清除测试数据\n'));

    // search_history
    const { count: searchCount } = await supabase.from('search_history')
        .select('*', { count: 'exact', head: true })
        .like('query', `${TEST_PREFIX}%`);

    const { error: searchErr } = await supabase.from('search_history')
        .delete()
        .like('query', `${TEST_PREFIX}%`);

    if (searchErr) {
        console.error(chalk.red(`  ❌ search_history 清除失败: ${searchErr.message}`));
    } else {
        console.log(chalk.green(`  ✅ search_history: 已清除 ${searchCount || 0} 条测试记录`));
    }

    // api_call_logs
    const { count: apiCount } = await supabase.from('api_call_logs')
        .select('*', { count: 'exact', head: true })
        .like('call_type', `${TEST_PREFIX}%`);

    if (apiCount !== null) {
        const { error: apiErr } = await supabase.from('api_call_logs')
            .delete()
            .like('call_type', `${TEST_PREFIX}%`);

        if (apiErr) {
            console.error(chalk.red(`  ❌ api_call_logs 清除失败: ${apiErr.message}`));
        } else {
            console.log(chalk.green(`  ✅ api_call_logs: 已清除 ${apiCount || 0} 条测试记录`));
        }
    }

    console.log(chalk.dim('\n  所有 [TEST] 标记的数据已清除\n'));
}
