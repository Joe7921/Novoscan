import React, { useEffect, useState, useRef } from 'react';
import { Gem, Flame, Compass, Lightbulb, Search, Info, TrendingUp } from 'lucide-react';
import { Language } from '@/types';
import AntigravityCard from '@/components/antigravity/AntigravityCard';
import { ScoreTooltip } from '@/components/report/ScoreTooltip';
import InnovationTrendCharts from '@/components/innovation/InnovationTrendCharts';
import SpotlightTrend from '@/components/discovery/SpotlightTrend';
import InnovationDetailModal from '@/components/innovation/InnovationDetailModal';
import { motion } from 'framer-motion';

type ViewMode = 'novelty' | 'trending' | 'hidden' | 'rising';

interface TrendingInnovationsProps {
    language: Language;
    onKeywordClick?: (keyword: string) => void;
}

import { getDomainDisplayInfo, DOMAIN_REGISTRY } from '@/lib/constants/domains';

const FEATURED_DOMAINS = ['ALL', 'ENG', 'SCI', 'MED', 'SOC'] as const;

// 为了兼容头部筛选按钮逻辑，临时构建一个带"全部"的类目表
const DOMAIN_LABELS: Record<string, { en: string; zh: string }> = {
    ALL: { en: 'All', zh: '全部' }
};

DOMAIN_REGISTRY.forEach(domain => {
    DOMAIN_LABELS[domain.id] = { en: domain.nameEn, zh: domain.nameZh };
});

const MODE_CONFIG: Record<ViewMode, { icon: React.ElementType; labelZh: string; labelEn: string; subtitleZh: string; subtitleEn: string; color: string }> = {
    novelty: {
        icon: Gem,
        labelZh: '创新优先',
        labelEn: 'Innovation',
        subtitleZh: '高创新项目',
        subtitleEn: 'High Innovation',
        color: 'text-novo-blue',
    },
    trending: {
        icon: Flame,
        labelZh: '热门趋势',
        labelEn: 'Trending',
        subtitleZh: '热门趋势',
        subtitleEn: 'Trending',
        color: 'text-novo-red',
    },
    hidden: {
        icon: Compass,
        labelZh: '冷门宝藏',
        labelEn: 'Hidden Gems',
        subtitleZh: '冷门宝藏',
        subtitleEn: 'Hidden Gems',
        color: 'text-novo-yellow',
    },
    rising: {
        icon: TrendingUp,
        labelZh: '势能趋势',
        labelEn: 'Rising',
        subtitleZh: '创新势能',
        subtitleEn: 'Innovation Momentum',
        color: 'text-emerald-500',
    },
};

const getScoreStyle = (score: number) => {
    if (score >= 85) return 'text-novo-green bg-novo-green/10 border-novo-green/20';
    if (score >= 70) return 'text-novo-blue bg-novo-blue/10 border-novo-blue/20';
    if (score >= 50) return 'text-yellow-600 bg-novo-yellow/20 border-novo-yellow/30';
    return 'text-gray-500 bg-gray-100 border-gray-200';
};

// 性能优化：模块级内存短缓存（60秒），避免 re-mount 或 mode/filter 切回时重复请求
const CACHE_TTL_MS = 60_000;
const memoryCache = new Map<string, { data: unknown[]; domainSummary: unknown[]; ts: number }>();

const TrendingInnovations: React.FC<TrendingInnovationsProps> = ({ language, onKeywordClick }) => {
    const [innovations, setInnovations] = useState<any[]>([]);
    const [filter, setFilter] = useState('ALL');
    const [mode, setMode] = useState<ViewMode>('novelty');
    const [loading, setLoading] = useState(true);
    const [domainSummary, setDomainSummary] = useState<Array<{ domain_id: string; search_count: number; percentage: number }>>([]);
    const [selectedInnovation, setSelectedInnovation] = useState<any>(null);
    const isZh = language === 'zh';
    const modeConf = MODE_CONFIG[mode];

    // 势能样式
    const getMomentumStyle = (momentum: number) => {
        if (momentum >= 100) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (momentum > 0) return 'text-blue-600 bg-blue-50 border-blue-200';
        if (momentum === 0) return 'text-gray-500 bg-gray-100 border-gray-200';
        return 'text-red-500 bg-red-50 border-red-200';
    };

    useEffect(() => {
        const cacheKey = `${mode}:${filter}`;
        const cached = memoryCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
            setInnovations(cached.data);
            setDomainSummary(cached.domainSummary);
            setLoading(false);
            return;
        }

        setLoading(true);
        const fetchData = async () => {
            let data: unknown[];
            let summary: unknown[] = [];
            if (mode === 'rising') {
                try {
                    const domainParam = filter !== 'ALL' ? `&domainId=${filter}` : '';
                    const res = await fetch(`/api/trends?view=all&days=7${domainParam}`);
                    const json = await res.json();
                    data = json.trendingByMomentum || [];
                    summary = json.domainSummary || [];
                } catch {
                    data = [];
                }
            } else {
                // 性能优化：通过 API 路由获取数据（服务端查询 + 60s 缓存），
                // 不再从客户端直连 Supabase
                try {
                    const res = await fetch(`/api/data/innovations?sort=${mode}&limit=20`);
                    const json = await res.json();
                    data = json.innovations || [];
                } catch {
                    data = [];
                }
            }
            memoryCache.set(cacheKey, { data, domainSummary: summary, ts: Date.now() });
            setInnovations(data);
            setDomainSummary(summary);
            setLoading(false);
        };
        fetchData().catch(() => setLoading(false));
    }, [mode, filter]);

    const filtered = mode === 'rising'
        ? innovations  // rising 模式已通过 API 参数过滤
        : filter === 'ALL'
            ? innovations
            : innovations.filter((inv) => {
                const domainInfo = getDomainDisplayInfo(inv.domain_id, inv.category);
                return domainInfo.id === filter;
            });

    const displayed = filtered.slice(0, 16);

    return (
        <AntigravityCard className="flex flex-col h-full bg-white/95 border border-gray-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
            <div className="mb-6 flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-gray-50 ${modeConf.color}`}>
                    <modeConf.icon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-black text-2xl text-gray-900 leading-tight">NovoTrend</h3>
                    <p className="text-sm text-gray-500 font-medium mt-0.5">{isZh ? modeConf.subtitleZh : modeConf.subtitleEn}</p>
                </div>
            </div>

            <div className="flex flex-nowrap gap-2 sm:gap-3 mb-6 overflow-x-auto scrollbar-hide pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                {(Object.keys(MODE_CONFIG) as ViewMode[]).map((key) => {
                    const conf = MODE_CONFIG[key];
                    const isActive = mode === key;
                    return (
                        <button
                            key={key}
                            onClick={() => { setMode(key); setFilter('ALL'); }}
                            className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 flex items-center gap-1.5 sm:gap-2 border-2 flex-shrink-0 ${isActive
                                ? `bg-gray-900 border-gray-900 text-white shadow-md`
                                : 'bg-transparent text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-900'
                                }`}
                        >
                            <conf.icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                            {isZh ? conf.labelZh : conf.labelEn}
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-nowrap gap-2 mb-6 sm:mb-8 overflow-x-auto scrollbar-hide pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                {FEATURED_DOMAINS.map((key) => {
                    const label = DOMAIN_LABELS[key];
                    const isActive = filter === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 border ${isActive
                                ? 'bg-gray-100 border-gray-200 text-gray-900'
                                : 'bg-transparent border-transparent text-gray-400 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            {isZh ? label.zh : label.en}
                        </button>
                    )
                })}
            </div>

            <div className="flex-grow">
                {/* 势能趋势模式：在卡片列表上方展示趋势图表 */}
                {mode === 'rising' && (
                    <InnovationTrendCharts language={language} />
                )}

                {/* 左右分栏：左 2/3 卡片列表 + 右 1/3 聚光趋势 */}
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* 左栏：卡片网格 */}
                    <div className="lg:w-2/3 min-w-0">
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="animate-pulse flex space-x-3 justify-center">
                                    <div className="h-3 w-3 bg-novo-blue rounded-full"></div>
                                    <div className="h-3 w-3 bg-novo-red rounded-full flex-[0_0_auto] delay-100"></div>
                                    <div className="h-3 w-3 bg-novo-yellow rounded-full flex-[0_0_auto] delay-200"></div>
                                    <div className="h-3 w-3 bg-novo-green rounded-full flex-[0_0_auto] delay-300"></div>
                                </div>
                            </div>
                        ) : displayed.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Lightbulb className="w-12 h-12 mb-4 mx-auto text-gray-200" />
                                <p className="text-lg font-bold text-gray-900">{isZh ? '暂无数据' : 'No data yet'}</p>
                                <p className="text-sm mt-2 text-gray-500 font-medium">{isZh ? '开始探索引力波，发现未知领域' : 'Start exploring to discover new nodes'}</p>
                            </div>
                        ) : (
                            <motion.div
                                initial="hidden"
                                animate="show"
                                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
                                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                            >
                                {displayed.map((inv, index) => (
                                    <motion.div
                                        variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
                                        key={inv.innovation_id || inv.keyword || index}
                                        className="flex flex-col p-5 rounded-3xl bg-white/95 border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-1 hover:border-novo-blue/40 transition-all duration-300 cursor-pointer group/item relative overflow-hidden h-full"
                                        onClick={() => setSelectedInnovation(inv)}
                                    >
                                        {/* Decorative background gradient fade */}
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-gray-50/80 to-transparent rounded-full -mr-16 -mt-16 group-hover/item:from-blue-50/50 transition-colors pointer-events-none" />

                                        <div className="flex items-start justify-between relative z-10 w-full mb-3 gap-2">
                                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-black flex-shrink-0 ${index === 0 ? 'bg-gradient-to-br from-novo-red to-red-600 text-white shadow-md shadow-novo-red/20 border-novo-red/50' :
                                                index === 1 ? 'bg-gradient-to-br from-novo-blue to-blue-600 text-white shadow-md shadow-novo-blue/20 border-novo-blue/50' :
                                                    index === 2 ? 'bg-gradient-to-br from-novo-yellow to-yellow-500 text-white shadow-md shadow-novo-yellow/20 border-novo-yellow/50' :
                                                        'bg-gray-50 text-gray-500 border border-gray-200'
                                                }`}>
                                                #{index + 1}
                                            </span>
                                            {(() => {
                                                const domainInfo = getDomainDisplayInfo(inv.domain_id, inv.category);
                                                const classes = domainInfo.colorClasses;
                                                return (
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold border flex-shrink-0 bg-white/95 ${classes.text} ${classes.border}`}>
                                                        {isZh ? domainInfo.nameZh : domainInfo.nameEn}
                                                    </span>
                                                );
                                            })()}
                                        </div>

                                        <div className="relative z-10 flex-grow mb-4 flex items-center">
                                            <h4 className="text-[16px] font-extrabold text-gray-800 group-hover/item:text-novo-blue transition-colors line-clamp-3 leading-snug break-words" style={{ wordBreak: 'break-word' }}>
                                                {inv.keyword}
                                            </h4>
                                        </div>

                                        <div className="mt-auto pt-4 flex items-center justify-between relative z-10 border-t border-gray-200/50">
                                            <div className="flex items-center">
                                                {mode === 'rising' ? (
                                                    <div className="flex flex-col items-start">
                                                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400 mb-1">{isZh ? '增长势能' : 'Momentum'}</span>
                                                        <span className={`px-2 py-0.5 rounded-md text-[12px] font-black border bg-white/95 ${getMomentumStyle(inv.momentum || 0)}`}>
                                                            {(inv.momentum || 0) > 0 ? '↗' : (inv.momentum || 0) < 0 ? '↘' : '→'}
                                                            {' '}{Math.abs(inv.momentum || 0).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-start">
                                                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400 mb-1">{isZh ? '创新引力' : 'Novelty'}</span>
                                                        <ScoreTooltip
                                                            score={inv.novelty_score || inv.avg_novelty_score}
                                                            type="novelty"
                                                            className={`px-2 py-0.5 rounded-md text-[12px] font-black border bg-white/95 ${mode === 'novelty' || mode === 'hidden'
                                                                ? getScoreStyle(inv.novelty_score || inv.avg_novelty_score)
                                                                : 'text-gray-900 border-gray-200'
                                                                }`}
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400 mb-1">{isZh ? '搜索热度' : 'Searches'}</span>
                                                <span className="text-[14px] font-black text-gray-700 flex items-center gap-1.5 group-hover/item:text-gray-900 transition-colors">
                                                    <Search className="w-3.5 h-3.5 text-gray-400 group-hover/item:text-novo-blue transition-colors" />
                                                    {inv.search_count || 0}
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </div>

                    {/* 右栏：聚光趋势 */}
                    <div className="lg:w-1/3 min-w-0">
                        <div className="sticky top-4 p-5 rounded-3xl bg-gradient-to-br from-gray-50/80 via-white to-blue-50/30 border border-gray-100 shadow-[0_2px_16px_rgba(0,0,0,0.03)]">
                            <SpotlightTrend language={language} innovations={innovations} onKeywordClick={onKeywordClick} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Rising 模式：底部显示领域分布柱状图 */}
            {mode === 'rising' && domainSummary.length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-500 mb-3">
                        {isZh ? '近 7 天领域关注度分布' : 'Domain Interest Distribution (7d)'}
                    </p>
                    <div className="flex items-end gap-1.5 h-12">
                        {domainSummary.slice(0, 8).map((d) => {
                            const domainInfo = getDomainDisplayInfo(d.domain_id);
                            const maxPct = Math.max(...domainSummary.slice(0, 8).map(x => x.percentage));
                            const barH = Math.max(8, (d.percentage / (maxPct || 1)) * 100);
                            return (
                                <div key={d.domain_id} className="flex flex-col items-center flex-1 gap-1">
                                    <div
                                        className={`w-full rounded-t-md transition-all duration-500 ${domainInfo.colorClasses.bg} border ${domainInfo.colorClasses.border}`}
                                        style={{ height: `${barH}%`, minHeight: '4px' }}
                                        title={`${isZh ? domainInfo.nameZh : domainInfo.nameEn}: ${d.percentage}%`}
                                    />
                                    <span className="text-[9px] font-bold text-gray-400 truncate w-full text-center">
                                        {isZh ? domainInfo.nameZh : domainInfo.nameEn}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mt-8 pt-4 border-t border-gray-100 text-xs font-bold text-gray-400 flex items-center gap-2">
                <Info className="w-4 h-4 text-novo-blue" />
                {mode === 'rising'
                    ? (isZh ? '势能指标基于用户检索事件的时间窗口聚合分析' : 'Momentum is calculated from time-windowed search event aggregation')
                    : (isZh
                        ? '全息创新引力值基于大语言模型分析节点新颖度'
                        : 'Holographic novelty scores are derived from LLMs')}
            </div>

            {/* 创新详情弹窗 */}
            <InnovationDetailModal
                isOpen={!!selectedInnovation}
                onClose={() => setSelectedInnovation(null)}
                innovation={selectedInnovation}
                onSearch={(keyword) => {
                    setSelectedInnovation(null);
                    onKeywordClick?.(keyword);
                }}
            />
        </AntigravityCard>
    );
};

export default React.memo(TrendingInnovations);
