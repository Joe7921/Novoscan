/**
 * system — 系统健康检查
 *
 * 检查环境变量配置、数据库连接状态和各表行数统计。
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { supabase, getEnvAudit } from '../lib/supabase.js';

export default async function system(_args: string[]) {
    console.log(chalk.bold('\n  🏥 系统健康检查\n'));

    // 1. 环境变量审计
    console.log(chalk.bold.underline('  环境变量配置'));
    const envAudit = getEnvAudit();
    const envTable = new Table({
        chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
    });

    const categories: Record<string, string[]> = { database: [], ai: [], search: [] };
    for (const [key, meta] of Object.entries(envAudit)) {
        categories[meta.category]?.push(key);
    }

    for (const [category, keys] of Object.entries(categories)) {
        const catLabel = category === 'database' ? '🗄️  数据库' :
            category === 'ai' ? '🤖 AI 模型' : '🔍 搜索引擎';
        envTable.push([{ content: chalk.bold(catLabel), colSpan: 3 }]);
        for (const key of keys) {
            const meta = envAudit[key];
            envTable.push([
                '  ' + meta.label,
                meta.configured ? chalk.green('✅ 已配置') : chalk.red('❌ 未配置'),
                chalk.dim(key),
            ]);
        }
    }
    console.log(envTable.toString());

    // 2. 数据库连接检查
    console.log(chalk.bold.underline('\n  数据库连接'));
    try {
        const start = Date.now();
        const { error } = await supabase.from('search_history').select('id', { count: 'exact', head: true });
        const latency = Date.now() - start;

        if (error) {
            console.log(`  状态: ${chalk.red('❌ 连接失败')} — ${error.message}`);
        } else {
            console.log(`  状态: ${chalk.green('✅ 连接正常')}  延迟: ${latency}ms`);
        }
    } catch (err: any) {
        console.log(`  状态: ${chalk.red('❌ 异常')} — ${err.message}`);
    }

    // 3. 各表行数统计
    console.log(chalk.bold.underline('\n  表行数统计'));
    const tables = [
        'search_history',
        'api_call_logs',
        'innovations',
        'novomind_assessments',
        'feature_access',
        'tracker_keywords',
        'tracker_alerts',
        'idea_assessments',
        'public_report_shares',
    ];

    const tableStats = new Table({
        head: ['表名', '行数'].map(h => chalk.cyan(h)),
    });

    for (const tableName of tables) {
        try {
            const { count, error } = await supabase.from(tableName)
                .select('*', { count: 'exact', head: true });
            if (error) {
                tableStats.push([tableName, chalk.dim('查询失败')]);
            } else {
                tableStats.push([tableName, (count || 0).toLocaleString()]);
            }
        } catch {
            tableStats.push([tableName, chalk.dim('不存在')]);
        }
    }

    console.log(tableStats.toString());

    // 4. 运行信息
    console.log(chalk.bold.underline('\n  运行环境'));
    console.log(`  Node:     ${process.version}`);
    console.log(`  平台:     ${process.platform}`);
    console.log(`  工作目录:  ${process.cwd()}`);
    console.log('');
}
