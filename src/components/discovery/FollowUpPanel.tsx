'use client';

/**
 * 追问面板组件
 *
 * 在首次分析完成后展示 AI 生成的追问方向，
 * 用户可以选择追问方向并输入补充信息来精化分析。
 */
import React, { useState, useEffect } from 'react';
import { MessageCircleQuestion, Sparkles, Send, Loader2, Check, ChevronDown, ChevronUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { Language } from '@/types';
const ExportReportButton = dynamic(() => import('./ExportReportButton'), { ssr: false });
const CrossProductRecommendation = dynamic(() => import('./CrossProductRecommendation'), { ssr: false });

/** 追问问题分类 */
export type FollowUpCategory = 'tech' | 'scenario' | 'compare' | 'exclude' | 'challenge';

/** 单条追问问题 */
export interface FollowUpQuestion {
    id: string;
    question: string;
    category: FollowUpCategory;
    hint: string;
    icon: string;
}

interface FollowUpPanelProps {
    language: Language;
    questions: FollowUpQuestion[];
    isLoading: boolean;              // 追问问题加载中
    isRefining: boolean;             // 精化分析运行中
    followUpRound: number;           // 当前追问轮次
    onRefine: (selectedQuestions: string[], userInput: string) => void;
    refineProgress?: {               // 精化分析的进度
        globalProgress: number;
        currentLog: string;
    };
    /* 以下为可选 props */
    query?: string;
    report?: any;
    dualResult?: any;
    /** 是否显示跨产品推荐（默认 true） */
    showCrossRecommendation?: boolean;
}

/** 分类样式 */
const CATEGORY_STYLES: Record<FollowUpCategory, {
    bg: string;
    border: string;
    text: string;
    activeBg: string;
    activeBorder: string;
}> = {
    tech: {
        bg: 'bg-blue-50/60',
        border: 'border-blue-200/60',
        text: 'text-blue-700',
        activeBg: 'bg-blue-100',
        activeBorder: 'border-blue-400',
    },
    scenario: {
        bg: 'bg-emerald-50/60',
        border: 'border-emerald-200/60',
        text: 'text-emerald-700',
        activeBg: 'bg-emerald-100',
        activeBorder: 'border-emerald-400',
    },
    compare: {
        bg: 'bg-amber-50/60',
        border: 'border-amber-200/60',
        text: 'text-amber-700',
        activeBg: 'bg-amber-100',
        activeBorder: 'border-amber-400',
    },
    exclude: {
        bg: 'bg-rose-50/60',
        border: 'border-rose-200/60',
        text: 'text-rose-700',
        activeBg: 'bg-rose-100',
        activeBorder: 'border-rose-400',
    },
    challenge: {
        bg: 'bg-fuchsia-50/60',
        border: 'border-fuchsia-200/60',
        text: 'text-fuchsia-700',
        activeBg: 'bg-fuchsia-100',
        activeBorder: 'border-fuchsia-400',
    },
};

const FollowUpPanel: React.FC<FollowUpPanelProps> = ({
    language,
    questions,
    isLoading,
    isRefining,
    followUpRound,
    onRefine,
    refineProgress,
    query,
    report,
    dualResult,
}) => {
    const isZh = language === 'zh';
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [answers, setAnswers] = useState<Record<string, string>>({});  // 每个问题的用户回答
    const [userInput, setUserInput] = useState('');  // 补充说明输入
    const [isExpanded, setIsExpanded] = useState(true);

    // 追问问题变化时重置选择和回答
    useEffect(() => {
        setSelectedIds(new Set());
        setAnswers({});
        setUserInput('');
    }, [questions]);

    const toggleQuestion = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // 更新某个问题的回答
    const updateAnswer = (id: string, value: string) => {
        setAnswers(prev => ({ ...prev, [id]: value }));
    };

    const handleRefine = () => {
        if (selectedIds.size === 0 && !userInput.trim()) return;
        // 将选中的问题和对应回答组合成文本
        const selectedQuestions = questions
            .filter(q => selectedIds.has(q.id))
            .map(q => {
                const answer = answers[q.id]?.trim();
                return answer ? `${q.question}\n用户回答：${answer}` : q.question;
            });
        onRefine(selectedQuestions, userInput.trim());
    };

    const canSubmit = (selectedIds.size > 0 || userInput.trim().length > 0) && !isRefining;

    // ========== 精化进行中状态（全屏 ThinkingIndicator 由 page.tsx 渲染） ==========
    if (isRefining) {
        return null;
    }

    // ========== 加载中状态 ==========
    if (isLoading) {
        return (
            <div className="rounded-2xl border-2 border-slate-200 bg-white/95 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="text-indigo-500 animate-spin" size={24} />
                    <span className="font-bold text-slate-800">
                        {isZh ? '正在生成追问问题...' : 'Generating follow-up questions...'}
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    // 没有追问问题则不渲染
    if (!questions || questions.length === 0) return null;

    // ========== 正常渲染 ==========
    return (
        <div className="relative rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-white/80 via-indigo-50/30 to-purple-50/30 shadow-lg overflow-hidden transition-all duration-300">
            {/* 装饰光效 */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200/15 rounded-full blur-3xl pointer-events-none" />

            {/* Header — 标题 + 收起展开 */}
            <button
                onClick={() => setIsExpanded(prev => !prev)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-indigo-50/30 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
                        <MessageCircleQuestion className="text-white" size={18} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-slate-800 text-base">
                            {isZh ? '🔍 Novoscan Followup — 精化您的分析' : '🔍 Novoscan Followup — Refine Your Results'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {isZh
                                ? '选择追问方向精化分析，费用等同一次常规分析（复用已有检索数据）'
                                : 'Select follow-up directions to refine — charged as one standard analysis (reusing search data)'}
                        </p>
                    </div>
                </div>
                {isExpanded ? (
                    <ChevronUp className="text-slate-400" size={18} />
                ) : (
                    <ChevronDown className="text-slate-400" size={18} />
                )}
            </button>

            {/* 可折叠区域 */}
            {isExpanded && (
                <div className="px-6 pb-6 relative z-10 animate-fade-in">
                    {/* 追问问题列表 + 补充说明卡片 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
                        {questions.map(q => {
                            const isSelected = selectedIds.has(q.id);
                            const style = CATEGORY_STYLES[q.category] || CATEGORY_STYLES.tech;

                            return (
                                <div
                                    key={q.id}
                                    className={`
                                        relative text-left rounded-xl border-2 transition-all duration-200
                                        hover:shadow-md
                                        ${isSelected
                                            ? `${style.activeBg} ${style.activeBorder} shadow-md`
                                            : `${style.bg} ${style.border}`
                                        }
                                    `}
                                >
                                    {/* 问题区域（可点击选择） */}
                                    <button
                                        onClick={() => toggleQuestion(q.id)}
                                        className="w-full text-left p-4 hover:opacity-90 active:scale-[0.98] transition-all"
                                    >
                                        {/* 选中标记 */}
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                                                <Check className="text-white" size={12} />
                                            </div>
                                        )}

                                        <div className="flex items-start gap-2.5">
                                            <span className="text-lg flex-shrink-0 mt-0.5">{q.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-semibold leading-snug ${style.text}`}>
                                                    {q.question}
                                                </p>
                                                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                                                    {q.hint}
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    {/* 选中后展开的回答输入框 */}
                                    {isSelected && (
                                        <div className="px-4 pb-3 animate-fade-in">
                                            <div className="border-t border-slate-200/60 pt-2.5">
                                                <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
                                                    ✏️ {isZh ? '您的回答（可选）' : 'Your answer (optional)'}
                                                </label>
                                                <textarea
                                                    value={answers[q.id] || ''}
                                                    onChange={e => updateAnswer(q.id, e.target.value)}
                                                    onClick={e => e.stopPropagation()}
                                                    placeholder={isZh ? '输入您的想法或补充信息...' : 'Enter your thoughts...'}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200/80 bg-white/95 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all resize-none"
                                                    rows={2}
                                                    maxLength={300}
                                                />
                                                <div className="flex justify-end mt-0.5">
                                                    <span className={`text-[10px] ${(answers[q.id]?.length || 0) > 250 ? 'text-amber-500' : 'text-slate-400'}`}>
                                                        {answers[q.id]?.length || 0}/300
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* 补充说明 — 与追问卡片同级别 */}
                        <div
                            className={`
                                relative text-left rounded-xl border-2 transition-all duration-200
                                hover:shadow-md
                                ${userInput.trim()
                                    ? 'bg-violet-100 border-violet-400 shadow-md'
                                    : 'bg-violet-50/60 border-violet-200/60'
                                }
                            `}
                        >
                            <div className="p-4">
                                <div className="flex items-start gap-2.5 mb-3">
                                    <span className="text-lg flex-shrink-0 mt-0.5">💬</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold leading-snug text-violet-700">
                                            {isZh ? '补充说明' : 'Additional Details'}
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                            {isZh
                                                ? '有其他想法？在这里自由补充您想要分析的方向'
                                                : 'Have other ideas? Add your own analysis direction here'}
                                        </p>
                                    </div>
                                </div>
                                <textarea
                                    value={userInput}
                                    onChange={e => setUserInput(e.target.value)}
                                    placeholder={isZh
                                        ? '例如，我专注于医疗健康领域的应用，使用 Transformer 架构...'
                                        : 'e.g., I focus on healthcare applications, using Transformer architecture...'}
                                    className="w-full px-3 py-2 rounded-lg border border-violet-200/80 bg-white/95 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all resize-none"
                                    rows={2}
                                    maxLength={500}
                                />
                                <div className="flex justify-end mt-0.5">
                                    <span className={`text-[10px] ${userInput.length > 400 ? 'text-amber-500' : 'text-slate-400'}`}>
                                        {userInput.length}/500
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 操作按钮行 */}
                    <div className="flex items-center justify-between">
                        {/* 可选的导出按钮 */}
                        <div>
                            {query && report && (
                                <ExportReportButton
                                    query={query}
                                    report={report}
                                    dualResult={dualResult}
                                    language={language}
                                    size="sm"
                                    variant="outline"
                                />
                            )}
                        </div>

                        {/* 精化分析按钮 + 费用提示 */}
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-gray-400 whitespace-nowrap flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                                💰 15 {isZh ? '点' : 'pts'}
                            </span>
                            <button
                                onClick={handleRefine}
                                disabled={!canSubmit}
                                className={`
                                    flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200
                                    ${canSubmit
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-[0.97]'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    }
                                `}
                            >
                                <Sparkles size={16} />
                                {isZh ? '精化分析' : 'Refine Analysis'}
                                <Send size={14} />
                            </button>
                        </div>
                    </div>

                    {/* 选中计数 */}
                    {selectedIds.size > 0 && (
                        <p className="text-xs text-indigo-500 mt-2 text-right">
                            {isZh
                                ? `已选择 ${selectedIds.size} 条追问方向`
                                : `${selectedIds.size} direction(s) selected`}
                        </p>
                    )}

                    {/* 跨产品智能推荐 */}
                    {query && (
                        <CrossProductRecommendation
                            query={query}
                            report={report}
                            language={language}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default React.memo(FollowUpPanel);