'use client';

import React, { useRef, useState, useEffect, ReactNode } from 'react';

interface LazySectionProps {
    children: ReactNode;
    /** 骨架屏占位（未进入视口时显示） */
    fallback?: ReactNode;
    /** 提前触发距离（px），默认 200 */
    rootMargin?: string;
    /** 外层容器 className */
    className?: string;
}

/**
 * LazySection — 基于 Intersection Observer 的懒渲染包裹器
 * 
 * 子组件仅在即将进入视口时才挂载，避免首屏加载时
 * 同时挂载所有组件并发起不必要的 API 请求。
 */
export default function LazySection({
    children,
    fallback,
    rootMargin = '200px',
    className,
}: LazySectionProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        // 如果浏览器不支持 IntersectionObserver，直接渲染
        if (typeof IntersectionObserver === 'undefined') {
            setIsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect(); // 一旦可见就不再观察
                }
            },
            { rootMargin }
        );

        observer.observe(el);

        return () => observer.disconnect();
    }, [rootMargin]);

    return (
        <div ref={ref} className={className}>
            {isVisible ? children : (fallback || null)}
        </div>
    );
}
