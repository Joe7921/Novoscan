#!/usr/bin/env node

/**
 * Novoscan Postinstall 提示
 *
 * 在 npm install 完成后打印一条友好提示，
 * 引导用户运行 npm run setup 完成初始化。
 *
 * CI 环境下静默跳过（检测 CI 环境变量）。
 */

// CI 环境检测 — 避免在 CI/CD 中输出冗余信息
const isCI = process.env.CI === 'true' || process.env.CI === '1' ||
  process.env.CONTINUOUS_INTEGRATION === 'true' ||
  process.env.GITHUB_ACTIONS === 'true' ||
  process.env.VERCEL === '1';

if (isCI) process.exit(0);

const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

console.log('');
console.log(bold('  🚀 Novoscan 安装完成！'));
console.log('');
console.log(`  下一步：运行 ${green('npm run setup')} 完成初始化`);
console.log(dim('  自动创建 .env.local，开启 Mock AI 模式，无需 API Key'));
console.log('');
