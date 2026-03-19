'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch,
  FlaskConical,
  ArrowRight,
  Sparkles,
  Zap,
  Puzzle,
  Layers,
  X,
  Lightbulb,
  Settings,
  ChevronRight,
} from 'lucide-react';
import WorkspaceShell from '@/components/layout/WorkspaceShell';

/* ===================================================================
 * Studio 页面 — 对标 Dify Studio
 *
 * 开源版的 Studio 是"构建与测试"的入口：
 *   - 工作流编辑器：可视化拖拽构建 AI 分析流程
 *   - Agent 实验室：单独测试插件 Agent 的 Playground
 * =================================================================== */

interface StudioCard {
  href: string;
  icon: React.FC<{ className?: string }>;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  gradient: string;
  iconBg: string;
  iconColor: string;
  badge?: string;
}

const studioCards: StudioCard[] = [
  {
    href: '/workflow',
    icon: GitBranch,
    title: '工作流编辑器',
    titleEn: 'Workflow Editor',
    description: '可视化拖拽构建 AI 分析流程。串联多个 Agent 节点，配置条件分支、并行执行和重试策略。',
    descriptionEn: 'Build AI analysis pipelines visually. Drag & drop Agent nodes, configure conditions, parallel execution, and retry strategies.',
    gradient: 'from-cyan-500/10 to-blue-500/10',
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-500 dark:text-cyan-400',
    badge: 'React Flow',
  },
  {
    href: '/playground',
    icon: FlaskConical,
    title: 'Agent 实验室',
    titleEn: 'Agent Playground',
    description: '单独测试插件 Agent，实时查看分析输出和评分。支持 Patent Scout、GitHub Trends、arXiv Scanner。',
    descriptionEn: 'Test plugin Agents individually. View analysis output and scores in real-time.',
    gradient: 'from-purple-500/10 to-pink-500/10',
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-purple-500 dark:text-purple-400',
    badge: 'Plugin SDK',
  },
];

/* 快速入口卡片 */
const quickLinks = [
  {
    href: '/marketplace',
    icon: Puzzle,
    label: '浏览插件',
    labelEn: 'Browse Plugins',
    color: 'text-amber-500',
  },
  {
    href: '/community',
    icon: Layers,
    label: '社区模板',
    labelEn: 'Community Templates',
    color: 'text-emerald-500',
  },
];

/* ===== 新手引导步骤 ===== */
const GUIDE_STEPS = [
  {
    icon: Sparkles,
    title: '选择工具',
    desc: '从下方卡片进入「工作流编辑器」或「Agent 实验室」开始探索',
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10',
  },
  {
    icon: Puzzle,
    title: '发现插件',
    desc: '前往「插件市场」浏览和安装社区贡献的分析插件',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Settings,
    title: '个性配置',
    desc: '侧边栏底部「设置」可配置 AI 模型偏好、语言和通知渠道',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
];

const GUIDE_STORAGE_KEY = 'novoscan-studio-guide-dismissed';

export default function StudioPage() {
  const [guideDismissed, setGuideDismissed] = useState(true); // 默认隐藏，避免 SSR 闪烁

  useEffect(() => {
    const dismissed = localStorage.getItem(GUIDE_STORAGE_KEY);
    if (dismissed !== 'true') {
      setGuideDismissed(false);
    }
  }, []);

  const dismissGuide = () => {
    setGuideDismissed(true);
    localStorage.setItem(GUIDE_STORAGE_KEY, 'true');
  };

  return (
    <WorkspaceShell>
      <div className="min-h-screen">
        {/* 渐变背景装饰 */}
        <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[var(--novo-accent-primary)]/5 rounded-full blur-[150px]" />
          <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {/* 页面标题 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center border border-purple-500/20">
                <Sparkles className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              </div>
              <span className="text-[10px] font-bold text-purple-500 dark:text-purple-400 uppercase tracking-[0.2em]">
                Novoscan Studio
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[var(--novo-text-primary)] mb-2">
              构建与测试
            </h1>
            <p className="text-base text-[var(--novo-text-secondary)] max-w-2xl">
              可视化编排 AI 分析工作流、测试插件 Agent、探索社区模板。一切从这里开始。
            </p>
          </motion.div>

          {/* 新手引导横幅 */}
          <AnimatePresence>
            {!guideDismissed && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="relative p-5 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-500/5 via-cyan-500/5 to-amber-500/5">
                  {/* 关闭按钮 */}
                  <button
                    onClick={dismissGuide}
                    className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--novo-text-muted)] hover:text-[var(--novo-text-primary)] hover:bg-[var(--novo-bg-hover)] transition-colors"
                    aria-label="关闭引导"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-4.5 h-4.5 text-amber-500" />
                    <span className="text-sm font-bold text-[var(--novo-text-primary)]">
                      🎉 欢迎来到 Studio！快速上手 →
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    {GUIDE_STEPS.map((step, i) => {
                      const Icon = step.icon;
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 rounded-xl bg-[var(--novo-bg-surface)]/60 border border-[var(--novo-border-default)]"
                        >
                          <div className={`w-8 h-8 rounded-lg ${step.bg} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${step.color}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[var(--novo-text-primary)] mb-0.5">
                              <span className="text-[var(--novo-text-muted)] mr-1.5">{i + 1}.</span>
                              {step.title}
                            </div>
                            <div className="text-[11px] text-[var(--novo-text-muted)] leading-relaxed">
                              {step.desc}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 快速跳转到设置 */}
                  <div className="mt-3 flex items-center justify-end">
                    <Link
                      href="/profile"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-500 hover:text-purple-400 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      前往设置
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 核心入口卡片 */}
          <div className="grid md:grid-cols-2 gap-5 mb-10">
            {studioCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Link
                    href={card.href}
                    className={`group block p-6 rounded-2xl border border-[var(--novo-border-default)] bg-gradient-to-br ${card.gradient} hover:border-[var(--novo-border-strong)] hover:shadow-[var(--novo-shadow-lg)] transition-all duration-300`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                        <Icon className={`w-6 h-6 ${card.iconColor}`} />
                      </div>
                      {card.badge && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-[var(--novo-border-default)] text-[var(--novo-text-muted)] bg-[var(--novo-bg-surface)]">
                          {card.badge}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-[var(--novo-text-primary)] mb-2 group-hover:text-[var(--novo-accent-primary)] transition-colors">
                      {card.title}
                    </h2>
                    <p className="text-sm text-[var(--novo-text-secondary)] leading-relaxed mb-4">
                      {card.description}
                    </p>
                    <div className="flex items-center text-sm font-semibold text-[var(--novo-accent-primary)] group-hover:gap-3 gap-2 transition-all">
                      进入
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* 快速入口 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h3 className="text-sm font-bold text-[var(--novo-text-muted)] uppercase tracking-widest mb-4">
              快速入口
            </h3>
            <div className="flex flex-wrap gap-3">
              {quickLinks.map(link => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--novo-border-default)] bg-[var(--novo-bg-surface)] hover:border-[var(--novo-border-strong)] hover:shadow-[var(--novo-shadow-sm)] transition-all duration-200 text-sm font-medium text-[var(--novo-text-secondary)] hover:text-[var(--novo-text-primary)]"
                  >
                    <Icon className={`w-4 h-4 ${link.color}`} />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>

          {/* Studio 特性说明 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 grid sm:grid-cols-3 gap-4"
          >
            {[
              {
                icon: Zap,
                title: 'DAG 引擎',
                desc: '拓扑排序 + 按层并行执行',
                color: 'text-amber-500',
              },
              {
                icon: GitBranch,
                title: 'SSE 实时推送',
                desc: 'NDJSON 流式状态更新',
                color: 'text-cyan-500',
              },
              {
                icon: Puzzle,
                title: '插件 SDK',
                desc: 'INovoAgent 标准化接口',
                color: 'text-purple-500',
              },
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="p-4 rounded-xl border border-[var(--novo-border-default)] bg-[var(--novo-bg-surface)]"
                >
                  <Icon className={`w-5 h-5 ${feature.color} mb-2`} />
                  <div className="text-sm font-bold text-[var(--novo-text-primary)] mb-1">{feature.title}</div>
                  <div className="text-xs text-[var(--novo-text-muted)]">{feature.desc}</div>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
