/**
 * AnalysisHeader — 报告标题栏 + 操作按钮 + 部分结果告警
 * 从 analysis/index.tsx 提取
 */
import React from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, Wrench } from 'lucide-react';
import { Language } from '@/types';
import RetryProgressPanel from './RetryProgressPanel';

const ExportReportButton = dynamic(() => import('@/components/report/ExportReportButton'), { ssr: false });
const ShareButton = dynamic(() => import('@/components/report/ShareButton'), { ssr: false });

interface AnalysisHeaderProps {
    report: any;
    language: Language;
    query?: string;
    dualResult?: any;
    onReset: () => void;
    onRetryAllFailed?: () => void;
    onFullRetry?: () => void;
    retryingAgents?: Set<string>;
    retryProgress?: { total: number; completed: number; startTime: number } | null;
    fallbackAgents: string[];
}

const AnalysisHeader: React.FC<AnalysisHeaderProps> = ({
    report, language, query, dualResult, onReset,
    onRetryAllFailed, onFullRetry, retryingAgents, retryProgress, fallbackAgents,
}) => {
    const isZh = language === 'zh';

    return (
        <>
            {/* 部分结果警告 */}
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
                        <RetryProgressPanel retryingAgents={retryingAgents} retryProgress={retryProgress} isZh={isZh} />
                    )}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
                        {isZh ? '分析报告' : 'Analysis Report'}
                    </h2>
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
                            <ShareButton query={query} report={report} dualResult={dualResult} reportType="novoscan" />
                            <ExportReportButton query={query} report={report} dualResult={dualResult} language={language} />
                        </>
                    )}
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
                        {isZh ? '返回输入' : 'Back to Input'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default AnalysisHeader;
