'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ==================== 类型 ====================
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number; // 毫秒，默认 4000
}

// ==================== 全局 Toast 状态管理 ====================
type Listener = (toasts: ToastItem[]) => void;
let toasts: ToastItem[] = [];
const listeners: Set<Listener> = new Set();

function notify() {
    listeners.forEach(l => l([...toasts]));
}

/** 添加一条 Toast */
export function showToast(type: ToastType, title: string, message?: string, duration = 4000) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    toasts = [...toasts, { id, type, title, message, duration }];
    notify();
    // 自动移除
    if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
    }
}

/** 移除 Toast */
function removeToast(id: string) {
    toasts = toasts.filter(t => t.id !== id);
    notify();
}

// ==================== 图标和样式映射 ====================
const toastConfig: Record<ToastType, {
    icon: typeof CheckCircle;
    bg: string;
    border: string;
    iconColor: string;
    titleColor: string;
}> = {
    success: { icon: CheckCircle, bg: 'bg-emerald-50', border: 'border-emerald-200', iconColor: 'text-emerald-500', titleColor: 'text-emerald-800' },
    error: { icon: XCircle, bg: 'bg-red-50', border: 'border-red-200', iconColor: 'text-red-500', titleColor: 'text-red-800' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-50', border: 'border-amber-200', iconColor: 'text-amber-500', titleColor: 'text-amber-800' },
    info: { icon: Info, bg: 'bg-blue-50', border: 'border-blue-200', iconColor: 'text-blue-500', titleColor: 'text-blue-800' },
};

// ==================== Toast 容器组件 ====================
export default function ToastContainer() {
    const [items, setItems] = useState<ToastItem[]>([]);

    useEffect(() => {
        listeners.add(setItems);
        return () => { listeners.delete(setItems); };
    }, []);

    return (
        <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
            <AnimatePresence>
                {items.map(toast => {
                    const config = toastConfig[toast.type];
                    const Icon = config.icon;
                    return (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 80, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 80, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className={`pointer-events-auto ${config.bg} ${config.border} border rounded-2xl px-4 py-3 shadow-lg flex items-start gap-3`}
                        >
                            <Icon className={`w-5 h-5 ${config.iconColor} shrink-0 mt-0.5`} />
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold ${config.titleColor}`}>{toast.title}</p>
                                {toast.message && (
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{toast.message}</p>
                                )}
                            </div>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="p-1 rounded-full hover:bg-black/5 transition-colors shrink-0"
                            >
                                <X className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
