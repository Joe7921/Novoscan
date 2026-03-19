/**
 * useAnalysis — 封装核心分析启动逻辑
 *
 * 从 HomeContent 中提取 handleAnalyze（~90行），包含：
 * - 调用 analyzeWithAI / analyzeFlash
 * - 报告构建（via buildReportFromResult）
 * - SSE 流式回调（via createStreamCallback）
 * - 首次庆祝、追问生成
 * - 中止控制
 */

'use client';

import { useCallback } from 'react';
import {
  analyzeWithAI,
  analyzeFlash,
  generateFollowUp,
} from '@/lib/services/ai/apiClient';
import { agentExecutionService } from '@/lib/services/agentExecutionService';
import { DOMAIN_REGISTRY, SUB_DOMAIN_SEEDS } from '@/lib/constants/domains';
import { AppState } from '@/types';
import type { AnalysisAPIResult } from '@/types';
import { parseError } from '@/components/ui/ErrorModal';
import { useAppContext } from '@/contexts/AppContext';
import { useAnalysisContext } from '@/contexts/AnalysisContext';
import { buildReportFromResult } from '@/lib/utils/buildReportFromResult';
import { createStreamCallback } from '@/lib/utils/createStreamCallback';

/** 用于 dynamic import 预加载分析模块 */
const analysisImport = () => import('@/components/analysis');

export function useAnalysis() {
  const {
    appState, setAppState, language, scanMode,
    selectedModel, selectedDomainId, selectedSubDomainId,
    isPrivateMode, showToast,
  } = useAppContext();

  const {
    idea, setReport, setDualResult,
    setError, setErrorInfo,
    streamProgress, setStreamProgress,
    setFollowUpQuestions, setIsFollowUpLoading, setFollowUpRound,
    abortControllerRef,
    setShowCelebration,
  } = useAnalysisContext();

  // === Domain hint ===
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

  // === 核心：分析 ===
  const handleAnalyze = useCallback(async () => {
    if (!idea.trim()) return;

    setAppState(AppState.ANALYZING);
    setError(null);
    setErrorInfo(null);
    analysisImport().catch(() => {});
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    try {
      setStreamProgress({
        globalProgress: 0,
        currentLog: '',
        agentProgress: {},
        agentStreams: {},
        contextData: undefined,
      });
      const domainHint = getDomainHint();
      const isFlash = scanMode === 'flash';

      const streamCb = createStreamCallback(setStreamProgress);

      const result = (isFlash
        ? await analyzeFlash(
            idea, 'general', language, selectedModel, streamCb,
            selectedDomainId || undefined, selectedSubDomainId || undefined,
            domainHint, isPrivateMode, signal,
          )
        : await analyzeWithAI(
            idea, 'general', language, selectedModel, streamCb,
            selectedDomainId || undefined, selectedSubDomainId || undefined,
            domainHint, isPrivateMode, signal,
          )) as AnalysisAPIResult;

      if (!result.success) throw new Error(result.error || 'Analysis failed');
      setDualResult(result);

      // 保存执行记录
      if (result.executionRecord && !isPrivateMode) {
        agentExecutionService
          .saveExecutionRecord(result.executionRecord)
          .catch(err => console.warn('[useAnalysis] 保存执行记录失败', err));
      }

      // 构建 report
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aiAnalysis = (result.aiAnalysis as Record<string, any>) || undefined;
      setReport(buildReportFromResult(result, { aiAnalysis }));

      // 首次庆祝
      if (
        typeof window !== 'undefined' &&
        !localStorage.getItem('novoscan_first_report_seen')
      ) {
        localStorage.setItem('novoscan_first_report_seen', '1');
        setShowCelebration(true);
      }

      // 生成追问（非 Flash 模式）
      if (!isFlash) {
        setIsFollowUpLoading(true);
        setFollowUpQuestions([]);
        setFollowUpRound(1);
        generateFollowUp(
          idea,
          result.arbitration?.summary || result.summary || '',
          result.academicReview?.keyFindings || [],
          result.innovationEvaluation?.redFlags || [],
          language,
          selectedModel,
        )
          .then(questions => {
            setFollowUpQuestions(questions);
            setIsFollowUpLoading(false);
          })
          .catch(() => setIsFollowUpLoading(false));
      }
    } catch (err: unknown) {
      const error = err as Error & { name?: string; message?: string };
      if (error.name === 'AbortError') {
        setAppState(AppState.INPUT);
        setStreamProgress({
          globalProgress: 0,
          currentLog: '',
          agentProgress: {},
          agentStreams: {},
          contextData: undefined,
        });
        return;
      }
      setError(error.message || '分析失败');
      setErrorInfo(parseError(err, selectedModel, language));
      setAppState(AppState.INPUT);
    } finally {
      abortControllerRef.current = null;
    }
  }, [
    idea, selectedDomainId, selectedSubDomainId, language,
    selectedModel, isPrivateMode, scanMode, getDomainHint,
    // Context setters 不变所以不列出
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // === 取消分析 ===
  const handleCancelAnalysis = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { handleAnalyze, handleCancelAnalysis, getDomainHint };
}
