import { test, expect } from '@playwright/test';

/**
 * 文档页冒烟测试
 *
 * 验证文档页核心结构的存在性。
 * 不依赖外部数据库。
 */
test.describe('文档页', () => {
  test('页面加载成功', async ({ page }) => {
    const response = await page.goto('/docs');
    expect(response?.status()).toBe(200);
  });

  test('桌面端侧边栏导航存在', async ({ page }) => {
    // 设置桌面视口以确保侧边栏可见（lg 断点 = 1024px）
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/docs');
    // 文档页侧边栏在 <aside> 元素中
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible({ timeout: 15_000 });
    // 侧边栏中有导航链接
    const nav = sidebar.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('至少有一个文档章节可见', async ({ page }) => {
    await page.goto('/docs');
    // 文档页章节使用 "品牌概览"、"什么是 Novoscan" 等标题
    const section = page.locator('text=品牌概览').first();
    await expect(section).toBeVisible({ timeout: 15_000 });
  });
});
