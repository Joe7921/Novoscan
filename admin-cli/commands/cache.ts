/**
 * cache — 缓存管理
 *
 * 用法：
 *   cache                        查看缓存统计
 *   cache clear                  清除 24h 前的缓存
 *   cache clear --older-than 48  清除 48h 前的缓存
 *   cache clear --all            清除所有缓存
 *
 * 别名: ca
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { supabase } from '../lib/supabase.js';

function parseArgs(args: string[]): { action: string; olderThanHours: number; all: boolean } {
    let action = 'view', olderThanHours = 24, all = false;
    if (args[0] === 'clear') action = 'clear';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--older-than' && args[i + 1]) olderThanHours = parseInt(args[i + 1]) || 24;
        if (args[i] === '--all') all = true;
    }
    return { action, olderThanHours, all };
}

export default async function cache(args: string[]) {
    const { action, olderThanHours, all } = parseArgs(args);

    if (action === 'view') {
        console.log(chalk.bold('\n  🗃️  缓存统计\n'));

        // 各时间段的缓存量
        const now = Date.now();
        const brackets = [
            { label: '< 24h (活跃)', since: new Date(now - 24 * 3600000) },
            { label: '1-7 天', since: new Date(now - 7 * 86400000) },
            { label: '7-30 天', since: new Date(now - 30 * 86400000) },
            { label: '> 30 天', since: null },
        ];

        const table = new Table({
            head: ['时间段', '记录数', '说明'].map(h => chalk.cyan(h)),
        });

        // 总量
        const { count: total } = await supabase.from('search_history')
            .select('*', { count: 'exact', head: true });

        const { count: last24h } = await supabase.from('search_history')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', brackets[0].since!.toISOString());

        const { count: last7d } = await supabase.from('search_history')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', brackets[1].since!.toISOString());

        const { count: last30d } = await supabase.from('search_history')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', brackets[2].since!.toISOString());

        const c24 = last24h || 0;
        const c7 = (last7d || 0) - c24;
        const c30 = (last30d || 0) - (last7d || 0);
        const cOld = (total || 0) - (last30d || 0);

        table.push(
            ['< 24h', chalk.green(c24.toString()), '前端可命中缓存'],
            ['1-7 天', chalk.yellow(c7.toString()), '过期但保留统计价值'],
            ['7-30 天', chalk.dim(c30.toString()), '可清理'],
            ['> 30 天', chalk.dim(cOld.toString()), '建议清理'],
            [chalk.bold('总计'), chalk.bold((total || 0).toString()), ''],
        );

        console.log(table.toString());
        console.log(chalk.dim('\n  清除缓存: cache clear [--older-than 小时数] [--all]\n'));

    } else {
        // 清除
        if (all) {
            console.log(chalk.bold.red('\n  🗑️  清除全部缓存\n'));
            const { count } = await supabase.from('search_history')
                .select('*', { count: 'exact', head: true });

            const { error } = await supabase.from('search_history').delete().neq('id', 0);
            if (error) {
                console.error(chalk.red(`  ❌ 清除失败: ${error.message}`));
            } else {
                console.log(chalk.green(`  ✅ 已清除 ${count || 0} 条缓存记录\n`));
            }
        } else {
            const cutoff = new Date(Date.now() - olderThanHours * 3600000);
            console.log(chalk.bold(`\n  🗑️  清除 ${olderThanHours}h 前的缓存\n`));

            const { count } = await supabase.from('search_history')
                .select('*', { count: 'exact', head: true })
                .lt('created_at', cutoff.toISOString());

            const { error } = await supabase.from('search_history')
                .delete()
                .lt('created_at', cutoff.toISOString());

            if (error) {
                console.error(chalk.red(`  ❌ 清除失败: ${error.message}`));
            } else {
                console.log(chalk.green(`  ✅ 已清除 ${count || 0} 条过期缓存\n`));
            }
        }
    }
}
