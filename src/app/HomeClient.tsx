'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { searchDualTrack, analyzeWithAI, analyzeFlash, generateFollowUp, refineWithFollowUp, retryAgents, fullRetryAgents } from '@/lib/services/ai/apiClient';
import { qualityGuard } from '@/agents/qualityGuard';
import { mapScoreToRecommendation } from '@/agents/orchestrator';
import { agentExecutionService } from '@/lib/services/agentExecutionService';
import { DOMAIN_REGISTRY, SUB_DOMAIN_SEEDS } from '@/lib/constants/domains';

import dynamic from 'next/dynamic';
import LazySection from '@/components/layout/LazySection';

// 性能优化：ParticleBackground 仅在首页渲染（从 layout.tsx 移入）
const ParticleBackground = dynamic(
  () => import('@/components/antigravity/ParticleBackground'),
  { ssr: false }
);

// 首屏关键组件保留 SSR，确保首屏 HTML 非空白
import Navbar from '@/components/layout/Navbar';
const BottomTabBar = dynamic(() => import('@/components/layout/BottomTabBar'), { ssr: false });
// HeroSection 保留 SSR，让首屏 HTML 包含搜索输入区
import HeroSection from '@/components/home/HeroSection';
const FeatureGrid = dynamic(() => import('@/components/home/FeatureGrid'), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-6xl mx-auto py-16 px-4 animate-pulse">
      <div className="h-6 w-40 bg-gray-200 dark:bg-slate-700 rounded-lg mb-8 mx-auto" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-100 dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-slate-800" />)}
      </div>
    </div>
  ),
});

const ThinkingIndicator = dynamic(() => import('@/components/thinking/ThinkingIndicator'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-[#0B1120] dark:to-blue-900/10">
      {/* 装饰光斑 */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-google-blue/5 dark:bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }} />
      <div className="relative flex items-center justify-center w-20 h-20 mb-8">
        <div className="absolute w-full h-full rounded-full border-4 border-google-blue/10 dark:border-blue-500/20"></div>
        <div className="absolute w-full h-full rounded-full border-4 border-google-blue dark:border-blue-400 border-r-transparent border-b-transparent animate-spin" style={{ animationDuration: '1s' }}></div>
        <div className="absolute w-12 h-12 rounded-full border-4 border-google-red/10 dark:border-rose-500/20"></div>
        <div className="absolute w-12 h-12 rounded-full border-4 border-google-red dark:border-rose-400 border-l-transparent border-t-transparent animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
      </div>
      <p className="text-gray-500 dark:text-slate-400 font-medium tracking-widest text-sm animate-pulse">
        <span className="text-google-blue dark:text-blue-400">N</span> <span className="text-google-red dark:text-rose-400">O</span> <span className="text-google-yellow dark:text-amber-400">V</span> <span className="text-google-blue dark:text-blue-400">O</span>
        <span className="ml-2">LOADING...</span>
      </p>
      {/* 底部进度条 */}
      <div className="mt-6 w-48 h-1 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-google-blue via-google-red to-google-yellow dark:from-blue-400 dark:via-rose-400 dark:to-amber-400 rounded-full animate-loading-bar" style={{ width: '40%', animation: 'loading-bar 2s ease-in-out infinite' }} />
      </div>
    </div>
  )
});

// 预加载句柄：在分析阶段提前加载报告组件 chunk
const analysisImport = () => import('@/components/analysis');
const AnalysisView = dynamic(analysisImport, {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-5xl mx-auto mt-8 animate-pulse">
      {/* 骨架屏 — 模拟报告三层结构 */}

      {/* 标题行 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="h-7 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-slate-100 dark:bg-slate-800 rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          <div className="h-9 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg" />
        </div>
      </div>

      {/* 第一层：双仪表盘 */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {[0, 1].map(i => (
          <div key={i} className="bg-white/95 dark:bg-dark-surface/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center">
            <div className="w-32 h-32 rounded-full border-8 border-slate-100 dark:border-slate-800 mb-4 relative">
              <div className="absolute inset-3 rounded-full bg-slate-50 dark:bg-slate-800/50" />
            </div>
            <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded-md mb-2" />
            <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded-md" />
          </div>
        ))}
      </div>

      {/* AI 决策建议骨架 */}
      <div className="bg-gradient-to-r from-indigo-200/40 via-purple-200/40 to-violet-200/40 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-violet-500/10 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-indigo-200 dark:bg-indigo-500/30 rounded" />
          <div className="h-5 w-36 bg-indigo-200/60 dark:bg-indigo-500/20 rounded-md" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full bg-indigo-100/60 dark:bg-indigo-500/10 rounded" />
          <div className="h-3 w-11/12 bg-indigo-100/60 dark:bg-indigo-500/10 rounded" />
          <div className="h-3 w-4/5 bg-indigo-100/60 dark:bg-indigo-500/10 rounded" />
          <div className="h-3 w-3/4 bg-indigo-100/60 dark:bg-indigo-500/10 rounded" />
        </div>
      </div>

      {/* 雷达图 + 验证卡片 */}
      <div className="grid lg:grid-cols-12 gap-6 mb-6">
        <div className="lg:col-span-7 bg-white/95 dark:bg-dark-surface/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded-md mb-4" />
          <div className="aspect-square max-w-[280px] mx-auto bg-slate-50 dark:bg-slate-800/50 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-700/50" />
        </div>
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white/95 dark:bg-dark-surface/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 bg-emerald-200 dark:bg-emerald-500/30 rounded" />
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded-md" />
              <div className="h-6 w-8 bg-emerald-100 dark:bg-emerald-500/20 rounded-md ml-auto" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded" />
              <div className="h-3 w-5/6 bg-slate-100 dark:bg-slate-800 rounded" />
            </div>
          </div>
          <div className="bg-white/95 dark:bg-dark-surface/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-emerald-200 dark:bg-emerald-500/30 rounded" />
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-md" />
              </div>
              <div className="h-5 w-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* 证据手风琴骨架 */}
      <div className="space-y-3">
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded-md mb-2" />
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-white/95 dark:bg-dark-surface/60 rounded-2xl border border-slate-200 dark:border-slate-700 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-4 flex-1 bg-slate-200 dark:bg-slate-700 rounded-md" style={{ maxWidth: `${140 + i * 40}px` }} />
              <div className="h-5 w-14 bg-slate-100 dark:bg-slate-800 rounded-full" />
              <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* 底部渲染提示 */}
      <div className="flex items-center justify-center gap-2 mt-8 mb-4">
        <div className="w-4 h-4 border-2 border-indigo-400/40 dark:border-indigo-500/20 border-t-indigo-500 dark:border-t-indigo-400 rounded-full animate-spin" />
        <span className="text-sm text-slate-400 font-medium">正在渲染分析报告…</span>
      </div>
    </div>
  )
});
const TrendingInnovations = dynamic(() => import('@/components/discovery/TrendingInnovations'), {
  ssr: false,
  loading: () => (
    <div className="w-full animate-pulse">
      <div className="h-6 w-40 bg-gray-200 rounded-lg mb-4" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl border border-gray-200" />
        ))}
      </div>
    </div>
  ),
});
const UserInsights = dynamic(() => import('@/components/home/UserInsights'), {
  ssr: false,
  loading: () => (
    <div className="w-full animate-pulse">
      <div className="h-5 w-32 bg-gray-200 rounded-lg mb-3" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 w-48 flex-shrink-0 bg-gray-100 rounded-xl border border-gray-200" />
        ))}
      </div>
    </div>
  ),
});
const ErrorModal = dynamic(() => import('@/components/ui/ErrorModal'), { ssr: false });

const PopularReports = dynamic(() => import('@/components/home/PopularReports'), {
  ssr: false,
  loading: () => (
    <div className="w-full animate-pulse">
      <div className="h-6 w-36 bg-gray-200 rounded-lg mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl border border-gray-200" />
        ))}
      </div>
    </div>
  ),
});
const SiteFooter = dynamic(() => import('@/components/layout/SiteFooter'), {
  ssr: false,
  loading: () => <div className="h-24" />,
});
const HighlightShowcase = dynamic(() => import('@/components/home/HighlightShowcase'), {
  ssr: false,
  loading: () => (
    <div className="w-full animate-pulse py-8">
      <div className="h-6 w-48 bg-gray-200 rounded-lg mb-6 mx-auto" />
      <div className="h-40 bg-gray-100 rounded-2xl border border-gray-200" />
    </div>
  ),
});
const DataSourceCoverage = dynamic(() => import('@/components/data/DataSourceCoverage'), {
  ssr: false,
  loading: () => (
    <div className="w-full animate-pulse py-6">
      <div className="h-6 w-52 bg-gray-200 rounded-lg mb-6" />
      <div className="grid md:grid-cols-2 gap-6">
        {[0, 1].map(i => <div key={i} className="space-y-3">{[0, 1, 2].map(j => <div key={j} className="h-16 bg-gray-100 rounded-xl border border-gray-200" />)}</div>)}
      </div>
    </div>
  ),
});
const SearchHistory = dynamic(() => import('@/components/ui/SearchHistory'), {
  ssr: false,
  loading: () => (
    <div className="w-full animate-pulse">
      <div className="h-6 w-32 bg-gray-200 rounded-lg mb-4" />
      <div className="space-y-3">
        {[0, 1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl border border-gray-200" />)}
      </div>
    </div>
  ),
});

const LoginModal = dynamic(() => import('@/components/auth/LoginModal'), { ssr: false });
const OnboardingOverlay = dynamic(() => import('@/components/home/OnboardingOverlay'), { ssr: false });
const CelebrationModal = dynamic(() => import('@/components/home/CelebrationModal'), { ssr: false });
import { createClient } from '@/utils/supabase/client';

import { AppState, ModelProvider, Language, ScanMode } from '@/types';
import type { FollowUpQuestion } from '@/components/discovery/FollowUpPanel';
const FollowUpPanel = dynamic(() => import('@/components/discovery/FollowUpPanel'), { ssr: false });
const FlashThinkingIndicator = dynamic(() => import('@/components/thinking/FlashThinkingIndicator'), { ssr: false });
const FlashReport = dynamic(() => import('@/components/analysis/FlashReport'), { ssr: false });


export default function HomeClient() {
  const [appState, setAppState] = useState<AppState>(AppState.INPUT);
  const [idea, setIdea] = useState('');
  const [report, setReport] = useState<any>(null); // To match useAnalysis
  const [dualResult, setDualResult] = useState<any>(null); // Ignored DualTrackResult
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<any>(null);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const [selectedModel, setSelectedModel] = useState<ModelProvider>('minimax');

  // 用户偏好数据（传递给 UserInsights，避免重复请求）
  const [userPreferencesData, setUserPreferencesData] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 初始化：合并用户偏好读取 + 匿名免费次数检查，共享一次 getUser() 调用
  useEffect(() => {
    const initUser = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setIsLoggedIn(true);
          // 已登录用户：读取首选模型偏好 + 画像数据（共享一次请求）
          try {
            const res = await fetch('/api/user-preferences');
            const json = await res.json();
            if (json.success) {
              // 存储完整偏好数据，供 UserInsights 消费
              setUserPreferencesData(json);
              // 同时提取模型偏好
              if (json.profile?.preferredModel) {
                const validModels: ModelProvider[] = ['deepseek', 'minimax', 'moonshot'];
                if (validModels.includes(json.profile.preferredModel)) {
                  setSelectedModel(json.profile.preferredModel as ModelProvider);
                }
              }
            }
          } catch (e) {
            console.warn('[Home] 读取首选模型失败', e);
          }
        } else {
          // 匿名用户：读取已使用的免费次数
          const usedCount = parseInt(localStorage.getItem('novoscan_free_count') || '0', 10);
          setFreeTrialRemaining(Math.max(0, 3 - usedCount));
        }
      } catch (e) {
        console.warn('[Home] 用户初始化失败', e);
      }
    };
    initUser();
  }, []);

  const [extractedInnovations, setExtractedInnovations] = useState<any[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [selectedSubDomainId, setSelectedSubDomainId] = useState<string | null>(null);
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('standard');

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [followUpRound, setFollowUpRound] = useState(1);
  const [refineTitle, setRefineTitle] = useState('');  // AI 合成的追问分析标题
  const [retryingAgents, setRetryingAgents] = useState<Set<string>>(new Set());
  // 重试次数计数器（最多 3 次，避免用户无限重试浪费资源）
  const MAX_RETRY_ATTEMPTS = 3;
  const retryCountRef = useRef(0);

  // #10 取消分析：AbortController 引用
  const abortControllerRef = useRef<AbortController | null>(null);

  // #3 免费体验次数剩余提醒
  const [freeTrialRemaining, setFreeTrialRemaining] = useState<number | null>(null);
  // #4 Flash 自动切换 toast 通知
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // 首次报告庆祝弹窗
  const [showCelebration, setShowCelebration] = useState(false);
  const [retryProgress, setRetryProgress] = useState<{
    total: number;
    completed: number;
    startTime: number;
  } | null>(null);
  const [refineProgress, setRefineProgress] = useState<{
    globalProgress: number;
    currentLog: string;
    agentProgress: Record<string, { status: string; progress: number }>;
    agentStreams: Record<string, string>;
    contextData?: any;
  }>({
    globalProgress: 0,
    currentLog: '',
    agentProgress: {},
    agentStreams: {},
  });
  const [streamProgress, setStreamProgress] = useState<{
    globalProgress: number;
    currentLog: string;
    agentProgress: Record<string, { status: string; progress: number }>;
    agentStreams: Record<string, string>;
    contextData?: any;
  }>({
    globalProgress: 0,
    currentLog: '',
    agentProgress: {},
    agentStreams: {}
  });

  const handleAnalyze = useCallback(async () => {
    if (!idea.trim()) return;

    // 免费使用次数拦截逻辑（匿名用户享有 3 次免费体验）
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const usedCount = parseInt(localStorage.getItem('novoscan_free_count') || '0', 10);
      if (usedCount >= 3) {
        setShowLoginModal(true);
        return;
      }
      // #4 首次使用自动切换 Flash 模式（成本低、速度快，快速展示价值）
      if (usedCount === 0 && scanMode === 'standard') {
        setScanMode('flash');
        setToastMessage(language === 'zh' ? '⚡ 已为你自动选择极速模式，获得最快体验' : '⚡ Auto-switched to Flash mode for fastest experience');
        setTimeout(() => setToastMessage(null), 4000);
      }
      localStorage.setItem('novoscan_free_count', String(usedCount + 1));
      // #3 更新剩余次数
      setFreeTrialRemaining(Math.max(0, 2 - usedCount));
    }

    setAppState(AppState.ANALYZING);
    setError(null);
    setErrorInfo(null);

    // 预加载报告组件 chunk — 在分析期间提前下载，消除状态切换时白屏
    analysisImport().catch(() => { });

    // #10 创建新的 AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    try {
      setStreamProgress({ globalProgress: 0, currentLog: '', agentProgress: {}, agentStreams: {}, contextData: undefined });

      // 构建学科提示信息（用于注入 Agent Prompt）
      const domainMeta = selectedDomainId ? DOMAIN_REGISTRY.find(d => d.id === selectedDomainId) : null;
      const subDomainMeta = selectedSubDomainId ? SUB_DOMAIN_SEEDS.find(s => s.id === selectedSubDomainId) : null;
      const domainHint = domainMeta
        ? (subDomainMeta ? `${domainMeta.nameZh} > ${subDomainMeta.nameZh}` : domainMeta.nameZh)
        : undefined;

      // 1. 根据模式调用不同的分析接口
      const isFlash = scanMode === 'flash';
      const result = isFlash
        ? await analyzeFlash(
          idea,
          'general',
          language,
          selectedModel,
          (type, data) => {
            if (type === 'log') {
              setStreamProgress(prev => ({ ...prev, currentLog: data }));
            } else if (type === 'progress') {
              setStreamProgress(prev => ({ ...prev, globalProgress: data }));
            } else if (type === 'agent_state') {
              setStreamProgress(prev => ({
                ...prev,
                agentProgress: {
                  ...prev.agentProgress,
                  [data.agentId]: data.update
                }
              }));
            } else if (type === 'context_ready') {
              setStreamProgress(prev => ({ ...prev, contextData: data }));
            }
          },
          selectedDomainId || undefined,
          selectedSubDomainId || undefined,
          domainHint,
          isPrivateMode,
          signal
        )
        : await analyzeWithAI(
          idea,
          'general',
          language,
          selectedModel,
          (type, data) => {
            if (type === 'log') {
              setStreamProgress(prev => ({ ...prev, currentLog: data }));
            } else if (type === 'progress') {
              setStreamProgress(prev => ({ ...prev, globalProgress: data }));
            } else if (type === 'agent_state') {
              setStreamProgress(prev => ({
                ...prev,
                agentProgress: {
                  ...prev.agentProgress,
                  [data.agentId]: data.update
                }
              }));
            } else if (type === 'agent_stream') {
              setStreamProgress(prev => ({
                ...prev,
                agentStreams: {
                  ...prev.agentStreams,
                  // 辩论交锋结构化数据：序列化为 JSON 存入独立 key，供 DebatePanel 解析
                  ...(data.debateExchange
                    ? { [`${data.agentId}_round${data.round}`]: JSON.stringify({ debateExchange: data.debateExchange, sessionId: data.sessionId, round: data.round }) }
                    // 普通流式文本 chunk：拼接到对应 agentId
                    : { [data.agentId]: (prev.agentStreams[data.agentId] || '') + (data.chunk || '') }
                  )
                }
              }));
            } else if (type === 'context_ready') {
              setStreamProgress(prev => ({ ...prev, contextData: data }));
            }
          },
          selectedDomainId || undefined,
          selectedSubDomainId || undefined,
          domainHint,
          isPrivateMode,
          signal
        );

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      // 2. 将数据分别装载给新旧混合视图
      // 双轨检索原始结果
      setDualResult(result);

      // 如果后端传回了执行记录数据，则前端将其存入 indexedDB 以供历史页面展现
      // 隐私模式下跳过本地历史保存
      if (result.executionRecord && !isPrivateMode) {
        agentExecutionService.saveExecutionRecord(result.executionRecord).catch(err => {
          console.warn('[Home] Failed to save execution record locally', err);
        });
      }

      // 3. 构建旧有 AnalysisView 需要的 report 结构
      const ai = result.aiAnalysis || {};

      // 从产业数据中构建 internetSources（网页搜索 + GitHub 项目）
      const webSources = (result.industry?.webResults || []).slice(0, 4).map((w: any) => ({
        title: w.title || 'Web Result',
        url: w.url || '#',
        summary: w.snippet || w.description || '',
        type: 'News' as const
      }));
      const ghSources = (result.industry?.githubRepos || []).slice(0, 3).map((r: any) => ({
        title: r.name || 'GitHub Project',
        url: r.url || `https://github.com/${r.fullName || r.name || ''}`,
        summary: r.description || `⭐ ${r.stars || 0} stars`,
        type: 'Github' as const
      }));
      const builtInternetSources = [...webSources, ...ghSources];

      setReport({
        noveltyScore: result.arbitration?.overallScore || result.noveltyScore || ai.noveltyScore || result.finalCredibility?.score || 0,
        internetNoveltyScore: result.industryAnalysis?.score || result.arbitration?.weightedBreakdown?.industry?.raw || ai.internetNoveltyScore || 0,
        practicalScore: result.practicalScore || null,
        noveltyLevel: result.finalCredibility?.level === 'high' ? 'High' : result.finalCredibility?.level === 'medium' ? 'Medium' : 'Low',
        summary: ai.summary || result.arbitration?.summary || result.summary || result.recommendation || '',
        marketPotential: result.recommendation || '',
        technicalFeasibility: result.recommendation || '',
        keyInnovations: result.academic?.results?.slice(0, 5).map((r: any) => r.title) || [],
        challenges: result.crossValidation?.redFlags || [],
        futureDirections: [],
        suggestions: [],
        similarWorks: result.academic?.results || [],
        dualTrackResult: result,
        similarPapers: ai.similarPapers || result.similarPapers || [],
        internetSources: builtInternetSources.length > 0 ? builtInternetSources : (ai.internetSources || []),
        keyDifferentiators: ai.keyDifferentiators || result.keyDifferentiators || '',
        improvementSuggestions: ai.improvementSuggestions || result.improvementSuggestions || '',
        sections: ai.sections || result.sections || null,
        usedModel: result.usedModel,
        fromCache: result.fromCache || false,
        cacheSavedMs: result.cacheSavedMs || null,
        isPartial: result.isPartial || ai.isPartial || false,
        // Multi-Agent 完整数据（供 AnalysisView 各子组件使用）
        academicReview: result.academicReview || null,
        industryAnalysis: result.industryAnalysis || null,
        innovationEvaluation: result.innovationEvaluation || null,
        competitorAnalysis: result.competitorAnalysis || null,
        arbitration: result.arbitration || null,
        qualityCheck: result.qualityCheck || null,
        // NovoStarchart 六维创新性雷达图数据
        innovationRadar: result.innovationRadar || result.innovationEvaluation?.innovationRadar || null,
        // NovoDebate 辩论引擎数据
        debate: result.debate || null,
        // NovoDNA 创新图谱数据
        innovationDNA: result.innovationDNA || null,
        // 跨域创新迁移数据
        crossDomainTransfer: result.crossDomainTransfer || null,
        // Agent 记忆进化洞察
        memoryInsight: result.memoryInsight || null,
      });

      // 4. 重建创新点标签列表
      const tags = result.academic?.results?.slice(0, 5).map((r: any) => ({
        innovation_id: r.id || `inv_${Date.now()}_${Math.random()}`,
        keyword: r.title?.slice(0, 20) || 'Unknown',
        noveltyScore: r.citationCount || 50,
        category: 'tech'
      })) || [];
      setExtractedInnovations(tags);

      // 5a. 首次分析完成庆祝弹窗
      if (typeof window !== 'undefined' && !localStorage.getItem('novoscan_first_report_seen')) {
        localStorage.setItem('novoscan_first_report_seen', '1');
        setShowCelebration(true);
      }

      // 5. 自动生成追问问题（Flash 模式跳过）
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
          selectedModel
        ).then(questions => {
          setFollowUpQuestions(questions);
          setIsFollowUpLoading(false);
        }).catch(err => {
          console.warn('[Home] 追问生成失败', err);
          setIsFollowUpLoading(false);
        });
      }
    } catch (err: any) {
      // #10 用户主动取消：静默回到输入状态
      if (err.name === 'AbortError') {
        console.log('[Home] 用户取消了分析');
        setAppState(AppState.INPUT);
        setStreamProgress({ globalProgress: 0, currentLog: '', agentProgress: {}, agentStreams: {}, contextData: undefined });
        return;
      }
      console.error(err);
      setError(err.message || '分析失败，请稍后重试');
      setErrorInfo({
        message: err.message || '分析失败，请稍后重试',
        details: err.stack,
        timestamp: new Date().toISOString()
      });
      setAppState(AppState.INPUT);
    } finally {
      abortControllerRef.current = null;
    }
  }, [idea, selectedDomainId, selectedSubDomainId, language, selectedModel, isPrivateMode, scanMode]);

  const handleKeywordClick = useCallback((keyword: string) => {
    setIdea(keyword);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleReset = useCallback(() => {
    // #19 返回前确认弹窗
    if (report && !window.confirm(language === 'zh' ? '返回将清除当前分析报告，确定吗？' : 'Going back will clear the current report. Are you sure?')) {
      return;
    }
    setAppState(AppState.INPUT);
    setIdea('');
    setReport(null);
    setDualResult(null);
    setExtractedInnovations([]);
    setSelectedDomainId(null);
    setSelectedSubDomainId(null);
    setStreamProgress({ globalProgress: 0, currentLog: '', agentProgress: {}, agentStreams: {}, contextData: undefined });
    setFollowUpQuestions([]);
    setIsFollowUpLoading(false);
    setIsRefining(false);
    setFollowUpRound(1);
    setRefineProgress({ globalProgress: 0, currentLog: '', agentProgress: {}, agentStreams: {} });
    setRefineTitle('');
    setScanMode('standard');
    retryCountRef.current = 0; // 重置重试计数器
  }, [report, language]);

  const handleSetLanguage = useCallback((lang: Language) => setLanguage(lang), []);
  const handlePrivacyToggle = useCallback(() => setIsPrivateMode(prev => !prev), []);

  // #10 取消分析
  const handleCancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Agent ID → report 字段名映射
  const AGENT_REPORT_KEYS: Record<string, string> = {
    academicReviewer: 'academicReview',
    industryAnalyst: 'industryAnalysis',
    competitorDetective: 'competitorAnalysis',
    innovationEvaluator: 'innovationEvaluation',
  };

  /** 纯前端重新计算仲裁评分（不调用 AI，使用加权平均） */
  const recalculateArbitration = (r: any) => {
    const agents = [
      { data: r.academicReview, key: 'academic', w: 0.30 },
      { data: r.industryAnalysis, key: 'industry', w: 0.25 },
      { data: r.innovationEvaluation, key: 'innovation', w: 0.35 },
      { data: r.competitorAnalysis, key: 'competitor', w: 0.10 },
    ];
    const confMul = (c: string) => c === 'high' ? 1.0 : c === 'medium' ? 0.8 : 0.5;
    // 动态权重（按置信度调整）
    const adjusted = agents.map(a => ({ ...a, aw: a.w * confMul(a.data?.confidence || 'low') }));
    const totalW = adjusted.reduce((s, a) => s + a.aw, 0);
    const norm = adjusted.map(a => ({ ...a, nw: totalW > 0 ? a.aw / totalW : 0.25 }));
    const overallScore = Math.round(norm.reduce((s, a) => s + (a.data?.score ?? 50) * a.nw, 0));
    const wb: Record<string, any> = {};
    for (const a of norm) {
      const raw = a.data?.score ?? 50;
      wb[a.key] = { raw, weight: Math.round(a.nw * 100) / 100, weighted: Math.round(raw * a.nw), confidence: a.data?.confidence || 'low' };
    }
    return {
      ...r.arbitration,
      overallScore,
      recommendation: mapScoreToRecommendation(overallScore),
      weightedBreakdown: wb,
    };
  };

  /** 纯前端重新计算质量检查 */
  const recalculateQualityCheck = (r: any) => {
    const agents = [
      r.academicReview, r.industryAnalysis, r.innovationEvaluation, r.competitorAnalysis
    ].filter(Boolean);
    const arb = r.arbitration;
    if (!arb || agents.length === 0) return r.qualityCheck;
    return qualityGuard(arb, agents);
  };

  /** 单独重试某个 Agent */
  const handleRetryAgent = useCallback(async (agentId: string) => {
    if (!idea || !dualResult) return;
    // 重试次数限制
    if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
      setToastMessage(language === 'zh'
        ? `⚠️ 已达到最大重试次数（${MAX_RETRY_ATTEMPTS}次），请返回重新分析`
        : `⚠️ Max retry attempts reached (${MAX_RETRY_ATTEMPTS}), please re-analyze`);
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    retryCountRef.current += 1;
    setRetryingAgents(prev => new Set(prev).add(agentId));

    try {
      const domainMeta = selectedDomainId ? DOMAIN_REGISTRY.find(d => d.id === selectedDomainId) : null;
      const subDomainMeta = selectedSubDomainId ? SUB_DOMAIN_SEEDS.find(s => s.id === selectedSubDomainId) : null;
      const domainHint = domainMeta
        ? (subDomainMeta ? `${domainMeta.nameZh} > ${subDomainMeta.nameZh}` : domainMeta.nameZh)
        : undefined;

      const res = await retryAgents(
        [agentId],
        idea,
        dualResult.academic,
        dualResult.industry,
        selectedModel,
        language,
        domainHint,
        selectedDomainId || undefined,
        selectedSubDomainId || undefined,
      );

      if (res.success && res.results[agentId]) {
        const reportKey = AGENT_REPORT_KEYS[agentId];
        if (reportKey) {
          setReport((prev: any) => {
            const updated = { ...prev, [reportKey]: res.results[agentId] };
            // 检查是否所有 Agent 都已修复（包含 innovationEvaluation）
            const allFixed = ['academicReview', 'industryAnalysis', 'competitorAnalysis', 'innovationEvaluation']
              .every(k => !updated[k]?.isFallback);
            if (allFixed) updated.isPartial = false;
            // 重新计算仲裁分数和质量检查
            updated.arbitration = recalculateArbitration(updated);
            updated.qualityCheck = recalculateQualityCheck(updated);
            return updated;
          });
        }
        // ✅ 成功反馈
        setToastMessage(language === 'zh' ? '✅ 专家修复成功，报告已更新' : '✅ Agent fixed, report updated');
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        // ❌ 重试成功但 Agent 仍然失败
        setToastMessage(language === 'zh' ? '⚠️ 重试完成但未获得有效结果，请稍后再试' : '⚠️ Retry completed but no valid result');
        setTimeout(() => setToastMessage(null), 5000);
      }
    } catch (err: any) {
      console.error(`[Retry] ${agentId} 重试失败:`, err);
      // ❌ 失败反馈
      setToastMessage(language === 'zh' ? `❌ 修复失败：${err.message || '网络超时'}` : `❌ Fix failed: ${err.message || 'timeout'}`);
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setRetryingAgents(prev => {
        const next = new Set(prev);
        next.delete(agentId);
        return next;
      });
    }
  }, [idea, dualResult, selectedModel, language, selectedDomainId, selectedSubDomainId]);

  /** 一键修复所有失败 Agent */
  const handleRetryAllFailed = useCallback(async () => {
    if (!idea || !dualResult || !report) return;
    // 重试次数限制
    if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
      setToastMessage(language === 'zh'
        ? `⚠️ 已达到最大重试次数（${MAX_RETRY_ATTEMPTS}次），请返回重新分析`
        : `⚠️ Max retry attempts reached (${MAX_RETRY_ATTEMPTS}), please re-analyze`);
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    retryCountRef.current += 1;

    // 收集所有 isFallback 的 Agent（包含 innovationEvaluator）
    const failedIds: string[] = [];
    if (report.academicReview?.isFallback) failedIds.push('academicReviewer');
    if (report.industryAnalysis?.isFallback) failedIds.push('industryAnalyst');
    if (report.competitorAnalysis?.isFallback) failedIds.push('competitorDetective');
    if (report.innovationEvaluation?.isFallback) failedIds.push('innovationEvaluator');

    if (failedIds.length === 0) {
      // 没有需要修复的 Agent，直接清除 isPartial 警告
      setReport((prev: any) => ({ ...prev, isPartial: false }));
      return;
    }

    setRetryingAgents(new Set(failedIds));
    setRetryProgress({ total: failedIds.length, completed: 0, startTime: Date.now() });

    try {
      const domainMeta = selectedDomainId ? DOMAIN_REGISTRY.find(d => d.id === selectedDomainId) : null;
      const subDomainMeta = selectedSubDomainId ? SUB_DOMAIN_SEEDS.find(s => s.id === selectedSubDomainId) : null;
      const domainHint = domainMeta
        ? (subDomainMeta ? `${domainMeta.nameZh} > ${subDomainMeta.nameZh}` : domainMeta.nameZh)
        : undefined;

      const res = await retryAgents(
        failedIds,
        idea,
        dualResult.academic,
        dualResult.industry,
        selectedModel,
        language,
        domainHint,
        selectedDomainId || undefined,
        selectedSubDomainId || undefined,
        // 传递已有的 Layer1 Agent 结果，供 innovationEvaluator 重试时使用
        {
          academicReview: report.academicReview,
          industryAnalysis: report.industryAnalysis,
          competitorAnalysis: report.competitorAnalysis,
        },
      );

      if (res.success) {
        let fixedCount = 0;
        setReport((prev: any) => {
          const updated = { ...prev };
          for (const [agentId, result] of Object.entries(res.results)) {
            if (result) {
              const reportKey = AGENT_REPORT_KEYS[agentId];
              if (reportKey) {
                updated[reportKey] = result;
                fixedCount++;
              }
            }
          }
          // 检查是否所有 Agent 都已修复（包含 innovationEvaluation）
          const allFixed = ['academicReview', 'industryAnalysis', 'competitorAnalysis', 'innovationEvaluation']
            .every(k => !updated[k]?.isFallback);
          if (allFixed) updated.isPartial = false;
          // 重新计算仲裁分数和质量检查
          updated.arbitration = recalculateArbitration(updated);
          updated.qualityCheck = recalculateQualityCheck(updated);
          return updated;
        });
        // ✅ 成功反馈
        const totalFixed = res.successCount || fixedCount;
        setToastMessage(language === 'zh'
          ? `✅ 已成功修复 ${totalFixed}/${failedIds.length} 个专家，报告已更新`
          : `✅ Fixed ${totalFixed}/${failedIds.length} agents, report updated`);
        setTimeout(() => setToastMessage(null), 5000);
      } else {
        // ❌ 全部失败 — 展示详细错误信息
        const details = res.failureDetails;
        const detailMsg = details
          ? Object.entries(details).map(([id, msg]) => `${id}: ${msg}`).join('; ')
          : '';
        setToastMessage(language === 'zh'
          ? `❌ 修复失败${detailMsg ? `（${detailMsg}）` : '，请稍后重试'}`
          : `❌ Fix failed${detailMsg ? ` (${detailMsg})` : ', please try again later'}`);
        setTimeout(() => setToastMessage(null), 6000);
      }
    } catch (err: any) {
      console.error('[Retry All] 批量重试失败:', err);
      // ❌ 失败反馈 toast
      setToastMessage(language === 'zh' ? `❌ 修复失败：${err.message || '网络超时'}` : `❌ Fix failed: ${err.message || 'timeout'}`);
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setRetryingAgents(new Set());
      setRetryProgress(null);
    }
  }, [idea, dualResult, report, selectedModel, language, selectedDomainId, selectedSubDomainId]);

  /** 完全重试：重跑全部 Agent + 仲裁 + 质量检查（消耗 8 点） */
  const handleFullRetry = useCallback(async () => {
    if (!idea || !dualResult) return;
    setRetryingAgents(new Set(['academicReviewer', 'industryAnalyst', 'competitorDetective', 'innovationEvaluator']));
    setRetryProgress({ total: 4, completed: 0, startTime: Date.now() });

    try {
      const domainMeta = selectedDomainId ? DOMAIN_REGISTRY.find(d => d.id === selectedDomainId) : null;
      const subDomainMeta = selectedSubDomainId ? SUB_DOMAIN_SEEDS.find(s => s.id === selectedSubDomainId) : null;
      const domainHint = domainMeta
        ? (subDomainMeta ? `${domainMeta.nameZh} > ${subDomainMeta.nameZh}` : domainMeta.nameZh)
        : undefined;

      const res = await fullRetryAgents(
        idea,
        dualResult.academic,
        dualResult.industry,
        selectedModel,
        language,
        domainHint,
        selectedDomainId || undefined,
        selectedSubDomainId || undefined,
      );

      if (res.success) {
        setReport((prev: any) => ({
          ...prev,
          academicReview: res.academicReview,
          industryAnalysis: res.industryAnalysis,
          innovationEvaluation: res.innovationEvaluation,
          competitorAnalysis: res.competitorAnalysis,
          arbitration: res.arbitration,
          qualityCheck: res.qualityCheck,
          innovationRadar: res.innovationRadar || prev.innovationRadar,
          isPartial: res.isPartial,
          noveltyScore: res.arbitration?.overallScore ?? prev.noveltyScore,
        }));
        setToastMessage(language === 'zh'
          ? '✅ 完全重试成功，报告已全面更新'
          : '✅ Full retry succeeded, report fully updated');
        setTimeout(() => setToastMessage(null), 5000);
      } else {
        const errMsg = res.refunded
          ? (language === 'zh' ? '❌ 完全重试失败，已自动退费' : '❌ Full retry failed, refunded')
          : (language === 'zh' ? `❌ 完全重试失败：${res.error || '未知错误'}` : `❌ Full retry failed: ${res.error || 'unknown'}`);
        setToastMessage(errMsg);
        setTimeout(() => setToastMessage(null), 6000);
      }
    } catch (err: any) {
      console.error('[Full Retry] 失败:', err);
      setToastMessage(language === 'zh' ? `❌ 完全重试失败：${err.message || '网络超时'}` : `❌ Full retry failed: ${err.message || 'timeout'}`);
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setRetryingAgents(new Set());
      setRetryProgress(null);
    }
  }, [idea, dualResult, selectedModel, language, selectedDomainId, selectedSubDomainId]);

  const handleRefine = useCallback(async (selectedQuestions: string[], userInput: string) => {
    if (!idea || !dualResult) return;

    // #21 先设置 isRefining，确保 ThinkingIndicator 已渲染后再滚动
    setIsRefining(true);
    setRefineProgress({ globalProgress: 0, currentLog: '', agentProgress: {}, agentStreams: {} });
    setRefineTitle('');

    // 滚动到页面顶部，让用户看到分析动画
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 构建学科提示信息
    const domainMeta = selectedDomainId ? DOMAIN_REGISTRY.find(d => d.id === selectedDomainId) : null;
    const subDomainMeta = selectedSubDomainId ? SUB_DOMAIN_SEEDS.find(s => s.id === selectedSubDomainId) : null;
    const domainHint = domainMeta
      ? (subDomainMeta ? `${domainMeta.nameZh} > ${subDomainMeta.nameZh}` : domainMeta.nameZh)
      : undefined;

    try {
      const refinedData = await refineWithFollowUp(
        idea,
        dualResult,
        selectedQuestions,
        userInput,
        report?.summary || '',
        language,
        selectedModel,
        (type, data) => {
          if (type === 'log') {
            setRefineProgress(prev => ({ ...prev, currentLog: data }));
          } else if (type === 'progress') {
            setRefineProgress(prev => ({ ...prev, globalProgress: data }));
          } else if (type === 'agent_state') {
            setRefineProgress(prev => ({
              ...prev,
              agentProgress: {
                ...prev.agentProgress,
                [data.agentId]: data.update
              }
            }));
          } else if (type === 'agent_stream') {
            setRefineProgress(prev => ({
              ...prev,
              agentStreams: {
                ...prev.agentStreams,
                ...(data.debateExchange
                  ? { [`${data.agentId}_round${data.round}`]: JSON.stringify({ debateExchange: data.debateExchange, sessionId: data.sessionId, round: data.round }) }
                  : { [data.agentId]: (prev.agentStreams[data.agentId] || '') + (data.chunk || '') }
                )
              }
            }));
          } else if (type === 'context_ready') {
            setRefineProgress(prev => ({ ...prev, contextData: data }));
          } else if (type === 'refine_title') {
            setRefineTitle(data);
          }
        },
        selectedDomainId || undefined,
        selectedSubDomainId || undefined,
        domainHint,
        followUpRound + 1,
        isPrivateMode
      );

      if (refinedData && refinedData.success) {
        setDualResult(refinedData);

        const ai = refinedData.academicReview ? refinedData : refinedData.aiAnalysis || {};

        const webSources = (refinedData.industry?.webResults || []).slice(0, 4).map((w: any) => ({
          title: w.title || 'Web Result',
          url: w.url || '#',
          summary: w.snippet || w.description || '',
          type: 'News' as const
        }));
        const ghSources = (refinedData.industry?.githubRepos || []).slice(0, 3).map((r: any) => ({
          title: r.name || 'GitHub Project',
          url: r.url || `https://github.com/${r.fullName || r.name || ''}`,
          summary: r.description || `⭐ ${r.stars || 0} stars`,
          type: 'Github' as const
        }));
        const builtInternetSources = [...webSources, ...ghSources];

        setReport((prevReport: any) => ({
          ...prevReport,
          noveltyScore: refinedData.arbitration?.overallScore || refinedData.noveltyScore || 0,
          internetNoveltyScore: refinedData.industryAnalysis?.score || refinedData.arbitration?.weightedBreakdown?.industry?.raw || 0,
          practicalScore: refinedData.practicalScore || null,
          summary: refinedData.arbitration?.summary || refinedData.summary || refinedData.recommendation || '',
          marketPotential: refinedData.recommendation || '',
          technicalFeasibility: refinedData.recommendation || '',
          keyInnovations: refinedData.academic?.results?.slice(0, 5).map((r: any) => r.title) || [],
          challenges: refinedData.crossValidation?.redFlags || [],
          similarWorks: refinedData.academic?.results || [],
          dualTrackResult: refinedData,
          similarPapers: refinedData.academicReview?.similarPapers || refinedData.similarPapers || [],
          internetSources: builtInternetSources.length > 0 ? builtInternetSources : (ai.internetSources || []),
          keyDifferentiators: ai.keyDifferentiators || refinedData.keyDifferentiators || '',
          improvementSuggestions: ai.improvementSuggestions || refinedData.improvementSuggestions || '',
          sections: refinedData.sections || null,
          isPartial: refinedData.isPartial || false,

          academicReview: refinedData.academicReview || null,
          industryAnalysis: refinedData.industryAnalysis || null,
          innovationEvaluation: refinedData.innovationEvaluation || null,
          competitorAnalysis: refinedData.competitorAnalysis || null,
          arbitration: refinedData.arbitration || null,
          qualityCheck: refinedData.qualityCheck || null,
          innovationRadar: refinedData.innovationRadar || refinedData.innovationEvaluation?.innovationRadar || null,
          // NovoDebate 辩论引擎数据
          debate: refinedData.debate || null,
          // NovoDNA 创新图谱数据
          innovationDNA: refinedData.innovationDNA || null,
          // 跨域创新迁移数据
          crossDomainTransfer: refinedData.crossDomainTransfer || null,
          // Agent 记忆进化洞察
          memoryInsight: refinedData.memoryInsight || null,
        }));

        setFollowUpRound(prev => prev + 1);

        setIsFollowUpLoading(true);
        generateFollowUp(
          idea,
          refinedData.arbitration?.summary || refinedData.summary || '',
          refinedData.academicReview?.keyFindings || [],
          refinedData.innovationEvaluation?.redFlags || [],
          language,
          selectedModel
        ).then(questions => {
          setFollowUpQuestions(questions);
          setIsFollowUpLoading(false);
        }).catch(err => {
          console.warn('[Home] 追问生成失败', err);
          setIsFollowUpLoading(false);
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorInfo({
        message: err.message || '精化分析失败，请稍后重试',
        details: err.stack,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsRefining(false);
    }
  }, [idea, dualResult, report, language, selectedModel, selectedDomainId, selectedSubDomainId, followUpRound, isPrivateMode]);

  return (
    <div className="min-h-screen relative flex flex-col text-gray-900 bg-transparent pb-20 lg:pb-0">
      {/* ParticleBackground — 仅首页渲染 */}
      {appState === AppState.INPUT && <ParticleBackground />}

      {/* Antigravity Abstract Orbs — 静态渐变替代 blur+float 动画，零 GPU 开销 */}
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

      <Navbar language={language} setLanguage={handleSetLanguage} />

      {/* #4 Toast 浮动通知 */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-up" role="alert" aria-live="polite">
          <div className="px-5 py-3 bg-gray-900/98 text-white text-sm font-medium rounded-2xl shadow-2xl border border-white/10 flex items-center gap-2">
            <span>{toastMessage}</span>
            <button onClick={() => setToastMessage(null)} className="text-white/50 hover:text-white ml-2 text-xs" aria-label="关闭通知">✕</button>
          </div>
        </div>
      )}

      {/* #3 免费体验次数提醒（匿名用户） */}
      {freeTrialRemaining !== null && freeTrialRemaining > 0 && appState === AppState.INPUT && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="px-4 py-2.5 bg-white/95 border border-gray-200 rounded-2xl shadow-lg text-xs text-gray-500 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-google-green animate-pulse" />
            {language === 'zh'
              ? `免费体验剩余 ${freeTrialRemaining} 次`
              : `${freeTrialRemaining} free ${freeTrialRemaining === 1 ? 'trial' : 'trials'} remaining`}
          </div>
        </div>
      )}

      <main className="flex-grow flex flex-col items-center justify-start p-4 sm:p-6 relative z-10 w-full">

        {/* Input View */}
        {appState === AppState.INPUT && (
          <>
            <HeroSection
              idea={idea}
              setIdea={setIdea}
              handleAnalyze={handleAnalyze}
              error={error}
              language={language}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              selectedDomainId={selectedDomainId}
              onDomainChange={setSelectedDomainId}
              selectedSubDomainId={selectedSubDomainId}
              onSubDomainChange={setSelectedSubDomainId}
              isPrivateMode={isPrivateMode}
              onPrivacyToggle={handlePrivacyToggle}
              scanMode={scanMode}
              onScanModeChange={setScanMode}
            />
            {/* 以下组件使用 LazySection 包裹，滚动到视口附近时才渲染和请求数据 */}
            <LazySection
              className="w-full max-w-[1440px] xl:px-10 mt-6 sm:mt-10 lg:mt-16"
              fallback={<div className="w-full animate-pulse"><div className="h-5 w-32 bg-gray-200 rounded-lg mb-3" /><div className="flex gap-3 overflow-hidden">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 w-48 flex-shrink-0 bg-gray-100 rounded-xl border border-gray-200" />)}</div></div>}
            >
              <UserInsights
                language={language}
                onKeywordClick={handleKeywordClick}
                preferencesData={userPreferencesData}
                isLoggedIn={isLoggedIn}
              />
            </LazySection>
            <LazySection
              className="w-full max-w-[1440px] xl:px-10 mt-6 sm:mt-10 lg:mt-16"
              fallback={<div className="w-full animate-pulse"><div className="h-6 w-32 bg-gray-200 rounded-lg mb-4" /><div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl border border-gray-200" />)}</div></div>}
            >
              <SearchHistory
                language={language}
                onSearch={handleKeywordClick}
              />
            </LazySection>
            <LazySection
              className="w-full max-w-[1440px] xl:px-10 mt-6 sm:mt-10 lg:mt-16"
              fallback={<div className="w-full animate-pulse"><div className="h-6 w-40 bg-gray-200 rounded-lg mb-4" /><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl border border-gray-200" />)}</div></div>}
            >
              <TrendingInnovations
                language={language}
                onKeywordClick={handleKeywordClick}
              />
            </LazySection>

            {/* 广告位 — 首页横幅，位于趋势与功能区之间 */}
            <LazySection className="w-full max-w-[1440px] xl:px-10 mt-6 sm:mt-8 lg:mt-16">            </LazySection>

            <LazySection
              className="w-full max-w-[1440px]"
              fallback={<div className="w-full max-w-6xl mx-auto py-16 px-4 animate-pulse"><div className="h-6 w-40 bg-gray-200 rounded-lg mb-8 mx-auto" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-5">{[0, 1, 2, 3].map(i => <div key={i} className="h-40 bg-gray-100 rounded-2xl border border-gray-200" />)}</div></div>}
            >
              <FeatureGrid language={language} />
            </LazySection>

            <LazySection
              className="w-full max-w-[1440px] xl:px-10 mt-6 sm:mt-10 lg:mt-16"
              fallback={<div className="w-full animate-pulse py-6"><div className="h-6 w-52 bg-gray-200 rounded-lg mb-6" /><div className="grid md:grid-cols-2 gap-6">{[0, 1].map(i => <div key={i} className="space-y-3">{[0, 1, 2].map(j => <div key={j} className="h-16 bg-gray-100 rounded-xl border border-gray-200" />)}</div>)}</div></div>}
            >
              <DataSourceCoverage language={language} />
            </LazySection>

            <LazySection
              className="w-full max-w-[1440px]"
              fallback={<div className="w-full animate-pulse py-8"><div className="h-6 w-48 bg-gray-200 rounded-lg mb-6 mx-auto" /><div className="h-40 bg-gray-100 rounded-2xl border border-gray-200" /></div>}
            >
              <HighlightShowcase language={language} />
            </LazySection>

            {/* 热门公开报告 */}
            <LazySection
              className="w-full max-w-[1440px] xl:px-10"
              fallback={<div className="w-full animate-pulse"><div className="h-6 w-36 bg-gray-200 rounded-lg mb-4" /><div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl border border-gray-200" />)}</div></div>}
            >
              <PopularReports language={language} />
            </LazySection>
          </>
        )}

        {/* Loading View */}
        {appState === AppState.ANALYZING && (
          <div className="flex-grow flex items-center justify-center w-full">
            {scanMode === 'flash' ? (
              <FlashThinkingIndicator
                language={language}
                query={idea}
                isDataReady={!!report && !!dualResult}
                streamProgress={streamProgress}
                onComplete={() => setAppState(AppState.REPORT)}
                onCancel={handleCancelAnalysis}
              />
            ) : (
              <ThinkingIndicator
                language={language}
                query={idea}
                isDataReady={!!report && !!dualResult}
                streamProgress={streamProgress}
                onComplete={() => setAppState(AppState.REPORT)}
                onCancel={handleCancelAnalysis}
              />
            )}
          </div>
        )}

        {/* 追问精化分析全屏进度 — 与第一轮分析完全一致的沉浸式体验 */}
        {isRefining && (
          <div className="flex-grow flex items-center justify-center w-full">
            <ThinkingIndicator
              language={language}
              query={refineTitle || idea}
              isDataReady={false}
              streamProgress={refineProgress}
            />
          </div>
        )}

        {/* Report View */}
        {appState === AppState.REPORT && report && dualResult && (
          <>
            {scanMode === 'flash' ? (
              <FlashReport
                report={report}
                onReset={handleReset}
                language={language}
                query={idea}
                dualResult={dualResult}
              />
            ) : (
              <>
                <AnalysisView
                  report={report}
                  onReset={handleReset}
                  language={language}
                  query={idea}
                  dualResult={dualResult}
                  onRetryAgent={handleRetryAgent}
                  onRetryAllFailed={handleRetryAllFailed}
                  onFullRetry={isLoggedIn ? handleFullRetry : undefined}
                  retryingAgents={retryingAgents}
                  retryProgress={retryProgress}
                />

                <div className="w-full max-w-5xl mt-6">
                  <FollowUpPanel
                    language={language}
                    questions={followUpQuestions}
                    isLoading={isFollowUpLoading}
                    isRefining={isRefining}
                    followUpRound={followUpRound}
                    onRefine={handleRefine}
                    refineProgress={refineProgress}
                    query={idea}
                    report={report}
                    dualResult={dualResult}
                  />
                </div>
              </>
            )}

            {/* 广告位 — 报告底部行内嵌入 */}
            <div className="w-full max-w-[1440px] xl:px-10 mt-6">            </div>
          </>
        )}
      </main>

      {/* SEO Footer — 仅在首页展示 */}
      {appState === AppState.INPUT && <SiteFooter language={language} />}


      <ErrorModal
        isOpen={!!errorInfo}
        onClose={() => setErrorInfo(null)}
        errorInfo={errorInfo}
        onRetry={handleAnalyze}
      />



      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        language={language}
      />

      {/* 新用户引导 */}
      {appState === AppState.INPUT && <OnboardingOverlay language={language} />}

      {/* 首次报告庆祝弹窗 */}
      <CelebrationModal
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        score={report?.noveltyScore}
        language={language}
      />

      <BottomTabBar />
    </div>
  );
}
