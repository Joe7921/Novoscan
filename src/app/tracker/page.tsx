'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import BottomTabBar from '@/components/layout/BottomTabBar';
import TrackerDashboard from '@/components/tracker/TrackerDashboard';
import TrackerAlerts from '@/components/tracker/TrackerAlerts';
import MoatReport from '@/components/tracker/MoatReport';
import ScanHistory from '@/components/tracker/ScanHistory';
import ToastContainer, { showToast } from '@/components/ui/Toast';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import {
    ArrowLeft, Shield, Loader2, Radar, Bell,
    RefreshCw, Lock
} from 'lucide-react';
import LoginModal from '@/components/auth/LoginModal';



// ==================== 类型 ====================
interface Monitor {
    id: string;
    query: string;
    frequency: string;
    status: string;
    last_scan_at?: string;
    next_scan_at?: string;
    baseline_snapshot: any;
    scan_count: number;
    domain_id?: string;
    sub_domain_id?: string;
    created_at: string;
}

// ==================== 动画配置 ====================
const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0, 0, 0.2, 1] as const } }
};

// ==================== 主页面 ====================
export default function TrackerPage() {
    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [monitors, setMonitors] = useState<Monitor[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'alerts' | 'moat' | 'history'>('dashboard');
    const [refreshing, setRefreshing] = useState(false);
    const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

    const supabase = createClient();

    // 初始化认证
    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            setAuthReady(true);
        };
        init();
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => setUser(session?.user ?? null)
        );
        return () => subscription.unsubscribe();
    }, []);

    // 获取监控数据
    const fetchMonitors = useCallback(async () => {
        try {
            const res = await fetch('/api/tracker');
            const json = await res.json();
            if (json.success) {
                setMonitors(json.monitors || []);
                setUnreadCount(json.unreadAlertCount || 0);
            }
        } catch (e) {
            console.error('获取监控列表失败', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // 创建监控后自动轮询等待首次基线扫描完成
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollCountRef = useRef(0);

    const startBaselinePoll = useCallback(() => {
        // 清理旧的轮询
        if (pollRef.current) clearInterval(pollRef.current);
        pollCountRef.current = 0;

        pollRef.current = setInterval(async () => {
            pollCountRef.current++;
            // 最多轮询 8 次（约 4 分钟）
            if (pollCountRef.current > 8) {
                if (pollRef.current) clearInterval(pollRef.current);
                return;
            }
            try {
                const res = await fetch('/api/tracker');
                const json = await res.json();
                if (json.success) {
                    const newMonitors = json.monitors || [];
                    // 检查是否有新的扫描完成（scan_count > 0 且之前为 0）
                    const prevZero = monitors.some(m => m.scan_count === 0);
                    const nowDone = newMonitors.every((m: Monitor) => m.scan_count > 0);
                    setMonitors(newMonitors);
                    setUnreadCount(json.unreadAlertCount || 0);
                    if (prevZero && nowDone) {
                        showToast('success', '基线扫描完成', '首次扫描已生成基线数据，监控已就绪');
                        if (pollRef.current) clearInterval(pollRef.current);
                    }
                }
            } catch { /* 忽略 */ }
        }, 30_000);
    }, [monitors]);

    // 组件卸载时清理轮询
    useEffect(() => {
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    // 通过 API 查询数据库权限
    useEffect(() => {
        if (!authReady || !user) {
            if (authReady) setLoading(false);
            return;
        }
        const checkAccess = async () => {
            try {
                const res = await fetch('/api/auth/check-access?feature=tracker');
                const json = await res.json();
                setIsAllowed(json.hasAccess === true);
                if (json.hasAccess) {
                    fetchMonitors();
                    startBaselinePoll();
                } else {
                    setLoading(false);
                }
            } catch {
                setIsAllowed(false);
                setLoading(false);
            }
        };
        checkAccess();
    }, [authReady, user, fetchMonitors]);

    // 刷新
    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchMonitors();
        setRefreshing(false);
    };
    const selectedMonitor = monitors.find(m => m.id === selectedMonitorId);

    // ==================== 未登录：直接显示登录弹窗 ====================
    if (authReady && !user) {
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

    // ==================== 无权限 ====================
    if (authReady && isAllowed === false) {
        return (
            <div className="min-h-screen bg-slate-50 font-sans">
                <Navbar />
                <div className="max-w-lg mx-auto px-6 pt-32 text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/95 rounded-3xl p-10 border border-gray-100 shadow-lg"
                    >
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                            <Lock className="w-10 h-10 text-amber-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">测试功能</h2>
                        <p className="text-gray-500 mb-3">NovoTracker 创新领地持续监控系统</p>
                        <p className="text-sm text-gray-400 mb-8">此功能目前仅限受邀测试用户使用，敬请期待公开发布。</p>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-full font-bold hover:bg-gray-700 transition-all duration-300"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            返回首页
                        </Link>
                    </motion.div>
                </div>
                <BottomTabBar />
            </div>
        );
    }

    // ==================== 加载中 ====================
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

    // ==================== 主内容 ====================
    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <Navbar />

            <motion.div
                className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-16"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* 页面标题 */}
                <motion.div variants={cardVariants} className="mb-8">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <Link href="/" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                                <ArrowLeft className="w-5 h-5 text-gray-500" />
                            </Link>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                                    <Radar className="w-7 h-7 text-blue-500" />
                                    NovoTracker
                                </h1>
                                <p className="text-sm text-gray-500 mt-1">创新领地持续监控系统 — 守护你的创新护城河</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* 未读预警徽章 */}
                            {unreadCount > 0 && (
                                <motion.button
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    onClick={() => { setActiveTab('alerts'); setSelectedMonitorId(monitors[0]?.id || null); }}
                                    className="relative p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                >
                                    <Bell className="w-5 h-5" />
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                </motion.button>
                            )}

                            {/* 刷新按钮 */}
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
                            >
                                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </motion.div>

                {/* 选项卡 */}
                {selectedMonitor && (
                    <motion.div variants={cardVariants} className="mb-6">
                        <div className="flex items-center gap-2 bg-white/95 rounded-2xl p-1.5 border border-gray-100 shadow-sm w-fit">
                            {(['dashboard', 'history', 'alerts', 'moat'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === tab
                                        ? 'bg-gray-900 text-white shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    {tab === 'dashboard' && '📊 监控面板'}
                                    {tab === 'history' && '🕐 扫描历史'}
                                    {tab === 'alerts' && (
                                        <span className="flex items-center gap-1.5">
                                            🔔 威胁预警
                                            {unreadCount > 0 && (
                                                <span className="w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                    {tab === 'moat' && '🏰 护城河报告'}
                                </button>
                            ))}
                            <button
                                onClick={() => { setSelectedMonitorId(null); setActiveTab('dashboard'); }}
                                className="px-3 py-2 rounded-xl text-sm font-bold text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all ml-2"
                            >
                                ← 返回列表
                            </button>
                        </div>
                        <p className="mt-3 text-sm text-gray-500">
                            监控目标: <span className="font-bold text-gray-700">&quot;{selectedMonitor.query}&quot;</span>
                        </p>
                    </motion.div>
                )}

                {/* 内容区域 */}
                <AnimatePresence mode="wait">
                    {!selectedMonitorId ? (
                        <motion.div
                            key="dashboard"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <TrackerDashboard
                                monitors={monitors}
                                onSelect={(id) => { setSelectedMonitorId(id); setActiveTab('dashboard'); }}
                                onRefresh={fetchMonitors}
                            />
                        </motion.div>
                    ) : activeTab === 'alerts' ? (
                        <motion.div
                            key="alerts"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <TrackerAlerts monitorId={selectedMonitorId} />
                        </motion.div>
                    ) : activeTab === 'history' ? (
                        <motion.div
                            key="history"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <ScanHistory monitorId={selectedMonitorId} />
                        </motion.div>
                    ) : activeTab === 'moat' ? (
                        <motion.div
                            key="moat"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <MoatReport monitorId={selectedMonitorId} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="monitor-detail"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <TrackerDashboard
                                monitors={monitors}
                                onSelect={(id) => { setSelectedMonitorId(id); setActiveTab('dashboard'); }}
                                onRefresh={fetchMonitors}
                                selectedId={selectedMonitorId}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Toast 通知容器 */}
            <ToastContainer />
            <BottomTabBar />
        </div>
    );
}
