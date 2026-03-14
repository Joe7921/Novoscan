/**
 * stats — 今日/7日 KPI 总览
 *
 * 迁移自原 /api/admin/stats 路由逻辑
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { supabase } from '../lib/supabase.js';

export default async function stats(_args: string[]) {
    console.log(chalk.bold('\n  📊 Novoscan KPI 总览\n'));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 86400000);

    // 并行查询
    const [totalRes, recent7Res, apiCallsRes] = await Promise.all([
        supabase.from('search_history').select('*', { count: 'exact', head: true }),
        supabase.from('search_history').select('created_at, search_time_ms')
            .gte('created_at', sevenDaysAgo.toISOString()),
        supabase.from('api_call_logs').select('provider, estimated_tokens, response_time_ms, is_success, called_at')
            .gte('called_at', sevenDaysAgo.toISOString())
            .limit(10000),
    ]);

    const totalAnalyses = totalRes.count || 0;
    const recent7 = recent7Res.data || [];
    const apiCalls = apiCallsRes.data || [];

    // 今日/昨日发单量
    const getDateStr = (d: Date) => `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    const todayStr = getDateStr(todayStart);
    const yesterdayStr = getDateStr(yesterdayStart);

    let todayCount = 0, yesterdayCount = 0;
    for (const r of recent7) {
        if (!r.created_at) continue;
        const ds = getDateStr(new Date(r.created_at));
        if (ds === todayStr) todayCount++;
        else if (ds === yesterdayStr) yesterdayCount++;
    }

    const dod = yesterdayCount === 0 ? (todayCount > 0 ? '+100%' : '0%') :
        `${((todayCount - yesterdayCount) / yesterdayCount * 100).toFixed(1)}%`;

    // Token 汇总
    let totalTokens = 0, todayTokens = 0;
    let totalSucc = 0, totalFail = 0;
    let totalMs = 0;

    for (const c of apiCalls) {
        totalTokens += c.estimated_tokens || 0;
        if (c.is_success) totalSucc++; else totalFail++;
        totalMs += c.response_time_ms || 0;

        if (c.called_at) {
            const ds = getDateStr(new Date(c.called_at));
            if (ds === todayStr) todayTokens += c.estimated_tokens || 0;
        }
    }

    const avgMs = apiCalls.length > 0 ? Math.round(totalMs / apiCalls.length) : 0;
    const successRate = apiCalls.length > 0 ? ((totalSucc / apiCalls.length) * 100).toFixed(1) : '100';

    // 搜索平均耗时
    const validSearchTimes = recent7.filter(r => r.search_time_ms && r.search_time_ms > 0);
    const avgSearchMs = validSearchTimes.length > 0
        ? Math.round(validSearchTimes.reduce((s, r) => s + r.search_time_ms, 0) / validSearchTimes.length)
        : 0;

    // 输出表格
    const table = new Table({
        chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
        style: { head: ['cyan'] },
    });

    table.push(
        [chalk.dim('指标'), chalk.dim('数值'), chalk.dim('备注')],
        ['历史总发单', chalk.bold.white(totalAnalyses.toLocaleString()), ''],
        ['今日发单', chalk.bold.green(todayCount), `环比 ${dod}`],
        ['7日 Token', chalk.bold.yellow((totalTokens / 1_000_000).toFixed(3) + 'M'), `今日 ${(todayTokens / 1_000_000).toFixed(3)}M`],
        ['API 成功率', chalk.bold(Number(successRate) >= 95 ? chalk.green(successRate + '%') : chalk.red(successRate + '%')), `${totalSucc} 成功 / ${totalFail} 失败`],
        ['API 平均响应', chalk.bold.white(avgMs > 1000 ? (avgMs / 1000).toFixed(1) + 's' : avgMs + 'ms'), '所有 Provider 平均'],
        ['搜索平均耗时', chalk.bold.white(avgSearchMs > 1000 ? (avgSearchMs / 1000).toFixed(1) + 's' : avgSearchMs + 'ms'), `基于 ${validSearchTimes.length} 条记录`],
    );

    console.log(table.toString());
    console.log(chalk.dim(`\n  更新时间: ${now.toLocaleString('zh-CN')}\n`));
}
