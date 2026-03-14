'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import { LogIn, LogOut, ChevronDown, Github, UserCircle, Wallet, Bell, Mail, Loader2, CheckCircle } from 'lucide-react';
import Link from 'next/link';

/**
 * 检测当前浏览器是否为 WebView（微信/QQ/微博等内置浏览器）。
 */
function isWebView(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return /micromessenger|weixin|qq\/|mqqbrowser|weibo|douyin|tiktok|alipay|dingtalk|line\/|instagram|fbav|fban/.test(ua);
}

/**
 * 认证按钮组件。
 * 检测当前用户登录状态：
 *   - 未登录时：显示统一"登录"按钮，点击展开下拉菜单选择 Google / GitHub / 邮箱
 *   - 已登录时：显示头像、名称和下拉登出菜单
 *
 * 通过 useAuthSession() hook 自动适配 NextAuth / Supabase 认证模式。
 */
export default function AuthButton({ unreadCount = 0 }: { unreadCount?: number }) {
    const { user, loading, oauthSignIn, magicLinkSignIn, handleSignOut } = useAuthSession();
    const [menuOpen, setMenuOpen] = useState(false);
    const [points, setPoints] = useState<number | null>(null);
    const inWebView = useMemo(() => isWebView(), []);

    // 邮箱登录状态
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [email, setEmail] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [cooldown, setCooldown] = useState(0);

    // 获取点数余额
    useEffect(() => {
        if (!user) return;
        fetch('/api/wallet')
            .then(r => r.json())
            .then(d => { if (d.success) setPoints(d.points); })
            .catch(() => { });
    }, [user]);

    // 发送倒计时
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    // OAuth 登录（通用）
    const handleOAuthLogin = async (provider: 'google' | 'github') => {
        setMenuOpen(false);
        await oauthSignIn(provider);
    };

    // 邮箱 Magic Link 登录
    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || cooldown > 0) return;

        setEmailSending(true);
        setEmailError('');

        const result = await magicLinkSignIn(email.trim());

        setEmailSending(false);

        if (result.error) {
            console.error('邮箱登录失败:', result.error);
            setEmailError('发送失败，请稍后重试');
        } else {
            setEmailSent(true);
            setCooldown(60);
        }
    };

    // 重置邮箱状态
    const resetEmailState = () => {
        setShowEmailInput(false);
        setEmail('');
        setEmailSent(false);
        setEmailError('');
        setEmailSending(false);
    };

    // 登出
    const handleLogout = async () => {
        setMenuOpen(false);
        await handleSignOut();
    };

    // 关闭菜单时重置邮箱状态
    const closeMenu = () => {
        setMenuOpen(false);
        resetEmailState();
    };

    if (loading) {
        return (
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
        );
    }

    // ====== 未登录状态 ======
    if (!user) {
        return (
            <div className="relative">
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center gap-2 text-white px-5 py-2.5 rounded-full bg-gray-900 hover:bg-gray-700 hover:shadow-lg transition-all duration-300 font-bold text-sm"
                >
                    <LogIn className="w-4 h-4" />
                    <span>登录</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
                </button>

                {menuOpen && (
                    <>
                        {/* 遮罩层 */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={closeMenu}
                        />
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            {emailSent ? (
                                // 发送成功提示
                                <div className="px-4 py-4 text-center">
                                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-emerald-800 mb-1">登录链接已发送 ✉️</p>
                                    <p className="text-[11px] text-emerald-600 mb-1">
                                        请检查 {email} 的收件箱
                                    </p>
                                    {cooldown > 0 && (
                                        <p className="text-[10px] text-gray-400 mb-2">{cooldown} 秒后可重新发送</p>
                                    )}
                                    <button
                                        onClick={resetEmailState}
                                        className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold"
                                    >
                                        使用其他邮箱
                                    </button>
                                </div>
                            ) : showEmailInput ? (
                                // 邮箱输入表单
                                <form onSubmit={handleEmailLogin} className="px-3 py-3 space-y-2">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                                        placeholder="输入邮箱地址"
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all"
                                        required
                                        autoFocus
                                        disabled={emailSending}
                                    />
                                    {emailError && (
                                        <p className="text-[11px] text-red-500">{emailError}</p>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={emailSending || !email.trim() || cooldown > 0}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                                    >
                                        {emailSending ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" />发送中...</>
                                        ) : cooldown > 0 ? (
                                            <>{cooldown} 秒后可重新发送</>
                                        ) : (
                                            <><Mail className="w-4 h-4" />发送登录链接</>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetEmailState}
                                        className="w-full text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
                                    >
                                        返回
                                    </button>
                                </form>
                            ) : (
                                // 登录方式选择
                                <>
                                    <button
                                        onClick={() => setShowEmailInput(true)}
                                        className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-3 transition-colors"
                                    >
                                        <Mail className="w-4 h-4 text-blue-500" />
                                        <span className="font-semibold">邮箱登录</span>
                                        <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">推荐</span>
                                    </button>
                                    {/* OAuth 登录 - WebView 环境下隐藏 */}
                                    {!inWebView && (
                                        <>
                                            <div className="mx-3 h-px bg-gray-100" />
                                            <button
                                                onClick={() => handleOAuthLogin('google')}
                                                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-3 transition-colors"
                                            >
                                                <LogIn className="w-4 h-4 text-google-blue" />
                                                <span className="font-semibold">Google 登录</span>
                                            </button>
                                            <div className="mx-3 h-px bg-gray-100" />
                                            <button
                                                onClick={() => handleOAuthLogin('github')}
                                                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3 transition-colors"
                                            >
                                                <Github className="w-4 h-4 text-[#24292e]" />
                                                <span className="font-semibold">GitHub 登录</span>
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // ====== 已登录状态 ======
    const avatarUrl = user.image;
    const displayName = user.name || user.email?.split('@')[0] || '用户';

    return (
        <div className="relative">
            <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-all duration-300"
            >
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={displayName}
                        className="w-7 h-7 rounded-full object-cover border border-gray-300"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-7 h-7 rounded-full bg-google-blue text-white flex items-center justify-center text-xs font-bold">
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                )}
                <span className="text-sm font-semibold text-gray-700 max-w-[100px] truncate hidden sm:block">
                    {displayName}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* 下拉菜单 */}
            {menuOpen && (
                <>
                    {/* 遮罩层 */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* 用户信息 */}
                        <div className="px-4 py-3 border-b border-gray-100">
                            <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
                            <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                {points !== null && (
                                    <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                        <Wallet className="w-3 h-3" />
                                        {points}
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* 通知中心 */}
                        <Link
                            href="/tracker"
                            onClick={() => setMenuOpen(false)}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2 transition-colors"
                        >
                            <div className="relative">
                                <Bell className="w-4 h-4 text-teal-500" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] flex items-center justify-center bg-red-500 text-white text-[8px] font-black rounded-full px-0.5">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </div>
                            通知中心
                        </Link>
                        <div className="mx-3 h-px bg-gray-100" />
                        {/* 个人中心 */}
                        <Link
                            href="/profile"
                            onClick={() => setMenuOpen(false)}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2 transition-colors"
                        >
                            <UserCircle className="w-4 h-4 text-blue-500" />
                            个人中心
                        </Link>
                        <div className="mx-3 h-px bg-gray-100" />
                        {/* 登出 */}
                        <button
                            onClick={handleLogout}
                            className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            退出登录
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
