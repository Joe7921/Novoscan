'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Radar, Clock, Pause, Play, Trash2, AlertTriangle,
    ChevronRight, Eye, Activity, Loader2, X,
    Zap, Calendar, Settings2, Search
} from 'lucide-react';
import ModalPortal from '@/components/ui/ModalPortal';
import { showToast } from '@/components/ui/Toast';

// ==================== 类型 ====================
interface Monitor {
    id: string;
    query: string;
    frequency: string;
    status: string;
    last_scan_at?: string;
    next_scan_at?: string;
    baseline_snapshot: unknown;
    scan_count: number;
    domain_id?: string;
    sub_domain_id?: string;
    created_at: string;
    latest_snapshot?: {
        novelty_score: number;
        competitor_count: number;
        paper_count: number;
        diff_summary?: {
            scoreChange: number;
            moatTrend: string;
            newCompetitors: string[];
            newPapers: string[];
        };
        scanned_at: string;
    } | null;
    score_trend?: number[];
    competitor_trend?: number[];
}

interface TrackerDashboardProps {
    monitors: Monitor[];
    onSelect: (id: string) => void;
    onRefresh: () => void;
    selectedId?: string;
}

// ==================== 工具函数 ====================
function formatTimeAgo(dateStr: string | null | undefined): string {
    if (!dateStr) return '从未扫描';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
}

function formatNextScan(dateStr: string | null | undefined): string {
    if (!dateStr) return '未计划';
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff < 0) return '待执行';
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `约 ${hours} 小时后`;
    const days = Math.floor(hours / 24);
    return `约 ${days} 天后`;
}

// ==================== SVG 迷你趋势线 ====================
function SparkLine({ data, width = 80, height = 28 }: { data: number[]; width?: number; height?: number }) {
    if (data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const trend = data[data.length - 1] - data[0];
    const color = trend > 0 ? '#10b981' : trend < 0 ? '#ef4444' : '#6b7280';

    const padY = 3;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = padY + ((max - v) / range) * (height - padY * 2);
        return `${x},${y}`;
    });

    const pathD = `M${points.join(' L')}`;
    // 闭合区域用于渐变填充
    const areaD = `${pathD} L${width},${height} L0,${height} Z`;
    const gradientId = `spark-grad-${data.length}-${data[0]}`;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={areaD} fill={`url(#${gradientId})`} />
            <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* 最后一个点 */}
            <circle
                cx={(data.length - 1) / (data.length - 1) * width}
                cy={padY + ((max - data[data.length - 1]) / range) * (height - padY * 2)}
                r="2" fill={color}
            />
        </svg>
    );
}

const statusConfig: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    active: { label: '运行中', color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
    paused: { label: '已暂停', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500' },
    expired: { label: '已过期', color: 'text-gray-500', bg: 'bg-gray-50', dot: 'bg-gray-400' }
};

// ==================== 创建监控弹窗 ====================
function CreateMonitorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [query, setQuery] = useState('');
    const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (query.length < 2) { setError('请输入至少 2 个字符'); return; }
        setCreating(true);
        setError('');
        try {
            const res = await fetch('/api/tracker', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, frequency, baselineResult: {} }),
            });
            const json = await res.json();
            if (json.success) {
                onCreated();
                onClose();
            } else {
                setError(json.error || '创建失败');
            }
        } catch {
            setError('网络错误');
        } finally {
            setCreating(false);
        }
    };

    return (
        <ModalPortal>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg border border-gray-100"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                            <Radar className="w-5 h-5 text-blue-500" />
                            创建新监控
                        </h3>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="space-y-5">
                        {/* 查新关键词 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">监控关键词</label>
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="输入你想持续监控的创新方向，如：AI辅助药物发现"
                                maxLength={200}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 transition-all"
                            />
                        </div>

                        {/* 扫描频率 */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">扫描频率</label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { value: 'daily' as const, label: '每天', desc: '适合快速变化领域', icon: Zap },
                                    { value: 'weekly' as const, label: '每周', desc: '适合稳定研究领域', icon: Calendar }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setFrequency(opt.value)}
                                        className={`p-4 rounded-xl border-2 text-left transition-all duration-300 ${frequency === opt.value
                                            ? 'border-blue-500 bg-blue-50/50'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <opt.icon className={`w-4 h-4 ${frequency === opt.value ? 'text-blue-500' : 'text-gray-400'}`} />
                                            <span className={`font-bold text-sm ${frequency === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>
                                                {opt.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-400">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 错误提示 */}
                        {error && (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" /> {error}
                            </p>
                        )}

                        {/* 提交按钮 */}
                        <button
                            onClick={handleCreate}
                            disabled={creating || query.length < 2}
                            className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-700 disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            {creating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    创建中...
                                </>
                            ) : (
                                <>
                                    <Radar className="w-4 h-4" />
                                    开启监控
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </ModalPortal>
    );
}

// ==================== 修改频率弹窗 ====================
function EditFrequencyModal({ monitor, onClose, onUpdated }: { monitor: Monitor; onClose: () => void; onUpdated: () => void }) {
    const [frequency, setFrequency] = useState<'daily' | 'weekly'>(monitor.frequency as 'daily' | 'weekly');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (frequency === monitor.frequency) { onClose(); return; }
        setSaving(true);
        setError('');
        try {
            const res = await fetch(`/api/tracker/${monitor.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_frequency', frequency }),
            });
            const json = await res.json();
            if (json.success) {
                onUpdated();
                onClose();
            } else {
                setError(json.error || '修改失败');
            }
        } catch {
            setError('网络错误');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalPortal>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border border-gray-100"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-blue-500" />
                            修改扫描频率
                        </h3>
                        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <p className="text-sm text-gray-500 mb-4 truncate">监控目标: <span className="font-bold text-gray-700">{monitor.query}</span></p>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                        {[
                            { value: 'daily' as const, label: '每天', desc: '适合快速变化领域', icon: Zap },
                            { value: 'weekly' as const, label: '每周', desc: '适合稳定研究领域', icon: Calendar }
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setFrequency(opt.value)}
                                className={`p-4 rounded-xl border-2 text-left transition-all duration-300 ${frequency === opt.value
                                    ? 'border-blue-500 bg-blue-50/50'
                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <opt.icon className={`w-4 h-4 ${frequency === opt.value ? 'text-blue-500' : 'text-gray-400'}`} />
                                    <span className={`font-bold text-sm ${frequency === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>
                                        {opt.label}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400">{opt.desc}</p>
                            </button>
                        ))}
                    </div>

                    {error && (
                        <p className="text-sm text-red-500 flex items-center gap-1 mb-4">
                            <AlertTriangle className="w-4 h-4" /> {error}
                        </p>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-700 disabled:opacity-50 transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> 保存中...</>
                        ) : (
                            <><Settings2 className="w-4 h-4" /> 保存修改</>
                        )}
                    </button>
                </motion.div>
            </motion.div>
        </ModalPortal>
    );
}

// ==================== TrackerDashboard 主组件 ====================
export default function TrackerDashboard({ monitors, onSelect, onRefresh, selectedId }: TrackerDashboardProps) {
    const [showCreate, setShowCreate] = useState(false);
    const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [scanningId, setScanningId] = useState<string | null>(null);

    const handleAction = async (monitorId: string, action: 'pause' | 'resume' | 'delete' | 'scan') => {
        if (action === 'scan') {
            setScanningId(monitorId);
        } else {
            setActionLoading(monitorId);
        }
        try {
            if (action === 'delete') {
                await fetch(`/api/tracker/${monitorId}`, { method: 'DELETE' });
            } else {
                const res = await fetch(`/api/tracker/${monitorId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action }),
                });
                // 扫描操作的 Toast 反馈
                if (action === 'scan') {
                    const json = await res.json();
                    if (json.success) {
                        showToast('success', '扫描完成', `发现 ${json.alertCount || 0} 条新预警`);
                    } else {
                        showToast('error', '扫描失败', json.error || '未知错误');
                    }
                }
            }
            await onRefresh();
        } catch (e) {
            console.error('操作失败', e);
            if (action === 'scan') {
                showToast('error', '扫描失败', '网络错误，请稍后重试');
            }
        } finally {
            setActionLoading(null);
            setScanningId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* 头部统计 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: '监控总数', value: monitors.length, icon: Radar, color: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: '运行中', value: monitors.filter(m => m.status === 'active').length, icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: '已暂停', value: monitors.filter(m => m.status === 'paused').length, icon: Pause, color: 'text-amber-500', bg: 'bg-amber-50' },
                    { label: '总扫描次数', value: monitors.reduce((s, m) => s + m.scan_count, 0), icon: Eye, color: 'text-purple-500', bg: 'bg-purple-50' },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white/95 rounded-2xl p-4 border border-gray-100 shadow-sm"
                    >
                        <div className={`w-8 h-8 ${stat.bg} rounded-lg flex items-center justify-center mb-2`}>
                            <stat.icon className={`w-4 h-4 ${stat.color}`} />
                        </div>
                        <p className="text-2xl font-black text-gray-900">{stat.value}</p>
                        <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* 创建按钮 */}
            <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setShowCreate(true)}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-bold text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/30 transition-all duration-300 flex items-center justify-center gap-2"
            >
                <Plus className="w-5 h-5" />
                创建新监控
            </motion.button>

            {/* 监控列表 */}
            <div className="space-y-4">
                {monitors.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <Radar className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-bold mb-2">暂无监控任务</p>
                        <p className="text-sm">点击上方按钮创建你的第一个创新领地监控</p>
                    </div>
                ) : (
                    monitors.map((monitor, i) => {
                        const status = statusConfig[monitor.status] || statusConfig.expired;
                        const baselineScore = monitor.baseline_snapshot?.noveltyScore || 0;
                        const hasLatest = !!monitor.latest_snapshot;
                        const currentScore = hasLatest ? monitor.latest_snapshot!.novelty_score : baselineScore;
                        const scoreChange = hasLatest ? (currentScore - baselineScore) : 0;

                        return (
                            <motion.div
                                key={monitor.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className={`bg-white/95 rounded-2xl p-5 border shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md ${selectedId === monitor.id ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100 hover:border-gray-200'
                                    }`}
                                onClick={() => onSelect(monitor.id)}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            {/* 脉冲动画 */}
                                            {monitor.status === 'active' && (
                                                <span className="relative flex h-2.5 w-2.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                                </span>
                                            )}
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${status.bg} ${status.color}`}>
                                                {status.label}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-medium">
                                                {monitor.frequency === 'daily' ? '每天' : '每周'}
                                            </span>
                                        </div>

                                        <h3 className="text-base font-bold text-gray-900 truncate mb-2">
                                            {monitor.query}
                                        </h3>

                                        <div className="flex items-center gap-4 text-xs text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                上次: {formatTimeAgo(monitor.last_scan_at)}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Eye className="w-3 h-3" />
                                                已扫描 {monitor.scan_count} 次
                                            </span>
                                            {monitor.status === 'active' && (
                                                <span className="flex items-center gap-1 text-blue-400">
                                                    <Clock className="w-3 h-3" />
                                                    下次: {formatNextScan(monitor.next_scan_at)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* 迷你趋势图 */}
                                        <div className="flex flex-col gap-1">
                                            {(monitor.score_trend?.length ?? 0) >= 2 && (
                                                <div title="创新分趋势">
                                                    <SparkLine data={monitor.score_trend!} />
                                                </div>
                                            )}
                                            {(monitor.competitor_trend?.length ?? 0) >= 2 && (
                                                <div title="竞品数量变化">
                                                    <SparkLine data={monitor.competitor_trend!} width={60} height={20} />
                                                </div>
                                            )}
                                        </div>

                                        {/* 当前分数 + 浮动指示器 */}
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-gray-900">{currentScore}</p>
                                            <p className="text-[10px] text-gray-400">
                                                {hasLatest ? '当前分数' : '基线分数'}
                                            </p>
                                            {hasLatest && scoreChange !== 0 && (
                                                <p className={`text-[11px] font-bold flex items-center justify-end gap-0.5 mt-0.5 ${scoreChange > 0 ? 'text-emerald-500' : 'text-red-500'
                                                    }`}>
                                                    {scoreChange > 0 ? (
                                                        <Activity className="w-3 h-3" />
                                                    ) : (
                                                        <Activity className="w-3 h-3" />
                                                    )}
                                                    {scoreChange > 0 ? '+' : ''}{scoreChange}
                                                </p>
                                            )}
                                            {hasLatest && scoreChange === 0 && (
                                                <p className="text-[11px] font-bold text-gray-400 mt-0.5">— 持平</p>
                                            )}
                                        </div>

                                        {/* 操作按钮 */}
                                        <div className="flex flex-col gap-1 ml-3" onClick={e => e.stopPropagation()}>
                                            {/* 立即扫描 */}
                                            {monitor.status === 'active' && (
                                                <button
                                                    onClick={() => handleAction(monitor.id, 'scan')}
                                                    disabled={scanningId === monitor.id || actionLoading === monitor.id}
                                                    className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors"
                                                    title="立即扫描"
                                                >
                                                    {scanningId === monitor.id ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <Search className="w-4 h-4" />}
                                                </button>
                                            )}
                                            {monitor.status === 'active' ? (
                                                <button
                                                    onClick={() => handleAction(monitor.id, 'pause')}
                                                    disabled={actionLoading === monitor.id}
                                                    className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-500 transition-colors"
                                                    title="暂停"
                                                >
                                                    {actionLoading === monitor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleAction(monitor.id, 'resume')}
                                                    disabled={actionLoading === monitor.id}
                                                    className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-500 transition-colors"
                                                    title="恢复"
                                                >
                                                    {actionLoading === monitor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setEditingMonitor(monitor)}
                                                className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors"
                                                title="修改频率"
                                            >
                                                <Settings2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleAction(monitor.id, 'delete')}
                                                disabled={actionLoading === monitor.id}
                                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                                title="删除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <ChevronRight className="w-5 h-5 text-gray-300" />
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* 创建弹窗 */}
            <AnimatePresence>
                {showCreate && (
                    <CreateMonitorModal
                        onClose={() => setShowCreate(false)}
                        onCreated={onRefresh}
                    />
                )}
            </AnimatePresence>

            {/* 修改频率弹窗 */}
            <AnimatePresence>
                {editingMonitor && (
                    <EditFrequencyModal
                        monitor={editingMonitor}
                        onClose={() => setEditingMonitor(null)}
                        onUpdated={onRefresh}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
