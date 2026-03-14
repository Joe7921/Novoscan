/**
 * Admin 服务层 — 统一导出
 *
 * 所有运维功能的共享业务逻辑入口。
 * API 路由和 CLI 共用此服务层。
 */

// 鉴权
export { verifyAdminAuth } from './auth';

// 服务
export { getKpiStats } from './stats.service';
export type { KpiStats } from './stats.service';

export { getDashboardData } from './dashboard.service';
export type { DashboardResult } from './dashboard.service';

export { getExecutionLogs, getApiFailures } from './logs.service';
export type { ExecutionLogsResult, ApiFailureEntry } from './logs.service';

export { getAgentPerformance } from './agents.service';
export type { AgentPerformanceResult } from './agents.service';

export { getSystemHealth } from './system.service';
export type { SystemHealthResult } from './system.service';

export { listUsers, grantAdmin, revokeAdmin } from './users.service';
export type { UserListResult } from './users.service';

export { getCleanupPreview, executeCleanup } from './cleanup.service';
export type { CleanupPreviewItem, CleanupResult } from './cleanup.service';

export { getInnovationTrends } from './innovations.service';
export type { InnovationTrendsResult } from './innovations.service';

export { getCacheStats, clearCache } from './cache.service';
export type { CacheStatsResult, ClearCacheResult } from './cache.service';

export { getAlertsStatus, getAlertConfig } from './alerts.service';
export type { AlertsStatusResult, AlertConfig } from './alerts.service';

export { getCostsPricing, getCostsOverview, getCostsByDay, getCostsRealtime } from './costs.service';
export type { PricingConfig, CostsOverviewResult, CostsByDayResult } from './costs.service';

export { injectTestData, cleanTestData } from './seed.service';
export type { SeedResult } from './seed.service';
