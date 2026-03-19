'use client';

import React, { useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';

import { AppState } from '@/types';
import type { ModelProvider } from '@/types';

/* === Context Providers === */
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { AnalysisProvider, useAnalysisContext } from '@/contexts/AnalysisContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

/* === Custom Hooks === */
import { useAnalysis } from '@/hooks/useAnalysis';
import { useRetry } from '@/hooks/useRetry';
import { useFollowUp } from '@/hooks/useFollowUp';

/* === Layout === */
import WorkspaceShell from '@/components/layout/WorkspaceShell';

/* === 性能优化：使用 dynamic import === */
const ParticleBackground = dynamic(
  () => import('@/components/antigravity/ParticleBackground'),
  { ssr: false }
);

import PlaygroundHome from '@/components/home/PlaygroundHome';

const ThinkingIndicator = dynamic(() => import('@/components/thinking/ThinkingIndicator'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-[#0B1120] dark:to-blue-900/10">
      <div className="relative flex items-center justify-center w-20 h-20 mb-8">
        <div className="absolute w-full h-full rounded-full border-4 border-novo-blue/10 dark:border-blue-500/20" />
        <div className="absolute w-full h-full rounded-full border-4 border-novo-blue dark:border-blue-400 border-r-transparent border-b-transparent animate-spin" style={{ animationDuration: '1s' }} />
      </div>
      <p className="text-gray-500 dark:text-slate-400 font-medium tracking-widest text-sm animate-pulse">
        <span className="text-novo-blue dark:text-blue-400">N</span> <span className="text-novo-red dark:text-rose-400">O</span> <span className="text-novo-yellow dark:text-amber-400">V</span> <span className="text-novo-blue dark:text-blue-400">O</span>
        <span className="ml-2">LOADING...</span>
      </p>
    </div>
  )
});

const AnalysisView = dynamic(() => import('@/components/analysis'), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-5xl mx-auto mt-8 animate-pulse">
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="h-7 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded-md" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {[0, 1].map(i => (
          <div key={i} className="bg-white/95 dark:bg-dark-surface/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center">
            <div className="w-32 h-32 rounded-full border-8 border-slate-100 dark:border-slate-800 mb-4" />
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded-md mb-2" />
          </div>
        ))}
      </div>
    </div>
  )
});

const ErrorModal = dynamic(() => import('@/components/ui/ErrorModal'), { ssr: false });
const SiteFooter = dynamic(() => import('@/components/layout/SiteFooter'), { ssr: false });
const CelebrationModal = dynamic(() => import('@/components/home/CelebrationModal'), { ssr: false });
const MockAIBanner = dynamic(() => import('@/components/home/MockAIBanner'), { ssr: false });
const FollowUpPanel = dynamic(() => import('@/components/discovery/FollowUpPanel'), { ssr: false });
const FlashThinkingIndicator = dynamic(() => import('@/components/thinking/FlashThinkingIndicator'), { ssr: false });
const FlashReport = dynamic(() => import('@/components/analysis/FlashReport'), { ssr: false });
const BottomTabBar = dynamic(() => import('@/components/layout/BottomTabBar'), { ssr: false });


/* ===================================================================
 * HomeContent — 纯渲染编排器
 * 从 Context + Hooks 消费状态和行为，只负责 UI 组合
 * =================================================================== */
function HomeContent() {
  const app = useAppContext();
  const analysis = useAnalysisContext();

  const {
    appState, setAppState, language, scanMode, setScanMode, selectedModel, setSelectedModel,
    selectedDomainId, setSelectedDomainId, selectedSubDomainId, setSelectedSubDomainId,
    isPrivateMode, togglePrivateMode,
    toastMessage, showToast, clearToast,
    sidebarCollapsed, toggleSidebar, setLanguage,
  } = app;

  const {
    idea, setIdea, report, setReport, dualResult,
    error, setError, errorInfo, setErrorInfo,
    streamProgress,
    followUpQuestions, isFollowUpLoading,
    isRefining, followUpRound,
    refineTitle, refineProgress,
    extractedInnovations,
    showCelebration, setShowCelebration,
    userPreferencesData, setUserPreferencesData,
    freeTrialRemaining, setFreeTrialRemaining,
    resetAnalysis,
  } = analysis;

  // === Custom Hooks ===
  const { handleAnalyze, handleCancelAnalysis } = useAnalysis();
  const { handleRetryAgent, handleRetryAllFailed, handleFullRetry, retryingAgents, retryProgress } = useRetry();
  const { handleRefine } = useFollowUp();

  // === 初始化用户偏好（开源版无需登录，仅加载本地偏好） ===
  useEffect(() => {
    const initPrefs = async () => {
      try {
        const res = await fetch('/api/user-preferences');
        const json = await res.json();
        if (json.success) {
          setUserPreferencesData(json);
          if (json.profile?.preferredModel) {
            const validModels: ModelProvider[] = ['deepseek', 'minimax', 'moonshot'];
            if (validModels.includes(json.profile.preferredModel)) {
              setSelectedModel(json.profile.preferredModel as ModelProvider);
            }
          }
        }
      } catch (e) { console.warn('[Home] 读取偏好失败', e); }
    };
    initPrefs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // === UI 回调 ===
  const handleKeywordClick = useCallback((keyword: string) => {
    setIdea(keyword);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = useCallback(() => {
    if (report && !window.confirm(language === 'zh' ? '返回将清除当前分析报告，确定吗？' : 'Going back will clear the current report. Are you sure?')) return;
    resetAnalysis();
    setSelectedDomainId(null);
    setSelectedSubDomainId(null);
    setScanMode('standard');
    setAppState(AppState.INPUT);
  }, [report, language]); // eslint-disable-line react-hooks/exhaustive-deps

  /* === 渲染 === */
  return (
    <WorkspaceShell language={language}>
      <div className="min-h-screen relative flex flex-col text-gray-900 bg-transparent pb-20 lg:pb-0">
        {/* 粒子背景 */}
        {appState === AppState.INPUT && <ParticleBackground />}

        {/* 抽象渐变光斑 */}
        <div
          className="absolute inset-0 pointer-events-none -z-10"
          style={{
            background: `
              radial-gradient(ellipse 60% 50% at 10% 10%, rgba(66,133,244,0.10) 0%, transparent 70%),
              radial-gradient(ellipse 50% 50% at 90% 40%, rgba(234,67,53,0.08) 0%, transparent 70%),
              radial-gradient(ellipse 50% 40% at 40% 90%, rgba(251,188,5,0.08) 0%, transparent 70%)
            `,
          }}
        />

        {/* Toast 通知 */}
        {toastMessage && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-up" role="alert">
            <div className="px-5 py-3 bg-gray-900/98 text-white text-sm font-medium rounded-2xl shadow-2xl border border-white/10 flex items-center gap-2">
              <span>{toastMessage}</span>
              <button onClick={clearToast} className="text-white/50 hover:text-white ml-2 text-xs" aria-label="关闭通知">✕</button>
            </div>
          </div>
        )}



        <main className="flex-grow flex flex-col items-center justify-start relative z-10 w-full">
          {/* ===== 输入视图 — 极简 Playground ===== */}
          {appState === AppState.INPUT && (
            <>
              <MockAIBanner />
              <PlaygroundHome
                idea={idea}
                setIdea={setIdea}
                handleAnalyze={handleAnalyze}
                scanMode={scanMode}
                onScanModeChange={setScanMode}
                isPrivateMode={isPrivateMode}
                onPrivacyToggle={togglePrivateMode}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                language={language}
                error={error}
              />
            </>
          )}

          {/* ===== 分析中 ===== */}
          {appState === AppState.ANALYZING && (
            <div className="flex-grow flex items-center justify-center w-full">
              {scanMode === 'flash' ? (
                <FlashThinkingIndicator language={language} query={idea} isDataReady={!!report && !!dualResult} streamProgress={streamProgress} onComplete={() => setAppState(AppState.REPORT)} onCancel={handleCancelAnalysis} />
              ) : (
                <ThinkingIndicator language={language} query={idea} isDataReady={!!report && !!dualResult} streamProgress={streamProgress} onComplete={() => setAppState(AppState.REPORT)} onCancel={handleCancelAnalysis} />
              )}
            </div>
          )}

          {/* 追问精化进度 */}
          {isRefining && (
            <div className="flex-grow flex items-center justify-center w-full">
              <ThinkingIndicator language={language} query={refineTitle || idea} isDataReady={false} streamProgress={refineProgress} />
            </div>
          )}

          {/* ===== 报告视图 ===== */}
          {appState === AppState.REPORT && report && dualResult && (
            <>
              {scanMode === 'flash' ? (
                <FlashReport report={report} onReset={handleReset} language={language} query={idea} dualResult={dualResult} />
              ) : (
                <>
                  <AnalysisView report={report} onReset={handleReset} language={language} query={idea} dualResult={dualResult} onRetryAgent={handleRetryAgent} onRetryAllFailed={handleRetryAllFailed} onFullRetry={handleFullRetry} retryingAgents={retryingAgents} retryProgress={retryProgress} />
                  <div className="w-full max-w-5xl mt-6">
                    <FollowUpPanel language={language} questions={followUpQuestions} isLoading={isFollowUpLoading} isRefining={isRefining} followUpRound={followUpRound} onRefine={handleRefine} refineProgress={refineProgress} query={idea} report={report} dualResult={dualResult} />
                  </div>
                </>
              )}
            </>
          )}
        </main>

        {appState === AppState.INPUT && <SiteFooter language={language} />}

        <ErrorModal isOpen={!!errorInfo} onClose={() => setErrorInfo(null)} errorInfo={errorInfo} onRetry={handleAnalyze} />

        <CelebrationModal isOpen={showCelebration} onClose={() => setShowCelebration(false)} score={report?.noveltyScore} language={language} />
        <BottomTabBar />
      </div>
    </WorkspaceShell>
  );
}


/* ===================================================================
 * HomeClient — Provider 包裹层
 * 职责仅为组装 Provider Tree
 * =================================================================== */
export default function HomeClient() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AnalysisProvider>
          <HomeContent />
        </AnalysisProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
