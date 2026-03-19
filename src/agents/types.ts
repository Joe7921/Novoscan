/**
 * Agent 类型兼容层 — 原 src/agents/types.ts
 *
 * 所有类型已迁移至 src/types/ 目录的子模块。
 * 本文件仅做 re-export，确保所有 `import { ... } from '@/agents/types'` 继续正常工作。
 */

// Agent 核心类型
export type {
    DualTrackAcademic, AgentInput, AgentOutput,
    DimensionScore, InnovationRadarDimension,
} from '@/types/agent';

// 跨域类型
export type {
    CrossDomainBridge, KnowledgeGraphNode, KnowledgeGraphEdge,
    CrossDomainScoutOutput,
} from '@/types/cross-domain';

// 编排层类型
export type {
    WeightedScoreItem, ArbitrationResult, QualityCheckResult,
    DebateExchange, DebateSession, DissentItem, DebateRecord,
    FinalReport,
} from '@/types/orchestration';
