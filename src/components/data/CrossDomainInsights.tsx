/**
 * 跨域创新迁移洞察组件（Cross-Domain Innovation Transfer Insights）
 *
 * 展示跨域侦察兵 Agent 发现的跨领域灵感桥梁：
 * 1. 跨域迁移卡片 — 每个桥梁一张卡片，展示源→目标领域连接
 * 2. 交互式知识图谱 — D3 Force 模拟的节点连接可视化
 * 3. 探索领域标签 — 展示侦察兵已探索的领域
 */
'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { CrossDomainScoutOutput, CrossDomainBridge, KnowledgeGraphNode, KnowledgeGraphEdge } from '@/agents/types';
import type { Language } from '@/types';

// ==================== 类型定义 ====================

interface CrossDomainInsightsProps {
    data: CrossDomainScoutOutput;
    language: Language;
}

// ==================== 工具函数 ====================

/** 根据创新潜力返回颜色配置 */
function getNoveltyColor(score: number) {
    if (score >= 80) return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', glow: 'shadow-emerald-200/50' };
    if (score >= 60) return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800', glow: 'shadow-blue-200/50' };
    if (score >= 40) return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', glow: 'shadow-amber-200/50' };
    return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-700', glow: 'shadow-slate-200/50' };
}

/** 可行性标签 */
function getFeasibilityLabel(f: string, isZh: boolean) {
    if (f === 'high') return isZh ? '高可行性' : 'High Feasibility';
    if (f === 'medium') return isZh ? '中等可行性' : 'Medium Feasibility';
    return isZh ? '低可行性' : 'Low Feasibility';
}

/** 风险标签 */
function getRiskLabel(r: string, isZh: boolean) {
    if (r === 'low') return { label: isZh ? '低风险' : 'Low Risk', color: 'bg-green-100 text-green-700' };
    if (r === 'medium') return { label: isZh ? '中风险' : 'Med Risk', color: 'bg-amber-100 text-amber-700' };
    return { label: isZh ? '高风险' : 'High Risk', color: 'bg-rose-100 text-rose-700' };
}

/** 节点类型对应的颜色 */
const NODE_COLORS: Record<string, string> = {
    principle: '#8B5CF6',   // 紫色 — 技术原理
    technology: '#3B82F6',  // 蓝色 — 技术
    application: '#10B981', // 绿色 — 应用
};

/** 关系类型对应的描述 */
function getRelationLabel(r: string, isZh: boolean) {
    const map: Record<string, [string, string]> = {
        same_principle: ['相同原理', 'Same Principle'],
        analogous: ['类比关系', 'Analogous'],
        evolved_from: ['演化自', 'Evolved From'],
        inspires: ['启发', 'Inspires'],
    };
    return (map[r] || ['关联', 'Related'])[isZh ? 0 : 1];
}

// ==================== 子组件：桥梁卡片 ====================

const BridgeCard: React.FC<{ bridge: CrossDomainBridge; index: number; isZh: boolean }> = ({ bridge, index, isZh }) => {
    const [expanded, setExpanded] = useState(false);
    const colors = getNoveltyColor(bridge.noveltyPotential);
    const risk = getRiskLabel(bridge.riskLevel, isZh);

    return (
        <div
            className={`group relative rounded-2xl border-2 ${colors.border} ${colors.bg} p-5 transition-all duration-300 hover:shadow-lg ${colors.glow} cursor-pointer`}
            onClick={() => setExpanded(!expanded)}
        >
            {/* 灵感火花动画指示器 */}
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-xs font-black shadow-lg animate-pulse">
                {bridge.noveltyPotential}
            </div>

            {/* 领域桥梁连线 */}
            <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold bg-white/95 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 shadow-sm">
                    {bridge.sourceField}
                </span>
                <div className="flex-1 flex items-center gap-1">
                    <div className="flex-1 h-px bg-gradient-to-r from-indigo-300 via-purple-400 to-violet-300" />
                    <span className="text-xs text-purple-500 font-bold px-1">→</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-violet-300 via-purple-400 to-indigo-300" />
                </div>
                <span className="text-xs font-bold bg-gradient-to-r from-purple-100 to-violet-100 px-3 py-1.5 rounded-lg border border-purple-200 text-purple-700 shadow-sm">
                    {bridge.targetField}
                </span>
            </div>

            {/* 共通技术原理 */}
            <h4 className={`font-bold text-sm ${colors.text} mb-2 leading-snug`}>
                🔬 {bridge.techPrinciple}
            </h4>

            {/* 标签行 */}
            <div className="flex flex-wrap gap-1.5 mb-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                    {isZh ? `潜力 ${bridge.noveltyPotential}` : `Potential ${bridge.noveltyPotential}`}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700`}>
                    {getFeasibilityLabel(bridge.feasibility, isZh)}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${risk.color}`}>
                    {risk.label}
                </span>
            </div>

            {/* 迁移路径描述 */}
            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                {bridge.transferPath}
            </p>

            {/* 展开详情 */}
            {expanded && (
                <div className="mt-4 pt-4 border-t border-slate-200/50 space-y-3 animate-fade-in">
                    {/* 源案例 */}
                    <div className="bg-white/95 rounded-xl p-3 border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">
                            {isZh ? '源领域案例' : 'Source Example'}
                        </div>
                        <p className="text-xs text-slate-700">{bridge.sourceExample}</p>
                    </div>
                    {/* 目标案例 */}
                    <div className="bg-white/95 rounded-xl p-3 border border-purple-100">
                        <div className="text-[10px] font-bold text-purple-500 uppercase mb-1">
                            {isZh ? '目标领域案例' : 'Target Example'}
                        </div>
                        <p className="text-xs text-slate-700">{bridge.targetExample}</p>
                    </div>
                    {/* 参考文献 */}
                    {bridge.reference && (
                        <div className="text-[10px] text-slate-400 italic flex items-start gap-1">
                            <span>📄</span>
                            <span>{bridge.reference}</span>
                        </div>
                    )}
                </div>
            )}

            {/* 展开/收起提示 */}
            <div className="mt-2 text-[10px] text-slate-400 text-center">
                {expanded ? (isZh ? '▲ 收起' : '▲ Collapse') : (isZh ? '▼ 展开详情' : '▼ Expand')}
            </div>
        </div>
    );
};

// ==================== 子组件：知识图谱可视化 ====================

interface GraphNodePosition {
    node: KnowledgeGraphNode;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

const KnowledgeGraphVisualization: React.FC<{
    nodes: KnowledgeGraphNode[];
    edges: KnowledgeGraphEdge[];
    isZh: boolean;
}> = ({ nodes, edges, isZh }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hoveredNodeRef = useRef<string | null>(null);
    const [hoveredNodeDisplay, setHoveredNodeDisplay] = useState<string | null>(null);
    const positionsRef = useRef<GraphNodePosition[]>([]);
    const animFrameRef = useRef<number>(0);
    const drawFnRef = useRef<(() => void) | null>(null);

    // 初始化节点位置
    const initPositions = useCallback(() => {
        const width = containerRef.current?.clientWidth || 600;
        const height = 360;
        const cx = width / 2;
        const cy = height / 2;

        positionsRef.current = nodes.map((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length;
            const radius = Math.min(width, height) * 0.3;
            return {
                node,
                x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
                y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
                vx: 0,
                vy: 0,
            };
        });
    }, [nodes]);

    // Force-directed 模拟 + 渲染（仅在 nodes/edges 变化时重新运行）
    useEffect(() => {
        if (!canvasRef.current || !containerRef.current || nodes.length === 0) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = containerRef.current.clientWidth;
        const height = 360;
        canvas.width = width * 2; // HiDPI
        canvas.height = height * 2;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(2, 2);

        initPositions();
        const positions = positionsRef.current;

        let iteration = 0;
        const maxIterations = 120;

        const simulate = () => {
            if (iteration >= maxIterations) {
                draw();
                return;
            }
            iteration++;

            const alpha = 1 - iteration / maxIterations;

            // 斥力（所有节点对）
            for (let i = 0; i < positions.length; i++) {
                for (let j = i + 1; j < positions.length; j++) {
                    const dx = positions[j].x - positions[i].x;
                    const dy = positions[j].y - positions[i].y;
                    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                    const force = (800 * alpha) / (dist * dist);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;
                    positions[i].vx -= fx;
                    positions[i].vy -= fy;
                    positions[j].vx += fx;
                    positions[j].vy += fy;
                }
            }

            // 引力（边连接的节点）
            for (const edge of edges) {
                const a = positions.find(p => p.node.id === edge.source);
                const b = positions.find(p => p.node.id === edge.target);
                if (!a || !b) continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                const force = (dist - 80) * 0.02 * alpha;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                a.vx += fx;
                a.vy += fy;
                b.vx -= fx;
                b.vy -= fy;
            }

            // 向心力
            const cx = width / 2;
            const cy = height / 2;
            for (const p of positions) {
                p.vx += (cx - p.x) * 0.001 * alpha;
                p.vy += (cy - p.y) * 0.001 * alpha;
                p.vx *= 0.85;
                p.vy *= 0.85;
                p.x += p.vx;
                p.y += p.vy;
                // 边界约束
                p.x = Math.max(40, Math.min(width - 40, p.x));
                p.y = Math.max(40, Math.min(height - 40, p.y));
            }

            draw();
            animFrameRef.current = requestAnimationFrame(simulate);
        };

        // 绘制函数：读取 hoveredNodeRef 而非 state，避免因 hover 重启模拟
        const draw = () => {
            ctx.clearRect(0, 0, width, height);
            const currentHovered = hoveredNodeRef.current;

            // 绘制边
            for (const edge of edges) {
                const a = positions.find(p => p.node.id === edge.source);
                const b = positions.find(p => p.node.id === edge.target);
                if (!a || !b) continue;

                const isHighlighted = currentHovered === edge.source || currentHovered === edge.target;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.strokeStyle = isHighlighted
                    ? `rgba(139, 92, 246, ${0.6 * edge.strength})`
                    : `rgba(148, 163, 184, ${0.3 * edge.strength})`;
                ctx.lineWidth = isHighlighted ? 2.5 : 1.5;
                ctx.stroke();
            }

            // 绘制节点
            for (const p of positions) {
                const isHovered = currentHovered === p.node.id;
                const color = NODE_COLORS[p.node.type] || '#64748B';
                const radius = isHovered ? 14 : (p.node.type === 'principle' ? 11 : 9);

                // 光晕
                if (isHovered) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, radius + 6, 0, Math.PI * 2);
                    ctx.fillStyle = color + '20';
                    ctx.fill();
                }

                // 节点
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // 标签
                ctx.font = `${isHovered ? 'bold ' : ''}${isHovered ? 11 : 9}px -apple-system, sans-serif`;
                ctx.fillStyle = isHovered ? '#1E293B' : '#64748B';
                ctx.textAlign = 'center';
                const label = p.node.label.length > 12 ? p.node.label.slice(0, 12) + '…' : p.node.label;
                ctx.fillText(label, p.x, p.y + radius + 14);
            }
        };

        // 保存 draw 引用，供 hover 时调用重绘
        drawFnRef.current = draw;
        simulate();

        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            drawFnRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges, initPositions]);

    // 鼠标交互：更新 ref + 触发重绘，不重启力模拟
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        let found: string | null = null;
        for (const p of positionsRef.current) {
            const dx = p.x - x;
            const dy = p.y - y;
            if (dx * dx + dy * dy < 225) {  // 15px 半径
                found = p.node.id;
                break;
            }
        }

        if (found !== hoveredNodeRef.current) {
            hoveredNodeRef.current = found;
            setHoveredNodeDisplay(found); // 更新 UI 面板显示
            // 仅触发 canvas 重绘，不重启力模拟
            if (drawFnRef.current) drawFnRef.current();
        }
    }, []);

    const handleMouseLeave = useCallback(() => {
        hoveredNodeRef.current = null;
        setHoveredNodeDisplay(null);
        if (drawFnRef.current) drawFnRef.current();
    }, []);

    if (nodes.length === 0) return null;

    return (
        <div ref={containerRef} className="relative w-full">
            <canvas
                ref={canvasRef}
                className="w-full rounded-xl cursor-crosshair"
                style={{ height: 360 }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            />
            {/* 图例 */}
            <div className="absolute bottom-3 left-3 flex gap-3 bg-white/95 rounded-lg px-3 py-2 border border-slate-100 shadow-sm">
                {[
                    { color: NODE_COLORS.principle, label: isZh ? '技术原理' : 'Principle' },
                    { color: NODE_COLORS.technology, label: isZh ? '技术' : 'Technology' },
                    { color: NODE_COLORS.application, label: isZh ? '应用' : 'Application' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[10px] text-slate-500 font-medium">{item.label}</span>
                    </div>
                ))}
            </div>
            {/* 悬停信息 */}
            {hoveredNodeDisplay && (() => {
                const node = nodes.find(n => n.id === hoveredNodeDisplay);
                if (!node) return null;
                const connectedEdges = edges.filter(e => e.source === hoveredNodeDisplay || e.target === hoveredNodeDisplay);
                return (
                    <div className="absolute top-3 right-3 bg-white/95 rounded-xl px-4 py-3 border border-purple-200 shadow-lg max-w-[200px]">
                        <div className="font-bold text-sm text-slate-800 mb-1">{node.label}</div>
                        <div className="text-[10px] text-slate-500 mb-2">{node.field}</div>
                        <div className="text-[10px] text-purple-600 font-medium">
                            {connectedEdges.length} {isZh ? '个连接' : 'connections'}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

// ==================== 主组件 ====================

const CrossDomainInsights: React.FC<CrossDomainInsightsProps> = ({ data, language }) => {
    const isZh = language === 'zh';
    const [showGraph, setShowGraph] = useState(false);

    // 按创新潜力排序桥梁
    const sortedBridges = useMemo(() => {
        return [...(data.bridges || [])].sort((a, b) => b.noveltyPotential - a.noveltyPotential);
    }, [data.bridges]);

    if (!data || (!data.bridges?.length && !data.transferSummary)) return null;

    return (
        <div className="space-y-5">
            {/* 跨域迁移总结 — 精华洞察 */}
            {data.transferSummary && (
                <div className="bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 rounded-2xl p-5 border border-purple-200/50 relative overflow-hidden">
                    {/* 装饰 */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-200/30 to-transparent rounded-full blur-2xl" />
                    <h4 className="font-bold text-sm text-purple-800 mb-2 flex items-center gap-2 relative z-10">
                        <span className="text-lg">💡</span>
                        {isZh ? 'NovoDiscover 跨域灵感精华' : 'NovoDiscover Cross-Domain Inspiration Highlights'}
                    </h4>
                    <p className="text-sm text-slate-700 leading-relaxed relative z-10">
                        {data.transferSummary}
                    </p>
                    {/* 已探索领域 */}
                    {data.exploredDomains?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5 relative z-10">
                            <span className="text-[10px] text-purple-500 font-bold">
                                {isZh ? '已探索领域：' : 'Explored: '}
                            </span>
                            {data.exploredDomains.map((domain, i) => (
                                <span
                                    key={i}
                                    className="text-[10px] bg-white/95 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200 font-medium"
                                >
                                    {domain}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 跨域桥梁卡片网格 */}
            {sortedBridges.length > 0 && (
                <div className="grid md:grid-cols-2 gap-4">
                    {sortedBridges.map((bridge, idx) => (
                        <BridgeCard key={idx} bridge={bridge} index={idx} isZh={isZh} />
                    ))}
                </div>
            )}

            {/* 知识图谱切换 */}
            {data.knowledgeGraph?.nodes?.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowGraph(!showGraph)}
                        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition-all"
                    >
                        <span className="text-base">🕸️</span>
                        {showGraph
                            ? (isZh ? '收起知识图谱' : 'Collapse Knowledge Graph')
                            : (isZh ? '展开 NovoDiscover 跨域知识图谱' : 'Expand NovoDiscover Cross-Domain Knowledge Graph')}
                        <span className={`transition-transform ${showGraph ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {showGraph && (
                        <div className="mt-3 bg-gradient-to-br from-slate-50 to-purple-50/30 rounded-2xl border border-purple-100 overflow-hidden animate-fade-in">
                            <KnowledgeGraphVisualization
                                nodes={data.knowledgeGraph.nodes}
                                edges={data.knowledgeGraph.edges}
                                isZh={isZh}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* 置信度和评分总览 */}
            <div className="flex flex-wrap gap-3 text-[10px] text-slate-400 justify-end">
                <span>
                    {isZh ? 'NovoDiscover 跨域评分' : 'NovoDiscover Cross-Domain Score'}: <b className="text-slate-600">{data.score}/100</b>
                </span>
                <span>
                    {isZh ? '置信度' : 'Confidence'}: <b className="text-slate-600">{data.confidence}</b>
                </span>
                <span>
                    {isZh ? '已探索' : 'Explored'}: <b className="text-slate-600">{data.exploredDomains?.length || 0} {isZh ? '个领域' : 'domains'}</b>
                </span>
            </div>
        </div>
    );
};

export default React.memo(CrossDomainInsights);
