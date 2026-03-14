/**
 * 常规模式报告 — 三层递进架构
 *
 * 第一层：结论仪表盘 Hero（一屏看完核心结论）
 * 第二层：证据摘要（可折叠手风琴）
 * 第三层：原始数据（折叠，按需展开）
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import dynamic from 'next/dynamic';
import { AnalysisReport, Language, InternetSource } from '@/types';
import SimilarityBar from './SimilarityBar';
import InternetSourceCard from './InternetSourceCard';
import ScoreGauge from './ScoreGauge';
import RadarChart from './RadarChart';
import type { AgentRawItem } from '@/components/agent/AgentRawDisplay';

// 重子组件 — 改为 dynamic 导入，缩小主 chunk 体积
const MultiAgentVisualization = dynamic(() => import('@/components/agent/MultiAgentVisualization'), {
    ssr: false,
    loading: () => (
        <div className="w-full animate-pulse space-y-3">
            <div className="h-40 bg-slate-100 rounded-xl border border-slate-200" />
            <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map(i => <div key={i} className="h-20 bg-slate-50 rounded-lg border border-slate-100" />)}
            </div>
        </div>
    ),
});
const DebateTimeline = dynamic(() => import('../DebateTimeline'), {
    ssr: false,
    loading: () => (
        <div className="w-full animate-pulse space-y-3">
            {[0, 1].map(i => <div key={i} className="h-24 bg-rose-50 rounded-xl border border-rose-100" />)}
        </div>
    ),
});
const ScoreBreakdownPanel = dynamic(() => import('../ScoreBreakdownPanel'), {
    ssr: false,
    loading: () => <div className="h-32 bg-slate-50 rounded-xl border border-slate-200 animate-pulse" />,
});
const InnovationDNAMap = dynamic(() => import('@/components/innovation/InnovationDNAMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full animate-pulse p-6">
            <div className="h-5 w-32 bg-indigo-200/60 rounded-md mb-4" />
            <div className="h-48 bg-indigo-50 rounded-xl border border-indigo-100" />
        </div>
    ),
});
const CrossDomainInsights = dynamic(() => import('../CrossDomainInsights'), {
    ssr: false,
    loading: () => (
        <div className="w-full animate-pulse space-y-3">
            {[0, 1].map(i => <div key={i} className="h-20 bg-purple-50 rounded-xl border border-purple-100" />)}
        </div>
    ),
});
const AgentMemoryInsight = dynamic(() => import('../AgentMemoryInsight'), {
    ssr: false,
    loading: () => <div className="h-24 bg-amber-50 rounded-xl border border-amber-100 animate-pulse" />,
});
const AgentRawDisplay = dynamic(() => import('@/components/agent/AgentRawDisplay'), {
    ssr: false,
    loading: () => <div className="h-16 bg-slate-50 rounded-xl border border-slate-200 animate-pulse" />,
});
import {
    ArrowLeft, Quote, Compass, FileText,
    Cpu, AlertCircle, ChevronDown,
    ShieldCheck, Zap, Copy, Bot,
    CheckCircle, Scale, Users, Crosshair, Swords, Globe,
    Wrench, Loader2 as Loader2Icon
} from 'lucide-react';

const ExportReportButton = dynamic(() => import('@/components/report/ExportReportButton'), { ssr: false });
const ShareButton = dynamic(() => import('@/components/report/ShareButton'), { ssr: false });
const AdPlacement = dynamic(() => import('../ads/AdPlacement'), { ssr: false });

const renderMarkdown = (content: string) => (
    <ReactMarkdown
        components={{
            table: ({ node, ...props }) => (
                <div className="w-full overflow-x-auto pb-2 mb-4 scrollbar-hide relative">
                    <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-white/20 to-transparent pointer-events-none md:hidden" />
                    <table className="min-w-full" {...props} />
                </div>
            )
        }}
    >
        {content}
    </ReactMarkdown>
);

interface AnalysisViewProps {
    report: AnalysisReport;
    onReset: () => void;
    language: Language;
    /** 用户查询内容（导出报告时使用） */
    query?: string;
    /** 七源双轨原始结果（从 page.tsx 传入，替代独立的 DualTrackReport） */
    dualResult?: any;
    /** 单独重试某个 Agent */
    onRetryAgent?: (agentId: string) => void;
    /** 一键重试所有失败 Agent */
    onRetryAllFailed?: () => void;
    /** 完全重试（重跑全部 Agent + 仲裁 + 质量检查，消耗 8 点） */
    onFullRetry?: () => void;
    /** 正在重试中的 Agent 集合 */
    retryingAgents?: Set<string>;
    /** 修复进度信息 */
    retryProgress?: {
        total: number;
        completed: number;
        startTime: number;
    } | null;
}

// ==================== 手风琴区块组件 ====================

/** 通用可折叠区块 */
const AccordionSection: React.FC<{
    icon: React.ReactNode;
    title: string;
    defaultOpen?: boolean;
    badge?: string;
    badgeColor?: string;
    children: React.ReactNode;
}> = ({ icon, title, defaultOpen = false, badge, badgeColor = 'bg-slate-100 text-slate-600', children }) => (
    <details open={defaultOpen} className="group rounded-2xl border border-slate-200 bg-white/95 shadow-sm overflow-hidden transition-all hover:shadow-md">
        <summary className="flex items-center gap-3 px-6 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
            <span className="text-lg">{icon}</span>
            <span className="font-bold text-slate-800 flex-1">{title}</span>
            {badge && (
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${badgeColor}`}>{badge}</span>
            )}
            <ChevronDown size={18} className="text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-6 pb-6 pt-2 border-t border-slate-100 animate-fade-in">
            {children}
        </div>
    </details>
);

// ==================== 修复进度面板 ====================

/** Agent ID → 中英文名称映射 */
const AGENT_DISPLAY_NAMES: Record<string, { zh: string; en: string }> = {
    academicReviewer: { zh: '学术审查员', en: 'Academic' },
    industryAnalyst: { zh: '产业分析员', en: 'Industry' },
    competitorDetective: { zh: '竞品侦探', en: 'Competitor' },
    innovationEvaluator: { zh: '创新评估师', en: 'Innovation' },
};

/** 修复进度面板 — 替代静态"修复中..." */
const RetryProgressPanel: React.FC<{
    retryingAgents: Set<string>;
    retryProgress?: { total: number; completed: number; startTime: number } | null;
    isZh: boolean;
}> = ({ retryingAgents, retryProgress, isZh }) => {
    const [elapsed, setElapsed] = React.useState(0);

    React.useEffect(() => {
        if (!retryProgress) return;
        const timer = setInterval(() => {
            setElapsed(Math.floor((Date.now() - retryProgress.startTime) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [retryProgress]);

    const agentIds = Array.from(retryingAgents);

    return (
        <div className="flex flex-col gap-2 flex-shrink-0 min-w-[200px]">
            {/* 顶部状态条 */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md">
                <Loader2Icon size={14} className="animate-spin flex-shrink-0" />
                <span>{isZh ? '修复中' : 'Fixing'}</span>
                <span className="opacity-80">{retryProgress ? `${retryProgress.total}` : agentIds.length} {isZh ? '位专家' : 'agents'}</span>
                <span className="ml-auto tabular-nums opacity-70">{elapsed}s</span>
            </div>
            {/* Agent 列表 */}
            <div className="flex flex-wrap gap-1.5 px-1">
                {agentIds.map(id => {
                    const name = AGENT_DISPLAY_NAMES[id];
                    return (
                        <div
                            key={id}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-[11px] font-semibold text-blue-700 animate-pulse"
                        >
                            <Loader2Icon size={10} className="animate-spin" />
                            {name ? (isZh ? name.zh : name.en) : id}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ==================== 主组件 ====================

const AnalysisView: React.FC<AnalysisViewProps> = ({ report, onReset, language, query, dualResult, onRetryAgent, onRetryAllFailed, onFullRetry, retryingAgents, retryProgress }) => {
    const isZh = language === 'zh';

    const {
        academicReview,
        industryAnalysis,
        innovationEvaluation,
        competitorAnalysis,
        debate,
        arbitration,
        qualityCheck
    } = report as any;

    // 从 dualResult 中获取交叉验证和可信度（合并旧有 + 新数据）
    const crossValidation = dualResult?.crossValidation;
    // 后备兜底：当搜索超时导致 finalCredibility 为 null 时，从 Agent 评分中合成
    const rawCredibility = dualResult?.finalCredibility || dualResult?.credibility;
    const finalCredibility = rawCredibility || (() => {
        // 从 Agent 评分合成一个 fallback credibility
        const scores = [
            academicReview?.score,
            industryAnalysis?.score,
            competitorAnalysis?.score,
            innovationEvaluation?.score,
        ].filter((s): s is number => typeof s === 'number' && s > 0);
        if (scores.length === 0) return null;
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const level = avg >= 70 ? 'high' : avg >= 40 ? 'medium' : 'low';
        return {
            score: avg,
            level,
            reasoning: [
                `基于 ${scores.length} 位专家的综合评分推算 (平均 ${avg} 分)`,
                academicReview?.confidence ? `学术审查置信度: ${academicReview.confidence}` : null,
                industryAnalysis?.confidence ? `产业分析置信度: ${industryAnalysis.confidence}` : null,
            ].filter(Boolean),
        };
    })();
    const recommendation = arbitration?.summary || report.summary || dualResult?.recommendation || '';

    // 聚合全部4个Agent的keyFindings和redFlags
    const allKeyFindings = [
        ...(academicReview?.keyFindings || []),
        ...(industryAnalysis?.keyFindings || []),
        ...(competitorAnalysis?.keyFindings || []),
        ...(innovationEvaluation?.keyFindings || []),
    ].filter(Boolean);

    const allRedFlags = [
        ...(innovationEvaluation?.redFlags || []),
        ...(competitorAnalysis?.redFlags || []),
        ...(academicReview?.redFlags || []),
        ...(industryAnalysis?.redFlags || []),
        ...(crossValidation?.redFlags || []),
    ].filter(Boolean);

    // 4个专家Agent的置信度信息
    const agentConfidences = [
        academicReview && { name: isZh ? '学术审查' : 'Academic', confidence: academicReview.confidence, reasoning: academicReview.confidenceReasoning, score: academicReview.score },
        industryAnalysis && { name: isZh ? '产业分析' : 'Industry', confidence: industryAnalysis.confidence, reasoning: industryAnalysis.confidenceReasoning, score: industryAnalysis.score },
        competitorAnalysis && { name: isZh ? '竞品侦探' : 'Competitor', confidence: competitorAnalysis.confidence, reasoning: competitorAnalysis.confidenceReasoning, score: competitorAnalysis.score },
        innovationEvaluation && { name: isZh ? '创新评估' : 'Innovation', confidence: innovationEvaluation.confidence, reasoning: innovationEvaluation.confidenceReasoning, score: innovationEvaluation.score },
    ].filter(Boolean) as Array<{ name: string; confidence: string; reasoning: string; score: number }>;

    const t = {
        back: isZh ? '返回输入' : 'Back to Input',
        overview: isZh ? '分析报告' : 'Analysis Report',
    };

    const fallbackAgents: string[] = [];
    if (academicReview?.isFallback) fallbackAgents.push(isZh ? '学术审查员' : 'Academic Reviewer');
    if (industryAnalysis?.isFallback) fallbackAgents.push(isZh ? '产业分析员' : 'Industry Analyst');
    if (competitorAnalysis?.isFallback) fallbackAgents.push(isZh ? '竞品侦探' : 'Competitor Detective');
    if (innovationEvaluation?.isFallback) fallbackAgents.push(isZh ? '创新评估师' : 'Innovation Evaluator');

    return (
        <div className="w-full max-w-5xl animate-fade-in-up mt-8">
            {/* 部分结果警告 — #29 显示具体降级的 Agent */}
            {report.isPartial && (
                <div className="mb-6 flex flex-wrap items-center gap-3 px-5 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-700 animate-fade-in border-l-4">
                    <span className="text-xl">⚠️</span>
                    <div className="flex-1 font-medium text-sm md:text-base">
                        <p>{isZh
                            ? '以下专家响应超时，报告包含部分降级结果，仅供参考：'
                            : 'The following agents timed out. This report contains partial fallback results:'}</p>
                        {fallbackAgents.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {fallbackAgents.map((name) => (
                                    <span key={name} className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">{name}</span>
                                ))}
                            </div>
                        )}
                    </div>
                    {onRetryAllFailed && retryingAgents && retryingAgents.size === 0 && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={onRetryAllFailed}
                                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                            >
                                <Wrench size={14} />
                                {isZh ? '一键修复' : 'Fix All'}
                            </button>
                            {onFullRetry && (
                                <button
                                    onClick={onFullRetry}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                                >
                                    ⚡
                                    {isZh ? '完全重试 (8点)' : 'Full Retry (8pts)'}
                                </button>
                            )}
                        </div>
                    )}
                    {retryingAgents && retryingAgents.size > 0 && (
                        <RetryProgressPanel
                            retryingAgents={retryingAgents}
                            retryProgress={retryProgress}
                            isZh={isZh}
                        />
                    )}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">{t.overview}</h2>
                    <p className="text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        {isZh ? '基于七源双轨交叉验证的深度分析' : 'Deep analysis based on 7-source dual-track cross-validation'}
                        {report.usedModel && (
                            <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium">
                                🧠 {report.usedModel}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {query && (
                        <>
                            <ShareButton
                                query={query}
                                report={report}
                                dualResult={dualResult}
                                reportType="novoscan"
                            />
                            <ExportReportButton
                                query={query}
                                report={report}
                                dualResult={dualResult}
                                language={language}
                            />
                        </>
                    )}
                    {/* 完全重试入口 — 非 isPartial 状态也可用（用户对结果不满时重跑） */}
                    {onFullRetry && retryingAgents && retryingAgents.size === 0 && !report.isPartial && (
                        <button
                            onClick={onFullRetry}
                            className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 font-medium px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors text-sm"
                            title={isZh ? '重新运行全部 AI 专家分析 (消耗 8 点)' : 'Re-run all AI agents (costs 8pts)'}
                        >
                            ⚡ {isZh ? '重新分析' : 'Re-analyze'}
                        </button>
                    )}
                    <button
                        onClick={onReset}
                        className="text-slate-500 hover:text-indigo-600 font-medium px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft size={18} />
                        {t.back}
                    </button>
                </div>
            </div>

            {/* ============================================================
                第一层：结论仪表盘 Hero — 一屏看完核心结论
               ============================================================ */}
            <section className="space-y-6 mb-8">
                {/* 核心评分：两列仪表盘 */}
                <div className="grid md:grid-cols-2 gap-6">
                    <ScoreGauge
                        score={arbitration?.overallScore ?? report?.noveltyScore ?? 85}
                        label={isZh ? '学术创新综合分' : 'Academic Novelty Score'}
                        type="academic"
                        language={language}
                    />
                    <ScoreGauge
                        score={report.practicalScore ?? industryAnalysis?.score ?? report.commercialScore ?? 50}
                        label={isZh ? '产业实践可行性' : 'Industrial Feasibility'}
                        type="industry"
                        language={language}
                    />
                </div>

                {/* 💡 AI 综合决策建议 — 高亮渐变卡片（最重要的结论） */}
                {recommendation && (
                    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                        {/* 装饰光斑 */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/95 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                        <h3 className="font-bold flex items-center gap-2 mb-3 text-lg relative z-10">
                            <Zap className="text-yellow-300" size={22} />
                            {isZh ? 'AI 综合决策建议' : 'AI Decision Summary'}
                        </h3>
                        <div className="prose prose-invert prose-sm max-w-none opacity-95 relative z-10 leading-relaxed">
                            {renderMarkdown(recommendation)}
                        </div>
                        {arbitration?.usedModel && (
                            <div className="mt-4 flex items-center gap-2 flex-wrap relative z-10">
                                <span className="text-[11px] bg-white/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                                    🧠 {isZh ? `${arbitration.usedModel} 深度推理` : `Powered by ${arbitration.usedModel}`}
                                </span>
                                {arbitration?.reasoningContent && (
                                    <span className="text-[11px] bg-white/95 px-2 py-1 rounded-full">
                                        {isZh ? `思维链 ${Math.round(arbitration.reasoningContent.length / 100) / 10}K 字` : `CoT ${Math.round(arbitration.reasoningContent.length / 100) / 10}K chars`}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 🧬 NovoDNA 创新基因图谱 */}
                {(report as any)?.innovationDNA && (
                    <div className="rounded-2xl border border-indigo-200/50 bg-white/95 shadow-sm overflow-hidden">
                        <InnovationDNAMap
                            data={(report as any).innovationDNA}
                            language={language}
                        />
                    </div>
                )}

                {/* 🧠 Agent 记忆进化洞察 */}
                {(report as any)?.memoryInsight && (report as any).memoryInsight.experiencesUsed > 0 && (
                    <AgentMemoryInsight
                        data={(report as any).memoryInsight}
                        language={language}
                    />
                )}

                {/* NovoStarchart 雷达图 + 验证状态集成行 */}
                <div className="grid lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 h-full">
                        <RadarChart language={language} data={(report as any)?.innovationRadar} />
                    </div>
                    <div className="lg:col-span-5 h-full flex flex-col gap-4">
                        {/* 可信度验证卡片 */}
                        {finalCredibility && (
                            <div className={`flex-1 rounded-2xl p-5 border-2 ${finalCredibility.level === 'high'
                                ? 'bg-emerald-50 border-emerald-200'
                                : finalCredibility.level === 'medium'
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-rose-50 border-rose-200'
                                }`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <ShieldCheck size={20} className={finalCredibility.level === 'high' ? 'text-emerald-600' : finalCredibility.level === 'medium' ? 'text-amber-600' : 'text-rose-600'} />
                                    <span className="font-bold text-slate-800">
                                        {isZh ? '七源交叉验证' : 'Cross-Validation'}
                                    </span>
                                    <span className={`text-2xl font-black ml-auto ${finalCredibility.level === 'high' ? 'text-emerald-600' : finalCredibility.level === 'medium' ? 'text-amber-600' : 'text-rose-600'}`}>
                                        {finalCredibility.score}
                                    </span>
                                </div>
                                <div className="text-sm space-y-1">
                                    {(finalCredibility.reasoning || []).slice(0, 3).map((r: string, i: number) => (
                                        <div key={i} className="flex items-start gap-1.5 text-slate-600">
                                            <span className="text-xs mt-0.5 flex-shrink-0">{r.includes('⚠️') ? '⚠️' : '✓'}</span>
                                            <span className="text-xs">{r}</span>
                                        </div>
                                    ))}
                                </div>
                                {/* 交叉验证速览 */}
                                {crossValidation && (
                                    <div className="mt-3 pt-3 border-t border-slate-200/50 grid grid-cols-3 gap-2 text-center text-xs">
                                        <div>
                                            <div className="font-bold text-slate-700">{crossValidation.academicSupport === 'strong' ? '强' : crossValidation.academicSupport === 'moderate' ? '中' : '弱'}</div>
                                            <div className="text-slate-400">学术支撑</div>
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-700">{crossValidation.industrySupport === 'strong' ? '强' : crossValidation.industrySupport === 'moderate' ? '中' : '弱'}</div>
                                            <div className="text-slate-400">产业支撑</div>
                                        </div>
                                        <div>
                                            <div className={`font-bold ${crossValidation.openSourceVerified ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                {crossValidation.openSourceVerified ? '✓' : '✗'}
                                            </div>
                                            <div className="text-slate-400">开源验证</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* AI Quality Control 紧凑卡 */}
                        <div className={`rounded-2xl p-4 border ${qualityCheck?.passed ? 'bg-emerald-50/50 border-emerald-100' : 'bg-amber-50/50 border-amber-100'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Cpu className={qualityCheck?.passed ? 'text-emerald-500' : 'text-amber-500'} size={16} />
                                    <span className="font-bold text-sm text-gray-800">AI Quality</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {qualityCheck?.consistencyScore !== undefined && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${qualityCheck.consistencyScore >= 80 ? 'bg-emerald-100 text-emerald-700' : qualityCheck.consistencyScore >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-rose-100 text-rose-700'}`}>
                                            {qualityCheck.consistencyScore}/100
                                        </span>
                                    )}
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${qualityCheck?.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {qualityCheck?.passed ? '✓ Pass' : '⚠ Alert'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ============================================================
                第二层：证据摘要 — 可折叠手风琴
               ============================================================ */}
            <section className="space-y-3 mb-8">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
                    {isZh ? '📋 深度证据' : '📋 Evidence Details'}
                </h3>

                {/* Pros vs Cons — 聚合全部4个Agent */}
                <AccordionSection
                    icon={<span>⚖️</span>}
                    title={isZh ? '优势与风险对照' : 'Pros vs Cons'}
                    badge={`${allKeyFindings.length + allRedFlags.length} ${isZh ? '条发现' : 'findings'}`}
                    badgeColor="bg-slate-100 text-slate-600"
                    defaultOpen={true}
                >
                    <div className="grid md:grid-cols-2 gap-4">
                        {/* Pros — 聚合全部Agent的keyFindings */}
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5 border border-emerald-100">
                            <h4 className="font-bold text-emerald-900 mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs">✓</span>
                                {isZh ? '支持依据' : 'Pros'}
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">{allKeyFindings.length}</span>
                            </h4>
                            <ul className="space-y-2">
                                {allKeyFindings.length > 0 ? allKeyFindings.map((item: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-emerald-800">
                                        <span className="text-emerald-500 mt-0.5 flex-shrink-0">▸</span>
                                        <span>{item.replace(/^[-•]\s*/, '')}</span>
                                    </li>
                                )) : (
                                    <li className="text-emerald-600/60 text-sm">{isZh ? '暂无数据' : 'No data'}</li>
                                )}
                            </ul>
                        </div>
                        {/* Cons — 聚合全部Agent的redFlags */}
                        <div className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-xl p-5 border border-rose-100">
                            <h4 className="font-bold text-rose-900 mb-3 flex items-center gap-2">
                                <span className="w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white text-xs">!</span>
                                {isZh ? '风险提示' : 'Cons'}
                                <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">{allRedFlags.length}</span>
                            </h4>
                            <ul className="space-y-2">
                                {allRedFlags.length > 0 ? allRedFlags.map((item: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-rose-800">
                                        <span className="text-rose-500 mt-0.5 flex-shrink-0">▸</span>
                                        <span>{item.replace(/^[-•]\s*/, '')}</span>
                                    </li>
                                )) : (
                                    <li className="text-rose-600/60 text-sm">{isZh ? '暂无数据' : 'No data'}</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </AccordionSection>

                {/* 多智能体分析 */}
                <AccordionSection
                    icon={<Bot size={18} className="text-indigo-500" />}
                    title={isZh ? '多智能体分析报告' : 'Multi-Agent Analysis'}
                    badge={isZh ? '6 个专家' : '6 Agents'}
                    badgeColor="bg-indigo-100 text-indigo-700"
                >
                    <MultiAgentVisualization
                        language={language}
                        report={report}
                        onRetryAgent={onRetryAgent}
                        onRetryAllFailed={onRetryAllFailed}
                        retryingAgents={retryingAgents}
                    />
                </AccordionSection>

                {/* NovoDebate 对抗辩论 */}
                {debate?.triggered && debate?.sessions?.length > 0 && (
                    <AccordionSection
                        icon={<Swords size={18} className="text-rose-500" />}
                        title={isZh ? 'NovoDebate 专家对抗辩论' : 'NovoDebate Adversarial Debate'}
                        badge={`${debate.sessions.reduce((s: number, ss: any) => s + ss.exchanges.length, 0)} ${isZh ? '轮交锋' : 'Rounds'}`}
                        badgeColor="bg-rose-100 text-rose-700"
                        defaultOpen={true}
                    >
                        <DebateTimeline debate={debate} language={language} />
                    </AccordionSection>
                )}

                {/* 🆕 跨域创新迁移洞察 */}
                {(report as any)?.crossDomainTransfer && (report as any).crossDomainTransfer.bridges?.length > 0 && (
                    <AccordionSection
                        icon={<Globe size={18} className="text-purple-500" />}
                        title={isZh ? 'NovoDiscover 跨域创新迁移洞察' : 'NovoDiscover Cross-Domain Innovation Transfer'}
                        badge={`${(report as any).crossDomainTransfer.bridges.length} ${isZh ? '条桥梁' : 'bridges'}`}
                        badgeColor="bg-purple-100 text-purple-700"
                        defaultOpen={true}
                    >
                        <CrossDomainInsights
                            data={(report as any).crossDomainTransfer}
                            language={language}
                        />

                        {/* Arbitrator Cross-Domain Verification */}
                        {arbitration?.crossDomainVerification && (
                            <div className="mt-5 pt-5 border-t border-purple-100 space-y-3">
                                <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2">
                                    <ShieldCheck size={16} className="text-purple-500" />
                                    {isZh ? '仲裁员验证评估' : 'Arbitrator Verification'}
                                </h4>
                                {arbitration.crossDomainVerification.overallAssessment && (
                                    <p className="text-xs text-slate-600 bg-purple-50/50 rounded-lg p-3 border border-purple-100">
                                        {arbitration.crossDomainVerification.overallAssessment}
                                    </p>
                                )}
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {arbitration.crossDomainVerification.verifiedBridges?.length > 0 && (
                                        <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                                            <div className="text-[10px] font-bold text-emerald-700 uppercase mb-1.5">
                                                ✓ {isZh ? '验证通过' : 'Verified'}
                                            </div>
                                            <ul className="space-y-1">
                                                {arbitration.crossDomainVerification.verifiedBridges.map((v: string, i: number) => (
                                                    <li key={i} className="text-xs text-emerald-700">• {v}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {arbitration.crossDomainVerification.questionableClaims?.length > 0 && (
                                        <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100">
                                            <div className="text-[10px] font-bold text-amber-700 uppercase mb-1.5">
                                                ⚠ {isZh ? '存疑引用' : 'Questionable'}
                                            </div>
                                            <ul className="space-y-1">
                                                {arbitration.crossDomainVerification.questionableClaims.map((q: string, i: number) => (
                                                    <li key={i} className="text-xs text-amber-700">• {q}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                {arbitration.crossDomainVerification.enhancedSuggestions?.length > 0 && (
                                    <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100">
                                        <div className="text-[10px] font-bold text-indigo-700 uppercase mb-1.5">
                                            💡 {isZh ? '仲裁员增强建议' : 'Enhanced Suggestions'}
                                        </div>
                                        <ul className="space-y-1">
                                            {arbitration.crossDomainVerification.enhancedSuggestions.map((s: string, i: number) => (
                                                <li key={i} className="text-xs text-indigo-700">• {s}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </AccordionSection>
                )}

                {/* Agent 原话展示 */}
                {(() => {
                    const agentItems: AgentRawItem[] = [
                        academicReview?.analysis && { agentName: isZh ? '学术审查员' : 'Academic Reviewer', rawText: academicReview.analysis },
                        industryAnalysis?.analysis && { agentName: isZh ? '产业分析员' : 'Industry Analyst', rawText: industryAnalysis.analysis },
                        (report as any)?.competitorAnalysis?.analysis && { agentName: isZh ? '竞品侦探' : 'Competitor Detective', rawText: (report as any).competitorAnalysis.analysis },
                        (report as any)?.crossDomainTransfer?.analysis && { agentName: isZh ? 'NovoDiscover 跨域侦察兵' : 'NovoDiscover Cross-Domain Scout', rawText: (report as any).crossDomainTransfer.analysis },
                        innovationEvaluation?.analysis && { agentName: isZh ? '创新评估师' : 'Innovation Evaluator', rawText: innovationEvaluation.analysis },
                        arbitration?.summary && { agentName: isZh ? '首席仲裁员' : 'Chief Arbitrator', rawText: arbitration.summary + (arbitration.reasoningContent ? '\n\n---\n\n**思维链 (Chain of Thought):**\n\n' + arbitration.reasoningContent : '') },
                    ].filter(Boolean) as AgentRawItem[];
                    return agentItems.length > 0 ? (
                        <AgentRawDisplay
                            items={agentItems}
                            title={isZh ? '✨ 查看 AI 深度思考过程' : '✨ View AI Deep Reasoning'}
                        />
                    ) : null;
                })()}

                {/* Agent 置信度总览 */}
                {agentConfidences.length > 0 && (
                    <AccordionSection
                        icon={<Users size={18} className="text-violet-500" />}
                        title={isZh ? '专家置信度总览' : 'Agent Confidence Overview'}
                        badge={`${agentConfidences.length} ${isZh ? '位专家' : 'Agents'}`}
                        badgeColor="bg-violet-100 text-violet-700"
                    >
                        <div className="grid sm:grid-cols-2 gap-3">
                            {agentConfidences.map((agent, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                        <span className="text-lg font-black text-slate-800">{agent.score}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${agent.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                                            agent.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                'bg-rose-100 text-rose-700'
                                            }`}>
                                            {agent.confidence === 'high' ? (isZh ? '高置信' : 'High') :
                                                agent.confidence === 'medium' ? (isZh ? '中置信' : 'Med') :
                                                    (isZh ? '低置信' : 'Low')}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm text-slate-800">{agent.name}</div>
                                        {agent.reasoning && (
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{agent.reasoning}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </AccordionSection>
                )}

                {/* 仲裁决策明细 */}
                {arbitration && (
                    <AccordionSection
                        icon={<Scale size={18} className="text-indigo-500" />}
                        title={isZh ? '仲裁决策明细' : 'Arbitration Details'}
                        badge={arbitration.consensusLevel ? (
                            arbitration.consensusLevel === 'strong' ? (isZh ? '强共识' : 'Strong') :
                                arbitration.consensusLevel === 'moderate' ? (isZh ? '中共识' : 'Moderate') :
                                    (isZh ? '弱共识' : 'Weak')
                        ) : undefined}
                        badgeColor={arbitration.consensusLevel === 'strong' ? 'bg-emerald-100 text-emerald-700' :
                            arbitration.consensusLevel === 'moderate' ? 'bg-amber-100 text-amber-700' :
                                'bg-rose-100 text-rose-700'}
                    >
                        <div className="space-y-4">
                            {/* 加权评分明细 */}
                            {arbitration.weightedBreakdown && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700 mb-3">{isZh ? '加权评分构成' : 'Weighted Score Breakdown'}</h4>
                                    <div className="space-y-2">
                                        {([
                                            { key: 'academic', label: isZh ? '学术审查' : 'Academic', icon: '📚' },
                                            { key: 'industry', label: isZh ? '产业分析' : 'Industry', icon: '🏭' },
                                            { key: 'innovation', label: isZh ? '创新评估' : 'Innovation', icon: '💡' },
                                            { key: 'competitor', label: isZh ? '竞品分析' : 'Competitor', icon: '🎯' },
                                        ] as const).map(({ key, label, icon }) => {
                                            const item = arbitration.weightedBreakdown[key];
                                            if (!item) return null;
                                            return (
                                                <div key={key} className="flex items-center gap-3">
                                                    <span className="text-sm w-5">{icon}</span>
                                                    <span className="text-xs font-bold text-slate-600 w-20">{label}</span>
                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all"
                                                            style={{ width: `${item.raw}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-800 w-8 text-right">{item.raw}</span>
                                                    <span className="text-[10px] text-slate-400 w-12">×{(item.weight * 100).toFixed(0)}%</span>
                                                    <span className="text-xs font-black text-indigo-600 w-8 text-right">{item.weighted}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 下一步建议 */}
                            {Array.isArray(arbitration.nextSteps) && arbitration.nextSteps.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                        <Crosshair size={14} className="text-emerald-500" />
                                        {isZh ? '下一步建议' : 'Next Steps'}
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {arbitration.nextSteps.map((step: string, i: number) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                                <CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                                <span>{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* 已解决的分歧 + 异议 */}
                            <div className="grid sm:grid-cols-2 gap-3">
                                {Array.isArray(arbitration.conflictsResolved) && arbitration.conflictsResolved.length > 0 && (
                                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                                        <h4 className="text-xs font-bold text-blue-700 mb-2">{isZh ? '已解决的分歧' : 'Conflicts Resolved'}</h4>
                                        <ul className="space-y-1">
                                            {arbitration.conflictsResolved.map((item: string, i: number) => (
                                                <li key={i} className="text-xs text-blue-600">• {item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {Array.isArray(arbitration.dissent) && arbitration.dissent.length > 0 && (
                                    <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                                        <h4 className="text-xs font-bold text-amber-700 mb-2">{isZh ? '少数派异议' : 'Dissenting Views'}</h4>
                                        <ul className="space-y-1">
                                            {arbitration.dissent.map((item: string, i: number) => (
                                                <li key={i} className="text-xs text-amber-600">• {item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </AccordionSection>
                )}

                {/* 评分维度拆解 */}
                <AccordionSection
                    icon={<span>📊</span>}
                    title={isZh ? '评分维度拆解' : 'Score Breakdown'}
                >
                    <ScoreBreakdownPanel
                        academicScore={arbitration?.overallScore ?? report?.noveltyScore ?? 85}
                        industryScore={report.practicalScore ?? industryAnalysis?.score ?? report.commercialScore ?? 50}
                        language={language}
                        academicDimensions={academicReview?.dimensionScores?.map((dim: any, _i: number, arr: any[]) => ({
                            name: dim.name,
                            weight: Math.round(100 / arr.length),
                            score: dim.score,
                            description: dim.reasoning || ''
                        }))}
                        industryDimensions={industryAnalysis?.dimensionScores?.map((dim: any, _i: number, arr: any[]) => ({
                            name: dim.name,
                            weight: Math.round(100 / arr.length),
                            score: dim.score,
                            description: dim.reasoning || ''
                        }))}
                    />
                </AccordionSection>

                {/* 质量检查警告 */}
                {qualityCheck?.warnings?.length > 0 && (
                    <AccordionSection
                        icon={<AlertCircle size={18} className="text-amber-500" />}
                        title={isZh ? '质量检查提示' : 'Quality Warnings'}
                        badge={`${qualityCheck.warnings.length}`}
                        badgeColor="bg-amber-100 text-amber-700"
                    >
                        <ul className="space-y-2">
                            {qualityCheck.warnings.map((warn: string, i: number) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50/50 rounded-lg px-3 py-2">
                                    <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                    <span>{warn}</span>
                                </li>
                            ))}
                        </ul>
                    </AccordionSection>
                )}
            </section>

            {/* 广告位 — 证据摘要与原始数据之间 */}
            <div className="mb-8">
                <AdPlacement variant="inline" language={language} />
            </div>

            {/* ============================================================
                第三层：原始数据 — 折叠，按需展开
               ============================================================ */}
            <section className="space-y-3 mb-10">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
                    {isZh ? '📂 原始数据' : '📂 Raw Data'}
                </h3>

                {/* 相似学术论文 */}
                {report.similarPapers && report.similarPapers.length > 0 && (
                    <AccordionSection
                        icon={<Copy size={18} className="text-amber-500" />}
                        title={isZh ? '高相似度学术记录' : 'Similar Academic Works'}
                        badge={`${report.similarPapers.length} ${isZh ? '篇' : 'papers'}`}
                        badgeColor="bg-amber-100 text-amber-700"
                    >
                        <div className="space-y-3">
                            {report.similarPapers.map((paper, idx) => (
                                <SimilarityBar key={idx} paper={paper} language={language} />
                            ))}
                        </div>
                    </AccordionSection>
                )}

                {/* 全网资讯源 */}
                <AccordionSection
                    icon={<Compass size={18} className="text-blue-500" />}
                    title={isZh ? '全网相关资讯' : 'Web Sources'}
                    badge={`${(report.internetSources || []).length} ${isZh ? '条' : 'sources'}`}
                    badgeColor="bg-blue-100 text-blue-700"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(report.internetSources && report.internetSources.length > 0 ? report.internetSources : [{
                            title: isZh ? "暂未提取到有效资源" : "No resources extracted",
                            snippet: isZh ? "请尝试不同关键词..." : "Try different keywords...",
                            url: "#",
                            summary: "-",
                            type: "Other" as const
                        }]).map((source, idx) => (
                            <InternetSourceCard key={idx} source={source as InternetSource} />
                        ))}
                    </div>
                </AccordionSection>

                {/* 微信公众号文章 */}
                {dualResult?.industry?.wechatArticles?.length > 0 && (
                    <AccordionSection
                        icon={<span>💬</span>}
                        title={isZh ? '微信公众号文章' : 'WeChat Articles'}
                        badge={`${dualResult.industry.wechatArticles.length} ${isZh ? '篇' : 'articles'}`}
                        badgeColor="bg-green-100 text-green-700"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {dualResult.industry.wechatArticles.map((article: any, idx: number) => (
                                <a
                                    key={idx}
                                    href={article.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group block bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100 hover:border-green-300 hover:shadow-md transition-all"
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg flex-shrink-0 mt-0.5">📱</span>
                                        <div className="flex-1 min-w-0">
                                            <h5 className="font-bold text-sm text-slate-800 group-hover:text-green-700 transition-colors line-clamp-2">
                                                {article.title}
                                            </h5>
                                            {article.author && (
                                                <span className="inline-block text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full mt-1.5 font-medium">
                                                    {article.author}
                                                </span>
                                            )}
                                            {article.description && (
                                                <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                                                    {article.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">
                                                    微信公众号
                                                </span>
                                                {article.publishDate && (
                                                    <span className="text-[10px] text-slate-400">
                                                        {article.publishDate}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </AccordionSection>
                )}

                {/* AI 深度审查报告（如有结构化 sections） */}
                {report.sections && (
                    <AccordionSection
                        icon={<FileText size={18} className="text-indigo-600" />}
                        title={isZh ? '深度审查报告' : 'Deep Review Report'}
                    >
                        <div className="space-y-6">
                            {!!(report.sections as any).academic && (
                                <div className="space-y-3">
                                    <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                                        <span className="text-blue-500">📚</span> {`${(report.sections as any).academic.title || ''}`}
                                    </h4>
                                    {((report.sections as any).academic.subsections || []).map((sub: any, i: number) => (
                                        <div key={i} className="prose prose-sm prose-indigo max-w-none">
                                            <strong className="text-slate-700">{sub.title}</strong>
                                            {renderMarkdown(sub.content)}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!!(report.sections as any).internet && (
                                <div className="space-y-3 pt-4 border-t border-slate-100">
                                    <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                                        <span className="text-amber-500">🌍</span> {`${(report.sections as any).internet.title || ''}`}
                                    </h4>
                                    {((report.sections as any).internet.subsections || []).map((sub: any, i: number) => (
                                        <div key={i} className="prose prose-sm prose-indigo max-w-none">
                                            <strong className="text-slate-700">{sub.title}</strong>
                                            {renderMarkdown(sub.content)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </AccordionSection>
                )}

                {/* 七源双轨原始检索数据（从 dualResult 取） */}
                {dualResult && (
                    <AccordionSection
                        icon={<span>🔬</span>}
                        title={isZh ? '七源检索原始数据' : '7-Source Raw Data'}
                        badge={`${dualResult.searchTimeMs || 0}ms`}
                        badgeColor="bg-slate-100 text-slate-600"
                    >
                        <div className="grid md:grid-cols-2 gap-4">
                            {/* 学术轨道 */}
                            {dualResult.academic && (
                                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 space-y-3">
                                    <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                                        📚 {isZh ? '学术轨道' : 'Academic Track'}
                                        <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">{isZh ? '四源聚合' : '4 Sources'}</span>
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-center">
                                        <div className="bg-white/95 rounded-lg p-2">
                                            <div className="text-lg font-bold text-blue-700">{dualResult.academic.stats?.totalPapers || 0}</div>
                                            <div className="text-[10px] text-slate-500">{isZh ? '相关论文' : 'Papers'}</div>
                                        </div>
                                        <div className="bg-white/95 rounded-lg p-2">
                                            <div className="text-lg font-bold text-blue-700">{dualResult.academic.stats?.totalCitations || 0}</div>
                                            <div className="text-[10px] text-slate-500">{isZh ? '总引用' : 'Citations'}</div>
                                        </div>
                                    </div>
                                    {(dualResult.academic.topConcepts?.length || 0) > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {dualResult.academic.topConcepts.slice(0, 5).map((c: string, i: number) => (
                                                <span key={i} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{c}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* 产业轨道 */}
                            {dualResult.industry && (
                                <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100 space-y-3">
                                    <h4 className="font-bold text-orange-900 text-sm flex items-center gap-2">
                                        🏭 {isZh ? '产业轨道' : 'Industry Track'}
                                        <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">{isZh ? '四源聚合' : '4 Sources'}</span>
                                    </h4>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-white/95 rounded-lg p-2">
                                            <div className="text-lg font-bold text-orange-700">
                                                {(dualResult.industry.webSources?.brave || 0) + (dualResult.industry.webSources?.serpapi || 0)}
                                            </div>
                                            <div className="text-[10px] text-slate-500">{isZh ? '网络讨论' : 'Web Discuss.'}</div>
                                        </div>
                                        <div className="bg-white/95 rounded-lg p-2">
                                            <div className="text-lg font-bold text-orange-700">{(dualResult.industry.githubRepos || []).length}</div>
                                            <div className="text-[10px] text-slate-500">{isZh ? '开源项目' : 'OSS Projects'}</div>
                                        </div>
                                        <div className="bg-white/95 rounded-lg p-2">
                                            <div className="text-lg font-bold text-green-700">{(dualResult.industry.wechatArticles || []).length}</div>
                                            <div className="text-[10px] text-slate-500">{isZh ? '公众号文章' : 'WeChat'}</div>
                                        </div>
                                    </div>
                                    {(dualResult.industry.topProjects?.length || 0) > 0 && (
                                        <div className="space-y-1">
                                            {dualResult.industry.topProjects.slice(0, 3).map((p: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between text-xs bg-white/95 px-2 py-1.5 rounded-lg">
                                                    <span className="truncate flex-1 font-medium">{p.name}</span>
                                                    <span className="text-orange-600 ml-2">{(p.stars || 0).toLocaleString()}⭐</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </AccordionSection>
                )}
            </section>
        </div >
    );
};

export default React.memo(AnalysisView);
