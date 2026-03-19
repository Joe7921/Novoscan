/**
 * EvidenceAccordions — 第二层证据摘要
 * 从 analysis/index.tsx 提取（多智能体、辩论、跨域、仲裁等手风琴区块）
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import dynamic from 'next/dynamic';
import { Language } from '@/types';
import AccordionSection from './AccordionSection';
import type { AgentRawItem } from '@/components/agent/AgentRawDisplay';
import {
    Bot, Swords, Globe, Users, Scale,
    Crosshair, CheckCircle, AlertCircle,
    ShieldCheck,
} from 'lucide-react';

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
const DebateTimeline = dynamic(() => import('../debate/DebateTimeline'), {
    ssr: false,
    loading: () => (
        <div className="w-full animate-pulse space-y-3">
            {[0, 1].map(i => <div key={i} className="h-24 bg-rose-50 rounded-xl border border-rose-100" />)}
        </div>
    ),
});
const ScoreBreakdownPanel = dynamic(() => import('../report/ScoreBreakdownPanel'), {
    ssr: false,
    loading: () => <div className="h-32 bg-slate-50 rounded-xl border border-slate-200 animate-pulse" />,
});
const CrossDomainInsights = dynamic(() => import('../discovery/CrossDomainInsights'), {
    ssr: false,
    loading: () => (
        <div className="w-full animate-pulse space-y-3">
            {[0, 1].map(i => <div key={i} className="h-20 bg-purple-50 rounded-xl border border-purple-100" />)}
        </div>
    ),
});
const AgentRawDisplay = dynamic(() => import('@/components/agent/AgentRawDisplay'), {
    ssr: false,
    loading: () => <div className="h-16 bg-slate-50 rounded-xl border border-slate-200 animate-pulse" />,
});

interface EvidenceAccordionsProps {
    report: any;
    language: Language;
    dualResult?: any;
    onRetryAgent?: (agentId: string) => void;
    onRetryAllFailed?: () => void;
    retryingAgents?: Set<string>;
}

const EvidenceAccordions: React.FC<EvidenceAccordionsProps> = ({
    report, language, dualResult, onRetryAgent, onRetryAllFailed, retryingAgents,
}) => {
    const isZh = language === 'zh';
    const {
        academicReview, industryAnalysis, innovationEvaluation,
        competitorAnalysis, debate, arbitration, qualityCheck,
    } = report as any;

    const crossValidation = dualResult?.crossValidation;

    // 聚合全部 4 个 Agent 的 keyFindings 和 redFlags
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

    // 4 个专家 Agent 的置信度信息
    const agentConfidences = [
        academicReview && { name: isZh ? '学术审查' : 'Academic', confidence: academicReview.confidence, reasoning: academicReview.confidenceReasoning, score: academicReview.score },
        industryAnalysis && { name: isZh ? '产业分析' : 'Industry', confidence: industryAnalysis.confidence, reasoning: industryAnalysis.confidenceReasoning, score: industryAnalysis.score },
        competitorAnalysis && { name: isZh ? '竞品侦探' : 'Competitor', confidence: competitorAnalysis.confidence, reasoning: competitorAnalysis.confidenceReasoning, score: competitorAnalysis.score },
        innovationEvaluation && { name: isZh ? '创新评估' : 'Innovation', confidence: innovationEvaluation.confidence, reasoning: innovationEvaluation.confidenceReasoning, score: innovationEvaluation.score },
    ].filter(Boolean) as Array<{ name: string; confidence: string; reasoning: string; score: number }>;

    // Agent 原话
    const agentItems: AgentRawItem[] = [
        academicReview?.analysis && { agentName: isZh ? '学术审查员' : 'Academic Reviewer', rawText: academicReview.analysis },
        industryAnalysis?.analysis && { agentName: isZh ? '产业分析员' : 'Industry Analyst', rawText: industryAnalysis.analysis },
        competitorAnalysis?.analysis && { agentName: isZh ? '竞品侦探' : 'Competitor Detective', rawText: competitorAnalysis.analysis },
        (report as any)?.crossDomainTransfer?.analysis && { agentName: isZh ? 'NovoDiscover 跨域侦察兵' : 'NovoDiscover Cross-Domain Scout', rawText: (report as any).crossDomainTransfer.analysis },
        innovationEvaluation?.analysis && { agentName: isZh ? '创新评估师' : 'Innovation Evaluator', rawText: innovationEvaluation.analysis },
        arbitration?.summary && { agentName: isZh ? '首席仲裁员' : 'Chief Arbitrator', rawText: arbitration.summary + (arbitration.reasoningContent ? '\n\n---\n\n**思维链 (Chain of Thought):**\n\n' + arbitration.reasoningContent : '') },
    ].filter(Boolean) as AgentRawItem[];

    return (
        <section className="space-y-3 mb-8">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
                {isZh ? '📋 深度证据' : '📋 Evidence Details'}
            </h3>

            {/* Pros vs Cons */}
            <AccordionSection
                icon={<span>⚖️</span>}
                title={isZh ? '优势与风险对照' : 'Pros vs Cons'}
                badge={`${allKeyFindings.length + allRedFlags.length} ${isZh ? '条发现' : 'findings'}`}
                badgeColor="bg-slate-100 text-slate-600"
                defaultOpen={true}
            >
                <div className="grid md:grid-cols-2 gap-4">
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

            {/* 多智能体 */}
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

            {/* 跨域创新迁移洞察 */}
            {(report as any)?.crossDomainTransfer && (report as any).crossDomainTransfer.bridges?.length > 0 && (
                <AccordionSection
                    icon={<Globe size={18} className="text-purple-500" />}
                    title={isZh ? 'NovoDiscover 跨域创新迁移洞察' : 'NovoDiscover Cross-Domain Innovation Transfer'}
                    badge={`${(report as any).crossDomainTransfer.bridges.length} ${isZh ? '条桥梁' : 'bridges'}`}
                    badgeColor="bg-purple-100 text-purple-700"
                    defaultOpen={true}
                >
                    <CrossDomainInsights data={(report as any).crossDomainTransfer} language={language} />
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
                                        <div className="text-[10px] font-bold text-emerald-700 uppercase mb-1.5">✓ {isZh ? '验证通过' : 'Verified'}</div>
                                        <ul className="space-y-1">
                                            {arbitration.crossDomainVerification.verifiedBridges.map((v: string, i: number) => (
                                                <li key={i} className="text-xs text-emerald-700">• {v}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {arbitration.crossDomainVerification.questionableClaims?.length > 0 && (
                                    <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100">
                                        <div className="text-[10px] font-bold text-amber-700 uppercase mb-1.5">⚠ {isZh ? '存疑引用' : 'Questionable'}</div>
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
                                    <div className="text-[10px] font-bold text-indigo-700 uppercase mb-1.5">💡 {isZh ? '仲裁员增强建议' : 'Enhanced Suggestions'}</div>
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
            {agentItems.length > 0 && (
                <AgentRawDisplay
                    items={agentItems}
                    title={isZh ? '✨ 查看 AI 深度思考过程' : '✨ View AI Deep Reasoning'}
                />
            )}

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
                                                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all" style={{ width: `${item.raw}%` }} />
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
    );
};

export default EvidenceAccordions;
