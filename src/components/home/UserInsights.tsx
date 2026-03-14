'use client';

import React, { useMemo } from 'react';
import { DOMAIN_REGISTRY } from '@/lib/constants/domains';
import { BarChart3, TrendingUp, Clock, Sparkles } from 'lucide-react';

export interface UserPreferencesData {
    topInterests: Array<{
        domain_id: string;
        sub_domain_id?: string;
        weight: number;
    }>;
    profile: {
        searchCount: number;
        lastSearchAt: string | null;
        topDomainId: string | null;
    } | null;
    recentDomains: string[];
}

interface UserInsightsProps {
    language: 'zh' | 'en';
    onKeywordClick?: (keyword: string) => void;
    /** 由父组件传入的用户偏好数据（避免重复请求） */
    preferencesData?: UserPreferencesData | null;
    /** 用户是否已登录（由父组件传入） */
    isLoggedIn?: boolean;
}

/**
 * 用户研究画像组件
 * 展示登录用户的兴趣领域分布、搜索统计和推荐关键词
 * 数据由父组件 page.tsx 的 initUser 获取后传入，避免重复 auth + API 调用
 */
export default function UserInsights({ language, onKeywordClick, preferencesData, isLoggedIn }: UserInsightsProps) {
    const data = preferencesData || null;

    const isZh = language === 'zh';

    // 计算兴趣分布的最大权重用于比例条
    const maxWeight = useMemo(() => {
        if (!data?.topInterests?.length) return 1;
        return Math.max(...data.topInterests.map(i => i.weight), 1);
    }, [data]);

    // 未登录 → 不渲染
    if (!isLoggedIn) return null;

    // 已登录但无数据（新用户）→ 不渲染
    if (!data || (!data.topInterests?.length && !data.profile)) return null;

    // 计算时间差显示
    const formatTimeAgo = (dateStr: string | null) => {
        if (!dateStr) return isZh ? '暂无' : 'N/A';
        const diff = Date.now() - new Date(dateStr).getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return isZh ? '刚刚' : 'Just now';
        if (hours < 24) return isZh ? `${hours}小时前` : `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return isZh ? `${days}天前` : `${days}d ago`;
    };

    return (
        <div className="w-full max-w-[1440px] xl:px-10">
            <div className="bg-white/95 border border-gray-200/60 rounded-2xl p-6 shadow-sm">
                {/* 标题区 */}
                <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                        {isZh ? '我的研究画像' : 'My Research Profile'}
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* 搜索统计 */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                            <BarChart3 className="w-4 h-4" />
                            {isZh ? '搜索统计' : 'Search Stats'}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <div className="text-2xl font-black text-gray-900">
                                    {data.profile?.searchCount || 0}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    {isZh ? '累计搜索' : 'Total Searches'}
                                </div>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                <div className="text-sm font-bold text-gray-700 flex items-center justify-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {formatTimeAgo(data.profile?.lastSearchAt || null)}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                    {isZh ? '最近活跃' : 'Last Active'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 兴趣领域分布 */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                            <TrendingUp className="w-4 h-4" />
                            {isZh ? '兴趣领域' : 'Research Interests'}
                        </div>
                        <div className="space-y-2">
                            {data.topInterests.slice(0, 5).map((interest, idx) => {
                                const domain = DOMAIN_REGISTRY.find(d => d.id === interest.domain_id);
                                const percentage = Math.round((interest.weight / maxWeight) * 100);

                                return (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${domain?.colorClasses?.bg || 'bg-gray-100'} ${domain?.colorClasses?.text || 'text-gray-600'} min-w-[52px] justify-center`}>
                                            {domain?.nameZh || interest.domain_id}
                                        </span>
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${domain?.colorClasses?.dot?.replace('bg-', 'bg-') || 'bg-gray-400'}`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-400 tabular-nums w-6 text-right">{interest.weight}</span>
                                    </div>
                                );
                            })}
                            {data.topInterests.length === 0 && (
                                <p className="text-xs text-gray-400 italic">
                                    {isZh ? '暂无数据，多搜索几次吧！' : 'No data yet. Try searching!'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 最近关注领域 */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                            <Sparkles className="w-4 h-4" />
                            {isZh ? '最近关注' : 'Recent Focus'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {data.recentDomains.map((domainId) => {
                                const domain = DOMAIN_REGISTRY.find(d => d.id === domainId);
                                if (!domain) return null;

                                return (
                                    <button
                                        key={domainId}
                                        onClick={() => onKeywordClick?.(domain.nameZh)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 hover:shadow-sm hover:scale-105 cursor-pointer
                                            ${domain.colorClasses.bg} ${domain.colorClasses.text} ${domain.colorClasses.border}`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${domain.colorClasses.dot}`} />
                                        {domain.nameZh}
                                    </button>
                                );
                            })}
                            {data.recentDomains.length === 0 && (
                                <p className="text-xs text-gray-400 italic">
                                    {isZh ? '暂无数据' : 'No data'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
