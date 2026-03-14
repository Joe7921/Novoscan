'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Sparkles, Zap, BookOpen, Search } from 'lucide-react';

/**
 * 新用户引导遮罩组件
 * 仅首次访问时显示 4 步 Coach Marks，引导用户快速了解核心功能。
 * 使用 localStorage 标记已完成引导。
 */

const STORAGE_KEY = 'novoscan_onboarding_done';

interface Step {
    icon: React.ElementType;
    titleZh: string;
    titleEn: string;
    descZh: string;
    descEn: string;
    gradient: string;
}

const steps: Step[] = [
    {
        icon: Search,
        titleZh: '输入你的创新想法',
        titleEn: 'Enter Your Innovation',
        descZh: '在搜索框中描述你的研究想法或技术构想，AI 将自动解析核心语义。',
        descEn: 'Describe your research idea in the search box. AI will parse the core semantics automatically.',
        gradient: 'from-blue-500 to-cyan-400',
    },
    {
        icon: Zap,
        titleZh: '选择分析模式',
        titleEn: 'Choose Analysis Mode',
        descZh: '⚡ Flash 极速模式 30 秒出结果，标准模式 6 Agent 深度分析。',
        descEn: '⚡ Flash mode delivers in 30s, Standard mode uses 6 AI agents for deep analysis.',
        gradient: 'from-amber-500 to-orange-400',
    },
    {
        icon: BookOpen,
        titleZh: '聚焦你的学科领域',
        titleEn: 'Focus Your Domain',
        descZh: '选择学科让分析更精准，也可以跳过让 AI 自动识别。',
        descEn: 'Pick a domain for precision, or skip to let AI detect automatically.',
        gradient: 'from-emerald-500 to-teal-400',
    },
    {
        icon: Sparkles,
        titleZh: '获取深度报告',
        titleEn: 'Get Deep Report',
        descZh: '点击"开始分析"，数十秒内获得量化创新评分、雷达图和行动建议。',
        descEn: 'Click "Analyze" to get your innovation score, radar chart and action insights in seconds.',
        gradient: 'from-violet-500 to-purple-400',
    },
];

interface OnboardingOverlayProps {
    language?: 'zh' | 'en';
}

export default function OnboardingOverlay({ language = 'zh' }: OnboardingOverlayProps) {
    const [show, setShow] = useState(false);
    const [current, setCurrent] = useState(0);
    const isZh = language === 'zh';

    useEffect(() => {
        // 仅客户端执行；已完成引导则不弹出
        if (typeof window === 'undefined') return;
        const done = localStorage.getItem(STORAGE_KEY);
        if (!done) {
            // 延迟 1.5s 弹出，等首屏渲染完
            const timer = setTimeout(() => setShow(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleComplete = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, '1');
        setShow(false);
    }, []);

    const handleNext = useCallback(() => {
        if (current < steps.length - 1) {
            setCurrent(prev => prev + 1);
        } else {
            handleComplete();
        }
    }, [current, handleComplete]);

    if (!show) return null;

    const step = steps[current];
    const Icon = step.icon;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center"
            >
                {/* 背景遮罩 */}
                <div
                    className="absolute inset-0 bg-black/40"
                    onClick={handleComplete}
                />

                {/* 引导卡片 */}
                <motion.div
                    key={current}
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                    className="relative z-10 bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-sm w-[90%] mx-4 overflow-hidden"
                >
                    {/* 顶部渐变条 */}
                    <div className={`h-1.5 bg-gradient-to-r ${step.gradient}`} />

                    {/* 关闭按钮 */}
                    <button
                        onClick={handleComplete}
                        className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        aria-label={isZh ? '跳过引导' : 'Skip guide'}
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="p-6 sm:p-8">
                        {/* 步骤指示 */}
                        <div className="flex items-center gap-1.5 mb-6">
                            {steps.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1 rounded-full transition-all duration-500 ${i === current
                                        ? `w-8 bg-gradient-to-r ${steps[i].gradient}`
                                        : i < current
                                            ? 'w-4 bg-gray-300'
                                            : 'w-4 bg-gray-200'
                                        }`}
                                />
                            ))}
                            <span className="ml-auto text-xs text-gray-400 font-bold">
                                {current + 1}/{steps.length}
                            </span>
                        </div>

                        {/* 图标 */}
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-5 shadow-lg`}>
                            <Icon className="w-7 h-7 text-white" />
                        </div>

                        {/* 标题 */}
                        <h3 className="text-xl font-black text-gray-900 mb-2 tracking-tight">
                            {isZh ? step.titleZh : step.titleEn}
                        </h3>

                        {/* 描述 */}
                        <p className="text-sm text-gray-500 leading-relaxed mb-8">
                            {isZh ? step.descZh : step.descEn}
                        </p>

                        {/* 操作按钮 */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={handleComplete}
                                className="text-sm text-gray-400 hover:text-gray-600 font-medium transition-colors"
                            >
                                {isZh ? '跳过' : 'Skip'}
                            </button>
                            <button
                                onClick={handleNext}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold bg-gradient-to-r ${step.gradient} shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}
                            >
                                {current < steps.length - 1
                                    ? (isZh ? '下一步' : 'Next')
                                    : (isZh ? '开始体验 🚀' : 'Start 🚀')
                                }
                                {current < steps.length - 1 && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
