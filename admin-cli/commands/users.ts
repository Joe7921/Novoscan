/**
 * users — 用户管理
 *
 * 用法：
 *   npx tsx admin-cli/index.ts users list                    # 列出有 feature_access 的用户
 *   npx tsx admin-cli/index.ts users grant-admin <user-id>   # 授予 admin 权限
 *   npx tsx admin-cli/index.ts users revoke-admin <user-id>  # 吊销 admin 权限
 */

import chalk from 'chalk';
import Table from 'cli-table3';
import { supabase } from '../lib/supabase.js';

export default async function users(args: string[]) {
    const subcommand = args[0] || 'list';

    switch (subcommand) {
        case 'list':
            return listUsers();
        case 'grant-admin':
            return grantAdmin(args[1]);
        case 'revoke-admin':
            return revokeAdmin(args[1]);
        default:
            console.log(chalk.dim('\n  用法:'));
            console.log(chalk.dim('    users list                    列出有权限的用户'));
            console.log(chalk.dim('    users grant-admin <user-id>   授予 admin'));
            console.log(chalk.dim('    users revoke-admin <user-id>  吊销 admin\n'));
    }
}

async function listUsers() {
    console.log(chalk.bold('\n  👥 用户权限列表\n'));

    const { data, error } = await supabase.from('feature_access')
        .select('user_id, feature_name, granted_at, granted_by, is_active')
        .order('granted_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error(chalk.red(`  ❌ 查询失败: ${error.message}`));
        return;
    }

    if (!data || data.length === 0) {
        console.log(chalk.dim('  暂无权限记录'));
        return;
    }

    const table = new Table({
        head: ['User ID', '功能', '状态', '授权时间', '授权者'].map(h => chalk.cyan(h)),
        colWidths: [40, 16, 10, 22, 40],
    });

    for (const row of data) {
        table.push([
            row.user_id,
            row.feature_name,
            row.is_active ? chalk.green('活跃') : chalk.red('停用'),
            row.granted_at ? new Date(row.granted_at).toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
            }) : '-',
            row.granted_by || chalk.dim('系统'),
        ]);
    }

    console.log(table.toString());
    console.log('');
}

async function grantAdmin(userId?: string) {
    if (!userId) {
        console.error(chalk.red('\n  ❌ 请提供 user-id\n'));
        return;
    }

    console.log(chalk.bold(`\n  🔑 授予 admin 权限: ${userId}\n`));

    const { error } = await supabase.from('feature_access').upsert({
        user_id: userId,
        feature_name: 'admin',
        is_active: true,
        granted_at: new Date().toISOString(),
        granted_by: 'admin-cli',
    }, { onConflict: 'user_id,feature_name' });

    if (error) {
        console.error(chalk.red(`  ❌ 操作失败: ${error.message}`));
    } else {
        console.log(chalk.green(`  ✅ 已授予 ${userId} admin 权限`));
    }
    console.log('');
}

async function revokeAdmin(userId?: string) {
    if (!userId) {
        console.error(chalk.red('\n  ❌ 请提供 user-id\n'));
        return;
    }

    console.log(chalk.bold(`\n  🚫 吊销 admin 权限: ${userId}\n`));

    const { error } = await supabase.from('feature_access')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('feature_name', 'admin');

    if (error) {
        console.error(chalk.red(`  ❌ 操作失败: ${error.message}`));
    } else {
        console.log(chalk.green(`  ✅ 已吊销 ${userId} 的 admin 权限`));
    }
    console.log('');
}
