/**
 * Novoscan Flash 极速报告页
 *
 * 设计原则：
 * - 有数据才显示，没有的信息不呈现
 * - 精简高效，一屏看完核心结论
 * - 风格与常规报告区分，体现速度感
 */
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
    Zap, ArrowLeft, GraduationCap, TrendingUp,
    Crosshair, Lightbulb, AlertTriangle, FileText,
    ChevronRight, ExternalLink, Award,
} from 'lucide-react';
import { Language } from '@/types';

const ExportReportButton = dynamic(() => import('@/components/report/ExportReportButton'), { ssr: false });
const ShareButton = dynamic(() => import('@/components/report/ShareButton'), { ssr: false });

// ==================== 雷达/评分复用组件 ====================
const RadarChart = dynamic(() => import('./RadarChart'), { ssr: false });
const ScoreGauge = dynamic(() => import('./ScoreGauge'), { ssr: false });

interface FlashReportProps {
    report: any;
    onReset: () => void;
    language: Language;
    query?: string;
    dualResult?: any;
}

// ==================== 迷你评分卡片 ====================

function ScoreCard({ icon, label, score, color, confidence }: {
    icon: React.ReactNode;
    label: string;
    score: number;
    color: string;
    confidence?: string;
}) {
    const getScoreColor = (s: number) => {
        if (s >= 75) return 'text-green-600';
        if (s >= 50) return 'text-amber-600';
        return 'text-red-500';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/95 border border-gray-200/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
        >
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-700">{label}</p>
                    {confidence && (
                        <p className="text-[10px] text-gray-400">
                            置信度: {confidence === 'high' ? '高' : confidence === 'medium' ? '中' : '低'}
                        </p>
                    )}
                </div>
            </div>
            <p className={`text-3xl font-black ${getScoreColor(score)}`}>
                {score}<span className="text-base font-normal text-gray-400">/100</span>
            </p>
        </motion.div>
    );
}

// ==================== 主组件 ====================

function FlashReport({ report, onReset, language, query, dualResult }: FlashReportProps) {
    const isZh = language === 'zh';

    const overallScore = report?.arbitration?.overallScore || report?.noveltyScore || 0;
    const recommendation = report?.arbitration?.recommendation || '';
    const summary = report?.arbitration?.summary || report?.summary || '';
    const consensusLevel = report?.arbitration?.consensusLevel;

    // 聚合关键发现
    const keyFindings = [
        ...(report?.academicReview?.keyFindings || []),
        ...(report?.industryAnalysis?.keyFindings || []),
        ...(report?.innovationEvaluation?.keyFindings || []),
        ...(report?.competitorAnalysis?.keyFindings || []),
    ].filter(Boolean).slice(0, 8);

    // 聚合风险提示
    const redFlags = [
        ...(report?.academicReview?.redFlags || []),
        ...(report?.industryAnalysis?.redFlags || []),
        ...(report?.innovationEvaluation?.redFlags || []),
        ...(report?.competitorAnalysis?.redFlags || []),
    ].filter(Boolean).slice(0, 6);

    // 相似论文
    const similarPapers = report?.similarPapers || [];

    // 推荐等级颜色
    const getRecommendationColor = (rec: string) => {
        if (rec.includes('强烈')) return 'bg-green-100 text-green-700 border-green-200';
        if (rec.includes('推荐')) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (rec.includes('谨慎')) return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-red-100 text-red-700 border-red-200';
    };

    return (
        <div className="w-full max-w-5xl mx-auto">
            {/* ==================== 顶部工具栏 ==================== */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between mb-6"
            >
                <button
                    onClick={onReset}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {isZh ? '返回首页' : 'Back'}
                </button>

                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 rounded-full text-xs font-bold border border-amber-200/60">
                        <Zap className="w-3 h-3" />
                        Flash {isZh ? '极速报告' : 'Report'}
                    </span>
                    <ShareButton
                        query={query || ''}
                        report={report}
                        dualResult={dualResult}
                        reportType="flash"
                        size="sm"
                    />
                    <ExportReportButton
                        report={report}
                        query={query || ''}
                        dualResult={dualResult}
                        language={language}
                    />
                </div>
            </motion.div>

            {/* ==================== Hero: 核心结论 ==================== */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/95 border border-gray-200/60 rounded-3xl p-6 sm:p-8 mb-6 shadow-sm"
            >
                {/* 查询标题 */}
                {query && (
                    <p className="text-sm text-gray-400 mb-4 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {query}
                    </p>
                )}

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    <div className="flex-shrink-0">
                        <ScoreGauge score={overallScore} label={isZh ? '综合评分' : 'Overall'} type="academic" language={language} />
                    </div>

                    {/* 结论区 */}
                    <div className="flex-grow text-center sm:text-left">
                        <div className="flex flex-wrap items-center gap-2 mb-3 justify-center sm:justify-start">
                            {recommendation && (
                                <span className={`px-3 py-1 rounded-full text-sm font-bold border ${getRecommendationColor(recommendation)}`}>
                                    {recommendation}
                                </span>
                            )}
                            {consensusLevel && (
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                                    {isZh ? '共识度' : 'Consensus'}: {consensusLevel === 'strong' ? (isZh ? '强' : 'Strong') : consensusLevel === 'moderate' ? (isZh ? '中等' : 'Moderate') : (isZh ? '弱' : 'Weak')}
                                </span>
                            )}
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">{summary}</p>
                    </div>
                </div>
            </motion.div>

            {/* ==================== 四维评分卡片 ==================== */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {report?.academicReview && (
                    <ScoreCard
                        icon={<GraduationCap className="w-5 h-5 text-blue-600" />}
                        label={isZh ? '学术' : 'Academic'}
                        score={report.academicReview.score}
                        color="bg-blue-50"
                        confidence={report.academicReview.confidence}
                    />
                )}
                {report?.industryAnalysis && (
                    <ScoreCard
                        icon={<TrendingUp className="w-5 h-5 text-green-600" />}
                        label={isZh ? '产业' : 'Industry'}
                        score={report.industryAnalysis.score}
                        color="bg-green-50"
                        confidence={report.industryAnalysis.confidence}
                    />
                )}
                {report?.competitorAnalysis && (
                    <ScoreCard
                        icon={<Crosshair className="w-5 h-5 text-red-500" />}
                        label={isZh ? '竞品' : 'Competitor'}
                        score={report.competitorAnalysis.score}
                        color="bg-red-50"
                        confidence={report.competitorAnalysis.confidence}
                    />
                )}
                {report?.innovationEvaluation && (
                    <ScoreCard
                        icon={<Lightbulb className="w-5 h-5 text-amber-500" />}
                        label={isZh ? '创新' : 'Innovation'}
                        score={report.innovationEvaluation.score}
                        color="bg-amber-50"
                        confidence={report.innovationEvaluation.confidence}
                    />
                )}
            </div>

            {/* ==================== NovoStarchart 雷达图 ==================== */}
            {report?.innovationRadar && report.innovationRadar.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/95 border border-gray-200/60 rounded-2xl p-6 mb-6 shadow-sm"
                >
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Award className="w-4 h-4 text-indigo-500" />
                        NovoStarchart {isZh ? '六维创新质量体检' : '6D Innovation Quality Check'}
                    </h3>
                    <RadarChart data={report.innovationRadar} language={language} />
                </motion.div>
            )}

            {/* ==================== 关键发现 ==================== */}
            {keyFindings.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white/95 border border-gray-200/60 rounded-2xl p-6 mb-6 shadow-sm"
                >
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        {isZh ? '关键发现' : 'Key Findings'}
                    </h3>
                    <div className="space-y-2">
                        {keyFindings.map((finding, idx) => (
                            <div key={idx} className="flex items-start gap-2.5">
                                <ChevronRight className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-gray-600 leading-relaxed">{finding}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* ==================== 风险提示 ==================== */}
            {redFlags.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-red-50/50 border border-red-200/60 rounded-2xl p-6 mb-6 shadow-sm"
                >
                    <h3 className="text-sm font-bold text-red-700 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {isZh ? '风险提示' : 'Red Flags'}
                    </h3>
                    <div className="space-y-2">
                        {redFlags.map((flag, idx) => (
                            <div key={idx} className="flex items-start gap-2.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 flex-shrink-0" />
                                <p className="text-sm text-red-600/80">{flag}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* ==================== 相似论文 ==================== */}
            {similarPapers.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white/95 border border-gray-200/60 rounded-2xl p-6 mb-6 shadow-sm"
                >
                    <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-blue-500" />
                        {isZh ? '相关论文' : 'Similar Papers'}
                    </h3>
                    <div className="space-y-3">
                        {similarPapers.slice(0, 4).map((paper: any, idx: number) => (
                            <div key={idx} className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
                                <div className="min-w-0 flex-grow">
                                    <p className="text-sm font-medium text-gray-800 truncate">
                                        {paper.url ? (
                                            <a href={paper.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                                                {paper.title}
                                                <ExternalLink className="w-3 h-3 inline ml-1 opacity-40" />
                                            </a>
                                        ) : paper.title}
                                    </p>
                                    {paper.keyDifference && (
                                        <p className="text-xs text-gray-400 mt-0.5 truncate">{paper.keyDifference}</p>
                                    )}
                                </div>
                                {typeof paper.similarityScore === 'number' && (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${paper.similarityScore >= 70 ? 'bg-red-100 text-red-600' : paper.similarityScore >= 40 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                                        }`}>
                                        {paper.similarityScore}%
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* ==================== 底部提示 ==================== */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-center py-6"
            >
                <p className="text-xs text-gray-400">
                    ⚡ {isZh
                        ? 'Flash 极速报告 — 如需更深度的辩论验证和跨域分析，请使用标准模式'
                        : 'Flash Report — For deeper debate verification and cross-domain analysis, use Standard mode'}
                </p>
            </motion.div>
        </div>
    );
}

export default React.memo(FlashReport);
