'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { db } from '@/lib/db';
import { Clock, FileText, ArrowRight, Lock, Search, Trash2, X, Calendar, GitCompareArrows, CheckSquare, Square } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import BottomTabBar from '@/components/layout/BottomTabBar';


/** 免费用户最多展示条数 */
const FREE_LIMIT = 3;
/** 付费用户最多展示条数 */
const PREMIUM_LIMIT = 10;

/** 时间筛选选项 */
const TIME_FILTERS = [
    { key: 'all', label: '全部' },
    { key: 'today', label: '今天' },
    { key: '7d', label: '7天' },
    { key: '30d', label: '30天' },
] as const;

type TimeFilterKey = typeof TIME_FILTERS[number]['key'];

export default function HistoryPage() {
    const router = useRouter();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // 搜索和筛选状态
    const [searchQuery, setSearchQuery] = useState('');
    const [timeFilter, setTimeFilter] = useState<TimeFilterKey>('all');

    // 删除状态
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [clearing, setClearing] = useState(false);

    // 对比模式状态
    const [compareMode, setCompareMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showCompareModal, setShowCompareModal] = useState(false);

    useEffect(() => { loadHistory(); }, []);

    async function loadHistory() {
        setLoading(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user?.id) {
            setHistory([]);
            setLoading(false);
            return;
        }

        // 并行：检查 premium 权限 + 查总数
        const [premiumRes, countRes] = await Promise.all([
            fetch('/api/user-access?feature=premium').then(r => r.json()).catch(() => ({ access: false })),
            supabase
                .from('search_history')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id),
        ]);

        const hasPremium = premiumRes?.access === true;
        setIsPremium(hasPremium);
        setTotalCount(countRes.count || 0);

        const limit = hasPremium ? PREMIUM_LIMIT : FREE_LIMIT;

        const { data } = await supabase
            .from('search_history')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        setHistory(data || []);
        setLoading(false);
    }

    // 前端过滤（搜索 + 时间筛选）
    const filteredHistory = useMemo(() => {
        let items = history;

        // 关键词搜索
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            items = items.filter(item => item.query?.toLowerCase().includes(q));
        }

        // 时间范围筛选
        if (timeFilter !== 'all') {
            const now = Date.now();
            const msMap: Record<string, number> = {
                today: 24 * 60 * 60 * 1000,
                '7d': 7 * 24 * 60 * 60 * 1000,
                '30d': 30 * 24 * 60 * 60 * 1000,
            };
            const threshold = now - (msMap[timeFilter] || 0);
            items = items.filter(item => new Date(item.created_at).getTime() >= threshold);
        }

        return items;
    }, [history, searchQuery, timeFilter]);

    // 删除单条记录
    async function handleDelete(e: React.MouseEvent, itemId: string) {
        e.stopPropagation(); // 阻止触发跳转
        if (!confirm('确定删除这条搜索历史？')) return;

        setDeletingId(itemId);
        try {
            const res = await fetch(`/api/history/${itemId}`, { method: 'DELETE' });
            const json = await res.json();
            if (json.success) {
                setHistory(prev => prev.filter(h => h.id !== itemId));
                setTotalCount(prev => Math.max(0, prev - 1));
                // 同步清除本地缓存
                try {
                    if (db.historyReportCache) {
                        await db.historyReportCache.delete(String(itemId));
                    }
                } catch { /* 忽略 */ }
            }
        } catch (err) {
            console.error('[History] 删除失败:', err);
        } finally {
            setDeletingId(null);
        }
    }

    // 清空全部记录
    async function handleClearAll() {
        setClearing(true);
        try {
            // 逐条删除（受限于无批量删除 API）
            const deletePromises = history.map(item =>
                fetch(`/api/history/${item.id}`, { method: 'DELETE' }).catch(() => {})
            );
            await Promise.all(deletePromises);
            setHistory([]);
            setTotalCount(0);
            // 清空本地缓存
            try {
                if (db.historyReportCache) {
                    await db.historyReportCache.clear();
                }
            } catch { /* 忽略 */ }
        } catch (err) {
            console.error('[History] 清空失败:', err);
        } finally {
            setClearing(false);
            setShowClearConfirm(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-20 lg:pb-0">
            <Navbar />

            <div className="max-w-4xl mx-auto p-6 pt-24">
                {/* 标题行 */}
                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <Clock className="w-6 h-6 text-indigo-600" />
                        搜索历史
                    </h1>
                    {history.length > 0 && (
                        <div className="flex items-center gap-2">
                            {/* 对比模式切换 */}
                            <button
                                onClick={() => {
                                    setCompareMode(!compareMode);
                                    setSelectedIds(new Set());
                                }}
                                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
                                    compareMode
                                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                                        : 'text-slate-400 hover:text-indigo-500 bg-slate-50 hover:bg-indigo-50 border-transparent hover:border-indigo-200'
                                }`}
                            >
                                <GitCompareArrows className="w-3.5 h-3.5" />
                                {compareMode ? '取消对比' : '对比分析'}
                            </button>
                            <button
                                onClick={() => setShowClearConfirm(true)}
                                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 px-3 py-1.5 rounded-full border border-transparent hover:border-rose-200 transition-all"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                清空全部
                            </button>
                        </div>
                    )}
                </div>

                {/* 清空确认弹窗 */}
                {showClearConfirm && (
                    <div className="mb-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 animate-fade-in">
                        <span className="text-sm text-rose-700 font-medium flex-1">
                            确定清空所有搜索历史？此操作不可撤销。
                        </span>
                        <button
                            onClick={handleClearAll}
                            disabled={clearing}
                            className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                            {clearing ? '清空中...' : '确认清空'}
                        </button>
                        <button
                            onClick={() => setShowClearConfirm(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* 搜索和筛选栏 */}
                {!loading && history.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-3 mb-5">
                        {/* 搜索框 */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="搜索历史记录..."
                                className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* 时间筛选 */}
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-1.5 py-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
                            {TIME_FILTERS.map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setTimeFilter(f.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        timeFilter === f.key
                                            ? 'bg-indigo-500 text-white shadow-sm'
                                            : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-10 text-slate-500">
                        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                        加载中...
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                        {/* 空状态 SVG 插图 */}
                        <svg viewBox="0 0 200 160" fill="none" className="w-40 h-32 mx-auto mb-5">
                            <circle cx="85" cy="70" r="30" stroke="#e2e8f0" strokeWidth="4" fill="none">
                                <animate attributeName="r" values="30;32;30" dur="3s" repeatCount="indefinite" />
                            </circle>
                            <line x1="107" y1="92" x2="130" y2="115" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
                            <circle cx="70" cy="55" r="2" fill="#6366f1" opacity="0.4">
                                <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="100" cy="60" r="1.5" fill="#f59e0b" opacity="0.3">
                                <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2.5s" repeatCount="indefinite" />
                            </circle>
                            <rect x="140" y="40" width="30" height="38" rx="4" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />
                            <line x1="148" y1="50" x2="162" y2="50" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                            <line x1="148" y1="57" x2="158" y2="57" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <p className="text-lg font-semibold text-slate-800 mb-2">还没有搜索记录</p>
                        <p className="text-sm text-slate-400 mb-5">你的每一次创新探索都会被记录在这里</p>
                        <button
                            onClick={() => router.push('/')}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all"
                        >
                            去首页开始分析 →
                        </button>
                    </div>
                ) : filteredHistory.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 bg-white/95 rounded-xl shadow-sm border border-slate-100">
                        <Search className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                        <p className="font-medium">没有匹配的记录</p>
                        <p className="text-xs mt-1 text-slate-400">
                            尝试调整搜索关键词或时间范围
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* 对比模式提示 */}
                        {compareMode && (
                            <div className="px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700 font-medium">
                                🔍 选择 2 条记录进行对比分析（已选 {selectedIds.size}/2）
                            </div>
                        )}
                        {filteredHistory.map((item) => {
                            const isFailed = item.result?.success === false;
                            const isDeleting = deletingId === String(item.id);
                            const isSelected = selectedIds.has(String(item.id));

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        if (compareMode) {
                                            const id = String(item.id);
                                            const next = new Set(selectedIds);
                                            if (next.has(id)) {
                                                next.delete(id);
                                            } else if (next.size < 2) {
                                                next.add(id);
                                            }
                                            setSelectedIds(next);
                                            return;
                                        }
                                        if (isFailed || isDeleting) return;
                                        router.push(`/history/${item.id}`);
                                    }}
                                    className={`relative bg-white/95 border rounded-xl p-5 transition-all group ${
                                        compareMode && isSelected
                                            ? 'border-indigo-400 bg-indigo-50/50 shadow-md ring-2 ring-indigo-200'
                                            : isFailed
                                            ? 'border-slate-200 opacity-50 cursor-not-allowed'
                                            : isDeleting
                                            ? 'border-slate-200 opacity-40 pointer-events-none'
                                            : 'border-slate-200 hover:shadow-md hover:border-indigo-200 cursor-pointer'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        {/* 对比模式复选框 */}
                                        {compareMode && (
                                            <div className="mr-3 mt-1 flex-shrink-0">
                                                {isSelected ? (
                                                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                                                ) : (
                                                    <Square className="w-5 h-5 text-slate-300" />
                                                )}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`font-semibold text-lg text-slate-800 transition-colors truncate ${
                                                !isFailed ? 'group-hover:text-indigo-600' : ''
                                            }`}>
                                                {item.query}
                                            </h3>
                                            <p className="text-sm text-slate-500 mt-2 flex items-center gap-3 flex-wrap">
                                                <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                                                    <FileText className="w-4 h-4 text-emerald-600" />
                                                    {item.result?.academic?.stats?.totalPapers || 0} 篇论文
                                                </span>
                                                <span>·</span>
                                                <span className="flex items-center gap-1">
                                                    {item.result?.industry?.webResults?.length || 0} 条推荐
                                                </span>
                                                {item.search_time_ms && (
                                                    <>
                                                        <span>·</span>
                                                        <span>耗时 {(item.search_time_ms / 1000).toFixed(1)}s</span>
                                                    </>
                                                )}
                                                {isFailed && (
                                                    <>
                                                        <span>·</span>
                                                        <span className="bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-xs font-medium">分析失败</span>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end flex-shrink-0 gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                                                    {new Date(item.created_at).toLocaleString('zh-CN', {
                                                        month: '2-digit',
                                                        day: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                                {/* 删除按钮 */}
                                                <button
                                                    onClick={(e) => handleDelete(e, String(item.id))}
                                                    disabled={isDeleting}
                                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="删除"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            {!isFailed && (
                                                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* 历史记录数量提示 */}
                        {!isPremium && totalCount > FREE_LIMIT && (
                            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl">
                                <Lock className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-800">
                                        还有 {totalCount - FREE_LIMIT} 条历史记录未展示
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        登录后可查看更多历史分析报告
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 对比分析悬浮按钮 */}
                        {compareMode && selectedIds.size === 2 && (
                            <div className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-50">
                                <button
                                    onClick={() => setShowCompareModal(true)}
                                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-600/30 hover:shadow-2xl transition-all hover:-translate-y-0.5"
                                >
                                    <GitCompareArrows className="w-5 h-5" />
                                    对比这 2 份报告
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* 广告位 — 历史记录底部 */}
                {!loading && (
                    <div className="mt-8">                    </div>
                )}
            </div>

            {/* 对比分析弹窗 */}
            {showCompareModal && (() => {
                const items = history.filter(h => selectedIds.has(String(h.id)));
                const a = items[0];
                const b = items[1];
                if (!a || !b) return null;

                const rows = [
                    { label: '查询内容', va: a.query || '—', vb: b.query || '—' },
                    { label: '论文数', va: String(a.result?.academic?.stats?.totalPapers || 0), vb: String(b.result?.academic?.stats?.totalPapers || 0) },
                    { label: '推荐条数', va: String(a.result?.industry?.webResults?.length || 0), vb: String(b.result?.industry?.webResults?.length || 0) },
                    { label: '分析耗时', va: a.search_time_ms ? `${(a.search_time_ms / 1000).toFixed(1)}s` : '—', vb: b.search_time_ms ? `${(b.search_time_ms / 1000).toFixed(1)}s` : '—' },
                    { label: '创新评分', va: String(a.result?.noveltyScore || a.result?.report?.noveltyScore || '—'), vb: String(b.result?.noveltyScore || b.result?.report?.noveltyScore || '—') },
                    { label: '分析时间', va: new Date(a.created_at).toLocaleDateString('zh-CN'), vb: new Date(b.created_at).toLocaleDateString('zh-CN') },
                ];

                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setShowCompareModal(false)}>
                        <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-[95%] mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <GitCompareArrows className="w-5 h-5 text-indigo-600" />
                                    报告对比分析
                                </h3>
                                <button onClick={() => setShowCompareModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-6">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="text-left py-2 text-slate-400 font-bold text-xs">指标</th>
                                            <th className="text-center py-2 text-indigo-600 font-bold text-xs max-w-[40%] truncate">报告 A</th>
                                            <th className="text-center py-2 text-violet-600 font-bold text-xs max-w-[40%] truncate">报告 B</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map(r => (
                                            <tr key={r.label} className="border-b border-slate-50">
                                                <td className="py-3 text-slate-500 font-medium">{r.label}</td>
                                                <td className="py-3 text-center font-bold text-slate-800 max-w-[40%] truncate">{r.va}</td>
                                                <td className="py-3 text-center font-bold text-slate-800 max-w-[40%] truncate">{r.vb}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
                                <button
                                    onClick={() => setShowCompareModal(false)}
                                    className="w-full py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
                                >
                                    关闭
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <BottomTabBar />
        </div>
    );
}
