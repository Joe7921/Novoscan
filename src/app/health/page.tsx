'use client';

import { useState, useEffect } from 'react';

type HealthStatus = 'healthy' | 'degraded' | 'error';

interface HealthData {
    status: HealthStatus;
    message: string;
    checks: {
        connection: boolean;
        readWrite: boolean;
        tables: Record<string, boolean>;
        latency: number;
        timestamp: string;
    };
    stats?: {
        totalRecords: number;
    };
}

export default function HealthPage() {
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchHealth = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/health/db');
            const health = await response.json();
            setData(health);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch health data:', error);
            // Construct a fallback error object to display the error gracefully
            setData({
                status: 'error',
                message: '无法获取健康数据',
                checks: {
                    connection: false,
                    readWrite: false,
                    tables: {},
                    latency: 0,
                    timestamp: new Date().toISOString()
                }
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (status: HealthStatus) => {
        switch (status) {
            case 'healthy':
                return 'text-green-500 bg-green-500/10 border-green-500/20';
            case 'degraded':
                return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            case 'error':
                return 'text-red-500 bg-red-500/10 border-red-500/20';
            default:
                return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0D14] text-white p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 gradient-text-clip text-blue-400">
                        数据库健康状态
                    </h1>
                    <button
                        onClick={fetchHealth}
                        disabled={loading}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors flex items-center gap-2 border border-slate-700 disabled:opacity-50"
                    >
                        {loading ? (
                            <span className="w-4 h-4 border-2 border-white/20 border-t-white/100 rounded-full animate-spin" />
                        ) : null}
                        {loading ? '刷新中...' : '手动刷新'}
                    </button>
                </div>

                {data ? (
                    <div className="grid gap-6">
                        <div className={`p-6 rounded-xl border ${getStatusColor(data.status)}`}>
                            <div className="text-sm uppercase tracking-wider font-semibold opacity-80 mb-1">
                                总体状态
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-3xl font-bold capitalize flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${data.status === 'healthy' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' :
                                        data.status === 'degraded' ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.6)]' :
                                            'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]'
                                        }`} />
                                    {data.status === 'healthy' ? '健康' : data.status === 'degraded' ? '部分异常' : '故障'}
                                </div>
                                {data.status !== 'healthy' && (
                                    <div className="text-sm opacity-90 border-l border-current pl-3">- {data.message}</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* 核心指标 */}
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                                <h2 className="text-lg font-semibold mb-4 text-slate-200">核心指标</h2>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                                        <span className="text-slate-400">连接状态</span>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${data.checks.connection ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                            {data.checks.connection ? '正常' : '断开'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                                        <span className="text-slate-400">写操作测试</span>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${data.checks.readWrite ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                            {data.checks.readWrite ? '成功' : '失败'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                                        <span className="text-slate-400">响应延迟</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${data.checks.latency < 500 ? 'bg-green-500' : data.checks.latency < 1000 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                                            <span className="font-mono text-emerald-400">{data.checks.latency} ms</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">记录数 (search_history)</span>
                                        <span className="font-mono text-blue-400 font-medium bg-blue-500/10 px-2.5 py-1 rounded border border-blue-500/20">
                                            {data.stats?.totalRecords?.toLocaleString() || 0}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 数据表状态 */}
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                                <h2 className="text-lg font-semibold mb-4 text-slate-200">数据表状态</h2>
                                <div className="space-y-3">
                                    {Object.entries(data.checks.tables).length > 0 ? (
                                        Object.entries(data.checks.tables).map(([table, exists]) => (
                                            <div key={table} className="flex justify-between items-center p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                                <span className="font-mono text-sm text-slate-300">{table}</span>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${exists ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    <span className={`text-xs ${exists ? 'text-green-400' : 'text-red-400'}`}>
                                                        {exists ? '存在' : '缺失'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-sm text-slate-500 italic p-3 text-center">无法获取表状态</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="text-xs text-slate-500 text-right mt-4 flex items-center justify-end gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            自动刷新: 每 30 秒 | 最后更新: {lastUpdated?.toLocaleTimeString()}
                        </div>
                    </div>
                ) : (
                    <div className="h-64 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl">
                        <div className="flex flex-col items-center gap-3">
                            <span className="w-8 h-8 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
                            <p className="text-slate-400 text-sm">加载健康数据中...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
