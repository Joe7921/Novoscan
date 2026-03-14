'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, Shield, Search, Loader2, Bot } from 'lucide-react';
import PrivacyToggle from '@/components/ui/PrivacyToggle';
import AntigravityCard from '@/components/antigravity/AntigravityCard';
import { ModelProvider, MODEL_OPTIONS } from '@/types';

interface BizscanFormProps {
    idea: string;
    setIdea: (val: string) => void;
    targetMarket: string;
    setTargetMarket: (val: string) => void;
    businessModel: string;
    setBusinessModel: (val: string) => void;
    industryVertical: string;
    setIndustryVertical: (val: string) => void;
    onSubmit: () => void;
    isLoading?: boolean;
    isPrivateMode: boolean;
    onPrivacyToggle: () => void;
    selectedModel: ModelProvider;
    setSelectedModel: (model: ModelProvider) => void;
}

export default function BizscanForm({
    idea, setIdea,
    targetMarket, setTargetMarket,
    businessModel, setBusinessModel,
    industryVertical, setIndustryVertical,
    onSubmit,
    isLoading = false,
    isPrivateMode,
    onPrivacyToggle,
    selectedModel,
    setSelectedModel,
}: BizscanFormProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, type: 'spring', bounce: 0.4 }}
            className="w-full max-w-4xl mx-auto mt-2 sm:mt-4 md:mt-12 lg:mt-16 px-4 sm:px-6 relative z-10"
        >
            {/* 标题区域 */}
            <div className="text-center mb-12">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 text-sm font-bold mb-6 mx-auto"
                >
                    <Lightbulb className="w-5 h-5" />
                    <span>商业想法创新度查重</span>
                </motion.div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-center uppercase leading-[1.1] text-gray-900 mb-6">
                    你的想法有多<span className="text-amber-500">创新</span>？
                </h1>

                <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto font-medium tracking-tight px-2 sm:px-0">
                    基于全球创投数据库，从语义新颖度、竞争态势、市场空白和可行性四个维度，量化评估你的商业想法创新指数（BII）。
                </p>
            </div>

            <AntigravityCard
                glassmorphism={true}
                className="p-1 sm:p-2 !bg-white/95 hover:!bg-white/95 !border-white/60 !shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] ring-1 ring-white/40 relative z-20"
                hoverEffect={true}
            >
                <div className="relative w-full flex flex-col h-full bg-white/95 rounded-[1.75rem] md:rounded-[2.75rem] p-4 sm:p-6 md:p-8">
                    {/* 主输入区 */}
                    <textarea
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder="在此详细描述你的商业想法：解决什么问题？面向什么客户？如何盈利？与竞品有何不同？&#10;&#10;描述越详细，评估越精准。AI 会自动提取关键要素并扫描全球竞品数据库..."
                        className="w-full h-48 sm:h-56 bg-transparent border-none outline-none resize-none text-gray-800 text-lg sm:text-xl placeholder-gray-400 font-medium leading-relaxed"
                        autoFocus
                    />

                    {/* 可选字段 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-200/50">
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">目标市场（可选）</label>
                            <input
                                type="text"
                                value={targetMarket}
                                onChange={(e) => setTargetMarket(e.target.value)}
                                placeholder="如：中国 B2B"
                                className="w-full px-3 py-2 bg-white/95 border border-gray-200/50 rounded-xl text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-amber-400/50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">商业模式（可选）</label>
                            <input
                                type="text"
                                value={businessModel}
                                onChange={(e) => setBusinessModel(e.target.value)}
                                placeholder="如：SaaS 订阅"
                                className="w-full px-3 py-2 bg-white/95 border border-gray-200/50 rounded-xl text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-amber-400/50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 mb-1 block">行业领域（可选）</label>
                            <input
                                type="text"
                                value={industryVertical}
                                onChange={(e) => setIndustryVertical(e.target.value)}
                                placeholder="如：企业服务"
                                className="w-full px-3 py-2 bg-white/95 border border-gray-200/50 rounded-xl text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-amber-400/50 transition-colors"
                            />
                        </div>
                    </div>

                    {/* 模型选择器 */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-4 pt-4 border-t border-gray-200/50">
                        <span className="text-xs text-gray-500 font-bold flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 flex-shrink-0">
                            <Bot className="w-4 h-4 text-gray-900" />
                            模型选择
                        </span>
                        <div className="flex bg-gray-100 p-1 rounded-[2rem] border border-gray-200 overflow-x-auto w-full sm:w-auto scrollbar-hide snap-x" style={{ WebkitOverflowScrolling: 'touch' }}>
                            {MODEL_OPTIONS.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => setSelectedModel(option.id)}
                                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all duration-300 flex items-center gap-1.5 snap-center ${selectedModel === option.id
                                        ? 'text-gray-900 shadow-md bg-white/95 border border-white/60'
                                        : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                                        }`}
                                    title={option.description.zh}
                                >
                                    <span className="flex items-center gap-1.5">
                                        {selectedModel === option.id && (
                                            <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
                                        )}
                                        <span>{option.name}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 操作栏 */}
                    <div className="flex flex-col mt-6 gap-4">
                        {/* 字数统计 + 积分 */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span>您的想法经 PII 脱敏后分析，不会被存储</span>
                                </div>
                                <PrivacyToggle isPrivate={isPrivateMode} onToggle={onPrivacyToggle} />
                            </div>
                            <div className="flex items-center gap-2.5">
                                <span className="text-xs text-gray-400 font-medium tabular-nums">
                                    {idea.length} / 5000
                                </span>
                                <span className="text-[11px] font-semibold text-amber-600 whitespace-nowrap flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                                    💰 12 点
                                </span>
                            </div>
                        </div>

                        {/* 提交按钮 — 独立一行居中展示 */}
                        <button
                            onClick={onSubmit}
                            disabled={idea.trim().length < 50 || isLoading}
                            className={`
                                group relative w-full py-4 rounded-2xl font-bold text-base tracking-wide
                                flex items-center justify-center gap-2.5 overflow-hidden
                                transition-all duration-300 ease-out
                                ${idea.trim().length < 50 || isLoading
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                    : 'bg-gradient-to-r from-amber-500 via-amber-400 to-orange-400 text-white shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 hover:brightness-105 active:scale-[0.98] border border-amber-400/50'
                                }
                            `}
                        >
                            {/* 微光扫过效果 */}
                            {!(idea.trim().length < 50 || isLoading) && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                            )}
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            <span className="relative z-10">{isLoading ? '正在连接...' : '评估创新度'}</span>
                        </button>
                    </div>
                </div>
            </AntigravityCard>
        </motion.div>
    );
}
