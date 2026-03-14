'use client';
/**
 * Agent 记忆洞察展示组件
 * 
 * 展示本次分析参考了哪些历史经验、经验库规模等信息。
 * 设计风格：毛玻璃渐变卡片，与项目整体风格保持一致。
 */
import React, { useState } from 'react';
import { Brain, ChevronDown, Clock, Tag, TrendingUp, Sparkles } from 'lucide-react';

interface MemoryInsightData {
    experiencesUsed: number;
    relevantQueries: string[];
    contextSummary: string;
}

interface AgentMemoryInsightProps {
    data: MemoryInsightData;
    language: 'zh' | 'en';
}

const AgentMemoryInsight: React.FC<AgentMemoryInsightProps> = ({ data, language }) => {
    const [expanded, setExpanded] = useState(false);
    const isZh = language === 'zh';

    if (!data || data.experiencesUsed === 0) return null;

    return (
        <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 via-purple-50/60 to-fuchsia-50/40 shadow-sm overflow-hidden transition-all hover:shadow-md">
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-3 px-5 py-4 cursor-pointer select-none text-left"
            >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200/50">
                    <Brain size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800 flex items-center gap-2">
                        {isZh ? 'NovoscanEVO 智能体记忆进化' : 'NovoscanEVO Agent Memory Evolution'}
                        <Sparkles size={14} className="text-violet-500" />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {isZh
                            ? `参考了 ${data.experiencesUsed} 条历史分析经验`
                            : `Referenced ${data.experiencesUsed} historical analysis experiences`}
                    </p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                    {data.experiencesUsed} {isZh ? '条经验' : 'exp'}
                </span>
                <ChevronDown
                    size={18}
                    className={`text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                />
            </button>

            {/* 展开详情 */}
            {expanded && (
                <div className="px-5 pb-5 pt-1 border-t border-violet-100/50 animate-fade-in space-y-4">
                    {/* 相关历史查询列表 */}
                    {data.relevantQueries.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Clock size={12} />
                                {isZh ? '参考的历史案例' : 'Referenced Cases'}
                            </h4>
                            <div className="space-y-1.5">
                                {data.relevantQueries.map((query, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-start gap-2 text-sm text-slate-700 bg-white/95 rounded-lg px-3 py-2 border border-violet-100/40"
                                    >
                                        <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                            {idx + 1}
                                        </span>
                                        <span className="line-clamp-2">{query}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 经验摘要 */}
                    {data.contextSummary && (
                        <div className="bg-white/95 rounded-xl p-3 border border-violet-100/30">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                <Tag size={12} />
                                {isZh ? '经验摘要' : 'Experience Summary'}
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line line-clamp-6">
                                {data.contextSummary.slice(0, 500)}
                            </p>
                        </div>
                    )}

                    {/* 底部提示 */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <TrendingUp size={10} />
                        {isZh
                            ? '每次分析都让系统更智能 — 经验库持续积累中'
                            : 'Every analysis makes the system smarter — experience pool keeps growing'}
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(AgentMemoryInsight);
