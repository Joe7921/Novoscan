import { test, expect } from '@playwright/test';

/**
 * API 冒烟测试
 *
 * 验证 API 端点的可达性。
 * - /api/health 需要 CRON_SECRET 认证，无密钥时返回 401 或 500
 * - /api/health/db 需要 Admin 鉴权，无权限时返回 401 或有意义的错误
 *
 * 设计原则：在无外部数据库的情况下也能运行。
 */
test.describe('API 冒烟测试', () => {
  test('GET /api/health — 端点可达', async ({ request }) => {
    const response = await request.get('/api/health');
    // 无 CRON_SECRET 时返回 401；无 API Key 时返回 500
    // 只要端点响应即表示路由正常
    expect([200, 401, 500, 503]).toContain(response.status());
    // 响应体应为 JSON
    const body = await response.json();
    expect(body).toBeDefined();
  });

  test('GET /api/health/db — 端点可达', async ({ request }) => {
    const response = await request.get('/api/health/db');
    // 无 Admin 鉴权时返回 401 或 403；无数据库时返回 500
    expect([200, 401, 403, 500]).toContain(response.status());
    // 响应体应为 JSON
    const body = await response.json();
    expect(body).toBeDefined();
  });
});
