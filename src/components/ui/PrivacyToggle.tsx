'use client';

import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PrivacyToggleProps {
    isPrivate: boolean;
    onToggle: () => void;
    /** 紧凑模式（默认），适用于搜索框底部工具栏 */
    compact?: boolean;
}

/**
 * 隐私检索模式开关
 *
 * 类似 Gemini 的隐私对话功能。
 * 开启后该次查询不上传用户信息，不记录搜索事件，不保存本地历史。
 */
const PrivacyToggle: React.FC<PrivacyToggleProps> = ({
    isPrivate,
    onToggle,
    compact = true,
}) => {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={`
                group relative inline-flex items-center gap-1.5 rounded-full
                transition-all duration-300 cursor-pointer select-none
                ${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}
                ${isPrivate
                    ? 'bg-violet-500/15 border border-violet-400/30 text-violet-600 hover:bg-violet-500/25 shadow-sm shadow-violet-200/50'
                    : 'bg-gray-50 border border-gray-200/60 text-gray-400 hover:text-gray-600 hover:bg-gray-100 hover:border-gray-300/60'
                }
            `}
            title={isPrivate ? '隐私检索已开启：本次查询不会记录任何用户信息' : '点击开启隐私检索模式'}
            aria-label={isPrivate ? '关闭隐私检索' : '开启隐私检索'}
        >
            {/* 图标动画 */}
            <AnimatePresence mode="wait" initial={false}>
                {isPrivate ? (
                    <motion.span
                        key="locked"
                        initial={{ scale: 0.5, opacity: 0, rotate: -30 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.5, opacity: 0, rotate: 30 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Lock className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                    </motion.span>
                ) : (
                    <motion.span
                        key="unlocked"
                        initial={{ scale: 0.5, opacity: 0, rotate: 30 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.5, opacity: 0, rotate: -30 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Unlock className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                    </motion.span>
                )}
            </AnimatePresence>

            {/* 文字 */}
            <span className="font-bold tracking-wide whitespace-nowrap">
                {isPrivate ? '隐私检索' : '隐私检索'}
            </span>

            {/* 开启时的小圆点指示器 */}
            {isPrivate && (
                <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-1.5 h-1.5 rounded-full bg-violet-500"
                />
            )}
        </button>
    );
};

export default PrivacyToggle;
