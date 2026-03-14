'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Brain, Search, BarChart3, CheckCircle2 } from 'lucide-react';
import { Language } from '@/types';

interface FlashThinkingIndicatorProps {
    language: Language;
    query?: string;
    isDataReady?: boolean;
    streamProgress?: {
        globalProgress: number;
        currentLog: string;
        agentProgress: Record<string, { status: string; progress: number }>;
    };
    onComplete?: () => void;
    onCancel?: () => void;
}

const FLASH_AGENTS = [
    { id: 'academicReviewer', icon: Search, color: '#F59E0B', zh: '学术审查', en: 'Academic' },
    { id: 'industryAnalyst', icon: BarChart3, color: '#F97316', zh: '产业分析', en: 'Industry' },
    { id: 'competitorDetective', icon: Brain, color: '#EF4444', zh: '竞品侦探', en: 'Competitor' },
    { id: 'innovationEvaluator', icon: Zap, color: '#FBBF24', zh: '创新评估', en: 'Innovation' },
];

const FLASH_STEPS_ZH = [
    '双轨极速检索中...',
    '全并行 Agent 启动...',
    '学术 + 产业 + 竞品 + 创新同时扫描...',
    '聚合多维评估数据...',
    '加权仲裁计算中...',
    '生成极速报告...',
];

const FLASH_STEPS_EN = [
    'Dual-track rapid search...',
    'All agents launching in parallel...',
    'Academic + Industry + Competitor + Innovation scanning...',
    'Aggregating multi-dimensional data...',
    'Weighted arbitration...',
    'Generating flash report...',
];

/* ──────────────────────── 闪电粒子系统 ──────────────────────── */
interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    opacity: number;
    duration: number;
    delay: number;
    driftX: number;
    driftY: number;
}

function generateParticles(count: number): Particle[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 8 + Math.random() * 16,
        opacity: 0.08 + Math.random() * 0.15,
        duration: 4 + Math.random() * 6,
        delay: Math.random() * 3,
        driftX: (Math.random() - 0.5) * 30,
        driftY: (Math.random() - 0.5) * 30,
    }));
}

function LightningParticles() {
    const particles = useMemo(() => generateParticles(14), []);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {particles.map(p => (
                <motion.div
                    key={p.id}
                    className="absolute select-none"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        fontSize: `${p.size}px`,
                    }}
                    initial={{ opacity: 0, scale: 0.3 }}
                    animate={{
                        opacity: [0, p.opacity, p.opacity * 1.8, p.opacity, 0],
                        scale: [0.3, 1, 1.2, 1, 0.3],
                        x: [0, p.driftX * 0.5, p.driftX, p.driftX * 0.5, 0],
                        y: [0, p.driftY * 0.5, p.driftY, p.driftY * 0.5, 0],
                    }}
                    transition={{
                        duration: p.duration,
                        delay: p.delay,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                >
                    ⚡
                </motion.div>
            ))}
        </div>
    );
}

/* ──────────────────────── 电路板数据流 SVG ──────────────────────── */
function CircuitDataFlow() {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.12]">
            <svg width="100%" height="100%" className="absolute inset-0">
                <defs>
                    {/* 发光数据点渐变 */}
                    <radialGradient id="dotGlow">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity="1" />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
                    </radialGradient>
                    {/* 线条渐变 */}
                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
                        <stop offset="50%" stopColor="#F97316" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.3" />
                    </linearGradient>
                </defs>
                {/* 水平电路线 */}
                {[20, 35, 50, 65, 80].map((y, i) => (
                    <g key={`h-${i}`}>
                        <line x1="0%" y1={`${y}%`} x2="100%" y2={`${y}%`} stroke="url(#lineGrad)" strokeWidth="0.5" strokeDasharray="8 12" />
                        {/* 沿路径移动的发光数据点 */}
                        <motion.circle
                            r="3"
                            fill="url(#dotGlow)"
                            animate={{
                                cx: ['0%', '100%'],
                                cy: [`${y}%`, `${y}%`],
                            }}
                            transition={{
                                duration: 3 + i * 0.8,
                                delay: i * 0.6,
                                repeat: Infinity,
                                ease: 'linear',
                            }}
                        />
                    </g>
                ))}
                {/* 垂直电路线 */}
                {[15, 30, 50, 70, 85].map((x, i) => (
                    <g key={`v-${i}`}>
                        <line x1={`${x}%`} y1="0%" x2={`${x}%`} y2="100%" stroke="url(#lineGrad)" strokeWidth="0.5" strokeDasharray="6 14" />
                        <motion.circle
                            r="2.5"
                            fill="url(#dotGlow)"
                            animate={{
                                cx: [`${x}%`, `${x}%`],
                                cy: ['0%', '100%'],
                            }}
                            transition={{
                                duration: 4 + i * 0.6,
                                delay: i * 0.4 + 1,
                                repeat: Infinity,
                                ease: 'linear',
                            }}
                        />
                    </g>
                ))}
                {/* 交叉节点闪烁 */}
                {[[30, 35], [50, 50], [70, 65], [50, 20], [15, 80], [85, 35]].map(([cx, cy], i) => (
                    <motion.circle
                        key={`node-${i}`}
                        cx={`${cx}%`}
                        cy={`${cy}%`}
                        r="2"
                        fill="#FBBF24"
                        animate={{
                            opacity: [0.2, 1, 0.2],
                            r: [1.5, 3, 1.5],
                        }}
                        transition={{
                            duration: 1.5 + i * 0.3,
                            delay: i * 0.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                    />
                ))}
            </svg>
        </div>
    );
}

/* ──────────────────────── 中心闪电图标 + 旋转光环 ──────────────────────── */
function FlashCoreIcon() {
    return (
        <div className="relative w-16 h-16 flex items-center justify-center flex-shrink-0">
            {/* 外层旋转光环 */}
            <motion.div
                className="absolute inset-[-6px] rounded-2xl"
                style={{
                    background: 'conic-gradient(from 0deg, transparent, #F59E0B, #F97316, transparent)',
                    opacity: 0.5,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
            {/* 呼吸发光层 */}
            <motion.div
                className="absolute inset-[-4px] rounded-2xl"
                style={{
                    boxShadow: '0 0 20px rgba(245,158,11,0.4), 0 0 40px rgba(249,115,22,0.2)',
                }}
                animate={{
                    boxShadow: [
                        '0 0 20px rgba(245,158,11,0.3), 0 0 40px rgba(249,115,22,0.1)',
                        '0 0 30px rgba(245,158,11,0.6), 0 0 60px rgba(249,115,22,0.3)',
                        '0 0 20px rgba(245,158,11,0.3), 0 0 40px rgba(249,115,22,0.1)',
                    ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* 核心图标 */}
            <div className="relative w-14 h-14 bg-gradient-to-br from-amber-400 via-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg z-10">
                <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <Zap className="w-8 h-8 text-white drop-shadow-md" />
                </motion.div>
            </div>
        </div>
    );
}

/* ──────────────────────── 进度条 + 流光效果 ──────────────────────── */
function FlashProgressBar({ progress }: { progress: number }) {
    return (
        <div className="w-full">
            <div className="relative h-2.5 bg-gray-100/80 rounded-full overflow-hidden">
                {/* 实际进度 */}
                <motion.div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 rounded-full"
                    style={{ width: `${Math.max(5, progress)}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                />
                {/* 流光扫过效果 */}
                <motion.div
                    className="absolute top-0 left-0 h-full w-24 rounded-full"
                    style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
                    }}
                    animate={{ x: ['-100px', '600px'] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', repeatDelay: 0.5 }}
                />
                {/* 小闪电标记跟随进度 */}
                <motion.div
                    className="absolute top-[-6px] text-[10px] select-none"
                    style={{ left: `${Math.max(2, progress - 2)}%` }}
                    animate={{ opacity: [0.6, 1, 0.6], y: [0, -2, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                >
                    ⚡
                </motion.div>
            </div>
        </div>
    );
}

/* ──────────────────────── 打字机文字效果 ──────────────────────── */
function TypewriterText({ text }: { text: string }) {
    const [displayed, setDisplayed] = useState('');
    const [currentText, setCurrentText] = useState(text);

    useEffect(() => {
        if (text !== currentText) {
            setDisplayed('');
            setCurrentText(text);
        }
    }, [text, currentText]);

    useEffect(() => {
        let idx = 0;
        setDisplayed('');
        const interval = setInterval(() => {
            idx++;
            setDisplayed(currentText.slice(0, idx));
            if (idx >= currentText.length) {
                clearInterval(interval);
            }
        }, 40);
        return () => clearInterval(interval);
    }, [currentText]);

    return (
        <span className="text-xs text-gray-500 truncate max-w-[80%] inline-block">
            {displayed}
            <motion.span
                className="inline-block w-[2px] h-3 bg-amber-500 ml-0.5 align-middle"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
            />
        </span>
    );
}

/* ──────────────────────── 完成状态粒子爆发 ──────────────────────── */
function CompleteBurst() {
    const burstParticles = useMemo(() =>
        Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            return {
                id: i,
                x: Math.cos(angle) * (60 + Math.random() * 40),
                y: Math.sin(angle) * (60 + Math.random() * 40),
                delay: i * 0.03,
            };
        }), []);

    return (
        <>
            {/* 放射状光芒 */}
            <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 1.2 }}
            >
                {[0, 45, 90, 135].map(deg => (
                    <motion.div
                        key={deg}
                        className="absolute w-1 bg-gradient-to-t from-transparent via-amber-300 to-transparent"
                        style={{
                            height: '120px',
                            transform: `rotate(${deg}deg)`,
                            transformOrigin: 'center center',
                        }}
                        initial={{ scaleY: 0, opacity: 0 }}
                        animate={{ scaleY: [0, 1, 0], opacity: [0, 0.7, 0] }}
                        transition={{ duration: 0.8, delay: 0.1 }}
                    />
                ))}
            </motion.div>
            {/* 粒子爆发 */}
            {burstParticles.map(p => (
                <motion.div
                    key={p.id}
                    className="absolute text-amber-400 text-xs"
                    style={{ left: '50%', top: '50%' }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
                    transition={{ duration: 0.8, delay: p.delay, ease: 'easeOut' }}
                >
                    ✦
                </motion.div>
            ))}
        </>
    );
}

/* ══════════════════════════ 主组件 ══════════════════════════ */

export default function FlashThinkingIndicator({
    language,
    query,
    isDataReady,
    streamProgress,
    onComplete,
    onCancel,
}: FlashThinkingIndicatorProps) {
    const isZh = language === 'zh';
    const steps = isZh ? FLASH_STEPS_ZH : FLASH_STEPS_EN;
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [showComplete, setShowComplete] = useState(false);
    const completedRef = useRef(false);

    // 步骤轮播
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStepIdx(prev => (prev + 1) % steps.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [steps.length]);

    // 数据就绪 → 完成动画 → 回调
    useEffect(() => {
        if (isDataReady && !completedRef.current) {
            completedRef.current = true;
            setShowComplete(true);
            setTimeout(() => {
                onComplete?.();
            }, 1500);
        }
    }, [isDataReady, onComplete]);

    const progress = streamProgress?.globalProgress || 0;
    const currentLog = streamProgress?.currentLog || steps[currentStepIdx];

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-white via-amber-50/40 to-orange-50/30">
            {/* ─── 背景层 ─── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* 主光圈 */}
                <motion.div
                    className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-amber-400/8 rounded-full blur-[100px]"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-orange-400/8 rounded-full blur-[100px]"
                    animate={{ scale: [1.3, 1, 1.3], opacity: [0.3, 0.15, 0.3] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-yellow-300/6 rounded-full blur-[80px]"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                />
            </div>

            {/* ─── 电路板数据流 ─── */}
            <CircuitDataFlow />

            {/* ─── 闪电粒子系统 ─── */}
            <LightningParticles />

            <AnimatePresence mode="wait">
                {showComplete ? (
                    /* ══════ 完成状态 ══════ */
                    <motion.div
                        key="complete"
                        initial={{ scale: 0.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center gap-5 relative z-10"
                    >
                        {/* 粒子爆发 */}
                        <CompleteBurst />
                        {/* 完成图标 */}
                        <motion.div
                            className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl relative"
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ duration: 0.6 }}
                        >
                            <motion.div
                                className="absolute inset-[-3px] rounded-full"
                                style={{
                                    boxShadow: '0 0 30px rgba(52,211,153,0.5), 0 0 60px rgba(16,185,129,0.2)',
                                }}
                                animate={{
                                    boxShadow: [
                                        '0 0 30px rgba(52,211,153,0.5), 0 0 60px rgba(16,185,129,0.2)',
                                        '0 0 40px rgba(52,211,153,0.8), 0 0 80px rgba(16,185,129,0.4)',
                                        '0 0 30px rgba(52,211,153,0.5), 0 0 60px rgba(16,185,129,0.2)',
                                    ],
                                }}
                                transition={{ duration: 1, repeat: Infinity }}
                            />
                            <CheckCircle2 className="w-12 h-12 text-white relative z-10" />
                        </motion.div>
                        <motion.p
                            className="text-xl font-bold text-gray-800"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            {isZh ? '⚡ Flash 分析完成' : '⚡ Flash Complete'}
                        </motion.p>
                    </motion.div>
                ) : (
                    /* ══════ 加载状态 ══════ */
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex flex-col items-center gap-8 relative z-10 w-full max-w-lg px-6"
                    >
                        {/* ─── Flash 标题区 ─── */}
                        <div className="flex items-center gap-4">
                            <FlashCoreIcon />
                            <div>
                                <h2 className="text-2xl font-black text-gray-800 tracking-tight">
                                    Novoscan{' '}
                                    <span className="bg-gradient-to-r from-amber-500 to-orange-500 gradient-text-clip text-amber-500">
                                        Flash
                                    </span>
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {isZh ? '极速模式 · 全并行分析引擎' : 'Ultra-fast parallel analysis engine'}
                                </p>
                            </div>
                        </div>

                        {/* ─── 查询显示 ─── */}
                        {query && (
                            <motion.p
                                className="text-sm text-gray-600 text-center truncate max-w-full bg-white/95 rounded-full px-5 py-2 border border-amber-200/40 shadow-sm"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                {query.length > 40 ? query.slice(0, 40) + '...' : query}
                            </motion.p>
                        )}

                        {/* ─── Agent 并行状态卡片 ─── */}
                        <div className="grid grid-cols-2 gap-3 w-full">
                            {FLASH_AGENTS.map((agent, idx) => {
                                const agentState = streamProgress?.agentProgress?.[agent.id];
                                const status = agentState?.status || 'pending';
                                const isRunning = status === 'running';
                                const isDone = status === 'completed';
                                const Icon = agent.icon;

                                return (
                                    <motion.div
                                        key={agent.id}
                                        initial={{ opacity: 0, y: 15, scale: 0.9 }}
                                        animate={{
                                            opacity: 1,
                                            y: 0,
                                            scale: isDone ? [1, 1.05, 1] : 1,
                                        }}
                                        transition={{
                                            delay: idx * 0.12,
                                            type: 'spring',
                                            stiffness: 300,
                                            damping: 20,
                                        }}
                                        className="relative"
                                    >
                                        {/* 运行中脉冲光环 */}
                                        {isRunning && (
                                            <motion.div
                                                className="absolute inset-[-1px] rounded-xl"
                                                style={{
                                                    boxShadow: `0 0 12px ${agent.color}40, 0 0 24px ${agent.color}20`,
                                                }}
                                                animate={{
                                                    boxShadow: [
                                                        `0 0 8px ${agent.color}30, 0 0 16px ${agent.color}10`,
                                                        `0 0 16px ${agent.color}50, 0 0 32px ${agent.color}25`,
                                                        `0 0 8px ${agent.color}30, 0 0 16px ${agent.color}10`,
                                                    ],
                                                }}
                                                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                            />
                                        )}
                                        {/* 完成时闪光边框 */}
                                        {isDone && (
                                            <motion.div
                                                className="absolute inset-[-1px] rounded-xl border-2 border-green-400/60"
                                                initial={{ opacity: 0, scale: 1.1 }}
                                                animate={{ opacity: [0, 1, 0.6], scale: [1.1, 1, 1] }}
                                                transition={{ duration: 0.5 }}
                                            />
                                        )}
                                        <div
                                            className={`
                                                relative flex items-center gap-2.5 px-3.5 py-3 rounded-xl border
                                                transition-all duration-500
                                                ${isDone
                                                    ? 'bg-green-50/90 border-green-200/80'
                                                    : isRunning
                                                        ? 'bg-white/95 border-amber-200/60 shadow-md'
                                                        : 'bg-gray-50/60 border-gray-100/80'
                                                }
                                            `}
                                        >
                                            <div
                                                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-500"
                                                style={{
                                                    backgroundColor: isDone ? '#dcfce7' : isRunning ? agent.color + '18' : '#f3f4f6',
                                                }}
                                            >
                                                {isDone ? (
                                                    <motion.div
                                                        initial={{ scale: 0, rotate: -90 }}
                                                        animate={{ scale: 1, rotate: 0 }}
                                                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                    </motion.div>
                                                ) : (
                                                    <motion.div
                                                        animate={isRunning ? {
                                                            scale: [1, 1.2, 1],
                                                            rotate: [0, 5, -5, 0],
                                                        } : {}}
                                                        transition={{ duration: 1.5, repeat: Infinity }}
                                                    >
                                                        <Icon
                                                            className="w-4 h-4"
                                                            style={{ color: isRunning ? agent.color : '#9ca3af' }}
                                                        />
                                                    </motion.div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className={`text-xs font-semibold truncate ${isDone ? 'text-green-700' : isRunning ? 'text-gray-800' : 'text-gray-400'}`}>
                                                    {isZh ? agent.zh : agent.en}
                                                </p>
                                                <p className="text-[10px] text-gray-400">
                                                    {isDone
                                                        ? (isZh ? '✓ 已完成' : '✓ Done')
                                                        : isRunning
                                                            ? (isZh ? '⚡ 分析中...' : '⚡ Running...')
                                                            : (isZh ? '○ 等待' : '○ Pending')
                                                    }
                                                </p>
                                                {/* Agent 微型进度条 */}
                                                {isRunning && (
                                                    <motion.div
                                                        className="mt-1.5 h-[3px] bg-gray-100 rounded-full overflow-hidden"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                    >
                                                        <motion.div
                                                            className="h-full rounded-full"
                                                            style={{ backgroundColor: agent.color }}
                                                            animate={{ width: ['10%', '60%', '30%', '80%', '50%'] }}
                                                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                                        />
                                                    </motion.div>
                                                )}
                                                {isDone && (
                                                    <div className="mt-1.5 h-[3px] bg-green-200 rounded-full overflow-hidden">
                                                        <div className="h-full w-full bg-green-500 rounded-full" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* ─── 进度条 ─── */}
                        <div className="w-full space-y-2">
                            <FlashProgressBar progress={progress} />
                            <div className="flex items-center justify-between">
                                <TypewriterText text={currentLog} />
                                <motion.span
                                    className="text-xs font-mono text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full"
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                >
                                    {progress}%
                                </motion.span>
                            </div>
                        </div>

                        {/* #10 取消分析按钮 */}
                        {onCancel && (
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 2 }}
                                onClick={onCancel}
                                className="text-xs text-gray-400 hover:text-gray-600 font-medium px-4 py-2 rounded-full border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
                            >
                                {isZh ? '✕ 取消分析' : '✕ Cancel'}
                            </motion.button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
