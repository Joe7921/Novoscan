'use client';

/**
 * PlaygroundHome — 极简首页 Playground
 *
 * 设计理念：首页就是工作台
 * - 居中极简输入框，直接进入分析
 * - 工作流快捷入口，一键切换当前工作流
 * - 紧凑模型选择 + 模式/隐私切换
 * - 底部快捷导航
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, FlaskConical, Workflow, BookOpen,
  ChevronRight, Check, Sparkles, ShieldCheck, ShieldOff
} from 'lucide-react';
import InnovationAutocomplete from '@/components/innovation/InnovationAutocomplete';
import FlashModeToggle from '@/components/home/FlashModeToggle';
import { MODEL_OPTIONS } from '@/types';
import type { Language, ModelProvider, ScanMode } from '@/types';

/* ============================================================
   工作流预设信息（与 validator.ts 的 listPresets 对应）
   ============================================================ */
interface WorkflowChip {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  nodeCount: number;
  estimatedDuration?: string;
  isCustom?: boolean;
}

/** 内置预设静态列表（避免服务端依赖） */
const BUILTIN_PRESETS: WorkflowChip[] = [
  {
    id: 'novoscan-default',
    name: '默认管线',
    nameEn: 'Default Pipeline',
    icon: '🚀',
    description: '完整的七源双轨多 Agent 分析管线',
    nodeCount: 10,
    estimatedDuration: '3-6 分钟',
  },
  {
    id: 'quick-academic',
    name: '快速学术',
    nameEn: 'Quick Academic',
    icon: '📚',
    description: '精简学术检索 + 快速评估',
    nodeCount: 5,
    estimatedDuration: '1-2 分钟',
  },
  {
    id: 'minimal',
    name: '极简模式',
    nameEn: 'Minimal',
    icon: '⚡',
    description: '最快速的单 Agent 分析',
    nodeCount: 3,
    estimatedDuration: '30-60 秒',
  },
  {
    id: 'forced-debate',
    name: '强制辩论',
    nameEn: 'Forced Debate',
    icon: '⚔️',
    description: '强制触发多轮对抗辩论',
    nodeCount: 7,
    estimatedDuration: '4-8 分钟',
  },
  {
    id: 'industry-focus',
    name: '产业聚焦',
    nameEn: 'Industry Focus',
    icon: '🏭',
    description: '侧重产业信号和商业可行性',
    nodeCount: 5,
    estimatedDuration: '2-4 分钟',
  },
];

const ACTIVE_WORKFLOW_KEY = 'novoscan_active_workflow';
const CUSTOM_WORKFLOWS_KEY = 'novoscan_custom_workflows';

/* ============================================================
   快捷导航项
   ============================================================ */
const QUICK_LINKS = [
  { href: '/studio', icon: FlaskConical, label: 'Studio', labelZh: 'Studio' },
  { href: '/workflow', icon: Workflow, label: 'Workflows', labelZh: '工作流' },
  { href: '/docs', icon: BookOpen, label: 'Docs', labelZh: '文档' },
];

/* ============================================================
   Props
   ============================================================ */
interface PlaygroundHomeProps {
  idea: string;
  setIdea: (v: string) => void;
  handleAnalyze: () => void;
  scanMode: ScanMode;
  onScanModeChange: (mode: ScanMode) => void;
  isPrivateMode: boolean;
  onPrivacyToggle: () => void;
  selectedModel: ModelProvider;
  setSelectedModel: (m: ModelProvider) => void;
  language: Language;
  error: string | null;
}

/* ============================================================
   主组件
   ============================================================ */
export default function PlaygroundHome({
  idea,
  setIdea,
  handleAnalyze,
  scanMode,
  onScanModeChange,
  isPrivateMode,
  onPrivacyToggle,
  selectedModel,
  setSelectedModel,
  language,
  error,
}: PlaygroundHomeProps) {
  const isZh = language === 'zh';

  /* === 工作流状态 === */
  const [activeWorkflowId, setActiveWorkflowId] = useState('novoscan-default');
  const [customWorkflows, setCustomWorkflows] = useState<WorkflowChip[]>([]);
  const [hoveredWf, setHoveredWf] = useState<string | null>(null);

  // 从 localStorage 加载
  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_WORKFLOW_KEY);
    if (stored) setActiveWorkflowId(stored);

    const customs = localStorage.getItem(CUSTOM_WORKFLOWS_KEY);
    if (customs) {
      try {
        const parsed = JSON.parse(customs);
        setCustomWorkflows(
          parsed.map((c: Record<string, unknown>) => ({
            ...c,
            isCustom: true,
          }))
        );
      } catch { /* ignore */ }
    }
  }, []);

  // 切换工作流
  const handleSelectWorkflow = useCallback((id: string) => {
    setActiveWorkflowId(id);
    localStorage.setItem(ACTIVE_WORKFLOW_KEY, id);
  }, []);

  const allWorkflows = [...BUILTIN_PRESETS, ...customWorkflows];
  const activeWorkflow = allWorkflows.find(w => w.id === activeWorkflowId) || BUILTIN_PRESETS[0];

  return (
    <div className="w-full min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4 sm:px-6 relative">
      {/* 背景光斑 */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-30 dark:opacity-20"
          style={{
            background: 'radial-gradient(ellipse, rgba(66,133,244,0.15) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* ===== 主内容区 ===== */}
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-8 sm:gap-10">

        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-gray-900 dark:text-white mb-2">
            {isZh ? '开始分析' : 'Start Analysis'}
          </h1>
          <p className="text-sm sm:text-base text-gray-400 dark:text-slate-500 font-medium">
            {isZh
              ? '输入你的创新想法，AI 多智能体即刻评估'
              : 'Describe your innovation, AI multi-agents evaluate instantly'}
          </p>
        </motion.div>

        {/* ===== 输入区 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full"
        >
          <div
            className="w-full bg-white/80 dark:bg-dark-surface/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl
              border border-gray-200/60 dark:border-slate-700/50
              shadow-[0_8px_32px_rgba(31,38,135,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.2)]
              transition-all duration-300
              focus-within:shadow-[0_12px_40px_rgba(31,38,135,0.15)] focus-within:border-gray-300/80
              dark:focus-within:shadow-[0_12px_40px_rgba(0,0,0,0.4)] dark:focus-within:border-slate-600/50
              overflow-hidden"
          >
            <div className="pb-14 sm:pb-12">
              <InnovationAutocomplete
                value={idea}
                onChange={setIdea}
                onSubmit={handleAnalyze}
                placeholder={isZh ? '描述你的创新想法...' : 'Describe your innovation idea...'}
                language={language}
              />
            </div>

            {/* 底部控件栏 */}
            <div className="absolute bottom-0 left-0 right-0 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 border-t border-gray-100/50 dark:border-slate-800/50 bg-gray-50/50 dark:bg-dark-surface/30">
              <div className="flex items-center gap-2">
                <FlashModeToggle scanMode={scanMode} onModeChange={onScanModeChange} language={language} />
                <button
                  onClick={onPrivacyToggle}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border ${
                    isPrivateMode
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                      : 'bg-white/80 dark:bg-dark-surface/40 text-gray-400 dark:text-slate-500 border-gray-200/60 dark:border-slate-700/40 hover:text-gray-600 dark:hover:text-slate-300'
                  }`}
                  title={isZh ? (isPrivateMode ? '隐私模式已开启' : '开启隐私模式') : (isPrivateMode ? 'Privacy On' : 'Privacy Off')}
                >
                  {isPrivateMode ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!idea.trim()}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${
                  idea.trim()
                    ? 'bg-gradient-to-r from-[#2563eb] to-[#7c3aed] text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.97]'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600 cursor-not-allowed'
                }`}
              >
                <Search className={`w-4 h-4 ${idea.trim() ? 'animate-pulse' : ''}`} />
                {isZh ? '分析' : 'Analyze'}
              </button>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mt-3 px-4 py-2.5 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 rounded-xl text-sm font-medium border border-red-100 dark:border-red-500/20">
              {error}
            </div>
          )}
        </motion.div>

        {/* ===== 工作流快捷入口 ===== */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gray-200/60 dark:bg-slate-700/40" />
            <span className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5 px-2">
              <Sparkles className="w-3 h-3" />
              {isZh ? '工作流' : 'Workflows'}
            </span>
            <div className="h-px flex-1 bg-gray-200/60 dark:bg-slate-700/40" />
          </div>

          {/* 工作流 chips */}
          <div className="flex flex-wrap justify-center gap-2">
            {allWorkflows.map(wf => {
              const isActive = wf.id === activeWorkflowId;
              return (
                <div key={wf.id} className="relative">
                  <button
                    onClick={() => handleSelectWorkflow(wf.id)}
                    onMouseEnter={() => setHoveredWf(wf.id)}
                    onMouseLeave={() => setHoveredWf(null)}
                    className={`
                      group flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold
                      transition-all duration-200 border cursor-pointer
                      ${isActive
                        ? 'bg-gradient-to-r from-[#2563eb]/10 to-[#7c3aed]/10 dark:from-blue-500/15 dark:to-violet-500/15 border-[#2563eb]/30 dark:border-blue-500/30 text-[#2563eb] dark:text-blue-400 shadow-sm'
                        : 'bg-white/60 dark:bg-dark-surface/40 border-gray-200/60 dark:border-slate-700/40 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-dark-surface/60'
                      }
                    `}
                  >
                    <span className="text-base">{wf.icon}</span>
                    <span>{isZh ? wf.name : wf.nameEn}</span>
                    {isActive && <Check className="w-3 h-3 ml-0.5" />}
                    {wf.isCustom && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/15 text-violet-500 dark:text-violet-400 ml-0.5">
                        {isZh ? '自定义' : 'Custom'}
                      </span>
                    )}
                  </button>

                  {/* 悬浮 tooltip */}
                  <AnimatePresence>
                    {hoveredWf === wf.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-56 p-3 bg-white dark:bg-dark-elevated rounded-xl shadow-xl border border-gray-200/80 dark:border-slate-700 pointer-events-none"
                      >
                        <div className="text-xs font-bold text-gray-800 dark:text-slate-200 mb-1">{wf.name}</div>
                        <div className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">{wf.description}</div>
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                          <span>🔗 {wf.nodeCount} 节点</span>
                          {wf.estimatedDuration && <span>⏱️ {wf.estimatedDuration}</span>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* 管理更多 */}
            <Link
              href="/workflow"
              className="flex items-center gap-1 px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 border border-dashed border-gray-200/60 dark:border-slate-700/40 hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-200"
            >
              <ChevronRight className="w-3 h-3" />
              {isZh ? '管理' : 'Manage'}
            </Link>
          </div>

          {/* 当前激活提示 */}
          <div className="text-center mt-3">
            <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
              {isZh ? '当前使用：' : 'Active: '}
              <span className="font-bold text-gray-500 dark:text-slate-400">
                {activeWorkflow.icon} {isZh ? activeWorkflow.name : activeWorkflow.nameEn}
              </span>
            </span>
          </div>
        </motion.div>

        {/* ===== 模型选择 ===== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3"
        >
          <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            Model
          </span>
          <div className="flex items-center bg-gray-100/80 dark:bg-dark-surface/60 p-1 rounded-full border border-gray-200/60 dark:border-slate-700/40">
            {MODEL_OPTIONS.map(option => {
              const isActive = selectedModel === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => setSelectedModel(option.id)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? 'bg-white dark:bg-dark-elevated text-gray-900 dark:text-slate-100 shadow-sm border border-gray-200/60 dark:border-slate-600'
                      : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
                  }`}
                >
                  {isActive && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                  )}
                  {option.name}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ===== 快捷导航 ===== */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex items-center justify-center gap-3 sm:gap-4 pt-4"
        >
          {QUICK_LINKS.map(link => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100/60 dark:hover:bg-dark-surface/40 transition-all duration-200 border border-transparent hover:border-gray-200/60 dark:hover:border-slate-700/40"
              >
                <Icon className="w-4 h-4" />
                {isZh ? link.labelZh : link.label}
              </Link>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
