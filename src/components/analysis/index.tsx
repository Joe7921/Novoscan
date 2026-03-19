/**
 * 常规模式报告 — 三层递进架构
 *
 * 第一层：结论仪表盘 Hero（一屏看完核心结论）
 * 第二层：证据摘要（可折叠手风琴）→ EvidenceAccordions
 * 第三层：原始数据（折叠，按需展开）→ RawDataSection
 *
 * 重构说明：从 1074 行拆分为 5 个独立子组件，
 * 本文件仅负责组装 + 第一层仪表盘渲染。
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import dynamic from 'next/dynamic';
import { AnalysisReport, Language } from '@/types';
import ScoreGauge from './ScoreGauge';
import RadarChart from './RadarChart';
import { ShieldCheck, Zap, Cpu } from 'lucide-react';

/* === 拆分的子组件 === */
import AnalysisHeader from './AnalysisHeader';
import EvidenceAccordions from './EvidenceAccordions';
import RawDataSection from './RawDataSection';

const InnovationDNAMap = dynamic(() => import('@/components/innovation/InnovationDNAMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full animate-pulse p-6">
            <div className="h-5 w-32 bg-indigo-200/60 rounded-md mb-4" />
            <div className="h-48 bg-indigo-50 rounded-xl border border-indigo-100" />
        </div>
    ),
});
const AgentMemoryInsight = dynamic(() => import('../agent/AgentMemoryInsight'), {
    ssr: false,
    loading: () => <div className="h-24 bg-amber-50 rounded-xl border border-amber-100 animate-pulse" />,
});

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
    query?: string;
    dualResult?: any;
    onRetryAgent?: (agentId: string) => void;
    onRetryAllFailed?: () => void;
    onFullRetry?: () => void;
    retryingAgents?: Set<string>;
    retryProgress?: {
        total: number;
        completed: number;
        startTime: number;
    } | null;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({
    report, onReset, language, query, dualResult,
    onRetryAgent, onRetryAllFailed, onFullRetry,
    retryingAgents, retryProgress,
}) => {
    const isZh = language === 'zh';

    const {
        academicReview, industryAnalysis, innovationEvaluation,
        competitorAnalysis, arbitration, qualityCheck,
    } = report as any;

    // 从 dualResult 中获取交叉验证和可信度
    const crossValidation = dualResult?.crossValidation;
    const rawCredibility = dualResult?.finalCredibility || dualResult?.credibility;
    const finalCredibility = rawCredibility || (() => {
        const scores = [
            academicReview?.score, industryAnalysis?.score,
            competitorAnalysis?.score, innovationEvaluation?.score,
        ].filter((s): s is number => typeof s === 'number' && s > 0);
        if (scores.length === 0) return null;
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const level = avg >= 70 ? 'high' : avg >= 40 ? 'medium' : 'low';
        return {
            score: avg, level,
            reasoning: [
                `基于 ${scores.length} 位专家的综合评分推算 (平均 ${avg} 分)`,
                academicReview?.confidence ? `学术审查置信度: ${academicReview.confidence}` : null,
                industryAnalysis?.confidence ? `产业分析置信度: ${industryAnalysis.confidence}` : null,
            ].filter(Boolean),
        };
    })();
    const recommendation = arbitration?.summary || report.summary || dualResult?.recommendation || '';

    // 降级的 Agent 列表
    const fallbackAgents: string[] = [];
    if (academicReview?.isFallback) fallbackAgents.push(isZh ? '学术审查员' : 'Academic Reviewer');
    if (industryAnalysis?.isFallback) fallbackAgents.push(isZh ? '产业分析员' : 'Industry Analyst');
    if (competitorAnalysis?.isFallback) fallbackAgents.push(isZh ? '竞品侦探' : 'Competitor Detective');
    if (innovationEvaluation?.isFallback) fallbackAgents.push(isZh ? '创新评估师' : 'Innovation Evaluator');

    return (
        <div className="w-full max-w-5xl animate-fade-in-up mt-8">
            {/* Header + 部分结果警告 */}
            <AnalysisHeader
                report={report}
                language={language}
                query={query}
                dualResult={dualResult}
                onReset={onReset}
                onRetryAllFailed={onRetryAllFailed}
                onFullRetry={onFullRetry}
                retryingAgents={retryingAgents}
                retryProgress={retryProgress}
                fallbackAgents={fallbackAgents}
            />

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

                {/* AI 综合决策建议 */}
                {recommendation && (
                    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
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

                {/* NovoDNA 创新基因图谱 */}
                {(report as any)?.innovationDNA && (
                    <div className="rounded-2xl border border-indigo-200/50 bg-white/95 shadow-sm overflow-hidden">
                        <InnovationDNAMap data={(report as any).innovationDNA} language={language} />
                    </div>
                )}

                {/* Agent 记忆进化洞察 */}
                {(report as any)?.memoryInsight && (report as any).memoryInsight.experiencesUsed > 0 && (
                    <AgentMemoryInsight data={(report as any).memoryInsight} language={language} />
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
            <EvidenceAccordions
                report={report}
                language={language}
                dualResult={dualResult}
                onRetryAgent={onRetryAgent}
                onRetryAllFailed={onRetryAllFailed}
                retryingAgents={retryingAgents}
            />


            {/* ============================================================
                第三层：原始数据 — 折叠，按需展开
               ============================================================ */}
            <RawDataSection
                report={report}
                language={language}
                dualResult={dualResult}
            />
        </div>
    );
};

export default React.memo(AnalysisView);
