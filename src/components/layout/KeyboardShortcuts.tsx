'use client';

import React, { useEffect } from 'react';

/**
 * 全局键盘快捷键监听组件
 * - Ctrl/Cmd + K：聚焦搜索框
 * - Escape：关闭弹窗/取消
 * - Ctrl/Cmd + Enter：提交分析（由 InnovationAutocomplete 内部处理）
 */

interface KeyboardShortcutsProps {
    onFocusSearch?: () => void;
    onEscape?: () => void;
    onSubmit?: () => void;
}

export default function KeyboardShortcuts({ onFocusSearch, onEscape, onSubmit }: KeyboardShortcutsProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMeta = e.metaKey || e.ctrlKey;

            // Ctrl/Cmd + K → 聚焦搜索
            if (isMeta && e.key === 'k') {
                e.preventDefault();
                onFocusSearch?.();
            }

            // Escape → 关闭弹窗
            if (e.key === 'Escape') {
                onEscape?.();
            }

            // Ctrl/Cmd + Enter → 提交
            if (isMeta && e.key === 'Enter') {
                e.preventDefault();
                onSubmit?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onFocusSearch, onEscape, onSubmit]);

    return null; // 纯逻辑组件，无 UI
}
