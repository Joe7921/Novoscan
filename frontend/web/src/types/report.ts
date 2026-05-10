/**
 * FinalReport TypeScript 类型定义
 *
 * 对齐后端 app/schemas/final_report.py（camelCase 输出）
 */

export interface RadarScore {
  key: string
  label: string
  score: number
}

export interface DimensionScore {
  name: string
  score: number
  reasoning: string
}

export interface AgentScoreDetail {
  name: string
  score: number
  confidence: string
  analysis: string
  dimensionScores: DimensionScore[]
  isFallback: boolean
}

export interface RiskFlag {
  risk: string
  severity: 'high' | 'medium' | 'low'
  sourceAgent: string
  suggestion?: string
}

export interface KeyFinding {
  title: string
  description: string
  source: string
}

export interface ArbitrationSummary {
  summary: string
  radarScores: RadarScore[]
}

export interface ReportMeta {
  overallScore: number | null
  noveltyLevel: string
  avgAgentScore: number
  agentCount: number
  scoreGap: number
  qualityPassed: boolean
  qualityIssues: string[]
}

export interface ReportEvidenceItem {
  id: string
  title: string
  source: string
  sourceType: string
  url: string
  year: number | null
  relevanceScore: number
  relevanceReasoning: string
  keyExcerpt: string
  dimension: string
  stance: string
  agentName: string
  citationInfo: Record<string, unknown> | null
  relatedEvidenceIds: string[]
  userMark: 'useful' | 'useless' | 'uncertain' | null
  metrics: Record<string, unknown>
}

export interface ReportBody {
  executiveSummary: string
  arbitration: ArbitrationSummary
  agentScores: AgentScoreDetail[]
  riskFlags: RiskFlag[]
  keyFindings: KeyFinding[]
  evidenceItems: ReportEvidenceItem[]
  meta: ReportMeta
}

export interface FinalReport {
  template: string
  version: string
  report: ReportBody
}
