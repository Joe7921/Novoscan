/**
 * 报告与 API 结果类型
 *
 * @module types/report
 */

import type { AgentOutput, InnovationRadarDimension } from './agent';
import type { ArbitrationResult, QualityCheckResult, DebateRecord, FinalReport } from './orchestration';
import type { CrossDomainScoutOutput } from './cross-domain';
import type {
  SimilarPaper, InternetSource, GroundingChunk, AcademicPaper,
  DualTrackResult, IndustryResult, CrossValidation, Credibility,
} from './search';
import type { ModelProvider } from './common';
import type { InnovationDNAMap } from '@/lib/services/innovation/innovationDNA';

export interface AnalysisReport {
  // === 基础字段（兼容旧版） ===
  rawText?: string;
  academicText?: string;
  internetText?: string;
  noveltyScore?: number;
  internetNoveltyScore?: number;
  practicalScore?: number | null;
  commercialScore?: number;
  noveltyLevel?: 'High' | 'Medium' | 'Low';
  summary?: string;
  marketPotential?: string;
  technicalFeasibility?: string;
  keyInnovations?: string[];
  challenges?: string[];
  futureDirections?: string[];
  suggestions?: string[];
  keyDifferentiators?: string;
  improvementSuggestions?: string;
  groundingChunks?: GroundingChunk[];
  similarPapers?: SimilarPaper[];
  similarWorks?: AcademicPaper[];
  internetSources?: InternetSource[];
  isPartial?: boolean;
  fromCache?: boolean;
  cacheSavedMs?: number | null;
  dualTrackResult?: DualTrackResult;
  sections?: Record<string, unknown>;
  usedModel?: string;

  // === Agent 分析结果 ===
  academicReview?: AgentOutput | null;
  industryAnalysis?: AgentOutput | null;
  innovationEvaluation?: AgentOutput | null;
  competitorAnalysis?: AgentOutput | null;

  // === 仲裁 & 质量 ===
  arbitration?: ArbitrationResult | null;
  qualityCheck?: QualityCheckResult | null;

  // === 高级分析模块 ===
  innovationRadar?: InnovationRadarDimension[] | null;
  debate?: DebateRecord | null;
  innovationDNA?: InnovationDNAMap | null;
  crossDomainTransfer?: CrossDomainScoutOutput | null;
  memoryInsight?: MemoryInsight | null;
}

/** Agent 记忆进化洞察 */
export interface MemoryInsight {
  experiencesUsed: number;
  relevantQueries: string[];
  contextSummary: string;
}

/** 用户偏好数据 */
export interface UserPreferencesData {
  success: boolean;
  profile?: {
    preferredModel?: ModelProvider;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** API 分析结果（apiClient.ts 返回值的完整类型） */
export interface AnalysisAPIResult {
  success: boolean;
  error?: string;
  // 双轨检索原始数据
  academic?: DualTrackResult['academic'];
  industry?: IndustryResult;
  crossValidation?: CrossValidation;
  finalCredibility?: Credibility;
  credibility?: Credibility;
  recommendation?: string;
  searchTimeMs?: number;
  // AI 分析结果（旧版字段）
  aiAnalysis?: Record<string, unknown>;
  noveltyScore?: number;
  practicalScore?: number;
  summary?: string;
  similarPapers?: SimilarPaper[];
  keyDifferentiators?: string;
  improvementSuggestions?: string;
  sections?: Record<string, unknown>;
  // Agent 多智能体结果
  academicReview?: AgentOutput;
  industryAnalysis?: AgentOutput;
  innovationEvaluation?: AgentOutput;
  competitorAnalysis?: AgentOutput;
  arbitration?: ArbitrationResult;
  qualityCheck?: QualityCheckResult;
  innovationRadar?: InnovationRadarDimension[];
  debate?: DebateRecord;
  innovationDNA?: InnovationDNAMap;
  crossDomainTransfer?: CrossDomainScoutOutput;
  memoryInsight?: MemoryInsight;
  // 元数据
  usedModel?: string;
  fromCache?: boolean;
  cacheSavedMs?: number;
  isPartial?: boolean;
  executionRecord?: FinalReport['executionRecord'];
}

/** 错误信息（与 ErrorModal 对齐） */
export type { ErrorInfo } from '@/components/ui/ErrorModal';
