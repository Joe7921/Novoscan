'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Loader2, Terminal, ChevronDown, Copy, Check,
  Sparkles, Clock, Zap, Code2, Puzzle, RotateCcw, FlaskConical
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import BottomTabBar from '@/components/layout/BottomTabBar';
import type { Language } from '@/types';

/* ============================================================
   预设示例查询
   ============================================================ */

const EXAMPLE_QUERIES = [
  {
    label: '🔋 固态电池技术',
    query: '基于硫化物固态电解质的全固态锂电池技术',
    labelEn: '🔋 Solid-State Battery',
    queryEn: 'Sulfide-based solid electrolyte all-solid-state lithium battery technology',
  },
  {
    label: '💊 AI 药物发现',
    query: '利用图神经网络进行蛋白质-药物相互作用预测的AI药物发现引擎',
    labelEn: '💊 AI Drug Discovery',
    queryEn: 'AI drug discovery engine using graph neural networks for protein-drug interaction prediction',
  },
  {
    label: '🔐 量子加密通信',
    query: '基于量子密钥分发的城域级安全通信网络方案',
    labelEn: '🔐 Quantum Encryption',
    queryEn: 'Metropolitan-scale secure communication network based on quantum key distribution',
  },
];

/* ============================================================
   插件 Agent 元信息（前端静态展示）
   ============================================================ */

interface AgentMeta {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  category: string;
}

const AVAILABLE_AGENTS: AgentMeta[] = [
  { id: 'patent-scout', name: '专利侦察兵', nameEn: 'Patent Scout', icon: '📜', description: '搜索全球专利数据库，评估创新点与已有专利的重叠度', category: 'specialized' },
  { id: 'github-trends', name: 'GitHub 趋势分析师', nameEn: 'GitHub Trends Analyst', icon: '📈', description: '分析 GitHub 开源生态中的技术趋势和竞争态势', category: 'industry' },
  { id: 'arxiv-scanner', name: 'arXiv 论文扫描仪', nameEn: 'arXiv Scanner', icon: '🔬', description: '扫描 arXiv 前沿论文，评估学术领域热度和创新空间', category: 'academic' },
];

/* ============================================================
   Playground API 调用
   ============================================================ */

interface PlaygroundResult {
  agentName: string;
  analysis: string;
  score: number;
  confidence: string;
  confidenceReasoning: string;
  keyFindings: string[];
  redFlags: string[];
  dimensionScores: Array<{ name: string; score: number; reasoning: string }>;
  durationMs: number;
}

async function runAgent(agentId: string, query: string): Promise<PlaygroundResult> {
  const response = await fetch('/api/playground/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, query }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/* ============================================================
   类别标签颜色
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
   主组件
   ============================================================ */

export default function PlaygroundPage() {
  const [language] = useState<Language>('zh');
  const [selectedAgent, setSelectedAgent] = useState<string>(AVAILABLE_AGENTS[0].id);
  const [query, setQuery] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const currentAgent = AVAILABLE_AGENTS.find(a => a.id === selectedAgent) || AVAILABLE_AGENTS[0];

  // 自动滚动日志
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
  }, []);

  const handleRun = useCallback(async () => {
    if (!query.trim() || isRunning) return;

    setIsRunning(true);
    setResult(null);
    setError(null);
    setLogs([]);

    addLog(`🚀 启动 Agent: ${currentAgent.icon} ${currentAgent.name}`);
    addLog(`📝 查询: "${query.slice(0, 50)}${query.length > 50 ? '...' : ''}"`);
    addLog(`⏳ 正在执行分析...`);

    const startTime = Date.now();

    try {
      const res = await runAgent(selectedAgent, query);
      const duration = Date.now() - startTime;

      addLog(`✅ 分析完成 — 耗时 ${duration}ms`);
      addLog(`📊 综合评分: ${res.score}/100 | 置信度: ${res.confidence}`);
      addLog(`🔍 关键发现: ${res.keyFindings.length} 条`);
      if (res.redFlags.length > 0) {
        addLog(`⚠️ 红旗警告: ${res.redFlags.length} 条`);
      }

      setResult({ ...res, durationMs: duration });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ 执行失败: ${msg}`);
      setError(msg);
    } finally {
      setIsRunning(false);
    }
  }, [query, selectedAgent, currentAgent, isRunning, addLog]);

  const handleCopyResult = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleExampleClick = useCallback((q: string) => {
    setQuery(q);
    setResult(null);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 flex flex-col" style={{ overflowX: 'clip' }}>
      {/* 背景装饰 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-emerald-600/3 rounded-full blur-[120px]" />
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
                <FlaskConical className="w-4.5 h-4.5 text-purple-400" />
              </div>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em]">Agent Playground</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1">
              🧩 插件实验室
            </h1>
            <p className="text-sm text-gray-500 max-w-xl">
              在这里测试你的 Agent 插件。选择一个 Agent → 输入创意 → 实时查看分析输出。
            </p>
          </motion.div>
        </div>

        {/* 双栏布局 */}
        <div className="grid lg:grid-cols-2 gap-5">

          {/* ===== 左栏：输入面板 ===== */}
          <div className="space-y-4">

            {/* Agent 选择器 */}
            <div className="bg-[#111118] rounded-2xl border border-gray-800/80 p-4">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                <Puzzle className="w-3.5 h-3.5" />
                选择 Agent
              </div>

              {/* Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsAgentDropdownOpen(!isAgentDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#0d0d14] rounded-xl border border-gray-700/50 hover:border-purple-500/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{currentAgent.icon}</span>
                    <div>
                      <div className="text-sm font-bold text-white">{currentAgent.name}</div>
                      <div className="text-[11px] text-gray-500">{currentAgent.nameEn}</div>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isAgentDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isAgentDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute w-full mt-1 bg-[#14141e] rounded-xl border border-gray-700/60 shadow-2xl z-20 overflow-hidden"
                    >
                      {AVAILABLE_AGENTS.map(agent => (
                        <button
                          key={agent.id}
                          onClick={() => { setSelectedAgent(agent.id); setIsAgentDropdownOpen(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            agent.id === selectedAgent ? 'bg-purple-500/10' : 'hover:bg-white/5'
                          }`}
                        >
                          <span className="text-lg">{agent.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white">{agent.name}</div>
                            <div className="text-[11px] text-gray-500 truncate">{agent.description}</div>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getCategoryStyle(agent.category)}`}>
                            {agent.category}
                          </span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* 输入框 */}
            <div className="bg-[#111118] rounded-2xl border border-gray-800/80 p-4">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                输入创意
              </div>

              <textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="描述你的创新想法..."
                rows={4}
                className="w-full bg-[#0d0d14] rounded-xl border border-gray-700/50 px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 resize-none font-mono transition-colors"
              />

              {/* 示例按钮 */}
              <div className="flex flex-wrap gap-2 mt-3">
                {EXAMPLE_QUERIES.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => handleExampleClick(ex.query)}
                    className="text-[11px] font-medium text-gray-400 bg-[#0d0d14] hover:bg-purple-500/10 hover:text-purple-300 border border-gray-700/40 hover:border-purple-500/30 rounded-lg px-2.5 py-1.5 transition-all"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>

              {/* 运行按钮 */}
              <button
                onClick={handleRun}
                disabled={!query.trim() || isRunning}
                className={`w-full mt-4 flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
                  !query.trim() || isRunning
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-lg shadow-purple-500/20 active:scale-[0.98]'
                }`}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    执行中...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    运行 Agent
                  </>
                )}
              </button>
            </div>

            {/* 日志面板 */}
            <div className="bg-[#111118] rounded-2xl border border-gray-800/80 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5" />
                  执行日志
                </div>
                {logs.length > 0 && (
                  <button onClick={() => setLogs([])} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" />
                    清空
                  </button>
                )}
              </div>
              <div
                ref={logRef}
                className="bg-[#0a0a0f] rounded-xl border border-gray-800/40 p-3 h-36 overflow-y-auto font-mono text-[11px] leading-relaxed custom-scrollbar"
              >
                {logs.length === 0 ? (
                  <div className="text-gray-700 italic">等待执行...</div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="text-gray-400">
                      <span className="text-gray-600">{log.slice(0, 12)}</span>
                      <span>{log.slice(12)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ===== 右栏：输出面板 ===== */}
          <div className="bg-[#111118] rounded-2xl border border-gray-800/80 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5" />
                分析输出
              </div>
              {result && (
                <button
                  onClick={handleCopyResult}
                  className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? '已复制' : '复制 JSON'}
                </button>
              )}
            </div>

            <div className="flex-1 min-h-[400px] overflow-y-auto custom-scrollbar">
              <AnimatePresence mode="wait">
                {isRunning ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full py-20"
                  >
                    <div className="relative">
                      <div className="w-16 h-16 border-2 border-purple-500/20 rounded-full" />
                      <div className="absolute inset-0 w-16 h-16 border-2 border-transparent border-t-purple-500 rounded-full animate-spin" />
                      <div className="absolute inset-2 w-12 h-12 border-2 border-transparent border-b-cyan-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                    </div>
                    <p className="text-sm text-gray-500 mt-4 font-medium">Agent 正在分析中...</p>
                  </motion.div>
                ) : error ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mt-2"
                  >
                    <div className="text-sm font-bold text-red-400 mb-1">❌ 执行失败</div>
                    <div className="text-xs text-red-300/70 font-mono">{error}</div>
                  </motion.div>
                ) : result ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    {/* 评分卡片 */}
                    <div className="bg-[#0d0d14] rounded-xl border border-gray-800/40 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-lg font-black text-white">{result.agentName}</div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500">
                          <Clock className="w-3 h-3" />
                          {result.durationMs}ms
                        </div>
                      </div>
                      <div className="flex items-baseline gap-4">
                        <div>
                          <span className="text-4xl font-black text-white">{result.score}</span>
                          <span className="text-lg text-gray-500 font-bold">/100</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          result.confidence === 'high' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          result.confidence === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {result.confidence} confidence
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">{result.confidenceReasoning}</div>
                    </div>

                    {/* 多维评分 */}
                    {result.dimensionScores.length > 0 && (
                      <div className="bg-[#0d0d14] rounded-xl border border-gray-800/40 p-4">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">多维评分</div>
                        <div className="space-y-3">
                          {result.dimensionScores.map((dim, i) => (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-gray-300">{dim.name}</span>
                                <span className="text-xs font-bold text-white">{dim.score}</span>
                              </div>
                              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${dim.score}%` }}
                                  transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                                  className="h-full rounded-full"
                                  style={{
                                    background: `linear-gradient(90deg, ${
                                      dim.score >= 70 ? '#22c55e' : dim.score >= 40 ? '#eab308' : '#ef4444'
                                    }, ${
                                      dim.score >= 70 ? '#06b6d4' : dim.score >= 40 ? '#f59e0b' : '#f87171'
                                    })`,
                                  }}
                                />
                              </div>
                              <div className="text-[10px] text-gray-600 mt-0.5">{dim.reasoning}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 关键发现 */}
                    {result.keyFindings.length > 0 && (
                      <div className="bg-[#0d0d14] rounded-xl border border-gray-800/40 p-4">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3">🔍 关键发现</div>
                        <ul className="space-y-1.5">
                          {result.keyFindings.map((f, i) => (
                            <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                              <span className="text-purple-400 mt-0.5">•</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 红旗 */}
                    {result.redFlags.length > 0 && (
                      <div className="bg-red-500/3 rounded-xl border border-red-500/15 p-4">
                        <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-3">🚩 风险警告</div>
                        <ul className="space-y-1.5">
                          {result.redFlags.map((f, i) => (
                            <li key={i} className="text-xs text-red-300/80">{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 原始 JSON（可折叠） */}
                    <details className="group">
                      <summary className="text-[10px] font-bold text-gray-600 uppercase tracking-wider cursor-pointer hover:text-gray-400 transition-colors flex items-center gap-1.5 py-2">
                        <Code2 className="w-3 h-3" />
                        查看原始 JSON
                        <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                      </summary>
                      <pre className="bg-[#0a0a0f] rounded-xl border border-gray-800/40 p-3 text-[10px] text-gray-500 overflow-x-auto font-mono leading-relaxed max-h-60 overflow-y-auto custom-scrollbar">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </details>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full py-20 text-center"
                  >
                    <div className="w-16 h-16 bg-gray-800/50 rounded-2xl flex items-center justify-center mb-4 border border-gray-700/30">
                      <Zap className="w-7 h-7 text-gray-600" />
                    </div>
                    <p className="text-sm font-bold text-gray-500 mb-1">等待输出</p>
                    <p className="text-[11px] text-gray-600 max-w-[200px]">
                      选择一个 Agent，输入你的创意，点击「运行」查看结果
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      <BottomTabBar />
    </div>
  );
}
