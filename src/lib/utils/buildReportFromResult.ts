/**
 * buildReportFromResult — 将 API 返回的 AnalysisAPIResult 映射为 AnalysisReport
 *
 * 统一 handleAnalyze 和 handleRefine 中完全重复的 30+ 字段映射逻辑。
 */

import type { AnalysisReport, AnalysisAPIResult, DualTrackResult, InternetSource } from '@/types';

/**
 * 从 AnalysisAPIResult 中提取 Internet 来源（Web + GitHub）
 */
function extractInternetSources(result: AnalysisAPIResult): InternetSource[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webSources = (result.industry?.webResults || []).slice(0, 4).map((w: any) => ({
    title: w.title || 'Web Result',
    url: w.url || '#',
    summary: w.snippet || w.description || '',
    type: 'News' as const,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ghSources = (result.industry?.githubRepos || []).slice(0, 3).map((r: any) => ({
    title: r.name || 'GitHub Project',
    url: r.url || `https://github.com/${r.fullName || r.name || ''}`,
    summary: r.description || `⭐ ${r.stars || 0} stars`,
    type: 'Github' as const,
  }));
  return [...webSources, ...ghSources];
}

/**
 * 将 API 分析结果构建为前端 AnalysisReport
 *
 * @param result  - API 返回的完整结果
 * @param options - 可选配置
 */
export function buildReportFromResult(
  result: AnalysisAPIResult,
  options?: {
    /** 旧版 AI 分析结果（仅 handleAnalyze 需要） */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    aiAnalysis?: Record<string, any>;
  },
): AnalysisReport {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ai: Record<string, any> = options?.aiAnalysis || {};
  const internetSources = extractInternetSources(result);

  return {
    // === 评分 ===
    noveltyScore:
      result.arbitration?.overallScore ||
      result.noveltyScore ||
      ai.noveltyScore ||
      result.finalCredibility?.score ||
      0,
    internetNoveltyScore:
      result.industryAnalysis?.score ||
      result.arbitration?.weightedBreakdown?.industry?.raw ||
      ai.internetNoveltyScore ||
      0,
    practicalScore: result.practicalScore || null,
    noveltyLevel:
      result.finalCredibility?.level === 'high'
        ? 'High'
        : result.finalCredibility?.level === 'medium'
          ? 'Medium'
          : 'Low',

    // === 文本摘要 ===
    summary:
      ai.summary || result.arbitration?.summary || result.summary || result.recommendation || '',
    marketPotential: result.recommendation || '',
    technicalFeasibility: result.recommendation || '',

    // === 结构化数据 ===
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keyInnovations: result.academic?.results?.slice(0, 5).map((r: any) => r.title) || [],
    challenges: result.crossValidation?.redFlags || [],
    futureDirections: [],
    suggestions: [],
    similarWorks: result.academic?.results || [],
    dualTrackResult: result as unknown as DualTrackResult,
    similarPapers: ai.similarPapers || result.similarPapers || [],
    internetSources:
      internetSources.length > 0 ? internetSources : ai.internetSources || [],
    keyDifferentiators: ai.keyDifferentiators || result.keyDifferentiators || '',
    improvementSuggestions: ai.improvementSuggestions || result.improvementSuggestions || '',

    // === 元数据 ===
    sections: ai.sections || result.sections || undefined,
    usedModel: result.usedModel,
    fromCache: result.fromCache || false,
    cacheSavedMs: result.cacheSavedMs || null,
    isPartial: result.isPartial || ai.isPartial || false,

    // === Agent 分析结果 ===
    academicReview: result.academicReview || null,
    industryAnalysis: result.industryAnalysis || null,
    innovationEvaluation: result.innovationEvaluation || null,
    competitorAnalysis: result.competitorAnalysis || null,
    arbitration: result.arbitration || null,
    qualityCheck: result.qualityCheck || null,
    innovationRadar:
      result.innovationRadar || result.innovationEvaluation?.innovationRadar || null,
    debate: result.debate || null,
    innovationDNA: result.innovationDNA || null,
    crossDomainTransfer: result.crossDomainTransfer || null,
    memoryInsight: result.memoryInsight || null,
  };
}
