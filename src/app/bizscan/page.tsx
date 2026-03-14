'use client';

import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import BottomTabBar from '@/components/layout/BottomTabBar';
import BizscanForm from '@/components/bizscan/BizscanForm';
import BizscanAnalyzing from '@/components/bizscan/BizscanAnalyzing';
import BizscanReport from '@/components/bizscan/BizscanReport';
import OpenClawBridgeModal from '@/components/bizscan/OpenClawBridgeModal';
import ClawscanBridgeReport from '@/components/bizscan/ClawscanBridgeReport';
import { AppState, Language, ModelProvider } from '@/types';
import { ArrowLeft } from 'lucide-react';
import LoginModal from '@/components/auth/LoginModal';
import dynamic from 'next/dynamic';
const AdPlacement = dynamic(() => import('@/components/ads/AdPlacement'), { ssr: false });
import { createClient } from '@/utils/supabase/client';
import type { BizscanReport as BizscanReportType } from '@/types/bizscan';
import type { ClawscanReport as ClawscanReportType } from '@/types/clawscan';
import InnovationDNAMap from '@/components/innovation/InnovationDNAMap';

function BizscanPageInner() {
    const searchParams = useSearchParams();

    // 表单状态合并
    const [form, setForm] = useState({
        idea: '',
        targetMarket: '',
        businessModel: '',
        industryVertical: '',
    });

    // URL 参数预填充支持（从 Novoscan 跨产品推荐跳转）
    useEffect(() => {
        const ideaParam = searchParams.get('idea');
        const targetMarketParam = searchParams.get('targetMarket');
        const businessModelParam = searchParams.get('businessModel');
        const industryVerticalParam = searchParams.get('industryVertical');

        if (ideaParam || targetMarketParam || businessModelParam || industryVerticalParam) {
            setForm(prev => ({
                ...prev,
                idea: ideaParam || prev.idea,
                targetMarket: targetMarketParam || prev.targetMarket,
                businessModel: businessModelParam || prev.businessModel,
                industryVertical: industryVerticalParam || prev.industryVertical,
            }));
        }
    }, [searchParams]);
    const [appState, setAppState] = useState<AppState>(AppState.INPUT);
    const [language, setLanguage] = useState<'zh' | 'en'>('zh');

    const [reportData, setReportData] = useState<BizscanReportType | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [isPrivateMode, setIsPrivateMode] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [selectedModel, setSelectedModel] = useState<ModelProvider>('minimax');

    // 初始化：鉴权检查 + 读取用户首选模型偏好
    useEffect(() => {
        const initAuth = async () => {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                setAuthReady(true);

                if (!user) {
                    // 匿名用户：立即弹出登录提示
                    setShowLoginModal(true);
                    return;
                }

                // 已登录用户：读取首选模型偏好
                try {
                    const res = await fetch('/api/user-preferences');
                    const json = await res.json();
                    if (json.success && json.profile?.preferredModel) {
                        const validModels: ModelProvider[] = ['deepseek', 'minimax', 'moonshot'];
                        if (validModels.includes(json.profile.preferredModel)) {
                            setSelectedModel(json.profile.preferredModel as ModelProvider);
                        }
                    }
                } catch (e) {
                    console.warn('[Bizscan] 读取首选模型失败', e);
                }
            } catch (e) {
                console.warn('[Bizscan] 鉴权检查失败', e);
                setAuthReady(true);
            }
        };
        initAuth();
    }, []);

    // SSE 进度数据（传给 BizscanAnalyzing）
    const [sseProgress, setSseProgress] = useState<number>(0);
    const [sseLogs, setSseLogs] = useState<string[]>([]);
    const [sseStats, setSseStats] = useState<{ sourcesScanned?: number; competitorsFound?: number }>({});

    // ========== OpenClaw 交叉协作状态 ==========
    const [showOpenClawModal, setShowOpenClawModal] = useState(false);
    const [openclawKeywords, setOpenclawKeywords] = useState<string[]>([]);
    const [clawscanReport, setClawscanReport] = useState<ClawscanReportType | null>(null);
    const [isClawscanRunning, setIsClawscanRunning] = useState(false);

    // NovoDNA 状态
    const [novoDNA, setNovoDNA] = useState<any>(null);

    // 用于存储用户的 OpenClaw 选择（resolve 的 Promise 模式）
    const openclawResolveRef = useRef<((value: boolean) => void) | null>(null);

    /**
     * 启动 Clawscan 桥接评估 — 调用 /api/skill-check (mode=full)
     * 使用独立的 SSE 读取器，与 Bizscan 流互不干扰
     */
    const startClawscanBridge = useCallback(async (ideaText: string) => {
        setIsClawscanRunning(true);
        try {
            const response = await fetch('/api/skill-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: ideaText,
                    modelProvider: selectedModel,
                    privacyMode: isPrivateMode,
                    mode: 'full',
                }),
            });

            if (!response.ok) {
                console.warn('[Bizscan/Clawscan Bridge] HTTP 错误:', response.status);
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(line.slice(6));
                        if (event.type === 'evaluation_complete' && event.data) {
                            setClawscanReport(event.data);
                            console.log('[Bizscan/Clawscan Bridge] Clawscan 评估完成');
                        }
                    } catch { /* 忽略解析错误 */ }
                }
            }
        } catch (err) {
            console.warn('[Bizscan/Clawscan Bridge] 桥接评估异常:', err);
        } finally {
            setIsClawscanRunning(false);
        }
    }, [isPrivateMode]);

    const handleStartAnalysis = async () => {
        if (!form.idea.trim() || form.idea.trim().length < 50 || isAnalyzing || isLoading) return;

        // 立即给用户视觉反馈
        setIsLoading(true);
        setErrorMessage(null);

        try {
            // 登录及使用次数拦截逻辑（带超时保护）
            let user = null;
            try {
                const supabase = createClient();
                const authResult = await Promise.race([
                    supabase.auth.getUser(),
                    new Promise<{ data: { user: null } }>((resolve) =>
                        setTimeout(() => resolve({ data: { user: null } }), 5000)
                    ),
                ]);
                user = authResult.data.user;
            } catch (authErr) {
                console.warn('[Bizscan] 认证检查失败，跳过登录验证:', authErr);
            }

            if (!user) {
                const usedCount = parseInt(localStorage.getItem('novoscan_free_count') || '0', 10);
                if (usedCount >= 3) {
                    setShowLoginModal(true);
                    setIsLoading(false);
                    return;
                }
                localStorage.setItem('novoscan_free_count', String(usedCount + 1));
            }

            // 认证通过，进入分析状态
            setIsAnalyzing(true);
            setIsLoading(false);
            setAppState(AppState.ANALYZING);
            setReportData(null);
            setClawscanReport(null);
            setSseProgress(0);
            setSseLogs([]);
            setSseStats({});
            setNovoDNA(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });

            const response = await fetch('/api/bizscan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ideaDescription: form.idea,
                    targetMarket: form.targetMarket || undefined,
                    businessModel: form.businessModel || undefined,
                    industryVertical: form.industryVertical || undefined,
                    modelProvider: selectedModel,
                    privacyMode: isPrivateMode,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            // 读取 SSE 流
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(line.slice(6));

                        // ========== OpenClaw 交叉协作：检测到关联关键词 ==========
                        if (event.type === 'openclaw_detected' && event.data) {
                            const { keywords } = event.data;
                            setOpenclawKeywords(keywords);
                            setShowOpenClawModal(true);

                            const userChoice = await new Promise<boolean>((resolve) => {
                                openclawResolveRef.current = resolve;
                            });

                            if (userChoice) {
                                startClawscanBridge(form.idea);
                            }
                        }

                        // 捕获 SSE 进度和日志事件
                        if (event.type === 'agent_log' && event.data?.message) {
                            setSseLogs(prev => [...prev, event.data.message]);
                        }
                        if (event.type === 'progress' && typeof event.data?.percent === 'number') {
                            setSseProgress(event.data.percent);
                        }
                        if (event.type === 'data_gathered' && event.data) {
                            setSseStats({
                                sourcesScanned: event.data.sourcesCount || 0,
                                competitorsFound: event.data.competitorsCount || 0,
                            });
                        }

                        if (event.type === 'evaluation_complete' && event.data) {
                            setReportData(event.data);
                        }

                        // ═══ NovoDNA 创新基因图谱 ═══
                        if (event.type === 'novodna_complete' && event.data) {
                            setNovoDNA(event.data);
                        }

                        if (event.type === 'error') {
                            throw new Error(event.message || '评估失败');
                        }
                    } catch (parseErr: any) {
                        if (parseErr.message && parseErr.message !== '评估失败') {
                            console.warn('[Bizscan] SSE 解析警告:', parseErr.message);
                        } else {
                            throw parseErr;
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error('Bizscan Error:', error);
            setErrorMessage(error.message || '商业想法评估失败，请稍后重试');
            setAppState(AppState.INPUT);
        } finally {
            setIsAnalyzing(false);
            setIsLoading(false);
        }
    };

    // OpenClaw 弹窗：用户选择"是"
    const handleOpenClawConfirm = useCallback(() => {
        setShowOpenClawModal(false);
        openclawResolveRef.current?.(true);
        openclawResolveRef.current = null;
    }, []);

    // OpenClaw 弹窗：用户选择"否"
    const handleOpenClawCancel = useCallback(() => {
        setShowOpenClawModal(false);
        openclawResolveRef.current?.(false);
        openclawResolveRef.current = null;
    }, []);

    const handleAnalysisComplete = useCallback(() => {
        if (reportData) {
            setAppState(AppState.REPORT);
        }
    }, [reportData]);

    const handleReset = () => {
        setAppState(AppState.INPUT);
        setForm({ idea: '', targetMarket: '', businessModel: '', industryVertical: '' });
        setReportData(null);
        setClawscanReport(null);
        setNovoDNA(null);
        setOpenclawKeywords([]);
        setErrorMessage(null);
        setSseProgress(0);
        setSseLogs([]);
        setSseStats({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen relative flex flex-col text-gray-900 bg-transparent overflow-x-hidden max-w-[100vw] pb-20 lg:pb-0">
            {/* Antigravity 抽象背景球 — 静态渐变替代 blur+float 动画，零 GPU 开销 */}
            <div
                className="absolute inset-0 pointer-events-none -z-10"
                style={{
                    background: `
                        radial-gradient(ellipse 60% 50% at 10% 10%, rgba(251,191,36,0.10) 0%, transparent 70%),
                        radial-gradient(ellipse 50% 50% at 90% 35%, rgba(234,67,53,0.08) 0%, transparent 70%),
                        radial-gradient(ellipse 50% 40% at 35% 90%, rgba(66,133,244,0.08) 0%, transparent 70%)
                    `,
                }}
            />

            <Navbar language={language} setLanguage={(lang: Language) => setLanguage(lang)} />

            <main className="flex-grow flex flex-col items-center justify-start p-4 sm:p-6 relative z-10 w-full">

                {appState !== AppState.INPUT && (
                    <div className="w-full max-w-5xl mx-auto mb-6">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 text-gray-500 hover:text-amber-500 font-bold px-4 py-2 rounded-full hover:bg-white/95 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            重新评估
                        </button>
                    </div>
                )}

                {appState === AppState.INPUT && (
                    <>
                        {/* 内联错误提示面板 */}
                        {errorMessage && (
                            <div className="w-full max-w-4xl mx-auto mb-4 px-4 sm:px-6">
                                <div className="flex items-center gap-3 p-4 bg-red-50/80 rounded-2xl border border-red-100">
                                    <span className="text-red-500 text-sm font-bold flex-1">{errorMessage}</span>
                                    <button
                                        onClick={() => setErrorMessage(null)}
                                        className="text-red-400 hover:text-red-600 text-sm font-black px-2"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        )}
                        <BizscanForm
                            idea={form.idea}
                            setIdea={(v) => setForm(f => ({ ...f, idea: v }))}
                            targetMarket={form.targetMarket}
                            setTargetMarket={(v) => setForm(f => ({ ...f, targetMarket: v }))}
                            businessModel={form.businessModel}
                            setBusinessModel={(v) => setForm(f => ({ ...f, businessModel: v }))}
                            industryVertical={form.industryVertical}
                            setIndustryVertical={(v) => setForm(f => ({ ...f, industryVertical: v }))}
                            onSubmit={handleStartAnalysis}
                            isLoading={isLoading}
                            isPrivateMode={isPrivateMode}
                            onPrivacyToggle={() => setIsPrivateMode(prev => !prev)}
                            selectedModel={selectedModel}
                            setSelectedModel={setSelectedModel}
                        />
                        {/* 广告位 — Bizscan 表单下方 */}
                        <div className="w-full max-w-4xl mt-8">
                            <AdPlacement variant="card" language={language} />
                        </div>
                    </>
                )}

                {appState === AppState.ANALYZING && (
                    <BizscanAnalyzing
                        idea={form.idea}
                        isDataReady={!!reportData}
                        onComplete={handleAnalysisComplete}
                        sseProgress={sseProgress}
                        sseLogs={sseLogs}
                        sseStats={sseStats}
                    />
                )}

                {appState === AppState.REPORT && reportData && (
                    <>
                        <BizscanReport reportData={reportData} />

                        {/* Clawscan 交叉协作补充报告 */}
                        {clawscanReport && (
                            <ClawscanBridgeReport reportData={clawscanReport} />
                        )}

                        {/* NovoDNA 创新基因图谱 */}
                        {novoDNA && (
                            <div className="w-full max-w-5xl mx-auto mt-6">
                                <InnovationDNAMap data={novoDNA} />
                            </div>
                        )}

                        {/* Clawscan 桥接加载中提示 */}
                        {isClawscanRunning && !clawscanReport && (
                            <div className="w-full max-w-5xl mx-auto mt-6">
                                <div className="flex items-center gap-3 justify-center p-4 bg-blue-50/60 rounded-2xl border border-blue-100">
                                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm font-bold text-blue-600">
                                        Clawscan 交叉评估进行中...
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* 广告位 — Bizscan 报告底部 */}
                        <div className="w-full max-w-5xl mt-8">
                            <AdPlacement variant="inline" language={language} />
                        </div>
                    </>
                )}

            </main>

            <LoginModal
                isOpen={showLoginModal}
                onClose={() => {
                    setShowLoginModal(false);
                    // 匿名用户关闭弹窗时返回上一页
                    if (authReady) window.history.back();
                }}
                language={language}
            />

            {/* OpenClaw 桥接弹窗 */}
            <OpenClawBridgeModal
                isOpen={showOpenClawModal}
                keywords={openclawKeywords}
                onConfirm={handleOpenClawConfirm}
                onCancel={handleOpenClawCancel}
            />
            <BottomTabBar />
        </div>
    );
}

// Suspense 包裹以支持 useSearchParams
export default function BizscanPage() {
    return (
        <Suspense fallback={null}>
            <BizscanPageInner />
        </Suspense>
    );
}
