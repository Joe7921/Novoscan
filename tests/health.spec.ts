import { test, expect } from '@playwright/test';

/**
 * 健康检查页冒烟测试
 *
 * 验证 /health 页面的可达性和基本渲染。
 * 注意：此页面为 use client 组件，依赖 /api/health/db 接口。
 * 在无数据库环境下，页面仍可加载但会显示错误/加载状态。
 */
test.describe('健康检查页', () => {
  test('/health 返回 200', async ({ page }) => {
    const response = await page.goto('/health');
    expect(response?.status()).toBe(200);
  });

  test('页面显示系统状态标题', async ({ page }) => {
    await page.goto('/health');
    // 健康检查页标题为"数据库健康状态"
    const title = page.locator('h1');
    await expect(title).toContainText('数据库健康状态', { timeout: 15_000 });
  });
});
