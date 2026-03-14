/**
 * costs — FinOps 费用监控
 *
 * 用法：
 *   costs                          费用总览（默认 7 天）
 *   costs --days 30                指定时间范围
 *   costs daily                    按日费用曲线
 *   costs daily --days 14          按日费用曲线（14 天）
 *   costs rates                    查看当前费率配置
 *   costs set-rate <provider> <input> [output]   自定义费率（每百万 Token，美元）
 *
 * 别名: c, cost
 *
 * 费率持久化：
 *   自定义费率保存在 admin-cli/.finops.json
 *   也可通过环境变量 FINOPS_PRICING 配置
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../lib/supabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FINOPS_FILE = resolve(__dirname, '../.finops.json');

// ==================== 费率管理 ====================

interface ModelPricing {
    name: string;
    inputPerMillion: number;
    outputPerMillion: number;
    label?: string;
}

const DEFAULT_PRICING: ModelPricing[] = [
    { name: 'deepseek', inputPerMillion: 1.40, outputPerMillion: 2.80, label: 'DeepSeek V3' },
    { name: 'deepseek-r1', inputPerMillion: 4.00, outputPerMillion: 16.00, label: 'DeepSeek R1' },
    { name: 'minimax', inputPerMillion: 1.00, outputPerMillion: 1.00, label: 'MiniMax' },
    { name: 'moonshot', inputPerMillion: 2.00, outputPerMillion: 2.00, label: 'Moonshot (Kimi)' },
    { name: 'gemini', inputPerMillion: 1.25, outputPerMillion: 5.00, label: 'Gemini' },
];

function loadPricing(): ModelPricing[] {
    try {
        const content = readFileSync(FINOPS_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* 文件不存在或解析失败 */ }
    return [...DEFAULT_PRICING];
}

function savePricing(pricing: ModelPricing[]) {
    writeFileSync(FINOPS_FILE, JSON.stringify(pricing, null, 2), 'utf-8');
}

function getRate(pricing: ModelPricing[], provider: string): ModelPricing {
    return pricing.find(p => p.name === provider) || { name: provider, inputPerMillion: 2.00, outputPerMillion: 2.00 };
}

// ==================== 参数解析 ====================

function parseArgs(args: string[]): { subcommand: string; days: number; extra: string[] } {
    let subcommand = 'overview';
    let days = 7;
    const extra: string[] = [];

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--days' && args[i + 1]) {
            days = parseInt(args[i + 1]) || 7;
            i++;
        } else if (args[i] === 'daily') {
            subcommand = 'daily';
        } else if (args[i] === 'rates') {
            subcommand = 'rates';
        } else if (args[i] === 'set-rate') {
            subcommand = 'set-rate';
        } else {
            extra.push(args[i]);
        }
    }

    return { subcommand, days, extra };
}

// ==================== 子命令实现 ====================

async function showOverview(days: number) {
    console.log(chalk.bold(`\n  💰 FinOps 费用总览 (最近 ${days} 天)\n`));

    const pricing = loadPricing();
    const since = new Date(Date.now() - days * 86400000);

    const { data, error } = await supabase.from('api_call_logs')
        .select('provider, estimated_tokens, is_success, called_at')
        .gte('called_at', since.toISOString())
        .limit(50000);

    if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
            console.log(chalk.yellow('  ⚠️  api_call_logs 表尚未创建'));
            return;
        }
        console.error(chalk.red(`  ❌ 查询失败: ${error.message}`));
        return;
    }

    const records = data || [];
    if (records.length === 0) {
        console.log(chalk.dim('  暂无 API 调用记录'));
        return;
    }

    // 按 provider 分组
    const providerMap: Record<string, { calls: number; success: number; tokens: number }> = {};
    for (const r of records) {
        const p = r.provider || 'unknown';
        if (!providerMap[p]) providerMap[p] = { calls: 0, success: 0, tokens: 0 };
        providerMap[p].calls++;
        if (r.is_success) providerMap[p].success++;
        providerMap[p].tokens += r.estimated_tokens || 0;
    }

    // 输出表格
    const table = new Table({
        head: ['Provider', '调用次数', '成功率', 'Token 用量', '费率($/M)', '预估费用'].map(h => chalk.cyan(h)),
    });

    let totalTokens = 0, totalCost = 0;
    const entries = Object.entries(providerMap).sort((a, b) => b[1].tokens - a[1].tokens);

    for (const [provider, stats] of entries) {
        const rate = getRate(pricing, provider);
        const avgRate = (rate.inputPerMillion + rate.outputPerMillion) / 2;
        const cost = (stats.tokens / 1_000_000) * avgRate;

        totalTokens += stats.tokens;
        totalCost += cost;

        const successRate = stats.calls > 0 ? ((stats.success / stats.calls) * 100).toFixed(0) : '0';

        table.push([
            chalk.bold(rate.label || provider),
            stats.calls.toLocaleString(),
            Number(successRate) >= 95 ? chalk.green(successRate + '%') : chalk.red(successRate + '%'),
            (stats.tokens / 1000).toFixed(1) + 'K',
            chalk.dim(`$${avgRate.toFixed(2)}`),
            chalk.yellow('$' + cost.toFixed(4)),
        ]);
    }

    table.push([
        chalk.bold('合计'),
        chalk.bold(records.length.toLocaleString()),
        '',
        chalk.bold((totalTokens / 1000).toFixed(1) + 'K'),
        '',
        chalk.bold.yellow('$' + totalCost.toFixed(4)),
    ]);

    console.log(table.toString());
    console.log(chalk.dim(`\n  费率来源: ${FINOPS_FILE}`));
    console.log(chalk.dim(`  修改费率: costs set-rate <provider> <input> [output]`));
    console.log(chalk.dim(`  查看费率: costs rates\n`));
}

async function showDaily(days: number) {
    console.log(chalk.bold(`\n  📈 按日费用曲线 (最近 ${days} 天)\n`));

    const pricing = loadPricing();
    const since = new Date(Date.now() - days * 86400000);

    const { data, error } = await supabase.from('api_call_logs')
        .select('provider, estimated_tokens, called_at')
        .gte('called_at', since.toISOString())
        .order('called_at', { ascending: true })
        .limit(50000);

    if (error) {
        console.error(chalk.red(`  ❌ 查询失败: ${error.message}`));
        return;
    }

    if (!data || data.length === 0) {
        console.log(chalk.dim('  暂无数据'));
        return;
    }

    // 按日分组
    const dayMap: Record<string, { tokens: number; cost: number; calls: number }> = {};
    for (const r of data) {
        if (!r.called_at) continue;
        const date = r.called_at.slice(0, 10);
        if (!dayMap[date]) dayMap[date] = { tokens: 0, cost: 0, calls: 0 };

        const tokens = r.estimated_tokens || 0;
        const rate = getRate(pricing, r.provider || 'unknown');
        const avgRate = (rate.inputPerMillion + rate.outputPerMillion) / 2;

        dayMap[date].tokens += tokens;
        dayMap[date].cost += (tokens / 1_000_000) * avgRate;
        dayMap[date].calls++;
    }

    const table = new Table({
        head: ['日期', '调用次数', 'Token 用量', '预估费用', '趋势'].map(h => chalk.cyan(h)),
    });

    const sortedDays = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0]));
    const maxCost = Math.max(...sortedDays.map(([, d]) => d.cost));

    for (const [date, stats] of sortedDays) {
        const barLen = maxCost > 0 ? Math.round((stats.cost / maxCost) * 20) : 0;
        const bar = '█'.repeat(barLen);

        table.push([
            date,
            stats.calls.toLocaleString(),
            (stats.tokens / 1000).toFixed(1) + 'K',
            chalk.yellow('$' + stats.cost.toFixed(4)),
            chalk.blue(bar),
        ]);
    }

    console.log(table.toString());
    console.log('');
}

function showRates() {
    console.log(chalk.bold('\n  📋 当前费率配置\n'));

    const pricing = loadPricing();
    const table = new Table({
        head: ['Provider', '标签', '输入 ($/M)', '输出 ($/M)', '平均 ($/M)'].map(h => chalk.cyan(h)),
    });

    for (const m of pricing) {
        table.push([
            m.name,
            m.label || m.name,
            chalk.green('$' + m.inputPerMillion.toFixed(2)),
            chalk.yellow('$' + m.outputPerMillion.toFixed(2)),
            chalk.bold('$' + ((m.inputPerMillion + m.outputPerMillion) / 2).toFixed(2)),
        ]);
    }

    console.log(table.toString());
    console.log(chalk.dim(`\n  配置文件: ${FINOPS_FILE}`));
    console.log(chalk.dim(`  修改费率: costs set-rate <provider> <input> [output]\n`));
}

function setRate(extra: string[]) {
    const provider = extra[0];
    const input = extra[1] ? parseFloat(extra[1]) : NaN;
    const output = extra[2] ? parseFloat(extra[2]) : input; // 不指定 output 时与 input 相同

    if (!provider || isNaN(input)) {
        console.log(chalk.dim('\n  用法: costs set-rate <provider> <input $/M> [output $/M]'));
        console.log(chalk.dim('  示例: costs set-rate deepseek 1.40 2.80'));
        console.log(chalk.dim('  示例: costs set-rate minimax 1.00\n'));
        return;
    }

    const pricing = loadPricing();
    const existing = pricing.find(p => p.name === provider);
    if (existing) {
        existing.inputPerMillion = input;
        existing.outputPerMillion = output;
    } else {
        pricing.push({ name: provider, inputPerMillion: input, outputPerMillion: output });
    }

    savePricing(pricing);
    console.log(chalk.green(`\n  ✅ 已设置 ${provider} 费率: 输入 $${input.toFixed(2)}/M, 输出 $${output.toFixed(2)}/M\n`));
}

// ==================== 入口 ====================

export default async function costs(args: string[]) {
    const { subcommand, days, extra } = parseArgs(args);

    switch (subcommand) {
        case 'overview':
            return showOverview(days);
        case 'daily':
            return showDaily(days);
        case 'rates':
            return showRates();
        case 'set-rate':
            return setRate(extra);
        default:
            return showOverview(days);
    }
}
