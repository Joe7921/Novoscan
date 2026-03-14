-- ============================================================
-- Novoscan 数据库迁移 v005
-- NovoTracker 持续监控系统
-- 来源：20260305_novotracker.sql, 20260312_tracker_improvements.sql
-- ============================================================

-- ── 监控任务主表 ──
CREATE TABLE IF NOT EXISTS tracker_monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    query TEXT NOT NULL,
    domain_id TEXT,
    sub_domain_id TEXT,
    frequency TEXT NOT NULL DEFAULT 'weekly'
        CHECK (frequency IN ('daily', 'weekly')),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'expired')),
    last_scan_at TIMESTAMPTZ,
    next_scan_at TIMESTAMPTZ,
    baseline_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    scan_count INT NOT NULL DEFAULT 0,
    last_alerted_competitors JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracker_monitors_user_status ON tracker_monitors (user_id, status);
CREATE INDEX IF NOT EXISTS idx_tracker_monitors_next_scan ON tracker_monitors (status, next_scan_at) WHERE status = 'active';

-- ── 快照记录 ──
CREATE TABLE IF NOT EXISTS tracker_snapshots (
    id BIGSERIAL PRIMARY KEY,
    monitor_id UUID NOT NULL REFERENCES tracker_monitors(id) ON DELETE CASCADE,
    scan_result JSONB NOT NULL DEFAULT '{}'::jsonb,
    novelty_score INT,
    competitor_count INT DEFAULT 0,
    paper_count INT DEFAULT 0,
    key_findings TEXT[] DEFAULT ARRAY[]::TEXT[],
    diff_summary JSONB,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracker_snapshots_monitor ON tracker_snapshots (monitor_id, scanned_at DESC);

-- ── 告警记录 ──
CREATE TABLE IF NOT EXISTS tracker_alerts (
    id BIGSERIAL PRIMARY KEY,
    monitor_id UUID NOT NULL REFERENCES tracker_monitors(id) ON DELETE CASCADE,
    snapshot_id BIGINT REFERENCES tracker_snapshots(id) ON DELETE SET NULL,
    alert_type TEXT NOT NULL
        CHECK (alert_type IN ('new_competitor', 'new_paper', 'score_drop', 'moat_shrink')),
    severity TEXT NOT NULL DEFAULT 'info'
        CHECK (severity IN ('critical', 'warning', 'info')),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    details JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracker_alerts_unread ON tracker_alerts (monitor_id, is_read, created_at DESC);

SELECT '✅ [v005] NovoTracker 持续监控系统创建完成' AS status;
