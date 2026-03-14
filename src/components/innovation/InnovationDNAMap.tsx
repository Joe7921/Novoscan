/**
 * NovoDNA 创新图谱可视化组件（NovoDNA Map v2）
 *
 * v2 升级内容：
 * 1. 新增 🧬 基因变异推荐器 — "如果改变 X 维度 → 蓝海机会"
 * 2. 新增 📊 创新密度分析 — 独特性评分 + 维度拥挤度热力指示
 * 3. 增强 ✨ 星空图谱 — 漂浮粒子背景 + 同心波纹
 * 4. 增强 🔍 邻居对比 — 展开后显示详细向量对比
 * 5. 增强 💡 空白地带 — 与变异建议联动
 */
'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, Dna, Sparkles, Target, Compass, Lightbulb,
    Zap, TrendingUp, Shield, AlertTriangle, ArrowRight
} from 'lucide-react';

// ==================== 类型定义 ====================

interface DNADimensionResult {
    key: string;
    value: number;
    reasoning: string;
}

interface DNANeighbor {
    id: number;
    query: string;
    vector: number[];
    distance: number;
    similarity: 'high' | 'medium' | 'low';
    domain?: { id: string; zh: string; en: string; color: string; emoji: string };
}

interface DNABlankZone {
    vector: number[];
    minDistToExisting: number;
    description: string;
}

interface MutationSuggestion {
    fromDimension: string;
    currentValue: number;
    suggestedValue: number;
    targetVector: number[];
    distanceGain: number;
    reasoning: string;
    opportunity: string;
    riskLevel: 'low' | 'medium' | 'high';
    nearestCompetitor?: {
        query: string;
        currentDistance: number;
        afterDistance: number;
    };
}

interface DimensionDensity {
    key: string;
    bins: Array<{ min: number; max: number; count: number }>;
    crowdedZone: number;
    emptyZone: number;
    currentPosition: 'crowded' | 'moderate' | 'unique';
}

interface DensityProfile {
    totalInnovations: number;
    overallCrowding: number;
    uniquenessScore: number;
    dimensionDensities: DimensionDensity[];
}

interface InnovationDNAMapData {
    query: string;
    vector: number[];
    dimensions: DNADimensionResult[];
    summary: string;
    neighbors: DNANeighbor[];
    blankZones: DNABlankZone[];
    mutations?: MutationSuggestion[];
    density?: DensityProfile | null;
}

interface InnovationDNAMapProps {
    data?: InnovationDNAMapData | null;
    language?: 'zh' | 'en';
}

// ==================== 常量 ====================

const DIM_LABELS: Record<string, { zh: string; en: string; emoji: string }> = {
    techPrinciple: { zh: '技术原理', en: 'Tech', emoji: '⚙️' },
    appScenario: { zh: '应用场景', en: 'Scenario', emoji: '🎯' },
    targetUser: { zh: '目标用户', en: 'Users', emoji: '👥' },
    implPath: { zh: '实现路径', en: 'Impl', emoji: '🛠️' },
    bizModel: { zh: '商业模式', en: 'Biz', emoji: '💰' },
};

const DIM_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// 基于 key 的颜色映射（避免因数组顺序不同导致颜色错位）
const DIM_COLOR_MAP: Record<string, string> = {
    techPrinciple: '#6366f1',  // 靛蓝
    appScenario: '#10b981',    // 翠绿
    targetUser: '#f59e0b',     // 橙色
    implPath: '#ef4444',       // 红色
    bizModel: '#8b5cf6',       // 紫色
};

const SIM_CFG = {
    high: { zh: '⚠️ 高度相似', en: '⚠️ Similar', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
    medium: { zh: '🔄 中等相似', en: '🔄 Moderate', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    low: { zh: '✅ 差异显著', en: '✅ Distinct', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
};

const RISK_CFG = {
    low: { zh: '低风险', en: 'Low Risk', icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    medium: { zh: '中风险', en: 'Med Risk', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    high: { zh: '高风险', en: 'High Risk', icon: Zap, color: 'text-rose-500', bg: 'bg-rose-500/10' },
};

const POSITION_CFG = {
    crowded: { zh: '竞争多', en: 'Crowded', color: '#f87171' },
    moderate: { zh: '适中', en: 'Moderate', color: '#fbbf24' },
    unique: { zh: '蓝海', en: 'Blue Ocean', color: '#34d399' },
};

// ==================== 子组件 ====================

/** 独特性评分仪表盘 */
const UniquenessGauge: React.FC<{ score: number; crowding: number; total: number; isZh: boolean }> = ({
    score, crowding, total, isZh
}) => {
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;
    const scoreColor = score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#f87171';

    return (
        <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 flex-shrink-0">
                <svg width="56" height="56" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="6" />
                    <motion.circle
                        cx="40" cy="40" r={radius} fill="none" stroke={scoreColor} strokeWidth="6"
                        strokeLinecap="round" strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: circumference - progress }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                        transform="rotate(-90 40 40)"
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                        className="text-sm font-black" style={{ color: scoreColor }}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                    >
                        {score}
                    </motion.span>
                    <span className="text-[7px] text-slate-400">/100</span>
                </div>
            </div>
            <div className="space-y-0.5 text-[11px]">
                <div className="flex items-center gap-1">
                    <TrendingUp size={11} style={{ color: scoreColor }} />
                    <span className="font-bold text-slate-700">{isZh ? '独特性评分' : 'Uniqueness'}</span>
                </div>
                <div className="text-slate-500">
                    {isZh ? `基因库共 ${total} 个创新` : `${total} in gene pool`}
                </div>
                <div className="text-slate-500">
                    {isZh ? `拥挤度` : 'Crowding'}:
                    <span className="font-mono ml-1" style={{ color: crowding > 0.6 ? '#ef4444' : crowding > 0.3 ? '#f59e0b' : '#10b981' }}>
                        {(crowding * 100).toFixed(0)}%
                    </span>
                </div>
            </div>
        </div>
    );
};

/** 维度密度热力图 — 支持点击查看详情 */
const DimensionHeatmap: React.FC<{ densities: DimensionDensity[]; vector: number[]; isZh: boolean }> = ({
    densities, vector, isZh
}) => {
    // 点击弹出气泡的 state：`${dimIdx}-${binIdx}` 或 null
    const [activeBin, setActiveBin] = useState<string | null>(null);

    return (
        <div className="space-y-1.5">
            {/* 区间说明（仅第一行上方） */}
            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 mb-0.5">
                <span className="w-14" />
                <div className="flex-1 flex justify-between px-0.5">
                    <span>{isZh ? '← 少人做' : '← Less'}</span>
                    <span>{isZh ? '多人做 →' : 'More →'}</span>
                </div>
                <span className="w-14" />
            </div>
            {densities.map((dim, idx) => {
                const label = DIM_LABELS[dim.key];
                const pos = POSITION_CFG[dim.currentPosition];
                const maxCount = Math.max(...dim.bins.map(b => b.count), 1);
                return (
                    <div key={dim.key} className="flex items-center gap-1.5 text-[11px]">
                        {/* 左侧：emoji + 中文维度名 */}
                        <span className="w-14 text-slate-600 truncate text-right text-[10px] font-medium">
                            {label?.emoji} {isZh ? label?.zh : label?.en}
                        </span>
                        {/* 5 段热力条 */}
                        <div className="flex-1 flex gap-0.5 h-6 relative">
                            {dim.bins.map((bin, bi) => {
                                const intensity = bin.count / maxCount;
                                const isCurrentBin = vector[idx] >= bin.min && vector[idx] < bin.max + (vector[idx] === 1 ? 0.01 : 0);
                                const binId = `${idx}-${bi}`;
                                const isActive = activeBin === binId;
                                return (
                                    <motion.div
                                        key={bi}
                                        className={`flex-1 rounded-sm relative cursor-pointer select-none
                                            ${isCurrentBin ? 'ring-2 ring-white/70 shadow-sm z-10' : ''}`}
                                        style={{
                                            backgroundColor: DIM_COLOR_MAP[dim.key] || DIM_COLORS[idx],
                                            opacity: 0.12 + intensity * 0.88,
                                        }}
                                        initial={{ scaleY: 0 }}
                                        animate={{ scaleY: 1 }}
                                        transition={{ delay: idx * 0.08 + bi * 0.04 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveBin(isActive ? null : binId);
                                        }}
                                    >
                                        {/* 条内数字标签 — 显示该区间的创新数量 */}
                                        {bin.count > 0 && (
                                            <span className={`absolute inset-0 flex items-center justify-center text-[8px] font-bold
                                                ${intensity > 0.5 ? 'text-white/90' : 'text-slate-600/70'}`}>
                                                {bin.count}
                                            </span>
                                        )}
                                        {/* 当前位置标记 — 醒目的蓝色圆点 + 脉冲动画 */}
                                        {isCurrentBin && (
                                            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                                <motion.div
                                                    className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-md border border-white"
                                                    animate={{ scale: [1, 1.3, 1] }}
                                                    transition={{ duration: 1.5, repeat: Infinity }}
                                                />
                                            </div>
                                        )}
                                        {/* 点击弹出气泡 */}
                                        <AnimatePresence>
                                            {isActive && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 4, scale: 0.9 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 4, scale: 0.9 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50
                                                        bg-slate-800 text-white text-[9px] rounded-lg px-2.5 py-1.5
                                                        shadow-xl whitespace-nowrap pointer-events-none"
                                                >
                                                    {/* 小三角 */}
                                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2
                                                        bg-slate-800 rotate-45" />
                                                    <div className="relative space-y-0.5">
                                                        <div className="font-bold">
                                                            {isZh
                                                                ? `区间 ${bin.min.toFixed(1)} - ${bin.max.toFixed(1)}`
                                                                : `Range ${bin.min.toFixed(1)} - ${bin.max.toFixed(1)}`}
                                                        </div>
                                                        <div>
                                                            {isZh
                                                                ? `${bin.count} 个同类创新`
                                                                : `${bin.count} similar innovations`}
                                                        </div>
                                                        {isCurrentBin && (
                                                            <div className="text-blue-300 font-bold">
                                                                🔵 {isZh ? '你在这里' : 'You are here'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </div>
                        {/* 右侧：竞争状态标签 */}
                        <span className="w-14 text-right font-bold text-[10px] flex-shrink-0"
                            style={{ color: pos.color }}>
                            {dim.currentPosition === 'crowded' && '⚠️ '}
                            {dim.currentPosition === 'unique' && '✅ '}
                            {isZh ? pos.zh : pos.en}
                        </span>
                    </div>
                );
            })}
            {/* 图例说明 */}
            <div className="flex items-center justify-center gap-3 pt-1 text-[9px] text-slate-400">
                <span className="flex items-center gap-1">
                    <motion.div className="w-2 h-2 bg-blue-500 rounded-full" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                    {isZh ? '= 你的位置' : '= Your position'}
                </span>
                <span>|</span>
                <span>{isZh ? '数字 = 该区间的同类创新数' : 'Number = innovations in this range'}</span>
                <span>|</span>
                <span>{isZh ? '点击查看详情' : 'Tap for details'}</span>
            </div>
        </div>
    );
};

/** 五维 DNA 雷达微图 */
const DNARadarMini: React.FC<{ vector: number[]; size?: number; isZh?: boolean }> = ({
    vector, size = 110, isZh = true
}) => {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.36;

    const getCoord = (value: number, index: number) => {
        const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
        return { x: cx + r * value * Math.cos(angle), y: cy + r * value * Math.sin(angle) };
    };

    const keys = ['techPrinciple', 'appScenario', 'targetUser', 'implPath', 'bizModel'];
    const dataPoints = vector.map((v, i) => getCoord(v, i));
    const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
            {/* 网格 */}
            {[0.25, 0.5, 0.75, 1.0].map(level => {
                const pts = Array.from({ length: 5 }, (_, i) => getCoord(level, i));
                const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
                return <path key={level} d={path} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth={level === 1 ? 1.5 : 0.6} />;
            })}
            {Array.from({ length: 5 }, (_, i) => {
                const end = getCoord(1, i);
                return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(148,163,184,0.08)" strokeWidth={0.5} />;
            })}
            {/* 数据 */}
            <motion.path d={dataPath} fill="url(#dnaG)" stroke="url(#dnaSG)" strokeWidth={2}
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }} style={{ transformOrigin: `${cx}px ${cy}px` }} />
            {dataPoints.map((p, i) => (
                <motion.circle key={i} cx={p.x} cy={p.y} r={3.5} fill={DIM_COLOR_MAP[keys[i]] || DIM_COLORS[i]} stroke="#0f172a" strokeWidth={1.5}
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.08 }} />
            ))}
            {/* 标签 */}
            {keys.map((key, i) => {
                const label = DIM_LABELS[key];
                const pos = getCoord(1.28, i);
                return (
                    <text key={i} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
                        className="text-[8px] font-bold fill-slate-500 select-none">
                        {label.emoji}
                    </text>
                );
            })}
            <defs>
                <linearGradient id="dnaG" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(99,102,241,0.2)" />
                    <stop offset="100%" stopColor="rgba(167,139,250,0.2)" />
                </linearGradient>
                <linearGradient id="dnaSG" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
            </defs>
        </svg>
    );
};

/** 向量条形图 */
const VectorBar: React.FC<{ value: number; color: string; label: string }> = ({ value, color, label }) => (
    <div className="flex items-center gap-1.5 text-[11px]">
        <span className="w-12 text-slate-500 truncate text-right">{label}</span>
        <div className="flex-1 h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
                initial={{ width: 0 }} animate={{ width: `${value * 100}%` }}
                transition={{ duration: 0.8 }} />
        </div>
        <span className="w-6 text-right font-mono font-bold text-[10px]" style={{ color }}>{value.toFixed(1)}</span>
    </div>
);

/** 星空图谱 v2 — 增加漂浮粒子和同心波纹 */
const ConstellationView: React.FC<{
    vector: number[]; neighbors: DNANeighbor[]; blankZones: DNABlankZone[]; isZh: boolean;
}> = ({ vector, neighbors, blankZones, isZh }) => {
    const w = 280, h = 200, cx = w / 2, cy = h / 2;

    const neighborPos = useMemo(() =>
        neighbors.slice(0, 6).map((n, i) => {
            const angle = (Math.PI * 2 * i) / Math.min(neighbors.length, 6) - Math.PI / 2;
            const dist = Math.min(n.distance * 85, 80);
            return { ...n, px: cx + dist * Math.cos(angle), py: cy + dist * Math.sin(angle) };
        }), [neighbors, cx, cy]);

    const blankPos = useMemo(() =>
        blankZones.slice(0, 3).map((z, i) => {
            const angle = (Math.PI * 2 * (i + 0.5)) / 3 + Math.PI / 6;
            return { ...z, px: cx + 90 * Math.cos(angle), py: cy + 75 * Math.sin(angle) };
        }), [blankZones, cx, cy]);

    // 随机漂浮粒子
    const particles = useMemo(() =>
        Array.from({ length: 12 }, (_, i) => ({
            x: Math.random() * w, y: Math.random() * h,
            r: 0.4 + Math.random() * 1, dur: 3 + Math.random() * 4, delay: Math.random() * 3,
        })), []);

    return (
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
            <defs>
                <radialGradient id="cGlow"><stop offset="0%" stopColor="rgba(99,102,241,0.35)" /><stop offset="100%" stopColor="rgba(99,102,241,0)" /></radialGradient>
                <radialGradient id="nGlow"><stop offset="0%" stopColor="rgba(52,211,153,0.3)" /><stop offset="100%" stopColor="rgba(52,211,153,0)" /></radialGradient>
                <radialGradient id="bGlow"><stop offset="0%" stopColor="rgba(251,191,36,0.3)" /><stop offset="100%" stopColor="rgba(251,191,36,0)" /></radialGradient>
            </defs>

            {/* 漂浮粒子 */}
            {particles.map((p, i) => (
                <motion.circle key={`p-${i}`} cx={p.x} cy={p.y} r={p.r}
                    fill="rgba(99,102,241,0.15)"
                    animate={{ opacity: [0.1, 0.4, 0.1], y: [p.y, p.y - 8, p.y] }}
                    transition={{ duration: p.dur, delay: p.delay, repeat: Infinity }} />
            ))}

            {/* 中心同心波纹 */}
            {[30, 55, 85].map((r, i) => (
                <motion.circle key={`ring-${i}`} cx={cx} cy={cy} r={r}
                    fill="none" stroke="rgba(99,102,241,0.1)" strokeWidth={0.5}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [0.9, 1.05, 0.9], opacity: [0.05, 0.12, 0.05] }}
                    transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.5 }}
                    style={{ transformOrigin: `${cx}px ${cy}px` }} />
            ))}

            {/* 连接线 */}
            {neighborPos.map((n, i) => (
                <motion.line key={`l-${i}`} x1={cx} y1={cy} x2={n.px} y2={n.py}
                    stroke={n.similarity === 'high' ? 'rgba(248,113,113,0.4)' : n.similarity === 'medium' ? 'rgba(251,191,36,0.3)' : 'rgba(52,211,153,0.2)'}
                    strokeWidth={n.similarity === 'high' ? 2 : 1}
                    strokeDasharray={n.similarity === 'low' ? '4 4' : 'none'}
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.12 }} />
            ))}

            {/* 空白地带 */}
            {blankPos.map((z, i) => (
                <g key={`b-${i}`}>
                    <circle cx={z.px} cy={z.py} r={14} fill="url(#bGlow)" />
                    <motion.circle cx={z.px} cy={z.py} r={5}
                        fill="rgba(251,191,36,0.25)" stroke="#fbbf24" strokeWidth={1.2} strokeDasharray="3 3"
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1 + i * 0.2 }} />
                    <text x={z.px} y={z.py + 14} textAnchor="middle" className="text-[7px] fill-amber-400/60 select-none">
                        💡
                    </text>
                </g>
            ))}

            {/* 邻居 */}
            {neighborPos.map((n, i) => (
                <g key={`n-${i}`}>
                    <circle cx={n.px} cy={n.py} r={16} fill="url(#nGlow)" />
                    <motion.circle cx={n.px} cy={n.py} r={4.5}
                        fill={n.similarity === 'high' ? '#f87171' : n.similarity === 'medium' ? '#fbbf24' : '#34d399'}
                        stroke="#0f172a" strokeWidth={1.5}
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 + i * 0.08, type: 'spring' }} />
                    <text x={n.px} y={n.py - 8} textAnchor="middle" className="text-[6px] fill-slate-500 font-medium select-none">
                        {n.query.length > 5 ? n.query.slice(0, 5) + '…' : n.query}
                    </text>
                    <text x={n.px} y={n.py + 11} textAnchor="middle" className="text-[5px] fill-slate-400 font-mono select-none">
                        {n.distance.toFixed(2)}
                    </text>
                </g>
            ))}

            {/* 中心 */}
            <circle cx={cx} cy={cy} r={20} fill="url(#cGlow)" />
            <motion.circle cx={cx} cy={cy} r={5} fill="#6366f1" stroke="#a5b4fc" strokeWidth={1.5}
                animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2.5, repeat: Infinity, repeatType: 'reverse' }} />
            <text x={cx} y={cy + 14} textAnchor="middle" className="text-[7px] fill-indigo-500 font-bold select-none">
                {isZh ? '你的创意' : 'Your Idea'}
            </text>
        </svg>
    );
};

// ==================== 主组件 ====================

const InnovationDNAMap: React.FC<InnovationDNAMapProps> = ({ data, language = 'zh' }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [expandedNeighbor, setExpandedNeighbor] = useState<number | null>(null);
    const [expandedMutation, setExpandedMutation] = useState<number | null>(null);
    const isZh = language === 'zh';

    if (!data?.vector || data.vector.length !== 5) return null;

    const { vector, dimensions, summary, neighbors, blankZones, mutations, density } = data;

    // 计算关键摘要指标
    const uniquenessScore = density?.uniquenessScore ?? 0;
    const scoreColor = uniquenessScore >= 70 ? '#34d399' : uniquenessScore >= 40 ? '#fbbf24' : '#f87171';
    const highSimCount = neighbors.filter(n => n.similarity === 'high').length;

    return (
        <div className="space-y-3">
            {/* ═══ 可折叠头部卡片 ═══ */}
            <div className="bg-white/95 rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
                {/* 标题行 — 始终可见，点击切换展开 */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full p-4 flex items-center gap-2.5 text-left hover:bg-indigo-50/30 transition-colors"
                >
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Dna className="text-indigo-500" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 text-sm">
                            {'NovoDNA'}
                            <span className="ml-1.5 text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-md">v2</span>
                        </h4>
                        <p className="text-[10px] text-indigo-400 font-medium">
                            {isZh ? '创新空间定位 — 和谁像、离蓝海多远' : 'Innovation space positioning — neighbors & blue ocean distance'}
                        </p>
                    </div>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* ═══ 折叠态摘要 — 仅在折叠时显示 ═══ */}
                {!isExpanded && (
                    <div className="px-4 pb-4 -mt-1 space-y-2.5">
                        {/* AI 一句话总结 */}
                        {summary && (
                            <div className="flex items-start gap-1.5 bg-indigo-50/60 rounded-lg px-2.5 py-1.5 border border-indigo-100/60">
                                <Lightbulb size={12} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                                <p className="text-[10px] text-indigo-700/80 leading-relaxed line-clamp-2">
                                    {summary}
                                </p>
                            </div>
                        )}

                        {/* 关键指标摘要行 */}
                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                            {/* 独特性评分 */}
                            {density && (
                                <span className="flex items-center gap-1 font-bold" style={{ color: scoreColor }}>
                                    <TrendingUp size={10} />
                                    {isZh ? '独特性' : 'Unique'} {uniquenessScore}
                                </span>
                            )}
                            {/* 邻居数 */}
                            {neighbors.length > 0 && (
                                <span className="text-slate-400">
                                    <Target size={9} className="inline mr-0.5" />
                                    {neighbors.length} {isZh ? '个邻居' : 'neighbors'}
                                </span>
                            )}
                            {/* 高相似警告 */}
                            {highSimCount > 0 && (
                                <span className="text-rose-500 font-medium">
                                    ⚠️ {highSimCount} {isZh ? '个高度相似' : 'highly similar'}
                                </span>
                            )}
                        </div>

                        {/* 五维得分条形图 — 带标签、进度条和数值 */}
                        <div className="flex items-start gap-3">
                            {/* 雷达微图 */}
                            <div className="flex-shrink-0">
                                <DNARadarMini vector={vector} size={64} isZh={isZh} />
                            </div>

                            {/* 五维带标签条形图 */}
                            <div className="flex-1 min-w-0 space-y-1">
                                {dimensions.map((dim, i) => {
                                    const color = DIM_COLOR_MAP[dim.key] || DIM_COLORS[i];
                                    const label = DIM_LABELS[dim.key];
                                    return (
                                        <div key={dim.key} className="flex items-center gap-1.5 text-[10px]">
                                            <span className="w-[52px] text-slate-500 truncate text-right flex-shrink-0">
                                                {label?.emoji} {isZh ? label?.zh : label?.en}
                                            </span>
                                            <div className="flex-1 h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full rounded-full"
                                                    style={{ backgroundColor: color }}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${dim.value * 100}%` }}
                                                    transition={{ delay: i * 0.06, duration: 0.5 }}
                                                />
                                            </div>
                                            <span className="w-5 text-right font-mono font-bold text-[9px] flex-shrink-0" style={{ color }}>
                                                {dim.value.toFixed(1)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 展开提示 */}
                        <div className="text-center">
                            <span className="text-[9px] text-slate-400">
                                {isZh ? '点击展开查看完整分析 ↑' : 'Click to expand full analysis ↑'}
                            </span>
                        </div>
                    </div>
                )}

                {/* ═══ 展开态完整内容 ═══ */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-4 space-y-3">
                                {/* 向量值 */}
                                <div className="flex justify-end">
                                    <div className="bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
                                        <span className="text-[9px] text-indigo-600 font-mono font-bold">
                                            [{vector.map(v => v.toFixed(1)).join(', ')}]
                                        </span>
                                    </div>
                                </div>

                                {/* 两栏：星空图谱 + 雷达/条形 */}
                                <div className="grid lg:grid-cols-2 gap-3">
                                    {/* 左：星空图谱 */}
                                    <div className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-200/60">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <Sparkles className="text-indigo-500" size={12} />
                                            <span className="text-[11px] font-bold text-slate-600">{isZh ? '创新图谱' : 'Innovation Map'}</span>
                                            {neighbors.length > 0 && (
                                                <span className="text-[9px] bg-slate-200/80 text-slate-500 px-1.5 py-0.5 rounded-full ml-auto">
                                                    {neighbors.length} {isZh ? '个邻居' : 'neighbors'}
                                                </span>
                                            )}
                                        </div>
                                        <ConstellationView vector={vector} neighbors={neighbors} blankZones={blankZones} isZh={isZh} />
                                    </div>

                                    {/* 右：雷达 + 条形 + 密度 */}
                                    <div className="space-y-2">
                                        <div className="flex justify-center">
                                            <DNARadarMini vector={vector} size={100} isZh={isZh} />
                                        </div>
                                        <div className="space-y-0.5 px-0.5">
                                            {dimensions.map((dim, i) => (
                                                <VectorBar key={dim.key} value={dim.value} color={DIM_COLOR_MAP[dim.key] || DIM_COLORS[i]}
                                                    label={`${DIM_LABELS[dim.key]?.emoji || ''} ${isZh ? DIM_LABELS[dim.key]?.zh : DIM_LABELS[dim.key]?.en}`} />
                                            ))}
                                        </div>
                                        {/* 独特性评分 */}
                                        {density && (
                                            <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/60">
                                                <UniquenessGauge score={density.uniquenessScore} crowding={density.overallCrowding}
                                                    total={density.totalInnovations} isZh={isZh} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ═══ 以下区块仅在展开时显示 ═══ */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25, delay: 0.1 }}
                        className="space-y-3"
                    >
                        {/* ═══ 密度热力图 ═══ */}
                        {density?.dimensionDensities && (
                            <div className="bg-white/95 rounded-xl p-3 border border-slate-200/60">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <div className="w-5 h-5 rounded-md bg-purple-100 flex items-center justify-center">
                                        <TrendingUp className="text-purple-500" size={11} />
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-600">{isZh ? '竞争密度分析' : 'Competition Density'}</span>
                                </div>
                                {/* 引导说明文案 */}
                                <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                                    {isZh
                                        ? `展示你的创新在 5 个维度上，与 ${density.totalInnovations} 个已有创新的竞争重叠程度。蓝色圆点标记你所在的位置。`
                                        : `Shows how your innovation overlaps with ${density.totalInnovations} existing ones across 5 dimensions. Blue dot marks your position.`}
                                </p>
                                <DimensionHeatmap densities={density.dimensionDensities} vector={vector} isZh={isZh} />
                            </div>
                        )}

                        {/* ═══ 基因变异推荐 ═══ */}
                        {mutations && mutations.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 px-0.5">
                                    <Zap size={12} className="text-violet-500" />
                                    {isZh ? '基因变异推荐 — 如何进入蓝海' : 'Gene Mutations — How to Enter Blue Ocean'}
                                </h4>
                                <div className="grid gap-2">
                                    {mutations.slice(0, 3).map((m, idx) => {
                                        const risk = RISK_CFG[m.riskLevel];
                                        const RiskIcon = risk.icon;
                                        const dimLabel = DIM_LABELS[m.fromDimension];
                                        const isMutExpanded = expandedMutation === idx;
                                        return (
                                            <motion.div key={idx}
                                                className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl border border-violet-200/50 hover:border-violet-300 transition-all cursor-pointer"
                                                initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.12 }}
                                                onClick={() => setExpandedMutation(isMutExpanded ? null : idx)}>
                                                <div className="p-3.5">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-1 min-w-0">
                                                            {/* 变异方向 */}
                                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                                <span className="text-xs font-bold text-violet-800">
                                                                    {dimLabel?.emoji} {isZh ? dimLabel?.zh : dimLabel?.en}
                                                                </span>
                                                                <span className="text-sm font-mono text-violet-400">{(m.currentValue ?? 0).toFixed(1)}</span>
                                                                <ArrowRight size={12} className="text-violet-400" />
                                                                <span className="text-sm font-mono font-bold text-violet-700">{(m.suggestedValue ?? 0).toFixed(1)}</span>
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${risk.bg} ${risk.color}`}>
                                                                    <RiskIcon size={9} className="inline mr-0.5" />
                                                                    {isZh ? risk.zh : risk.en}
                                                                </span>
                                                                <ChevronDown size={12} className={`text-violet-400 ml-auto transition-transform ${isMutExpanded ? 'rotate-180' : ''}`} />
                                                            </div>
                                                            {/* 描述 */}
                                                            <p className="text-[11px] text-violet-700 leading-relaxed mb-1">{m.opportunity}</p>
                                                            {/* 距离增益 */}
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 h-1.5 bg-violet-200/50 rounded-full overflow-hidden">
                                                                    <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-indigo-400"
                                                                        initial={{ width: 0 }} animate={{ width: `${Math.min((m.distanceGain ?? 0) * 200, 100)}%` }}
                                                                        transition={{ duration: 0.8, delay: 0.3 + idx * 0.1 }} />
                                                                </div>
                                                                <span className="text-[10px] font-mono text-violet-500 font-bold">+{(m.distanceGain ?? 0).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* 展开详情：向量对比 + 竞品信息 */}
                                                <AnimatePresence>
                                                    {isMutExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="overflow-hidden border-t border-violet-200/30">
                                                            <div className="p-3 space-y-2">
                                                                {/* 5 维向量对比 */}
                                                                <div className="space-y-1">
                                                                    {(m.targetVector ?? []).map((tv, di) => {
                                                                        const origVal = vector[di] ?? 0;
                                                                        const diff = tv - origVal;
                                                                        const dimKey = ['techPrinciple', 'appScenario', 'targetUser', 'implPath', 'bizModel'][di];
                                                                        const label = DIM_LABELS[dimKey];
                                                                        const isChanged = di === ['techPrinciple', 'appScenario', 'targetUser', 'implPath', 'bizModel'].indexOf(m.fromDimension);
                                                                        return (
                                                                            <div key={di} className={`flex items-center gap-2 text-[11px] ${isChanged ? 'font-bold' : ''}`}>
                                                                                <span className="w-16 text-slate-500">{label?.emoji} {isZh ? label?.zh : label?.en}</span>
                                                                                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
                                                                                    {/* 当前值（半透明） */}
                                                                                    <div className="absolute inset-0 rounded-full opacity-25"
                                                                                        style={{ width: `${origVal * 100}%`, backgroundColor: DIM_COLOR_MAP[dimKey] || DIM_COLORS[di] }} />
                                                                                    {/* 变异后值 */}
                                                                                    <motion.div className="absolute inset-0 rounded-full"
                                                                                        style={{ backgroundColor: isChanged ? '#7c3aed' : (DIM_COLOR_MAP[dimKey] || DIM_COLORS[di]), opacity: isChanged ? 0.8 : 0.5 }}
                                                                                        initial={{ width: `${origVal * 100}%` }}
                                                                                        animate={{ width: `${tv * 100}%` }}
                                                                                        transition={{ duration: 0.5, delay: di * 0.05 }} />
                                                                                </div>
                                                                                <span className="w-6 text-right font-mono text-[10px]" style={{ color: isChanged ? '#7c3aed' : '#94a3b8' }}>
                                                                                    {tv.toFixed(1)}
                                                                                </span>
                                                                                {isChanged && (
                                                                                    <span className={`text-[9px] font-mono ${diff > 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                                                                                        {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                {/* 竞品距离信息 */}
                                                                {m.nearestCompetitor && (
                                                                    <div className="flex items-center gap-1.5 text-[10px] text-violet-600 bg-violet-100/50 rounded-lg px-2.5 py-1.5">
                                                                        <Target size={10} className="text-violet-400 flex-shrink-0" />
                                                                        <span className="truncate">
                                                                            {isZh ? '最近竞品' : 'Nearest'}：{m.nearestCompetitor.query.length > 12 ? m.nearestCompetitor.query.slice(0, 12) + '…' : m.nearestCompetitor.query}
                                                                        </span>
                                                                        <span className="font-mono ml-auto flex-shrink-0">
                                                                            {m.nearestCompetitor.currentDistance.toFixed(2)}
                                                                            <ArrowRight size={8} className="inline mx-0.5" />
                                                                            <span className="font-bold text-emerald-600">{m.nearestCompetitor.afterDistance.toFixed(2)}</span>
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ═══ 最近邻卡片 ═══ */}
                        {neighbors.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 px-0.5">
                                    <Target size={12} />
                                    {isZh ? '基因距离最近的创新' : 'Nearest Neighbors'}
                                </h4>
                                <div className="grid gap-2">
                                    {neighbors.slice(0, 5).map((n, idx) => {
                                        const sim = SIM_CFG[n.similarity];
                                        const isNbrExpanded = expandedNeighbor === idx;
                                        return (
                                            <motion.div key={n.id || idx}
                                                className={`rounded-xl border ${sim.bg} transition-all cursor-pointer`}
                                                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.08 }}
                                                onClick={() => setExpandedNeighbor(isNbrExpanded ? null : idx)}>
                                                <div className="p-3 flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sim.bg} ${sim.color}`}>
                                                                {isZh ? sim.zh : sim.en}
                                                            </span>
                                                            {n.domain && n.domain.id !== 'other' && (
                                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full border font-medium"
                                                                    style={{ borderColor: n.domain.color + '40', color: n.domain.color, backgroundColor: n.domain.color + '10' }}>
                                                                    {n.domain.emoji} {isZh ? n.domain.zh : n.domain.en}
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] font-mono text-slate-500">d={n.distance.toFixed(2)}</span>
                                                            <ChevronDown size={12} className={`text-slate-400 ml-auto transition-transform ${isNbrExpanded ? 'rotate-180' : ''}`} />
                                                        </div>
                                                        <p className="text-xs font-medium text-slate-700 truncate">{n.query}</p>
                                                    </div>
                                                    {/* 微型向量对比 */}
                                                    <div className="flex gap-0.5 items-end h-7 flex-shrink-0">
                                                        {n.vector.map((v, i) => (
                                                            <div key={i} className="w-2 rounded-t-sm relative" style={{ height: '100%' }}>
                                                                <div className="absolute bottom-0 w-full rounded-t-sm opacity-25"
                                                                    style={{ height: `${vector[i] * 100}%`, backgroundColor: DIM_COLOR_MAP[dimensions[i]?.key] || DIM_COLORS[i] }} />
                                                                <div className="absolute bottom-0 w-full rounded-t-sm"
                                                                    style={{ height: `${v * 100}%`, backgroundColor: DIM_COLOR_MAP[dimensions[i]?.key] || DIM_COLORS[i] }} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                {/* 展开详情：逐维度对比 */}
                                                <AnimatePresence>
                                                    {isNbrExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="overflow-hidden border-t border-slate-200/10">
                                                            <div className="p-3 space-y-1.5">
                                                                {n.vector.map((v, i) => {
                                                                    const diff = v - vector[i];
                                                                    const label = DIM_LABELS[dimensions[i]?.key];
                                                                    return (
                                                                        <div key={i} className="flex items-center gap-2 text-[11px]">
                                                                            <span className="w-16 text-slate-500">{label?.emoji} {isZh ? label?.zh : label?.en}</span>
                                                                            <span className="w-6 text-right font-mono text-slate-400">{vector[i].toFixed(1)}</span>
                                                                            <ArrowRight size={10} className="text-slate-400" />
                                                                            <span className="w-6 font-mono font-bold" style={{ color: DIM_COLOR_MAP[dimensions[i]?.key] || DIM_COLORS[i] }}>{v.toFixed(1)}</span>
                                                                            <span className={`text-[10px] font-mono ${diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                                                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ═══ 空白地带 ═══ */}
                        {blankZones.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 px-0.5">
                                    <Compass size={12} />
                                    {isZh ? '创新空白地带' : 'Blank Zones'}
                                </h4>
                                <div className="grid sm:grid-cols-3 gap-2">
                                    {blankZones.slice(0, 3).map((zone, idx) => (
                                        <motion.div key={idx}
                                            className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-3 border border-amber-200/50 hover:border-amber-300 transition-all"
                                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.5 + idx * 0.12 }}>
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <Lightbulb size={13} className="text-amber-500" />
                                                <span className="text-[10px] font-bold text-amber-700">
                                                    {isZh ? `空白区域 #${idx + 1}` : `Zone #${idx + 1}`}
                                                </span>
                                            </div>
                                            <p className="text-xs text-amber-800 mb-2 line-clamp-2">{zone.description}</p>
                                            <span className="text-[9px] text-amber-600 font-mono bg-amber-100 px-1.5 py-0.5 rounded">
                                                [{zone.vector.map(v => v.toFixed(1)).join(', ')}]
                                            </span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ═══ 展开：AI 推理详情 ═══ */}
                        <div>
                            <button onClick={() => setShowDetails(!showDetails)}
                                className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-indigo-600 transition-colors font-medium px-0.5">
                                <ChevronDown size={12} className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
                                {isZh ? '查看 AI 创新维度分析详情' : 'View Innovation Analysis Details'}
                            </button>
                            <AnimatePresence>
                                {showDetails && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                                        <div className="mt-3 space-y-2">
                                            {dimensions.map((dim, i) => {
                                                const label = DIM_LABELS[dim.key];
                                                return (
                                                    <div key={dim.key} className="bg-slate-50/80 rounded-lg p-2.5 border border-slate-100">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <span className="text-sm">{label?.emoji}</span>
                                                            <span className="font-bold text-sm text-slate-800">{isZh ? label?.zh : label?.en}</span>
                                                            <span className="ml-auto text-sm font-mono font-bold" style={{ color: DIM_COLOR_MAP[dim.key] || DIM_COLORS[i] }}>
                                                                {dim.value.toFixed(1)}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 leading-relaxed">{dim.reasoning}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default React.memo(InnovationDNAMap);
