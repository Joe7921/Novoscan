'use client';

/**
 * PopularReports — 首页底部热门公开报告展示
 *
 * 从数据库获取最新的公开报告列表，
 * 展示评分、类型、浏览次数等核心信息。
 * 充当内容引擎，吸引新用户。
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
// 性能优化：使用 CSS 动画替代 framer-motion
import { Eye, Sparkles, ArrowRight, TrendingUp, Zap, Shield, Search } from 'lucide-react';

interface ReportPreview {
    id: string;
    idea_summary: string;
    report_type: string;
    overall_score: number;
    novelty_level: string;
    key_finding: string | null;
    view_count: number;
    created_at: string;
}

const typeConfig: Record<string, { label: string; icon: React.ReactNode; gradient: string }> = {
    novoscan: {
        label: 'Novoscan',
        icon: <Search className="w-3.5 h-3.5" />,
        gradient: 'from-blue-500 to-cyan-400',
    },
    flash: {
        label: 'Flash',
        icon: <Zap className="w-3.5 h-3.5" />,
        gradient: 'from-amber-500 to-orange-400',
    },
    bizscan: {
        label: 'Bizscan',
        icon: <TrendingUp className="w-3.5 h-3.5" />,
        gradient: 'from-violet-500 to-purple-400',
    },
    clawscan: {
        label: 'Clawscan',
        icon: <Shield className="w-3.5 h-3.5" />,
        gradient: 'from-emerald-500 to-teal-400',
    },
};

function getScoreColor(score: number) {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-500';
}

interface PopularReportsProps {
    language: 'zh' | 'en';
}

export default function PopularReports({ language }: PopularReportsProps) {
    const [reports, setReports] = useState<ReportPreview[]>([]);
    const [loading, setLoading] = useState(true);
    const isZh = language === 'zh';

    useEffect(() => {
        fetch('/api/report/popular')
            .then(res => res.json())
            .then(data => {
                setReports(data.reports || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // 没有报告时不渲染
    if (!loading && reports.length === 0) return null;

    return (
        <section className="w-full max-w-6xl mx-auto py-12 sm:py-16 px-4 sm:px-6 relative z-10">
            {/* 标题 */}
            <div
                className="text-center mb-10 animate-fade-in-up"
            >
                <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.15em] uppercase text-violet-500 bg-violet-50 px-4 py-1.5 rounded-full mb-4">
                    <Sparkles className="w-3.5 h-3.5" />
                    {isZh ? '社区洞察' : 'Community Insights'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                    {isZh ? '最新公开分析报告' : 'Latest Public Reports'}
                </h2>
                <p className="mt-2 text-sm text-gray-400 max-w-md mx-auto">
                    {isZh
                        ? '看看别人的创新想法获得了怎样的 AI 评估'
                        : 'See how other innovation ideas were evaluated by AI'}
                </p>
            </div>

            {/* 加载骨架 */}
            {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white/95 rounded-2xl border border-gray-100 p-5 animate-pulse">
                            <div className="h-4 bg-gray-100 rounded-full w-20 mb-3" />
                            <div className="h-5 bg-gray-100 rounded-lg w-full mb-2" />
                            <div className="h-4 bg-gray-50 rounded-lg w-3/4 mb-4" />
                            <div className="h-8 bg-gray-50 rounded-full w-16" />
                        </div>
                    ))}
                </div>
            )}

            {/* 报告卡片 */}
            {!loading && reports.length > 0 && (
                <div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in"
                >
                    {reports.slice(0, 6).map((report, idx) => {
                        const type = typeConfig[report.report_type] || typeConfig.novoscan;
                        const timeAgo = getTimeAgo(report.created_at, isZh);

                        return (
                            <div
                                key={report.id}
                                className="animate-stagger-in"
                                style={{ animationDelay: `${idx * 0.08}s` }}
                            >
                                <Link
                                    href={`/report/${report.id}`}
                                    className="group block bg-white/95 hover:bg-white rounded-2xl border border-gray-100 hover:border-gray-200 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                                >
                                    {/* 类型 + 时间 */}
                                    <div className="flex items-center justify-between mb-3">
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold text-white px-2 py-0.5 rounded-full bg-gradient-to-r ${type.gradient}`}>
                                            {type.icon}
                                            {type.label}
                                        </span>
                                        <span className="text-[10px] text-gray-400">{timeAgo}</span>
                                    </div>

                                    {/* 想法 */}
                                    <h3 className="text-sm font-bold text-gray-900 line-clamp-2 leading-snug mb-2 group-hover:text-blue-600 transition-colors">
                                        {report.idea_summary}
                                    </h3>

                                    {/* 核心发现 */}
                                    {report.key_finding && (
                                        <p className="text-xs text-gray-400 line-clamp-2 mb-3 leading-relaxed">
                                            {report.key_finding}
                                        </p>
                                    )}

                                    {/* 底部：评分 + 浏览次数 */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-lg font-black ${getScoreColor(report.overall_score)}`}>
                                                {report.overall_score}
                                            </span>
                                            <span className="text-[10px] text-gray-400">/100</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                            <Eye className="w-3 h-3" />
                                            {report.view_count}
                                        </span>
                                    </div>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

function getTimeAgo(dateStr: string, isZh: boolean): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return isZh ? '刚刚' : 'just now';
    if (diffMins < 60) return isZh ? `${diffMins}分钟前` : `${diffMins}m ago`;
    if (diffHours < 24) return isZh ? `${diffHours}小时前` : `${diffHours}h ago`;
    if (diffDays < 30) return isZh ? `${diffDays}天前` : `${diffDays}d ago`;
    return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
}
