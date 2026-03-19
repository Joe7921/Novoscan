/**
 * useFollowUp — 封装追问精化逻辑
 *
 * 从 HomeContent 中提取 handleRefine（~72行），包含：
 * - 调用 refineWithFollowUp
 * - 报告构建（via buildReportFromResult）
 * - SSE 流式回调（via createStreamCallback）
 * - 执行记录保存
 * - 后续追问生成
 */

'use client';

import { useCallback } from 'react';
import {
  refineWithFollowUp,
  generateFollowUp,
} from '@/lib/services/ai/apiClient';
import { agentExecutionService } from '@/lib/services/agentExecutionService';
import { DOMAIN_REGISTRY, SUB_DOMAIN_SEEDS } from '@/lib/constants/domains';
import type { AnalysisAPIResult } from '@/types';
import { parseError } from '@/components/ui/ErrorModal';
import { useAppContext } from '@/contexts/AppContext';
import { useAnalysisContext } from '@/contexts/AnalysisContext';
import { buildReportFromResult } from '@/lib/utils/buildReportFromResult';
import { createStreamCallback } from '@/lib/utils/createStreamCallback';

export function useFollowUp() {
  const {
    language, selectedModel, selectedDomainId, selectedSubDomainId, isPrivateMode,
  } = useAppContext();

  const {
    idea, report, setReport, dualResult, setDualResult,
    setErrorInfo,
    setIsRefining, setRefineProgress, setRefineTitle,
    followUpRound, setFollowUpRound,
    setFollowUpQuestions, setIsFollowUpLoading,
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

  // === 追问精化 ===
  const handleRefine = useCallback(
    async (selectedQuestions: string[], userInput: string) => {
      if (!idea || !dualResult) return;
      setIsRefining(true);
      setRefineProgress({
        globalProgress: 0,
        currentLog: '',
        agentProgress: {},
        agentStreams: {},
      });
      setRefineTitle('');
      requestAnimationFrame(() =>
        window.scrollTo({ top: 0, behavior: 'smooth' }),
      );
      const domainHint = getDomainHint();

      try {
        const refineCb = createStreamCallback(setRefineProgress, {
          onRefineTitle: (title) => setRefineTitle(title),
        });

        const refinedData = (await refineWithFollowUp(
          idea,
          dualResult as unknown as Record<string, unknown>,
          selectedQuestions,
          userInput,
          report?.summary || '',
          language,
          selectedModel,
          refineCb,
          selectedDomainId || undefined,
          selectedSubDomainId || undefined,
          domainHint,
          followUpRound + 1,
          isPrivateMode,
        )) as unknown as AnalysisAPIResult;

        if (refinedData?.success) {
          setDualResult(refinedData);
          setReport(buildReportFromResult(refinedData));

          // 保存执行记录
          if (refinedData.executionRecord && !isPrivateMode) {
            agentExecutionService
              .saveExecutionRecord(refinedData.executionRecord)
              .catch(() => {});
          }

          // 生成下一轮追问
          setFollowUpRound(prev => prev + 1);
          setIsFollowUpLoading(true);
          setFollowUpQuestions([]);
          generateFollowUp(
            idea,
            refinedData.arbitration?.summary || '',
            refinedData.academicReview?.keyFindings || [],
            refinedData.innovationEvaluation?.redFlags || [],
            language,
            selectedModel,
          )
            .then(q => {
              setFollowUpQuestions(q);
              setIsFollowUpLoading(false);
            })
            .catch(() => setIsFollowUpLoading(false));
        }
      } catch (err: unknown) {
        setErrorInfo(parseError(err, selectedModel, language));
      } finally {
        setIsRefining(false);
      }
    },
    [
      idea, dualResult, report, language, selectedModel,
      selectedDomainId, selectedSubDomainId, followUpRound,
      isPrivateMode, getDomainHint,
    ], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { handleRefine };
}
