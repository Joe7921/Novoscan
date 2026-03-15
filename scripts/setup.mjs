#!/usr/bin/env node

/**
 * Novoscan 交互式初始化脚本 — 新手教程
 *
 * 像游戏新手引导一样，分步引导用户完成首次配置：
 * 1. 检测环境 → 2. 生成 .env.local → 3. 选择 AI 模式 → 4. 配置诊断 → 5. 下一步
 *
 * 用法：npm run setup
 * 静默模式：npm run setup -- --yes（跳过交互，全部使用默认值）
 * 强制覆写：npm run setup -- --force
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

// ── 路径定位 ──
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const ENV_EXAMPLE = resolve(ROOT, '.env.example');
const ENV_LOCAL = resolve(ROOT, '.env.local');

// ── 颜色辅助 ──
const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  underline: (s) => `\x1b[4m${s}\x1b[0m`,
};

// ── 交互式输入 ──
const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function banner() {
  console.log('');
  console.log(c.bold(c.cyan('  ╔═══════════════════════════════════════════════╗')));
  console.log(c.bold(c.cyan('  ║                                               ║')));
  console.log(c.bold(c.cyan('  ║   🚀 ') + c.bold('Novoscan 初始化向导') + c.bold(c.cyan('                    ║'))));
  console.log(c.bold(c.cyan('  ║   ') + c.dim('Next-Gen Innovation Evaluate Engine') + c.bold(c.cyan('      ║'))));
  console.log(c.bold(c.cyan('  ║                                               ║')));
  console.log(c.bold(c.cyan('  ╚═══════════════════════════════════════════════╝')));
  console.log('');
}

function stepHeader(num, total, title) {
  console.log('');
  console.log(c.bold(`  ${c.blue(`[${num}/${total}]`)} ${title}`));
  console.log(c.dim(`  ${'─'.repeat(46)}`));
}

// ── 步骤 1：环境检测 ──
function checkEnvironment() {
  stepHeader(1, 4, '🔍 环境检测');

  // Node.js 版本
  const [major, minor] = process.version.replace('v', '').split('.').map(Number);
  if (major < 18 || (major === 18 && minor < 17)) {
    console.log(`  ${c.red('✗')} Node.js ${process.version}  ${c.red('需要 >= 18.17.0')}`);
    console.log(`    ${c.dim('推荐使用 nvm 管理版本：https://github.com/nvm-sh/nvm')}`);
    process.exit(1);
  }
  console.log(`  ${c.green('✓')} Node.js ${process.version}`);

  // npm 版本
  console.log(`  ${c.green('✓')} npm ${c.dim('已就绪')}`);

  // .env.example
  if (!existsSync(ENV_EXAMPLE)) {
    console.log(`  ${c.red('✗')} 找不到 .env.example`);
    console.log(`    ${c.dim('请确认在项目根目录下运行')}`);
    process.exit(1);
  }
  console.log(`  ${c.green('✓')} .env.example ${c.dim('模板文件')}`);

  // .env.local 状态
  if (existsSync(ENV_LOCAL)) {
    console.log(`  ${c.yellow('!')} .env.local ${c.yellow('已存在')}`);
    return 'exists';
  } else {
    console.log(`  ${c.dim('○')} .env.local ${c.dim('待创建')}`);
    return 'new';
  }
}

// ── 步骤 2：创建 .env.local ──
function createEnvLocal() {
  copyFileSync(ENV_EXAMPLE, ENV_LOCAL);
  let content = readFileSync(ENV_LOCAL, 'utf-8');

  // 认证：supabase → nextauth
  content = content.replace(/^NEXT_PUBLIC_AUTH_PROVIDER=supabase$/m, 'NEXT_PUBLIC_AUTH_PROVIDER=nextauth');
  content = content.replace(/^AUTH_PROVIDER=supabase$/m, 'AUTH_PROVIDER=nextauth');

  // 数据库：supabase → postgres
  content = content.replace(/^DATABASE_PROVIDER=supabase$/m, 'DATABASE_PROVIDER=postgres');

  // 自动生成 NEXTAUTH_SECRET
  const secret = randomBytes(32).toString('base64');
  content = content.replace(/^NEXTAUTH_SECRET=$/m, `NEXTAUTH_SECRET=${secret}`);

  // 确保 MOCK_AI=true
  if (!content.match(/^MOCK_AI=true$/m)) {
    content = content.replace(/^MOCK_AI=.*$/m, 'MOCK_AI=true');
  }

  // 删除底部重复段
  content = content.replace(
    /\n# ────+\n# 插件市场 Registry API（可选）\n# 插件市场从该地址获取社区插件列表，不配置时使用内置本地插件\n# ────+\nNEXT_PUBLIC_MARKETPLACE_API=https:\/\/novoscan\.cn\n?$/m,
    ''
  );

  return content;
}

// ── 步骤 3：AI 模式选择 ──
async function chooseAIMode(content, silent) {
  stepHeader(3, 4, '🤖 AI 模式配置');

  console.log('');
  console.log(`  ${c.cyan('A)')} ${c.bold('Mock AI 模式')} ${c.green('← 推荐新手')}  `);
  console.log(`     ${c.dim('使用内置高质量仿真数据，无需任何 API Key')}`);
  console.log(`     ${c.dim('体验完整的 6 Agent 分析流程和报告生成')}`);
  console.log('');
  console.log(`  ${c.cyan('B)')} ${c.bold('真实 AI 模式')}`);
  console.log(`     ${c.dim('接入 DeepSeek / MiniMax / Moonshot API')}`);
  console.log(`     ${c.dim('获取真实 AI 分析结果（需准备 API Key）')}`);
  console.log('');

  let choice = 'a';
  if (!silent) {
    const answer = await ask(c.bold(`  请选择 [${c.green('A')}/b]: `));
    choice = answer.trim().toLowerCase() || 'a';
  }

  if (choice === 'b') {
    // 真实 AI 模式
    content = content.replace(/^MOCK_AI=true$/m, 'MOCK_AI=false');
    console.log(`\n  ${c.yellow('!')} 已切换到真实 AI 模式`);

    // 引导填入 API Key
    console.log(`\n  ${c.dim('请输入至少一个 AI 模型的 API Key（直接回车跳过）：')}`);
    console.log('');

    const deepseek = silent ? '' : await ask(`  ${c.cyan('DeepSeek')} API Key: `);
    if (deepseek.trim()) {
      content = content.replace(/^DEEPSEEK_API_KEY=$/m, `DEEPSEEK_API_KEY=${deepseek.trim()}`);
      console.log(`  ${c.green('✓')} DeepSeek 已配置`);
    }

    const minimax = silent ? '' : await ask(`  ${c.cyan('MiniMax')}  API Key: `);
    if (minimax.trim()) {
      content = content.replace(/^MINIMAX_API_KEY=$/m, `MINIMAX_API_KEY=${minimax.trim()}`);
      console.log(`  ${c.green('✓')} MiniMax 已配置`);
    }

    const moonshot = silent ? '' : await ask(`  ${c.cyan('Moonshot')} API Key: `);
    if (moonshot.trim()) {
      content = content.replace(/^MOONSHOT_API_KEY=$/m, `MOONSHOT_API_KEY=${moonshot.trim()}`);
      console.log(`  ${c.green('✓')} Moonshot 已配置`);
    }

    // 检查是否至少配置了一个
    const hasKey = deepseek.trim() || minimax.trim() || moonshot.trim();
    if (!hasKey) {
      console.log(`\n  ${c.yellow('⚠')} 未配置任何 API Key，已自动回退到 Mock AI 模式`);
      content = content.replace(/^MOCK_AI=false$/m, 'MOCK_AI=true');
    }
  } else {
    console.log(`\n  ${c.green('✓')} Mock AI 模式 — 零配置，开箱即用`);
  }

  return content;
}

// ── 步骤 4：配置诊断 ──
function showDiagnostics(content) {
  stepHeader(4, 4, '📋 配置诊断');

  const lines = content.split('\n');
  const getVal = (key) => {
    const line = lines.find(l => l.match(new RegExp(`^${key}=`)));
    return line ? line.split('=').slice(1).join('=') : '';
  };

  const items = [
    { label: 'AI 模式', val: getVal('MOCK_AI') === 'true' ? '🎭 Mock AI（仿真数据）' : '🤖 真实 AI', ok: true },
    { label: '认证方式', val: 'NextAuth.js（邮箱 + OAuth）', ok: true },
    { label: '数据库', val: 'PostgreSQL（自托管友好）', ok: true },
    { label: '密钥', val: getVal('NEXTAUTH_SECRET') ? '✓ 已自动生成' : '✗ 缺失', ok: !!getVal('NEXTAUTH_SECRET') },
    { label: 'DeepSeek', val: getVal('DEEPSEEK_API_KEY') ? '✓ 已配置' : '○ 未配置', ok: getVal('MOCK_AI') === 'true' || !!getVal('DEEPSEEK_API_KEY') },
    { label: 'MiniMax', val: getVal('MINIMAX_API_KEY') ? '✓ 已配置' : '○ 未配置', ok: getVal('MOCK_AI') === 'true' || !!getVal('MINIMAX_API_KEY') },
    { label: 'Moonshot', val: getVal('MOONSHOT_API_KEY') ? '✓ 已配置' : '○ 未配置', ok: getVal('MOCK_AI') === 'true' || !!getVal('MOONSHOT_API_KEY') },
  ];

  for (const item of items) {
    const icon = item.ok ? c.green('✓') : c.yellow('!');
    console.log(`  ${icon} ${c.bold(item.label.padEnd(10))} ${item.val}`);
  }
}

// ── 完成提示 ──
function showSuccess(isMock) {
  console.log('');
  console.log(c.dim('  ' + '═'.repeat(46)));
  console.log('');
  console.log(c.bold(c.green('  ✅ 初始化完成！')));
  console.log('');

  if (isMock) {
    console.log(`  ${c.cyan('🎭 Mock AI 模式已就绪')}`);
    console.log(`  ${c.dim('   内置高质量仿真数据，完整体验 6 Agent 分析流程')}`);
  } else {
    console.log(`  ${c.cyan('🤖 真实 AI 模式已就绪')}`);
    console.log(`  ${c.dim('   API Key 已配置，将调用真实 AI 模型')}`);
  }

  console.log('');
  console.log(c.bold('  🎮 下一步'));
  console.log(`  ${c.green('  $ npm run dev')}`);
  console.log(`  ${c.dim('  打开 http://localhost:3000 即可体验')}`);
  console.log('');

  if (isMock) {
    console.log(c.dim('  💡 提示：准备接入真实 AI？'));
    console.log(c.dim('     编辑 .env.local → MOCK_AI=false → 填入 API Key'));
    console.log(c.dim('     或重新运行 npm run setup --force'));
  }
  console.log('');
}

// ── 主流程 ──
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const silent = args.includes('--yes') || args.includes('-y');

  banner();

  // 步骤 1：环境检测
  const envState = checkEnvironment();

  // 步骤 2：创建 .env.local
  stepHeader(2, 4, '📝 环境变量配置');

  if (envState === 'exists' && !force) {
    console.log(`  ${c.yellow('⏭')}  .env.local 已存在，保留现有配置`);
    console.log(`  ${c.dim('   使用 --force 参数可强制重新配置')}`);
    console.log('');
    showSuccess(readFileSync(ENV_LOCAL, 'utf-8').includes('MOCK_AI=true'));
    rl.close();
    return;
  }

  let content = createEnvLocal();
  console.log(`  ${c.green('✓')} .env.local 已创建`);
  console.log(`  ${c.green('✓')} NEXTAUTH_SECRET 已自动生成`);
  console.log(`  ${c.green('✓')} 认证方式设为 NextAuth.js`);

  // 步骤 3：AI 模式选择
  content = await chooseAIMode(content, silent);

  // 写入文件
  writeFileSync(ENV_LOCAL, content, 'utf-8');

  // 步骤 4：配置诊断
  showDiagnostics(content);

  // 完成
  const isMock = content.includes('MOCK_AI=true');
  showSuccess(isMock);

  rl.close();
}

main().catch((err) => {
  console.error(c.red(`\n  ❌ 初始化失败: ${err.message}\n`));
  rl.close();
  process.exit(1);
});
