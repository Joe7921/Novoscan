'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, Briefcase, Radar, UserCircle, Wallet } from 'lucide-react';
import { LobsterIcon } from '../icons/LobsterIcon';
import { createClient } from '@/utils/supabase/client';

/**
 * 移动端底部导航栏组件。
 * 固定在屏幕底部，提供 5 个核心产品的快速导航。
 * 仅在 lg 以下断点显示（移动端 & 平板端）。
 */

interface TabItem {
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    labelEn: string;
    color: string;        // 激活态文字颜色
    bgColor: string;      // 激活态背景色
    showBadge?: boolean;   // 是否显示未读角标
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
        href: '/skill-check',
        icon: LobsterIcon,
        label: '查重',
        labelEn: 'Claw',
        color: 'text-amber-500 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-500/15',
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
        href: '/tracker',
        icon: Radar,
        label: '追踪',
        labelEn: 'Track',
        color: 'text-teal-500 dark:text-teal-400',
        bgColor: 'bg-teal-50 dark:bg-teal-500/15',
        showBadge: true,
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

    // 未读预警角标
    const [unreadCount, setUnreadCount] = useState(0);
    const fetchUnread = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const res = await fetch('/api/tracker');
            const json = await res.json();
            if (json.success && typeof json.unreadAlertCount === 'number') {
                setUnreadCount(json.unreadAlertCount);
            }
        } catch { /* 静默 */ }
    }, []);

    useEffect(() => {
        setMounted(true);
        // 性能优化：延迟 2 秒再请求未读数，避免与首屏关键请求竞争带宽
        const initialDelay = setTimeout(fetchUnread, 2000);
        const timer = setInterval(fetchUnread, 60000);
        return () => {
            clearTimeout(initialDelay);
            clearInterval(timer);
        };
    }, [fetchUnread]);

    // 积分余额（"我的" Tab 角标）
    const [walletPoints, setWalletPoints] = useState<number | null>(null);
    const fetchWallet = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const res = await fetch('/api/wallet');
            const json = await res.json();
            if (json.success && typeof json.points === 'number') {
                setWalletPoints(json.points);
            }
        } catch { /* 静默 */ }
    }, []);

    useEffect(() => {
        const timer = setTimeout(fetchWallet, 3000); // 延迟加载
        return () => clearTimeout(timer);
    }, [fetchWallet]);

    // 判断当前 Tab 是否激活（首页精确匹配，其他前缀匹配）
    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

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

                                    {/* 未读角标（仅 Tracker Tab） */}
                                    {tab.showBadge && unreadCount > 0 && (
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute -top-1.5 -right-2.5 min-w-[16px] h-[16px] flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full px-1 shadow-sm"
                                        >
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </motion.span>
                                    )}

                                    {/* "我的" Tab 积分角标 */}
                                    {tab.href === '/profile' && walletPoints !== null && walletPoints > 0 && (
                                        <span className="absolute -top-1 -right-3 flex items-center gap-0.5 px-1 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[8px] font-bold rounded-full border border-amber-200 dark:border-amber-500/30">
                                            <Wallet className="w-2 h-2" />
                                            {walletPoints > 999 ? '999+' : walletPoints}
                                        </span>
                                    )}
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
