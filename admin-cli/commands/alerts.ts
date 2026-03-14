/**
 * alerts — 预警配置与状态
 *
 * 用法：
 *   alerts                                  查看当前预警状态
 *   alerts set error-rate 10                设置错误率阈值 10%
 *   alerts set daily-cost 5                 设置日费用阈值 $5
 *   alerts set agent-timeout 30             设置 Agent 超时率阈值 30%
 *
 * 别名: al, alert
 *
 * 注：预警阈值存储在本地 .alerts.json 文件中。
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../lib/supabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALERTS_FILE = resolve(__dirname, '../.alerts.json');

interface AlertConfig {
    errorRate: number;        // API 错误率阈值（%）
    dailyCost: number;        // 日费用阈值（USD）
    agentTimeout: number;     // Agent 超时率阈值（%）
    minDailyQueries: number;  // 最低日发单量预警
}

const DEFAULT_ALERTS: AlertConfig = {
    errorRate: 10,
    dailyCost: 5,
    agentTimeout: 25,
    minDailyQueries: 0,
};

function loadConfig(): AlertConfig {
    try {
        return { ...DEFAULT_ALERTS, ...JSON.parse(readFileSync(ALERTS_FILE, 'utf-8')) };
    } catch {
        return { ...DEFAULT_ALERTS };
    }
}

function saveConfig(config: AlertConfig) {
    writeFileSync(ALERTS_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// 模型费率
const PRICING: Record<string, number> = {
    deepseek: 0.0042, gemini: 0.00625, 'deepseek-r1': 0.02, minimax: 0.002,
};

export default async function alerts(args: string[]) {
    const config = loadConfig();

    // 设置模式
    if (args[0] === 'set' && args[1] && args[2]) {
        const metric = args[1];
        const value = parseFloat(args[2]);
        if (isNaN(value)) { console.error(chalk.red('\n  ❌ 无效的数值\n')); return; }

        const keyMap: Record<string, keyof AlertConfig> = {
            'error-rate': 'errorRate',
            'daily-cost': 'dailyCost',
            'agent-timeout': 'agentTimeout',
            'min-queries': 'minDailyQueries',
        };

        const key = keyMap[metric];
        if (!key) {
            console.error(chalk.red(`\n  ❌ 未知指标: ${metric}`));
            console.log(chalk.dim('  可用指标: error-rate, daily-cost, agent-timeout, min-queries\n'));
            return;
        }

        config[key] = value;
        saveConfig(config);
        console.log(chalk.green(`\n  ✅ 已设置 ${metric} = ${value}\n`));
        return;
    }

    // 查看模式：检查当前状态
    console.log(chalk.bold('\n  🔔 预警状态检查\n'));

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000);

    const [apiCallsRes, todayQueriesRes, recentRecordsRes] = await Promise.all([
        supabase.from('api_call_logs').select('*')
            .gte('called_at', todayStart.toISOString()).limit(10000),
        supabase.from('search_history').select('*', { count: 'exact', head: true })
            .gte('created_at', todayStart.toISOString()),
        supabase.from('search_history').select('result')
            .order('created_at', { ascending: false }).limit(100),
    ]);

    const apiCalls = apiCallsRes.data || [];
    const todayQueries = todayQueriesRes.count || 0;

    // 计算指标
    const failedCalls = apiCalls.filter(c => !c.is_success).length;
    const currentErrorRate = apiCalls.length > 0 ? (failedCalls / apiCalls.length * 100) : 0;

    let dailyCost = 0;
    for (const c of apiCalls) {
        const rate = PRICING[c.provider] || 0.002;
        dailyCost += ((c.estimated_tokens || 0) / 1000) * rate;
    }

    // Agent 超时率
    let agentRuns = 0, agentTimeouts = 0;
    for (const r of (recentRecordsRes.data || [])) {
        const agents = r.result?.executionRecord?.agents;
        if (!agents) continue;
        for (const a of Object.values(agents) as any[]) {
            agentRuns++;
            if (a.status === 'timeout') agentTimeouts++;
        }
    }
    const agentTimeoutRate = agentRuns > 0 ? (agentTimeouts / agentRuns * 100) : 0;

    // 输出表格
    const table = new Table({
        head: ['指标', '当前值', '阈值', '状态'].map(h => chalk.cyan(h)),
    });

    const check = (current: number, threshold: number, unit: string, higher: boolean = true) => {
        const triggered = higher ? current >= threshold : current <= threshold;
        return {
            value: current.toFixed(1) + unit,
            threshold: threshold + unit,
            status: triggered ? chalk.red.bold('⚠️  告警') : chalk.green('✅ 正常'),
        };
    };

    const errCheck = check(currentErrorRate, config.errorRate, '%');
    const costCheck = check(dailyCost, config.dailyCost, ' USD');
    const timeoutCheck = check(agentTimeoutRate, config.agentTimeout, '%');

    table.push(
        ['API 错误率', errCheck.value, errCheck.threshold, errCheck.status],
        ['今日费用', '$' + dailyCost.toFixed(4), '$' + config.dailyCost, costCheck.status],
        ['Agent 超时率', timeoutCheck.value, timeoutCheck.threshold, timeoutCheck.status],
        ['今日发单量', todayQueries.toString(), config.minDailyQueries > 0 ? '≥' + config.minDailyQueries : chalk.dim('未设置'), todayQueries >= config.minDailyQueries ? chalk.green('✅ 正常') : chalk.yellow('⚡ 偏低')],
    );

    console.log(table.toString());

    // 修改阈值提示
    console.log(chalk.dim('\n  修改阈值: alerts set <error-rate|daily-cost|agent-timeout|min-queries> <value>'));
    console.log(chalk.dim('  配置文件: admin-cli/.alerts.json\n'));
}
