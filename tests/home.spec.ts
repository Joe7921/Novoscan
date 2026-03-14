import { test, expect } from '@playwright/test';

/**
 * 首页冒烟测试
 *
 * 验证首页核心元素的存在性和基本交互能力。
 * 不依赖外部数据库。
 */
test.describe('首页', () => {
  test('页面正常加载，标题包含 Novoscan', async ({ page }) => {
    await page.goto('/');
    // SSR 渲染的 <h1> 在 sr-only 区域，通过 textContent 验证
    const h1 = page.locator('h1');
    await expect(h1.first()).toContainText('Novoscan');
  });

  test('搜索框存在且可输入', async ({ page }) => {
    await page.goto('/');
    // 搜索框可能是 textarea 或 input
    const searchInput = page.locator('textarea, input[type="text"]').first();
    await expect(searchInput).toBeVisible({ timeout: 15_000 });
    await searchInput.fill('测试输入');
    await expect(searchInput).toHaveValue('测试输入');
  });

  test('"开始分析" 或 "检查创新性" 按钮存在', async ({ page }) => {
    await page.goto('/');
    // 按钮文本可能是"开始分析"、"检查创新性"等
    const button = page.locator('button').filter({
      hasText: /开始分析|检查创新性|开始|分析/,
    });
    await expect(button.first()).toBeVisible({ timeout: 15_000 });
  });

  test('页面无未捕获异常', async ({ page }) => {
    const pageErrors: string[] = [];
    // 监听页面崩溃级错误（未捕获异常 / 未处理的 Promise rejection）
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });
    await page.goto('/');
    // 等待页面完成加载
    await page.waitForLoadState('networkidle');
    // 过滤掉开发模式下的已知预期异常：
    // - React hydration 错误（无数据库环境下服务端/客户端渲染不一致）
    // - Suspense boundary 切换（Next.js 开发模式正常行为）
    const realErrors = pageErrors.filter(
      (e) =>
        !e.includes('Hydration') &&
        !e.includes('hydrat') &&
        !e.includes('Suspense') &&
        !e.includes('initial UI does not match')
    );
    expect(realErrors).toHaveLength(0);
  });
});
