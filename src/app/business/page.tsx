'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight, Building2, Cpu, Database, Shield, Layers, Zap,
  GitBranch, BrainCircuit, Network, Lock, Server,
  CheckCircle2, ArrowUpRight, Mail, Sparkles, ChevronRight,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import SiteFooter from '@/components/layout/SiteFooter';

/* =====================================================================
   Novoscan-Business 企业版介绍落地页
   设计原则：严格复用 Novoscan 现有设计语言
   - 白色背景 + 毛玻璃卡片 (bg-white/60)
   - 圆角 rounded-3xl
   - Google 品牌色点缀 (blue-500)
   - CSS 动画 animate-fade-in-up
   ===================================================================== */

/* ---------- 核心能力数据 ---------- */

const CORE_CAPABILITIES = [
  {
    icon: GitBranch,
    title: '动态编排引擎',
    desc: '自定义 Agent 数量、分层拓扑和执行策略 — 同层并行、跨层串行，按需构建专属研发调查流水线。',
    gradient: 'from-blue-500 to-cyan-400',
    glowColor: 'rgba(66, 133, 244, 0.15)',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    borderAccent: 'group-hover:border-blue-400/40',
  },
  {
    icon: BrainCircuit,
    title: '多模型供应商',
    desc: '内置 Gemini · DeepSeek · MiniMax · Moonshot，支持 OpenRouter · 硅基流动 · Together AI · Groq 等聚合平台。',
    gradient: 'from-violet-500 to-purple-400',
    glowColor: 'rgba(139, 92, 246, 0.15)',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-500',
    borderAccent: 'group-hover:border-violet-400/40',
  },
  {
    icon: Database,
    title: '7 大数据源',
    desc: 'OpenAlex · arXiv · CrossRef · Brave · SerpAPI · GitHub · 企业私有云 — 学术 + 产业 + 专利全域覆盖。',
    gradient: 'from-amber-500 to-orange-400',
    glowColor: 'rgba(245, 158, 11, 0.15)',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    borderAccent: 'group-hover:border-amber-400/40',
  },
  {
    icon: Shield,
    title: '私有化部署',
    desc: '完全隔离的企业实例 — 数据不写入公共数据库，合规审计友好，满足等保与内网安全要求。',
    gradient: 'from-emerald-500 to-teal-400',
    glowColor: 'rgba(16, 185, 129, 0.15)',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
    borderAccent: 'group-hover:border-emerald-400/40',
  },
];

/* ---------- 工作流预设数据 ---------- */

const WORKFLOW_PRESETS = [
  {
    id: 'quick-scan',
    name: '⚡ 快速扫描',
    desc: '2 Agent · 单层并行',
    detail: '速度优先，60 秒内完成初步趋势扫描和可行性评估',
    agents: ['趋势扫描员', '可行性检查员'],
    layers: 1,
    color: 'blue',
  },
  {
    id: 'standard',
    name: '📊 标准研究',
    desc: '4 Agent · 2 层编排',
    detail: '学术审查 + 产业分析 + 竞品侦探 → 创新评估，平衡速度与深度',
    agents: ['学术审查员', '产业分析员', '竞品侦探', '创新评估师'],
    layers: 2,
    color: 'violet',
  },
  {
    id: 'deep',
    name: '🔬 深度调查',
    desc: '6 Agent · 3 层编排',
    detail: '三维并行 → 交叉验证 → 终极综合，适合重大研发决策',
    agents: ['文献审查员', '市场分析师', '技术评估师', '交叉验证员', '竞品分析师', '综合评估师'],
    layers: 3,
    color: 'amber',
  },
  {
    id: 'competitor',
    name: '🎯 竞品专项',
    desc: '3 Agent · 2 层编排',
    detail: '竞争格局 + 差异化猎手 → 策略顾问，聚焦竞品分析',
    agents: ['格局分析师', '差异化猎手', '策略顾问'],
    layers: 2,
    color: 'emerald',
  },
];

/* ---------- 企业特性对比 ---------- */

const COMPARISON = [
  { feature: 'Agent 数量', free: '固定 4-6 个', biz: '自定义无上限' },
  { feature: '执行拓扑', free: '固定 2 层', biz: '自定义多层编排' },
  { feature: 'AI 模型', free: '平台指定', biz: '自选 + 自建模型' },
  { feature: '数据源', free: '公共数据源', biz: '公共 + 企业私有库' },
  { feature: '提示词', free: '系统预设', biz: '完全可编辑模板' },
  { feature: '部署方式', free: 'SaaS 共享', biz: '独立私有化部署' },
  { feature: '数据隔离', free: '公共数据库', biz: '完全独立存储' },
  { feature: '工作流预设', free: '无', biz: '4 种预设 + 自建' },
];

/* ---------- 架构层级 ---------- */

const ARCH_LAYERS = [
  {
    icon: Layers,
    title: '工作流层',
    desc: '可视化设计器 · 预设模板 · 拖拽编排',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200/60',
  },
  {
    icon: BrainCircuit,
    title: 'Agent 层',
    desc: '动态提示词注入 · Prompt 模板引擎 · 并行/串行编排',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
    border: 'border-violet-200/60',
  },
  {
    icon: Cpu,
    title: '模型层',
    desc: '多供应商路由 · 自动降级 · 速率限制 · 负载均衡',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200/60',
  },
  {
    icon: Database,
    title: '数据层',
    desc: '7 源聚合检索 · 企业私有库 · IndexedDB 本地缓存',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200/60',
  },
];

/* ===================================================================== */

export default function BusinessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50/30 to-white">
      {/* 导航栏 */}
      <Navbar />

      {/* ====== Hero ====== */}
      <section className="relative overflow-hidden">
        {/* 装饰光斑 */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-1/4 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center relative z-10">
          {/* 徽标 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase text-blue-500 bg-blue-50 px-4 py-1.5 rounded-full mb-6 border border-blue-100/60">
              <Building2 className="w-3.5 h-3.5" />
              Enterprise Edition
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-gray-900 leading-[1.15]"
          >
            为企业研发团队定制的
            <br />
            <span className="gradient-text-brand">垂直代理引擎</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-base sm:text-lg text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed"
          >
            Novoscan-Business — 私有化部署的多智能体研发调查引擎。
            <br className="hidden sm:block" />
            自定义 Agent 编排、模型供应商、数据源和工作流，让创新评估融入你的研发工作流。
          </motion.p>

          {/* CTA 按钮 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="mailto:zhouhaoyu6666@gmail.com?subject=Novoscan-Business 企业版咨询"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-900/10 transition-all duration-300 group"
            >
              <Mail className="w-4 h-4" />
              联系咨询
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full border border-gray-200 bg-white text-gray-700 font-bold text-sm hover:border-blue-300 hover:text-blue-600 hover:shadow-sm transition-all duration-300"
            >
              <Sparkles className="w-4 h-4" />
              体验免费版
            </Link>
          </motion.div>

          {/* 技术标签 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-2"
          >
            {['Next.js 14', 'Multi-Agent', 'Supabase', 'Gemini · DeepSeek', 'Private Deploy'].map((tag) => (
              <span key={tag} className="text-[11px] font-semibold text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </motion.div>

          {/* 工作流设计器演示图 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-14 max-w-4xl mx-auto"
          >
            <div className="relative rounded-2xl border border-gray-200/60 bg-white/95 shadow-xl shadow-gray-200/40 overflow-hidden group">
              {/* 标题栏模拟 */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-400/70" />
                  <span className="w-3 h-3 rounded-full bg-amber-400/70" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400/70" />
                </div>
                <span className="text-[11px] font-semibold text-gray-400 ml-2">Workflow Designer — 深度调查模式</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/workflow-designer-preview.png"
                alt="Novoscan-Business 工作流设计器预览"
                className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02]"
                loading="lazy"
              />
            </div>
            <p className="mt-4 text-xs text-gray-300 font-medium">
              ↑ 可视化工作流设计器 — 拖拽搭建专属 Agent 流水线
            </p>
          </motion.div>
        </div>
      </section>

      {/* ====== 核心能力 ====== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 relative z-10">
        <div className="text-center mb-12 sm:mb-16 animate-fade-in-up">
          <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-blue-500 bg-blue-50 px-4 py-1.5 rounded-full mb-4">
            Core Capabilities
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
            企业级核心能力
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-400 max-w-xl mx-auto font-medium">
            从模型到数据、从编排到部署，全链路为企业研发场景设计。
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {CORE_CAPABILITIES.map((cap, idx) => {
            const Icon = cap.icon;
            return (
              <div
                key={idx}
                className={`group relative p-6 sm:p-7 rounded-3xl border border-gray-100/80 bg-white/95 overflow-hidden cursor-default transition-all duration-300 hover:-translate-y-2 animate-stagger-in ${cap.borderAccent}`}
                style={{ animationDelay: `${0.1 + idx * 0.12}s` }}
              >
                <div
                  className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: cap.glowColor }}
                />
                <span className={`text-[11px] font-black tracking-widest bg-gradient-to-r ${cap.gradient} gradient-text-clip`}>
                  0{idx + 1}
                </span>
                <div className={`mt-4 w-12 h-12 rounded-2xl ${cap.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-6 h-6 ${cap.iconColor}`} strokeWidth={2} />
                </div>
                <h3 className="mt-5 text-base sm:text-lg font-extrabold text-gray-900 tracking-tight leading-snug">
                  {cap.title}
                </h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed font-medium">
                  {cap.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ====== 工作流预设 ====== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center mb-12 sm:mb-16 animate-fade-in-up">
          <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-violet-500 bg-violet-50 px-4 py-1.5 rounded-full mb-4">
            Workflow Presets
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
            4 种内置工作流，开箱即用
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-400 max-w-xl mx-auto font-medium">
            预设覆盖从快速扫描到深度调查的全场景，也可以从零搭建专属流水线。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {WORKFLOW_PRESETS.map((wf, idx) => {
            const colorMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
              blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200/60', dot: 'bg-blue-400' },
              violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200/60', dot: 'bg-violet-400' },
              amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200/60', dot: 'bg-amber-400' },
              emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200/60', dot: 'bg-emerald-400' },
            };
            const c = colorMap[wf.color] || colorMap.blue;

            return (
              <div
                key={wf.id}
                className="group relative p-6 sm:p-7 rounded-3xl border border-gray-100/80 bg-white/95 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-gray-200/40 animate-stagger-in"
                style={{ animationDelay: `${0.1 + idx * 0.1}s` }}
              >
                {/* 标题行 */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-gray-900">{wf.name}</h3>
                    <p className={`text-xs font-bold ${c.text} mt-1`}>{wf.desc}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-[11px] font-bold ${c.text} ${c.bg} px-3 py-1 rounded-full border ${c.border}`}>
                    <Layers className="w-3 h-3" />
                    {wf.layers} 层
                  </span>
                </div>

                {/* 描述 */}
                <p className="text-sm text-gray-400 font-medium mb-5">{wf.detail}</p>

                {/* Agent 标签 */}
                <div className="flex flex-wrap gap-2">
                  {wf.agents.map((agent) => (
                    <span key={agent} className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
                      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      {agent}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ====== 技术架构 ====== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center mb-12 sm:mb-16 animate-fade-in-up">
          <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-amber-500 bg-amber-50 px-4 py-1.5 rounded-full mb-4">
            Architecture
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
            四层分离架构
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-400 max-w-xl mx-auto font-medium">
            工作流 → Agent → 模型 → 数据，各层独立可替换，灵活适配不同企业技术栈。
          </p>
        </div>

        <div className="relative max-w-2xl mx-auto">
          {ARCH_LAYERS.map((layer, idx) => {
            const Icon = layer.icon;
            return (
              <div key={layer.title} className="relative">
                {/* 连接线 */}
                {idx < ARCH_LAYERS.length - 1 && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-px h-5 bg-gradient-to-b from-gray-200 to-transparent z-0" />
                )}
                <div
                  className={`relative z-10 flex items-center gap-5 p-5 sm:p-6 rounded-2xl border ${layer.border} ${layer.bg}/40 mb-5 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 animate-stagger-in`}
                  style={{ animationDelay: `${0.15 + idx * 0.1}s` }}
                >
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${layer.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${layer.color}`} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-gray-900">{layer.title}</h3>
                    <p className="text-sm text-gray-400 font-medium mt-0.5">{layer.desc}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 ml-auto flex-shrink-0 hidden sm:block" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ====== 企业版 vs 免费版 ====== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center mb-12 sm:mb-16 animate-fade-in-up">
          <span className="inline-block text-xs font-bold tracking-[0.2em] uppercase text-emerald-500 bg-emerald-50 px-4 py-1.5 rounded-full mb-4">
            Comparison
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
            企业版 vs 免费版
          </h2>
        </div>

        <div className="max-w-3xl mx-auto rounded-3xl border border-gray-100/80 bg-white/95 overflow-hidden">
          {/* 表头 */}
          <div className="grid grid-cols-3 bg-gray-50/80 border-b border-gray-100 px-6 py-4">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Feature</span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Novoscan</span>
            <span className="text-xs font-bold text-blue-500 uppercase tracking-wider text-center">Business</span>
          </div>
          {/* 行 */}
          {COMPARISON.map((row, idx) => (
            <div
              key={row.feature}
              className={`grid grid-cols-3 px-6 py-4 ${idx < COMPARISON.length - 1 ? 'border-b border-gray-50' : ''} hover:bg-blue-50/20 transition-colors`}
            >
              <span className="text-sm font-semibold text-gray-700">{row.feature}</span>
              <span className="text-sm text-gray-400 text-center">{row.free}</span>
              <span className="text-sm font-semibold text-gray-900 text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                {row.biz}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ====== 底部 CTA ====== */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="relative rounded-3xl border border-gray-100/80 bg-white/95 p-10 sm:p-16 text-center overflow-hidden">
          {/* 装饰 */}
          <div className="absolute top-0 left-1/3 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-gray-900 text-white text-xs font-bold px-4 py-1.5 rounded-full mb-6">
              <Building2 className="w-3.5 h-3.5" />
              Novoscan-Business
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight mb-4">
              让创新评估融入企业研发工作流
            </h2>
            <p className="text-sm sm:text-base text-gray-400 font-medium max-w-xl mx-auto mb-10">
              定制专属 Agent 团队，接入企业私有知识库，打造内部研发智能分析能力。
              <br />
              联系我们获取部署方案和报价。
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="mailto:zhouhaoyu6666@gmail.com?subject=Novoscan-Business 企业版咨询"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-900/10 transition-all duration-300 group"
              >
                <Mail className="w-4 h-4" />
                发送邮件咨询
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-blue-500 transition-colors"
              >
                ← 返回 Novoscan 首页
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter language="zh" />
    </div>
  );
}
