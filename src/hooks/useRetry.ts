/**
 * useRetry — 封装 Agent 重试策略
 *
 * 从 HomeContent 中提取 3 种重试方式：
 * - handleRetryAgent：单个 Agent 重试
 * - handleRetryAllFailed：批量重试所有失败的 Agent
 * - handleFullRetry：完全重新运行所有 Agent
 *
 * 内含 recalculateArbitration / recalculateQualityCheck 纯函数。
 */

'use client';

import { useCallback } from 'react';
import { retryAgents, fullRetryAgents } from '@/lib/services/ai/apiClient';
import { qualityGuard } from '@/agents/quality-guard';
import { DOMAIN_REGISTRY, SUB_DOMAIN_SEEDS } from '@/lib/constants/domains';
import type { AnalysisReport } from '@/types';
import { useAppContext } from '@/contexts/AppContext';
import { useAnalysisContext } from '@/contexts/AnalysisContext';

// === 常量 ===
const MAX_RETRY_ATTEMPTS = 3;

const AGENT_REPORT_KEYS: Record<string, string> = {
  academicReviewer: 'academicReview',
  industryAnalyst: 'industryAnalysis',
  competitorDetective: 'competitorAnalysis',
  innovationEvaluator: 'innovationEvaluation',
};

// === 纯函数：重新计算仲裁评分 ===
function recalculateArbitration(r: AnalysisReport): AnalysisReport['arbitration'] {
  const agents = [
    { data: r.academicReview, key: 'academic', w: 0.30 },
    { data: r.industryAnalysis, key: 'industry', w: 0.25 },
    { data: r.innovationEvaluation, key: 'innovation', w: 0.35 },
    { data: r.competitorAnalysis, key: 'competitor', w: 0.10 },
  ].filter(a => a.data && !a.data.isFallback);

  if (agents.length === 0 || !r.arbitration) return r.arbitration;

  const totalW = agents.reduce((s, a) => s + a.w, 0);
  const wb: Record<string, { raw: number; weight: number; weighted: number; confidence: string }> = {};
  let sum = 0;
  for (const a of agents) {
    const norm = a.w / totalW;
    const raw = a.data!.score;
    wb[a.key] = { raw, weight: norm, weighted: Math.round(raw * norm), confidence: a.data!.confidence };
    sum += raw * norm;
  }
  const overallScore = Math.round(sum);
  const rec = overallScore >= 80 ? '强烈推荐' : overallScore >= 65 ? '推荐' : overallScore >= 45 ? '谨慎考虑' : '不推荐';
  return {
    ...r.arbitration,
    overallScore,
    recommendation: rec,
    weightedBreakdown: wb as typeof r.arbitration.weightedBreakdown,
  };
}

// === 纯函数：重新计算质量检查 ===
function recalculateQualityCheck(r: AnalysisReport): AnalysisReport['qualityCheck'] {
  const agents = [
    r.academicReview,
    r.industryAnalysis,
    r.innovationEvaluation,
    r.competitorAnalysis,
  ].filter((a): a is NonNullable<typeof a> => Boolean(a));
  const arb = r.arbitration;
  if (!arb || agents.length === 0) return r.qualityCheck;
  return qualityGuard(arb, agents);
}

export function useRetry() {
  const {
    language, selectedModel, selectedDomainId, selectedSubDomainId, showToast,
  } = useAppContext();

  const {
    idea, report, setReport, dualResult,
    retryingAgents, setRetryingAgents,
    setRetryProgress, retryCountRef,
  } = useAnalysisContext();

  const getDomainHint = useCallback(() => {
    const domainMeta = selectedDomainId
      ? DOMAIN_REGISTRY.find(d => d.id === selectedDomainId)
      : null;
    const subDomainMeta = selectedSubDomainId
      ? SUB_DOMAIN_SEEDS.find(s => s.id === selectedSubDomainId)
      : null;
    return domainMeta
      ? subDomainMeta
        ? `${domainMeta.nameZh} > ${subDomainMeta.nameZh}`
        : domainMeta.nameZh
      : undefined;
  }, [selectedDomainId, selectedSubDomainId]);

  // === 单个 Agent 重试 ===
  const handleRetryAgent = useCallback(async (agentId: string) => {
    if (!idea || !dualResult) return;
    if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
      showToast(language === 'zh' ? '⚠️ 已达到最大重试次数' : '⚠️ Max retry attempts reached', 5000);
      return;
    }
    retryCountRef.current += 1;
    setRetryingAgents(prev => new Set(prev).add(agentId));
    try {
      const res = await retryAgents(
        [agentId], idea,
        dualResult.academic! as unknown as Record<string, unknown>,
        dualResult.industry! as unknown as Record<string, unknown>,
        selectedModel, language, getDomainHint(),
        selectedDomainId || undefined, selectedSubDomainId || undefined,
      );
      if (res.success && res.results[agentId]) {
        const reportKey = AGENT_REPORT_KEYS[agentId];
        if (reportKey) {
          setReport(prev => {
            if (!prev) return prev;
            const updated: AnalysisReport = { ...prev, [reportKey]: res.results[agentId] };
            const allFixed = ['academicReview', 'industryAnalysis', 'competitorAnalysis', 'innovationEvaluation']
              .every(k => !(updated as Record<string, { isFallback?: boolean }>)[k]?.isFallback);
            if (allFixed) updated.isPartial = false;
            updated.arbitration = recalculateArbitration(updated);
            updated.qualityCheck = recalculateQualityCheck(updated);
            return updated;
          });
        }
        showToast('✅ 专家修复成功');
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      showToast(`❌ 修复失败：${err.message || '网络超时'}`, 5000);
    } finally {
      setRetryingAgents(prev => {
        const n = new Set(prev);
        n.delete(agentId);
        return n;
      });
    }
  }, [idea, dualResult, selectedModel, language, selectedDomainId, selectedSubDomainId, getDomainHint]); // eslint-disable-line react-hooks/exhaustive-deps

  // === 批量重试所有失败 ===
  const handleRetryAllFailed = useCallback(async () => {
    if (!idea || !dualResult || !report) return;
    if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
      showToast('⚠️ 已达到最大重试次数', 5000);
      return;
    }
    retryCountRef.current += 1;
    const failedIds: string[] = [];
    if (report.academicReview?.isFallback) failedIds.push('academicReviewer');
    if (report.industryAnalysis?.isFallback) failedIds.push('industryAnalyst');
    if (report.competitorAnalysis?.isFallback) failedIds.push('competitorDetective');
    if (report.innovationEvaluation?.isFallback) failedIds.push('innovationEvaluator');
    if (failedIds.length === 0) {
      setReport(prev => prev ? { ...prev, isPartial: false } : prev);
      return;
    }

    setRetryingAgents(new Set(failedIds));
    setRetryProgress({ total: failedIds.length, completed: 0, startTime: Date.now() });
    try {
      const res = await retryAgents(
        failedIds, idea,
        dualResult.academic! as unknown as Record<string, unknown>,
        dualResult.industry! as unknown as Record<string, unknown>,
        selectedModel, language, getDomainHint(),
        selectedDomainId || undefined, selectedSubDomainId || undefined,
        {
          academicReview: report.academicReview,
          industryAnalysis: report.industryAnalysis,
          competitorAnalysis: report.competitorAnalysis,
        } as Record<string, unknown>,
      );
      if (res.success) {
        setReport(prev => {
          if (!prev) return prev;
          const updated: AnalysisReport = { ...prev };
          for (const [agentId, result] of Object.entries(res.results)) {
            if (result) {
              const rk = AGENT_REPORT_KEYS[agentId];
              if (rk) (updated as Record<string, unknown>)[rk] = result;
            }
          }
          const allFixed = ['academicReview', 'industryAnalysis', 'competitorAnalysis', 'innovationEvaluation']
            .every(k => !(updated as Record<string, { isFallback?: boolean }>)[k]?.isFallback);
          if (allFixed) updated.isPartial = false;
          updated.arbitration = recalculateArbitration(updated);
          updated.qualityCheck = recalculateQualityCheck(updated);
          return updated;
        });
        showToast(`✅ 已修复 ${res.successCount || failedIds.length} 个专家`, 5000);
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      showToast(`❌ 修复失败：${err.message || '网络超时'}`, 5000);
    } finally {
      setRetryingAgents(new Set());
      setRetryProgress(null);
    }
  }, [idea, dualResult, report, selectedModel, language, selectedDomainId, selectedSubDomainId, getDomainHint]); // eslint-disable-line react-hooks/exhaustive-deps

  // === 完全重试 ===
  const handleFullRetry = useCallback(async () => {
    if (!idea || !dualResult) return;
    setRetryingAgents(new Set(['academicReviewer', 'industryAnalyst', 'competitorDetective', 'innovationEvaluator']));
    setRetryProgress({ total: 4, completed: 0, startTime: Date.now() });
    try {
      const res = await fullRetryAgents(
        idea,
        dualResult.academic! as unknown as Record<string, unknown>,
        dualResult.industry! as unknown as Record<string, unknown>,
        selectedModel, language, getDomainHint(),
        selectedDomainId || undefined, selectedSubDomainId || undefined,
      );
      if (res.success) {
        setReport(prev =>
          prev
            ? {
                ...prev,
                academicReview: res.academicReview as AnalysisReport['academicReview'],
                industryAnalysis: res.industryAnalysis as AnalysisReport['industryAnalysis'],
                innovationEvaluation: res.innovationEvaluation as AnalysisReport['innovationEvaluation'],
                competitorAnalysis: res.competitorAnalysis as AnalysisReport['competitorAnalysis'],
                arbitration: res.arbitration as AnalysisReport['arbitration'],
                qualityCheck: res.qualityCheck as AnalysisReport['qualityCheck'],
                innovationRadar: (res.innovationRadar || prev.innovationRadar) as AnalysisReport['innovationRadar'],
                isPartial: res.isPartial as boolean | undefined,
                noveltyScore: (res.arbitration as { overallScore?: number })?.overallScore ?? prev.noveltyScore,
              }
            : prev,
        );
        showToast('✅ 完全重试成功，报告已全面更新', 5000);
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      showToast(`❌ 完全重试失败：${err.message}`, 5000);
    } finally {
      setRetryingAgents(new Set());
      setRetryProgress(null);
    }
  }, [idea, dualResult, selectedModel, language, selectedDomainId, selectedSubDomainId, getDomainHint]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    handleRetryAgent,
    handleRetryAllFailed,
    handleFullRetry,
    retryingAgents,
    retryProgress: useAnalysisContext().retryProgress,
  };
}
