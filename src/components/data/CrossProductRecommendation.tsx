'use client';

/**
 * 跨产品智能推荐卡片组件
 *
 * 在 Novoscan 追问面板下方展示，智能推荐 Clawscan / Bizscan / Tracker / CaseVault。
 * - Bizscan 卡支持内联"追问增强"
 * - 全部卡片支持点击追踪
 * - 推荐理由基于分析结果动态调整
 */
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Shell, Lightbulb, ArrowRight, Sparkles, Loader2, ChevronRight, Zap, Radar, Map } from 'lucide-react';
import {
    matchCrossProductRecommendations,
    buildJumpUrl,
    trackRecommendationClick,
    BIZSCAN_MARKET_OPTIONS,
    BIZSCAN_STRATEGY_OPTIONS,
    type CrossProductRecommendation as Recommendation,
    type BizscanQuickOption,
    type ProductId,
} from '@/lib/crossProductMatcher';
import type { Language } from '@/types';

interface CrossProductRecommendationProps {
    query: string;
    report?: any;
    language: Language;
}

/** 产品主题颜色 */
const PRODUCT_THEMES: Record<ProductId, {
    gradient: string;
    border: string;
    bg: string;
    text: string;
    btnGradient: string;
    badge: string;
}> = {
    clawscan: {
        gradient: 'from-blue-500 to-indigo-600',
        border: 'border-blue-200/60',
        bg: 'bg-blue-50/40',
        text: 'text-blue-700',
        btnGradient: 'from-blue-500 to-indigo-600',
        badge: 'bg-blue-100 text-blue-700',
    },
    bizscan: {
        gradient: 'from-amber-500 to-orange-500',
        border: 'border-amber-200/60',
        bg: 'bg-amber-50/40',
        text: 'text-amber-700',
        btnGradient: 'from-amber-500 to-orange-500',
        badge: 'bg-amber-100 text-amber-700',
    },
    tracker: {
        gradient: 'from-emerald-500 to-teal-600',
        border: 'border-emerald-200/60',
        bg: 'bg-emerald-50/40',
        text: 'text-emerald-700',
        btnGradient: 'from-emerald-500 to-teal-600',
        badge: 'bg-emerald-100 text-emerald-700',
    },
    casevault: {
        gradient: 'from-violet-500 to-purple-600',
        border: 'border-violet-200/60',
        bg: 'bg-violet-50/40',
        text: 'text-violet-700',
        btnGradient: 'from-violet-500 to-purple-600',
        badge: 'bg-violet-100 text-violet-700',
    },
};

/** 产品图标 */
const PRODUCT_ICONS: Record<ProductId, React.ReactNode> = {
    clawscan: <Shell className="w-5 h-5 text-white" />,
    bizscan: <Lightbulb className="w-5 h-5 text-white" />,
    tracker: <Radar className="w-5 h-5 text-white" />,
    casevault: <Map className="w-5 h-5 text-white" />,
};

/** 产品跳转按钮文案 */
const PRODUCT_CTA: Record<ProductId, { zh: string; en: string }> = {
    clawscan: { zh: '前往评估', en: 'Go to Evaluate' },
    bizscan: { zh: '直接前往', en: 'Go Directly' },
    tracker: { zh: '开始监控', en: 'Start Monitoring' },
    casevault: { zh: '查看图谱', en: 'View Graph' },
};

export default function CrossProductRecommendationPanel({
    query,
    report,
    language,
}: CrossProductRecommendationProps) {
    const isZh = language === 'zh';
    const router = useRouter();
    const recommendations = useMemo(
        () => matchCrossProductRecommendations(query, report),
        [query, report]
    );

    if (recommendations.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-6"
        >
            {/* 标题行 */}
            <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-sm">
                    <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <h4 className="text-sm font-bold text-slate-700">
                    {isZh ? '🚀 探索更多 Novoscan 工具' : '🚀 Explore More Novoscan Tools'}
                </h4>
            </div>

            {/* 推荐卡片列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recommendations.map((rec, idx) => (
                    <motion.div
                        key={rec.productId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + idx * 0.15 }}
                    >
                        {rec.productId === 'bizscan' ? (
                            <BizscanCard rec={rec} query={query} report={report} isZh={isZh} router={router} />
                        ) : (
                            <SimpleCard rec={rec} query={query} isZh={isZh} router={router} />
                        )}
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}

// ==================== 通用推荐卡片（Clawscan/Tracker/CaseVault） ====================

function SimpleCard({ rec, query, isZh, router }: { rec: Recommendation; query: string; isZh: boolean; router: ReturnType<typeof useRouter> }) {
    const theme = PRODUCT_THEMES[rec.productId];
    const icon = PRODUCT_ICONS[rec.productId];
    const cta = PRODUCT_CTA[rec.productId];

    // 根据产品构建跳转参数
    const jumpParams: Record<string, string> = {};
    if (rec.productId === 'clawscan') {
        jumpParams.idea = query;
    } else if (rec.productId === 'casevault') {
        // CaseVault 用 industry 参数筛选
        // 暂不传参，直接跳转到图谱总览
    }
    // Tracker 不需要查询参数，直接跳到 dashboard
    const jumpUrl = Object.keys(jumpParams).length > 0
        ? buildJumpUrl(rec.baseUrl, jumpParams)
        : rec.baseUrl;

    const handleClick = () => {
        trackRecommendationClick(rec.productId, query, rec.strength, 'followup_panel');
        router.push(jumpUrl);
    };

    return (
        <div className={`relative rounded-2xl border-2 ${theme.border} ${theme.bg} p-4 hover:shadow-lg transition-all duration-300 group`}>
            {/* 装饰光效 */}
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${theme.gradient} opacity-5 rounded-full blur-2xl pointer-events-none`} />

            {/* 头部：图标 + 产品名 */}
            <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h5 className="font-bold text-slate-800 text-sm">{rec.productName}</h5>
                        {rec.strength >= 80 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${theme.badge}`}>
                                {isZh ? '强烈推荐' : 'Recommended'}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {isZh ? rec.reasonZh : rec.reasonEn}
                    </p>
                </div>
            </div>

            {/* 匹配关键词 */}
            {rec.matchedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                    {rec.matchedKeywords.map((kw, i) => (
                        <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full ${theme.badge} font-medium`}>
                            {kw}
                        </span>
                    ))}
                </div>
            )}

            {/* 跳转按钮 */}
            <button
                onClick={handleClick}
                className={`
                    flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                    bg-gradient-to-r ${theme.btnGradient} text-white
                    font-bold text-xs shadow-md
                    hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
                    transition-all duration-200
                `}
            >
                {isZh ? cta.zh : cta.en}
                <ArrowRight className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// ==================== Bizscan 增强卡片（含内联追问） ====================

function BizscanCard({ rec, query, report, isZh, router }: {
    rec: Recommendation;
    query: string;
    report?: any;
    isZh: boolean;
    router: ReturnType<typeof useRouter>;
}) {
    const theme = PRODUCT_THEMES.bizscan;
    const icon = PRODUCT_ICONS.bizscan;

    // 内联追问增强状态
    const [showEnhance, setShowEnhance] = useState(false);
    const [selectedMarket, setSelectedMarket] = useState<string>('');
    const [selectedStrategy, setSelectedStrategy] = useState<string>('');
    const [isEnhancing, setIsEnhancing] = useState(false);

    /** 直接跳转（不增强） */
    const handleDirectJump = () => {
        trackRecommendationClick('bizscan', query, rec.strength, 'followup_panel');
        const url = buildJumpUrl('/bizscan', { idea: query });
        router.push(url);
    };

    /** AI 增强后跳转 */
    const handleEnhanceAndJump = async () => {
        if (isEnhancing) return;
        setIsEnhancing(true);
        trackRecommendationClick('bizscan', query, rec.strength, 'inline_enhance');

        try {
            const marketLabel = BIZSCAN_MARKET_OPTIONS.find(o => o.id === selectedMarket)?.contextHint || '';
            const strategyLabel = BIZSCAN_STRATEGY_OPTIONS.find(o => o.id === selectedStrategy)?.contextHint || '';

            const res = await fetch('/api/cross-recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    summary: report?.arbitration?.summary || report?.summary || '',
                    marketOption: marketLabel,
                    strategyOption: strategyLabel,
                }),
            });

            const data = await res.json();
            if (data.success && data.enhancedIdea) {
                const url = buildJumpUrl('/bizscan', {
                    idea: data.enhancedIdea,
                    targetMarket: data.targetMarket || '',
                    businessModel: data.businessModel || '',
                    industryVertical: data.industryVertical || '',
                });
                router.push(url);
            } else {
                // 回退
                const url = buildJumpUrl('/bizscan', { idea: query });
                router.push(url);
            }
        } catch (err) {
            console.warn('[CrossRecommend] AI 增强失败，直接跳转:', err);
            const url = buildJumpUrl('/bizscan', { idea: query });
            router.push(url);
        } finally {
            setIsEnhancing(false);
        }
    };

    const hasSelection = selectedMarket || selectedStrategy;

    return (
        <div className={`relative rounded-2xl border-2 ${theme.border} ${theme.bg} p-4 hover:shadow-lg transition-all duration-300 overflow-hidden`}>
            {/* 装饰光效 */}
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${theme.gradient} opacity-5 rounded-full blur-2xl pointer-events-none`} />

            {/* 头部 */}
            <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-slate-800 text-sm">{rec.productName}</h5>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {isZh ? rec.reasonZh : rec.reasonEn}
                    </p>
                </div>
            </div>

            {/* 操作区 */}
            <div className="flex gap-2 mb-2">
                <button
                    onClick={handleDirectJump}
                    className={`
                        flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                        border-2 border-amber-200 text-amber-700
                        font-bold text-xs
                        hover:bg-amber-100/60 active:scale-[0.98]
                        transition-all duration-200
                    `}
                >
                    {isZh ? '直接前往' : 'Go Directly'}
                    <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                    onClick={() => setShowEnhance(!showEnhance)}
                    className={`
                        flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                        font-bold text-xs transition-all duration-200
                        bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md
                        hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
                    `}
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isZh ? 'AI 增强商业想法' : 'AI Enhance Idea'}
                </button>
            </div>

            {/* 内联增强面板 */}
            <AnimatePresence>
                {showEnhance && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-amber-200/60 pt-3 mt-1">
                            {/* 市场方向选择 */}
                            <p className="text-[11px] font-bold text-slate-500 mb-1.5">
                                {isZh ? '📌 目标市场方向' : '📌 Target Market'}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {BIZSCAN_MARKET_OPTIONS.map(opt => (
                                    <OptionChip
                                        key={opt.id}
                                        option={opt}
                                        isSelected={selectedMarket === opt.id}
                                        isZh={isZh}
                                        onClick={() => setSelectedMarket(
                                            selectedMarket === opt.id ? '' : opt.id
                                        )}
                                    />
                                ))}
                            </div>

                            {/* 策略方向选择 */}
                            <p className="text-[11px] font-bold text-slate-500 mb-1.5">
                                {isZh ? '🎯 商业策略方向' : '🎯 Business Strategy'}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {BIZSCAN_STRATEGY_OPTIONS.map(opt => (
                                    <OptionChip
                                        key={opt.id}
                                        option={opt}
                                        isSelected={selectedStrategy === opt.id}
                                        isZh={isZh}
                                        onClick={() => setSelectedStrategy(
                                            selectedStrategy === opt.id ? '' : opt.id
                                        )}
                                    />
                                ))}
                            </div>

                            {/* AI 增强 + 跳转按钮 */}
                            <button
                                onClick={handleEnhanceAndJump}
                                disabled={!hasSelection || isEnhancing}
                                className={`
                                    w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                                    font-bold text-xs transition-all duration-200
                                    ${(hasSelection && !isEnhancing)
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    }
                                `}
                            >
                                {isEnhancing ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        {isZh ? 'AI 正在生成增强商业想法...' : 'AI Generating Enhanced Idea...'}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-3.5 h-3.5" />
                                        {isZh
                                            ? (hasSelection ? 'AI 生成并前往 Bizscan' : '请先选择至少一个方向')
                                            : (hasSelection ? 'AI Generate & Go to Bizscan' : 'Select at least one option')
                                        }
                                        {hasSelection && <ArrowRight className="w-3.5 h-3.5" />}
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ==================== 选项标签芯片 ====================

function OptionChip({ option, isSelected, isZh, onClick }: {
    option: BizscanQuickOption;
    isSelected: boolean;
    isZh: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold
                border transition-all duration-200
                ${isSelected
                    ? 'bg-amber-100 border-amber-400 text-amber-800 shadow-sm scale-[1.03]'
                    : 'bg-white/95 border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50/60'
                }
            `}
        >
            <span>{option.icon}</span>
            <span>{isZh ? option.labelZh : option.labelEn}</span>
        </button>
    );
}
