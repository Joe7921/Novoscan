'use client';

/**
 * Agent 原话展示组件
 *
 * 以终端风格展示 AI Agent 的完整原始分析文本。
 * 支持多个 Agent 的分 Tab 展示，也支持单个 Agent 的直接展示。
 */
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Terminal, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/** 单个 Agent 的原始输出 */
export interface AgentRawItem {
    /** Agent 名称（如 "学术审查员"、"MarketScout"） */
    agentName: string;
    /** Agent 标识颜色 class（可选） */
    colorClass?: string;
    /** Agent 原始分析文本（Markdown 格式） */
    rawText: string;
}

interface AgentRawDisplayProps {
    /** 一个或多个 Agent 原始输出 */
    items: AgentRawItem[];
    /** 标题（可选，默认 "查看 AI 深度思考过程"） */
    title?: string;
    /** 默认是否展开 */
    defaultOpen?: boolean;
}

export default function AgentRawDisplay({
    items,
    title,
    defaultOpen = false,
}: AgentRawDisplayProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [activeTab, setActiveTab] = useState(0);
    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

    // 过滤掉空内容
    const validItems = items.filter(item => item.rawText && item.rawText.trim().length > 0);
    if (validItems.length === 0) return null;

    const handleCopy = async (text: string, idx: number) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIdx(idx);
            setTimeout(() => setCopiedIdx(null), 2000);
        } catch {
            // 静默失败
        }
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white/95 shadow-sm overflow-hidden transition-all hover:shadow-md">
            {/* 标题栏 / 展开按钮 */}
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors cursor-pointer select-none"
            >
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
                    <Terminal className="w-4 h-4" />
                </div>
                <span className="font-bold text-slate-700 flex-1 text-left text-sm">
                    {title || '✨ 查看 AI 深度思考过程'}
                </span>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {validItems.length} Agent{validItems.length > 1 ? 's' : ''}
                </span>
                {isOpen ? (
                    <ChevronUp size={16} className="text-slate-400" />
                ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                )}
            </button>

            {/* 展开的内容区域 */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-slate-100">
                            {/* Tab 切换：仅在多 Agent 时显示 */}
                            {validItems.length > 1 && (
                                <div className="flex gap-1 px-4 pt-3 pb-1 overflow-x-auto scrollbar-hide">
                                    {validItems.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActiveTab(idx)}
                                            className={`
                                                px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all
                                                ${activeTab === idx
                                                    ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-sm'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                                                }
                                            `}
                                        >
                                            {item.agentName}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* 浅色风格内容区 */}
                            <div className="relative mx-4 mb-4 mt-2 rounded-xl bg-slate-50/80 border border-slate-200 overflow-hidden">
                                {/* 标题栏 */}
                                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white/60">
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono ml-2">
                                            {validItems[activeTab]?.agentName || 'Agent'} — raw output
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleCopy(validItems[activeTab]?.rawText || '', activeTab)}
                                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded-md hover:bg-slate-100"
                                        title="复制原文"
                                    >
                                        {copiedIdx === activeTab ? (
                                            <>
                                                <Check className="w-3 h-3 text-emerald-500" />
                                                <span className="text-emerald-500">已复制</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-3 h-3" />
                                                <span>复制</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* 内容主体 */}
                                <div className="p-4 max-h-[500px] overflow-y-auto custom-scrollbar bg-white/40">
                                    <div className="prose prose-slate prose-sm max-w-none
                                        prose-headings:text-slate-800 prose-headings:font-bold prose-headings:border-b prose-headings:border-slate-200 prose-headings:pb-1
                                        prose-p:text-slate-600 prose-p:leading-relaxed prose-p:text-[13px]
                                        prose-li:text-slate-600 prose-li:text-[13px]
                                        prose-strong:text-violet-600
                                        prose-code:text-indigo-600 prose-code:bg-indigo-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                                        prose-a:text-blue-500 prose-a:no-underline hover:prose-a:underline
                                    ">
                                        <ReactMarkdown>{validItems[activeTab]?.rawText || ''}</ReactMarkdown>
                                    </div>
                                </div>

                                {/* 底部状态栏 */}
                                <div className="px-4 py-1.5 border-t border-slate-200 bg-white/95 flex items-center justify-between">
                                    <span className="text-[9px] text-slate-400 font-mono">
                                        {validItems[activeTab]?.rawText?.length || 0} chars
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-mono">
                                        agent raw output • markdown
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
