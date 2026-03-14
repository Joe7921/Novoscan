import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置
 *
 * - 仅使用 Chromium 浏览器（减少 CI 时间）
 * - 自动启动 dev server（npm run dev）
 * - 失败时自动截图
 */
export default defineConfig({
  testDir: './tests',
  /* 全局超时 60 秒 */
  timeout: 60_000,
  /* 单个断言超时 15 秒 */
  expect: {
    timeout: 15_000,
  },
  /* 并行运行测试 */
  fullyParallel: true,
  /* CI 中禁止 .only */
  forbidOnly: !!process.env.CI,
  /* 失败重试次数：CI 中重试 1 次 */
  retries: process.env.CI ? 1 : 0,
  /* CI 中单 worker，本地并行 */
  workers: process.env.CI ? 1 : undefined,
  /* 测试报告 */
  reporter: 'html',

  use: {
    /* 基础 URL */
    baseURL: 'http://localhost:3000',
    /* 失败时自动截图 */
    screenshot: 'only-on-failure',
    /* 收集失败时的 trace */
    trace: 'on-first-retry',
  },

  /* 仅 Chromium */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* 自动启动 dev server */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
