'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shell, Star, ArrowRight, Clock, Layers, AlertTriangle } from 'lucide-react';
import type { ClawscanReport } from '@/types/clawscan';

interface ClawscanBridgeReportProps {
    reportData: ClawscanReport;
}

/**
 * Clawscan 桥接补充报告 — 在 Bizscan 报告下方展示 Clawscan 交叉协作结果
 */
export default function ClawscanBridgeReport({ reportData }: ClawscanBridgeReportProps) {
    const { overallScore, grade, verdict, similarSkills, recommendation, metadata } = reportData;

    // 评分颜色映射
    const gradeColors: Record<string, string> = {
        S: 'from-purple-500 to-indigo-600',
        A: 'from-blue-500 to-cyan-500',
        B: 'from-green-500 to-emerald-500',
        C: 'from-amber-500 to-orange-500',
        D: 'from-red-500 to-rose-500',
    };

    const gradientClass = gradeColors[grade] || gradeColors.C;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="w-full max-w-5xl mx-auto mt-8"
        >
            {/* 分隔标题 */}
            <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-100">
                    <Shell className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-bold text-blue-600">OpenClaw 生态评估补充</span>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
            </div>

            <div className="bg-white/95 rounded-3xl border border-white/60 shadow-xl shadow-blue-500/5 p-6 sm:p-8">
                {/* 评分概览 */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-lg`}>
                        <span className="text-2xl font-black text-white">{grade}</span>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-black text-gray-900">Clawscan 查重评分</h3>
                            <span className="text-2xl font-black text-gray-900">{overallScore}</span>
                            <span className="text-sm text-gray-400">/100</span>
                        </div>
                        <p className="text-sm text-gray-500">{verdict}</p>
                    </div>
                    {metadata?.searchTimeMs && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{(metadata.searchTimeMs / 1000).toFixed(1)}s</span>
                        </div>
                    )}
                </div>

                {/* 匹配 Skills */}
                {similarSkills && similarSkills.length > 0 && (
                    <div className="mb-6">
                        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-500" />
                            已有相似 Skills（Top {Math.min(similarSkills.length, 3)}）
                        </h4>
                        <div className="space-y-2">
                            {similarSkills.slice(0, 3).map((skill, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-3 bg-gray-50/80 rounded-xl border border-gray-100"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{skill.name}</p>
                                        <p className="text-xs text-gray-400 truncate">{skill.description}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                                        <div className="flex items-center gap-1">
                                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                            <span className="text-sm font-bold text-gray-700">{skill.similarityPercentage}%</span>
                                        </div>
                                        {skill.githubUrl && (
                                            <a
                                                href={skill.githubUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                                            >
                                                GitHub →
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 落地建议 */}
                {recommendation && (
                    <div className={`p-4 rounded-xl border ${recommendation.type === 'build_new'
                            ? 'bg-green-50/60 border-green-100'
                            : recommendation.type === 'differentiate'
                                ? 'bg-amber-50/60 border-amber-100'
                                : 'bg-blue-50/60 border-blue-100'
                        }`}>
                        <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${recommendation.type === 'build_new'
                                    ? 'bg-green-100'
                                    : recommendation.type === 'differentiate'
                                        ? 'bg-amber-100'
                                        : 'bg-blue-100'
                                }`}>
                                {recommendation.type === 'build_new' ? (
                                    <ArrowRight className="w-4 h-4 text-green-600" />
                                ) : (
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-700 mb-1">{recommendation.text}</p>
                                <p className="text-xs text-gray-500 leading-relaxed">{recommendation.details}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 数据源信息 */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span>评估模式：{metadata?.mode === 'full' ? '完整 4-Agent' : 'Lite 2-Agent'}</span>
                    <span>•</span>
                    <span>数据源：{metadata?.dataSourcesUsed?.join(', ') || 'ClawHub Registry'}</span>
                    {metadata?.candidatesEvaluated !== undefined && (
                        <>
                            <span>•</span>
                            <span>候选评估：{metadata.candidatesEvaluated} 个</span>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
