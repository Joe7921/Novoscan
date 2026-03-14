'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Loader2, Shield, TrendingDown, Minus,
    Users, FileText, Activity, AlertTriangle,
    ArrowUp, ArrowDown, Lightbulb
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Area, AreaChart
} from 'recharts';

// ==================== 类型 ====================
interface MoatData {
    monitorId: string;
    query: string;
    currentScore: number;
    baselineScore: number;
    scoreTrend: number[];
    scoreChange: number;
    competitorTrend: number[];
    paperTrend: number[];
    moatStatus: 'strong' | 'stable' | 'weakening' | 'critical';
    moatAssessment: string;
    recommendations: string[];
    snapshots: Array<{
        scannedAt: string;
        noveltyScore: number;
        competitorCount: number;
        paperCount: number;
    }>;
    generatedAt: string;
}

interface MoatReportProps {
    monitorId: string;
}

// ==================== 配置 ====================
const moatStatusConfig: Record<MoatData['moatStatus'], { color: string; bg: string; border: string; icon: unknown; label: string; gradient: string }> = {
    strong: { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: Shield, label: '强劲', gradient: 'from-emerald-500 to-teal-500' },
    stable: { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: Minus, label: '稳定', gradient: 'from-blue-500 to-indigo-500' },
    weakening: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: TrendingDown, label: '收窄', gradient: 'from-amber-500 to-orange-500' },
    critical: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle, label: '危险', gradient: 'from-red-500 to-rose-500' },
};

// ==================== 主组件 ====================
export default function MoatReport({ monitorId }: MoatReportProps) {
    const [report, setReport] = useState<MoatData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const res = await fetch(`/api/tracker/${monitorId}/moat`);
                const json = await res.json();
                if (json.success) {
                    setReport(json.report);
                } else {
                    setError(json.error || '获取报告失败');
                }
            } catch (e) {
                setError('网络错误');
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [monitorId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="ml-2 text-gray-500 text-sm">生成护城河报告...</span>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="text-center py-16">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
                <p className="text-gray-500 font-bold">{error || '暂无数据'}</p>
                <p className="text-sm text-gray-400 mt-1">需要至少一次扫描后才能生成护城河报告</p>
            </div>
        );
    }

    const status = moatStatusConfig[report.moatStatus];
    const StatusIcon = status.icon;

    // 构建图表数据
    const chartData = report.snapshots.map((s, i) => ({
        name: i === 0 ? '基线' : `#${i}`,
        创新分: s.noveltyScore,
        竞品数: s.competitorCount,
        论文数: s.paperCount,
    }));

    return (
        <div className="space-y-6">
            {/* 护城河状态卡片 */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border ${status.border} overflow-hidden`}
            >
                <div className={`bg-gradient-to-r ${status.gradient} p-6 text-white`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <StatusIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium opacity-90">护城河状态</p>
                                <h2 className="text-2xl font-black">{status.label}</h2>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm opacity-80">当前创新分</p>
                            <p className="text-4xl font-black">{report.currentScore}</p>
                            <p className="text-sm font-bold mt-1 flex items-center justify-end gap-1">
                                {report.scoreChange > 0 ? (
                                    <><ArrowUp className="w-3 h-3" />+{report.scoreChange}</>
                                ) : report.scoreChange < 0 ? (
                                    <><ArrowDown className="w-3 h-3" />{report.scoreChange}</>
                                ) : (
                                    <><Minus className="w-3 h-3" />0</>
                                )}
                                <span className="opacity-70">vs 基线({report.baselineScore})</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* 评估文字 */}
                <div className="bg-white p-5">
                    <p className="text-sm text-gray-700 leading-relaxed">{report.moatAssessment}</p>
                </div>
            </motion.div>

            {/* 趋势图表 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 创新分趋势 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white/95 rounded-2xl p-5 border border-gray-100 shadow-sm"
                >
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-500" />
                        创新分趋势
                    </h3>
                    {chartData.length > 1 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} domain={[0, 100]} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    }}
                                />
                                <Area type="monotone" dataKey="创新分" stroke="#3b82f6" strokeWidth={2.5} fill="url(#scoreGradient)" dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-sm text-gray-300">
                            需要更多扫描数据
                        </div>
                    )}
                </motion.div>

                {/* 竞品数量趋势 */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="bg-white/95 rounded-2xl p-5 border border-gray-100 shadow-sm"
                >
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-red-500" />
                        竞品 & 论文数量变化
                    </h3>
                    {chartData.length > 1 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    }}
                                />
                                <Bar dataKey="竞品数" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.8} />
                                <Bar dataKey="论文数" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.6} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-sm text-gray-300">
                            需要更多扫描数据
                        </div>
                    )}
                </motion.div>
            </div>

            {/* 关键指标 */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-4"
            >
                {[
                    {
                        label: '基线创新分',
                        value: report.baselineScore,
                        icon: Shield,
                        color: 'text-gray-500',
                        bg: 'bg-gray-50',
                    },
                    {
                        label: '当前创新分',
                        value: report.currentScore,
                        icon: Activity,
                        color: report.scoreChange >= 0 ? 'text-emerald-500' : 'text-red-500',
                        bg: report.scoreChange >= 0 ? 'bg-emerald-50' : 'bg-red-50',
                    },
                    {
                        label: '竞品变化',
                        value: `${report.competitorTrend.length > 1 ? report.competitorTrend[report.competitorTrend.length - 1] - report.competitorTrend[0] : 0}`,
                        icon: Users,
                        color: 'text-amber-500',
                        bg: 'bg-amber-50',
                        prefix: (report.competitorTrend.length > 1 && report.competitorTrend[report.competitorTrend.length - 1] - report.competitorTrend[0] > 0) ? '+' : '',
                    },
                    {
                        label: '论文变化',
                        value: `${report.paperTrend.length > 1 ? report.paperTrend[report.paperTrend.length - 1] - report.paperTrend[0] : 0}`,
                        icon: FileText,
                        color: 'text-blue-500',
                        bg: 'bg-blue-50',
                        prefix: (report.paperTrend.length > 1 && report.paperTrend[report.paperTrend.length - 1] - report.paperTrend[0] > 0) ? '+' : '',
                    },
                ].map((metric, i) => (
                    <div key={metric.label} className="bg-white/95 rounded-2xl p-4 border border-gray-100 shadow-sm">
                        <div className={`w-8 h-8 ${metric.bg} rounded-lg flex items-center justify-center mb-2`}>
                            <metric.icon className={`w-4 h-4 ${metric.color}`} />
                        </div>
                        <p className="text-xl font-black text-gray-900">{(metric as unknown).prefix || ''}{metric.value}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">{metric.label}</p>
                    </div>
                ))}
            </motion.div>

            {/* 建议 */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white/95 rounded-2xl p-5 border border-gray-100 shadow-sm"
            >
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    策略建议
                </h3>
                <div className="space-y-3">
                    {report.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-yellow-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-xs font-black text-yellow-600">{i + 1}</span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed">{rec}</p>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* 生成时间 */}
            <p className="text-center text-xs text-gray-300 pt-4">
                报告生成于 {new Date(report.generatedAt).toLocaleString('zh-CN')}
            </p>
        </div>
    );
}
