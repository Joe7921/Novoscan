#!/usr/bin/env node
/**
 * Novoscan Admin CLI v2.0 — 本地管理工具
 *
 * 两种使用方式：
 *   1. 直接命令：npm run cli stats
 *   2. 交互模式：npm run cli （进入 REPL，输入短命令即可）
 */

import chalk from 'chalk';
import { createInterface } from 'readline';

// ==================== 命令注册表 ====================

interface CmdInfo {
    description: string;
    module: string;
    aliases: string[];    // 简短别名
    usage?: string;       // 用法示例
}

const COMMANDS: Record<string, CmdInfo> = {
    dashboard:   { description: '一键总览（KPI + Agent + 费用 + 失败）', module: './commands/dashboard.js', aliases: ['d', 'dash'], usage: 'dashboard' },
    stats:       { description: '今日/7日 KPI 总览', module: './commands/stats.js', aliases: ['s'], usage: 'stats' },
    logs:        { description: '分页查看执行日志', module: './commands/logs.js', aliases: ['l'], usage: 'logs [--limit N] [--page N] [--failures]' },
    agents:      { description: 'Agent SRE 性能水位', module: './commands/agents.js', aliases: ['a', 'agent'], usage: 'agents' },
    system:      { description: '系统健康检查', module: './commands/system.js', aliases: ['sys'], usage: 'system' },
    costs:       { description: 'FinOps 费用监控（自定义费率）', module: './commands/costs.js', aliases: ['c', 'cost'], usage: 'costs [--days N] | daily | rates | set-rate <provider> <rate>' },
    users:       { description: '用户管理', module: './commands/users.js', aliases: ['u', 'user'], usage: 'users list | grant-admin <id> | revoke-admin <id>' },
    cleanup:     { description: '清理过期数据', module: './commands/cleanup.js', aliases: ['cl', 'clean'], usage: 'cleanup [--older-than N] [--dry-run]' },
    innovations: { description: '创新趋势管理', module: './commands/innovations.js', aliases: ['i', 'inno'], usage: 'innovations [--top N] [--domain X]' },
    cache:       { description: '缓存管理（查看/清除）', module: './commands/cache.js', aliases: ['ca'], usage: 'cache [clear --older-than N]' },
    alerts:      { description: '预警配置与状态', module: './commands/alerts.js', aliases: ['al', 'alert'], usage: 'alerts [set <metric> <threshold>] [clear]' },
    seed:        { description: '注入/清除测试数据', module: './commands/seed.js', aliases: ['t', 'test'], usage: 'seed [clean]' },
};

// 别名 → 完整命令名映射
const ALIAS_MAP: Record<string, string> = {};
for (const [name, info] of Object.entries(COMMANDS)) {
    for (const alias of info.aliases) {
        ALIAS_MAP[alias] = name;
    }
    ALIAS_MAP[name] = name; // 完整名也映射
}

/** 解析命令名（支持别名） */
function resolveCommand(input: string): string | null {
    return ALIAS_MAP[input.toLowerCase()] || null;
}

// ==================== 帮助信息 ====================

function showBanner() {
    console.log('');
    console.log(chalk.bold.blue('  ╔══════════════════════════════════════╗'));
    console.log(chalk.bold.blue('  ║') + chalk.bold.white('   Novoscan Admin CLI v2.0              ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('  ║') + chalk.dim('   本地管理工具 · 零云端攻击面          ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('  ╚══════════════════════════════════════╝'));
    console.log('');
}

function showHelp() {
    showBanner();
    console.log(chalk.dim('  用法:'));
    console.log(chalk.dim('    npm run cli <command>           直接执行'));
    console.log(chalk.dim('    npm run cli                     进入交互模式'));
    console.log('');
    console.log(chalk.bold('  可用命令:'));
    console.log('');
    for (const [name, info] of Object.entries(COMMANDS)) {
        const aliases = info.aliases.map(a => chalk.yellow(a)).join(', ');
        console.log(`    ${chalk.green(name.padEnd(14))} ${chalk.dim(info.description)}  [${aliases}]`);
    }
    console.log('');
    console.log(chalk.dim('  交互模式快捷键:'));
    console.log(chalk.dim('    输入命令别名即可 (如 d=dashboard, s=stats, l=logs)'));
    console.log(chalk.dim('    help / h = 帮助  |  quit / q / exit = 退出'));
    console.log('');
}

// ==================== 命令执行 ====================

async function runCommand(name: string, args: string[]): Promise<void> {
    const info = COMMANDS[name];
    if (!info) return;

    // --help 拦截
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`\n  ${chalk.bold(name)} — ${info.description}`);
        console.log(`  ${chalk.dim('用法:')} ${info.usage || name}`);
        console.log(`  ${chalk.dim('别名:')} ${info.aliases.join(', ')}\n`);
        return;
    }

    const mod = await import(info.module);
    await mod.default(args);
}

// ==================== 交互式 REPL ====================

async function startRepl() {
    showBanner();
    console.log(chalk.dim('  输入命令开始操作，h 查看帮助，q 退出\n'));

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue('  novo> '),
        completer: (line: string) => {
            const completions = Object.keys(ALIAS_MAP);
            const hits = completions.filter(c => c.startsWith(line.trim().toLowerCase()));
            return [hits.length ? hits : completions, line];
        },
    });

    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();
        if (!input) { rl.prompt(); return; }

        // 退出
        if (['quit', 'q', 'exit', 'bye'].includes(input.toLowerCase())) {
            console.log(chalk.dim('\n  再见 👋\n'));
            rl.close();
            process.exit(0);
        }

        // 帮助
        if (['help', 'h', '?'].includes(input.toLowerCase())) {
            showHelp();
            rl.prompt();
            return;
        }

        // 清屏
        if (['clear', 'cls'].includes(input.toLowerCase())) {
            console.clear();
            rl.prompt();
            return;
        }

        // 解析命令
        const parts = input.split(/\s+/);
        const cmdName = resolveCommand(parts[0]);

        if (!cmdName) {
            console.log(chalk.red(`  未知命令: ${parts[0]}`), chalk.dim('(输入 h 查看帮助)'));
            rl.prompt();
            return;
        }

        try {
            await runCommand(cmdName, parts.slice(1));
        } catch (err: any) {
            console.error(chalk.red(`  ❌ ${err.message}`));
        }

        rl.prompt();
    });

    rl.on('close', () => process.exit(0));
}

// ==================== 入口 ====================

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    // 无参数 → 进入交互模式
    if (!command) {
        return startRepl();
    }

    // help
    if (['help', '--help', '-h'].includes(command)) {
        showHelp();
        return;
    }

    // 解析命令
    const cmdName = resolveCommand(command);
    if (!cmdName) {
        console.error(chalk.red(`\n  ❌ 未知命令: ${command}`));
        console.error(chalk.dim('  运行 npm run cli 进入交互模式\n'));
        process.exit(1);
    }

    try {
        await runCommand(cmdName, args.slice(1));
    } catch (err: any) {
        console.error(chalk.red(`\n  ❌ 命令执行失败: ${err.message}`));
        process.exit(1);
    }
}

main();
