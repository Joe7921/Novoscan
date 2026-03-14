'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, ArrowRight, Shell } from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';

interface OpenClawBridgeModalProps {
    isOpen: boolean;
    keywords: string[];
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * OpenClaw 桥接弹窗 — 当 Bizscan 检测到用户想法涉及 OpenClaw 生态时弹出
 * 提供跨业务线协作入口，让用户选择是否启动 Clawscan 补充评估
 */
export default function OpenClawBridgeModal({
    isOpen,
    keywords,
    onConfirm,
    onCancel,
}: OpenClawBridgeModalProps) {
    if (!isOpen) return null;

    return (
        <ModalPortal>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/20 flex items-center justify-center p-4"
                        style={{ zIndex: 9999 }}
                        onClick={onCancel}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
                            className="bg-white/95 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl shadow-blue-500/10 border border-white/60 ring-1 ring-blue-100/50 relative max-h-[85vh] overflow-y-auto scrollbar-hide flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 关闭按钮 */}
                            <button
                                onClick={onCancel}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* 图标区域 */}
                            <div className="flex items-center justify-center mb-5">
                                <div className="relative">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                        <Shell className="w-8 h-8 text-white" />
                                    </div>
                                    {/* 连接动画 */}
                                    <motion.div
                                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
                                        transition={{ repeat: Infinity, duration: 2 }}
                                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center"
                                    >
                                        <Zap className="w-3 h-3 text-white" />
                                    </motion.div>
                                </div>
                            </div>

                            {/* 标题 */}
                            <h3 className="text-xl font-black text-center text-gray-900 mb-2 tracking-tight">
                                检测到 OpenClaw 项目落地可能
                            </h3>

                            {/* 说明文案 */}
                            <p className="text-sm text-gray-500 text-center mb-5 leading-relaxed">
                                您的商业想法涉及 OpenClaw 生态，我们可以同步启动{' '}
                                <span className="font-bold text-blue-600">Clawscan</span>{' '}
                                深度评估引擎，从 Skill 查重、落地案例、技术可行性等维度提供补充分析。
                            </p>

                            {/* 匹配关键词 */}
                            {keywords.length > 0 && (
                                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 mb-5">
                                    <p className="text-xs font-bold text-blue-600 mb-2">匹配的关键信号：</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {keywords.map((kw, i) => (
                                            <span
                                                key={i}
                                                className="inline-block px-2.5 py-1 bg-blue-100/80 text-blue-700 text-xs font-medium rounded-full"
                                            >
                                                {kw}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 功能说明 */}
                            <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-xl p-4 mb-6 border border-gray-100">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <Zap className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-700 mb-1">Clawscan 将为您补充评估：</p>
                                        <ul className="text-xs text-gray-500 space-y-1">
                                            <li>• ClawHub Registry 现有 Skill 查重检索</li>
                                            <li>• 网络 + GitHub 落地案例深度搜索</li>
                                            <li>• 4-Agent 多维技术可行性评估</li>
                                            <li>• 差异化 & 创新空间战略建议</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* 按钮组 */}
                            <div className="flex gap-3">
                                <button
                                    onClick={onCancel}
                                    className="flex-1 py-3 px-4 border border-gray-200 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                                >
                                    不，继续 Bizscan
                                </button>
                                <button
                                    onClick={onConfirm}
                                    className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                                >
                                    是，启动 Clawscan
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </ModalPortal>
    );
}
