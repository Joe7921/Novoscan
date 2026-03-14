'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import type { AuthUser } from '@/lib/auth/get-current-user';
import { DOMAIN_REGISTRY } from '@/lib/constants/domains';
import {
    User as UserIcon, Mail, Calendar, Search, TrendingUp,
    Globe, Cpu, Save, CheckCircle, AlertCircle, Loader2,
    BarChart3, Clock, ArrowLeft, Sparkles, Shield, Wallet,
    ArrowUpRight, ArrowDownLeft, Gift, Bell, MessageSquare, Send,
    ChevronDown, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import BottomTabBar from '@/components/layout/BottomTabBar';
import Link from 'next/link';
import { MODEL_OPTIONS } from '@/types';
import LoginModal from '@/components/auth/LoginModal';

// ==================== 类型定义 ====================

interface UserPreferencesData {
    topInterests: Array<{
        domain_id: string;
        sub_domain_id?: string;
        weight: number;
    }>;
    profile: {
        searchCount: number;
        lastSearchAt: string | null;
        topDomainId: string | null;
        topSubDomainId: string | null;
        displayName: string | null;
        preferredLanguage: string | null;
        preferredModel: string | null;
        points: number;
    } | null;
    recentDomains: string[];
}


// ==================== 工具函数 ====================

/** 将 domain_id 转为显示信息 */
function getDomainInfo(domainId: string) {
    return DOMAIN_REGISTRY.find(d => d.id === domainId) || DOMAIN_REGISTRY[DOMAIN_REGISTRY.length - 1];
}

/** 格式化相对时间 */
function formatTimeAgo(dateStr: string | null): string {
    if (!dateStr) return '暂无记录';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} 天前`;
    return new Date(dateStr).toLocaleDateString('zh-CN');
}

// ==================== 动画配置 ====================

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08 }
    }
};

const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0, 0, 0.2, 1] as const } }
};

// ==================== 主组件 ====================

export default function ProfilePage() {
    const { user: authUser, loading: authLoading } = useAuthSession();
    const [prefsData, setPrefsData] = useState<UserPreferencesData | null>(null);
    const [loading, setLoading] = useState(true);

    // 偏好编辑状态
    const [editName, setEditName] = useState('');
    const [editLang, setEditLang] = useState('zh');
    const [editModel, setEditModel] = useState('gemini-2.0-flash');
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);

    // 管理员身份
    const [isAdmin, setIsAdmin] = useState(false);

    // 通知设置
    const [notifChannel, setNotifChannel] = useState<'email' | 'serverchan' | 'telegram'>('email');
    const [notifServerChanKey, setNotifServerChanKey] = useState('');
    const [notifTelegramToken, setNotifTelegramToken] = useState('');
    const [notifTelegramChatId, setNotifTelegramChatId] = useState('');
    const [notifSaving, setNotifSaving] = useState(false);
    const [notifResult, setNotifResult] = useState<'success' | 'error' | null>(null);
    const [tutorialOpen, setTutorialOpen] = useState<string | null>(null);

    // ---- 获取偏好数据 ----
    useEffect(() => {
        if (authLoading || !authUser) {
            if (!authLoading) setLoading(false);
            return;
        }
        const fetchData = async () => {
            try {
                const res = await fetch('/api/user-preferences');
                const json = await res.json();
                if (json.success) {
                    setPrefsData(json);
                    // 填充编辑字段
                    if (json.profile) {
                        setEditName(json.profile.displayName || authUser.name || '');
                        setEditLang(json.profile.preferredLanguage || 'zh');
                        setEditModel(json.profile.preferredModel || 'minimax');
                    } else {
                        setEditName(authUser.name || '');
                    }
                }
            } catch (e) {
                console.error('获取偏好数据失败', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [authLoading, authUser]);


    // ---- 获取通知设置 ----
    useEffect(() => {
        if (authLoading || !authUser) return;
        const fetchNotifSettings = async () => {
            try {
                const res = await fetch('/api/notification-settings');
                const json = await res.json();
                if (json.success && json.settings) {
                    setNotifChannel(json.settings.preferred_channel || 'email');
                    setNotifServerChanKey(json.settings.serverchan_key || '');
                    setNotifTelegramToken(json.settings.telegram_bot_token || '');
                    setNotifTelegramChatId(json.settings.telegram_chat_id || '');
                }
            } catch { /* 静默 */ }
        };
        fetchNotifSettings();
    }, [authLoading, authUser]);

    // ---- 检查管理员权限 ----
    useEffect(() => {
        if (authLoading || !authUser) return;
        fetch('/api/auth/check-access?feature=admin')
            .then(r => r.json())
            .then(d => { if (d.hasAccess) setIsAdmin(true); })
            .catch(() => { });
    }, [authLoading, authUser]);

    // ---- 保存通知设置 ----
    const handleSaveNotif = async () => {
        setNotifSaving(true);
        setNotifResult(null);
        try {
            const res = await fetch('/api/notification-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    preferred_channel: notifChannel,
                    serverchan_key: notifServerChanKey,
                    telegram_bot_token: notifTelegramToken,
                    telegram_chat_id: notifTelegramChatId,
                }),
            });
            const json = await res.json();
            setNotifResult(json.success ? 'success' : 'error');
        } catch {
            setNotifResult('error');
        } finally {
            setNotifSaving(false);
            setTimeout(() => setNotifResult(null), 3000);
        }
    };

    // ---- 保存偏好 ----
    const handleSave = async () => {
        setSaving(true);
        setSaveResult(null);
        try {
            const res = await fetch('/api/user-preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    display_name: editName,
                    preferred_language: editLang,
                    preferred_model: editModel,
                }),
            });
            const json = await res.json();
            setSaveResult(json.success ? 'success' : 'error');
        } catch {
            setSaveResult('error');
        } finally {
            setSaving(false);
            setTimeout(() => setSaveResult(null), 3000);
        }
    };

    // ---- 兴趣数据处理 ----
    const interestBars = useMemo(() => {
        if (!prefsData?.topInterests?.length) return [];
        const maxWeight = Math.max(...prefsData.topInterests.map(i => i.weight));
        return prefsData.topInterests.map(interest => {
            const domain = getDomainInfo(interest.domain_id);
            return {
                ...interest,
                domain,
                percentage: maxWeight > 0 ? (interest.weight / maxWeight) * 100 : 0,
            };
        });
    }, [prefsData]);

    // ==================== 未登录状态：直接显示登录弹窗 ====================
    if (!authLoading && !authUser) {
        return (
            <div className="min-h-screen bg-slate-50 font-sans">
                <Navbar />
                <div className="flex items-center justify-center pt-40">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
                <LoginModal
                    isOpen={true}
                    onClose={() => window.history.back()}
                />
                <BottomTabBar />
            </div>
        );
    }

    // ==================== 加载状态 ====================
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 font-sans">
                <Navbar />
                <div className="flex items-center justify-center pt-40">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="ml-3 text-gray-500 font-medium">加载中...</span>
                </div>
                <BottomTabBar />
            </div>
        );
    }

    // ==================== 用户信息提取 ====================
    const avatarUrl = authUser?.image;
    const displayName = editName || authUser?.name || authUser?.email?.split('@')[0] || '用户';
    const email = authUser?.email || '';
    const provider = 'oauth'; // 简化处理，不依赖 Supabase 特有字段
    const createdAt = ''; // 创建时间由偏好数据提供，不依赖 Supabase user 对象

    const searchCount = prefsData?.profile?.searchCount || 0;
    const lastSearchAt = prefsData?.profile?.lastSearchAt || null;
    const topDomainId = prefsData?.profile?.topDomainId;
    const topDomain = topDomainId ? getDomainInfo(topDomainId) : null;

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <Navbar />

            <motion.div
                className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* ====== 页面标题 ====== */}
                <motion.div variants={cardVariants} className="mb-8 flex items-center gap-3">
                    <Link href="/" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-500" />
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">个人中心</h1>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ====== 左列：个人信息卡片 ====== */}
                    <motion.div variants={cardVariants} className="lg:col-span-1 space-y-6">

                        {/* 头像 + 基本信息 */}
                        <div className="bg-white/95 rounded-2xl p-6 border border-gray-100 shadow-sm overflow-hidden relative">
                            {/* 装饰背景 */}
                            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 -z-0" />

                            <div className="relative z-10 flex flex-col items-center text-center pt-4">
                                {/* 头像 */}
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt={displayName}
                                        className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl font-black border-4 border-white shadow-lg">
                                        {displayName.charAt(0).toUpperCase()}
                                    </div>
                                )}

                                <h2 className="text-xl font-bold text-gray-900 mt-4">{displayName}</h2>

                                {/* 管理员徽章 */}
                                {isAdmin && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold shadow-md shadow-amber-500/25"
                                    >
                                        <Shield className="w-3 h-3" />
                                        管理员
                                    </motion.div>
                                )}

                                <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
                                    <Mail className="w-3.5 h-3.5" />
                                    <span className="truncate max-w-[200px]">{email}</span>
                                </div>

                                <div className="flex items-center gap-4 mt-4 text-xs text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {createdAt} 加入
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold capitalize">
                                        {provider}
                                    </span>
                                </div>
                            </div>
                        </div>


                        {/* 搜索统计 */}
                        <div className="bg-white/95 rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-blue-500" />
                                搜索统计
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                        <Search className="w-4 h-4 text-indigo-400" />
                                        总搜索次数
                                    </span>
                                    <span className="text-2xl font-black text-gray-900">{searchCount}</span>
                                </div>
                                <div className="h-px bg-gray-100" />
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-amber-400" />
                                        最近搜索
                                    </span>
                                    <span className="text-sm font-semibold text-gray-700">{formatTimeAgo(lastSearchAt)}</span>
                                </div>
                                <div className="h-px bg-gray-100" />
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                                        最活跃领域
                                    </span>
                                    {topDomain ? (
                                        <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${topDomain.colorClasses.bg} ${topDomain.colorClasses.text}`}>
                                            {topDomain.nameZh}
                                        </span>
                                    ) : (
                                        <span className="text-sm text-gray-400">暂无数据</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* ====== 右列 ====== */}
                    <motion.div variants={cardVariants} className="lg:col-span-2 space-y-6">

                                                {/* 兴趣领域图表 */}
                        <div className="bg-white/95 rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-yellow-500" />
                                兴趣领域分布
                            </h3>

                            {interestBars.length > 0 ? (
                                <div className="space-y-4">
                                    {interestBars.map((bar, i) => (
                                        <motion.div
                                            key={bar.domain_id + (bar.sub_domain_id || '')}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="group"
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2.5 h-2.5 rounded-full ${bar.domain.colorClasses.dot}`} />
                                                    <span className="text-sm font-semibold text-gray-700">{bar.domain.nameZh}</span>
                                                    {bar.sub_domain_id && (
                                                        <span className="text-xs text-gray-400">({bar.sub_domain_id})</span>
                                                    )}
                                                </div>
                                                <span className="text-xs font-bold text-gray-500">权重 {bar.weight}</span>
                                            </div>
                                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                                <motion.div
                                                    className={`h-full rounded-full ${bar.domain.colorClasses.dot} opacity-80`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${bar.percentage}%` }}
                                                    transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                                                />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                    <p className="text-sm">开始搜索后，您的兴趣画像将在此展示</p>
                                </div>
                            )}
                        </div>

                        {/* 最近领域标签 */}
                        {prefsData?.recentDomains && prefsData.recentDomains.length > 0 && (
                            <div className="bg-white/95 rounded-2xl p-6 border border-gray-100 shadow-sm">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-teal-500" />
                                    最近涉及领域
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {prefsData.recentDomains.map(domainId => {
                                        const domain = getDomainInfo(domainId);
                                        return (
                                            <span
                                                key={domainId}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${domain.colorClasses.bg} ${domain.colorClasses.text} ${domain.colorClasses.border}`}
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full ${domain.colorClasses.dot}`} />
                                                {domain.nameZh}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 偏好设置面板 */}
                        <div className="bg-white/95 rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-5 flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-purple-500" />
                                偏好设置
                            </h3>

                            <div className="space-y-5">
                                {/* 显示名称 */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        <UserIcon className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
                                        显示名称
                                    </label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        maxLength={50}
                                        placeholder="输入您的显示名称"
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                                    />
                                </div>

                                {/* 语言偏好 */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        <Globe className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
                                        语言偏好
                                    </label>
                                    <select
                                        value={editLang}
                                        onChange={e => setEditLang(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="zh">中文</option>
                                        <option value="en">English</option>
                                    </select>
                                </div>

                                {/* 模型偏好 */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        <Cpu className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
                                        首选 AI 模型
                                    </label>
                                    <select
                                        value={editModel}
                                        onChange={e => setEditModel(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all appearance-none cursor-pointer"
                                    >
                                        {MODEL_OPTIONS.map(opt => (
                                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 保存按钮 */}
                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-700 disabled:opacity-50 transition-all duration-300 shadow-sm hover:shadow-md"
                                    >
                                        {saving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        {saving ? '保存中...' : '保存设置'}
                                    </button>

                                    <AnimatePresence>
                                        {saveResult === 'success' && (
                                            <motion.span
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center gap-1 text-sm text-emerald-600 font-semibold"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                已保存
                                            </motion.span>
                                        )}
                                        {saveResult === 'error' && (
                                            <motion.span
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center gap-1 text-sm text-red-500 font-semibold"
                                            >
                                                <AlertCircle className="w-4 h-4" />
                                                保存失败
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>

                        {/* 通知设置面板 */}
                        <div className="bg-white/95 rounded-2xl p-6 border border-gray-100 shadow-sm">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Bell className="w-4 h-4 text-blue-500" />
                                通知设置
                            </h3>
                            <p className="text-xs text-gray-400 mb-5">NovoTracker 检测到威胁预警时，选择一个渠道接收通知</p>

                            {/* 渠道选择 */}
                            <div className="grid grid-cols-3 gap-2 mb-5">
                                {[
                                    { value: 'email' as const, label: '📧 邮件', desc: '发送至登录邮箱' },
                                    { value: 'serverchan' as const, label: '💬 Server酱', desc: '微信推送' },
                                    { value: 'telegram' as const, label: '✈️ Telegram', desc: 'Bot 推送' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setNotifChannel(opt.value)}
                                        className={`p-3 rounded-xl border-2 text-left transition-all duration-300 ${notifChannel === opt.value
                                            ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                            }`}
                                    >
                                        <div className={`text-sm font-bold ${notifChannel === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>
                                            {opt.label}
                                        </div>
                                        <div className="text-[11px] text-gray-400 mt-0.5">{opt.desc}</div>
                                    </button>
                                ))}
                            </div>

                            {/* 渠道配置区 */}
                            <div className="space-y-4">
                                {notifChannel === 'email' && (
                                    <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-100">
                                        <div className="flex items-center gap-2 text-sm text-blue-700 font-semibold">
                                            <Mail className="w-4 h-4" />
                                            预警将发送至：{authUser?.email || '您的登录邮箱'}
                                        </div>
                                        <p className="text-xs text-blue-500/70 mt-1">无需额外配置，系统会自动使用您的登录邮箱</p>
                                    </div>
                                )}

                                {notifChannel === 'serverchan' && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            <MessageSquare className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
                                            Server酱 SendKey
                                        </label>
                                        <input
                                            type="text"
                                            value={notifServerChanKey}
                                            onChange={e => setNotifServerChanKey(e.target.value)}
                                            placeholder="如 SCTxxx"
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                                        />
                                        <p className="text-[11px] text-gray-400">在 <a href='https://sct.ftqq.com' target='_blank' rel='noreferrer' className='underline text-blue-400'>sct.ftqq.com</a> 获取</p>
                                    </div>
                                )}

                                {notifChannel === 'telegram' && (
                                    <div className="space-y-2">
                                        <label className="block text-sm font-semibold text-gray-700">
                                            <Send className="w-3.5 h-3.5 inline mr-1.5 text-gray-400" />
                                            Telegram Bot 配置
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="text"
                                                value={notifTelegramToken}
                                                onChange={e => setNotifTelegramToken(e.target.value)}
                                                placeholder="Bot Token"
                                                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                                            />
                                            <input
                                                type="text"
                                                value={notifTelegramChatId}
                                                onChange={e => setNotifTelegramChatId(e.target.value)}
                                                placeholder="Chat ID"
                                                className="px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                                            />
                                        </div>
                                        <p className="text-[11px] text-gray-400">通过 @BotFather 创建 Bot 获取 Token，给 Bot 发消息后获取 Chat ID</p>
                                    </div>
                                )}
                            </div>

                            {/* 保存 */}
                            <div className="flex items-center gap-3 pt-4">
                                <button
                                    onClick={handleSaveNotif}
                                    disabled={notifSaving}
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-700 disabled:opacity-50 transition-all duration-300 shadow-sm hover:shadow-md"
                                >
                                    {notifSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {notifSaving ? '保存中...' : '保存通知设置'}
                                </button>
                                <AnimatePresence>
                                    {notifResult === 'success' && (
                                        <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-sm text-emerald-600 font-semibold">
                                            <CheckCircle className="w-4 h-4" /> 已保存
                                        </motion.span>
                                    )}
                                    {notifResult === 'error' && (
                                        <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-sm text-red-500 font-semibold">
                                            <AlertCircle className="w-4 h-4" /> 保存失败
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* 配置教程（手风琴） */}
                            <div className="mt-5 border-t border-gray-100 pt-4">
                                <button
                                    onClick={() => setTutorialOpen(tutorialOpen === 'main' ? null : 'main')}
                                    className="flex items-center justify-between w-full text-left group"
                                >
                                    <span className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        <HelpCircle className="w-3.5 h-3.5" />
                                        渠道配置教程
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${tutorialOpen === 'main' ? 'rotate-180' : ''}`} />
                                </button>

                                <AnimatePresence>
                                    {tutorialOpen === 'main' && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-3 space-y-2">
                                                {/* 邮件教程 */}
                                                <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                                                        📧 邮件
                                                    </div>
                                                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                                                        无需配置，使用您的登录邮箱自动接收。确保邮箱可用即可。
                                                    </p>
                                                </div>

                                                {/* Server酱教程 */}
                                                <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                                                        💬 Server酱（微信推送）
                                                    </div>
                                                    <ol className="text-[11px] text-gray-400 mt-1.5 space-y-1 leading-relaxed list-decimal list-inside">
                                                        <li>打开 <a href="https://sct.ftqq.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">sct.ftqq.com</a> 微信扫码登录</li>
                                                        <li>点击「SendKey」复制 <code className="px-1 py-0.5 bg-gray-200/60 rounded text-[10px]">SCT...</code> 格式的 Key</li>
                                                        <li>粘贴到上方输入框，保存即可</li>
                                                    </ol>
                                                </div>

                                                {/* Telegram教程 */}
                                                <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-100">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                                                        ✈️ Telegram Bot
                                                    </div>
                                                    <ol className="text-[11px] text-gray-400 mt-1.5 space-y-1 leading-relaxed list-decimal list-inside">
                                                        <li>在 Telegram 搜索 <code className="px-1 py-0.5 bg-gray-200/60 rounded text-[10px]">@BotFather</code> → 发送 <code className="px-1 py-0.5 bg-gray-200/60 rounded text-[10px]">/newbot</code></li>
                                                        <li>按提示命名 → 获取 <strong>Bot Token</strong></li>
                                                        <li>给你的新 Bot 发一条消息（随便发什么）</li>
                                                        <li>访问 <code className="px-1 py-0.5 bg-gray-200/60 rounded text-[10px]">api.telegram.org/bot&lt;Token&gt;/getUpdates</code></li>
                                                        <li>在返回的 JSON 中找到 <code className="px-1 py-0.5 bg-gray-200/60 rounded text-[10px]">chat.id</code> 即为 <strong>Chat ID</strong></li>
                                                    </ol>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
            <BottomTabBar />
        </div>
    );
}
