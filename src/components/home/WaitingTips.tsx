'use client';

import React, { useState, useEffect } from 'react';

/**
 * 分析等待时的知识卡片轮播
 * 在 ThinkingIndicator 中使用，填充用户等待空白。
 */

const TIPS_ZH = [
    { emoji: '💡', text: 'Novoscan 使用 5 个独立 AI Agent 从不同角度分析你的创意' },
    { emoji: '⚔️', text: '当 Agent 之间出现分歧，会自动启动 NovoDebate 辩论来消除盲区' },
    { emoji: '🧬', text: 'NovoDNA 能将你的创新映射到五维向量空间，找到蓝海机会' },
    { emoji: '📊', text: '每份报告包含六维雷达图，量化你的创新在 6 个维度的表现' },
    { emoji: '⚡', text: 'Flash 极速模式只需 30 秒，适合快速验证灵感火花' },
    { emoji: '🔍', text: '系统会自动检索全球学术数据库和专利库进行交叉验证' },
    { emoji: '🎯', text: '试试 Clawscan 查重功能，检测你的创意与现有技术的重叠度' },
    { emoji: '📈', text: '使用 NovoTracker 追踪你关注领域的最新动态和竞品变化' },
];

const TIPS_EN = [
    { emoji: '💡', text: 'Novoscan uses 5 independent AI Agents to analyze your idea from different angles' },
    { emoji: '⚔️', text: 'When Agents disagree, NovoDebate auto-triggers adversarial debate to eliminate blind spots' },
    { emoji: '🧬', text: 'NovoDNA maps your innovation into a 5D vector space to find blue ocean opportunities' },
    { emoji: '📊', text: 'Each report includes a 6-axis radar chart quantifying your innovation across 6 dimensions' },
    { emoji: '⚡', text: 'Flash mode delivers results in just 30 seconds — perfect for quick idea validation' },
    { emoji: '🔍', text: 'The system cross-references global academic databases and patent libraries automatically' },
    { emoji: '🎯', text: 'Try Clawscan to check how much your idea overlaps with existing technologies' },
    { emoji: '📈', text: 'Use NovoTracker to monitor latest developments and competitor changes in your field' },
];

interface WaitingTipsProps {
    language?: 'zh' | 'en';
}

export default function WaitingTips({ language = 'zh' }: WaitingTipsProps) {
    const [currentIdx, setCurrentIdx] = useState(0);
    const tips = language === 'zh' ? TIPS_ZH : TIPS_EN;

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIdx(prev => (prev + 1) % tips.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [tips.length]);

    const currentTip = tips[currentIdx];

    return (
        <div className="mt-6 max-w-md mx-auto">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">
                {language === 'zh' ? '💭 你知道吗' : '💭 Did you know'}
            </div>
            <div
                key={currentIdx}
                className="text-center px-4 py-3 rounded-2xl bg-white/95 border border-white/60 animate-fade-in"
            >
                <span className="text-sm text-gray-600 font-medium">
                    {currentTip.emoji} {currentTip.text}
                </span>
            </div>
            {/* 进度指示点 */}
            <div className="flex items-center justify-center gap-1 mt-3">
                {tips.map((_, i) => (
                    <div
                        key={i}
                        className={`w-1 h-1 rounded-full transition-all duration-300 ${i === currentIdx ? 'w-4 bg-blue-400' : 'bg-gray-300'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
