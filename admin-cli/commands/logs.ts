/**
 * logs — 分页查看执行日志
 *
 * 用法：
 *   npx tsx admin-cli/index.ts logs                  # 默认最近 15 条
 *   npx tsx admin-cli/index.ts logs --limit 30       # 指定条数
 *   npx tsx admin-cli/index.ts logs --page 2         # 翻页
 *   npx tsx admin-cli/index.ts logs --failures       # 仅显示 API 失败记录
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { supabase } from '../lib/supabase.js';

function parseArgs(args: string[]): { limit: number; page: number; failuresOnly: boolean } {
    let limit = 15, page = 1, failuresOnly = false;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--limit' && args[i + 1]) limit = parseInt(args[i + 1]) || 15;
        if (args[i] === '--page' && args[i + 1]) page = parseInt(args[i + 1]) || 1;
        if (args[i] === '--failures') failuresOnly = true;
    }
    return { limit, page, failuresOnly };
}

export default async function logs(args: string[]) {
    const { limit, page, failuresOnly } = parseArgs(args);

    // --failures 模式：直接从 api_call_logs 展示失败记录
    if (failuresOnly) {
        return showApiFailures(limit);
    }

    const offset = (page - 1) * limit;

    console.log(chalk.bold(`\n  📋 执行日志 (第 ${page} 页, 每页 ${limit} 条)\n`));

    // 总条数
    const { count } = await supabase.from('search_history')
        .select('*', { count: 'exact', head: true });
    const totalPages = Math.ceil((count || 0) / limit);

    // 分页数据
    const { data, error } = await supabase.from('search_history')
        .select('id, query, model_provider, search_time_ms, created_at, result')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error(chalk.red(`  ❌ 查询失败: ${error.message}`));
        return;
    }

    if (!data || data.length === 0) {
        console.log(chalk.dim('  暂无执行记录'));
        return;
    }

    const table = new Table({
        head: ['ID', '查询内容', 'Provider', '耗时', '状态', '时间'].map(h => chalk.cyan(h)),
        colWidths: [8, 36, 14, 10, 10, 18],
        wordWrap: true,
    });

    for (const row of data) {
        const timeMs = row.search_time_ms || 0;
        const timeStr = timeMs > 1000 ? `${(timeMs / 1000).toFixed(1)}s` : `${timeMs}ms`;

        // 状态判断：优先检查失败
        const hasError = row.result?.error || row.result?.errorMessage;
        const isPartial = row.result?.isPartial;
        const isMulti = row.result?.executionRecord?.agents;
        const noResult = !row.result || Object.keys(row.result).length === 0;

        let status: string;
        if (hasError || noResult) {
            status = chalk.red('FAILED');
        } else if (!isMulti) {
            status = chalk.dim('LEGACY');
        } else if (isPartial) {
            status = chalk.yellow('PARTIAL');
        } else {
            status = chalk.green('COMPLETE');
        }

        const query = (row.query || '').slice(0, 32) + ((row.query || '').length > 32 ? '…' : '');
        const time = new Date(row.created_at).toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });

        table.push([
            row.id,
            query,
            row.model_provider || '-',
            timeMs > 30000 ? chalk.red(timeStr) : timeStr,
            status,
            time,
        ]);
    }

    console.log(table.toString());
    console.log(chalk.dim(`\n  第 ${page}/${totalPages} 页 · 共 ${count} 条记录`));
    console.log(chalk.dim(`  查看失败详情: npx tsx admin-cli/index.ts logs --failures`));
    if (page < totalPages) {
        console.log(chalk.dim(`  下一页: npx tsx admin-cli/index.ts logs --page ${page + 1}\n`));
    } else {
        console.log('');
    }
}

/**
 * 展示 api_call_logs 中的失败记录
 * 覆盖那些还没写入 search_history 就崩掉的场景
 */
async function showApiFailures(limit: number) {
    console.log(chalk.bold(`\n  🔴 API 失败记录 (最近 ${limit} 条)\n`));

    const { data, error } = await supabase.from('api_call_logs')
        .select('*')
        .eq('is_success', false)
        .order('called_at', { ascending: false })
        .limit(limit);

    if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
            console.log(chalk.yellow('  ⚠️  api_call_logs 表尚未创建，暂无失败日志。'));
            console.log(chalk.dim('  提示：此表在首次 API 调用时由 apiMonitor 自动写入。\n'));
        } else {
            console.error(chalk.red(`  ❌ 查询失败: ${error.message}`));
        }
        return;
    }

    if (!data || data.length === 0) {
        console.log(chalk.green('  ✅ 暂无失败记录，一切正常！\n'));
        return;
    }

    const table = new Table({
        head: ['Provider', '调用类型', '耗时', '错误信息', '时间'].map(h => chalk.cyan(h)),
        colWidths: [14, 14, 10, 36, 18],
        wordWrap: true,
    });

    for (const row of data) {
        const timeMs = row.response_time_ms || 0;
        const timeStr = timeMs > 1000 ? `${(timeMs / 1000).toFixed(1)}s` : `${timeMs}ms`;
        const errMsg = (row.error_message || '未知错误').slice(0, 60);
        const time = row.called_at ? new Date(row.called_at).toLocaleString('zh-CN', {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
        }) : '-';

        table.push([
            row.provider || '-',
            row.call_type || '-',
            chalk.red(timeStr),
            chalk.red(errMsg),
            time,
        ]);
    }

    console.log(table.toString());
    console.log('');
}
