/**
 * agents — Agent SRE 性能水位
 *
 * 展示各个多智能体的完成率、超时率、AVG/P90 耗时和平均评分。
 * 迁移自原 /api/admin/stats 中的 Agent 统计部分。
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { supabase } from '../lib/supabase.js';

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

export default async function agents(_args: string[]) {
    console.log(chalk.bold('\n  🤖 Agent SRE 性能水位\n'));

    const { data, error } = await supabase.from('search_history')
        .select('result')
        .order('created_at', { ascending: false })
        .limit(300);

    if (error) {
        console.error(chalk.red(`  ❌ 查询失败: ${error.message}`));
        return;
    }

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

    const table = new Table({
        head: ['Agent', '运行次数', '完成率', '超时率', 'AVG', 'P90', '平均评分'].map(h => chalk.cyan(h)),
    });

    for (const name of AGENT_NAMES) {
        const s = agentStats[name];
        const displayName = DISPLAY_NAMES[name] || name;
        const completedRate = s.totalRuns > 0 ? ((s.completed / s.totalRuns) * 100).toFixed(1) : '0';
        const timeoutRate = s.totalRuns > 0 ? ((s.timedOut / s.totalRuns) * 100).toFixed(1) : '0';
        const avgMs = s.timeMsArray.length > 0
            ? Math.round(s.timeMsArray.reduce((a, b) => a + b, 0) / s.timeMsArray.length)
            : 0;
        const p90Ms = Math.round(getPercentile(s.timeMsArray, 0.9));
        const avgScore = s.scoreCount > 0 ? (s.totalScore / s.scoreCount).toFixed(1) : '-';

        const fmtTime = (ms: number) => ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
        const colorRate = (rate: string, threshold: number) =>
            Number(rate) >= threshold ? chalk.green(rate + '%') : chalk.red(rate + '%');

        table.push([
            displayName,
            s.totalRuns,
            colorRate(completedRate, 90),
            Number(timeoutRate) > 20 ? chalk.red(timeoutRate + '%') : chalk.dim(timeoutRate + '%'),
            fmtTime(avgMs),
            chalk.blue(fmtTime(p90Ms)),
            chalk.magenta(String(avgScore)),
        ]);
    }

    console.log(table.toString());
    console.log(chalk.dim(`\n  基于最近 300 条执行记录 · P90 = 90% 的请求在该时限内完成\n`));
}
