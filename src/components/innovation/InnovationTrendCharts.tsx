'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, Cell, Legend
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Zap, Sparkles, Globe, BarChart3, ArrowUpRight, ArrowDownRight, Minus, Activity } from 'lucide-react';
import { Language } from '@/types';
import { getDomainDisplayInfo } from '@/lib/constants/domains';

interface TrendSnapshot {
    period_start: string;
    period_end: string;
    total_searches: number;
    active_innovations: number;
    new_innovations: number;
    avg_novelty_score: number;
    top_domains: Array<{ domain_id: string; count: number; percentage: number }>;
    domain_distribution: Array<{ domain_id: string; count: number; percentage: number }>;
}

interface PlatformOverview {
    totalInnovations: number;
    totalSearches7d: number;
    avgNoveltyScore: number;
    activeDomainsCount: number;
    growthRate: number;
    topGrowingDomain: string | null;
    latestPeriodDelta: number;
}

interface InnovationTrendChartsProps {
    language: Language;
}

// ==================== 配色方案 ====================
const PALETTE = {
    blue: { main: '#4285F4', light: '#E8F0FE', dark: '#1A73E8' },
    green: { main: '#34A853', light: '#E6F4EA', dark: '#1E8E3E' },
    yellow: { main: '#FBBC05', light: '#FEF7E0', dark: '#F9AB00' },
    red: { main: '#EA4335', light: '#FCE8E6', dark: '#D93025' },
    purple: { main: '#9333EA', light: '#F3E8FF', dark: '#7C3AED' },
    cyan: { main: '#06B6D4', light: '#E0F2FE', dark: '#0891B2' },
};
const BAR_COLORS = [PALETTE.blue.main, PALETTE.green.main, PALETTE.yellow.main, PALETTE.red.main, PALETTE.purple.main, PALETTE.cyan.main, '#F97316', '#64748B'];

// ==================== 动画数字计数器 ====================
const AnimatedNumber: React.FC<{ target: number; duration?: number; decimals?: number; prefix?: string; suffix?: string }> = ({
    target, duration = 1200, decimals = 0, prefix = '', suffix = ''
}) => {
    const [current, setCurrent] = useState(0);
    const rafRef = useRef<number>(0);
    const startRef = useRef<number>(0);

    useEffect(() => {
        const from = current;
        const diff = target - from;
        if (Math.abs(diff) < 0.01) { setCurrent(target); return; }

        startRef.current = performance.now();
        const animate = (now: number) => {
            const elapsed = now - startRef.current;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCurrent(from + diff * eased);
            if (progress < 1) rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target, duration]);

    const display = decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString();
    return <>{prefix}{display}{suffix}</>;
};

// ==================== 自定义 Tooltip ====================
const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-gray-900/98 rounded-xl px-4 py-3 shadow-2xl border border-white/10 min-w-[160px]">
            <p className="text-[11px] font-bold text-gray-400 mb-1.5">{label}</p>
            {payload.map((entry: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-gray-300 text-[11px]">{entry.name}</span>
                    </div>
                    <span className="font-bold text-white text-[12px] tabular-nums">{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</span>
                </div>
            ))}
        </div>
    );
};

// ==================== 缓存 ====================
const FE_CACHE_TTL = 120_000;
let feCache: { data: any; ts: number } | null = null;

// ==================== 主组件 ====================
const InnovationTrendCharts: React.FC<InnovationTrendChartsProps> = ({ language }) => {
    const [snapshots, setSnapshots] = useState<TrendSnapshot[]>([]);
    const [overview, setOverview] = useState<PlatformOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState(30);
    const [activeChart, setActiveChart] = useState<'volume' | 'activity' | 'domain'>('volume');
    const isZh = language === 'zh';

    const fetchData = useCallback(() => {
        if (feCache && Date.now() - feCache.ts < FE_CACHE_TTL && feCache.data.timeRange === timeRange) {
            setSnapshots(feCache.data.snapshots || []);
            setOverview(feCache.data.overview || null);
            setLoading(false);
            return;
        }

        setLoading(true);
        fetch(`/api/trends?view=chart&days=${timeRange}`)
            .then(res => res.json())
            .then(data => {
                const snaps = data.chartSnapshots || [];
                const ov = data.platformOverview || null;
                setSnapshots(snaps);
                setOverview(ov);
                feCache = { data: { snapshots: snaps, overview: ov, timeRange }, ts: Date.now() };
            })
            .catch(() => { /* 静默处理 */ })
            .finally(() => setLoading(false));
    }, [timeRange]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // 图表数据格式化
    const chartData = useMemo(() => snapshots.map(s => {
        const d = new Date(s.period_start);
        return {
            date: `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`,
            [isZh ? '搜索量' : 'Searches']: s.total_searches,
            [isZh ? '活跃创新点' : 'Active']: s.active_innovations,
            [isZh ? '新增创新点' : 'New']: s.new_innovations,
            novelty: s.avg_novelty_score,
        };
    }), [snapshots, isZh]);

    // 领域聚合
    const domainChartData = useMemo(() => {
        const totals = new Map<string, number>();
        snapshots.forEach(s => (s.domain_distribution || []).forEach(d =>
            totals.set(d.domain_id, (totals.get(d.domain_id) || 0) + d.count)
        ));
        return Array.from(totals.entries())
            .map(([id, count]) => ({ domain_id: id, name: isZh ? getDomainDisplayInfo(id).nameZh : getDomainDisplayInfo(id).nameEn, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);
    }, [snapshots, isZh]);

    // 趋势洞察文案
    const insightText = useMemo(() => {
        if (!overview) return '';
        const parts: string[] = [];
        if (overview.growthRate > 0) {
            parts.push(isZh ? `搜索活跃度周环比增长 ${overview.growthRate}%` : `Search activity grew ${overview.growthRate}% week-over-week`);
        } else if (overview.growthRate < 0) {
            parts.push(isZh ? `搜索活跃度周环比下降 ${Math.abs(overview.growthRate)}%` : `Search activity decreased ${Math.abs(overview.growthRate)}% WoW`);
        }
        if (overview.topGrowingDomain) {
            const info = getDomainDisplayInfo(overview.topGrowingDomain);
            parts.push(isZh ? `${info.nameZh}为最活跃领域` : `${info.nameEn} is the most active domain`);
        }
        return parts.join(isZh ? '，' : ', ');
    }, [overview, isZh]);

    const TIME_OPTS = [
        { days: 14, label: '2W' },
        { days: 30, label: '1M' },
        { days: 60, label: '2M' },
    ];

    const CHART_TABS = [
        { key: 'volume' as const, label: isZh ? '搜索量' : 'Volume', icon: TrendingUp },
        { key: 'activity' as const, label: isZh ? '创新活跃' : 'Activity', icon: Activity },
        { key: 'domain' as const, label: isZh ? '领域分布' : 'Domains', icon: Globe },
    ];

    // ==================== 骨架屏 ====================
    if (loading) {
        return (
            <div className="w-full mb-6">
                <div className="rounded-3xl border border-gray-200/60 bg-gradient-to-br from-white/80 to-gray-50/50 p-6 md:p-8 shadow-sm">
                    <div className="animate-pulse space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-gray-200/80 rounded-xl" />
                            <div className="h-5 w-44 bg-gray-200/80 rounded-lg" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-[88px] bg-gray-100/80 rounded-2xl" />)}
                        </div>
                        <div className="h-[220px] bg-gray-100/60 rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    const GrowthArrow = overview && overview.growthRate > 0 ? ArrowUpRight
        : overview && overview.growthRate < 0 ? ArrowDownRight : Minus;
    const growthCls = overview && overview.growthRate > 0 ? 'text-emerald-500 bg-emerald-50'
        : overview && overview.growthRate < 0 ? 'text-red-500 bg-red-50' : 'text-gray-400 bg-gray-50';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full mb-6"
        >
            <div className="rounded-3xl border border-gray-200/60 bg-gradient-to-br from-white/80 via-white/60 to-gray-50/40 p-6 md:p-8 shadow-[0_2px_20px_rgba(0,0,0,0.03)]">

                {/* ===== 头部 ===== */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/20">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h4 className="font-black text-[17px] text-gray-900 leading-tight">
                                {isZh ? '创新生态仪表盘' : 'Innovation Ecosystem'}
                            </h4>
                            {insightText && (
                                <p className="text-[11px] text-gray-400 font-medium mt-0.5">{insightText}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mr-1">
                            {isZh ? '周期' : 'Range'}
                        </span>
                        <div className="flex bg-gray-100/80 rounded-lg p-0.5">
                            {TIME_OPTS.map(t => (
                                <button
                                    key={t.days}
                                    onClick={() => { feCache = null; setTimeRange(t.days); }}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all duration-200 ${timeRange === t.days
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ===== 统计卡片 ===== */}
                {overview && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <StatCardV2
                            icon={Zap}
                            label={isZh ? '累计创新点' : 'Innovations'}
                            value={overview.totalInnovations}
                            gradient="from-blue-500/8 to-blue-600/4"
                            iconColor="text-blue-500"
                            borderColor="border-blue-100"
                            delay={0}
                        />
                        <StatCardV2
                            icon={TrendingUp}
                            label={isZh ? '7日搜索量' : '7d Searches'}
                            value={overview.totalSearches7d}
                            gradient="from-emerald-500/8 to-green-600/4"
                            iconColor="text-emerald-500"
                            borderColor="border-emerald-100"
                            badge={
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${growthCls}`}>
                                    <GrowthArrow className="w-2.5 h-2.5" />
                                    {Math.abs(overview.growthRate)}%
                                </span>
                            }
                            delay={0.05}
                        />
                        <StatCardV2
                            icon={Sparkles}
                            label={isZh ? '平均新颖度' : 'Avg Novelty'}
                            value={overview.avgNoveltyScore}
                            decimals={1}
                            gradient="from-rose-500/8 to-red-600/4"
                            iconColor="text-rose-500"
                            borderColor="border-rose-100"
                            delay={0.1}
                        />
                        <StatCardV2
                            icon={Globe}
                            label={isZh ? '活跃领域' : 'Domains'}
                            value={overview.activeDomainsCount}
                            gradient="from-violet-500/8 to-purple-600/4"
                            iconColor="text-violet-500"
                            borderColor="border-violet-100"
                            delay={0.15}
                        />
                    </div>
                )}

                {/* ===== 图表标签切换 ===== */}
                <div className="flex items-center gap-1 mb-4 bg-gray-50/80 rounded-xl p-1 w-fit">
                    {CHART_TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveChart(tab.key)}
                            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all duration-200 ${activeChart === tab.key
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-400 hover:text-gray-600'
                                }`}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ===== 图表内容 ===== */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeChart}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                    >
                        {chartData.length > 0 ? (
                            <>
                                {activeChart === 'volume' && (
                                    <div className="bg-gradient-to-br from-white/80 to-blue-50/30 rounded-2xl border border-blue-100/50 p-4 pt-3">
                                        <ResponsiveContainer width="100%" height={220}>
                                            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor={PALETTE.blue.main} stopOpacity={0.25} />
                                                        <stop offset="100%" stopColor={PALETTE.blue.main} stopOpacity={0.01} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                                                <Tooltip content={<ChartTooltip />} cursor={{ stroke: PALETTE.blue.main, strokeWidth: 1, strokeDasharray: '4 4' }} />
                                                <Area type="monotone" dataKey={isZh ? '搜索量' : 'Searches'} stroke={PALETTE.blue.main} strokeWidth={2.5} fill="url(#volGrad)" dot={false} activeDot={{ r: 5, fill: PALETTE.blue.main, stroke: '#fff', strokeWidth: 2.5 }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {activeChart === 'activity' && (
                                    <div className="bg-gradient-to-br from-white/80 to-emerald-50/30 rounded-2xl border border-emerald-100/50 p-4 pt-3">
                                        <ResponsiveContainer width="100%" height={220}>
                                            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor={PALETTE.green.main} stopOpacity={0.2} />
                                                        <stop offset="100%" stopColor={PALETTE.green.main} stopOpacity={0} />
                                                    </linearGradient>
                                                    <linearGradient id="newGrad2" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor={PALETTE.yellow.main} stopOpacity={0.18} />
                                                        <stop offset="100%" stopColor={PALETTE.yellow.main} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                                                <Tooltip content={<ChartTooltip />} cursor={{ stroke: PALETTE.green.main, strokeWidth: 1, strokeDasharray: '4 4' }} />
                                                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px', paddingTop: '6px', fontWeight: 600 }} />
                                                <Area type="monotone" dataKey={isZh ? '活跃创新点' : 'Active'} stroke={PALETTE.green.main} strokeWidth={2} fill="url(#actGrad)" dot={false} activeDot={{ r: 4, fill: PALETTE.green.main, stroke: '#fff', strokeWidth: 2 }} />
                                                <Area type="monotone" dataKey={isZh ? '新增创新点' : 'New'} stroke={PALETTE.yellow.dark} strokeWidth={2} fill="url(#newGrad2)" dot={false} activeDot={{ r: 4, fill: PALETTE.yellow.dark, stroke: '#fff', strokeWidth: 2 }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {activeChart === 'domain' && domainChartData.length > 0 && (
                                    <div className="bg-gradient-to-br from-white/80 to-violet-50/30 rounded-2xl border border-violet-100/50 p-4 pt-3">
                                        <ResponsiveContainer width="100%" height={220}>
                                            <BarChart data={domainChartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={45} />
                                                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)', rx: 6 }} />
                                                <Bar dataKey="count" name={isZh ? '搜索次数' : 'Searches'} radius={[8, 8, 0, 0]} maxBarSize={36}>
                                                    {domainChartData.map((_, i) => (
                                                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} fillOpacity={0.85} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {activeChart === 'domain' && domainChartData.length === 0 && (
                                    <EmptyState isZh={isZh} />
                                )}
                            </>
                        ) : (
                            <EmptyState isZh={isZh} />
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* ===== 底部说明 ===== */}
                <p className="text-[10px] text-gray-300 font-medium mt-4 text-center">
                    {isZh ? '数据每 2 天自动聚合 · 基于全平台匿名检索事件' : 'Aggregated every 2 days · Based on anonymized search events'}
                </p>
            </div>
        </motion.div>
    );
};

// ==================== 统计卡片 V2 ====================
interface StatCardV2Props {
    icon: React.ElementType;
    label: string;
    value: number;
    decimals?: number;
    gradient: string;
    iconColor: string;
    borderColor: string;
    badge?: React.ReactNode;
    delay?: number;
}

const StatCardV2: React.FC<StatCardV2Props> = ({ icon: Icon, label, value, decimals = 0, gradient, iconColor, borderColor, badge, delay = 0 }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={`relative overflow-hidden rounded-2xl border ${borderColor} p-3.5 bg-gradient-to-br ${gradient} group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300`}
    >
        <div className="flex items-center justify-between mb-1.5">
            <div className={`p-1.5 rounded-lg bg-white/95 shadow-sm ${iconColor}`}>
                <Icon className="w-3.5 h-3.5" />
            </div>
            {badge}
        </div>
        <p className="text-[22px] font-black text-gray-900 tracking-tight leading-tight tabular-nums">
            <AnimatedNumber target={value} decimals={decimals} />
        </p>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
    </motion.div>
);

// ==================== 空状态 ====================
const EmptyState: React.FC<{ isZh: boolean }> = ({ isZh }) => (
    <div className="flex flex-col items-center justify-center py-14">
        <div className="p-4 rounded-2xl bg-gray-50 mb-4">
            <BarChart3 className="w-8 h-8 text-gray-200" />
        </div>
        <p className="text-sm font-bold text-gray-400">
            {isZh ? '暂无足够数据生成趋势图表' : 'Not enough data for charts yet'}
        </p>
        <p className="text-[11px] text-gray-300 mt-1 max-w-[260px] text-center">
            {isZh ? '随着更多用户使用搜索功能，图表数据将自动累积并展示' : 'Charts will populate as search data accumulates'}
        </p>
    </div>
);

export default React.memo(InnovationTrendCharts);
