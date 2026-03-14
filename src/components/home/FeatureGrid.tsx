import React from 'react';
import { Language } from '@/types';
import { translations } from '../../locales/translations';
import {
    Zap, Globe, Cpu, FileCheck,
    ArrowRight
} from 'lucide-react';
// 性能优化：使用 CSS 动画替代 framer-motion

interface FeatureGridProps {
    language: Language;
}

const FeatureGrid: React.FC<FeatureGridProps> = ({ language }) => {
    const t = translations[language];



    // 工作流程步骤
    const steps = [
        {
            icon: Zap,
            number: '01',
            title: t.feature1Title,
            desc: t.feature1Desc,
            gradient: 'from-blue-500 to-cyan-400',
            glowColor: 'rgba(66, 133, 244, 0.15)',
            iconBg: 'bg-blue-500/10',
            iconColor: 'text-blue-500',
            borderAccent: 'group-hover:border-blue-400/40',
        },
        {
            icon: Globe,
            number: '02',
            title: t.feature2Title,
            desc: t.feature2Desc,
            gradient: 'from-violet-500 to-purple-400',
            glowColor: 'rgba(139, 92, 246, 0.15)',
            iconBg: 'bg-violet-500/10',
            iconColor: 'text-violet-500',
            borderAccent: 'group-hover:border-violet-400/40',
        },
        {
            icon: Cpu,
            number: '03',
            title: t.feature3Title,
            desc: t.feature3Desc,
            gradient: 'from-amber-500 to-orange-400',
            glowColor: 'rgba(245, 158, 11, 0.15)',
            iconBg: 'bg-amber-500/10',
            iconColor: 'text-amber-500',
            borderAccent: 'group-hover:border-amber-400/40',
        },
        {
            icon: FileCheck,
            number: '04',
            title: t.feature4Title,
            desc: t.feature4Desc,
            gradient: 'from-emerald-500 to-teal-400',
            glowColor: 'rgba(16, 185, 129, 0.15)',
            iconBg: 'bg-emerald-500/10',
            iconColor: 'text-emerald-500',
            borderAccent: 'group-hover:border-emerald-400/40',
        },
    ];

    return (
        <section className="w-full max-w-6xl mx-auto py-16 sm:py-20 px-4 sm:px-6 relative z-10">
            {/* 板块标题 */}
            <div
                className="text-center mb-12 sm:mb-16 animate-fade-in-up"
            >
                <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-4 py-1.5 rounded-full mb-4">
                    {language === 'zh' ? '工作流程' : 'How It Works'}
                </span>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                    {language === 'zh' ? '从想法到洞察，四步即达' : 'From Idea to Insight, in 4 Steps'}
                </h2>
                <p className="mt-3 text-sm sm:text-base text-gray-400 dark:text-slate-500 max-w-xl mx-auto font-medium">
                    {language === 'zh'
                        ? '我们的 AI 推理集群自动化地完成以下流程，让您在数十秒内获得深度分析报告。'
                        : 'Our AI reasoning cluster automates the entire pipeline, delivering a deep analysis report in seconds.'}
                </p>
            </div>

            {/* 四步卡片 */}
            <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6"
            >
                {steps.map((step, idx) => {
                    const Icon = step.icon;
                    return (
                        <div
                            key={idx}
                            className={`group relative p-6 sm:p-7 rounded-3xl border border-gray-100/80 dark:border-slate-800/80 bg-white/95 dark:bg-dark-surface/60 overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-2 animate-stagger-in ${step.borderAccent}`}
                            style={{ animationDelay: `${0.1 + idx * 0.12}s` }}
                        >
                            {/* 背景发光 */}
                            <div
                                className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                style={{ background: step.glowColor }}
                            />

                            {/* 步骤序号 */}
                            <span className={`text-[11px] font-black tracking-widest bg-gradient-to-r ${step.gradient} gradient-text-clip`}>
                                STEP {step.number}
                            </span>

                            {/* 图标 */}
                            <div className={`mt-4 w-12 h-12 rounded-2xl ${step.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                                <Icon className={`w-6 h-6 ${step.iconColor}`} strokeWidth={2} />
                            </div>

                            {/* 标题 */}
                            <h3 className="mt-5 text-base sm:text-lg font-extrabold text-gray-900 dark:text-slate-100 tracking-tight leading-snug">
                                {step.title}
                            </h3>
                            {/* 描述 */}
                            <p className="mt-2 text-sm text-gray-400 dark:text-slate-500 leading-relaxed font-medium">
                                {step.desc}
                            </p>

                            {/* 连接箭头 — 仅桌面端、非最后一个 */}
                            {idx < steps.length - 1 && (
                                <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-slate-700 items-center justify-center shadow-sm">
                                    <ArrowRight className="w-3 h-3 text-gray-300 dark:text-slate-600" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default React.memo(FeatureGrid);
