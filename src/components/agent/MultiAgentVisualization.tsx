import React from 'react';
import { motion } from 'framer-motion';
import { Language } from '@/types';
import { GraduationCap, Briefcase, BarChart3, SearchCode, Scale, CheckCircle2, Loader2, AlertCircle, RotateCw, Wrench } from 'lucide-react';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'error' | 'timeout';

export interface AgentExecutionData {
    id: string;
    status: AgentStatus;
    progress: number;
    resultExcerpt?: string;
}

interface MultiAgentVisualizationProps {
    agents?: Record<string, AgentExecutionData>;
    language?: Language;
    report?: any;
    /** 单独重试某个 Agent */
    onRetryAgent?: (agentId: string) => void;
    /** 一键重试所有失败 Agent */
    onRetryAllFailed?: () => void;
    /** 正在重试中的 Agent 集合 */
    retryingAgents?: Set<string>;
}

const MultiAgentVisualization: React.FC<MultiAgentVisualizationProps> = ({
    agents = {},
    language = 'zh',
    report,
    onRetryAgent,
    onRetryAllFailed,
    retryingAgents = new Set(),
}) => {
    const isZh = language === 'zh';

    const getAgentStatus = (agentReport: unknown): AgentStatus => {
        if (!agentReport) return 'completed';
        // 使用 isFallback 标记区分超时降级和正常的低置信度
        if (agentReport.isFallback) return 'timeout';
        // 仲裁员特殊处理（ArbitrationResult 无 isFallback，使用 summary 判断）
        if (agentReport.summary && agentReport.summary.includes('未能完成')) return 'timeout';
        return 'completed';
    };

    const agentConfig = {
        academic: {
            id: 'academic',
            status: getAgentStatus(report?.academicReview),
            progress: 100,
            resultExcerpt: report?.academicReview?.keyFindings?.[0] || '通过学术知识图谱完成技术查新',
            icon: GraduationCap, color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-200',
            nameZh: '学术审查员', nameEn: 'Academic Reviewer'
        },
        industry: {
            id: 'industry',
            status: getAgentStatus(report?.industryAnalysis),
            progress: 100,
            resultExcerpt: report?.industryAnalysis?.keyFindings?.[0] || '完成全网开源与商业化路径扫描',
            icon: Briefcase, color: 'text-purple-600', bgColor: 'bg-purple-100', borderColor: 'border-purple-200',
            nameZh: '产业分析员', nameEn: 'Industry Analyst'
        },
        competitor: {
            id: 'competitor',
            status: getAgentStatus(report?.competitorAnalysis),
            progress: 100,
            resultExcerpt: report?.competitorAnalysis?.keyFindings?.[0] || '完成市场与替代品生态评估',
            icon: SearchCode, color: 'text-rose-600', bgColor: 'bg-rose-100', borderColor: 'border-rose-200',
            nameZh: '竞品侦探', nameEn: 'Competitor Detective'
        },
        innovation: {
            id: 'innovation',
            status: getAgentStatus(report?.innovationEvaluation),
            progress: 100,
            resultExcerpt: report?.innovationEvaluation?.keyFindings?.[0] || '交叉融合三源分析报告完成综合定性',
            icon: BarChart3, color: 'text-amber-600', bgColor: 'bg-amber-100', borderColor: 'border-amber-200',
            nameZh: '创新评估师', nameEn: 'Innovation Evaluator'
        },
        arbitrator: {
            id: 'arbitrator',
            status: getAgentStatus(report?.arbitration),
            progress: 100,
            resultExcerpt: report?.arbitration?.summary?.split('。')[0] + '。' || '自动权重调节完毕，最终结论已生成',
            icon: Scale, color: 'text-emerald-600', bgColor: 'bg-emerald-100', borderColor: 'border-emerald-200',
            nameZh: '首席仲裁员', nameEn: 'Chief Arbitrator'
        }
    };

    // 可重试的 Agent ID 映射（与后端 AGENT_MAP 一致，仅 Layer1 独立 Agent）
    const RETRYABLE_AGENT_IDS: Record<string, string> = {
        academic: 'academicReviewer',
        industry: 'industryAnalyst',
        competitor: 'competitorDetective',
    };

    // 收集所有降级的 Agent
    const failedAgentIds = Object.entries(agentConfig)
        .filter(([, cfg]) => cfg.status === 'timeout' && RETRYABLE_AGENT_IDS[cfg.id])
        .map(([, cfg]) => RETRYABLE_AGENT_IDS[cfg.id]);
    const hasMultipleFailed = failedAgentIds.length > 1;
    const hasAnyFailed = failedAgentIds.length > 0;

    const AgentCard = ({ data, phase }: { data: unknown, phase: number }) => {
        const retryId = RETRYABLE_AGENT_IDS[data.id];
        const isRetrying = retryId ? retryingAgents.has(retryId) : false;
        const canRetry = data.status === 'timeout' && retryId && onRetryAgent && !isRetrying;

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: phase * 0.2 }}
                className={`relative p-3 rounded-2xl border ${data.borderColor} bg-white shadow-sm hover:shadow-md transition-shadow z-10 w-full md:w-56`}
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${data.bgColor} ${data.color}`}>
                            <data.icon size={16} />
                        </div>
                        <span className="font-bold text-gray-800 text-xs">{isZh ? data.nameZh : data.nameEn}</span>
                    </div>
                    <div>
                        {data.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-500" />}
                        {isRetrying && <Loader2 size={16} className="text-blue-500 animate-spin" />}
                        {data.status === 'running' && !isRetrying && <Loader2 size={16} className="text-blue-500 animate-spin" />}
                        {(data.status === 'error' || data.status === 'timeout') && !isRetrying && <AlertCircle size={16} className="text-amber-500" />}
                        {data.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-200" />}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-gray-400 font-medium font-mono">
                        <span>{isRetrying ? 'RETRYING...' : data.status === 'timeout' ? 'FALLBACK' : data.status.toUpperCase()}</span>
                        <span>{data.progress}%</span>
                    </div>
                    <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            className={`h-full ${data.status === 'completed' ? 'bg-emerald-500' : isRetrying ? 'bg-blue-500' : data.status === 'timeout' ? 'bg-amber-500' : 'bg-blue-500'}`}
                            initial={{ width: 0 }}
                            animate={{ width: isRetrying ? '60%' : `${data.progress}%` }}
                            transition={{ duration: isRetrying ? 2 : 1, repeat: isRetrying ? Infinity : 0, repeatType: 'reverse' }}
                        />
                    </div>
                    {data.resultExcerpt && !isRetrying && (
                        <div className="mt-2 p-1.5 bg-gray-50 rounded-lg border border-gray-100 text-[10px] text-gray-600 leading-tight line-clamp-2" title={data.resultExcerpt}>
                            {data.resultExcerpt}
                        </div>
                    )}
                    {isRetrying && (
                        <div className="mt-2 p-1.5 bg-blue-50 rounded-lg border border-blue-100 text-[10px] text-blue-600 leading-tight text-center font-medium">
                            {isZh ? '正在重新分析...' : 'Retrying analysis...'}
                        </div>
                    )}
                    {canRetry && (
                        <button
                            onClick={() => onRetryAgent(retryId)}
                            className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-[10px] font-bold text-amber-700 transition-colors cursor-pointer"
                        >
                            <RotateCw size={10} />
                            {isZh ? '重试分析' : 'Retry'}
                        </button>
                    )}
                </div>
            </motion.div>
        );
    };

    return (
        <div className="w-full h-full bg-slate-50 rounded-3xl p-6 md:p-8 border border-slate-200 shadow-inner overflow-x-auto md:overflow-hidden relative flex flex-col justify-center md:hover:overflow-x-auto transition-all">
            <div className="w-full mx-auto">
                <div className="mb-6 relative z-10 text-center md:text-left flex flex-col sm:flex-row items-center sm:items-start justify-between gap-3">
                    <h3 className="text-lg font-extrabold text-slate-800 flex items-center justify-center md:justify-start gap-2">
                        <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">
                            {isZh ? 'Multi-Agents 审查协作流' : 'Multi-Agents Review Flow'}
                        </span>
                        <span className="text-[10px] bg-slate-800 text-white px-2 py-1 rounded-full uppercase tracking-wider font-bold">3+1+1 拓扑</span>
                    </h3>
                    {hasAnyFailed && onRetryAllFailed && hasMultipleFailed && retryingAgents.size === 0 && (
                        <button
                            onClick={onRetryAllFailed}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                        >
                            <Wrench size={12} />
                            {isZh ? `一键修复 ${failedAgentIds.length} 个专家` : `Fix ${failedAgentIds.length} Agents`}
                        </button>
                    )}
                    {retryingAgents.size > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-full text-xs font-bold animate-pulse">
                            <Loader2 size={12} className="animate-spin" />
                            {isZh ? `正在修复 ${retryingAgents.size} 个专家...` : `Fixing ${retryingAgents.size} agents...`}
                        </div>
                    )}
                </div>

                {/* Vertical for mobile, Horizontal for desktop */}
                <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 pt-2 pb-2">

                    {/* Phase 1: 3 Agents - Academic, Industry, Competitor */}
                    <div className="flex flex-col gap-4 relative z-10 w-full md:w-auto md:flex-shrink-0">
                        <div className="text-center md:absolute md:-top-8 md:left-1/2 md:-translate-x-1/2 w-full">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-slate-50 px-2">
                                {isZh ? 'L1: 并行解析' : 'L1: Parallel'}
                            </span>
                        </div>
                        <AgentCard data={agentConfig.academic} phase={1} />
                        <AgentCard data={agentConfig.industry} phase={1} />
                        <AgentCard data={agentConfig.competitor} phase={1} />
                    </div>

                    {/* 移动端纵向连接箭头 */}
                    <div className="flex md:hidden items-center justify-center py-1">
                        <div className="w-0.5 h-6 bg-gray-200 relative">
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-gray-300 text-xs">▼</span>
                        </div>
                    </div>

                    {/* 桌面端 L1 → L2 水平虚线连接器 */}
                    <div className="hidden md:flex items-center justify-center flex-shrink-0 px-1" style={{ minWidth: 32 }}>
                        <div className="w-full border-t-2 border-dashed border-slate-300 relative">
                            <span className="absolute -right-1 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]">▸</span>
                        </div>
                    </div>

                    {/* Phase 2: 1 Agent - Innovation */}
                    <div className="flex flex-col justify-center relative z-10 w-full md:w-auto md:flex-shrink-0">
                        <div className="text-center md:absolute md:-top-8 md:left-1/2 md:-translate-x-1/2 w-full">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-slate-50 px-2">
                                {isZh ? 'L2: 交叉定性' : 'L2: Cross Review'}
                            </span>
                        </div>
                        <AgentCard data={agentConfig.innovation} phase={2} />
                    </div>

                    {/* 移动端纵向连接箭头 */}
                    <div className="flex md:hidden items-center justify-center py-1">
                        <div className="w-0.5 h-6 bg-gray-200 relative">
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-gray-300 text-xs">▼</span>
                        </div>
                    </div>

                    {/* 桌面端 L2 → L3 水平虚线连接器 */}
                    <div className="hidden md:flex items-center justify-center flex-shrink-0 px-1" style={{ minWidth: 32 }}>
                        <div className="w-full border-t-2 border-dashed border-slate-300 relative">
                            <span className="absolute -right-1 top-1/2 -translate-y-1/2 text-slate-300 text-[10px]">▸</span>
                        </div>
                    </div>

                    {/* Phase 3: 1 Agent - Arbitrator */}
                    <div className="flex flex-col justify-center relative z-10 w-full md:w-auto md:flex-shrink-0">
                        <div className="text-center md:absolute md:-top-8 md:left-1/2 md:-translate-x-1/2 w-full">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-slate-50 px-2">
                                {isZh ? 'L3: 动态仲裁' : 'L3: Arbitrate'}
                            </span>
                        </div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6 }}
                            className="md:my-auto"
                        >
                            <div className={`relative p-4 rounded-3xl border-2 ${agentConfig.arbitrator.borderColor} bg-white shadow-lg overflow-hidden w-full md:w-64`}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full blur-[30px] -z-10 transform translate-x-1/2 -translate-y-1/2" />

                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2.5 rounded-xl ${agentConfig.arbitrator.bgColor} ${agentConfig.arbitrator.color}`}>
                                        <Scale size={20} />
                                    </div>
                                    <div>
                                        <span className="font-black text-gray-900 block text-sm">{isZh ? agentConfig.arbitrator.nameZh : agentConfig.arbitrator.nameEn}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-emerald-600 font-bold">{isZh ? '最终决策中心' : 'Final Center'}</span>
                                            {report?.arbitration?.usedModel && (
                                                <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold">
                                                    {report.arbitration.usedModel}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                                        <span className={agentConfig.arbitrator.status === 'completed' ? 'text-emerald-600' : 'text-amber-500'}>
                                            {agentConfig.arbitrator.status === 'completed' ? (isZh ? '仲裁完成' : 'Done') : agentConfig.arbitrator.status.toUpperCase()}
                                        </span>
                                        <span className="text-gray-900">{agentConfig.arbitrator.progress}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                        <motion.div
                                            className={`h-full ${agentConfig.arbitrator.status === 'timeout' ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${agentConfig.arbitrator.progress}%` }}
                                            transition={{ duration: 1.2 }}
                                        />
                                    </div>

                                    {agentConfig.arbitrator.resultExcerpt && (
                                        <div className="mt-3 p-2 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                                            <p className="text-[10px] text-gray-700 font-medium leading-relaxed italic line-clamp-3">
                                                "{agentConfig.arbitrator.resultExcerpt}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(MultiAgentVisualization);
