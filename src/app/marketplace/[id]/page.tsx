'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft, Star, Download, ShieldCheck, Crown, Puzzle,
  Copy, Check, GitBranch, Cloud, Tag, Lock, Calendar,
  ExternalLink, Loader2, User, MessageSquare
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import BottomTabBar from '@/components/layout/BottomTabBar';
import type { Language } from '@/types';
import type { MarketplacePlugin } from '@/plugins/marketplace-types';
import { fetchPluginDetail, formatInstalls } from '@/lib/services/marketplaceService';

/* ============================================================
   验证徽章
   ============================================================ */

function getVerificationBadge(verification: MarketplacePlugin['verification']) {
  switch (verification) {
    case 'featured':
      return {
        label: 'Official — 官方认证',
        icon: Crown,
        className: 'bg-gradient-to-r from-yellow-500/15 to-green-500/15 text-yellow-300 border-yellow-500/30',
      };
    case 'verified':
      return {
        label: 'Verified — 已审核',
        icon: ShieldCheck,
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
      };
    default:
      return {
        label: 'Community — 社区',
        icon: Puzzle,
        className: 'bg-gray-500/10 text-gray-500 border-gray-600/25',
      };
  }
}

/* ============================================================
   星级组件（大尺寸）
   ============================================================ */

function StarRatingLarge({ rating, count }: { rating: number; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i <= Math.round(rating)
                ? 'text-amber-400 fill-amber-400'
                : 'text-gray-700'
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-bold text-white">{rating.toFixed(1)}</span>
      <span className="text-xs text-gray-500">({count} 评分)</span>
    </div>
  );
}

/* ============================================================
   分类颜色
   ============================================================ */

function getCategoryStyle(category: string) {
  switch (category) {
    case 'academic': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'industry': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'specialized': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'community': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
}

/* ============================================================
   权限名称映射
   ============================================================ */

const PERMISSION_LABELS: Record<string, string> = {
  'network': '🌐 网络请求',
  'database': '🗄️ 数据库读写',
  'file-system': '📁 文件系统访问',
  'env-vars': '🔑 环境变量',
  'user-data': '👤 用户数据',
};

/* ============================================================
   模拟评论数据
   ============================================================ */

interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  content: string;
}

const MOCK_REVIEWS: Review[] = [
  { id: '1', author: 'Alice Z.', rating: 5, date: '2026-03-08', content: '非常好用的插件，分析结果准确度很高，推荐！' },
  { id: '2', author: 'Bob K.', rating: 4, date: '2026-03-05', content: '功能很强大，但加载速度可以再优化一下。' },
  { id: '3', author: 'Charlie W.', rating: 5, date: '2026-02-28', content: '完美集成到现有工作流中，节省了大量时间。' },
];

/* ============================================================
   主组件
   ============================================================ */

export default function PluginDetailPage() {
  const params = useParams();
  const pluginId = params.id as string;

  const [language] = useState<Language>('zh');
  const [plugin, setPlugin] = useState<MarketplacePlugin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [installTab, setInstallTab] = useState<'opensource' | 'cloud'>('opensource');
  const [copied, setCopied] = useState<string | null>(null);

  // 获取插件详情
  const loadPlugin = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPluginDetail(pluginId);
      setPlugin(data);
    } catch {
      setPlugin(null);
    } finally {
      setIsLoading(false);
    }
  }, [pluginId]);

  useEffect(() => {
    loadPlugin();
  }, [loadPlugin]);

  // 复制到剪贴板
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // 生成安装指引代码
  const cloneCommand = plugin?.repository
    ? `git clone ${plugin.repository}.git`
    : 'git clone https://github.com/Joe7921/Novoscan.git';

  const registerCode = plugin
    ? `// src/plugins/discovery.ts\nimport { ${plugin.id.replace(/-/g, '')}Agent } from './agents/${plugin.id}';\n\n// 在 agents 数组中添加：\n{ id: '${plugin.id}', agent: ${plugin.id.replace(/-/g, '')}Agent }`
    : '';

  // README 占位内容
  const readmeContent = plugin
    ? `# ${plugin.icon} ${plugin.name}\n\n${plugin.description}\n\n## 功能特性\n\n- 支持多维度智能分析\n- 自动生成结构化报告\n- 与 Novoscan Orchestrator 深度集成\n- 支持批量任务处理\n\n## 快速开始\n\n\`\`\`bash\n# 克隆仓库\n${cloneCommand}\n\n# 安装依赖\nnpm install\n\n# 启动开发服务器\nnpm run dev\n\`\`\`\n\n## 配置\n\n在 \`.env.local\` 中添加所需的 API Key（参见插件权限声明）。\n\n## 许可证\n\n${plugin.license}`
    : '';

  // 加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex flex-col" style={{ overflowX: 'clip' }}>
        <Navbar language={language} setLanguage={() => {}} />
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-3" />
          <p className="text-sm text-gray-500 font-medium">加载插件详情...</p>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  // 插件不存在
  if (!plugin) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex flex-col" style={{ overflowX: 'clip' }}>
        <Navbar language={language} setLanguage={() => {}} />
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mb-4 border border-gray-700/30">
            <Puzzle className="w-7 h-7 text-gray-600" />
          </div>
          <p className="text-sm font-bold text-gray-500 mb-1">插件不存在</p>
          <p className="text-[11px] text-gray-600 mb-4">未找到 ID 为「{pluginId}」的插件</p>
          <Link href="/marketplace" className="text-xs text-purple-400 hover:text-purple-300 font-bold transition-colors">
            ← 返回插件市场
          </Link>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  const badge = getVerificationBadge(plugin.verification);
  const BadgeIcon = badge.icon;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex flex-col" style={{ overflowX: 'clip' }}>
      {/* 背景装饰 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/3 w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-[150px]" />
      </div>

      <Navbar language={language} setLanguage={() => {}} />

      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 lg:pb-8">

        {/* 返回导航 */}
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-gray-500 hover:text-purple-400 font-bold text-sm transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          返回插件市场
        </Link>

        {/* 插件头部 */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-[#111118] rounded-2xl border border-gray-800/80 p-6 mb-5"
        >
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* 图标 */}
            <div className="w-16 h-16 bg-[#0d0d14] rounded-2xl flex items-center justify-center text-4xl border border-gray-800/40 shrink-0">
              {plugin.icon}
            </div>

            {/* 信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl font-black text-white">{plugin.name}</h1>
                <span className="text-sm text-gray-500">{plugin.nameEn}</span>
                {/* 验证徽章 */}
                <div className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${badge.className}`}>
                  <BadgeIcon className="w-3 h-3" />
                  {badge.label}
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-3">{plugin.description}</p>

              {/* 统计行 */}
              <div className="flex flex-wrap items-center gap-4">
                <StarRatingLarge rating={plugin.rating} count={plugin.ratingCount} />
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Download className="w-3.5 h-3.5" />
                  <span className="font-bold">{formatInstalls(plugin.installs)}</span> 安装
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Calendar className="w-3.5 h-3.5" />
                  更新于 {new Date(plugin.lastUpdated).toLocaleDateString('zh-CN')}
                </div>
              </div>
            </div>
          </div>

          {/* 元数据标签 */}
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-800/40">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${getCategoryStyle(plugin.category)}`}>
              {plugin.category}
            </span>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-gray-500/10 text-gray-400 border-gray-600/25">
              v{plugin.version}
            </span>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-gray-500/10 text-gray-400 border-gray-600/25">
              {plugin.license}
            </span>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-gray-500/10 text-gray-400 border-gray-600/25">
              by {plugin.author}
            </span>
            {plugin.pricing === 'free' && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-green-500/10 text-green-400 border-green-500/25">
                Free
              </span>
            )}
            {plugin.repository && (
              <a
                href={plugin.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-gray-500/10 text-gray-400 border-gray-600/25 hover:text-purple-300 hover:border-purple-500/30 transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                源码
              </a>
            )}
          </div>
        </motion.div>

        {/* 双栏/单栏布局 */}
        <div className="grid lg:grid-cols-3 gap-5">
          {/* ===== 左栏（2/3 宽度）===== */}
          <div className="lg:col-span-2 space-y-5">

            {/* 安装指引面板 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="bg-[#111118] rounded-2xl border border-gray-800/80 p-5"
            >
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5" />
                安装指引
              </div>

              {/* Tab 切换 */}
              <div className="flex items-center bg-[#0d0d14] rounded-lg border border-gray-800/40 p-0.5 mb-4">
                <button
                  onClick={() => setInstallTab('opensource')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-all ${
                    installTab === 'opensource'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  开源自部署
                </button>
                <button
                  onClick={() => setInstallTab('cloud')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-all ${
                    installTab === 'cloud'
                      ? 'bg-blue-500/15 text-blue-300'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5" />
                  云端版
                </button>
              </div>

              {installTab === 'opensource' ? (
                <div className="space-y-4">
                  {/* 步骤 1：克隆仓库 */}
                  <div>
                    <div className="text-[11px] font-bold text-gray-400 mb-2">① 克隆插件仓库</div>
                    <div className="relative bg-[#0a0a0f] rounded-xl border border-gray-800/40 p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      <code>{cloneCommand}</code>
                      <button
                        onClick={() => handleCopy(cloneCommand, 'clone')}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-500 hover:text-white transition-colors"
                      >
                        {copied === 'clone' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* 步骤 2：复制到 plugins 目录 */}
                  <div>
                    <div className="text-[11px] font-bold text-gray-400 mb-2">② 复制插件到 plugins 目录</div>
                    <div className="relative bg-[#0a0a0f] rounded-xl border border-gray-800/40 p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      <code>cp -r {plugin.id}/ src/plugins/agents/{plugin.id}/</code>
                      <button
                        onClick={() => handleCopy(`cp -r ${plugin.id}/ src/plugins/agents/${plugin.id}/`, 'copy')}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-500 hover:text-white transition-colors"
                      >
                        {copied === 'copy' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* 步骤 3：注册到 discovery */}
                  <div>
                    <div className="text-[11px] font-bold text-gray-400 mb-2">③ 注册到 discovery.ts</div>
                    <div className="relative bg-[#0a0a0f] rounded-xl border border-gray-800/40 p-3 font-mono text-[11px] text-cyan-400 overflow-x-auto whitespace-pre">
                      <code>{registerCode}</code>
                      <button
                        onClick={() => handleCopy(registerCode, 'register')}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-500 hover:text-white transition-colors"
                      >
                        {copied === 'register' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* 步骤 4：重启 */}
                  <div>
                    <div className="text-[11px] font-bold text-gray-400 mb-2">④ 重启开发服务器</div>
                    <div className="relative bg-[#0a0a0f] rounded-xl border border-gray-800/40 p-3 font-mono text-[11px] text-emerald-400">
                      <code>npm run dev</code>
                      <button
                        onClick={() => handleCopy('npm run dev', 'restart')}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-500 hover:text-white transition-colors"
                      >
                        {copied === 'restart' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Cloud className="w-10 h-10 text-blue-400/50 mx-auto mb-3" />
                  <p className="text-sm font-bold text-gray-400 mb-2">云端一键安装</p>
                  <p className="text-[11px] text-gray-600 mb-4 max-w-sm mx-auto">
                    登录 novoscan.cn 云端版后，点击下方按钮即可自动安装此插件，无需手动配置。
                  </p>
                  <button className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]">
                    ⚡ 一键安装
                  </button>
                  <p className="text-[10px] text-gray-600 mt-2">预计安装时间 &lt; 1 分钟</p>
                </div>
              )}
            </motion.div>

            {/* README 文档 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="bg-[#111118] rounded-2xl border border-gray-800/80 p-5"
            >
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                📄 README
              </div>
              <div className="prose prose-invert prose-sm max-w-none prose-headings:font-bold prose-headings:text-gray-200 prose-p:text-gray-400 prose-a:text-purple-400 prose-code:text-emerald-400 prose-code:bg-[#0d0d14] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[#0a0a0f] prose-pre:border prose-pre:border-gray-800/40 prose-li:text-gray-400">
                <ReactMarkdown>{readmeContent}</ReactMarkdown>
              </div>
            </motion.div>

            {/* 评分与评论 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="bg-[#111118] rounded-2xl border border-gray-800/80 p-5"
            >
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" />
                评分与评论
              </div>

              {/* 评分概览 */}
              <div className="flex items-center gap-6 mb-5 pb-4 border-b border-gray-800/40">
                <div className="text-center">
                  <div className="text-4xl font-black text-white">{plugin.rating.toFixed(1)}</div>
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          i <= Math.round(plugin.rating)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-1">{plugin.ratingCount} 评分</div>
                </div>

                {/* 评分分布条形图 */}
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    // 模拟分布比例
                    const pct = star === 5 ? 65 : star === 4 ? 25 : star === 3 ? 7 : star === 2 ? 2 : 1;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-3 text-right">{star}</span>
                        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.4 + star * 0.05 }}
                            className="h-full bg-amber-400/60 rounded-full"
                          />
                        </div>
                        <span className="text-[9px] text-gray-600 w-6 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 评论列表 */}
              <div className="space-y-4">
                {MOCK_REVIEWS.map((review) => (
                  <div key={review.id} className="bg-[#0d0d14] rounded-xl border border-gray-800/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-purple-500/15 rounded-full flex items-center justify-center">
                          <User className="w-3 h-3 text-purple-400" />
                        </div>
                        <span className="text-xs font-bold text-gray-300">{review.author}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={`w-2.5 h-2.5 ${
                                i <= review.rating
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-gray-700'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-gray-600">{review.date}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{review.content}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ===== 右栏（1/3 宽度）===== */}
          <div className="space-y-5">

            {/* 标签 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="bg-[#111118] rounded-2xl border border-gray-800/80 p-5"
            >
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                <Tag className="w-3.5 h-3.5" />
                标签
              </div>
              <div className="flex flex-wrap gap-2">
                {plugin.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-medium text-gray-400 bg-[#0d0d14] border border-gray-800/40 rounded-lg px-2.5 py-1">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* 权限声明 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="bg-[#111118] rounded-2xl border border-gray-800/80 p-5"
            >
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                权限声明
              </div>
              <div className="space-y-2">
                {plugin.permissions.map((perm) => (
                  <div key={perm} className="flex items-center gap-2 text-xs text-gray-400 bg-[#0d0d14] rounded-lg px-3 py-2 border border-gray-800/30">
                    <span>{PERMISSION_LABELS[perm] || perm}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* 快速统计 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="bg-[#111118] rounded-2xl border border-gray-800/80 p-5"
            >
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3">
                📊 统计
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">安装量</span>
                  <span className="text-xs font-bold text-white">{formatInstalls(plugin.installs)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">评分</span>
                  <span className="text-xs font-bold text-white">{plugin.rating.toFixed(1)} / 5.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">版本</span>
                  <span className="text-xs font-bold text-white">v{plugin.version}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">许可证</span>
                  <span className="text-xs font-bold text-white">{plugin.license}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">入口文件</span>
                  <span className="text-xs font-bold text-gray-400 font-mono">{plugin.entryPoint}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <BottomTabBar />
    </div>
  );
}
