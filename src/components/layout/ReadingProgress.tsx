'use client';

import React, { useState, useEffect } from 'react';

/**
 * 报告页面阅读进度条
 * 顶部细线显示当前页面滚动进度。
 */

export default function ReadingProgress() {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (docHeight > 0) {
                setProgress(Math.min(100, (scrollTop / docHeight) * 100));
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (progress <= 0) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9998] pointer-events-none">
            <div
                className="h-[2px] bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
}
