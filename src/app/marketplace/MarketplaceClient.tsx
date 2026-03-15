'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Star, Download, ShieldCheck, Crown,
  ChevronLeft, ChevronRight, Loader2, WifiOff, Puzzle
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
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
        className: 'bg-gradient-to-r from-yellow-500/15 to-green-500/15 text-yellow-300 border-yellow-500/30',
      };
    case 'verified':
      return {
        label: 'Verified',
        icon: ShieldCheck,
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
      };
    default:
      return {
        label: 'Community',
        icon: Puzzle,
        className: 'bg-gray-500/10 text-gray-500 border-gray-600/25',
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
          <mark key={i} className="bg-purple-500/25 text-purple-200 rounded-sm px-0.5">
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
                : 'text-gray-700'
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] text-gray-500 font-medium">
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
        <div className="group relative bg-[#111118] rounded-2xl border border-gray-800/80 p-5 h-full transition-all duration-300 hover:border-purple-500/40 hover:shadow-[0_0_30px_rgba(139,92,246,0.08)] hover:-translate-y-0.5">
          {/* 渐变边框光效 */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/0 via-cyan-500/0 to-emerald-500/0 group-hover:from-purple-500/5 group-hover:via-cyan-500/5 group-hover:to-emerald-500/5 transition-all duration-500 pointer-events-none" />

          {/* 头部：图标 + 名称 + 徽章 */}
          <div className="relative flex items-start gap-3 mb-3">
            <div className="w-11 h-11 bg-[#0d0d14] rounded-xl flex items-center justify-center text-2xl border border-gray-800/40 shrink-0 group-hover:border-purple-500/20 transition-colors">
              {plugin.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white truncate group-hover:text-purple-200 transition-colors">
                  <HighlightText text={plugin.name} query={searchQuery} />
                </h3>
              </div>
              <div className="text-[11px] text-gray-500 truncate"><HighlightText text={plugin.nameEn} query={searchQuery} /></div>
            </div>
            {/* 验证徽章 */}
            <div className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${badge.className}`}>
              <BadgeIcon className="w-2.5 h-2.5" />
              {badge.label}
            </div>
          </div>

          {/* 作者 */}
          <div className="text-[10px] text-gray-600 mb-2 relative">by {plugin.author}</div>

          {/* 描述 */}
          <p className="relative text-xs text-gray-400 leading-relaxed mb-4 line-clamp-2 min-h-[2.5rem]">
            <HighlightText text={plugin.description} query={searchQuery} />
          </p>

          {/* 底部：评分 + 安装量 */}
          <div className="relative flex items-center justify-between pt-3 border-t border-gray-800/40">
            <StarRating rating={plugin.rating} count={plugin.ratingCount} />
            <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
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
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex flex-col" style={{ overflowX: 'clip' }}>
      {/* 背景装饰 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/3 right-1/3 w-[400px] h-[400px] bg-emerald-600/3 rounded-full blur-[120px]" />
      </div>

      <Navbar language={language} setLanguage={() => {}} />

      {/* 主内容 */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 lg:pb-8">

        {/* 顶部导航 + 标题 */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-purple-400 font-bold text-sm transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-purple-500/15 rounded-xl flex items-center justify-center border border-purple-500/20">
                <Puzzle className="w-4.5 h-4.5 text-purple-400" />
              </div>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em]">Plugin Marketplace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1">
              🧩 Plugin Marketplace
            </h1>
            <p className="text-sm text-gray-500 max-w-xl">
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜索插件名称、标签或关键词..."
              className="w-full bg-[#111118] rounded-xl border border-gray-800/80 pl-11 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-colors"
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
                      ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                      : 'bg-[#111118] text-gray-500 border-gray-800/60 hover:text-gray-300 hover:border-gray-700'
                  }`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>

            {/* 排序切换 */}
            <div className="flex items-center bg-[#111118] rounded-lg border border-gray-800/60 p-0.5 shrink-0">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSortChange(opt.id)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all whitespace-nowrap ${
                    sort === opt.id
                      ? 'bg-purple-500/15 text-purple-300'
                      : 'text-gray-500 hover:text-gray-300'
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
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-amber-300">离线模式</span>
                  <span className="text-xs text-amber-400/70 ml-2">
                    当前展示本地内置插件。连接到 novoscan.cn 以获取更多社区插件。
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 结果统计 */}
        {!isLoading && (
          <div className="text-[11px] text-gray-600 mb-4 font-medium">
            共 {total} 个插件
          </div>
        )}

        {/* 插件卡片网格 */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-3" />
            <p className="text-sm text-gray-500 font-medium">加载插件中...</p>
          </div>
        ) : plugins.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mb-4 border border-gray-700/30">
              <Search className="w-7 h-7 text-gray-600" />
            </div>
            <p className="text-sm font-bold text-gray-500 mb-1">未找到匹配的插件</p>
            <p className="text-[11px] text-gray-600 max-w-[240px]">
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
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold border border-gray-800/60 bg-[#111118] text-gray-400 hover:text-white hover:border-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold border border-gray-800/60 bg-[#111118] text-gray-400 hover:text-white hover:border-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              下一页
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </main>

      <BottomTabBar />
    </div>
  );
}
