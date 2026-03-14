import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, LogIn, Github, Mail, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import ModalPortal from '@/components/ui/ModalPortal';

/**
 * 检测当前浏览器是否为 WebView（微信/QQ/微博等内置浏览器）。
 * 在 WebView 中 Google OAuth 会被拦截（disallowed_useragent），因此需要隐藏 OAuth 按钮。
 */
function isWebView(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return /micromessenger|weixin|qq\/|mqqbrowser|weibo|douyin|tiktok|alipay|dingtalk|line\/|instagram|fbav|fban/.test(ua);
}

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    language?: 'zh' | 'en';
}

export default function LoginModal({ isOpen, onClose, language = 'zh' }: LoginModalProps) {
    const isZh = language === 'zh';
    const supabase = createClient();
    const inWebView = useMemo(() => isWebView(), []);

    // 邮箱登录状态
    const [email, setEmail] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [emailError, setEmailError] = useState('');
    // 发送倒计时（防止重复点击）
    const [cooldown, setCooldown] = useState(0);

    // 倒计时定时器
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    // 邮箱 Magic Link 登录
    const handleEmailLogin = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || cooldown > 0) return;

        setEmailSending(true);
        setEmailError('');

        const { error } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        setEmailSending(false);

        if (error) {
            console.error('邮箱登录失败:', error.message);
            setEmailError(isZh ? '发送失败，请稍后重试' : 'Failed to send. Please try again.');
        } else {
            setEmailSent(true);
            setCooldown(60); // 60 秒冷却
        }
    }, [email, cooldown, isZh, supabase]);

    // 重置邮箱表单状态
    const resetEmailState = useCallback(() => {
        setEmail('');
        setEmailSent(false);
        setEmailError('');
        setEmailSending(false);
    }, []);

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) {
            console.error('Google 登录失败:', error.message);
        }
    };

    const handleGitHubLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'github',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) {
            console.error('GitHub 登录失败:', error.message);
        }
    };

    // 关闭弹窗时重置状态
    const handleClose = () => {
        resetEmailState();
        onClose();
    };

    return (
        <ModalPortal>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[9999]"
                        onClick={handleClose}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
                            className="bg-white/95 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-white/60 ring-1 ring-slate-100/50 relative max-h-[85vh] overflow-y-auto scrollbar-hide flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                onClick={handleClose}
                                className="absolute right-4 top-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
                                    <LogIn className="w-7 h-7" />
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 mb-2">
                                    {isZh ? '解锁更多分析能力 🚀' : 'Unlock More Analysis Power 🚀'}
                                </h3>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    {isZh
                                        ? '免费体验次数已用完，注册即可继续使用所有功能'
                                        : 'Free trials used up. Sign up to continue using all features.'}
                                </p>
                            </div>

                            {/* 注册福利 */}
                            <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-2xl p-4 mb-5 border border-blue-100/50">
                                <p className="text-xs font-bold text-blue-600 mb-2.5">
                                    {isZh ? '✨ 注册即享' : '✨ Sign up benefits'}
                                </p>
                                <div className="space-y-1.5">
                                    {[
                                        isZh ? '🎁 获得 100 NovoCredits（约 10 次深度分析）' : '🎁 100 NovoCredits (≈10 deep analyses)',
                                        isZh ? '⚡ 无限次 Flash 极速分析' : '⚡ Unlimited Flash analyses',
                                        isZh ? '📤 分享报告到社交平台' : '📤 Share reports to social media',
                                        isZh ? '👥 邀请好友双方各获 50 NovoCredits' : '👥 Invite friends: both get 50 NovoCredits',
                                    ].map((item, i) => (
                                        <p key={i} className="text-xs text-gray-600">{item}</p>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* ====== 邮箱 Magic Link 登录 ====== */}
                                {emailSent ? (
                                    // 发送成功提示
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center"
                                    >
                                        <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                                        <p className="text-sm font-bold text-emerald-800 mb-1">
                                            {isZh ? '登录链接已发送 ✉️' : 'Login link sent ✉️'}
                                        </p>
                                        <p className="text-xs text-emerald-600 mb-3">
                                            {isZh
                                                ? `请检查 ${email} 的收件箱，点击邮件中的链接即可登录`
                                                : `Check your inbox at ${email} and click the link to log in`}
                                        </p>
                                        {cooldown > 0 && (
                                            <p className="text-[11px] text-gray-400 mb-2">
                                                {isZh ? `${cooldown} 秒后可重新发送` : `Resend in ${cooldown}s`}
                                            </p>
                                        )}
                                        <button
                                            onClick={resetEmailState}
                                            className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-semibold transition-colors"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" />
                                            {isZh ? '使用其他邮箱' : 'Use a different email'}
                                        </button>
                                    </motion.div>
                                ) : (
                                    // 邮箱输入表单
                                    <form onSubmit={handleEmailLogin} className="space-y-2.5">
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => { setEmail(e.target.value); setEmailError(''); }}
                                                placeholder={isZh ? '输入邮箱地址' : 'Enter your email'}
                                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all"
                                                required
                                                disabled={emailSending}
                                            />
                                        </div>
                                        {emailError && (
                                            <p className="text-xs text-red-500 pl-1">{emailError}</p>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={emailSending || !email.trim() || cooldown > 0}
                                            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-xl font-bold transition-all duration-300 shadow-sm hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {emailSending ? (
                                                <>
                                                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                                    {isZh ? '发送中...' : 'Sending...'}
                                                </>
                                            ) : cooldown > 0 ? (
                                                <>{isZh ? `${cooldown} 秒后可重新发送` : `Resend in ${cooldown}s`}</>
                                            ) : (
                                                <>
                                                    <Mail className="w-4.5 h-4.5" />
                                                    {isZh ? '发送登录链接' : 'Send login link'}
                                                </>
                                            )}
                                        </button>
                                    </form>
                                )}

                                {/* OAuth 登录按钮 - WebView 环境下隐藏 */}
                                {!inWebView && (
                                    <>
                                        {/* 分割线 */}
                                        <div className="flex items-center gap-3 pt-1">
                                            <div className="flex-1 h-px bg-gray-200" />
                                            <span className="text-xs text-gray-400 font-medium">{isZh ? '或通过第三方登录' : 'OR continue with'}</span>
                                            <div className="flex-1 h-px bg-gray-200" />
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleGoogleLogin}
                                                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-900 hover:bg-google-blue text-white rounded-xl font-bold text-sm transition-all duration-300 shadow-sm hover:shadow-md"
                                            >
                                                <LogIn className="w-4 h-4" />
                                                Google
                                            </button>
                                            <button
                                                onClick={handleGitHubLogin}
                                                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-[#24292e] hover:bg-[#2f363d] text-white rounded-xl font-bold text-sm transition-all duration-300 shadow-sm hover:shadow-md"
                                            >
                                                <Github className="w-4 h-4" />
                                                GitHub
                                            </button>
                                        </div>
                                    </>
                                )}

                                <button
                                    onClick={handleClose}
                                    className="w-full py-3 px-4 text-gray-500 hover:text-gray-700 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                                >
                                    {isZh ? '暂不登录' : 'Not Now'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </ModalPortal>
    );
}
