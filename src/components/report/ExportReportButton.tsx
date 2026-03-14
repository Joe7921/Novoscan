'use client';

/**
 * 导出专业报告按钮组件 — 情绪价值升级版
 *
 * 点击后调用报告撰写 Agent 生成专业报告，然后导出为 PDF。
 * 包含：全屏生成动画（粒子 + 多阶段文案 + 伪进度条）、
 *       成功庆祝动画、失败温和引导、按钮微交互。
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FileDown, Loader2, Check, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import type { Language } from '@/types';

/* ================================================================
   多阶段提示文案 — 让用户感知进展
   ================================================================ */
const STAGE_MESSAGES_ZH = [
    { text: '正在综合 4 位 AI 专家的分析结果…', sub: '聚合学术、产业、竞品、创新维度' },
    { text: '正在构建科研论文结构…', sub: '生成摘要、方法论、核心发现' },
    { text: '正在提炼核心发现与数据…', sub: '评分明细、数据底层画像、相似文献' },
    { text: '正在精炼行文与排版…', sub: '即将完成，请稍候片刻' },
];
const STAGE_MESSAGES_EN = [
    { text: 'Synthesizing insights from 4 AI Experts…', sub: 'Academic, Industry, Competitor, Innovation' },
    { text: 'Structuring as academic paper…', sub: 'Abstract, methodology, key findings' },
    { text: 'Distilling core discoveries & data…', sub: 'Score breakdown, data profile, benchmarks' },
    { text: 'Polishing prose & layout…', sub: 'Almost there, hang tight' },
];

/* ================================================================
   CSS 动画样式 — 内联注入到 Portal
   ================================================================ */
const overlayStyles = `
  /* ---- 粒子浮动 ---- */
  @keyframes floatParticle {
    0%   { transform: translateY(0) scale(1); opacity: 0; }
    10%  { opacity: 0.7; }
    90%  { opacity: 0.5; }
    100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
  }
  .novo-particle {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    animation: floatParticle linear infinite;
  }

  /* ---- 脉冲扩散波纹 ---- */
  @keyframes pulseRing {
    0%   { transform: scale(0.8); opacity: 0.6; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  .novo-pulse-ring {
    position: absolute;
    border-radius: 50%;
    border: 2px solid rgba(129, 140, 248, 0.5);
    animation: pulseRing 2.5s ease-out infinite;
  }

  /* ---- 进度条发光拖尾 ---- */
  @keyframes progressGlow {
    0%   { box-shadow: 0 0 8px rgba(99,102,241,0.4); }
    50%  { box-shadow: 0 0 20px rgba(139,92,246,0.6); }
    100% { box-shadow: 0 0 8px rgba(99,102,241,0.4); }
  }

  /* ---- 成功弹性入场 ---- */
  @keyframes bounceIn {
    0%   { transform: scale(0); opacity: 0; }
    50%  { transform: scale(1.2); }
    70%  { transform: scale(0.9); }
    100% { transform: scale(1); opacity: 1; }
  }

  /* ---- 上升光点 (庆祝) ---- */
  @keyframes riseAndFade {
    0%   { transform: translateY(0) scale(1); opacity: 0.9; }
    100% { transform: translateY(-120px) scale(0.2); opacity: 0; }
  }

  /* ---- 按钮 shimmer 光效 ---- */
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
`;

/* ================================================================
   粒子配置
   ================================================================ */
const PARTICLES = [
    { size: 4, left: '12%', bottom: '-5%', duration: 7, delay: 0, color: 'rgba(129,140,248,0.6)' },
    { size: 6, left: '28%', bottom: '-8%', duration: 9, delay: 1.5, color: 'rgba(167,139,250,0.5)' },
    { size: 3, left: '45%', bottom: '-3%', duration: 6, delay: 0.8, color: 'rgba(99,102,241,0.7)' },
    { size: 5, left: '62%', bottom: '-6%', duration: 8, delay: 2.2, color: 'rgba(192,132,252,0.5)' },
    { size: 4, left: '78%', bottom: '-4%', duration: 7.5, delay: 3, color: 'rgba(129,140,248,0.6)' },
    { size: 3, left: '90%', bottom: '-7%', duration: 6.5, delay: 1, color: 'rgba(139,92,246,0.5)' },
    { size: 5, left: '5%', bottom: '-9%', duration: 10, delay: 4, color: 'rgba(99,102,241,0.4)' },
    { size: 4, left: '55%', bottom: '-2%', duration: 8.5, delay: 2.8, color: 'rgba(167,139,250,0.6)' },
];

/* ================================================================
   庆祝光点配置
   ================================================================ */
const CELEBRATION_DOTS = [
    { left: '30%', delay: 0, color: '#818cf8', size: 8 },
    { left: '45%', delay: 0.15, color: '#a78bfa', size: 6 },
    { left: '60%', delay: 0.3, color: '#6366f1', size: 7 },
    { left: '38%', delay: 0.1, color: '#c084fc', size: 5 },
    { left: '68%', delay: 0.25, color: '#818cf8', size: 6 },
    { left: '52%', delay: 0.35, color: '#a78bfa', size: 9 },
    { left: '25%', delay: 0.2, color: '#6366f1', size: 5 },
    { left: '72%', delay: 0.05, color: '#c084fc', size: 7 },
];

/* ================================================================
   全屏遮罩 — Generating 状态
   ================================================================ */
const GeneratingOverlay = ({ isZh }: { isZh: boolean }) => {
    const [stageIdx, setStageIdx] = useState(0);
    const [progress, setProgress] = useState(0);
    const stages = isZh ? STAGE_MESSAGES_ZH : STAGE_MESSAGES_EN;

    useEffect(() => {
        // 多阶段文案切换
        const timer = setInterval(() => {
            setStageIdx(prev => (prev < stages.length - 1 ? prev + 1 : prev));
        }, 12000);
        return () => clearInterval(timer);
    }, [stages.length]);

    useEffect(() => {
        // 伪进度条：快→慢→极慢
        const timer = setInterval(() => {
            setProgress(prev => {
                if (prev < 30) return prev + 1.2;
                if (prev < 60) return prev + 0.6;
                if (prev < 85) return prev + 0.2;
                if (prev < 92) return prev + 0.05;
                return prev;
            });
        }, 300);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/70 transition-all duration-500">
            <style>{overlayStyles}</style>

            {/* 浮动粒子 */}
            {PARTICLES.map((p, i) => (
                <div
                    key={i}
                    className="novo-particle"
                    style={{
                        width: p.size,
                        height: p.size,
                        left: p.left,
                        bottom: p.bottom,
                        background: p.color,
                        animationDuration: `${p.duration}s`,
                        animationDelay: `${p.delay}s`,
                    }}
                />
            ))}

            {/* 中心引力核 */}
            <div className="relative w-80 h-80 flex flex-col items-center justify-center">
                {/* 背景发光 */}
                <div className="absolute inset-0 bg-indigo-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '3s' }} />

                {/* 脉冲扩散波纹 */}
                <div className="novo-pulse-ring" style={{ width: 120, height: 120, top: '50%', left: '50%', marginTop: -60, marginLeft: -60 }} />
                <div className="novo-pulse-ring" style={{ width: 120, height: 120, top: '50%', left: '50%', marginTop: -60, marginLeft: -60, animationDelay: '0.8s' }} />
                <div className="novo-pulse-ring" style={{ width: 120, height: 120, top: '50%', left: '50%', marginTop: -60, marginLeft: -60, animationDelay: '1.6s' }} />

                {/* 外环轨道 */}
                <div className="absolute w-44 h-44 rounded-full border border-indigo-500/25 border-t-indigo-400 border-b-purple-500/40 animate-[spin_4s_linear_infinite]" />
                <div className="absolute w-36 h-36 rounded-full border border-purple-500/15 border-l-purple-400 animate-[spin_2.5s_linear_infinite_reverse]" />
                <div className="absolute w-28 h-28 rounded-full border border-indigo-400/20 border-r-indigo-300 animate-[spin_3s_linear_infinite]" />

                {/* 核心球体 */}
                <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-[0_0_40px_rgba(99,102,241,0.5)] animate-pulse" style={{ animationDuration: '2s' }}>
                    <Sparkles className="text-white w-8 h-8 animate-bounce" style={{ animationDuration: '2.5s' }} />
                </div>
            </div>

            {/* 文案信息区 */}
            <div className="relative z-10 text-center -mt-8 max-w-md px-6">
                {/* 主标题 — 带渐变描边效果 */}
                <h3
                    className="text-xl font-bold bg-gradient-to-r from-indigo-200 via-purple-200 to-white gradient-text-clip text-indigo-200 mb-4 tracking-wide transition-all duration-700"
                    key={stageIdx}
                >
                    {stages[stageIdx].text}
                </h3>

                {/* 副标题 */}
                <p className="text-indigo-300/80 text-sm font-medium mb-6 transition-all duration-700" key={`sub-${stageIdx}`}>
                    {stages[stageIdx].sub}
                </p>

                {/* 进度条 */}
                <div className="w-full max-w-xs mx-auto">
                    <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden border border-indigo-500/20">
                        <div
                            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 rounded-full transition-all duration-500 ease-out"
                            style={{
                                width: `${progress}%`,
                                animation: 'progressGlow 2s ease-in-out infinite',
                            }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-[11px] text-slate-500">
                        <span>{isZh ? 'NovaScan AI 报告引擎' : 'NovaScan AI Report Engine'}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                </div>

                {/* 底部提示 */}
                <p className="text-slate-500 text-xs mt-5 leading-relaxed">
                    {isZh
                        ? '预计需要 45-60 秒 · 正在综合 4 位 AI 专家的平行分析并提炼核心发现'
                        : '~45-60s · Synthesizing parallel analysis from 4 AI experts and distilling key findings'}
                </p>
            </div>
        </div>
    );
};

/* ================================================================
   全屏遮罩 — Success 庆祝状态
   ================================================================ */
const SuccessOverlay = ({ isZh, onDone }: { isZh: boolean; onDone: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onDone, 2500);
        return () => clearTimeout(timer);
    }, [onDone]);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/60 transition-all duration-500">
            <style>{overlayStyles}</style>

            {/* 庆祝上升光点 */}
            {CELEBRATION_DOTS.map((dot, i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        left: dot.left,
                        top: '55%',
                        width: dot.size,
                        height: dot.size,
                        borderRadius: '50%',
                        background: dot.color,
                        animation: `riseAndFade 1.8s ease-out ${dot.delay}s forwards`,
                        opacity: 0,
                    }}
                />
            ))}

            {/* 中心成功图标 */}
            <div
                className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.4)]"
                style={{ animation: 'bounceIn 0.6s ease-out forwards' }}
            >
                <Check className="text-white w-12 h-12" strokeWidth={3} />
            </div>

            {/* 文案 */}
            <div className="text-center mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-200 via-white to-emerald-200 gradient-text-clip text-emerald-200 mb-2">
                    {isZh ? '🎉 报告已生成！' : '🎉 Report Generated!'}
                </h3>
                <p className="text-emerald-300/70 text-sm">
                    {isZh ? '正在为您下载 PDF…' : 'Downloading PDF for you…'}
                </p>
            </div>
        </div>
    );
};

/* ================================================================
   全屏遮罩 — Error 温和提示
   ================================================================ */
const ErrorOverlay = ({ isZh, errorMsg, onRetry, onDismiss }: {
    isZh: boolean;
    errorMsg: string;
    onRetry: () => void;
    onDismiss: () => void;
}) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-950/60 transition-all duration-500">
            <style>{overlayStyles}</style>

            {/* 图标 */}
            <div
                className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.3)]"
                style={{ animation: 'bounceIn 0.5s ease-out forwards' }}
            >
                <AlertCircle className="text-white w-10 h-10" />
            </div>

            {/* 文案 */}
            <div className="text-center mt-6 max-w-sm px-6">
                <h3 className="text-lg font-bold text-amber-200 mb-2">
                    {isZh ? '生成未成功' : 'Generation Failed'}
                </h3>
                <p className="text-slate-400 text-sm mb-5 leading-relaxed">
                    {errorMsg || (isZh ? '网络波动或服务繁忙，请稍后重试' : 'Network issue or service busy, please retry')}
                </p>

                {/* 操作按钮 */}
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={onRetry}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold hover:from-indigo-600 hover:to-purple-600 shadow-md hover:shadow-lg transition-all duration-300"
                    >
                        <RefreshCw size={14} />
                        {isZh ? '重试' : 'Retry'}
                    </button>
                    <button
                        onClick={onDismiss}
                        className="px-4 py-2 rounded-xl text-slate-400 text-sm hover:text-white transition-colors"
                    >
                        {isZh ? '关闭' : 'Dismiss'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ================================================================
   主按钮组件
   ================================================================ */
interface ExportReportButtonProps {
    query: string;
    report: any;
    dualResult: any;
    language: Language;
    modelProvider?: string;
    size?: 'sm' | 'md';
    variant?: 'primary' | 'outline';
}

type ExportState = 'idle' | 'generating' | 'success' | 'error';

const ExportReportButton: React.FC<ExportReportButtonProps> = ({
    query,
    report,
    dualResult,
    language,
    modelProvider = 'minimax',
    size = 'md',
    variant = 'primary',
}) => {
    const [state, setState] = useState<ExportState>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [mounted, setMounted] = useState(false);
    const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
    const [showErrorOverlay, setShowErrorOverlay] = useState(false);
    const isZh = language === 'zh';
    const exportRef = useRef<() => Promise<void>>();

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleExport = useCallback(async () => {
        if (state === 'generating') return;

        setState('generating');
        setErrorMsg('');
        setShowSuccessOverlay(false);
        setShowErrorOverlay(false);

        try {
            // 精简数据：只保留报告撰写 Agent 需要的关键字段，避免请求体超过 Next.js 1MB 限制
            const trimmedDualResult = dualResult ? {
                academic: dualResult.academic ? {
                    ...dualResult.academic,
                    results: (dualResult.academic.results || []).slice(0, 10),
                } : undefined,
                industry: dualResult.industry ? {
                    ...dualResult.industry,
                    webResults: (dualResult.industry.webResults || []).slice(0, 10),
                    githubRepos: (dualResult.industry.githubRepos || []).slice(0, 10),
                    wechatArticles: (dualResult.industry.wechatArticles || []).slice(0, 5),
                } : undefined,
                crossValidation: dualResult.crossValidation,
                finalCredibility: dualResult.finalCredibility || dualResult.credibility,
                recommendation: dualResult.recommendation,
            } : undefined;

            const res = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    report,
                    dualResult: trimmedDualResult,
                    language,
                    modelProvider,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `API error: ${res.status}`);
            }

            const data = await res.json();
            if (!data.success || !data.report) {
                throw new Error('Invalid response from report API');
            }

            const { exportReportAsPDF } = await import('@/lib/services/export/pdfGenerator');
            exportReportAsPDF(data.report);

            setState('success');
            setShowSuccessOverlay(true);

            // 如果命中缓存，在控制台记录（生成速度已从 45-120s 降至毫秒级）
            if (data.fromCache) {
                console.log('[ExportReportButton] 命中预生成报告缓存，秒级导出');
            }

        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : 'Export failed';
            console.error('[ExportReportButton] Export failed:', err);
            setErrorMsg(errMessage);
            setState('error');
            setShowErrorOverlay(true);
        }
    }, [state, query, report, dualResult, language, modelProvider]);

    // 存储引用以供重试
    exportRef.current = handleExport;

    const handleRetry = useCallback(() => {
        setShowErrorOverlay(false);
        setState('idle');
        // 延迟一帧后重试
        requestAnimationFrame(() => {
            exportRef.current?.();
        });
    }, []);

    const handleDismissError = useCallback(() => {
        setShowErrorOverlay(false);
        setState('idle');
    }, []);

    const handleSuccessDone = useCallback(() => {
        setShowSuccessOverlay(false);
        setState('idle');
    }, []);

    const sizeClasses = size === 'sm'
        ? 'px-3 py-1.5 text-xs gap-1.5'
        : 'px-4 py-2 text-sm gap-2';

    // 按钮变体样式
    const getVariantClasses = () => {
        if (variant === 'primary') {
            if (state === 'generating') return 'bg-indigo-400 text-white cursor-wait';
            if (state === 'success') return 'bg-emerald-500 text-white';
            if (state === 'error') return 'bg-amber-500 text-white';
            return 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600 shadow-md hover:shadow-lg';
        }
        // outline
        if (state === 'generating') return 'border border-indigo-300 text-indigo-400 cursor-wait bg-white/50';
        if (state === 'success') return 'border border-emerald-300 text-emerald-600 bg-emerald-50';
        if (state === 'error') return 'border border-amber-300 text-amber-600 bg-amber-50';
        return 'border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 bg-white/60';
    };

    const renderContent = () => {
        switch (state) {
            case 'generating':
                return (
                    <>
                        <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" />
                        {isZh ? 'AI撰写中…' : 'Generating…'}
                    </>
                );
            case 'success':
                return (
                    <>
                        <Check size={size === 'sm' ? 14 : 16} />
                        {isZh ? '已生成' : 'Done'}
                    </>
                );
            case 'error':
                return (
                    <>
                        <AlertCircle size={size === 'sm' ? 14 : 16} />
                        {isZh ? '重试' : 'Retry'}
                    </>
                );
            default:
                return (
                    <>
                        <FileDown size={size === 'sm' ? 14 : 16} />
                        {isZh ? '导出报告' : 'Export Report'}
                    </>
                );
        }
    };

    return (
        <div className="relative inline-block group">
            <button
                onClick={state === 'error' ? handleRetry : handleExport}
                disabled={state === 'generating'}
                className={`
                    inline-flex items-center font-semibold rounded-xl
                    transition-all duration-300 whitespace-nowrap
                    ${sizeClasses}
                    ${getVariantClasses()}
                    disabled:opacity-70
                `}
                style={
                    state === 'idle' && variant === 'primary'
                        ? {
                            backgroundSize: '200% auto',
                            animation: 'shimmer 3s linear infinite',
                            backgroundImage: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 25%, #a78bfa 50%, #8b5cf6 75%, #6366f1 100%)',
                        }
                        : undefined
                }
                title={isZh ? '一键导出专业 PDF 报告' : 'Export as professional PDF report'}
            >
                {renderContent()}
            </button>

            {/* 按钮 tooltip（仅 idle 时鼠标悬停显示） */}
            {state === 'idle' && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-slate-800 text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-lg">
                    {isZh ? '由 AI 撰写专业 PDF，约 45-60 秒' : 'AI writes a professional PDF, ~45-60s'}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
                </div>
            )}

            {/* ========== Portal 遮罩层 ========== */}
            {mounted && state === 'generating' && createPortal(
                <GeneratingOverlay isZh={isZh} />,
                document.body
            )}
            {mounted && showSuccessOverlay && createPortal(
                <SuccessOverlay isZh={isZh} onDone={handleSuccessDone} />,
                document.body
            )}
            {mounted && showErrorOverlay && createPortal(
                <ErrorOverlay
                    isZh={isZh}
                    errorMsg={errorMsg}
                    onRetry={handleRetry}
                    onDismiss={handleDismissError}
                />,
                document.body
            )}

            <style>{overlayStyles}</style>
        </div>
    );
};

export default React.memo(ExportReportButton);