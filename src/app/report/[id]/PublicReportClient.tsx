'use client';

import React, { useMemo } from 'react';
import { Sparkles, Shield, ArrowRight, Activity, TrendingUp, Compass, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface PublicReportClientProps {
    data: {
        id: string;
        ideaSummary: string;
        overallScore: number;
        noveltyLevel: string;
        keyFinding: string;
        createdAt: string;
        viewCount: number;
        reportType: string;
        reportJson: any;
    };
}

export default function PublicReportClient({ data }: PublicReportClientProps) {
    const { ideaSummary, overallScore, noveltyLevel, createdAt, reportJson, reportType } = data;

    // 分数色彩
    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-500';
        if (score >= 60) return 'text-blue-500';
        if (score >= 40) return 'text-amber-500';
        return 'text-red-500';
    };

    const getScoreBg = (score: number) => {
        if (score >= 80) return 'bg-emerald-500';
        if (score >= 60) return 'bg-blue-500';
        if (score >= 40) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const scoreColorClass = getScoreColor(overallScore);
    const scoreBgClass = getScoreBg(overallScore);

    const levelText = {
        High: '高创新性',
        Medium: '中等创新性',
        Low: '低创新性',
    }[noveltyLevel] || '中等创新性';

    const typeText = {
        novoscan: 'Novoscan 深度分析',
        bizscan: 'Bizscan 商业分析',
        clawscan: 'Clawscan 创新查重',
        flash: 'Flash 极速分析',
    }[reportType] || 'AI 分析';

    // 提取关键发现数组
    const keyFindings = useMemo(() => {
        if (!reportJson || !reportJson.report) return [];
        const pr = reportJson.report;
        if (Array.isArray(pr.keyFindings)) return pr.keyFindings;
        if (Array.isArray(pr.innovationPoints)) return pr.innovationPoints;
        if (Array.isArray(pr.marketOpportunities)) return pr.marketOpportunities;
        if (pr.arbitration?.summary) return [{ title: '综合评估', description: pr.arbitration.summary }];
        return [];
    }, [reportJson]);

    // 提取雷达图数据
    const radarData = useMemo(() => {
        if (reportJson?.report?.arbitration?.radarScores) {
            return reportJson.report.arbitration.radarScores;
        }
        if (reportJson?.dualResult?.innovationRadar?.dimensions) {
            return reportJson.dualResult.innovationRadar.dimensions;
        }
        return null;
    }, [reportJson]);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
            {/* 顶栏 */}
            <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/5 py-4">
                <div className="max-w-4xl mx-auto px-4 flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-2 group">
                        <Sparkles className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
                        <span className="font-black text-lg text-white tracking-tight">Novoscan</span>
                    </Link>
                    <Link
                        href="/"
                        className="text-xs font-bold px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        分析我的想法
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
                {/* 头部摘要 */}
                <div className="mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-6">
                        <Activity className="w-3.5 h-3.5" />
                        {typeText}公开报告
                    </div>
                    <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight mb-4">
                        {ideaSummary}
                    </h1>
                    <div className="flex items-center gap-4 text-sm text-slate-400 font-medium">
                        <span>{new Date(createdAt).toLocaleDateString('zh-CN')}</span>
                        <span>•</span>
                        <span>已获得 {data.viewCount} 次浏览</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {/* 左侧：分数卡片 */}
                    <div className="md:col-span-1 bg-slate-800/50 rounded-3xl p-6 md:p-8 border border-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden">
                        {/* 装饰渐变 */}
                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-20 ${scoreBgClass}`} />
                        <div className="relative z-10 w-full">
                            <h3 className="text-sm font-bold text-slate-400 tracking-wider mb-6">核心创新评分</h3>
                            <div className="flex flex-col items-center gap-4">
                                <div className={`text-6xl sm:text-7xl font-black ${scoreColorClass} leading-none tracking-tighter`}>
                                    {overallScore}
                                </div>
                                <div className={`inline-flex px-3 py-1 rounded-lg bg-white/5 text-sm font-bold ${scoreColorClass}`}>
                                    {levelText}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 右侧：雷达图或关键发现简述 */}
                    <div className="md:col-span-2 bg-slate-800/50 rounded-3xl p-6 border border-white/5">
                        <h3 className="text-sm font-bold text-slate-400 tracking-wider flex items-center gap-2 mb-6">
                            <Compass className="w-4 h-4 text-emerald-400" />
                            分析结论
                        </h3>
                        
                        {/* 简单展示关键点 */}
                        <div className="space-y-4">
                            {data.keyFinding ? (
                                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                                    {data.keyFinding}
                                </p>
                            ) : (
                                <p className="text-slate-500 italic text-sm">暂无详细分析结论</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* 关键洞察详细列表 */}
                {keyFindings && keyFindings.length > 0 && (
                    <div className="mb-12">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-blue-400" />
                            关键亮点与挑战
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {keyFindings.map((finding: any, idx: number) => (
                                <div key={idx} className="bg-slate-800/30 rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-colors group">
                                    <h4 className="font-bold text-white mb-2 flex items-start gap-2 text-sm">
                                        <span className="text-blue-400 mt-0.5">•</span>
                                        {finding.title || finding.point || '发现'}
                                    </h4>
                                    <p className="text-slate-400 text-xs leading-relaxed pl-3 border-l border-white/5 group-hover:border-blue-500/30 transition-colors">
                                        {finding.description || finding.detail || finding.content || ''}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 底部引流卡片 (CTA) */}
                <div className="relative rounded-3xl overflow-hidden mt-16 group cursor-pointer">
                    <Link href="/">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-800 opacity-90 transition-opacity group-hover:opacity-100" />
                        
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                        
                        <div className="relative z-10 p-8 sm:p-12 text-center flex flex-col items-center">
                            <Shield className="w-12 h-12 text-blue-200 mb-6 group-hover:scale-110 transition-transform duration-500" />
                            <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">
                                想要分析你自己的创新想法？
                            </h2>
                            <p className="text-blue-100 max-w-lg mx-auto text-sm sm:text-base leading-relaxed mb-8">
                                Novoscan 多智能体系统可在一分钟内对您的想法进行深度查重、多维商业评估与技术可行性分析。
                            </p>
                            
                            <div className="inline-flex items-center gap-2 bg-white text-blue-900 px-6 py-3 rounded-xl font-bold hover:shadow-xl hover:shadow-white/20 transition-all active:scale-95">
                                立即免费分析
                                <ArrowRight className="w-4 h-4" />
                            </div>
                        </div>
                    </Link>
                </div>
            </main>
        </div>
    );
}
