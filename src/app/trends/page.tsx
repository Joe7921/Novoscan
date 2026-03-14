'use client';

/**
 * /trends — 创新趋势洞察独立公开页面
 *
 * SEO 友好的创新趋势内容页面，
 * 复用 TrendingInnovations 组件。
 */

import React, { useState } from 'react';
import Navbar from '@/components/layout/Navbar';
import BottomTabBar from '@/components/layout/BottomTabBar';
import TrendingInnovations from '@/components/discovery/TrendingInnovations';
import { Language } from '@/types';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowRight, Sparkles } from 'lucide-react';


export default function TrendsPage() {
    const [language, setLanguage] = useState<'zh' | 'en'>('zh');
    const isZh = language === 'zh';

    const handleKeywordClick = (keyword: string) => {
        // 跳转到首页并填入关键词
        window.location.href = `/?q=${encodeURIComponent(keyword)}`;
    };

    return (
        <div className="min-h-screen relative flex flex-col text-gray-900 bg-transparent overflow-x-hidden max-w-[100vw] pb-20 lg:pb-0">
            {/* 背景 — 静态渐变替代 blur+float 动画，零 GPU 开销 */}
            <div
                className="absolute inset-0 pointer-events-none -z-10"
                style={{
                    background: `
                        radial-gradient(ellipse 60% 50% at 10% 10%, rgba(52,211,153,0.08) 0%, transparent 70%),
                        radial-gradient(ellipse 50% 50% at 90% 40%, rgba(139,92,246,0.08) 0%, transparent 70%)
                    `,
                }}
            />

            <Navbar language={language} setLanguage={(lang: Language) => setLanguage(lang)} />

            <main className="flex-grow flex flex-col items-center justify-start p-4 sm:p-6 relative z-10 w-full">
                {/* Hero */}
                <div className="text-center max-w-2xl mx-auto pt-10 sm:pt-16 pb-8 sm:pb-12">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-emerald-500 bg-emerald-50 px-4 py-1.5 rounded-full mb-4">
                        <Sparkles className="w-3.5 h-3.5" />
                        {isZh ? '每日更新' : 'Updated Daily'}
                    </span>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">
                        {isZh ? '全球创新趋势洞察' : 'Global Innovation Trends'}
                    </h1>
                    <p className="text-gray-500 text-sm sm:text-base max-w-lg mx-auto">
                        {isZh
                            ? 'AI 实时追踪多个学科领域的最具创新价值的研究方向，发现隐藏的创新宝石'
                            : 'AI-powered real-time tracking of the most innovative research directions across multiple fields'}
                    </p>
                </div>

                {/* 趋势内容 */}
                <div className="w-full max-w-[1440px] xl:px-10">
                    <TrendingInnovations
                        language={language}
                        onKeywordClick={handleKeywordClick}
                    />
                </div>

                {/* AdSense 广告位 — 趋势内容与 CTA 之间 */}
                {process.env.NEXT_PUBLIC_ADSENSE_TRENDS_SLOT && (
                    <div className="w-full max-w-[1440px] xl:px-10 mt-8">
                        <p className="text-[10px] text-gray-300 uppercase tracking-widest font-bold mb-2 text-center">推广</p>                    </div>
                )}

                {/* CTA */}
                <div className="text-center py-12 sm:py-16">
                    <h3 className="text-lg font-bold text-gray-800 mb-3">
                        {isZh ? '发现感兴趣的方向？' : 'Found an interesting direction?'}
                    </h3>
                    <p className="text-sm text-gray-400 mb-5 max-w-md mx-auto">
                        {isZh
                            ? '用 Novoscan AI 深度分析你的创新想法，数十秒获取专业报告'
                            : 'Use Novoscan AI to deeply analyze your ideas in seconds'}
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 text-white font-bold hover:shadow-xl hover:shadow-blue-500/25 transition-all hover:scale-105"
                    >
                        {isZh ? '免费开始分析' : 'Start Free Analysis'}
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </main>
            <BottomTabBar />
        </div>
    );
}
