'use client';

import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Search, Zap, Sparkles, Activity } from 'lucide-react';
import { Language } from '@/types';
import { getDomainDisplayInfo } from '@/lib/constants/domains';
import { motion } from 'framer-motion';

interface SpotlightData {
    keyword: string;
    domain_id: string | null;
    innovation_id: string;
    momentum: number;
    novelty_score: number;
    total_search_count: number;
    dailyData: Array<{ date: string; count: number }>;
}

interface SpotlightTrendProps {
    language: Language;
    /** 可选：从父组件传入已有数据列表，前端自动选取聚光项（无需额外 API） */
    innovations?: unknown[];
    onKeywordClick?: (keyword: string) => void;
}

// 前端缓存
const SPOTLIGHT_CACHE_TTL = 120_000;
let spotlightCache: { data: SpotlightData | null; ts: number } | null = null;

const SpotlightTrend: React.FC<SpotlightTrendProps> = ({ language, innovations, onKeywordClick }) => {
    const [spotlight, setSpotlight] = useState<SpotlightData | null>(null);
    const [loading, setLoading] = useState(true);
    const isZh = language === 'zh';

    useEffect(() => {
        // 优先使用缓存
        if (spotlightCache && Date.now() - spotlightCache.ts < SPOTLIGHT_CACHE_TTL) {
            setSpotlight(spotlightCache.data);
            setLoading(false);
            return;
        }

        const fetchSpotlight = async () => {
            try {
                const res = await fetch('/api/trends?view=spotlight&days=7');
                const json = await res.json();
                const data = json.spotlight || null;
                spotlightCache = { data, ts: Date.now() };
                setSpotlight(data);
            } catch {
                setSpotlight(null);
            } finally {
                setLoading(false);
            }
        };
        fetchSpotlight();
    }, []);

    // 自定义 Tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-gray-900/98 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-white/10">
                <p className="text-gray-400 mb-1">{label}</p>
                <p className="font-bold">{isZh ? '检索量' : 'Searches'}: <span className="text-blue-300">{payload[0].value}</span></p>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-3">
                    <Activity className="w-8 h-8 text-gray-300" />
                    <div className="h-2 w-24 bg-gray-200 rounded-full" />
                </div>
            </div>
        );
    }

    if (!spotlight) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-8">
                <Sparkles className="w-10 h-10 mb-3 text-gray-200" />
                <p className="text-sm font-bold text-gray-500">{isZh ? '暂无聚光数据' : 'No spotlight data'}</p>
                <p className="text-xs mt-1 text-gray-400">{isZh ? '数据积累后将自动展示' : 'Will appear as data accumulates'}</p>
            </div>
        );
    }

    const domainInfo = getDomainDisplayInfo(spotlight.domain_id || undefined);
    const maxCount = Math.max(...spotlight.dailyData.map(d => d.count), 1);
    const hasTrend = spotlight.dailyData.some(d => d.count > 0);

    // 格式化日期标签
    const chartData = spotlight.dailyData.map(d => ({
        ...d,
        label: d.date.slice(5), // MM-DD
    }));

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="h-full flex flex-col"
        >
            {/* 标题区 */}
            <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20">
                    <Zap className="w-4 h-4 text-orange-500" />
                </div>
                <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">
                    {isZh ? '🔥 趋势聚焦' : '🔥 Spotlight'}
                </span>
            </div>

            {/* 关键词 + 领域标签 */}
            <div
                className="mb-4 cursor-pointer group"
                onClick={() => onKeywordClick?.(spotlight.keyword)}
            >
                <h4 className="text-lg font-black text-gray-900 group-hover:text-google-blue transition-colors leading-snug mb-2 break-words" style={{ wordBreak: 'break-word' }}>
                    {spotlight.keyword}
                </h4>
                <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold border bg-white/95 ${domainInfo.colorClasses.text} ${domainInfo.colorClasses.border}`}>
                    {isZh ? domainInfo.nameZh : domainInfo.nameEn}
                </span>
            </div>

            {/* 核心指标 */}
            <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-3 border border-blue-100">
                    <div className="text-[9px] uppercase tracking-wider font-extrabold text-blue-400 mb-1">
                        {isZh ? '总检索量' : 'Total Searches'}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xl font-black text-blue-700">{spotlight.total_search_count}</span>
                    </div>
                </div>
                <div className={`rounded-2xl p-3 border ${spotlight.momentum >= 0
                    ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100'
                    : 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-100'
                    }`}>
                    <div className={`text-[9px] uppercase tracking-wider font-extrabold mb-1 ${spotlight.momentum >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                        {isZh ? '增长势能' : 'Momentum'}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <TrendingUp className={`w-3.5 h-3.5 ${spotlight.momentum >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                        <span className={`text-xl font-black ${spotlight.momentum >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {spotlight.momentum > 0 ? '+' : ''}{spotlight.momentum.toFixed(0)}%
                        </span>
                    </div>
                </div>
            </div>

            {/* 创新指数 */}
            <div className="mb-5 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-3 border border-purple-100">
                <div className="flex items-center justify-between">
                    <div className="text-[9px] uppercase tracking-wider font-extrabold text-purple-400">
                        {isZh ? '创新引力' : 'Novelty Score'}
                    </div>
                    <span className="text-lg font-black text-purple-700">{spotlight.novelty_score}</span>
                </div>
                <div className="mt-2 h-1.5 bg-purple-100 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(spotlight.novelty_score, 100)}%` }}
                        transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 rounded-full"
                    />
                </div>
            </div>

            {/* 迷你面积图 */}
            <div className="flex-grow min-h-0">
                <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">
                    {isZh ? '近 7 天检索走势' : '7-Day Search Trend'}
                </div>
                {hasTrend ? (
                    <div className="h-[140px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                                <defs>
                                    <linearGradient id="spotlightGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#4285F4" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#4285F4" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="label"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }}
                                    allowDecimals={false}
                                    domain={[0, (max: number) => Math.max(max, 1)]}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#4285F4"
                                    strokeWidth={2.5}
                                    fill="url(#spotlightGradient)"
                                    dot={{ r: 3, fill: '#4285F4', strokeWidth: 0 }}
                                    activeDot={{ r: 5, fill: '#4285F4', stroke: '#fff', strokeWidth: 2 }}
                                    animationDuration={1200}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[140px] flex items-center justify-center text-gray-300">
                        <div className="text-center">
                            <Activity className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                            <p className="text-xs text-gray-400">{isZh ? '走势数据积累中' : 'Collecting data'}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* 底部说明 */}
            <div className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-400 font-medium">
                {isZh ? '基于近7天平台检索数据自动选取' : 'Auto-selected from 7-day search data'}
            </div>
        </motion.div>
    );
};

export default React.memo(SpotlightTrend);
