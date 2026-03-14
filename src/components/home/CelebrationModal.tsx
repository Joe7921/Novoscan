'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PartyPopper, Star, Sparkles } from 'lucide-react';

/**
 * 首次分析完成庆祝弹窗
 * 仅在用户第一次完成分析时弹出，配合 CSS 粒子动效增强成就感。
 */

const STORAGE_KEY = 'novoscan_first_report_seen';

interface CelebrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    score?: number;
    language?: 'zh' | 'en';
}

// CSS 彩纸粒子生成
function Confetti() {
    const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#8B5CF6', '#EC4899', '#06B6D4'];
    const particles = Array.from({ length: 40 }, (_, i) => ({
        id: i,
        color: colors[i % colors.length],
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.8}s`,
        duration: `${1.5 + Math.random() * 1.5}s`,
        size: 4 + Math.random() * 6,
        rotation: Math.random() * 360,
    }));

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {particles.map(p => (
                <div
                    key={p.id}
                    className="absolute animate-confetti-fall"
                    style={{
                        left: p.left,
                        top: '-10px',
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        backgroundColor: p.color,
                        borderRadius: p.id % 3 === 0 ? '50%' : '2px',
                        transform: `rotate(${p.rotation}deg)`,
                        animationDelay: p.delay,
                        animationDuration: p.duration,
                        opacity: 0.8,
                    }}
                />
            ))}
            <style jsx>{`
                @keyframes confetti-fall {
                    0% {
                        transform: translateY(0) rotate(0deg) scale(1);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(400px) rotate(720deg) scale(0.3);
                        opacity: 0;
                    }
                }
                .animate-confetti-fall {
                    animation: confetti-fall ease-out forwards;
                }
            `}</style>
        </div>
    );
}

export default function CelebrationModal({ isOpen, onClose, score, language = 'zh' }: CelebrationModalProps) {
    const isZh = language === 'zh';

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[150] flex items-center justify-center"
            >
                {/* 背景遮罩 */}
                <div className="absolute inset-0 bg-black/30" onClick={onClose} />

                {/* 弹窗 */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="relative z-10 bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-sm w-[90%] mx-4 overflow-hidden"
                >
                    {/* 彩纸 */}
                    <Confetti />

                    {/* 关闭按钮 */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-20"
                        aria-label="关闭"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="relative z-10 p-8 text-center">
                        {/* 图标动画 */}
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
                            className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 flex items-center justify-center shadow-xl shadow-orange-500/25"
                        >
                            <PartyPopper className="w-10 h-10 text-white" />
                        </motion.div>

                        {/* 标题 */}
                        <motion.h2
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="text-2xl font-black text-gray-900 mb-2"
                        >
                            {isZh ? '🎉 恭喜！你的第一份报告' : '🎉 Your First Report!'}
                        </motion.h2>

                        {/* 评分 */}
                        {typeof score === 'number' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5, type: 'spring' }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 mb-4"
                            >
                                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                                <span className="text-lg font-black text-blue-700">{score}</span>
                                <span className="text-xs text-blue-500 font-bold">{isZh ? '创新评分' : 'Innovation Score'}</span>
                            </motion.div>
                        )}

                        {/* 描述 */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-sm text-gray-500 leading-relaxed mb-6"
                        >
                            {isZh
                                ? '你已成功完成首次 AI 创新分析！滚动报告查看详细评分、雷达图和行动建议。'
                                : 'You\'ve completed your first AI innovation analysis! Scroll the report for detailed scores and action insights.'}
                        </motion.p>

                        {/* 提示标签 */}
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            {isZh ? '分享报告可获得积分奖励' : 'Share report to earn credits'}
                        </motion.div>

                        {/* CTA 按钮 */}
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                            onClick={onClose}
                            className="mt-6 w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all duration-300"
                        >
                            {isZh ? '查看我的报告 →' : 'View My Report →'}
                        </motion.button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
