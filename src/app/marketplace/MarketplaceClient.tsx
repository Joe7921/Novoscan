'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Star, Download, ShieldCheck, Crown,
  ChevronLeft, ChevronRight, Loader2, WifiOff, Puzzle
} from 'lucide-react';
import WorkspaceShell from '@/components/layout/WorkspaceShell';
import BottomTabBar from '@/components/layout/BottomTabBar';
import type { Language } from '@/types';
import type { MarketplacePlugin, PluginCategory } from '@/plugins/marketplace-types';
import type { MarketplaceListResponse } from '@/plugins/marketplace-types';
import { fetchPlugins, formatInstalls, type FetchPluginsParams } from '@/lib/services/marketplaceService';

/* ============================================================
   常量定义
   ============================================================ */

/** 分类筛选标签 */
const CATEGORIES: { id: PluginCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: '全部', icon: '🌐' },
  { id: 'academic', label: '学术', icon: '🎓' },
  { id: 'industry', label: '产业', icon: '🏭' },
  { id: 'specialized', label: '专业', icon: '🔧' },
  { id: 'community', label: '社区', icon: '👥' },
];

/** 排序选项 */
const SORT_OPTIONS: { id: FetchPluginsParams['sort']; label: string }[] = [
  { id: 'popular', label: '🔥 热门' },
  { id: 'newest', label: '🕐 最新' },
  { id: 'rating', label: '⭐ 高评分' },
];

/* ============================================================
   验证徽章样式
   ============================================================ */

function getVerificationBadge(verification: MarketplacePlugin['verification']) {
  switch (verification) {
    case 'featured':
      return {
        label: 'Official',
        icon: Crown,
        className: 'bg-novo-yellow/10 text-amber-600 border-novo-yellow/30 dark:bg-gradient-to-r dark:from-yellow-500/15 dark:to-green-500/15 dark:text-yellow-300 dark:border-yellow-500/30',
      };
    case 'verified':
      return {
        label: 'Verified',
        icon: ShieldCheck,
        className: 'bg-novo-blue/10 text-novo-blue border-novo-blue/25 dark:text-blue-400 dark:border-blue-500/25',
      };
    default:
      return {
        label: 'Community',
        icon: Puzzle,
        className: 'bg-gray-100 text-gray-500 border-gray-300/50 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-600/25',
      };
  }
}

/* ============================================================
   搜索高亮组件
   ============================================================ */

/** 对文本中的搜索关键词进行高亮渲染 */
function HighlightText({ text, query, className }: { text: string; query: string; className?: string }) {
  if (!query || !text) return <span className={className}>{text}</span>;

  // 转义正则特殊字符
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-novo-blue/20 text-novo-blue rounded-sm px-0.5 dark:bg-blue-500/25 dark:text-blue-200">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

/* ============================================================
   星级评分组件
   ============================================================ */

function StarRating({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${
              i <= Math.round(rating)
                ? 'text-amber-400 fill-amber-400'
                : 'text-gray-300 dark:text-gray-700'
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
        {rating.toFixed(1)} ({count})
      </span>
    </div>
  );
}

/* ============================================================
   插件卡片组件
   ============================================================ */

function PluginCard({ plugin, index, searchQuery = '' }: { plugin: MarketplacePlugin; index: number; searchQuery?: string }) {
  const badge = getVerificationBadge(plugin.verification);
  const BadgeIcon = badge.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Link href={`/marketplace/${plugin.id}`}>
        <div className="group relative bg-white/95 dark:bg-dark-surface/60 rounded-2xl border border-gray-100/80 dark:border-slate-800/80 p-5 h-full transition-all duration-300 hover:border-gray-300 dark:hover:border-slate-600 hover:shadow-md dark:hover:shadow-[0_0_30px_rgba(96,165,250,0.08)] hover:-translate-y-0.5">
          {/* 渐变边框光效 */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-novo-blue/0 via-novo-green/0 to-novo-yellow/0 group-hover:from-novo-blue/5 group-hover:via-novo-green/3 group-hover:to-novo-yellow/3 transition-all duration-500 pointer-events-none" />

          {/* 头部：图标 + 名称 + 徽章 */}
          <div className="relative flex items-start gap-3 mb-3">
            <div className="w-11 h-11 bg-gray-50 dark:bg-dark-base rounded-xl flex items-center justify-center text-2xl border border-gray-200 dark:border-slate-800/40 shrink-0 group-hover:border-novo-blue/30 dark:group-hover:border-blue-500/20 transition-colors">
              {plugin.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-novo-blue dark:group-hover:text-blue-300 transition-colors">
                  <HighlightText text={plugin.name} query={searchQuery} />
                </h3>
              </div>
              <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate"><HighlightText text={plugin.nameEn} query={searchQuery} /></div>
            </div>
            {/* 验证徽章 */}
            <div className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.className}`}>
              <BadgeIcon className="w-2.5 h-2.5" />
              {badge.label}
            </div>
          </div>

          {/* 作者 */}
          <div className="text-[10px] text-gray-400 dark:text-gray-600 mb-2 relative">by {plugin.author}</div>

          {/* 描述 */}
          <p className="relative text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4 line-clamp-2 min-h-[2.5rem]">
            <HighlightText text={plugin.description} query={searchQuery} />
          </p>

          {/* 底部：评分 + 安装量 */}
          <div className="relative flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800/40">
            <StarRating rating={plugin.rating} count={plugin.ratingCount} />
            <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-medium">
              <Download className="w-3 h-3" />
              {formatInstalls(plugin.installs)}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ============================================================
   Props 类型
   ============================================================ */

interface MarketplaceClientProps {
  /** 服务端预取的初始数据 */
  initialData: MarketplaceListResponse
}

/* ============================================================
   主页面客户端组件
   ============================================================ */

export default function MarketplaceClient({ initialData }: MarketplaceClientProps) {
  const [language] = useState<Language>('zh');
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>(initialData.plugins);
  const [isLoading, setIsLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(initialData.total <= 3);

  // 筛选状态
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<PluginCategory | 'all'>('all');
  const [sort, setSort] = useState<FetchPluginsParams['sort']>('popular');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(Math.max(1, Math.ceil(initialData.total / initialData.pageSize)));
  const [total, setTotal] = useState(initialData.total);

  // 标记是否已离开初始状态（用户操作过筛选/搜索/翻页）
  const [hasMutated, setHasMutated] = useState(false);

  // 搜索 debounce
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 搜索 debounce 300ms
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  // 用户操作后的客户端数据获取
  const loadPlugins = useCallback(async () => {
    if (!hasMutated) return; // 首次渲染使用服务端数据
    setIsLoading(true);
    try {
      const res = await fetchPlugins({
        search: debouncedSearch,
        category,
        sort,
        page,
        pageSize: 12,
      });
      setPlugins(res.plugins);
      setTotal(res.total);
      setTotalPages(Math.max(1, Math.ceil(res.total / res.pageSize)));
      setIsFallback(res.total <= 3);
    } catch {
      setPlugins([]);
      setIsFallback(true);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, category, sort, page, hasMutated]);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  // 分类切换时重置页码并标记为已变更
  const handleCategoryChange = (cat: PluginCategory | 'all') => {
    setCategory(cat);
    setPage(1);
    setHasMutated(true);
  };

  // 排序切换时重置页码并标记为已变更
  const handleSortChange = (s: FetchPluginsParams['sort']) => {
    setSort(s);
    setPage(1);
    setHasMutated(true);
  };

  // 搜索变更标记
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setHasMutated(true);
  };

  // 翻页标记
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setHasMutated(true);
  };

  return (
    <WorkspaceShell>
    <div className="min-h-screen bg-white dark:bg-dark-base text-gray-900 dark:text-slate-100 flex flex-col" style={{ overflowX: 'clip' }}>
      {/* 背景装饰 — 仅暗色模式显示 */}
      <div className="fixed inset-0 pointer-events-none z-0 hidden dark:block">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/3 right-1/3 w-[400px] h-[400px] bg-violet-600/3 rounded-full blur-[120px]" />
      </div>

      {/* 主内容 */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 lg:pb-8">

        {/* 顶部导航 + 标题 */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 dark:text-gray-500 hover:text-novo-blue dark:hover:text-blue-400 font-bold text-sm transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-novo-blue/10 dark:bg-blue-500/15 rounded-xl flex items-center justify-center border border-novo-blue/20 dark:border-blue-500/20">
                <Puzzle className="w-4.5 h-4.5 text-novo-blue dark:text-blue-400" />
              </div>
              <span className="text-[10px] font-bold text-novo-blue dark:text-blue-400 uppercase tracking-[0.2em]">Plugin Marketplace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white mb-1">
              🧩 Plugin Marketplace
            </h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xl">
              发现、安装和管理 Novoscan 插件。扩展你的创新评估能力。
            </p>
          </motion.div>
        </div>

        {/* 搜索 + 筛选区域 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-6 space-y-4"
        >
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜索插件名称、标签或关键词..."
              className="w-full bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-slate-700 pl-11 pr-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-novo-blue/50 dark:focus:border-blue-500/50 focus:ring-1 focus:ring-novo-blue/20 dark:focus:ring-blue-500/20 transition-colors"
            />
          </div>

          {/* 分类标签 + 排序 */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* 分类标签 */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                    category === cat.id
                      ? 'bg-novo-blue/10 text-novo-blue border-novo-blue/20 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30'
                      : 'bg-gray-50 dark:bg-dark-surface text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* 排序切换 */}
            <div className="flex items-center bg-gray-100 dark:bg-dark-surface rounded-lg border border-gray-200 dark:border-slate-700 p-0.5 shrink-0">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSortChange(opt.id)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap ${
                    sort === opt.id
                      ? 'bg-novo-blue/10 text-novo-blue dark:bg-blue-500/15 dark:text-blue-300'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* 降级提示横幅 */}
        <AnimatePresence>
          {isFallback && !isLoading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5"
            >
              <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-300">离线模式</span>
                  <span className="text-xs text-amber-500 dark:text-amber-400/70 ml-2">
                    当前展示本地内置插件。连接到 novoscan.cn 以获取更多社区插件。
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 结果统计 */}
        {!isLoading && (
          <div className="text-[11px] text-gray-400 dark:text-gray-600 mb-4 font-medium">
            共 {total} 个插件
          </div>
        )}

        {/* 插件卡片网格 */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-novo-blue dark:text-blue-400 animate-spin mb-3" />
            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">加载插件中...</p>
          </div>
        ) : plugins.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800/50 rounded-2xl flex items-center justify-center mb-4 border border-gray-200 dark:border-gray-700/30">
              <Search className="w-7 h-7 text-gray-400 dark:text-gray-600" />
            </div>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-1">未找到匹配的插件</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-600 max-w-[240px]">
              尝试调整搜索关键词或切换其他分类
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plugins.map((plugin, i) => (
              <PluginCard key={plugin.id} plugin={plugin} index={i} searchQuery={debouncedSearch} />
            ))}
          </div>
        )}

        {/* 分页 */}
        {!isLoading && totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-2 mt-8"
          >
            <button
              onClick={() => handlePageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-dark-surface text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              上一页
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePageChange(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    p === page
                      ? 'bg-novo-blue/10 text-novo-blue border border-novo-blue/20 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-dark-surface text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              下一页
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </main>

      <BottomTabBar />
    </div>
    </WorkspaceShell>
  );
}
