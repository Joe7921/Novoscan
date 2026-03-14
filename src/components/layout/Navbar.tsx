'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Language } from '@/types';
import { translations } from '../../locales/translations';
import { Sparkles, Clock, Briefcase } from 'lucide-react';
import { ProjectIcon } from '../icons/ProjectIcon';
import AuthButton from '@/components/auth/AuthButton';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import ThemeToggle from './ThemeToggle';

interface NavbarProps {
    language?: Language;
    setLanguage?: (lang: Language) => void;
}

const Navbar: React.FC<NavbarProps> = ({ language = 'zh', setLanguage }) => {
    const t = translations[language];
    const [hoveredPath, setHoveredPath] = useState<string | null>(null);
    const pathname = usePathname();
    const { user: authUser } = useAuthSession();

    // 桌面导航项定义（已移除云端专属的 skill-check 和 tracker）
    const searchLinks = [
        { href: '/', icon: Sparkles, label: 'Novoscan', color: 'text-blue-600 dark:text-blue-400', indicator: 'bg-blue-600 dark:bg-blue-400', iconSize: 'w-4 h-4' },
        { href: '/bizscan', icon: Briefcase, label: 'Bizscan', color: 'text-orange-500 dark:text-orange-400', indicator: 'bg-orange-500 dark:bg-orange-400', iconSize: 'w-4 h-4' },
    ];

    const renderNavLink = (link: { href: string; icon: unknown; label: string; color: string; indicator: string; iconSize: string }) => {
        const isActive = pathname === link.href;
        const isHovered = hoveredPath === link.href;

        return (
            <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 xl:px-4 py-2 flex items-center gap-1.5 transition-colors duration-300 z-10 text-sm font-semibold ${isActive || isHovered ? link.color : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}
                onMouseEnter={() => setHoveredPath(link.href)}
                onMouseLeave={() => setHoveredPath(null)}
            >
                {isHovered && (
                    <motion.div
                        layoutId="navbar-hover-bg"
                        className="absolute inset-0 bg-white dark:bg-dark-elevated border border-gray-100 dark:border-slate-600/50 rounded-full -z-10 shadow-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                )}
                {isActive && (
                    <motion.div
                        layoutId="navbar-active-indicator"
                        className={`absolute -bottom-[3px] left-1/2 -translate-x-1/2 w-6 h-[4px] rounded-t-full ${link.indicator}`}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                )}
                <link.icon className={link.iconSize} />
                <span>{link.label}</span>
            </Link>
        );
    };

    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={`sticky top-0 z-50 w-full transition-all duration-500 ${isScrolled
            ? 'bg-white dark:bg-dark-base border-b border-gray-200/50 dark:border-[#1E293B]/50 shadow-sm dark:shadow-[0_1px_0_0_rgba(96,165,250,0.06)]'
            : 'bg-white dark:bg-dark-base border-b border-gray-200/30 dark:border-[#1E293B]/30'
        }`}>
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 h-14 sm:h-16 lg:h-[72px] flex items-center justify-between">

                {/* ===== Logo 区域 ===== */}
                <Link href="/" className="flex items-center gap-2 sm:gap-3 cursor-pointer group hover:no-underline z-50 relative flex-shrink-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gray-50 dark:bg-dark-surface rounded-full flex items-center justify-center border border-gray-200 dark:border-[#1E293B] group-hover:border-blue-400 dark:group-hover:border-blue-500/50 group-hover:shadow-[0_0_20px_rgba(66,133,244,0.15)] dark:group-hover:shadow-[0_0_20px_rgba(96,165,250,0.2)] transition-all duration-300">
                        <ProjectIcon className="text-blue-500 dark:text-blue-400 w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 group-hover:scale-110 transition-transform duration-300" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight leading-none">
                            <span className="gradient-text-brand">Novo</span>
                            <span className="text-gray-900 dark:text-slate-100">scan</span>
                        </span>
                        <span className="text-[8px] sm:text-[9px] lg:text-[10px] text-gray-400 dark:text-slate-500 font-medium tracking-wider leading-none mt-0.5 hidden sm:block">下一代创新评估垂直代理</span>
                    </div>
                </Link>

                {/* ===== 移动端右侧：语言切换 + 登录 ===== */}
                <div className="lg:hidden flex items-center gap-2">
                    {/* 语言切换（紧凑型） */}
                    <div className="flex bg-gray-100 dark:bg-dark-surface p-0.5 rounded-full border border-gray-200 dark:border-[#1E293B]">
                        <button
                            onClick={() => setLanguage?.('en')}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-300 ${language === 'en' ? 'bg-white dark:bg-dark-elevated text-gray-900 dark:text-slate-100 shadow-sm border border-gray-200 dark:border-[#334155]' : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
                            aria-label="Switch to English"
                        >
                            EN
                        </button>
                        <button
                            onClick={() => setLanguage?.('zh')}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-300 ${language === 'zh' ? 'bg-white dark:bg-dark-elevated text-gray-900 dark:text-slate-100 shadow-sm border border-gray-200 dark:border-[#334155]' : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
                            aria-label="切换为中文"
                        >
                            中文
                        </button>
                    </div>
                    <AuthButton />
                </div>

                {/* ===== 桌面端导航 ===== */}
                <div className="hidden lg:flex items-center gap-1 xl:gap-2 flex-1 min-w-0 justify-end">

                    {/* 产品导航组（胶囊容器） */}
                    <div className="flex items-center bg-gray-50/80 dark:bg-dark-surface/80 p-1 rounded-2xl border border-gray-200/80 dark:border-[#1E293B]/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] transition-all duration-300">
                        {searchLinks.map(renderNavLink)}
                    </div>

                    {/* 分隔线 */}
                    <div className="w-px h-6 bg-gray-200 dark:bg-[#1E293B] mx-1 xl:mx-2" />

                    {/* 工具导航 */}
                    <div className="flex items-center gap-0.5 xl:gap-1 text-sm font-semibold text-gray-500 dark:text-slate-400">
                        <Link
                            href="/history"
                            className={`px-3 py-2 flex items-center gap-1.5 rounded-full transition-all duration-300 hover:bg-gray-50 dark:hover:bg-dark-elevated ${pathname === '/history' ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10' : 'hover:text-gray-700 dark:hover:text-slate-200'}`}
                        >
                            <Clock className="w-4 h-4" />
                            <span className="hidden xl:inline">{language === 'en' ? 'History' : '历史'}</span>
                        </Link>
                        <Link
                            href="/docs"
                            className={`px-3 py-2 rounded-full transition-all duration-300 hover:bg-gray-50 dark:hover:bg-dark-elevated ${pathname === '/docs' ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10' : 'hover:text-gray-700 dark:hover:text-slate-200'}`}
                        >
                            {t.howItWorks}
                        </Link>
                    </div>

                    {/* 分隔线 */}
                    <div className="w-px h-6 bg-gray-200 dark:bg-[#1E293B] mx-1 xl:mx-2" />

                    {/* 用户区域 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* 语言切换 */}
                        <div className="flex bg-gray-100 dark:bg-dark-surface p-0.5 rounded-full border border-gray-200 dark:border-[#1E293B]">
                            <button
                                onClick={() => setLanguage?.('en')}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${language === 'en' ? 'bg-white dark:bg-dark-elevated text-gray-900 dark:text-slate-100 shadow-sm border border-gray-200 dark:border-[#334155]' : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
                                aria-label="Switch to English"
                            >
                                EN
                            </button>
                            <button
                                onClick={() => setLanguage?.('zh')}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${language === 'zh' ? 'bg-white dark:bg-dark-elevated text-gray-900 dark:text-slate-100 shadow-sm border border-gray-200 dark:border-[#334155]' : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
                                aria-label="切换为中文"
                            >
                                中文
                            </button>
                        </div>

                        {/* 明暗模式切换 */}
                        <ThemeToggle />

                        {/* 登录/用户按钮 */}
                        <AuthButton />
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
