'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock, TrendingUp, TrendingDown, Minus, Users,
    FileText, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';

// ==================== 类型 ====================
interface Snapshot {
    id: number;
    novelty_score: number;
    competitor_count: number;
    paper_count: number;
    key_findings: string[];
    scan_result?: {
        competitorDetails?: Array<{ title: string; url?: string; source: string }>;
        paperDetails?: Array<{ title: string; url?: string; source: string }>;
    };
    diff_summary?: {
        newPapers: string[];
        newCompetitors: string[];
        scoreChange: number;
        moatTrend: 'expanding' | 'stable' | 'shrinking';
    };
    scanned_at: string;
}

interface ScanHistoryProps {
    monitorId: string;
}

// ==================== 工具函数 ====================
function formatScanTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs} 小时前`;
    // 超过 24 小时显示完整时间
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getTrendIcon(change: number) {
    if (change > 0) return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
    if (change < 0) return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
    return <Minus className="w-3.5 h-3.5 text-gray-400" />;
}

const moatLabels: Record<string, { label: string; color: string }> = {
    expanding: { label: '扩张中', color: 'text-emerald-600 bg-emerald-50' },
    stable: { label: '稳定', color: 'text-blue-600 bg-blue-50' },
    shrinking: { label: '收缩中', color: 'text-red-600 bg-red-50' },
};

// ==================== 主组件 ====================
export default function ScanHistory({ monitorId }: ScanHistoryProps) {
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    useEffect(() => {
        const fetchSnapshots = async () => {
            try {
                const res = await fetch(`/api/tracker/${monitorId}/snapshots`);
                const json = await res.json();
                if (json.success) {
                    setSnapshots(json.snapshots || []);
                }
            } catch (e) {
                console.error('获取扫描历史失败', e);
            } finally {
                setLoading(false);
            }
        };
        fetchSnapshots();
    }, [monitorId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="ml-2 text-sm text-gray-400">加载扫描历史...</span>
            </div>
        );
    }

    if (snapshots.length === 0) {
        return (
            <div className="text-center py-12 text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">暂无扫描记录</p>
                <p className="text-xs mt-1">使用"立即扫描"按钮触发首次扫描</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                扫描历史 ({snapshots.length} 条记录)
            </h3>

            <div className="space-y-2">
                {snapshots.map((snap, i) => {
                    const isExpanded = expandedId === snap.id;
                    const diff = snap.diff_summary;
                    const moat = diff?.moatTrend ? moatLabels[diff.moatTrend] : null;

                    return (
                        <motion.div
                            key={snap.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="bg-white/95 rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                        >
                            {/* 摘要行 */}
                            <button
                                onClick={() => setExpandedId(isExpanded ? null : snap.id)}
                                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* 分数 */}
                                    <div className="text-center shrink-0">
                                        <p className="text-lg font-black text-gray-900">{snap.novelty_score}</p>
                                        <p className="text-[9px] text-gray-400">创新分</p>
                                    </div>

                                    {/* 变化指标 */}
                                    {diff && (
                                        <div className="flex items-center gap-2">
                                            {getTrendIcon(diff.scoreChange)}
                                            <span className={`text-xs font-bold ${diff.scoreChange > 0 ? 'text-emerald-600' : diff.scoreChange < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                {diff.scoreChange > 0 ? '+' : ''}{diff.scoreChange}
                                            </span>
                                        </div>
                                    )}

                                    {/* 统计 */}
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" /> {snap.competitor_count}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <FileText className="w-3 h-3" /> {snap.paper_count}
                                        </span>
                                    </div>

                                    {/* 护城河趋势 */}
                                    {moat && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${moat.color}`}>
                                            {moat.label}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0 ml-3">
                                    <span className="text-xs text-gray-400">{formatScanTime(snap.scanned_at)}</span>
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
                                </div>
                            </button>

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
                                        <div className="px-4 pb-3 pt-1 border-t border-gray-50 space-y-2">
                                            {/* 新发现 */}
                                            {diff && diff.newCompetitors.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-amber-600 mb-1">🆕 新发现竞品</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {diff.newCompetitors.slice(0, 5).map((c, ci) => {
                                                            const detail = snap.scan_result?.competitorDetails?.find(d => d.title === c);
                                                            return detail?.url ? (
                                                                <a key={ci} href={detail.url} target="_blank" rel="noopener noreferrer"
                                                                   className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] rounded-full truncate max-w-[200px] hover:bg-amber-100 hover:underline transition-colors">
                                                                    {c} ↗
                                                                </a>
                                                            ) : (
                                                                <span key={ci} className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] rounded-full truncate max-w-[200px]">{c}</span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                            {diff && diff.newPapers.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-blue-600 mb-1">📄 新发现论文</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {diff.newPapers.slice(0, 5).map((p, pi) => {
                                                            const detail = snap.scan_result?.paperDetails?.find(d => d.title === p);
                                                            return detail?.url ? (
                                                                <a key={pi} href={detail.url} target="_blank" rel="noopener noreferrer"
                                                                   className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-full truncate max-w-[200px] hover:bg-blue-100 hover:underline transition-colors">
                                                                    {p} ↗
                                                                </a>
                                                            ) : (
                                                                <span key={pi} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-full truncate max-w-[200px]">{p}</span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                            {/* 关键发现 */}
                                            {snap.key_findings && snap.key_findings.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-600 mb-1">💡 关键发现</p>
                                                    <ul className="space-y-0.5">
                                                        {snap.key_findings.slice(0, 4).map((f, fi) => (
                                                            <li key={fi} className="text-[11px] text-gray-500 leading-relaxed">• {f}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
