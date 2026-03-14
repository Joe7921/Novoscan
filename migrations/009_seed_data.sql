-- ============================================================
-- Novoscan 数据库迁移 v009
-- 种子数据：默认兑换码、测试 MCP Key
-- ⚠️ 使用 ON CONFLICT DO NOTHING 确保幂等，可安全多次执行
-- ============================================================

-- ── 默认兑换码 ──
INSERT INTO redeem_codes (code, points, max_uses, description)
VALUES
    ('WELCOME100', 100, 0, '欢迎码，无限次使用（每用户一次）'),
    ('NOVOSCAN50', 50, 100, '推广码，限100人使用'),
    ('BETA200', 200, 50, '内测用户专享码')
ON CONFLICT (code) DO NOTHING;

-- ── Docker 环境默认 MCP 测试密钥 ──
INSERT INTO mcp_api_keys (api_key, user_email, user_name, plan, daily_limit, is_active, note)
VALUES (
    'nvk_docker_test_key',
    'admin@novoscan.local',
    '管理员（Docker）',
    'admin',
    0,
    true,
    'Docker 自建环境默认密钥'
)
ON CONFLICT (api_key) DO NOTHING;

SELECT '✅ [v009] 种子数据插入完成' AS status;
