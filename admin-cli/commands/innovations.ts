/**
 * innovations — 创新趋势数据管理
 *
 * 用法：
 *   npx tsx admin-cli/index.ts innovations                  # 默认热度 Top 20
 *   npx tsx admin-cli/index.ts innovations --top 50         # Top 50
 *   npx tsx admin-cli/index.ts innovations --domain ai      # 按领域筛选
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { supabase } from '../lib/supabase.js';

function parseArgs(args: string[]): { top: number; domain: string | null } {
    let top = 20;
    let domain: string | null = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--top' && args[i + 1]) top = parseInt(args[i + 1]) || 20;
        if (args[i] === '--domain' && args[i + 1]) domain = args[i + 1];
    }

    return { top, domain };
}

export default async function innovations(args: string[]) {
    const { top, domain } = parseArgs(args);

    console.log(chalk.bold(`\n  🔬 创新趋势 (Top ${top}${domain ? ` · 领域: ${domain}` : ''})\n`));

    let query = supabase.from('innovations')
        .select('keyword, search_count, novelty_score, domain_id, last_searched_at')
        .order('search_count', { ascending: false })
        .limit(top);

    if (domain) {
        query = query.eq('domain_id', domain);
    }

    const { data, error } = await query;

    if (error) {
        console.error(chalk.red(`  ❌ 查询失败: ${error.message}`));
        return;
    }

    if (!data || data.length === 0) {
        console.log(chalk.dim('  暂无创新趋势数据'));
        return;
    }

    const table = new Table({
        head: ['#', '关键词', '搜索量', '新颖度', '领域', '最近搜索'].map(h => chalk.cyan(h)),
        colWidths: [5, 36, 10, 10, 12, 18],
        wordWrap: true,
    });

    data.forEach((row, idx) => {
        const novelty = row.novelty_score;
        const noveltyStr = novelty != null ? novelty.toFixed(2) : '-';
        const noveltyColor = novelty >= 0.7 ? chalk.green(noveltyStr) :
            novelty >= 0.4 ? chalk.yellow(noveltyStr) : chalk.red(noveltyStr);

        table.push([
            idx + 1,
            row.keyword || '-',
            row.search_count || 0,
            noveltyColor,
            row.domain_id || '-',
            row.last_searched_at ? new Date(row.last_searched_at).toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
            }) : '-',
        ]);
    });

    console.log(table.toString());

    // 领域分布
    const domainCounts: Record<string, number> = {};
    for (const row of data) {
        const d = row.domain_id || 'unknown';
        domainCounts[d] = (domainCounts[d] || 0) + 1;
    }

    console.log(chalk.bold('\n  🗂️  领域分布'));
    for (const [d, count] of Object.entries(domainCounts).sort((a, b) => b[1] - a[1])) {
        const bar = '█'.repeat(Math.min(count, 30));
        console.log(`  ${d.padEnd(14)} ${chalk.blue(bar)} ${count}`);
    }
    console.log('');
}
