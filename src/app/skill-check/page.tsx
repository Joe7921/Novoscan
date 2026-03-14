'use client';

import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import BottomTabBar from '@/components/layout/BottomTabBar';
import SkillCheckForm from '@/components/skill-check/SkillCheckForm';
import type { ClawscanMode } from '@/components/skill-check/SkillCheckForm';
import SkillCheckAnalyzing from '@/components/skill-check/SkillCheckAnalyzing';
import SkillCheckReport from '@/components/skill-check/SkillCheckReport';
import { AppState, Language, ModelProvider } from '@/types';
import { ArrowLeft } from 'lucide-react';
import LoginModal from '@/components/auth/LoginModal';
import dynamic from 'next/dynamic';
const AdPlacement = dynamic(() => import('@/components/ads/AdPlacement'), { ssr: false });
import { createClient } from '@/utils/supabase/client';
import InnovationDNAMap from '@/components/innovation/InnovationDNAMap';

function SkillCheckPageInner() {
    const searchParams = useSearchParams();
    const [appState, setAppState] = useState<AppState>(AppState.INPUT);
    const [idea, setIdea] = useState('');

    // URL 参数预填充支持（从 Novoscan 跨产品推荐跳转）
    useEffect(() => {
        const ideaParam = searchParams.get('idea');
        if (ideaParam) {
            setIdea(ideaParam);
        }
    }, [searchParams]);
    const [language, setLanguage] = useState<'zh' | 'en'>('zh');

    const [reportData, setReportData] = useState<any>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [isPrivateMode, setIsPrivateMode] = useState(false);
    const [scanMode, setScanMode] = useState<ClawscanMode>('registry');
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
                    console.warn('[SkillCheck] 读取首选模型失败', e);
                }
            } catch (e) {
                console.warn('[SkillCheck] 鉴权检查失败', e);
                setAuthReady(true);
            }
        };
        initAuth();
    }, []);

    // SSE 实时数据
    const [sseProgress, setSseProgress] = useState(0);
    const [sseLogs, setSseLogs] = useState<string[]>([]);
    const [ssePhase, setSsePhase] = useState<string>('');
    const [sseMessage, setSseMessage] = useState<string>('');
    const [parsedIdea, setParsedIdea] = useState<any>(null);
    const [dataGathered, setDataGathered] = useState<any>(null);
    const readerRef = useRef<ReadableStreamDefaultReader | null>(null);

    // NovoDNA 状态
    const [novoDNA, setNovoDNA] = useState<any>(null);

    const addLog = useCallback((msg: string) => {
        setSseLogs(prev => [...prev.slice(-50), msg]);
    }, []);

    const handleStartAnalysis = async () => {
        if (!idea.trim() || isAnalyzing) return;

        // 登录拦截
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            const usedCount = parseInt(localStorage.getItem('novoscan_free_count') || '0', 10);
            if (usedCount >= 3) {
                setShowLoginModal(true);
                return;
            }
            localStorage.setItem('novoscan_free_count', String(usedCount + 1));
        }

        // 重置状态
        setIsAnalyzing(true);
        setAppState(AppState.ANALYZING);
        setReportData(null);
        setSseProgress(0);
        setSseLogs([]);
        setSsePhase('');
        setSseMessage('');
        setParsedIdea(null);
        setDataGathered(null);
        setNovoDNA(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            const response = await fetch('/api/skill-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: idea,
                    modelProvider: selectedModel,
                    privacyMode: isPrivateMode,
                    mode: scanMode,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('无法读取响应流');
            readerRef.current = reader;

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
                        handleSSEEvent(event);
                    } catch { /* 忽略解析错误 */ }
                }
            }
        } catch (error) {
            console.error('Clawscan Error:', error);
            alert('查重失败，请稍后重试');
            setAppState(AppState.INPUT);
        } finally {
            setIsAnalyzing(false);
            readerRef.current = null;
        }
    };

    const handleSSEEvent = useCallback((event: any) => {
        switch (event.type) {
            case 'progress':
                setSseProgress(event.progress || 0);
                setSsePhase(event.phase || '');
                setSseMessage(event.message || '');
                break;

            case 'idea_parsed':
                setParsedIdea(event.data);
                setSseProgress(event.progress || 20);
                addLog('[系统] 想法解析完成');
                break;

            case 'data_gathered':
                setDataGathered(event.data);
                setSseProgress(event.progress || 45);
                addLog(`[系统] 数据采集完成: Registry=${event.data?.registryCount || 0}, Web=${event.data?.webCasesCount || 0}, GH=${event.data?.githubCount || 0}`);
                break;

            case 'agent_log':
                addLog(event.message || '');
                break;

            case 'agent_state':
                // 可用于 UI 展示 Agent 状态
                break;

            case 'evaluation_complete':
                setReportData(event.data);
                setSseProgress(100);
                addLog('[系统] 评估完成');
                // 延迟一点再切到报告页，让用户看到 100%
                setTimeout(() => setAppState(AppState.REPORT), 800);
                break;

            case 'error':
                addLog(`[错误] ${event.message}`);
                alert(`评估出错: ${event.message}`);
                setAppState(AppState.INPUT);
                break;

            case 'novodna_complete':
                setNovoDNA(event.data);
                addLog('[NovoDNA] 创新基因图谱生成完成');
                break;
        }
    }, [addLog]);

    const handleReset = () => {
        setAppState(AppState.INPUT);
        setIdea('');
        setReportData(null);
        setNovoDNA(null);
        setSseLogs([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen relative flex flex-col text-gray-900 bg-transparent overflow-x-hidden max-w-[100vw] pb-20 lg:pb-0">
            {/* Antigravity Abstract Orbs — 静态渐变替代 blur+float 动画，零 GPU 开销 */}
            <div
                className="absolute inset-0 pointer-events-none -z-10"
                style={{
                    background: `
                        radial-gradient(ellipse 60% 50% at 10% 10%, rgba(66,133,244,0.10) 0%, transparent 70%),
                        radial-gradient(ellipse 50% 50% at 90% 35%, rgba(234,67,53,0.08) 0%, transparent 70%),
                        radial-gradient(ellipse 50% 40% at 35% 90%, rgba(251,188,5,0.08) 0%, transparent 70%)
                    `,
                }}
            />

            <Navbar language={language} setLanguage={(lang: Language) => setLanguage(lang)} />

            <main className="flex-grow flex flex-col items-center justify-start p-4 sm:p-6 relative z-10 w-full">

                {appState !== AppState.INPUT && (
                    <div className="w-full max-w-5xl mx-auto mb-6">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 text-gray-500 hover:text-google-blue font-bold px-4 py-2 rounded-full hover:bg-white/50 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            重新查重
                        </button>
                    </div>
                )}

                {appState === AppState.INPUT && (
                    <>
                        <SkillCheckForm
                            idea={idea}
                            setIdea={setIdea}
                            onSubmit={handleStartAnalysis}
                            isPrivateMode={isPrivateMode}
                            onPrivacyToggle={() => setIsPrivateMode(prev => !prev)}
                            mode={scanMode}
                            onModeChange={setScanMode}
                            selectedModel={selectedModel}
                            setSelectedModel={setSelectedModel}
                        />
                        {/* 广告位 — Clawscan 表单下方 */}
                        <div className="w-full max-w-3xl mt-8">
                            <AdPlacement variant="card" language={language} />
                        </div>
                    </>
                )}

                {appState === AppState.ANALYZING && (
                    <SkillCheckAnalyzing
                        idea={idea}
                        isDataReady={!!reportData}
                        onComplete={() => { }}
                        sseProgress={sseProgress}
                        sseLogs={sseLogs}
                        ssePhase={ssePhase}
                        sseMessage={sseMessage}
                    />
                )}

                {appState === AppState.REPORT && reportData && (
                    <>
                        <SkillCheckReport reportData={reportData} />

                        {/* NovoDNA 创新基因图谱 */}
                        {novoDNA && (
                            <div className="w-full max-w-5xl mx-auto mt-6">
                                <InnovationDNAMap data={novoDNA} />
                            </div>
                        )}

                        {/* 广告位 — 查重报告底部 */}
                        <div className="w-full max-w-5xl mt-6">
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
                    if (authReady && !showLoginModal) return;
                    window.history.back();
                }}
                language={language}
            />
            <BottomTabBar />
        </div>
    );
}

// Suspense 包裹以支持 useSearchParams
export default function SkillCheckPage() {
    return (
        <Suspense fallback={null}>
            <SkillCheckPageInner />
        </Suspense>
    );
}
