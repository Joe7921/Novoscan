'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell, BellOff, AlertTriangle, AlertCircle, Info,
    Loader2, Eye, ChevronDown, ChevronUp, Users,
    FileText, TrendingDown, Shield, CheckCircle
} from 'lucide-react';

// ==================== 类型 ====================
interface Alert {
    id: number;
    monitor_id: string;
    alert_type: string;
    severity: string;
    title: string;
    description: string;
    details: unknown;
    is_read: boolean;
    created_at: string;
}

interface TrackerAlertsProps {
    monitorId: string;
}

// ==================== 配置 ====================
const severityConfig: Record<string, { icon: unknown; color: string; bg: string; border: string; label: string }> = {
    critical: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: '紧急' },
    warning: { icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: '警告' },
    info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', label: '信息' },
};

const typeConfig: Record<string, { icon: unknown; label: string }> = {
    new_competitor: { icon: Users, label: '新竞品' },
    new_paper: { icon: FileText, label: '新论文' },
    score_drop: { icon: TrendingDown, label: '分数下降' },
    moat_shrink: { icon: Shield, label: '护城河缩小' },
};

function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = Date.now();
    const diff = now - d.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} 天前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ==================== 主组件 ====================
export default function TrackerAlerts({ monitorId }: TrackerAlertsProps) {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    // 获取预警列表
    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const res = await fetch(`/api/tracker/${monitorId}/alerts`);
                const json = await res.json();
                if (json.success) setAlerts(json.alerts || []);
            } catch (e) {
                console.error('获取预警失败', e);
            } finally {
                setLoading(false);
            }
        };
        fetchAlerts();
    }, [monitorId]);

    // 标记已读
    const handleMarkRead = async (alertId: number) => {
        try {
            await fetch(`/api/tracker/${monitorId}/alerts`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alertId }),
            });
            setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
        } catch (e) {
            console.error('标记已读失败', e);
        }
    };

    // 全部标记已读
    const handleMarkAllRead = async () => {
        try {
            await fetch(`/api/tracker/${monitorId}/alerts`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAll: true }),
            });
            setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
        } catch (e) {
            console.error('标记全部已读失败', e);
        }
    };

    const unreadCount = alerts.filter(a => !a.is_read).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="ml-2 text-gray-500 text-sm">加载预警...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 头部 */}
            <div className="bg-white/95 rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                        <Bell className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900">威胁预警</h3>
                        <p className="text-xs text-gray-400">共 {alerts.length} 条预警，{unreadCount} 条未读</p>
                    </div>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={handleMarkAllRead}
                        className="text-xs font-bold text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-1"
                    >
                        <CheckCircle className="w-3.5 h-3.5" />
                        全部标记已读
                    </button>
                )}
            </div>

            {/* 预警列表 */}
            {alerts.length === 0 ? (
                <div className="text-center py-16">
                    <BellOff className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                    <p className="text-gray-400 font-bold">暂无预警</p>
                    <p className="text-sm text-gray-300 mt-1">系统正在持续监控，有新发现会立即通知你</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map((alert, i) => {
                        const severity = severityConfig[alert.severity] || severityConfig.info;
                        const type = typeConfig[alert.alert_type] || typeConfig.new_paper;
                        const isExpanded = expandedId === alert.id;
                        const SeverityIcon = severity.icon;
                        const TypeIcon = type.icon;

                        return (
                            <motion.div
                                key={alert.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className={`rounded-2xl border overflow-hidden transition-all duration-300 ${alert.is_read
                                    ? 'bg-white/95 border-gray-100'
                                    : `bg-white ${severity.border} shadow-sm`
                                    }`}
                            >
                                <div
                                    className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                                    onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* 严重程度图标 */}
                                        <div className={`w-9 h-9 rounded-xl ${severity.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                            <SeverityIcon className={`w-4 h-4 ${severity.color}`} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${severity.bg} ${severity.color}`}>
                                                    {severity.label}
                                                </span>
                                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                    <TypeIcon className="w-3 h-3" />
                                                    {type.label}
                                                </span>
                                                {!alert.is_read && (
                                                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                                                )}
                                            </div>
                                            <h4 className={`text-sm font-bold ${alert.is_read ? 'text-gray-500' : 'text-gray-900'}`}>
                                                {alert.title}
                                            </h4>
                                            <p className="text-xs text-gray-400 mt-1">{formatTime(alert.created_at)}</p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {!alert.is_read && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleMarkRead(alert.id); }}
                                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                                    title="标记已读"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                            {isExpanded ? (
                                                <ChevronUp className="w-4 h-4 text-gray-300" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-gray-300" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 展开详情 */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                                                <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                                                    {alert.description}
                                                </p>

                                                {/* 详细数据 */}
                                                {alert.details?.competitors?.length > 0 && (
                                                    <div className="mt-3">
                                                        <p className="text-xs font-bold text-gray-400 mb-1.5">新发现的竞品/项目:</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {alert.details.competitors.map((c: string, i: number) => {
                                                                // 检查是否有对应的 URL（从 diff.newCompetitorDetails 保存在 alert.details 中）
                                                                const detail = alert.details?.competitorDetails?.find((d: unknown) => d.title === c);
                                                                return detail?.url ? (
                                                                    <a key={i} href={detail.url} target="_blank" rel="noopener noreferrer"
                                                                       className="px-2 py-1 bg-red-50 text-red-600 text-[11px] font-medium rounded-lg hover:bg-red-100 hover:underline transition-colors">
                                                                        {c} ↗
                                                                    </a>
                                                                ) : (
                                                                    <span key={i} className="px-2 py-1 bg-red-50 text-red-600 text-[11px] font-medium rounded-lg">
                                                                        {c}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {alert.details?.papers?.length > 0 && (
                                                    <div className="mt-3">
                                                        <p className="text-xs font-bold text-gray-400 mb-1.5">新出现的论文:</p>
                                                        <div className="space-y-1">
                                                            {alert.details.papers.slice(0, 5).map((p: string, i: number) => {
                                                                const detail = alert.details?.paperDetails?.find((d: unknown) => d.title === p);
                                                                return detail?.url ? (
                                                                    <a key={i} href={detail.url} target="_blank" rel="noopener noreferrer"
                                                                       className="block text-[11px] text-blue-700 bg-blue-50 px-2 py-1 rounded-lg truncate hover:bg-blue-100 hover:underline transition-colors">
                                                                        📄 {p} ↗
                                                                    </a>
                                                                ) : (
                                                                    <p key={i} className="text-[11px] text-blue-700 bg-blue-50 px-2 py-1 rounded-lg truncate">
                                                                        📄 {p}
                                                                    </p>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {alert.details?.scoreChange !== undefined && (
                                                    <p className="mt-3 text-sm font-bold text-gray-600">
                                                        分数变化: <span className={alert.details.scoreChange < 0 ? 'text-red-500' : 'text-emerald-500'}>
                                                            {alert.details.scoreChange > 0 ? '+' : ''}{alert.details.scoreChange}
                                                        </span>
                                                    </p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
