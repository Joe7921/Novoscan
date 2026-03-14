'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, Briefcase, UserCircle } from 'lucide-react';

/**
 * 移动端底部导航栏组件。
 * 固定在屏幕底部，提供核心产品的快速导航。
 * 仅在 lg 以下断点显示（移动端 & 平板端）。
 */

interface TabItem {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    labelEn: string;
    color: string;        // 激活态文字颜色
    bgColor: string;      // 激活态背景色
}

const tabs: TabItem[] = [
    {
        href: '/',
        icon: Sparkles,
        label: '扫描',
        labelEn: 'Scan',
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-500/15',
    },
    {
        href: '/bizscan',
        icon: Briefcase,
        label: '商析',
        labelEn: 'Biz',
        color: 'text-orange-500 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-500/15',
    },
    {
        href: '/profile',
        icon: UserCircle,
        label: '我的',
        labelEn: 'Me',
        color: 'text-indigo-500 dark:text-indigo-400',
        bgColor: 'bg-indigo-50 dark:bg-indigo-500/15',
    },
];

export default function BottomTabBar() {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    // 判断当前 Tab 是否激活（首页精确匹配，其他前缀匹配）
    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    // 使用 Portal 渲染到 document.body，避免父元素 CSS filter/transform 破坏 fixed 定位
    if (!mounted) return null;

    return createPortal(
        <nav
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
            {/* 背景 */}
            <div className="bg-white dark:bg-dark-base border-t border-gray-200/60 dark:border-[#1E293B]/60 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-1px_0_0_rgba(96,165,250,0.06)]">
                <div className="flex items-stretch justify-around px-1 h-16">
                    {tabs.map((tab) => {
                        const active = isActive(tab.href);
                        const Icon = tab.icon;

                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                className="relative flex flex-col items-center justify-center flex-1 py-1.5 gap-0.5 transition-colors duration-200 group"
                            >
                                {/* 激活态背景光晕 */}
                                {active && (
                                    <motion.div
                                        layoutId="bottom-tab-active"
                                        className={`absolute inset-x-2 top-1 bottom-1 rounded-xl ${tab.bgColor} opacity-60`}
                                        transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                                    />
                                )}

                                {/* 图标区域 */}
                                <div className="relative z-10">
                                    <motion.div
                                        animate={active ? { scale: 1.15, y: -1 } : { scale: 1, y: 0 }}
                                        transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
                                    >
                                        <Icon
                                            className={`w-5 h-5 transition-colors duration-200 ${active ? tab.color : 'text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300'
                                                }`}
                                        />
                                    </motion.div>
                                </div>

                                {/* 标签文字 */}
                                <span
                                    className={`relative z-10 text-[10px] font-semibold transition-colors duration-200 ${active ? tab.color : 'text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300'
                                        }`}
                                >
                                    {tab.label}
                                </span>

                                {/* 激活态底部小点 */}
                                {active && (
                                    <motion.div
                                        layoutId="bottom-tab-dot"
                                        className={`absolute -bottom-0.5 w-1 h-1 rounded-full ${tab.color.replace('text-', 'bg-').split(' ')[0]}`}
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>,
        document.body
    );
}
