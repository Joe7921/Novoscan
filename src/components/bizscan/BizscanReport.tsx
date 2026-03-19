'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { Variants, Easing } from 'framer-motion';
import {
    AlertTriangle, CheckCircle, Info, TrendingUp, TrendingDown,
    Shield, Target, Lightbulb, Zap, Clock, Database, Cpu,
    ChevronRight, Minus, ArrowUpRight,
} from 'lucide-react';
import AntigravityCard from '@/components/antigravity/AntigravityCard';
import AgentRawDisplay from '@/components/agent/AgentRawDisplay';
import type { AgentRawItem } from '@/components/agent/AgentRawDisplay';
import type { BizscanReport as BizscanReportType, DimensionAssessment, DimensionResults, CompetitorInfo } from '@/types/bizscan';

interface BizscanReportProps {
    reportData: BizscanReportType;
}

// ============================================================
//  配色与图标映射
// ============================================================

const GRADE_CONFIG = {
    S: { color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', ring: 'ring-purple-400', label: '颠覆性创新' },
    A: { color: 'text-novo-green', bg: 'bg-novo-green/10', border: 'border-novo-green/30', ring: 'ring-novo-green', label: '高度创新' },
    B: { color: 'text-novo-blue', bg: 'bg-novo-blue/10', border: 'border-novo-blue/30', ring: 'ring-novo-blue', label: '具备创新' },
    C: { color: 'text-novo-yellow', bg: 'bg-amber-50', border: 'border-amber-200', ring: 'ring-amber-400', label: '创新一般' },
    D: { color: 'text-novo-red', bg: 'bg-novo-red/10', border: 'border-novo-red/30', ring: 'ring-novo-red', label: '创新不足' },
};

const DIMENSION_META = {
    semanticNovelty: { label: '语义新颖度', icon: Lightbulb, color: 'text-amber-500', bg: 'bg-amber-500' },
    competitiveLandscape: { label: '竞争态势', icon: Target, color: 'text-novo-blue', bg: 'bg-novo-blue' },
    marketGap: { label: '市场空白', icon: TrendingUp, color: 'text-novo-green', bg: 'bg-novo-green' },
    feasibility: { label: '可行性', icon: Shield, color: 'text-purple-500', bg: 'bg-purple-500' },
};

const SATURATION_LABELS: Record<string, { label: string; color: string }> = {
    'oversaturated': { label: '过度饱和', color: 'text-novo-red' },
    'crowded': { label: '竞争拥挤', color: 'text-orange-500' },
    'moderate': { label: '适度竞争', color: 'text-novo-yellow' },
    'emerging': { label: '新兴市场', color: 'text-novo-blue' },
    'blue-ocean': { label: '蓝海市场', color: 'text-novo-green' },
};

const TREND_LABELS: Record<string, { label: string; icon: typeof TrendingUp }> = {
    'explosive': { label: '爆发增长', icon: TrendingUp },
    'growing': { label: '稳步增长', icon: TrendingUp },
    'stable': { label: '平稳', icon: Minus },
    'declining': { label: '下降趋势', icon: TrendingDown },
};

const THREAT_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
    high: { color: 'text-novo-red', bg: 'bg-novo-red/10', label: '高威胁' },
    medium: { color: 'text-amber-600', bg: 'bg-amber-50', label: '中等威胁' },
    low: { color: 'text-novo-green', bg: 'bg-novo-green/10', label: '低威胁' },
};

// 入场动画变体
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as Easing } },
};

function getScoreBarGradient(score: number): string {
    if (score >= 80) return 'from-green-400 to-emerald-500';
    if (score >= 60) return 'from-blue-400 to-cyan-500';
    if (score >= 40) return 'from-amber-400 to-yellow-500';
    return 'from-red-400 to-orange-500';
}

// ============================================================
//  简易雷达图（纯 SVG）
// ============================================================

function SimpleRadarChart({ dimensions }: { dimensions: DimensionResults }) {
    const labels = Object.keys(dimensions) as (keyof typeof DIMENSION_META)[];
    const n = labels.length;
    const cx = 120, cy = 120, maxR = 90;
    const angleStep = (2 * Math.PI) / n;

    // 网格层
    const gridLevels = [0.25, 0.5, 0.75, 1.0];

    // 计算数据点
    const dataPoints = labels.map((key, i) => {
        const angle = -Math.PI / 2 + i * angleStep;
        const r = (dimensions[key].score / 100) * maxR;
        return {
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle),
            labelX: cx + (maxR + 28) * Math.cos(angle),
            labelY: cy + (maxR + 28) * Math.sin(angle),
            label: DIMENSION_META[key]?.label || key,
            score: dimensions[key].score,
        };
    });

    const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z';

    return (
        <svg viewBox="0 0 240 240" className="w-full max-w-[200px] sm:max-w-[280px] mx-auto" role="img" aria-label="创新度四维雷达图">
            {/* 网格 */}
            {gridLevels.map(level => {
                const points = labels.map((_, i) => {
                    const angle = -Math.PI / 2 + i * angleStep;
                    const r = level * maxR;
                    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
                }).join(' ');
                return <polygon key={level} points={points} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />;
            })}
            {/* 轴线 */}
            {labels.map((_, i) => {
                const angle = -Math.PI / 2 + i * angleStep;
                return (
                    <line key={i}
                        x1={cx} y1={cy}
                        x2={cx + maxR * Math.cos(angle)} y2={cy + maxR * Math.sin(angle)}
                        stroke="#e5e7eb" strokeWidth="0.5"
                    />
                );
            })}
            {/* 数据多边形 */}
            <motion.path
                d={dataPath}
                fill="rgba(245,158,11,0.15)"
                stroke="rgb(245,158,11)"
                strokeWidth="2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.8 }}
            />
            {/* 数据点 */}
            {dataPoints.map((p, i) => (
                <motion.circle key={i} cx={p.x} cy={p.y} r="4"
                    fill="rgb(245,158,11)" stroke="white" strokeWidth="2"
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                />
            ))}
            {/* 标签 */}
            {dataPoints.map((p, i) => (
                <text key={`label-${i}`} x={p.labelX} y={p.labelY}
                    textAnchor="middle" dominantBaseline="middle"
                    className="fill-gray-600 text-[9px] font-bold"
                >
                    {p.label} ({p.score})
                </text>
            ))}
        </svg>
    );
}

// ============================================================
//  主报告组件
// ============================================================

export default function BizscanReport({ reportData }: BizscanReportProps) {
    if (!reportData) return null;

    const gradeConfig = GRADE_CONFIG[reportData.grade] || GRADE_CONFIG.C;
    const saturation = SATURATION_LABELS[reportData.marketInsights.saturationLevel] || SATURATION_LABELS.moderate;
    const trend = TREND_LABELS[reportData.marketInsights.growthTrend] || TREND_LABELS.stable;
    const TrendIcon = trend.icon;

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-5xl mx-auto space-y-6 pb-20"
        >
            {/* A. 元数据统计栏 */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                <div className="bg-white/95 rounded-2xl border border-gray-100 p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-gray-400 text-xs font-bold mb-1">
                        <Database className="w-3.5 h-3.5" />
                        数据源
                    </div>
                    <div className="text-2xl font-black text-gray-900">
                        {reportData.metadata.dataSourcesUsed.length}
                    </div>
                </div>
                <div className="bg-white/95 rounded-2xl border border-gray-100 p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-gray-400 text-xs font-bold mb-1">
                        <Cpu className="w-3.5 h-3.5" />
                        竞品发现
                    </div>
                    <div className="text-2xl font-black text-novo-blue">
                        {reportData.metadata.competitorsFound}
                    </div>
                </div>
                <div className="bg-white/95 rounded-2xl border border-gray-100 p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-gray-400 text-xs font-bold mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        分析耗时
                    </div>
                    <div className="text-2xl font-black text-novo-green">
                        {(reportData.metadata.searchTimeMs / 1000).toFixed(1)}s
                    </div>
                </div>
            </motion.div>

            {/* B. BII 指数核心卡片 */}
            <motion.div variants={itemVariants}>
                <AntigravityCard className={`!p-6 sm:!p-8 ${gradeConfig.bg} ${gradeConfig.border}`}>
                    <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
                        {/* 大圆环仪表盘 */}
                        <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex-shrink-0">
                            <svg viewBox="0 0 120 120" className="w-full h-full" role="img" aria-label={`BII 指数 ${reportData.overallBII}`}>
                                <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                                <motion.circle
                                    cx="60" cy="60" r="52" fill="none"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 52}`}
                                    className={gradeConfig.color}
                                    initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                                    animate={{
                                        strokeDashoffset: 2 * Math.PI * 52 * (1 - reportData.overallBII / 100),
                                    }}
                                    transition={{ duration: 1.5, ease: 'easeOut' }}
                                    transform="rotate(-90 60 60)"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className={`text-4xl sm:text-5xl font-black ${gradeConfig.color}`}>
                                    {reportData.overallBII}
                                </span>
                                <span className="text-xs text-gray-400 font-bold">BII 指数</span>
                            </div>
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <div className="flex items-center gap-3 justify-center md:justify-start mb-3">
                                <span className={`text-5xl font-black ${gradeConfig.color}`}>
                                    {reportData.grade}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${gradeConfig.bg} ${gradeConfig.color} border ${gradeConfig.border}`}>
                                    {gradeConfig.label}
                                </span>
                            </div>
                            <p className="text-gray-700 font-bold text-lg leading-relaxed">
                                {reportData.verdict}
                            </p>
                        </div>
                    </div>
                </AntigravityCard>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    {/* C. 四维评分详情 */}
                    <motion.div variants={itemVariants}>
                        <AntigravityCard className="!p-6 space-y-5">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Zap className="w-6 h-6 text-amber-500" />
                                四维创新度评分
                            </h3>

                            {(Object.entries(reportData.dimensions) as [keyof typeof DIMENSION_META, DimensionAssessment][]).map(
                                ([key, dim]) => {
                                    const meta = DIMENSION_META[key];
                                    if (!meta) return null;
                                    const Icon = meta.icon;
                                    return (
                                        <motion.div
                                            key={key}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="p-4 rounded-2xl bg-gray-50 border border-gray-100"
                                        >
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg ${meta.bg}/10 ${meta.color}`}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-bold text-gray-900">{meta.label}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${dim.grade === 'A' ? 'text-novo-green bg-novo-green/10 border-novo-green/20' :
                                                        dim.grade === 'B' ? 'text-novo-blue bg-novo-blue/10 border-novo-blue/20' :
                                                            dim.grade === 'C' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                                                'text-novo-red bg-novo-red/10 border-novo-red/20'
                                                        }`}>
                                                        {dim.grade}
                                                    </span>
                                                    <span className="text-lg font-black text-gray-900">{dim.score}</span>
                                                </div>
                                            </div>

                                            {/* 分数条 */}
                                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                                                <motion.div
                                                    className={`h-full rounded-full bg-gradient-to-r ${getScoreBarGradient(dim.score)}`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${dim.score}%` }}
                                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                                />
                                            </div>

                                            <p className="text-sm text-gray-600 mb-2">{dim.reasoning}</p>

                                            {/* 支擑证据 */}
                                            {dim.evidence?.length > 0 && (
                                                <div className="mb-2">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {dim.evidence.map((ev: string, i: number) => (
                                                            <span key={i} className="px-2 py-0.5 bg-white border border-gray-200 rounded-full text-[10px] font-bold text-gray-600 shadow-sm">
                                                                ✓ {ev}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {dim.risks.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {dim.risks.map((risk, i) => (
                                                        <span key={i} className="px-2 py-0.5 bg-red-50 border border-red-100 rounded-full text-[10px] font-bold text-red-500">
                                                            ⚠ {risk}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                }
                            )}
                        </AntigravityCard>
                    </motion.div>

                    {/* D. 竞品对标列表 */}
                    {reportData.competitors.length > 0 && (
                        <motion.div variants={itemVariants}>
                            <AntigravityCard className="!p-6 space-y-4">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Target className="w-6 h-6 text-novo-blue" />
                                    竞品对标分析 ({reportData.competitors.length})
                                </h3>
                                <div className="space-y-3">
                                    {reportData.competitors.map((comp: CompetitorInfo, idx: number) => {
                                        const threat = THREAT_CONFIG[comp.threatLevel] || THREAT_CONFIG.medium;
                                        return (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.08 }}
                                                className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-amber-300/50 hover:shadow-md transition-all group"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            {comp.url ? (
                                                                <a href={comp.url} target="_blank" rel="noopener noreferrer"
                                                                    className="text-base font-bold text-gray-900 group-hover:text-amber-600 flex items-center gap-1 transition-colors">
                                                                    {comp.name}
                                                                    <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                </a>
                                                            ) : (
                                                                <span className="text-base font-bold text-gray-900">{comp.name}</span>
                                                            )}
                                                            {comp.fundingStage && (
                                                                <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] font-bold text-gray-500">
                                                                    {comp.fundingStage}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black ${threat.bg} ${threat.color} border`}>
                                                        {threat.label}
                                                    </span>
                                                </div>

                                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">{comp.description}</p>

                                                {/* 相似度条 */}
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                        <motion.div
                                                            className={`h-full rounded-full bg-gradient-to-r ${getScoreBarGradient(100 - comp.similarityScore)}`}
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${comp.similarityScore}%` }}
                                                            transition={{ duration: 0.6, delay: idx * 0.1 }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-500 w-10 text-right">
                                                        {comp.similarityScore}%
                                                    </span>
                                                </div>

                                                {comp.keyDifference && (
                                                    <p className="text-xs text-gray-400 mt-2 italic">
                                                        差异点: {comp.keyDifference}
                                                    </p>
                                                )}

                                                {/* 重叠能力标签 + 融资规模 */}
                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    {comp.estimatedFunding && (
                                                        <span className="px-2 py-0.5 bg-green-50 border border-green-100 rounded-full text-[10px] font-bold text-green-600">
                                                            💰 {comp.estimatedFunding}
                                                        </span>
                                                    )}
                                                    {(comp.keyOverlap || []).slice(0, 3).map((overlap: string, oi: number) => (
                                                        <span key={oi} className="px-2 py-0.5 bg-orange-50 border border-orange-100 rounded-full text-[10px] font-bold text-orange-600">
                                                            {overlap}
                                                        </span>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </AntigravityCard>
                        </motion.div>
                    )}

                    {/* Agent 原话展示 */}
                    {(() => {
                        const AGENT_NAMES: Record<string, string> = {
                            semanticNovelty: '新颖度审计员 (NoveltyAuditor)',
                            competitiveLandscape: '竞品拆解师 (CompetitorProfiler)',
                            marketGap: '市场侦察员 (MarketScout)',
                            feasibility: '可行性审查员 (FeasibilityExaminer)',
                        };
                        const agentItems: AgentRawItem[] = (Object.entries(reportData.dimensions) as [string, DimensionAssessment][])
                            .filter(([, dim]) => dim.agentRawText && dim.agentRawText.trim().length > 0)
                            .map(([key, dim]) => ({
                                agentName: AGENT_NAMES[key] || key,
                                rawText: dim.agentRawText!,
                            }));
                        return agentItems.length > 0 ? (
                            <motion.div variants={itemVariants}>
                                <AgentRawDisplay
                                    items={agentItems}
                                    title="✨ 查看 Agent 深度分析原文"
                                />
                            </motion.div>
                        ) : null;
                    })()}

                    {/* 交叉验证摘要 */}
                    {reportData.crossValidation && (
                        <motion.div variants={itemVariants}>
                            <AntigravityCard className="!p-6 space-y-4">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Shield className="w-6 h-6 text-emerald-500" />
                                    交叉验证报告
                                    {reportData.consensusLevel && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${reportData.consensusLevel === 'strong' ? 'text-novo-green bg-novo-green/10 border-novo-green/20' :
                                            reportData.consensusLevel === 'moderate' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                                'text-novo-red bg-novo-red/10 border-novo-red/20'
                                            }`}>
                                            {reportData.consensusLevel === 'strong' ? '强共识' :
                                                reportData.consensusLevel === 'moderate' ? '中共识' : '弱共识'}
                                        </span>
                                    )}
                                </h3>

                                {/* 一致性评分 */}
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                                    <span className="text-sm font-bold text-gray-500">内部一致性</span>
                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <motion.div
                                            className={`h-full rounded-full bg-gradient-to-r ${getScoreBarGradient(reportData.crossValidation.consistencyScore)}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${reportData.crossValidation.consistencyScore}%` }}
                                            transition={{ duration: 0.8 }}
                                        />
                                    </div>
                                    <span className="text-sm font-black text-gray-900">{reportData.crossValidation.consistencyScore}/100</span>
                                </div>

                                {/* 分歧点 */}
                                {reportData.crossValidation.divergences?.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-xs font-bold text-gray-500">专家分歧点</h4>
                                        {reportData.crossValidation.divergences.map((d: unknown, i: number) => (
                                            <div key={i} className="p-3 rounded-lg bg-amber-50/50 border border-amber-100 text-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-gray-700">{d.dimension}</span>
                                                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Δ{d.scoreDelta}分</span>
                                                </div>
                                                <p className="text-xs text-gray-500">{d.resolution}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 证据冲突 */}
                                {reportData.crossValidation.evidenceConflicts?.length > 0 && (
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-bold text-novo-red">证据冲突</h4>
                                        {reportData.crossValidation.evidenceConflicts.map((c: string, i: number) => (
                                            <p key={i} className="text-xs text-gray-500">• {c}</p>
                                        ))}
                                    </div>
                                )}
                            </AntigravityCard>
                        </motion.div>
                    )}
                </div>

                {/* 右侧面板 */}
                <motion.div variants={itemVariants} className="md:col-span-1 space-y-6">
                    {/* E. 雷达图 */}
                    <AntigravityCard className="!p-6">
                        <h3 className="text-base font-bold text-gray-900 mb-4">创新度雷达图</h3>
                        <SimpleRadarChart dimensions={reportData.dimensions} />
                    </AntigravityCard>

                    {/* F. 市场洞察 */}
                    <AntigravityCard className="!p-6">
                        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-novo-green" />
                            市场洞察
                        </h3>
                        <div className="space-y-3">
                            {reportData.marketInsights.marketSize && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-400 font-bold">市场规模</span>
                                    <span className="font-bold text-gray-900">
                                        {reportData.marketInsights.marketSize}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 font-bold">增长趋势</span>
                                <span className="flex items-center gap-1 font-bold text-gray-900">
                                    <TrendIcon className="w-4 h-4" />
                                    {trend.label}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-400 font-bold">市场饱和度</span>
                                <span className={`font-bold ${saturation.color}`}>
                                    {saturation.label}
                                </span>
                            </div>
                        </div>
                    </AntigravityCard>

                    {/* G. AI 战略建议 */}
                    <AntigravityCard className="!p-6 border-t-4 border-amber-400">
                        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-amber-500" />
                            战略建议
                        </h3>

                        {reportData.strategicAdvice && (
                            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                {reportData.strategicAdvice}
                            </p>
                        )}

                        {reportData.recommendations.length > 0 && (
                            <div className="space-y-2 mb-4">
                                {reportData.recommendations.map((rec, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm">
                                        <ChevronRight className="w-4 h-4 text-novo-green flex-shrink-0 mt-0.5" />
                                        <span className="text-gray-700">{rec}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 风险红旗 */}
                        {reportData.riskWarnings.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-novo-red mb-2 flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    风险提示
                                </h4>
                                <div className="space-y-1.5">
                                    {reportData.riskWarnings.map((warn, i) => (
                                        <p key={i} className="text-xs text-gray-500 leading-relaxed">
                                            • {warn}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI 分析元信息 */}
                        <p className="text-[10px] text-gray-400 text-center mt-4 font-mono">
                            powered by {reportData.metadata.modelUsed} •{' '}
                            {reportData.metadata.dataSourcesUsed.join(' + ')} •{' '}
                            {(reportData.metadata.searchTimeMs / 1000).toFixed(1)}s
                        </p>
                    </AntigravityCard>

                    {/* H. 解析的商业要素 */}
                    <AntigravityCard className="!p-6">
                        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Info className="w-5 h-5 text-gray-400" />
                            AI 提取的商业要素
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="text-gray-400 font-bold block mb-0.5">问题定义</span>
                                <p className="text-gray-700">{reportData.parsedIdea.problemStatement}</p>
                            </div>
                            <div>
                                <span className="text-gray-400 font-bold block mb-0.5">解决方案</span>
                                <p className="text-gray-700">{reportData.parsedIdea.proposedSolution}</p>
                            </div>
                            <div>
                                <span className="text-gray-400 font-bold block mb-0.5">盈利模式</span>
                                <p className="text-gray-700">{reportData.parsedIdea.revenueModel}</p>
                            </div>
                            {reportData.parsedIdea.keyDifferentiators.length > 0 && (
                                <div>
                                    <span className="text-gray-400 font-bold block mb-1">差异化亮点</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {reportData.parsedIdea.keyDifferentiators.map((d, i) => (
                                            <span key={i} className="px-2 py-0.5 bg-amber-50 border border-amber-100 rounded-full text-[10px] font-bold text-amber-600">
                                                {d}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {reportData.parsedIdea.industryTags.length > 0 && (
                                <div>
                                    <span className="text-gray-400 font-bold block mb-1">行业标签</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {reportData.parsedIdea.industryTags.map((t, i) => (
                                            <span key={i} className="px-2 py-0.5 bg-novo-blue/5 border border-novo-blue/10 rounded-full text-[10px] font-bold text-novo-blue">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* 目标客户 */}
                            {reportData.parsedIdea.targetCustomer && (
                                <div>
                                    <span className="text-gray-400 font-bold block mb-0.5">目标客户</span>
                                    <p className="text-gray-700">{reportData.parsedIdea.targetCustomer}</p>
                                </div>
                            )}
                            {/* 价值主张 */}
                            {reportData.parsedIdea.valueProposition && (
                                <div>
                                    <span className="text-gray-400 font-bold block mb-0.5">核心价值主张</span>
                                    <p className="text-gray-700">{reportData.parsedIdea.valueProposition}</p>
                                </div>
                            )}
                            {/* 技术栈 */}
                            {reportData.parsedIdea.technologyStack?.length > 0 && (
                                <div>
                                    <span className="text-gray-400 font-bold block mb-1">技术栈</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {reportData.parsedIdea.technologyStack.map((t, i) => (
                                            <span key={i} className="px-2 py-0.5 bg-purple-50 border border-purple-100 rounded-full text-[10px] font-bold text-purple-600">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </AntigravityCard>
                </motion.div>
            </div>
        </motion.div>
    );
}
