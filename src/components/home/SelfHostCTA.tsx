'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Download, Server, Terminal, ChevronDown, ChevronUp, Sparkles, Shield, Zap, Copy, Check } from 'lucide-react';

/**
 * 自部署推广 CTA 组件
 *
 * 仅在 novoscan.cn（云端版）显示，引导用户了解并下载开源版自行部署。
 * 展示自部署的核心价值（隐私/无限制/可定制），提供一键复制的启动命令。
 *
 * 放置位置：首页 SiteFooter 之前，INPUT 状态下可见。
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

export default function SelfHostCTA() {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 仅在 novoscan.cn 域名下显示
    const isCloud = SITE_URL.includes('novoscan.cn') ||
      (typeof window !== 'undefined' && window.location.hostname.includes('novoscan.cn'));
    if (isCloud) {
      setShow(true);
    }
  }, []);

  const handleCopy = async () => {
    const cmd = 'git clone https://github.com/Joe7921/Novoscan.git && cd Novoscan && npm install && npm run setup && npm run dev';
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  if (!show) return null;

  return (
    <section className="w-full max-w-5xl mx-auto px-4 mb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-[#0a1628] via-[#0d1b2a] to-[#0a1628]"
      >
        {/* 装饰光斑 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-500/8 rounded-full blur-[100px]" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-blue-500/8 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-500/5 rounded-full blur-[120px]" />
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10">
          {/* 头部 */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Download className="w-4 h-4 text-white" />
                </div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em]">Open Source</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                喜欢 Novoscan？下载一份自己玩！
              </h3>
              <p className="text-sm text-gray-400 mt-1.5 max-w-lg">
                100% 开源 · Apache 2.0 协议 · 你的数据完全由你掌控
              </p>
            </div>
            <a
              href="https://github.com/Joe7921/Novoscan"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-sm font-bold text-white transition-all group"
            >
              <Github className="w-4 h-4 group-hover:text-emerald-400 transition-colors" />
              <span className="hidden sm:inline">GitHub</span>
              <span className="text-xs text-emerald-400 font-mono">⭐</span>
            </a>
          </div>

          {/* 三大价值卡片 */}
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            {[
              {
                icon: Shield,
                title: '数据隐私',
                desc: '所有分析数据留在你的服务器，不经过任何第三方',
                gradient: 'from-blue-500 to-cyan-500',
                glow: 'shadow-blue-500/10',
              },
              {
                icon: Zap,
                title: '无限使用',
                desc: '无次数限制、无功能阉割，完整的 6 Agent 分析引擎',
                gradient: 'from-amber-500 to-orange-500',
                glow: 'shadow-amber-500/10',
              },
              {
                icon: Sparkles,
                title: '自由定制',
                desc: '接入你自己的 AI 模型、扩展插件、自定义评估维度',
                gradient: 'from-violet-500 to-purple-500',
                glow: 'shadow-violet-500/10',
              },
            ].map((item) => (
              <div
                key={item.title}
                className={`bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4 hover:border-white/10 transition-colors ${item.glow}`}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-3 shadow-lg`}>
                  <item.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-sm font-bold text-white mb-1">{item.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>

          {/* 一键部署命令 */}
          <div className="bg-black/30 rounded-2xl border border-white/[0.06] p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">30 秒一键启动</span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-gray-500 hover:text-emerald-400 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className="font-mono text-xs sm:text-sm text-gray-300 space-y-1 overflow-x-auto">
              <div><span className="text-emerald-400">$</span> git clone https://github.com/Joe7921/Novoscan.git</div>
              <div><span className="text-emerald-400">$</span> cd Novoscan && npm install</div>
              <div><span className="text-emerald-400">$</span> npm run setup <span className="text-gray-600"># 交互式引导，零配置即跑</span></div>
              <div><span className="text-emerald-400">$</span> npm run dev <span className="text-gray-600"># 打开 localhost:3000 🎉</span></div>
            </div>
          </div>

          {/* 展开 — 更多部署方式 */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-400 transition-colors py-2"
          >
            {expanded ? '收起' : '更多部署方式（Docker / Codespaces）'}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="grid sm:grid-cols-3 gap-3 pt-2">
                  {/* Docker */}
                  <a
                    href="https://github.com/Joe7921/Novoscan/blob/main/docs/DOCKER.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 bg-blue-500/5 rounded-xl border border-blue-500/15 hover:border-blue-500/30 transition-all group"
                  >
                    <span className="text-lg">🐳</span>
                    <div>
                      <div className="text-sm font-bold text-blue-300 group-hover:text-blue-200">Docker 部署</div>
                      <div className="text-[11px] text-gray-600">一行命令启动完整服务</div>
                    </div>
                  </a>
                  {/* Codespaces */}
                  <a
                    href="https://codespaces.new/Joe7921/Novoscan?quickstart=1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 bg-purple-500/5 rounded-xl border border-purple-500/15 hover:border-purple-500/30 transition-all group"
                  >
                    <span className="text-lg">☁️</span>
                    <div>
                      <div className="text-sm font-bold text-purple-300 group-hover:text-purple-200">Codespaces</div>
                      <div className="text-[11px] text-gray-600">浏览器内一键开发</div>
                    </div>
                  </a>
                  {/* Gitpod */}
                  <a
                    href="https://gitpod.io/#https://github.com/Joe7921/Novoscan"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 bg-amber-500/5 rounded-xl border border-amber-500/15 hover:border-amber-500/30 transition-all group"
                  >
                    <span className="text-lg">🚀</span>
                    <div>
                      <div className="text-sm font-bold text-amber-300 group-hover:text-amber-200">Gitpod</div>
                      <div className="text-[11px] text-gray-600">在线 IDE 即开即用</div>
                    </div>
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 底部统计 */}
          <div className="flex items-center justify-center gap-6 mt-5 pt-4 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <Server className="w-3 h-3" />
              <span>Apache 2.0</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <span>🤖</span>
              <span>6 AI Agents</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <span>🧩</span>
              <span>插件生态</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
              <span>🐳</span>
              <span>Docker Ready</span>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
