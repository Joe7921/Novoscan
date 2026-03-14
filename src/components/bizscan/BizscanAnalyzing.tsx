'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Lightbulb, Globe, BarChart3, ShieldCheck, Activity,
    Terminal, ChevronDown, ChevronUp, Scale, Sparkles,
    Search, TrendingUp, Eye, Cpu
} from 'lucide-react';

/* ────────────────────────────── 类型定义 ────────────────────────────── */

interface BizscanAnalyzingProps {
    idea: string;
    isDataReady: boolean;
    onComplete: () => void;
    /** SSE 推送的真实进度百分比 (0-100) */
    sseProgress?: number;
    /** SSE 推送的真实日志条目 */
    sseLogs?: string[];
    /** SSE 推送的真实统计数据 */
    sseStats?: {
        sourcesScanned?: number;
        competitorsFound?: number;
    };
}

/* ────────────────────────────── 阶段 & Agent 配置 ────────────────────────────── */

const STEPS = [
    {
        icon: Lightbulb, hex: '#F59E0B',
        title: '要素提取 + 数据采集', desc: '解析商业想法核心要素 · 全网信号扫描',
    },
    {
        icon: Globe, hex: '#4285F4',
        title: 'L1: 市场 + 竞品侦查', desc: '并行启动双 Agent 深度扫描市场与竞品态势',
    },
    {
        icon: ShieldCheck, hex: '#EA4335',
        title: 'L2: 创新 + 可行性审计', desc: 'Devil\'s Advocate 交叉质疑 · CTO 技术论证',
    },
    {
        icon: Scale, hex: '#34A853',
        title: 'L3-5: 交叉验证 + 仲裁', desc: '检测分歧 · 校准评分 · 生成最终 BII 报告',
    },
];

const AGENTS = [
    {
        id: 'market', icon: Search, color: '#4285F4',
        name: '市场侦察员', desc: '扫描全网信号评估市场规模与趋势',
        backendTag: 'L1',
    },
    {
        id: 'competitor', icon: TrendingUp, color: '#FBBC05',
        name: '竞品探测器', desc: '深层对比竞品矩阵和融资信号',
        backendTag: 'L1',
    },
    {
        id: 'novelty', icon: Eye, color: '#EA4335',
        name: '创新审计师', desc: 'Devil\'s Advocate 交叉验证新颖度',
        backendTag: 'L2',
    },
    {
        id: 'feasibility', icon: Cpu, color: '#34A853',
        name: '可行性审查官', desc: 'CTO 视角技术 + 商业可行性评估',
        backendTag: 'L2',
    },
];

/* ────────────────────────────── 日志数据 ────────────────────────────── */

const BOOT_PHRASES = [
    '分配分析引擎算力...',
    '建立加密传输通道...',
    '挂载领域知识图谱...',
    '编译超级系统提示词...',
    '校验交叉引力模型...',
    '流式解析器就绪...',
    '加载上下文向量缓存...',
];

const AGENT_SEARCH_LOGS: Record<string, string[]> = {
    market: [
        '启动 Brave Search 市场雷达...',
        '调用 SerpAPI Google 搜索代理...',
        '扫描行业资讯与市场报告...',
        '解析网页正文与摘要片段...',
        '提取市场信号热度指数...',
        '分析 TAM / SAM / SOM 规模...',
        '检索企业官网和产品发布页...',
        '识别关键产业玩家分布...',
        '交叉验证产业落地信号...',
    ],
    competitor: [
        '连接竞品数据源...',
        '扫描 ProductHunt 产品列表...',
        '检索 GitHub 开源替代方案...',
        '分析竞品融资阶段...',
        '计算语义相似度矩阵...',
        '评估竞争威胁等级...',
        '抓取竞品功能 & 定价页...',
        '构建竞品差异化矩阵...',
        '筛选高威胁级竞争对手...',
    ],
    novelty: [
        '加载交叉质疑推理引擎...',
        '等待 Layer1 市场 + 竞品信号...',
        '编译 Devil\'s Advocate 模板...',
        '预热语义新颖度评分器...',
        '检测用户想法与已有方案重叠...',
        '分析差异化亮点强度...',
        '校验商业模式独特性...',
        '生成新颖度维度评分...',
        '准备交叉验证报告...',
    ],
    feasibility: [
        '加载 CTO 级技术评估框架...',
        '等待上游 Agent 检索数据...',
        '分析技术栈可行性...',
        '评估工程复杂度...',
        '检验商业模式可持续性...',
        '分析市场准入壁垒...',
        '计算首期 MVP 资源需求...',
        '生成可行性维度评分...',
        '汇总评审结论...',
    ],
};

const WAITING_LOGS = [
    '[Layer3] CrossValidator: 检测 4 份报告分歧度...',
    '[Layer3] CrossValidator: 校准评分 · 解决证据冲突...',
    '[Layer4] StrategicArbiter: 综合 6-Agent 共识...',
    '[Layer4] StrategicArbiter: 计算加权 BII 指数...',
    '[Layer5] QualityGuard: 执行一致性检查...',
    '生成战略建议 & 风险预警...',
];

/* ────────────────────────────── 子组件：Agent 终端面板 ────────────────────────────── */

const AgentTerminal = ({ agent, prog, done }: {
    agent: typeof AGENTS[number];
    prog: number;
    done: boolean;
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [bootLogs, setBootLogs] = useState<string[]>([]);
    const [mountedTime] = useState(Date.now());
    const [isCollapsed, setIsCollapsed] = useState(false);

    // 自动滚到底部
    useEffect(() => {
        if (scrollRef.current && !isCollapsed) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [bootLogs, isCollapsed]);

    // 启动日志生成
    useEffect(() => {
        if (done) return;
        const agentLogs = AGENT_SEARCH_LOGS[agent.id] || BOOT_PHRASES;
        const interval = setInterval(() => {
            setBootLogs(prev => {
                if (prev.length >= 20) return prev;
                const phrase = agentLogs[Math.floor(Math.random() * agentLogs.length)];
                const timeMs = (Date.now() - mountedTime) / 1000;
                return [...prev, `[${timeMs.toFixed(3)}s] ${phrase}`];
            });
        }, 300 + Math.random() * 500);
        return () => clearInterval(interval);
    }, [done, mountedTime, agent.id]);

    const statusText = done
        ? '■ 任务完成'
        : prog > 0 ? '● 分析中...' : '○ 等待启动...';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="rounded-xl flex flex-col overflow-hidden relative"
            style={{
                background: '#ffffff',
                boxShadow: done
                    ? `0 0 20px ${agent.color}15, 0 4px 15px rgba(0,0,0,0.06)`
                    : '0 2px 12px rgba(0,0,0,0.06)',
                border: `1px solid ${done ? agent.color + '40' : '#e5e7eb'}`,
            }}
        >
            {/* 终端头部：macOS 三色圆点 + Agent 信息 */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center justify-between px-3 py-2 w-full cursor-pointer select-none"
                style={{
                    background: 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)',
                    borderBottom: '1px solid #e5e7eb',
                }}
            >
                <div className="flex items-center gap-2.5">
                    {/* macOS 三点 */}
                    <div className="flex items-center gap-1.5 mr-1">
                        <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: done ? '#34d058' : '#ff6b6b' }} />
                        <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#f9c74f' }} />
                        <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#52c41a' }} />
                    </div>
                    <div
                        className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${agent.color}15` }}
                    >
                        <agent.icon className="w-3.5 h-3.5" style={{ color: agent.color }} />
                    </div>
                    <span className="text-xs font-bold text-gray-700 font-mono">
                        {agent.name}
                    </span>
                    <span className="text-[9px] text-gray-400 hidden md:inline truncate max-w-[180px]">
                        {agent.desc}
                    </span>
                </div>
                <div className="flex items-center gap-2.5">
                    {/* 运行状态指示灯 */}
                    {!done && (
                        <motion.div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: agent.color }}
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                    )}
                    <span
                        className="text-[10px] font-mono font-bold tabular-nums"
                        style={{ color: done ? '#10b981' : agent.color }}
                    >
                        {done ? '100%' : `${prog}%`}
                    </span>
                    {isCollapsed
                        ? <ChevronDown className="w-3 h-3 text-gray-400" />
                        : <ChevronUp className="w-3 h-3 text-gray-400" />
                    }
                </div>
            </button>

            {/* 主体：终端内容 */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div
                            ref={scrollRef}
                            className="flex-1 px-3 py-2 h-36 md:h-44 overflow-y-auto text-[11px] md:text-xs leading-relaxed scroll-smooth font-mono"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', background: '#ffffff' }}
                        >
                            {/* 状态行 */}
                            <div className="flex items-center gap-2 mb-2 pb-1.5" style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <span className="text-[10px] font-mono" style={{ color: done ? '#10b981' : '#9ca3af' }}>
                                    {statusText}
                                </span>
                            </div>

                            {/* 日志内容 */}
                            <div className="flex flex-col gap-1">
                                {bootLogs.length === 0 ? (
                                    <span className="text-gray-400 animate-pulse">
                                        <span style={{ color: agent.color }}>$</span> 初始化 Agent 进程...
                                    </span>
                                ) : (
                                    <AnimatePresence>
                                        {bootLogs.map((log, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -6 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="text-[10px] tracking-tight flex items-start gap-1.5"
                                            >
                                                <span style={{ color: agent.color, flexShrink: 0 }}>›</span>
                                                <span className="text-gray-500">{log}</span>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </div>

                            {/* 打字光标 */}
                            {!done && (
                                <motion.span
                                    className="inline-block w-1.5 h-3 ml-1 align-middle mt-1"
                                    style={{ backgroundColor: agent.color }}
                                    animate={{ opacity: [1, 0, 1] }}
                                    transition={{ duration: 0.8, repeat: Infinity }}
                                />
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 底部微型进度条 */}
            <div className="h-[3px] w-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
                <motion.div
                    className="h-full"
                    style={{
                        background: done
                            ? 'linear-gradient(90deg, #059669, #10b981)'
                            : `linear-gradient(90deg, ${agent.color}80, ${agent.color})`,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${prog}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>
        </motion.div>
    );
};

/* ────────────────────────────── 主组件 ────────────────────────────── */

export default function BizscanAnalyzing({
    idea, isDataReady, onComplete,
    sseProgress = 0, sseLogs = [], sseStats,
}: BizscanAnalyzingProps) {
    /* ───── 模拟进度（回退方案，使用 SSE 优先） ───── */
    const [simProgress, setSimProgress] = useState(0);
    const [smoothProgress, setSmoothProgress] = useState(0);
    const [simCurrentLog, setSimCurrentLog] = useState('');
    const completedRef = useRef(false);

    // 来自 SSE 的后端进度
    const progress = sseProgress > 0 ? sseProgress : simProgress;

    // 平滑过渡进度
    useEffect(() => {
        if (progress > smoothProgress + 1) {
            const timer = setInterval(() => {
                setSmoothProgress(prev => {
                    const next = prev + Math.max(0.5, (progress - prev) * 0.15);
                    if (next >= progress) { clearInterval(timer); return progress; }
                    return next;
                });
            }, 80);
            return () => clearInterval(timer);
        }
        // 微爬阶段
        const microTimer = setInterval(() => {
            setSmoothProgress(prev => {
                const ceiling = Math.min(progress + 3, 99);
                if (prev >= ceiling) return prev;
                return prev + 0.08;
            });
        }, 200);
        return () => clearInterval(microTimer);
    }, [progress, smoothProgress]);

    const displayProgress = Math.max(smoothProgress, simProgress);

    /* ───── 回退模拟进度 (无 SSE 时) ───── */
    useEffect(() => {
        if (sseProgress > 0) return; // 有 SSE 则不模拟
        let interval: NodeJS.Timeout;
        if (isDataReady) {
            interval = setInterval(() => {
                setSimProgress(p => {
                    if (p >= 100) { clearInterval(interval); return 100; }
                    return p + 4;
                });
            }, 30);
        } else {
            interval = setInterval(() => {
                setSimProgress(p => {
                    if (p < 85) {
                        const inc = p < 40 ? 0.8 : p < 70 ? 0.4 : 0.1;
                        return Math.min(85, p + inc);
                    }
                    return p;
                });
            }, 50);
        }
        return () => clearInterval(interval);
    }, [isDataReady, sseProgress]);

    /* ───── 模拟日志 (无 SSE 时) ───── */
    useEffect(() => {
        if (sseProgress > 0) return;
        const interval = setInterval(() => {
            setSimCurrentLog(WAITING_LOGS[Math.floor(Math.random() * WAITING_LOGS.length)]);
        }, 1200 + Math.random() * 600);
        return () => clearInterval(interval);
    }, [sseProgress]);

    /* ───── Agent 进度模拟 ───── */
    const [simAgentProgress, setSimAgentProgress] = useState({
        market: 0, competitor: 0, novelty: 0, feasibility: 0,
    });

    useEffect(() => {
        if (displayProgress >= 15 && displayProgress < 80) {
            const interval = setInterval(() => {
                setSimAgentProgress(prev => ({
                    market: Math.min(100, prev.market + Math.random() * 5),
                    competitor: Math.min(100, prev.competitor + Math.random() * 4),
                    novelty: Math.min(100, prev.novelty + Math.random() * 6),
                    feasibility: Math.min(100, prev.feasibility + Math.random() * 3),
                }));
            }, 100);
            return () => clearInterval(interval);
        } else if (displayProgress >= 80 || isDataReady) {
            setSimAgentProgress({ market: 100, competitor: 100, novelty: 100, feasibility: 100 });
        }
    }, [displayProgress, isDataReady]);

    const agentProgress = isDataReady
        ? { market: 100, competitor: 100, novelty: 100, feasibility: 100 }
        : simAgentProgress;

    /* ───── 数据就绪 → 完成 ───── */
    useEffect(() => {
        if (isDataReady && !completedRef.current) {
            completedRef.current = true;
            setSmoothProgress(100);
            setSimProgress(100);
            setTimeout(() => onComplete(), 1200);
        }
    }, [isDataReady, onComplete]);

    /* ───── 派生值 ───── */
    const currentStepIndex = displayProgress >= 100 ? 3 : Math.min(3, Math.floor((displayProgress / 100) * 4));
    const eta = useMemo(() => {
        if (displayProgress >= 100) return 0;
        return Math.max(1, Math.ceil((100 - displayProgress) * 0.5));
    }, [displayProgress]);
    const completedAgents = Object.values(agentProgress).filter(v => v >= 100).length;

    // SSE 日志 vs 模拟日志
    const currentLog = sseLogs.length > 0
        ? sseLogs[sseLogs.length - 1]
        : simCurrentLog || '系统推演引擎启动中...';

    /* ━━━━━━━━━━━━━━━━━━━━━ 渲染 ━━━━━━━━━━━━━━━━━━━━━ */
    return (
        <div
            className="fixed inset-0 z-[60] flex flex-col items-center overflow-y-auto pt-4 md:pt-0"
            style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.98) 50%, rgba(255,255,255,0.97) 100%)',
                backdropFilter: 'blur(20px)',
            }}
        >
            {/* ── 背景网格 ── */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)`,
                backgroundSize: '40px 40px',
            }} />

            {/* ── 背景光晕 ── */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center">
                <motion.div
                    className="w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] rounded-full"
                    style={{
                        background: `radial-gradient(circle, ${STEPS[currentStepIndex].hex}10, transparent 70%)`,
                    }}
                    animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                />
            </div>

            <div className="w-full max-w-6xl mx-auto flex flex-col z-10 px-3 md:px-8 pb-28 md:pb-8">

                {/* ━━━━ 1. 顶部标题 ━━━━ */}
                <div className="flex flex-col items-center justify-center mb-2 md:mb-6 shrink-0 pt-2 md:pt-4">
                    <AnimatePresence mode="popLayout">
                        <motion.h2
                            key={currentStepIndex}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5 }}
                            className="text-xl md:text-5xl font-black tracking-tight text-center"
                            style={{ color: STEPS[currentStepIndex].hex }}
                        >
                            {STEPS[currentStepIndex].title}
                        </motion.h2>
                    </AnimatePresence>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs md:text-base font-medium mt-1 md:mt-2 text-center max-w-2xl truncate"
                        style={{ color: '#6b7280' }}
                    >
                        <Terminal className="inline-block w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2 mb-0.5" style={{ color: '#9ca3af' }} />
                        {STEPS[currentStepIndex].desc}
                    </motion.p>

                    {/* 4 步管道指示标签 */}
                    <div className="flex items-center gap-1 mt-2 md:mt-4">
                        {STEPS.map((step, idx) => {
                            const isActive = idx === currentStepIndex;
                            const isPast = idx < currentStepIndex;
                            return (
                                <React.Fragment key={idx}>
                                    <motion.div
                                        className="flex items-center gap-1 px-2 py-1 rounded-md"
                                        animate={{
                                            backgroundColor: isActive ? `${step.hex}20` : 'transparent',
                                            scale: isActive ? 1.05 : 1,
                                        }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <step.icon
                                            className="w-3 h-3"
                                            style={{ color: isActive ? step.hex : isPast ? '#10b981' : '#9ca3af' }}
                                        />
                                        <span
                                            className="text-[10px] font-bold font-mono hidden md:inline"
                                            style={{ color: isActive ? step.hex : isPast ? '#10b981' : '#9ca3af' }}
                                        >
                                            {step.title}
                                        </span>
                                    </motion.div>
                                    {idx < STEPS.length - 1 && (
                                        <div className="w-4 h-px" style={{ backgroundColor: isPast ? '#10b981' : '#e5e7eb' }} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* ━━━━ 2. 查询显示 ━━━━ */}
                {idea && (
                    <div className="text-center mb-2 md:mb-4 shrink-0">
                        <div
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono"
                            style={{
                                backgroundColor: 'rgba(249,250,251,0.8)',
                                border: '1px solid #e5e7eb',
                                color: '#374151',
                            }}
                        >
                            <span style={{ color: '#9ca3af' }}>›</span>
                            <span className="truncate max-w-md">bizscan --analyze &quot;{idea.slice(0, 60)}{idea.length > 60 ? '...' : ''}&quot;</span>
                        </div>
                    </div>
                )}

                {/* ━━━━ 3. 预估等待时间 + Agent 完成进度 ━━━━ */}
                <div className="flex items-center justify-center gap-3 mb-2 md:mb-4 shrink-0">
                    <span className="text-[11px] text-gray-400 font-mono bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                        ⏱ 预计还需 ~{eta}s
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                        🤖 {completedAgents}/4 Agent 已完成
                    </span>
                    {/* SSE 实时统计 */}
                    {sseStats?.sourcesScanned !== undefined && sseStats.sourcesScanned > 0 && (
                        <span className="text-[11px] text-amber-500 font-mono bg-amber-50 px-3 py-1 rounded-full border border-amber-100 font-bold">
                            📡 {sseStats.sourcesScanned} 数据源
                        </span>
                    )}
                    {sseStats?.competitorsFound !== undefined && sseStats.competitorsFound > 0 && (
                        <span className="text-[11px] text-blue-500 font-mono bg-blue-50 px-3 py-1 rounded-full border border-blue-100 font-bold">
                            🔍 {sseStats.competitorsFound} 竞品
                        </span>
                    )}
                </div>

                {/* ━━━━ 4. 四个 Agent 终端 (2×2 Grid) ━━━━ */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                    {AGENTS.map((agent) => {
                        const prog = Math.round(agentProgress[agent.id as keyof typeof agentProgress]);
                        const done = prog >= 100;
                        return (
                            <AgentTerminal
                                key={agent.id}
                                agent={agent}
                                prog={prog}
                                done={done}
                            />
                        );
                    })}
                </div>

                {/* ━━━━ 5. 交叉验证阶段面板 — 进度 >= 60% 后出现 ━━━━ */}
                <AnimatePresence>
                    {displayProgress >= 60 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.4 }}
                            className="w-full mt-3 shrink-0"
                        >
                            <div
                                className="rounded-xl overflow-hidden"
                                style={{
                                    background: '#ffffff',
                                    boxShadow: displayProgress >= 90
                                        ? '0 0 20px rgba(52,168,83,0.15), 0 4px 15px rgba(0,0,0,0.06)'
                                        : '0 2px 12px rgba(0,0,0,0.06)',
                                    border: `1px solid ${displayProgress >= 90 ? '#34A85340' : '#e5e7eb'}`,
                                }}
                            >
                                <div className="flex items-center justify-between px-3 py-2"
                                    style={{
                                        background: 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)',
                                        borderBottom: '1px solid #e5e7eb',
                                    }}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex items-center gap-1.5 mr-1">
                                            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: displayProgress >= 90 ? '#34d058' : '#f9c74f' }} />
                                            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#f9c74f' }} />
                                            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#52c41a' }} />
                                        </div>
                                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#34A85315', color: '#34A853' }}>LAYER 3-5</span>
                                        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#34A85315' }}>
                                            <Sparkles className="w-3.5 h-3.5" style={{ color: '#34A853' }} />
                                        </div>
                                        <span className="text-xs font-bold text-gray-700 font-mono">交叉验证 · 仲裁 · 质量把关</span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold" style={{ color: displayProgress >= 90 ? '#10b981' : '#9ca3af' }}>
                                        {displayProgress >= 90 ? '收敛中' : '等待 L2'}
                                    </span>
                                </div>
                                <div className="px-3 py-2 h-24 overflow-y-auto text-[11px] font-mono" style={{ scrollbarWidth: 'none' }}>
                                    <div className="flex flex-col gap-1">
                                        {WAITING_LOGS.slice(0, Math.min(WAITING_LOGS.length, Math.ceil((displayProgress - 60) / 6))).map((log, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -6 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ duration: 0.15, delay: idx * 0.1 }}
                                                className="text-[10px] tracking-tight flex items-start gap-1.5"
                                            >
                                                <span style={{ color: '#34A853', flexShrink: 0 }}>›</span>
                                                <span className="text-gray-500">{log}</span>
                                            </motion.div>
                                        ))}
                                        {displayProgress < 95 && (
                                            <motion.span
                                                className="inline-block w-1.5 h-3 ml-1 align-middle mt-1"
                                                style={{ backgroundColor: '#34A853' }}
                                                animate={{ opacity: [1, 0, 1] }}
                                                transition={{ duration: 0.8, repeat: Infinity }}
                                            />
                                        )}
                                    </div>
                                </div>
                                <div className="h-[3px] w-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
                                    <motion.div
                                        className="h-full"
                                        style={{ background: 'linear-gradient(90deg, #34A85380, #34A853)' }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, Math.max(0, (displayProgress - 60) * 2.5))}%` }}
                                        transition={{ duration: 0.3 }}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ━━━━ 6. HUD 底部信息栏 ━━━━ */}
                <div className="w-full mt-3 md:mt-6 shrink-0 mb-4 md:mb-0 sticky bottom-0 bg-white/95 md:relative md:bg-transparent py-2 md:py-0 px-1 rounded-t-xl md:rounded-none z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:shadow-none">
                    {/* 状态信息行 */}
                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <motion.div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: STEPS[currentStepIndex].hex }}
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                            <AnimatePresence mode="wait">
                                <motion.span
                                    key={currentLog}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="text-xs md:text-sm font-mono truncate"
                                    style={{ color: '#6b7280' }}
                                >
                                    {currentLog}
                                </motion.span>
                            </AnimatePresence>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                            <span className="text-[10px] font-mono hidden md:inline-block" style={{ color: '#9ca3af' }}>
                                AGENTS <span style={{ color: completedAgents === 4 ? '#10b981' : '#374151' }} className="font-bold">{completedAgents}/4</span>
                            </span>
                            <span className="text-xs font-mono hidden md:inline-block" style={{ color: '#9ca3af' }}>
                                ETA <span className="font-bold" style={{ color: '#374151' }}>{eta}s</span>
                            </span>
                            <span
                                className="text-xl md:text-2xl font-black tabular-nums font-mono"
                                style={{ color: STEPS[currentStepIndex].hex }}
                            >
                                {Math.round(displayProgress)}%
                            </span>
                        </div>
                    </div>

                    {/* 全局主进度条 */}
                    <div className="h-2 w-full rounded-full overflow-hidden shadow-inner" style={{ backgroundColor: '#f3f4f6' }}>
                        <motion.div
                            className="h-full rounded-full relative"
                            style={{ background: `linear-gradient(90deg, ${STEPS[0].hex}, ${STEPS[currentStepIndex].hex})` }}
                            initial={{ width: 0 }}
                            animate={{ width: `${displayProgress}%` }}
                            transition={{ duration: 0.4 }}
                        >
                            <div
                                className="absolute inset-0 opacity-30"
                                style={{
                                    backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)',
                                    backgroundSize: '20px 20px',
                                    animation: 'bizscan-stripe 1s linear infinite',
                                }}
                            />
                        </motion.div>
                    </div>

                    {/* 底部状态文字 */}
                    <div className="flex justify-between mt-2 px-1 items-center">
                        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#9ca3af' }}>
                            Bizscan 6-Agent 推演引擎 · 多维并行协作
                        </span>
                        <div className="flex items-center gap-1.5">
                            {AGENTS.map(a => (
                                <div
                                    key={a.id}
                                    className="w-1.5 h-1.5 rounded-full transition-colors duration-500"
                                    style={{
                                        backgroundColor: agentProgress[a.id as keyof typeof agentProgress] >= 100 ? '#10b981' : a.color,
                                        opacity: agentProgress[a.id as keyof typeof agentProgress] >= 100 ? 1 : 0.4,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

            </div>

            {/* ── 全局内联关键帧 ── */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes bizscan-stripe {
                    from { background-position: 0 0; }
                    to { background-position: 20px 20px; }
                }
            `}} />
        </div>
    );
}
