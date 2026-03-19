/**
 * Novoscan 类型系统 — 统一导出入口
 *
 * 所有类型从此文件导出，替代原 src/types.ts。
 * 保持完全向后兼容：`import { ... } from '@/types'` 仍然可用。
 *
 * @module types
 */

// === 通用基础类型 ===
export { AppState } from './common';
export type { Language, ModelProvider, ScanMode, ChatMessage } from './common';

// === AI 模型配置 ===
export { MODEL_OPTIONS } from './model';
export type { ModelOption } from './model';

// === 检索数据类型 ===
export type {
  GroundingChunk, SimilarPaper, InternetSource,
  WebResult, GithubRepo, IndustryResult,
  AcademicStats, AcademicPaper,
  Credibility, CrossValidation, DualTrackResult,
} from './search';

// === Agent 核心类型 ===
export type {
  DualTrackAcademic, AgentInput, AgentOutput,
  DimensionScore, InnovationRadarDimension,
} from './agent';

// === 跨域创新迁移类型 ===
export type {
  CrossDomainBridge, KnowledgeGraphNode, KnowledgeGraphEdge,
  CrossDomainScoutOutput,
} from './cross-domain';

// === 编排层类型（仲裁 / 辩论 / 质量 / 最终报告） ===
export type {
  WeightedScoreItem, ArbitrationResult, QualityCheckResult,
  DebateExchange, DebateSession, DissentItem, DebateRecord,
  FinalReport,
} from './orchestration';

// === 报告与 API 结果类型 ===
export type {
  AnalysisReport, MemoryInsight, UserPreferencesData,
  AnalysisAPIResult, ErrorInfo,
} from './report';
