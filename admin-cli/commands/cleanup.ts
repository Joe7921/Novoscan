/**
 * cleanup — 清理过期数据
 *
 * 用法：
 *   npx tsx admin-cli/index.ts cleanup --older-than 90   # 清理 90 天前的数据
 *   npx tsx admin-cli/index.ts cleanup --dry-run          # 仅预览，不实际删除
 */

import chalk from 'chalk';
import { supabase } from '../lib/supabase.js';

function parseArgs(args: string[]): { olderThanDays: number; dryRun: boolean } {
    let olderThanDays = 90;
    let dryRun = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--older-than' && args[i + 1]) olderThanDays = parseInt(args[i + 1]) || 90;
        if (args[i] === '--dry-run') dryRun = true;
    }

    return { olderThanDays, dryRun };
}

export default async function cleanup(args: string[]) {
    const { olderThanDays, dryRun } = parseArgs(args);
    const cutoff = new Date(Date.now() - olderThanDays * 86400000);
    const cutoffStr = cutoff.toISOString();

    console.log(chalk.bold(`\n  🧹 数据清理 (${olderThanDays} 天前${dryRun ? ' · 预览模式' : ''})\n`));
    console.log(chalk.dim(`  截止时间: ${cutoff.toLocaleString('zh-CN')}\n`));

    // 需要清理的表和时间字段
    const tables = [
        { name: 'api_call_logs', timeCol: 'called_at', label: 'API 调用日志' },
        { name: 'search_history', timeCol: 'created_at', label: '搜索历史' },
    ];

    for (const { name, timeCol, label } of tables) {
        // 统计待清理行数
        const { count, error: countErr } = await supabase.from(name)
            .select('*', { count: 'exact', head: true })
            .lt(timeCol, cutoffStr);

        if (countErr) {
            console.log(`  ${label}: ${chalk.red('查询失败')} — ${countErr.message}`);
            continue;
        }

        const rowCount = count || 0;

        if (rowCount === 0) {
            console.log(`  ${label}: ${chalk.dim('无需清理')}`);
            continue;
        }

        if (dryRun) {
            console.log(`  ${label}: ${chalk.yellow(rowCount.toLocaleString())} 条待清理`);
        } else {
            const { error: delErr } = await supabase.from(name)
                .delete()
                .lt(timeCol, cutoffStr);

            if (delErr) {
                console.log(`  ${label}: ${chalk.red('删除失败')} — ${delErr.message}`);
            } else {
                console.log(`  ${label}: ${chalk.green('✅ 已清理 ' + rowCount.toLocaleString() + ' 条')}`);
            }
        }
    }

    if (dryRun) {
        console.log(chalk.dim('\n  这是预览模式，未实际删除。移除 --dry-run 参数执行实际清理。'));
    }
    console.log('');
}
