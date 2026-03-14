'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Swords, Trophy, Shield, Handshake,
    Zap, Hash, Clock, TrendingUp, TrendingDown, Minus, Lightbulb, AlertTriangle
} from 'lucide-react';

// ==================== NovoDebate 对抗辩论拓扑可视化组件 ====================

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

interface NovoDebateVisualizationProps {
    sessions: DebateSession[];
    totalDurationMs: number;
    triggerReason: string;
    dissentReport?: DissentItem[] | string;
    language?: 'zh' | 'en';
}

/* ────────────────────── SVG 流动动画样式 ────────────────────── */

const flowAnimationCSS = `
@keyframes novodebate-flow-pro {
    0% { stroke-dashoffset: 20; }
    100% { stroke-dashoffset: 0; }
}
@keyframes novodebate-flow-con {
    0% { stroke-dashoffset: -20; }
    100% { stroke-dashoffset: 0; }
}
@keyframes novodebate-flow-down {
    0% { stroke-dashoffset: 16; }
    100% { stroke-dashoffset: 0; }
}
.novodebate-flow-pro {
    animation: novodebate-flow-pro 1.2s linear infinite;
}
.novodebate-flow-con {
    animation: novodebate-flow-con 1.2s linear infinite;
}
.novodebate-flow-down {
    animation: novodebate-flow-down 1.5s linear infinite;
}
`;

/* ────────────────────── Agent 节点卡片 ────────────────────── */

function AgentNode({ name, side, wins, losses, draws, delta, delay, isZh }: {
    name: string;
    side: 'pro' | 'con';
    wins: number;
    losses: number;
    draws: number;
    delta: number;
    delay: number;
    isZh: boolean;
}) {
    const isPro = side === 'pro';
    const config = isPro
        ? { icon: '⚔️', color: 'text-rose-600', bgColor: 'bg-rose-100', borderColor: 'border-rose-200', barColor: 'bg-rose-500', gradient: 'from-rose-50 to-orange-50' }
        : { icon: '🛡️', color: 'text-blue-600', bgColor: 'bg-blue-100', borderColor: 'border-blue-200', barColor: 'bg-blue-500', gradient: 'from-blue-50 to-indigo-50' };

    const DeltaIcon = delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
    const deltaColor = delta === 0 ? 'text-gray-400' : delta > 0 ? 'text-emerald-600' : 'text-rose-600';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            className={`relative p-3 rounded-2xl border ${config.borderColor} bg-white shadow-sm hover:shadow-md transition-shadow z-10 w-full md:w-52`}
        >
            {/* Agent 头部 */}
            <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${config.gradient} ${config.color} flex items-center justify-center`}>
                    <span className="text-sm">{config.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <span className="font-bold text-gray-800 text-xs block truncate">{name}</span>
                    <span className={`text-[9px] font-mono font-bold ${config.color} uppercase`}>
                        {isPro ? (isZh ? '挑战方' : 'Challenger') : (isZh ? '防守方' : 'Defender')}
                    </span>
                </div>
            </div>

            {/* 战绩 */}
            <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono font-bold text-gray-400">
                    <span>{isZh ? '战绩' : 'Record'}</span>
                    <span className="flex items-center gap-1.5">
                        <span className="text-emerald-500">{wins}W</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-400">{draws}D</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-rose-400">{losses}L</span>
                    </span>
                </div>
                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                        className={`h-full ${config.barColor}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${((wins + draws * 0.5) / Math.max(1, wins + draws + losses)) * 100}%` }}
                        transition={{ duration: 1, delay: delay + 0.2 }}
                    />
                </div>
                {/* 评分修正 */}
                <div className={`flex items-center justify-center gap-1 text-[10px] font-bold ${deltaColor} mt-1`}>
                    <DeltaIcon size={10} />
                    <span className="font-mono">{delta === 0 ? '±0' : `${delta > 0 ? '+' : ''}${delta}`}</span>
                    <span className="text-gray-400 font-normal">{isZh ? '分' : 'pts'}</span>
                </div>
            </div>
        </motion.div>
    );
}

/* ────────────────────── 优化1：微型时间线圆点 ────────────────────── */

function RoundDots({ sessions, isZh }: { sessions: DebateSession[]; isZh: boolean }) {
    // 将所有 exchange 扁平化为结果序列
    const allOutcomes = sessions.flatMap(s =>
        s.exchanges.map(e => ({
            outcome: e.outcome,
            challenger: e.challenger,
            defender: e.defender,
            reasoning: e.outcomeReasoning,
            round: e.round,
            session: s.topic,
        }))
    );

    if (allOutcomes.length === 0) return null;

    const dotConfig = {
        challenger_wins: { color: 'bg-rose-400', ring: 'ring-rose-200', label: isZh ? '挑战方胜' : 'Challenger wins' },
        defender_wins: { color: 'bg-blue-400', ring: 'ring-blue-200', label: isZh ? '防守方胜' : 'Defender wins' },
        draw: { color: 'bg-gray-300', ring: 'ring-gray-200', label: isZh ? '平局' : 'Draw' },
    };

    return (
        <div className="mt-3 pt-2 border-t border-gray-100">
            <div className="text-[8px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {isZh ? '轮次时间线' : 'Round Timeline'}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
                {allOutcomes.map((o, idx) => {
                    const cfg = dotConfig[o.outcome] || dotConfig.draw;
                    return (
                        <motion.div
                            key={idx}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.5 + idx * 0.08, type: 'spring', stiffness: 400, damping: 20 }}
                            className={`w-3.5 h-3.5 rounded-full ${cfg.color} ring-2 ${cfg.ring} cursor-default transition-transform hover:scale-125`}
                            title={`R${o.round} — ${cfg.label}\n${o.challenger} vs ${o.defender}\n${o.reasoning}`}
                        />
                    );
                })}
            </div>
            {/* 图例 */}
            <div className="flex items-center gap-3 mt-1.5 text-[8px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" />{isZh ? '挑战方胜' : 'Pro'}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />{isZh ? '防守方胜' : 'Con'}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" />{isZh ? '平局' : 'Draw'}</span>
            </div>
        </div>
    );
}

/* ────────────────────── 中央竞技场节点（含微型时间线） ────────────────────── */

function ArenaNode({ sessions, totalDurationMs, totalRounds, delay, isZh }: {
    sessions: DebateSession[];
    totalDurationMs: number;
    totalRounds: number;
    delay: number;
    isZh: boolean;
}) {
    // 聚合所有 session 的比分
    let totalProWins = 0, totalConWins = 0, totalDraws = 0;
    sessions.forEach(s => {
        s.exchanges.forEach(e => {
            if (e.outcome === 'challenger_wins') totalProWins++;
            else if (e.outcome === 'defender_wins') totalConWins++;
            else totalDraws++;
        });
    });

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, duration: 0.5 }}
            className="relative p-4 rounded-3xl border-2 border-amber-200 bg-white shadow-lg overflow-hidden w-full md:w-64 z-10"
        >
            {/* 装饰光斑 */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full blur-[30px] -z-10 transform translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-20 h-20 bg-rose-50 rounded-full blur-[25px] -z-10 transform -translate-x-1/2 translate-y-1/2" />

            {/* 竞技场标题 */}
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-100 to-rose-100">
                    <Swords size={20} className="text-amber-600" />
                </div>
                <div>
                    <span className="font-black text-gray-900 block text-sm">{isZh ? '辩论竞技场' : 'Debate Arena'}</span>
                    <span className="text-[10px] text-amber-600 font-bold">{isZh ? '真对抗引擎' : 'Adversarial Engine'}</span>
                </div>
            </div>

            {/* 统计信息 */}
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <div className="bg-gray-50 rounded-lg p-1.5">
                    <div className="text-xs font-black text-gray-800">{sessions.length}</div>
                    <div className="text-[8px] text-gray-400 font-mono">{isZh ? '场次' : 'SESSIONS'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-1.5">
                    <div className="text-xs font-black text-gray-800">{totalRounds}</div>
                    <div className="text-[8px] text-gray-400 font-mono">{isZh ? '交锋' : 'ROUNDS'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-1.5">
                    <div className="text-xs font-black text-gray-800">{totalDurationMs > 0 ? `${(totalDurationMs / 1000).toFixed(1)}s` : 'N/A'}</div>
                    <div className="text-[8px] text-gray-400 font-mono">{isZh ? '耗时' : 'TIME'}</div>
                </div>
            </div>

            {/* 比分条 */}
            <div className="space-y-1.5">
                <div className="flex justify-between text-[9px] font-bold font-mono">
                    <span className="text-rose-500 flex items-center gap-1">
                        ⚔️ {isZh ? '挑战方' : 'PRO'}
                        <span className="bg-rose-50 px-1 rounded">{totalProWins}</span>
                    </span>
                    {totalDraws > 0 && <span className="text-gray-400">{totalDraws} {isZh ? '平' : 'D'}</span>}
                    <span className="text-blue-500 flex items-center gap-1">
                        <span className="bg-blue-50 px-1 rounded">{totalConWins}</span>
                        {isZh ? '防守方' : 'CON'} 🛡️
                    </span>
                </div>
                <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100 gap-px">
                    {totalProWins > 0 && (
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(totalProWins / Math.max(1, totalProWins + totalConWins + totalDraws)) * 100}%` }}
                            transition={{ duration: 0.8, delay: delay + 0.3 }}
                            className="bg-rose-400 rounded-l-full"
                        />
                    )}
                    {totalDraws > 0 && (
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(totalDraws / Math.max(1, totalProWins + totalConWins + totalDraws)) * 100}%` }}
                            transition={{ duration: 0.8, delay: delay + 0.5 }}
                            className="bg-gray-300"
                        />
                    )}
                    {totalConWins > 0 && (
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(totalConWins / Math.max(1, totalProWins + totalConWins + totalDraws)) * 100}%` }}
                            transition={{ duration: 0.8, delay: delay + 0.7 }}
                            className="bg-blue-400 rounded-r-full"
                        />
                    )}
                </div>
            </div>

            {/* 优化1：微型时间线 — 每轮用圆点色块表示胜负 */}
            <RoundDots sessions={sessions} isZh={isZh} />
        </motion.div>
    );
}

/* ────────────────────── 优化2：分歧维度标注（带 hover 浮层） ────────────────────── */

function DissentDimensionTags({ items, isZh }: { items: DissentItem[]; isZh: boolean }) {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    if (items.length === 0) return null;

    const sevConfig = {
        high: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
        medium: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
        low: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
    };

    return (
        <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="text-[8px] font-mono font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <AlertTriangle size={8} />
                {isZh ? '分歧维度' : 'Dissent Dimensions'}
            </div>
            <div className="flex flex-wrap gap-1.5">
                {items.map((item, idx) => {
                    const sev = sevConfig[item.severity] || sevConfig.medium;
                    const winnerIcon = item.winner === 'pro' ? '⚔️' : item.winner === 'con' ? '🛡️' : '⚖️';

                    return (
                        <div
                            key={idx}
                            className="relative"
                            onMouseEnter={() => setHoverIdx(idx)}
                            onMouseLeave={() => setHoverIdx(null)}
                        >
                            {/* 标签 pill */}
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.6 + idx * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                                className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[9px] font-bold cursor-default transition-all ${sev.bg} ${sev.text} ${sev.border} hover:shadow-md hover:scale-105`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${sev.dot} flex-shrink-0`} />
                                <span className="truncate max-w-[80px]">{item.dimension}</span>
                                <span className="text-[8px] opacity-70">{winnerIcon}</span>
                            </motion.div>

                            {/* hover 浮层 */}
                            {hoverIdx === idx && (
                                <motion.div
                                    initial={{ opacity: 0, y: 4, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-white rounded-xl border border-gray-200 shadow-xl z-50 pointer-events-none"
                                >
                                    <div className="text-[10px] font-bold text-gray-800 mb-1.5">{item.dimension}</div>
                                    <div className="space-y-1.5 text-[9px]">
                                        <div className="flex items-start gap-1.5">
                                            <span className="text-rose-500 flex-shrink-0">⚔️</span>
                                            <div>
                                                <span className="font-bold text-rose-600">{item.proAgent}</span>
                                                <p className="text-gray-500 leading-snug mt-0.5 line-clamp-2">{item.proPosition}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-1.5">
                                            <span className="text-blue-500 flex-shrink-0">🛡️</span>
                                            <div>
                                                <span className="font-bold text-blue-600">{item.conAgent}</span>
                                                <p className="text-gray-500 leading-snug mt-0.5 line-clamp-2">{item.conPosition}</p>
                                            </div>
                                        </div>
                                        <div className="pt-1 border-t border-gray-100 text-gray-400 flex items-center gap-2">
                                            <span>{item.roundsDebated}R</span>
                                            <span>·</span>
                                            <span className={sev.text}>{item.severity === 'high' ? (isZh ? '高分歧' : 'High') : item.severity === 'medium' ? (isZh ? '中分歧' : 'Med') : (isZh ? '低分歧' : 'Low')}</span>
                                            <span>·</span>
                                            <span>{winnerIcon} {item.winner === 'pro' ? item.proAgent : item.winner === 'con' ? item.conAgent : (isZh ? '平局' : 'Draw')}</span>
                                        </div>
                                        {item.resolution && (
                                            <div className="text-gray-400 italic line-clamp-2 pt-0.5">⚖️ {item.resolution}</div>
                                        )}
                                    </div>
                                    {/* 小三角 */}
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-gray-200 rotate-45" />
                                </motion.div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ────────────────────── 裁决结论节点 ────────────────────── */

function VerdictNode({ sessions, delay, isZh }: {
    sessions: DebateSession[];
    delay: number;
    isZh: boolean;
}) {
    const allInsights = sessions.flatMap(s => s.keyInsights).filter(Boolean);
    const verdictText = sessions.map(s => s.verdict).filter(Boolean).join(' ');

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.4 }}
            className="relative p-3 rounded-2xl border border-emerald-200 bg-white shadow-sm hover:shadow-md transition-shadow z-10 w-full md:w-52"
        >
            <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
                    <Trophy size={16} />
                </div>
                <div>
                    <span className="font-bold text-gray-800 text-xs">{isZh ? '辩论裁决' : 'Verdict'}</span>
                    <div className="text-[9px] text-emerald-600 font-bold font-mono uppercase">{isZh ? '最终结论' : 'FINAL'}</div>
                </div>
            </div>

            {verdictText && (
                <div className="p-2 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 mb-2">
                    <p className="text-[10px] text-gray-700 font-medium leading-relaxed line-clamp-3 italic">
                        &ldquo;{verdictText}&rdquo;
                    </p>
                </div>
            )}

            {allInsights.length > 0 && (
                <div className="space-y-1">
                    <div className="text-[8px] font-mono font-bold text-amber-500 uppercase flex items-center gap-1">
                        <Lightbulb size={8} />
                        INSIGHTS ({allInsights.length})
                    </div>
                    {allInsights.slice(0, 2).map((insight, idx) => (
                        <div key={idx} className="text-[9px] text-gray-500 bg-amber-50/60 px-2 py-1 rounded-lg border border-amber-100/60 leading-snug line-clamp-2">
                            {insight}
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}

// ==================== 主组件 ====================

const NovoDebateVisualization: React.FC<NovoDebateVisualizationProps> = ({
    sessions,
    totalDurationMs,
    triggerReason,
    dissentReport,
    language = 'zh',
}) => {
    const isZh = language === 'zh';
    if (!sessions || sessions.length === 0) return null;

    const totalRounds = sessions.reduce((s, ss) => s + ss.exchanges.length, 0);

    // 聚合所有参与的 agent（去重）
    const proAgents = new Set<string>();
    const conAgents = new Set<string>();
    sessions.forEach(s => {
        proAgents.add(s.proAgent);
        conAgents.add(s.conAgent);
    });

    // 聚合 pro/con 方的统计
    const proStats = { wins: 0, losses: 0, draws: 0, delta: 0 };
    const conStats = { wins: 0, losses: 0, draws: 0, delta: 0 };

    sessions.forEach(s => {
        s.exchanges.forEach(e => {
            const proIsChallenger = e.challenger === s.proAgent;
            if (e.outcome === 'challenger_wins') {
                if (proIsChallenger) { proStats.wins++; conStats.losses++; }
                else { conStats.wins++; proStats.losses++; }
            } else if (e.outcome === 'defender_wins') {
                if (proIsChallenger) { conStats.wins++; proStats.losses++; }
                else { proStats.wins++; conStats.losses++; }
            } else {
                proStats.draws++;
                conStats.draws++;
            }
        });
        proStats.delta += s.scoreAdjustment?.proAgentDelta || 0;
        conStats.delta += s.scoreAdjustment?.conAgentDelta || 0;
    });

    const proName = Array.from(proAgents).join(' / ');
    const conName = Array.from(conAgents).join(' / ');

    // 分歧维度数据
    const dissentItems: DissentItem[] = Array.isArray(dissentReport) ? dissentReport : [];

    return (
        <div className="w-full bg-slate-50 rounded-3xl p-6 md:p-8 border border-slate-200 shadow-inner overflow-x-auto md:overflow-hidden relative flex flex-col justify-center transition-all">
            {/* 优化3：注入 SVG 流动动画 CSS */}
            <style dangerouslySetInnerHTML={{ __html: flowAnimationCSS }} />

            <div className="w-full mx-auto">
                {/* 标题行 */}
                <div className="mb-6 relative z-10 text-center md:text-left">
                    <h3 className="text-lg font-extrabold text-slate-800 flex items-center justify-center md:justify-start gap-2">
                        <span className="bg-gradient-to-r from-rose-600 to-amber-600 text-transparent bg-clip-text">
                            {isZh ? 'NovoDebate 对抗辩论拓扑' : 'NovoDebate Adversarial Topology'}
                        </span>
                        <span className="text-[10px] bg-slate-800 text-white px-2 py-1 rounded-full uppercase tracking-wider font-bold">
                            {isZh ? '真对抗' : 'Adversarial'}
                        </span>
                    </h3>
                    {/* 触发原因 */}
                    <p className="text-[10px] text-gray-400 font-mono mt-1 flex items-center gap-1 justify-center md:justify-start">
                        <Zap size={10} className="text-amber-400" />
                        {triggerReason.length > 80 ? triggerReason.slice(0, 80) + '…' : triggerReason}
                    </p>
                </div>

                {/* 拓扑流向图 */}
                <div className="relative flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 pt-2 pb-2">

                    {/* 优化3：SVG 连接线 + 流动动画（桌面端） */}
                    <div className="absolute inset-0 hidden md:block pointer-events-none" style={{ zIndex: 0 }}>
                        <svg className="w-full h-full" preserveAspectRatio="none">
                            {/* 挑战方 → 竞技场（红色流动） */}
                            <path
                                d="M 210 100 C 260 100, 300 120, 360 120"
                                fill="none"
                                stroke="#fca5a5"
                                strokeWidth="2.5"
                                strokeDasharray="6 4"
                                className="novodebate-flow-pro"
                            />
                            {/* 挑战方 → 竞技场 底层光晕 */}
                            <path
                                d="M 210 100 C 260 100, 300 120, 360 120"
                                fill="none"
                                stroke="#fca5a580"
                                strokeWidth="6"
                                strokeDasharray="6 4"
                                className="novodebate-flow-pro"
                                style={{ filter: 'blur(3px)' }}
                            />

                            {/* 竞技场 → 防守方（蓝色流动） */}
                            <path
                                d="M 580 120 C 620 120, 660 100, 720 100"
                                fill="none"
                                stroke="#93c5fd"
                                strokeWidth="2.5"
                                strokeDasharray="6 4"
                                className="novodebate-flow-con"
                            />
                            {/* 竞技场 → 防守方 底层光晕 */}
                            <path
                                d="M 580 120 C 620 120, 660 100, 720 100"
                                fill="none"
                                stroke="#93c5fd80"
                                strokeWidth="6"
                                strokeDasharray="6 4"
                                className="novodebate-flow-con"
                                style={{ filter: 'blur(3px)' }}
                            />

                            {/* 竞技场 → 裁决（绿色流动） */}
                            <path
                                d="M 490 200 C 490 230, 490 240, 490 250"
                                fill="none"
                                stroke="#6ee7b7"
                                strokeWidth="2.5"
                                strokeDasharray="4 4"
                                className="novodebate-flow-down"
                            />
                        </svg>
                    </div>

                    {/* 左侧：挑战方 */}
                    <div className="flex flex-col gap-3 relative z-10 w-full md:w-auto">
                        <div className="text-center md:absolute md:-top-8 md:left-1/2 md:-translate-x-1/2 w-full">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-slate-50 px-2">
                                {isZh ? '挑战方 PRO' : 'Challenger PRO'}
                            </span>
                        </div>
                        <AgentNode
                            name={proName}
                            side="pro"
                            wins={proStats.wins}
                            losses={proStats.losses}
                            draws={proStats.draws}
                            delta={proStats.delta}
                            delay={0.1}
                            isZh={isZh}
                        />
                    </div>

                    {/* 移动端纵向连接箭头 */}
                    <div className="flex md:hidden items-center justify-center py-1">
                        <div className="w-0.5 h-6 bg-rose-200 relative">
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-rose-300 text-xs">▼</span>
                        </div>
                    </div>

                    {/* 中央：竞技场 */}
                    <div className="flex flex-col justify-center items-center relative z-10 w-full md:w-auto">
                        <div className="text-center md:absolute md:-top-8 md:left-1/2 md:-translate-x-1/2 w-full">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-slate-50 px-2">
                                {isZh ? '辩论场 ARENA' : 'Debate ARENA'}
                            </span>
                        </div>
                        <ArenaNode
                            sessions={sessions}
                            totalDurationMs={totalDurationMs}
                            totalRounds={totalRounds}
                            delay={0.3}
                            isZh={isZh}
                        />
                    </div>

                    {/* 移动端纵向连接箭头 */}
                    <div className="flex md:hidden items-center justify-center py-1">
                        <div className="w-0.5 h-6 bg-blue-200 relative">
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-blue-300 text-xs">▼</span>
                        </div>
                    </div>

                    {/* 右侧：防守方 */}
                    <div className="flex flex-col gap-3 relative z-10 w-full md:w-auto">
                        <div className="text-center md:absolute md:-top-8 md:left-1/2 md:-translate-x-1/2 w-full">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-slate-50 px-2">
                                {isZh ? '防守方 CON' : 'Defender CON'}
                            </span>
                        </div>
                        <AgentNode
                            name={conName}
                            side="con"
                            wins={conStats.wins}
                            losses={conStats.losses}
                            draws={conStats.draws}
                            delta={conStats.delta}
                            delay={0.2}
                            isZh={isZh}
                        />
                    </div>
                </div>

                {/* 底部：裁决区 */}
                <div className="mt-4 flex justify-center">
                    <div className="flex md:hidden items-center justify-center pb-2">
                        <div className="w-0.5 h-4 bg-emerald-200 relative">
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-emerald-300 text-xs">▼</span>
                        </div>
                    </div>
                </div>
                <div className="flex justify-center">
                    <VerdictNode sessions={sessions} delay={0.5} isZh={isZh} />
                </div>

                {/* 优化2：分歧维度标注（带 hover 浮层） */}
                {dissentItems.length > 0 && (
                    <DissentDimensionTags items={dissentItems} isZh={isZh} />
                )}

                {/* 统计标签行 */}
                <div className="flex items-center justify-center gap-3 mt-4 text-[10px] font-mono text-gray-400">
                    <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-gray-100">
                        <Hash size={10} />
                        <span className="font-bold text-gray-600">{sessions.length}</span>
                        {isZh ? '场' : 'sessions'}
                    </div>
                    <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-gray-100">
                        <Swords size={10} />
                        <span className="font-bold text-gray-600">{totalRounds}</span>
                        {isZh ? '轮' : 'rounds'}
                    </div>
                    {totalDurationMs > 0 && (
                        <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-gray-100">
                            <Clock size={10} />
                            <span className="font-bold text-gray-600">{(totalDurationMs / 1000).toFixed(1)}s</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(NovoDebateVisualization);
