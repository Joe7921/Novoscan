'use client';

import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * 明暗模式切换按钮
 * 旗舰级暗色主题切换器，带平滑过渡动画。
 * 使用 class 策略（在 <html> 上添加/移除 'dark'）。
 */

const STORAGE_KEY = 'novoscan_theme';

export default function ThemeToggle() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // 从 localStorage 读取用户偏好
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'dark') {
            setIsDark(true);
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggle = () => {
        const next = !isDark;
        setIsDark(next);
        if (next) {
            document.documentElement.classList.add('dark');
            localStorage.setItem(STORAGE_KEY, 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem(STORAGE_KEY, 'light');
        }
    };

    return (
        <button
            onClick={toggle}
            className={`relative p-2 rounded-full transition-all duration-300 ${
                isDark
                    ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 hover:shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            aria-label={isDark ? '切换到亮色模式' : '切换到暗色模式'}
            title={isDark ? '亮色模式' : '暗色模式'}
        >
            {isDark ? (
                <Sun className="w-4 h-4" />
            ) : (
                <Moon className="w-4 h-4" />
            )}
        </button>
    );
}
