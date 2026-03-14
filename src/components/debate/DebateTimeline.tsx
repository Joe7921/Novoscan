'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Swords, ChevronDown, ChevronUp, Trophy, Shield, Handshake,
    Lightbulb, TrendingUp, TrendingDown, Minus, Zap, MessageCircle,
    Clock, Hash, Play, Pause, SkipForward
} from 'lucide-react';

import NovoDebateVisualization from './NovoDebateVisualization';

// ==================== NovoDebate 辩论过程可视化组件 ====================

interface DebateExchange {
    round: number;
    challenger: string;
    challengerArgument: string;
    challengerEvidence: string[];
    defender: string;
    defenderRebuttal: string;
    defenderEvidence: string[];
    outcome: 'challenger_wins' | 'defender_wins' | 'draw';
    outcomeReasoning: string;
}

interface DebateSession {
    sessionId: string;
    topic: string;
    proAgent: string;
    conAgent: string;
    scoreDivergence: number;
    exchanges: DebateExchange[];
    verdict: string;
    keyInsights: string[];
    scoreAdjustment: {
        proAgentDelta: number;
        conAgentDelta: number;
    };
}

interface DissentItem {
    dimension: string;
    proAgent: string;
    proPosition: string;
    conAgent: string;
    conPosition: string;
    severity: 'high' | 'medium' | 'low';
    resolution: string;
    roundsDebated: number;
    winner: 'pro' | 'con' | 'draw';
}

interface DebateRecord {
    triggered: boolean;
    triggerReason: string;
    sessions: DebateSession[];
    totalDurationMs: number;
    dissentReport: DissentItem[] | string; // 兼容旧版字符串格式
    dissentReportText?: string;
}

interface DebateTimelineProps {
    debate: DebateRecord | null | undefined;
    language?: 'zh' | 'en';
}

/* ────────────────────────────── 优化1：分歧矩阵热力图 ────────────────────────────── */

/** 单行详情气泡 — hover 时展示正反方立场和裁决 */
function DissentDetailPopover({ item, isZh }: { item: DissentItem; isZh: boolean }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 right-0 top-full mt-1.5 z-30 p-3 bg-white rounded-xl border border-gray-200 shadow-lg shadow-gray-200/60"
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                {/* 正方立场 */}
                <div className="p-2 bg-rose-50/70 rounded-lg border border-rose-100/60">
                    <div className="text-[9px] font-bold text-rose-500 mb-1 flex items-center gap-1">
                        <span>🗡️</span> {item.proAgent}
                    </div>
                    <p className="text-[10px] text-gray-600 leading-snug line-clamp-4">
                        {item.proPosition}
                    </p>
                </div>
                {/* 反方立场 */}
                <div className="p-2 bg-blue-50/70 rounded-lg border border-blue-100/60">
                    <div className="text-[9px] font-bold text-blue-500 mb-1 flex items-center gap-1">
                        <span>🛡️</span> {item.conAgent}
                    </div>
                    <p className="text-[10px] text-gray-600 leading-snug line-clamp-4">
                        {item.conPosition}
                    </p>
                </div>
            </div>
            {/* 裁决结论 */}
            <div className="text-[10px] text-gray-500 pl-2 border-l-2 border-gray-200 leading-relaxed">
                ⚖️ {item.resolution}
            </div>
        </motion.div>
    );
}

/** 矩阵热力图单行 */
function DissentMatrixRow({ item, idx, isZh }: { item: DissentItem; idx: number; isZh: boolean }) {
    const [hovered, setHovered] = useState(false);

    const severityConfig = {
        high: {
            bar: 'bg-gradient-to-b from-rose-500 to-rose-600',
            rowBg: 'bg-rose-50/40 hover:bg-rose-50/70',
            badge: 'bg-rose-100 text-rose-700 border-rose-200',
            label: isZh ? '高分歧' : 'High',
            dimColor: 'text-rose-600',
        },
        medium: {
            bar: 'bg-gradient-to-b from-amber-400 to-amber-500',
            rowBg: 'bg-amber-50/30 hover:bg-amber-50/60',
            badge: 'bg-amber-100 text-amber-700 border-amber-200',
            label: isZh ? '中分歧' : 'Med',
            dimColor: 'text-amber-600',
        },
        low: {
            bar: 'bg-gradient-to-b from-emerald-400 to-emerald-500',
            rowBg: 'bg-emerald-50/30 hover:bg-emerald-50/60',
            badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            label: isZh ? '低分歧' : 'Low',
            dimColor: 'text-emerald-600',
        },
    };

    const sev = severityConfig[item.severity] || severityConfig.medium;
    const winnerIcon = item.winner === 'pro' ? '🗡️' : item.winner === 'con' ? '🛡️' : '⚖️';
    const winnerText = item.winner === 'pro' ? item.proAgent : item.winner === 'con' ? item.conAgent : (isZh ? '平局' : 'Draw');

    return (
        <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + idx * 0.08, duration: 0.3 }}
            className="relative"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className={`flex items-stretch rounded-lg transition-all duration-200 cursor-default ${sev.rowBg} ${hovered ? 'shadow-sm ring-1 ring-gray-200/60' : ''}`}>
                {/* 左侧 severity 色条 */}
                <div className={`w-1.5 rounded-l-lg flex-shrink-0 ${sev.bar}`} />

                {/* 主内容区 */}
                <div className="flex-1 flex items-center gap-3 px-3 py-2.5 min-w-0">
                    {/* 维度名称 — 完整显示 */}
                    <div className={`flex-1 min-w-0 text-[11px] font-bold ${sev.dimColor} leading-snug`}>
                        {item.dimension}
                    </div>

                    {/* Agent 对阵 */}
                    <div className="hidden sm:flex items-center gap-1 text-[9px] text-gray-400 flex-shrink-0">
                        <span className="text-rose-500 font-bold truncate max-w-[60px]">{item.proAgent}</span>
                        <span className="text-gray-300">vs</span>
                        <span className="text-blue-500 font-bold truncate max-w-[60px]">{item.conAgent}</span>
                    </div>

                    {/* 辩论轮数 */}
                    <div className="flex items-center gap-1 text-[9px] font-mono text-gray-400 flex-shrink-0">
                        <Swords size={9} className="text-gray-300" />
                        <span>{item.roundsDebated}R</span>
                    </div>

                    {/* 胜方 */}
                    <div className="flex items-center gap-1 text-[9px] text-gray-500 flex-shrink-0">
                        <span>{winnerIcon}</span>
                        <span className="font-medium truncate max-w-[50px] hidden sm:inline">{winnerText}</span>
                    </div>

                    {/* severity 标签 */}
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${sev.badge}`}>
                        {sev.label}
                    </span>
                </div>
            </div>

            {/* hover 详情气泡 */}
            <AnimatePresence>
                {hovered && (
                    <DissentDetailPopover item={item} isZh={isZh} />
                )}
            </AnimatePresence>
        </motion.div>
    );
}

/** 分歧矩阵热力图 — 行式矩阵直观展示各维度分歧程度 */
function DissentHeatmap({ items, isZh }: { items: DissentItem[]; isZh: boolean }) {
    if (items.length === 0) return null;

    // 按严重程度排序：high → medium → low
    const sortedItems = [...items].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[a.severity] ?? 1) - (order[b.severity] ?? 1);
    });

    const highCount = items.filter(i => i.severity === 'high').length;
    const medCount = items.filter(i => i.severity === 'medium').length;
    const lowCount = items.filter(i => i.severity === 'low').length;

    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="mb-4 p-3 bg-white/95 rounded-xl border border-gray-100 shadow-sm"
        >
            {/* 标题栏 */}
            <div className="flex items-center justify-between mb-3">
                <div className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    {isZh ? '分歧矩阵热力图' : 'Dissent Matrix Heatmap'}
                </div>
                <div className="flex items-center gap-2.5 text-[9px] text-gray-400">
                    {highCount > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-b from-rose-500 to-rose-600" />
                            <span className="font-mono font-bold text-rose-500">{highCount}</span>
                            {isZh ? '高' : 'High'}
                        </span>
                    )}
                    {medCount > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-b from-amber-400 to-amber-500" />
                            <span className="font-mono font-bold text-amber-500">{medCount}</span>
                            {isZh ? '中' : 'Med'}
                        </span>
                    )}
                    {lowCount > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-b from-emerald-400 to-emerald-500" />
                            <span className="font-mono font-bold text-emerald-500">{lowCount}</span>
                            {isZh ? '低' : 'Low'}
                        </span>
                    )}
                </div>
            </div>

            {/* 矩阵行列表 */}
            <div className="flex flex-col gap-1.5">
                {sortedItems.map((item, idx) => (
                    <DissentMatrixRow key={idx} item={item} idx={idx} isZh={isZh} />
                ))}
            </div>

            {/* 底部提示 */}
            <div className="mt-2.5 text-center text-[8px] text-gray-300 font-mono">
                {isZh ? '悬浮查看详细立场与裁决' : 'Hover for details'}
            </div>
        </motion.div>
    );
}

/* ────────────────────────────── 优化3：辩论回放动画 ────────────────────────────── */

/** 辩论回放动画 — 逐轮自动播放攻防交锋 */
function DebateReplayTimeline({ exchanges, isZh }: { exchanges: DebateExchange[]; isZh: boolean }) {
    const [currentStep, setCurrentStep] = useState(-1); // -1 = 未开始
    const [isPlaying, setIsPlaying] = useState(false);

    // 总步骤数：每轮有3步（挑战、反驳、裁判判定）
    const totalSteps = exchanges.length * 3;

    const advance = useCallback(() => {
        setCurrentStep(prev => {
            if (prev >= totalSteps - 1) {
                setIsPlaying(false);
                return prev;
            }
            return prev + 1;
        });
    }, [totalSteps]);

    useEffect(() => {
        if (!isPlaying) return;
        const timer = setInterval(advance, 1200);
        return () => clearInterval(timer);
    }, [isPlaying, advance]);

    const handlePlay = () => {
        if (currentStep >= totalSteps - 1) {
            setCurrentStep(-1);
            setTimeout(() => setIsPlaying(true), 100);
        } else {
            setIsPlaying(true);
        }
    };

    const handleSkip = () => {
        setCurrentStep(totalSteps - 1);
        setIsPlaying(false);
    };

    // 当前轮次和阶段
    const currentRound = Math.floor(currentStep / 3);
    const currentPhase = currentStep % 3; // 0=挑战, 1=反驳, 2=裁判

    return (
        <div className="mt-3 pt-3 border-t border-gray-100">
            {/* 控制栏 */}
            <div className="flex items-center gap-2 mb-3">
                <button
                    onClick={isPlaying ? () => setIsPlaying(false) : handlePlay}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                    {isPlaying ? <Pause size={10} /> : <Play size={10} />}
                    {isPlaying ? (isZh ? '暂停' : 'Pause') : currentStep >= 0 ? (isZh ? '继续' : 'Resume') : (isZh ? '回放辩论' : 'Replay')}
                </button>
                {currentStep >= 0 && (
                    <button
                        onClick={handleSkip}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <SkipForward size={10} />
                        {isZh ? '跳到结尾' : 'Skip'}
                    </button>
                )}
                {/* 进度条 */}
                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-indigo-400 to-violet-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
                <span className="text-[9px] font-mono text-gray-400">
                    {Math.min(currentStep + 1, totalSteps)}/{totalSteps}
                </span>
            </div>

            {/* 回放内容 */}
            {currentStep >= 0 && (
                <div className="space-y-2">
                    {exchanges.map((exchange, rIdx) => {
                        if (rIdx > currentRound) return null;
                        const isCurrentRound = rIdx === currentRound;
                        const outcomeInfo = getOutcomeInfo(exchange.outcome);
                        const OutcomeIcon = outcomeInfo.icon;

                        return (
                            <motion.div
                                key={rIdx}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3 }}
                                className={`p-2.5 rounded-xl border transition-all ${isCurrentRound ? 'border-indigo-200 bg-indigo-50/30 shadow-sm' : 'border-gray-100 bg-gray-50/30'
                                    }`}
                            >
                                <div className="text-[9px] font-mono font-bold text-gray-300 mb-1.5">R{exchange.round}</div>
                                <div className="space-y-1.5">
                                    {/* 挑战方发言 */}
                                    {(rIdx < currentRound || (isCurrentRound && currentPhase >= 0)) && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="flex items-start gap-2"
                                        >
                                            <span className="text-[9px] mt-0.5">🗡️</span>
                                            <div className="flex-1">
                                                <span className="text-[9px] font-bold text-rose-500">{exchange.challenger}</span>
                                                <p className={`text-[10px] text-gray-600 leading-snug mt-0.5 ${isCurrentRound && currentPhase === 0 ? 'animate-pulse' : ''}`}>
                                                    {exchange.challengerArgument}
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                    {/* 防守方反驳 */}
                                    {(rIdx < currentRound || (isCurrentRound && currentPhase >= 1)) && (
                                        <motion.div
                                            initial={{ opacity: 0, x: 8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="flex items-start gap-2"
                                        >
                                            <span className="text-[9px] mt-0.5">🛡️</span>
                                            <div className="flex-1">
                                                <span className="text-[9px] font-bold text-blue-500">{exchange.defender}</span>
                                                <p className={`text-[10px] text-gray-600 leading-snug mt-0.5 ${isCurrentRound && currentPhase === 1 ? 'animate-pulse' : ''}`}>
                                                    {exchange.defenderRebuttal}
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}
                                    {/* 裁判判定 */}
                                    {(rIdx < currentRound || (isCurrentRound && currentPhase >= 2)) && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className={`flex items-center gap-1.5 text-[9px] font-bold ${outcomeInfo.color} ${outcomeInfo.bg} px-2 py-1 rounded-lg border ${outcomeInfo.border} w-fit`}
                                        >
                                            <OutcomeIcon size={9} />
                                            {isZh ? outcomeInfo.label : outcomeInfo.labelEn}
                                            <span className="text-gray-400 font-normal ml-1 truncate max-w-[200px]">{exchange.outcomeReasoning}</span>
                                        </motion.div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/* ────────────────────────────── 优化2：可展开立场文本 ────────────────────────────── */

/** 可展开的立场文本 — 超过一定长度时截断，点击展开完整内容 */
function ExpandablePosition({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = text.length > 100;

    return (
        <div className="relative">
            <p className={`text-[10px] text-gray-600 leading-snug ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
                {text}
            </p>
            {isLong && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-[9px] text-indigo-500 hover:text-indigo-700 font-medium mt-0.5 transition-colors flex items-center gap-0.5"
                >
                    {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                    {expanded ? '收起' : '展开全文'}
                </button>
            )}
        </div>
    );
}

/* ────────────────────────────── 工具函数 ────────────────────────────── */

/** 获取结果图标和颜色 */
function getOutcomeInfo(outcome: string) {
    switch (outcome) {
        case 'challenger_wins':
            return { icon: Trophy, label: '挑战方胜', labelEn: 'Challenger Wins', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' };
        case 'defender_wins':
            return { icon: Shield, label: '防守方胜', labelEn: 'Defender Wins', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
        default:
            return { icon: Handshake, label: '平局', labelEn: 'Draw', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' };
    }
}

/** 评分变化指示器 */
function ScoreDelta({ delta, agentName }: { delta: number; agentName: string }) {
    const isPositive = delta > 0;
    const isZero = delta === 0;
    const Icon = isZero ? Minus : isPositive ? TrendingUp : TrendingDown;
    const colorClass = isZero ? 'text-gray-400' : isPositive ? 'text-emerald-600' : 'text-rose-600';
    const bgClass = isZero ? 'bg-gray-50 border-gray-100' : isPositive ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100';

    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${bgClass} ${colorClass}`}>
            <Icon size={11} />
            <span className="max-w-[80px] truncate">{agentName}</span>
            <span className="font-mono">{isZero ? '±0' : `${isPositive ? '+' : ''}${delta}`}</span>
        </div>
    );
}

/** 辩论比分条 —— 简洁的左右彩色条 */
function ScoreBar({ proWins, conWins, draws, proAgent, conAgent }: {
    proWins: number; conWins: number; draws: number; proAgent: string; conAgent: string
}) {
    const total = proWins + conWins + draws;
    if (total === 0) return null;

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold">
                <span className="text-rose-500 truncate max-w-[100px] flex items-center gap-1">
                    🗡️ {proAgent}
                    <span className="font-mono text-rose-400 bg-rose-50 px-1 rounded">{proWins}</span>
                </span>
                {draws > 0 && <span className="text-gray-400 font-mono">{draws} 平</span>}
                <span className="text-blue-500 truncate max-w-[100px] flex items-center gap-1">
                    <span className="font-mono text-blue-400 bg-blue-50 px-1 rounded">{conWins}</span>
                    {conAgent} 🛡️
                </span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100 gap-px">
                {proWins > 0 && (
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(proWins / total) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                        className="bg-rose-400 rounded-l-full"
                    />
                )}
                {draws > 0 && (
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(draws / total) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
                        className="bg-gray-300"
                    />
                )}
                {conWins > 0 && (
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(conWins / total) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
                        className="bg-blue-400 rounded-r-full"
                    />
                )}
            </div>
        </div>
    );
}


/* ────────────────────────────── 单轮交锋卡片 ────────────────────────────── */

function ExchangeCard({ exchange, idx, isZh }: { exchange: DebateExchange; idx: number; isZh: boolean }) {
    const [showEvidence, setShowEvidence] = useState(false);
    const outcomeInfo = getOutcomeInfo(exchange.outcome);
    const OutcomeIcon = outcomeInfo.icon;
    const hasEvidence = exchange.challengerEvidence.length > 0 || exchange.defenderEvidence.length > 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.3 }}
            className="relative"
        >
            {/* 轮次头 */}
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono font-bold text-gray-300 w-6">R{exchange.round}</span>
                <div className="flex-1 h-px bg-gray-100" />
                <div className={`flex items-center gap-1 text-[9px] font-bold ${outcomeInfo.color} px-2 py-0.5 rounded-full ${outcomeInfo.bg} border ${outcomeInfo.border}`}>
                    <OutcomeIcon size={9} />
                    {isZh ? outcomeInfo.label : outcomeInfo.labelEn}
                </div>
            </div>

            {/* 双栏对决布局 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* 挑战方 */}
                <div className="relative p-3 bg-rose-50/60 rounded-xl border border-rose-100/60 group">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px]">🗡️</span>
                        <span className="text-[10px] font-bold text-rose-600 truncate">{exchange.challenger}</span>
                    </div>
                    <p className="text-[11px] text-gray-700 leading-relaxed">
                        {exchange.challengerArgument}
                    </p>
                </div>

                {/* 防守方 */}
                <div className="relative p-3 bg-blue-50/60 rounded-xl border border-blue-100/60 group">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px]">🛡️</span>
                        <span className="text-[10px] font-bold text-blue-600 truncate">{exchange.defender}</span>
                    </div>
                    <p className="text-[11px] text-gray-700 leading-relaxed">
                        {exchange.defenderRebuttal}
                    </p>
                </div>
            </div>

            {/* 裁判判定 */}
            <div className="mt-2 text-[10px] text-gray-500 pl-3 border-l-2 border-gray-200 leading-relaxed">
                ⚖️ {exchange.outcomeReasoning}
            </div>

            {/* 证据折叠 */}
            {hasEvidence && (
                <div className="mt-1.5">
                    <button
                        onClick={() => setShowEvidence(!showEvidence)}
                        className="text-[9px] text-gray-400 hover:text-gray-600 transition-colors font-mono flex items-center gap-1"
                    >
                        {showEvidence ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        {isZh ? '证据引用' : 'Evidence'} ({exchange.challengerEvidence.length + exchange.defenderEvidence.length})
                    </button>
                    <AnimatePresence>
                        {showEvidence && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    {exchange.challengerEvidence.map((e, i) => (
                                        <span key={`c-${i}`} className="text-[8px] bg-rose-100/50 text-rose-600 rounded px-1.5 py-0.5 font-mono" title={e}>
                                            📎 {e.length > 35 ? e.slice(0, 35) + '…' : e}
                                        </span>
                                    ))}
                                    {exchange.defenderEvidence.map((e, i) => (
                                        <span key={`d-${i}`} className="text-[8px] bg-blue-100/50 text-blue-600 rounded px-1.5 py-0.5 font-mono" title={e}>
                                            📎 {e.length > 35 ? e.slice(0, 35) + '…' : e}
                                        </span>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
}


/* ────────────────────────────── 单场辩论卡片 ────────────────────────────── */

function DebateSessionCard({ session, isZh, index }: { session: DebateSession; isZh: boolean; index: number }) {
    const [expanded, setExpanded] = useState(index === 0);

    // 计算双方胜场
    const proWins = session.exchanges.filter(e =>
        (e.outcome === 'challenger_wins' && e.challenger === session.proAgent) ||
        (e.outcome === 'defender_wins' && e.defender === session.proAgent)
    ).length;
    const conWins = session.exchanges.filter(e =>
        (e.outcome === 'challenger_wins' && e.challenger === session.conAgent) ||
        (e.outcome === 'defender_wins' && e.defender === session.conAgent)
    ).length;
    const draws = session.exchanges.filter(e => e.outcome === 'draw').length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.12, duration: 0.35 }}
            className="rounded-2xl border border-gray-200 overflow-hidden bg-white hover:border-gray-300 transition-colors"
        >
            {/* 辩论标题栏 */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/80 transition-colors group"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-50 to-amber-50 border border-rose-100/50 flex items-center justify-center flex-shrink-0 group-hover:shadow-sm transition-shadow">
                        <Swords size={14} className="text-rose-500" />
                    </div>
                    <div className="text-left min-w-0">
                        <div className="font-bold text-sm text-gray-800 flex items-center gap-1.5 flex-wrap">
                            <span className="text-rose-500 truncate max-w-[80px]">{session.proAgent}</span>
                            <span className="text-gray-300 text-xs">vs</span>
                            <span className="text-blue-500 truncate max-w-[80px]">{session.conAgent}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                            <span className="truncate max-w-[200px]">{session.topic}</span>
                            <span className="bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded font-mono font-bold flex-shrink-0">Δ{session.scoreDivergence}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {/* 微型战绩 */}
                    <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono font-bold">
                        <span className="text-rose-400">{proWins}</span>
                        <span className="text-gray-200">:</span>
                        {draws > 0 && <><span className="text-gray-300">{draws}</span><span className="text-gray-200">:</span></>}
                        <span className="text-blue-400">{conWins}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${session.exchanges.length > 0 ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400'}`}>
                        {session.exchanges.length}R
                    </span>
                    <motion.div
                        animate={{ rotate: expanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown size={14} className="text-gray-400" />
                    </motion.div>
                </div>
            </button>

            {/* 展开的辩论详情 */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
                            {/* 比分条 */}
                            <ScoreBar proWins={proWins} conWins={conWins} draws={draws} proAgent={session.proAgent} conAgent={session.conAgent} />

                            {/* 交锋记录 */}
                            <div className="space-y-4">
                                {session.exchanges.map((exchange, idx) => (
                                    <ExchangeCard
                                        key={idx}
                                        exchange={exchange}
                                        idx={idx}
                                        isZh={isZh}
                                    />
                                ))}
                            </div>

                            {/* 优化3：辩论回放动画 */}
                            {session.exchanges.length > 0 && (
                                <DebateReplayTimeline exchanges={session.exchanges} isZh={isZh} />
                            )}

                            {/* 辩论裁决 */}
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <MessageCircle size={11} className="text-gray-400" />
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">
                                        {isZh ? 'VERDICT' : 'VERDICT'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-700 leading-relaxed">
                                    {session.verdict}
                                </p>
                            </div>

                            {/* 新洞察 + 评分修正 */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                {session.keyInsights.length > 0 && (
                                    <div className="flex-1 space-y-1.5">
                                        <div className="text-[9px] font-bold text-amber-500 flex items-center gap-1 uppercase tracking-wider font-mono">
                                            <Lightbulb size={10} />
                                            {isZh ? 'INSIGHTS' : 'INSIGHTS'}
                                        </div>
                                        {session.keyInsights.map((insight, idx) => (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, x: -8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.1 }}
                                                className="text-[10px] text-gray-600 bg-amber-50/60 px-2.5 py-1.5 rounded-lg border border-amber-100/60 leading-snug"
                                            >
                                                {insight}
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2 items-start">
                                    <ScoreDelta delta={session.scoreAdjustment.proAgentDelta} agentName={session.proAgent} />
                                    <ScoreDelta delta={session.scoreAdjustment.conAgentDelta} agentName={session.conAgent} />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}


// ==================== 主组件 ====================

const DebateTimeline: React.FC<DebateTimelineProps> = ({ debate, language = 'zh' }) => {
    if (!debate || !debate.triggered || debate.sessions.length === 0) {
        return null;
    }

    const isZh = language === 'zh';
    const totalRounds = debate.sessions.reduce((s, ss) => s + ss.exchanges.length, 0);

    return (
        <div className="w-full">
            {/* 顶部信息栏 — 简洁的仪表盘风格 */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow-sm">
                        <Zap size={16} className="text-white" />
                    </div>
                    <div>
                        <h4 className="text-sm font-extrabold text-gray-800 flex items-center gap-2">
                            <span className="bg-gradient-to-r from-rose-600 to-amber-600 text-transparent bg-clip-text">
                                NovoDebate
                            </span>
                            <span className="text-[9px] font-mono font-bold bg-gray-800 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                                {isZh ? '真对抗' : 'Adversarial'}
                            </span>
                        </h4>
                    </div>
                </div>
                {/* 统计标签 */}
                <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
                        <Hash size={10} />
                        <span className="font-bold text-gray-600">{debate.sessions.length}</span>
                        {isZh ? '场' : 'sessions'}
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
                        <Swords size={10} />
                        <span className="font-bold text-gray-600">{totalRounds}</span>
                        {isZh ? '轮' : 'rounds'}
                    </div>
                    {debate.totalDurationMs > 0 && (
                        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
                            <Clock size={10} />
                            <span className="font-bold text-gray-600">{(debate.totalDurationMs / 1000).toFixed(1)}s</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 触发原因 */}
            <div className="text-[10px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-4 border border-gray-100 font-mono">
                <span className="text-amber-500 mr-1">⚡</span> {debate.triggerReason}
            </div>

            {/* 对抗辩论拓扑可视化 */}
            <div className="mb-4">
                <NovoDebateVisualization
                    sessions={debate.sessions}
                    totalDurationMs={debate.totalDurationMs}
                    triggerReason={debate.triggerReason}
                    dissentReport={debate.dissentReport}
                    language={language}
                />
            </div>

            {/* 优化1：分歧热力图 */}
            {Array.isArray(debate.dissentReport) && debate.dissentReport.length > 0 && (
                <DissentHeatmap items={debate.dissentReport} isZh={isZh} />
            )}

            {/* 辩论场次列表 */}
            <div className="space-y-3">
                {debate.sessions.map((session, idx) => (
                    <DebateSessionCard
                        key={session.sessionId}
                        session={session}
                        isZh={isZh}
                        index={idx}
                    />
                ))}
            </div>

            {/* 结构化分歧报告 */}
            {debate.dissentReport && (
                Array.isArray(debate.dissentReport) && debate.dissentReport.length > 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-4 space-y-3"
                    >
                        <div className="text-[9px] font-mono font-bold text-amber-500 uppercase tracking-wider flex items-center gap-2">
                            <Lightbulb size={10} />
                            {isZh ? 'DISSENT REPORT — 专家分歧图谱' : 'DISSENT REPORT'}
                        </div>
                        {debate.dissentReport.map((item: DissentItem, idx: number) => {
                            const severityConfig = {
                                high: { label: isZh ? '高分歧' : 'High', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-700' },
                                medium: { label: isZh ? '中分歧' : 'Medium', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
                                low: { label: isZh ? '低分歧' : 'Low', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', badge: 'bg-gray-100 text-gray-600' },
                            };
                            const sev = severityConfig[item.severity] || severityConfig.medium;
                            const winnerIcon = item.winner === 'pro' ? '🏆' : item.winner === 'con' ? '🛡️' : '🤝';

                            return (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 + idx * 0.1 }}
                                    className={`rounded-xl border ${sev.border} ${sev.bg} p-3 space-y-2`}
                                >
                                    {/* 维度标题行 */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Swords size={12} className={sev.text} />
                                            <span className={`text-[11px] font-bold ${sev.text} truncate`}>{item.dimension}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${sev.badge}`}>{sev.label}</span>
                                            <span className="text-[8px] font-mono text-gray-400">{item.roundsDebated}R</span>
                                            <span className="text-[10px]">{winnerIcon}</span>
                                        </div>
                                    </div>
                                    {/* 正反方立场对比 */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="p-2 bg-white/95 rounded-lg border border-rose-100/50">
                                            <div className="text-[9px] font-bold text-rose-500 mb-1 flex items-center gap-1">
                                                <span>🗡️</span> {item.proAgent}
                                            </div>
                                            <ExpandablePosition text={item.proPosition} />
                                        </div>
                                        <div className="p-2 bg-white/95 rounded-lg border border-blue-100/50">
                                            <div className="text-[9px] font-bold text-blue-500 mb-1 flex items-center gap-1">
                                                <span>🛡️</span> {item.conAgent}
                                            </div>
                                            <ExpandablePosition text={item.conPosition} />
                                        </div>
                                    </div>
                                    {/* 裁决结论 */}
                                    <div className="text-[10px] text-gray-500 pl-2 border-l-2 border-gray-200 leading-relaxed line-clamp-2">
                                        ⚖️ {item.resolution}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                ) : typeof debate.dissentReport === 'string' && debate.dissentReport.trim().length > 0 ? (
                    /* 兼容旧版字符串格式 */
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-4 p-3 bg-amber-50/50 rounded-xl border border-amber-100/60"
                    >
                        <div className="text-[9px] font-mono font-bold text-amber-500 uppercase tracking-wider mb-1">
                            {isZh ? 'DISSENT REPORT' : 'DISSENT REPORT'}
                        </div>
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                            {debate.dissentReport}
                        </p>
                    </motion.div>
                ) : null
            )}
        </div>
    );
};

export default React.memo(DebateTimeline);
