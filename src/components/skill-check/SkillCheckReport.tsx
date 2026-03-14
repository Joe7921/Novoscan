import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, Download, GitMerge, FileCode, Check, X, ArrowRight, Clock, Database, Cpu, Zap, Globe, ExternalLink } from 'lucide-react';
import AntigravityCard from '@/components/antigravity/AntigravityCard';
import AntigravityButton from '@/components/antigravity/AntigravityButton';
import AgentRawDisplay from '@/components/agent/AgentRawDisplay';

interface SkillCheckReportProps {
    reportData: unknown;
}

const LEVEL_CONFIG = {
    danger: { icon: AlertTriangle, color: 'text-google-red', bg: 'bg-google-red/10', border: 'border-google-red/30', barGradient: 'from-red-500 to-orange-500' },
    warning: { icon: AlertTriangle, color: 'text-google-yellow', bg: 'bg-google-yellow/10', border: 'border-google-yellow/30', barGradient: 'from-yellow-500 to-orange-400' },
    info: { icon: Info, color: 'text-google-blue', bg: 'bg-google-blue/10', border: 'border-google-blue/30', barGradient: 'from-blue-500 to-cyan-400' },
    success: { icon: CheckCircle, color: 'text-google-green', bg: 'bg-google-green/10', border: 'border-google-green/30', barGradient: 'from-green-500 to-emerald-400' },
};

function getBarGradient(pct: number): string {
    if (pct >= 70) return 'from-red-500 to-orange-500';
    if (pct >= 40) return 'from-orange-400 to-yellow-400';
    if (pct >= 15) return 'from-blue-400 to-cyan-400';
    return 'from-gray-300 to-gray-400';
}

function getSimBadgeStyle(pct: number): string {
    if (pct >= 70) return 'text-google-red bg-google-red/10 border-google-red/20';
    if (pct >= 40) return 'text-orange-600 bg-orange-100 border-orange-200';
    if (pct >= 15) return 'text-google-blue bg-google-blue/10 border-google-blue/20';
    return 'text-gray-500 bg-gray-100 border-gray-200';
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } }
};

export default function SkillCheckReport({ reportData }: SkillCheckReportProps) {
    if (!reportData) return null;

    // 映射 duplication level 到 UI config
    let configLevel: keyof typeof LEVEL_CONFIG = 'info';
    if (reportData.duplicationLevel === 'high') configLevel = 'danger';
    else if (reportData.duplicationLevel === 'medium') configLevel = 'warning';
    else if (reportData.duplicationLevel === 'low') configLevel = 'info';
    else if (reportData.duplicationLevel === 'none') configLevel = 'success';

    const config = LEVEL_CONFIG[configLevel];
    const StatusIcon = config.icon;

    // 建议配色
    let SuggestionIcon = Info;
    const recType = reportData.recommendation?.type;
    if (recType === 'differentiate') SuggestionIcon = GitMerge;
    if (recType === 'build_new') SuggestionIcon = FileCode;
    if (recType === 'use_existing') SuggestionIcon = Download;

    let suggestionColor = 'text-google-blue';
    let suggestionBg = 'bg-google-blue';
    if (recType === 'use_existing') { suggestionColor = 'text-google-green'; suggestionBg = 'bg-google-green'; }
    else if (recType === 'differentiate') { suggestionColor = 'text-google-yellow'; suggestionBg = 'bg-google-yellow'; }

    const meta = reportData.metadata || {};
    const searchTimeMs = meta.searchTimeMs || 0;
    const registrySize = meta.registrySize || 0;
    const webResultsFound = meta.webResultsFound || 0;

    // 等级映射
    const gradeColors: Record<string, string> = {
        S: 'text-purple-600 bg-purple-50 border-purple-200', A: 'text-google-green bg-green-50 border-green-200',
        B: 'text-google-blue bg-blue-50 border-blue-200', C: 'text-orange-600 bg-orange-50 border-orange-200',
        D: 'text-google-red bg-red-50 border-red-200',
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-5xl mx-auto space-y-6 pb-20"
        >
            {/* A. 元数据统计栏 */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-white/95 rounded-2xl border border-gray-100 p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-gray-400 text-xs font-bold mb-1">
                        <Database className="w-3.5 h-3.5" />
                        Registry
                    </div>
                    <div className="text-2xl font-black text-gray-900">{registrySize.toLocaleString()}</div>
                </div>
                <div className="bg-white/95 rounded-2xl border border-gray-100 p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-gray-400 text-xs font-bold mb-1">
                        <Globe className="w-3.5 h-3.5" />
                        网络案例
                    </div>
                    <div className="text-2xl font-black text-google-blue">{webResultsFound}</div>
                </div>
                <div className="bg-white/95 rounded-2xl border border-gray-100 p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-gray-400 text-xs font-bold mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        分析耗时
                    </div>
                    <div className="text-2xl font-black text-google-green">{(searchTimeMs / 1000).toFixed(1)}s</div>
                </div>
                <div className="bg-white/95 rounded-2xl border border-gray-100 p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-gray-400 text-xs font-bold mb-1">
                        <Cpu className="w-3.5 h-3.5" />
                        评级
                    </div>
                    <div className={`text-2xl font-black px-3 py-0.5 rounded-lg inline-block border ${gradeColors[reportData.grade] || 'text-gray-500'}`}>
                        {reportData.grade}
                    </div>
                </div>
            </motion.div>

            {/* B. 综合评估卡片 */}
            <motion.div variants={itemVariants}>
                <AntigravityCard className={`!p-6 sm:!p-8 ${config.bg} ${config.border} flex flex-col md:flex-row items-start md:items-center gap-6`}>
                    <div className={`p-4 rounded-full bg-white/95 ${config.color} shadow-sm`}>
                        <StatusIcon className="w-10 h-10" />
                    </div>
                    <div className="flex-1">
                        <h2 className={`text-2xl font-black mb-2 ${config.color}`}>{reportData.verdict || '评估完成'}</h2>
                        <p className="text-gray-700 font-medium text-lg leading-relaxed">
                            综合查重分数 <span className="font-black">{reportData.overallScore}/100</span>
                            {reportData.strategicAdvice && ` — ${reportData.strategicAdvice.slice(0, 100)}`}
                        </p>
                    </div>
                </AntigravityCard>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    {/* C. 现成方案列表 */}
                    {reportData.similarSkills?.length > 0 && (
                        <motion.div variants={itemVariants}>
                            <AntigravityCard className="!p-6 space-y-4">
                                <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                                    <FileCode className="w-6 h-6 text-google-blue" />
                                    ClawHub 同类方案 ({reportData.similarSkills.length})
                                </h3>
                                <div className="space-y-4">
                                    {reportData.similarSkills.map((skill: unknown, idx: number) => {
                                        const pct = skill.similarityPercentage ?? 0;
                                        const badgeStyle = getSimBadgeStyle(pct);
                                        const barGradient = getBarGradient(pct);
                                        return (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.08 }}
                                                className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-google-blue/30 hover:shadow-md transition-all group"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <a href={skill.githubUrl} target="_blank" rel="noopener noreferrer" className="text-lg font-bold text-gray-900 group-hover:text-google-blue flex items-center gap-2 transition-colors">
                                                            {skill.author}/{skill.name}
                                                            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                        </a>
                                                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 font-medium">
                                                            <span className="flex items-center gap-1"><Download className="w-4 h-4" /> {skill.installs} 安装</span>
                                                        </div>
                                                    </div>
                                                    <span className={`px-3 py-1.5 rounded-full font-black text-sm whitespace-nowrap border ${badgeStyle}`}>
                                                        {pct}% 相似
                                                    </span>
                                                </div>
                                                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${pct}%` }}
                                                        transition={{ duration: 0.8, delay: idx * 0.1, ease: 'easeOut' }}
                                                        className={`h-full rounded-full bg-gradient-to-r ${barGradient}`}
                                                    />
                                                </div>
                                                {skill.description && <p className="text-sm text-gray-600 mb-2 leading-relaxed line-clamp-2">{skill.description}</p>}
                                                {skill.reason && (
                                                    <div className="flex items-center gap-1.5 mb-2">
                                                        <Zap className="w-3 h-3 text-google-yellow" />
                                                        <p className="text-xs text-gray-400 italic">AI 判断：{skill.reason}</p>
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(skill.matchedFeatures || []).map((f: string, i: number) => (
                                                        <span key={i} className="px-2.5 py-1 bg-white border border-gray-200 rounded-full text-[11px] font-bold text-gray-600 shadow-sm">{f}</span>
                                                    ))}
                                                    {(skill.tags || []).slice(0, 3).map((t: string, i: number) => (
                                                        <span key={`tag-${i}`} className="px-2.5 py-1 bg-google-blue/5 border border-google-blue/10 rounded-full text-[11px] font-bold text-google-blue">{t}</span>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </AntigravityCard>
                        </motion.div>
                    )}

                    {/* D. 实战案例 */}
                    {reportData.caseStudies?.length > 0 && (
                        <motion.div variants={itemVariants}>
                            <AntigravityCard className="!p-6 space-y-4">
                                <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
                                    <Globe className="w-6 h-6 text-google-green" />
                                    落地实战案例 ({reportData.caseStudies.length})
                                </h3>
                                <div className="space-y-3">
                                    {reportData.caseStudies.map((cs: unknown, idx: number) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.08 }}
                                            className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-google-green/30 hover:shadow-md transition-all group"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <a href={cs.url} target="_blank" rel="noopener noreferrer" className="text-base font-bold text-gray-900 group-hover:text-google-green flex items-center gap-2 transition-colors flex-1 min-w-0">
                                                    <span className="truncate">{cs.title}</span>
                                                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                </a>
                                                <span className={`px-2.5 py-1 rounded-full font-black text-xs whitespace-nowrap border ml-3 ${getSimBadgeStyle(cs.relevanceScore)}`}>
                                                    {cs.relevanceScore}% 相关
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 leading-relaxed">{cs.keyInsight}</p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                                {cs.technologyUsed && <span className="px-2 py-0.5 bg-purple-50 border border-purple-100 rounded-full text-purple-600 font-bold">{cs.technologyUsed}</span>}
                                                {cs.deploymentScale && <span className="px-2 py-0.5 bg-orange-50 border border-orange-100 rounded-full text-orange-600 font-bold">{cs.deploymentScale}</span>}
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </AntigravityCard>
                        </motion.div>
                    )}

                    {/* E. 功能覆盖对比 */}
                    {reportData.featureCoverage?.length > 0 && (
                        <motion.div variants={itemVariants}>
                            <AntigravityCard className="!p-6">
                                <h3 className="text-xl font-bold mb-6">核心功能点覆盖分析</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="py-3 px-4 font-bold text-gray-500">功能点</th>
                                                <th className="py-3 px-4 font-bold text-gray-500 text-center">你的需求</th>
                                                <th className="py-3 px-4 font-bold text-gray-500 text-center">已有方案覆盖</th>
                                                <th className="py-3 px-4 font-bold text-gray-500">覆盖来源</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportData.featureCoverage.map((row: unknown, idx: number) => (
                                                <motion.tr
                                                    key={idx}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: 0.3 + idx * 0.05 }}
                                                    className="border-b border-gray-50 hover:bg-gray-50/50"
                                                >
                                                    <td className="py-4 px-4 font-medium text-gray-900">{row.feature}</td>
                                                    <td className="py-4 px-4 text-center">
                                                        {row.required ? <Check className="w-5 h-5 text-gray-900 mx-auto" /> : <span className="text-gray-400">-</span>}
                                                    </td>
                                                    <td className="py-4 px-4 text-center">
                                                        {row.covered ?
                                                            <CheckCircle className="w-5 h-5 text-google-green mx-auto" /> :
                                                            <X className="w-5 h-5 text-google-red mx-auto" />
                                                        }
                                                    </td>
                                                    <td className="py-4 px-4 text-sm font-bold text-gray-500">{row.coveredBy}</td>
                                                </motion.tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </AntigravityCard>
                        </motion.div>
                    )}

                    {/* Agent 原话展示 */}
                    {reportData.agentOutputs && (
                        <motion.div variants={itemVariants}>
                            <AgentRawDisplay
                                items={[
                                    { agentName: 'Registry 侦察员', rawText: reportData.agentOutputs.registryScout?.analysis || '' },
                                    { agentName: '实战案例分析师', rawText: reportData.agentOutputs.caseAnalyst?.analysis || '' },
                                    { agentName: '创新度审计师', rawText: reportData.agentOutputs.noveltyAuditor?.analysis || '' },
                                    { agentName: '战略仲裁官', rawText: reportData.agentOutputs.strategicArbiter?.analysis || '' },
                                ].filter(item => item.rawText)}
                                title="✨ 查看 Agent 分析推理过程"
                            />
                        </motion.div>
                    )}
                </div>

                {/* F. 建议 */}
                <motion.div variants={itemVariants} className="md:col-span-1">
                    <AntigravityCard className="!p-6 sticky top-24 border-t-4" style={{ borderTopColor: `var(--${suggestionColor.replace('text-', '')})` }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`p-2 rounded-xl ${suggestionBg}/10 ${suggestionColor}`}>
                                <SuggestionIcon className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-black text-gray-900">战略仲裁官建议</h3>
                        </div>

                        <div className="space-y-4 mb-8">
                            <h4 className={`text-xl font-bold ${suggestionColor}`}>
                                {reportData.recommendation?.text}
                            </h4>
                            <p className="text-gray-600 font-medium leading-relaxed">
                                {reportData.recommendation?.details}
                            </p>
                        </div>

                        {/* AI 提取信息 */}
                        {reportData.parsedIdea && (
                            <div className="mb-6 space-y-3">
                                {reportData.parsedIdea.platform && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-400 font-bold">平台</span>
                                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-bold text-gray-600">{reportData.parsedIdea.platform}</span>
                                    </div>
                                )}
                                {reportData.parsedIdea.category && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-400 font-bold">类别</span>
                                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-bold text-gray-600">{reportData.parsedIdea.category}</span>
                                    </div>
                                )}
                                {reportData.parsedIdea.coreCapabilities?.length > 0 && (
                                    <div>
                                        <span className="text-gray-400 font-bold text-sm block mb-1.5">核心能力点</span>
                                        <div className="space-y-1">
                                            {reportData.parsedIdea.coreCapabilities.map((feat: string, i: number) => (
                                                <div key={i} className="flex items-center gap-2 text-sm">
                                                    <Zap className="w-3 h-3 text-google-yellow flex-shrink-0" />
                                                    <span className="text-gray-600 font-medium">{feat}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {reportData.parsedIdea.searchKeywords?.length > 0 && (
                                    <div>
                                        <span className="text-gray-400 font-bold text-sm block mb-1.5">搜索关键词</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {reportData.parsedIdea.searchKeywords.map((kw: string, i: number) => (
                                                <span key={i} className="px-2 py-0.5 bg-google-blue/5 border border-google-blue/10 rounded-full text-[11px] font-bold text-google-blue">{kw}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 风险警告 */}
                        {reportData.riskWarnings?.length > 0 && (
                            <div className="mb-6">
                                <span className="text-gray-400 font-bold text-sm block mb-1.5">⚠️ 风险提示</span>
                                <div className="space-y-1">
                                    {reportData.riskWarnings.map((w: string, i: number) => (
                                        <p key={i} className="text-xs text-orange-600 font-medium">• {w}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <AntigravityButton
                            variant="primary"
                            className="w-full !bg-gray-900 hover:!bg-google-blue"
                        >
                            {reportData.recommendation?.actionText || '查看详情'}
                        </AntigravityButton>

                        {meta.modelUsed && (
                            <p className="text-[10px] text-gray-400 text-center mt-3 font-mono">
                                powered by {meta.modelUsed} • {(searchTimeMs / 1000).toFixed(1)}s • 4-Agent
                            </p>
                        )}
                    </AntigravityCard>
                </motion.div>
            </div>
        </motion.div>
    );
}
