'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

/**
 * NProgress 风格的顶部路由进度条
 * 监听路由变化，显示从左到右的蓝色进度细线。
 */

export default function RouteProgress() {
    const pathname = usePathname();
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    // 路由变化时模拟进度
    useEffect(() => {
        setLoading(true);
        setProgress(30);

        const timer1 = setTimeout(() => setProgress(60), 100);
        const timer2 = setTimeout(() => setProgress(80), 300);
        const timer3 = setTimeout(() => {
            setProgress(100);
            setTimeout(() => {
                setLoading(false);
                setProgress(0);
            }, 200);
        }, 500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [pathname]);

    if (!loading && progress === 0) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
            <div
                className="h-[2px] bg-gradient-to-r from-google-blue via-blue-400 to-cyan-400 rounded-full transition-all duration-300 ease-out"
                style={{
                    width: `${progress}%`,
                    opacity: loading ? 1 : 0,
                }}
            />
        </div>
    );
}
