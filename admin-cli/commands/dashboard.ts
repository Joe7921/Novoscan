/**
 * dashboard — 一键总览
 *
 * 整合 stats + agents + costs + 最近失败，一条命令掌握全局。
 * 别名: d, dash
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { supabase } from '../lib/supabase.js';

export default async function dashboard(_args: string[]) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 86400000);

    console.log('');
    console.log(chalk.bold.blue('  ┌──────────────────────────────────────┐'));
    console.log(chalk.bold.blue('  │') + chalk.bold.white('   NOVOSCAN DASHBOARD                  ') + chalk.bold.blue('│'));
    console.log(chalk.bold.blue('  └──────────────────────────────────────┘'));

    // 并行查询所有数据
    const [totalRes, recent7Res, apiCallsRes, recentRecordsRes] = await Promise.all([
        supabase.from('search_history').select('*', { count: 'exact', head: true }),
        supabase.from('search_history').select('created_at, search_time_ms')
            .gte('created_at', sevenDaysAgo.toISOString()),
        supabase.from('api_call_logs').select('*')
            .gte('called_at', sevenDaysAgo.toISOString())
            .limit(10000),
        supabase.from('search_history').select('query, model_provider, search_time_ms, result, created_at')
            .order('created_at', { ascending: false })
            .limit(100),
    ]);

    const totalAnalyses = totalRes.count || 0;
    const recent7 = recent7Res.data || [];
    const apiCalls = apiCallsRes.data || [];
    const recentRecords = recentRecordsRes.data || [];

    // ===== KPI 概要 =====
    const getDateStr = (d: Date) => `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    const todayStr = getDateStr(todayStart);
    let todayCount = 0, todayTokens = 0;
    let totalSucc = 0, totalFail = 0;

    for (const r of recent7) {
        if (r.created_at && getDateStr(new Date(r.created_at)) === todayStr) todayCount++;
    }

    for (const c of apiCalls) {
        if (c.is_success) totalSucc++; else totalFail++;
        if (c.called_at && getDateStr(new Date(c.called_at)) === todayStr) {
            todayTokens += c.estimated_tokens || 0;
        }
    }

    const successRate = apiCalls.length > 0 ? ((totalSucc / apiCalls.length) * 100).toFixed(1) : '100';

    console.log(chalk.bold('\n  📊 KPI 概要'));
    const kpiTable = new Table({
        chars: { top: '─', 'top-mid': '┬', 'top-left': '  ┌', 'top-right': '┐', bottom: '─', 'bottom-mid': '┴', 'bottom-left': '  └', 'bottom-right': '┘', left: '  │', 'left-mid': '  ├', mid: '─', 'mid-mid': '┼', right: '│', 'right-mid': '┤', middle: '│' },
    });
    kpiTable.push(
        [chalk.dim('历史总量'), chalk.dim('今日发单'), chalk.dim('API 成功率'), chalk.dim('今日 Token')],
        [
            chalk.bold.white(totalAnalyses.toLocaleString()),
            chalk.bold.green(todayCount.toString()),
            Number(successRate) >= 95 ? chalk.bold.green(successRate + '%') : chalk.bold.red(successRate + '%'),
            chalk.bold.yellow((todayTokens / 1_000_000).toFixed(3) + 'M'),
        ]
    );
    console.log(kpiTable.toString());

    // ===== Agent 性能 =====
    const agentNames = ['academicReviewer', 'industryAnalyst', 'competitorDetective', 'innovationEvaluator', 'arbitrator'];
    const shortNames: Record<string, string> = {
        academicReviewer: '学术', industryAnalyst: '产业',
        competitorDetective: '竞品', innovationEvaluator: '创新', arbitrator: '仲裁',
    };

    const agentData: Record<string, { runs: number; completed: number; timeMs: number[] }> = {};
    for (const n of agentNames) agentData[n] = { runs: 0, completed: 0, timeMs: [] };

    for (const record of recentRecords) {
        const agents = record.result?.executionRecord?.agents;
        if (!agents) continue;
        for (const n of agentNames) {
            const a = agents[n];
            if (!a) continue;
            agentData[n].runs++;
            if (a.status === 'completed') agentData[n].completed++;
            if (a.executionTimeMs > 0) agentData[n].timeMs.push(a.executionTimeMs);
        }
    }

    console.log(chalk.bold('\n  🤖 Agent 水位'));
    const agentTable = new Table({
        head: ['Agent', '完成率', 'AVG', '状态'].map(h => chalk.cyan(h)),
        chars: { top: '─', 'top-mid': '┬', 'top-left': '  ┌', 'top-right': '┐', bottom: '─', 'bottom-mid': '┴', 'bottom-left': '  └', 'bottom-right': '┘', left: '  │', 'left-mid': '  ├', mid: '─', 'mid-mid': '┼', right: '│', 'right-mid': '┤', middle: '│' },
    });

    for (const n of agentNames) {
        const d = agentData[n];
        const rate = d.runs > 0 ? ((d.completed / d.runs) * 100).toFixed(0) : '-';
        const avg = d.timeMs.length > 0 ? Math.round(d.timeMs.reduce((a, b) => a + b, 0) / d.timeMs.length) : 0;
        const fmtTime = avg > 1000 ? `${(avg / 1000).toFixed(1)}s` : `${avg}ms`;
        const health = d.runs === 0 ? chalk.dim('无数据') :
            Number(rate) >= 90 ? chalk.green('● 健康') : chalk.red('● 告警');

        agentTable.push([
            shortNames[n] || n,
            Number(rate) >= 90 ? chalk.green(rate + '%') : chalk.red(rate + '%'),
            fmtTime,
            health,
        ]);
    }
    console.log(agentTable.toString());

    // ===== 最近失败 =====
    const failures = recentRecords
        .filter(r => !r.result || r.result.success === false || r.result.error)
        .slice(0, 5);

    console.log(chalk.bold('\n  🔴 最近失败'));
    if (failures.length === 0) {
        console.log(chalk.green('  ✅ 无失败记录\n'));
    } else {
        for (const f of failures) {
            const time = new Date(f.created_at).toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
            });
            const query = (f.query || '').slice(0, 30);
            const err = f.result?.error || f.result?.errorType || '未知错误';
            console.log(`  ${chalk.red('✗')} ${chalk.dim(time)} ${query} ${chalk.red('→ ' + err)}`);
        }
        console.log('');
    }

    console.log(chalk.dim(`  更新时间: ${now.toLocaleString('zh-CN')}  |  输入 d 刷新\n`));
}
