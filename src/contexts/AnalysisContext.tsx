'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type {
  AnalysisReport,
  AnalysisAPIResult,
  ErrorInfo,
  MemoryInsight,
  UserPreferencesData,
} from '@/types';
import type { FollowUpQuestion } from '@/components/discovery/FollowUpPanel';

/* ===================================================================
 * AnalysisContext — 分析流程状态 Provider
 * 管理分析相关的所有状态：idea、report、progress、retry 等
 * =================================================================== */

/** 流式进度状态 */
export interface StreamProgress {
  globalProgress: number;
  currentLog: string;
  agentProgress: Record<string, { status: string; progress: number }>;
  agentStreams: Record<string, string>;
  contextData?: unknown;
}

/** 重试进度状态 */
export interface RetryProgress {
  total: number;
  completed: number;
  startTime: number;
}

interface AnalysisContextValue {
  // === 输入 ===
  idea: string;
  setIdea: (v: string) => void;

  // === 分析结果 ===
  report: AnalysisReport | null;
  setReport: React.Dispatch<React.SetStateAction<AnalysisReport | null>>;
  dualResult: AnalysisAPIResult | null;
  setDualResult: (v: AnalysisAPIResult | null) => void;

  // === 错误 ===
  error: string | null;
  setError: (v: string | null) => void;
  errorInfo: ErrorInfo | null;
  setErrorInfo: (v: ErrorInfo | null) => void;

  // === 流式进度 ===
  streamProgress: StreamProgress;
  setStreamProgress: React.Dispatch<React.SetStateAction<StreamProgress>>;

  // === 追问 ===
  followUpQuestions: FollowUpQuestion[];
  setFollowUpQuestions: (v: FollowUpQuestion[]) => void;
  isFollowUpLoading: boolean;
  setIsFollowUpLoading: (v: boolean) => void;
  isRefining: boolean;
  setIsRefining: (v: boolean) => void;
  followUpRound: number;
  setFollowUpRound: (v: number | ((prev: number) => number)) => void;
  refineTitle: string;
  setRefineTitle: (v: string) => void;
  refineProgress: StreamProgress;
  setRefineProgress: React.Dispatch<React.SetStateAction<StreamProgress>>;

  // === 重试 ===
  retryingAgents: Set<string>;
  setRetryingAgents: React.Dispatch<React.SetStateAction<Set<string>>>;
  retryProgress: RetryProgress | null;
  setRetryProgress: (v: RetryProgress | null) => void;
  retryCountRef: React.MutableRefObject<number>;

  // === 提取的创新点 ===
  extractedInnovations: string[];
  setExtractedInnovations: (v: string[]) => void;

  // === Cancel ===
  abortControllerRef: React.MutableRefObject<AbortController | null>;

  // === 首次庆祝 ===
  showCelebration: boolean;
  setShowCelebration: (v: boolean) => void;

  // === 用户偏好 ===
  userPreferencesData: UserPreferencesData | null;
  setUserPreferencesData: (v: UserPreferencesData | null) => void;

  // === 免费次数 ===
  freeTrialRemaining: number | null;
  setFreeTrialRemaining: (v: number | null) => void;

  // === 重置所有分析状态 ===
  resetAnalysis: () => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export const useAnalysisContext = () => {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error('useAnalysisContext 必须在 AnalysisProvider 内部使用');
  return ctx;
};

const EMPTY_PROGRESS: StreamProgress = {
  globalProgress: 0,
  currentLog: '',
  agentProgress: {},
  agentStreams: {},
};

export const AnalysisProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [idea, setIdea] = useState('');
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [dualResult, setDualResult] = useState<AnalysisAPIResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [streamProgress, setStreamProgress] = useState<StreamProgress>({ ...EMPTY_PROGRESS });

  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [followUpRound, setFollowUpRound] = useState(1);
  const [refineTitle, setRefineTitle] = useState('');
  const [refineProgress, setRefineProgress] = useState<StreamProgress>({ ...EMPTY_PROGRESS });

  const [retryingAgents, setRetryingAgents] = useState<Set<string>>(new Set());
  const [retryProgress, setRetryProgress] = useState<RetryProgress | null>(null);
  const retryCountRef = useRef(0);

  const [extractedInnovations, setExtractedInnovations] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [showCelebration, setShowCelebration] = useState(false);
  const [userPreferencesData, setUserPreferencesData] = useState<UserPreferencesData | null>(null);
  const [freeTrialRemaining, setFreeTrialRemaining] = useState<number | null>(null);

  const resetAnalysis = useCallback(() => {
    setIdea('');
    setReport(null);
    setDualResult(null);
    setExtractedInnovations([]);
    setStreamProgress({ ...EMPTY_PROGRESS });
    setFollowUpQuestions([]);
    setIsFollowUpLoading(false);
    setIsRefining(false);
    setFollowUpRound(1);
    setRefineProgress({ ...EMPTY_PROGRESS });
    setRefineTitle('');
    retryCountRef.current = 0;
  }, []);

  const value: AnalysisContextValue = {
    idea, setIdea,
    report, setReport,
    dualResult, setDualResult,
    error, setError,
    errorInfo, setErrorInfo,
    streamProgress, setStreamProgress,
    followUpQuestions, setFollowUpQuestions,
    isFollowUpLoading, setIsFollowUpLoading,
    isRefining, setIsRefining,
    followUpRound, setFollowUpRound,
    refineTitle, setRefineTitle,
    refineProgress, setRefineProgress,
    retryingAgents, setRetryingAgents,
    retryProgress, setRetryProgress,
    retryCountRef,
    extractedInnovations, setExtractedInnovations,
    abortControllerRef,
    showCelebration, setShowCelebration,
    userPreferencesData, setUserPreferencesData,
    freeTrialRemaining, setFreeTrialRemaining,
    resetAnalysis,
  };

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
};
