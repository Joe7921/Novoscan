'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Puzzle, Database, Activity, RefreshCw, CheckCircle2,
  XCircle, AlertTriangle, Server, Code2, Globe
} from 'lucide-react';
import WorkspaceShell from '@/components/layout/WorkspaceShell';
import BottomTabBar from '@/components/layout/BottomTabBar';
import type { Language } from '@/types';

/* ============================================================
   环境变量状态（客户端安全检测）
   ============================================================ */

interface EnvStatus {
  key: string;
  label: string;
  category: string;
  configured: boolean;
}

/* ============================================================
   主组件
   ============================================================ */

export default function DevDashboard() {
  const [language] = useState<Language>('zh');
  const [plugins, setPlugins] = useState<Array<{
    id: string; name: string; nameEn: string; version: string;
    category: string; icon: string;
  }>>([]);
  const [envStatus, setEnvStatus] = useState<EnvStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'degraded' | 'unknown'>('unknown');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 获取插件列表
      const pluginRes = await fetch('/api/playground/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: '__list__', query: '' }),
      }).catch(() => null);

      // 获取健康状态
      const healthRes = await fetch('/api/health').catch(() => null);
      if (healthRes?.ok) {
        const healthData = await healthRes.json().catch(() => ({}));
        setHealthStatus(healthData.status === 'ok' ? 'healthy' : 'degraded');
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // 静态插件列表（从前端已知列表获取）
    setPlugins([
      { id: 'patent-scout', name: '专利侦察兵', nameEn: 'Patent Scout', version: '1.0.0', category: 'specialized', icon: '📜' },
      { id: 'github-trends', name: 'GitHub 趋势分析师', nameEn: 'GitHub Trends Analyst', version: '1.0.0', category: 'industry', icon: '📈' },
      { id: 'arxiv-scanner', name: 'arXiv 论文扫描仪', nameEn: 'arXiv Scanner', version: '1.0.0', category: 'academic', icon: '🔬' },
    ]);

    // 环境变量检测（仅检测客户端可知的 NEXT_PUBLIC_ 变量）
    setEnvStatus([
      { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase', category: '数据库', configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL },
      { key: 'NEXT_PUBLIC_AUTH_PROVIDER', label: '认证方案', category: '认证', configured: !!process.env.NEXT_PUBLIC_AUTH_PROVIDER },
      { key: 'NEXT_PUBLIC_SITE_URL', label: '站点 URL', category: '站点', configured: !!process.env.NEXT_PUBLIC_SITE_URL },
    ]);
  }, [fetchData]);

  /** 类别颜色 */
  function getCatColor(cat: string) {
    switch (cat) {
      case 'academic': return 'border-blue-500/30 bg-blue-500/5 text-blue-400';
      case 'industry': return 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400';
      case 'specialized': return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
      case 'community': return 'border-purple-500/30 bg-purple-500/5 text-purple-400';
      default: return 'border-gray-500/30 bg-gray-500/5 text-gray-400';
    }
  }

  return (
    <WorkspaceShell>
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex flex-col" style={{ overflowX: 'clip' }}>
      {/* 背景 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[150px]" />
      </div>

      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 lg:pb-8">
        {/* 头部 */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-emerald-400 font-bold text-sm transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-emerald-500/15 rounded-xl flex items-center justify-center border border-emerald-500/20">
                <Code2 className="w-4.5 h-4.5 text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Developer Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1">
              🛠️ 开发者仪表板
            </h1>
            <p className="text-sm text-gray-500 max-w-xl">
              查看插件注册表、系统健康状态和环境配置。仅在开发环境中可见。
            </p>
          </motion.div>
        </div>

        {/* 概览卡片 */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#111118] rounded-2xl border border-gray-800/80 p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
              <Puzzle className="w-3.5 h-3.5" />
              已注册插件
            </div>
            <div className="text-3xl font-black text-white">{plugins.length}</div>
            <div className="text-xs text-gray-600 mt-1">Agent 插件</div>
          </div>

          <div className="bg-[#111118] rounded-2xl border border-gray-800/80 p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
              <Activity className="w-3.5 h-3.5" />
              系统状态
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${
                healthStatus === 'healthy' ? 'bg-green-400 animate-pulse' :
                healthStatus === 'degraded' ? 'bg-amber-400' : 'bg-gray-600'
              }`} />
              <span className={`text-sm font-bold ${
                healthStatus === 'healthy' ? 'text-green-400' :
                healthStatus === 'degraded' ? 'text-amber-400' : 'text-gray-500'
              }`}>
                {healthStatus === 'healthy' ? 'Healthy' : healthStatus === 'degraded' ? 'Degraded' : 'Checking...'}
              </span>
            </div>
            <div className="text-xs text-gray-600 mt-1">API 健康检查</div>
          </div>

          <div className="bg-[#111118] rounded-2xl border border-gray-800/80 p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">
              <Server className="w-3.5 h-3.5" />
              运行环境
            </div>
            <div className="text-sm font-bold text-white">
              {process.env.NODE_ENV === 'production' ? '🟢 Production' : '🔧 Development'}
            </div>
            <div className="text-xs text-gray-600 mt-1">Next.js {process.env.NEXT_RUNTIME || 'Node.js'}</div>
          </div>
        </div>

        {/* 插件注册表 */}
        <div className="bg-[#111118] rounded-2xl border border-gray-800/80 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] flex items-center gap-2">
              <Database className="w-3.5 h-3.5" />
              插件注册表
            </div>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="text-[10px] font-bold text-gray-600 hover:text-emerald-400 transition-colors flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>

          <div className="space-y-3">
            {plugins.map((plugin, i) => (
              <motion.div
                key={plugin.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#0d0d14] rounded-xl border border-gray-800/40 p-4 flex items-center gap-4"
              >
                <span className="text-2xl">{plugin.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{plugin.name}</span>
                    <span className="text-[10px] text-gray-600 font-mono">v{plugin.version}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">{plugin.nameEn} · <code className="text-gray-600">{plugin.id}</code></div>
                </div>
                <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border ${getCatColor(plugin.category)}`}>
                  {plugin.category}
                </span>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-800/40 flex items-center gap-4 text-xs text-gray-600">
            <Link href="/playground" className="text-purple-400 hover:text-purple-300 font-bold transition-colors flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              打开 Playground 测试
            </Link>
            <span className="text-gray-700">|</span>
            <span>运行 <code className="bg-gray-800 px-1.5 py-0.5 rounded text-emerald-400">npm run create-agent</code> 创建新插件</span>
          </div>
        </div>

        {/* 环境配置检视 */}
        <div className="bg-[#111118] rounded-2xl border border-gray-800/80 p-5 mb-6">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] flex items-center gap-2 mb-4">
            <Activity className="w-3.5 h-3.5" />
            环境配置状态
          </div>

          <div className="space-y-2">
            {envStatus.map(env => (
              <div key={env.key} className="flex items-center justify-between py-2 px-3 bg-[#0d0d14] rounded-lg border border-gray-800/30">
                <div className="flex items-center gap-3">
                  {env.configured ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <div>
                    <span className="text-xs font-bold text-gray-300">{env.label}</span>
                    <span className="text-[10px] text-gray-600 ml-2">({env.category})</span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  env.configured
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {env.configured ? '已配置' : '未配置'}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[10px] text-gray-600 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-gray-700" />
            仅显示客户端可见的 NEXT_PUBLIC_ 变量。服务端变量需通过 CLI 检查。
          </div>
        </div>

        {/* 快速操作 */}
        <div className="bg-[#111118] rounded-2xl border border-gray-800/80 p-5">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] flex items-center gap-2 mb-4">
            ⚡ 快速操作
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link
              href="/playground"
              className="flex items-center gap-3 px-4 py-3 bg-purple-500/5 rounded-xl border border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/10 transition-all group"
            >
              <span className="text-lg">🧩</span>
              <div>
                <div className="text-sm font-bold text-purple-300 group-hover:text-purple-200">Agent Playground</div>
                <div className="text-[11px] text-gray-500">测试已注册的 Agent 插件</div>
              </div>
            </Link>
            <Link
              href="/docs"
              className="flex items-center gap-3 px-4 py-3 bg-blue-500/5 rounded-xl border border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/10 transition-all group"
            >
              <span className="text-lg">📖</span>
              <div>
                <div className="text-sm font-bold text-blue-300 group-hover:text-blue-200">文档中心</div>
                <div className="text-[11px] text-gray-500">架构设计与 API 文档</div>
              </div>
            </Link>
            <Link
              href="/health"
              className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all group"
            >
              <span className="text-lg">🏥</span>
              <div>
                <div className="text-sm font-bold text-emerald-300 group-hover:text-emerald-200">健康检查</div>
                <div className="text-[11px] text-gray-500">API 数据源连通性测试</div>
              </div>
            </Link>
            <a
              href="https://github.com/Joe7921/Novoscan"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 bg-gray-500/5 rounded-xl border border-gray-700/40 hover:border-gray-600/60 hover:bg-gray-500/10 transition-all group"
            >
              <span className="text-lg">🐙</span>
              <div>
                <div className="text-sm font-bold text-gray-300 group-hover:text-gray-200">GitHub</div>
                <div className="text-[11px] text-gray-500">源码仓库与 Issues</div>
              </div>
            </a>
          </div>
        </div>
      </main>

      <BottomTabBar />
    </div>
    </WorkspaceShell>
  );
}
