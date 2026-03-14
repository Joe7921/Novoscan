'use client';

/**
 * CaseVault — 行业应用图谱页面
 *
 * 可视化展示案例库中按行业、能力、技术栈的分布情况
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ==================== 类型 ====================

interface GraphNode {
    label: string;
    count: number;
}

interface IndustryGraph {
    totalCases: number;
    industries: GraphNode[];
    topCapabilities: GraphNode[];
    topTechnologies: GraphNode[];
    sourceDistribution: GraphNode[];
    maturityDistribution: GraphNode[];
}

// ==================== 成熟度 / 来源的中文映射 ====================

const MATURITY_LABELS: Record<string, string> = {
    concept: '概念阶段',
    poc: '原型验证',
    production: '生产部署',
    scale: '大规模运营',
};

const SOURCE_LABELS: Record<string, string> = {
    web: '网络搜索',
    wechat: '微信公众号',
    github: 'GitHub',
    clawhub: 'ClawHub',
    user_idea: '用户构想',
};

const MATURITY_COLORS: Record<string, string> = {
    concept: '#94a3b8',
    poc: '#60a5fa',
    production: '#34d399',
    scale: '#f59e0b',
};

const SOURCE_COLORS: Record<string, string> = {
    web: '#818cf8',
    wechat: '#22c55e',
    github: '#f97316',
    clawhub: '#06b6d4',
    user_idea: '#ec4899',
};

// ==================== 主组件 ====================

export default function CaseVaultGraphPage() {
    const [graph, setGraph] = useState<IndustryGraph | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

    const fetchGraph = useCallback(async (industry?: string) => {
        setLoading(true);
        setError(null);
        try {
            const url = industry
                ? `/api/casevault/graph?industry=${encodeURIComponent(industry)}`
                : '/api/casevault/graph';
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setGraph(data.graph);
            } else {
                setError(data.error || '加载失败');
            }
        } catch {
            setError('网络错误');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGraph(selectedIndustry || undefined);
    }, [selectedIndustry, fetchGraph]);

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)',
            color: '#e2e8f0',
            padding: '2rem',
        }}>
            {/* 标题区 */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ textAlign: 'center', marginBottom: '3rem' }}
            >
                <h1 style={{
                    fontSize: '2.5rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #818cf8, #06b6d4, #34d399)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '0.5rem',
                }}>
                    🗺️ 行业应用图谱
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '1rem' }}>
                    OpenClaw / MCP / AI Agent 实战案例生态分布
                </p>
                {graph && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={{
                            display: 'inline-block',
                            marginTop: '1rem',
                            padding: '0.5rem 1.5rem',
                            borderRadius: '2rem',
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            fontSize: '1.1rem',
                            fontWeight: 600,
                        }}
                    >
                        📊 案例总量: <span style={{ color: '#818cf8' }}>{graph.totalCases}</span>
                    </motion.div>
                )}
            </motion.div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        style={{ display: 'inline-block', fontSize: '2rem' }}
                    >
                        ⏳
                    </motion.div>
                    <p style={{ color: '#94a3b8', marginTop: '1rem' }}>加载图谱数据...</p>
                </div>
            )}

            {error && (
                <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '1rem',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                }}>
                    <p>❌ {error}</p>
                </div>
            )}

            {graph && !loading && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                    gap: '1.5rem',
                    maxWidth: '1400px',
                    margin: '0 auto',
                }}>
                    {/* 行业分布 */}
                    <GraphCard
                        title="🏢 行业分布"
                        nodes={graph.industries}
                        color="#818cf8"
                        onItemClick={(label) => {
                            setSelectedIndustry(selectedIndustry === label ? null : label);
                        }}
                        selectedItem={selectedIndustry}
                    />

                    {/* 核心能力 */}
                    <GraphCard
                        title="⚡ 核心能力 Top"
                        nodes={graph.topCapabilities}
                        color="#34d399"
                    />

                    {/* 技术栈 */}
                    <GraphCard
                        title="🔧 技术栈分布"
                        nodes={graph.topTechnologies}
                        color="#f59e0b"
                    />

                    {/* 来源分布 */}
                    <PieCard
                        title="📡 数据来源"
                        nodes={graph.sourceDistribution}
                        labelMap={SOURCE_LABELS}
                        colorMap={SOURCE_COLORS}
                    />

                    {/* 成熟度 */}
                    <PieCard
                        title="🎯 成熟度分布"
                        nodes={graph.maturityDistribution}
                        labelMap={MATURITY_LABELS}
                        colorMap={MATURITY_COLORS}
                    />
                </div>
            )}

            {graph && graph.totalCases === 0 && !loading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                        textAlign: 'center',
                        padding: '4rem',
                        color: '#64748b',
                    }}
                >
                    <p style={{ fontSize: '3rem' }}>📭</p>
                    <p style={{ marginTop: '1rem' }}>案例库暂无数据，等待采集引擎自动填充...</p>
                </motion.div>
            )}
        </div>
    );
}

// ==================== 柱状图卡片 ====================

function GraphCard({
    title,
    nodes,
    color,
    onItemClick,
    selectedItem,
}: {
    title: string;
    nodes: GraphNode[];
    color: string;
    onItemClick?: (label: string) => void;
    selectedItem?: string | null;
}) {
    const maxCount = Math.max(...nodes.map(n => n.count), 1);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                background: 'rgba(30, 30, 60, 0.6)',
                backdropFilter: 'blur(12px)',
                borderRadius: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '1.5rem',
            }}
        >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.2rem' }}>
                {title}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <AnimatePresence>
                    {nodes.slice(0, 12).map((node, i) => {
                        const pct = (node.count / maxCount) * 100;
                        const isSelected = selectedItem === node.label;
                        return (
                            <motion.div
                                key={node.label}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => onItemClick?.(node.label)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.8rem',
                                    cursor: onItemClick ? 'pointer' : 'default',
                                    padding: '0.3rem 0.5rem',
                                    borderRadius: '0.5rem',
                                    background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                    transition: 'background 0.2s',
                                }}
                            >
                                <span style={{
                                    width: '120px',
                                    fontSize: '0.85rem',
                                    color: '#cbd5e1',
                                    flexShrink: 0,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {node.label}
                                </span>
                                <div style={{
                                    flex: 1,
                                    height: '20px',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
                                        style={{
                                            height: '100%',
                                            background: `linear-gradient(90deg, ${color}, ${color}88)`,
                                            borderRadius: '4px',
                                        }}
                                    />
                                </div>
                                <span style={{
                                    width: '36px',
                                    textAlign: 'right',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color,
                                }}>
                                    {node.count}
                                </span>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

// ==================== 饼图（模拟）卡片 ====================

function PieCard({
    title,
    nodes,
    labelMap,
    colorMap,
}: {
    title: string;
    nodes: GraphNode[];
    labelMap: Record<string, string>;
    colorMap: Record<string, string>;
}) {
    const total = nodes.reduce((sum, n) => sum + n.count, 0) || 1;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                background: 'rgba(30, 30, 60, 0.6)',
                backdropFilter: 'blur(12px)',
                borderRadius: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '1.5rem',
            }}
        >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.2rem' }}>
                {title}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {nodes.map((node, i) => {
                    const pct = Math.round((node.count / total) * 100);
                    const color = colorMap[node.label] || '#94a3b8';
                    const displayLabel = labelMap[node.label] || node.label;
                    return (
                        <motion.div
                            key={node.label}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.1 }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.8rem',
                            }}
                        >
                            <div style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '3px',
                                background: color,
                                flexShrink: 0,
                            }} />
                            <span style={{
                                flex: 1,
                                fontSize: '0.9rem',
                                color: '#cbd5e1',
                            }}>
                                {displayLabel}
                            </span>
                            <span style={{
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                color,
                            }}>
                                {node.count} ({pct}%)
                            </span>
                        </motion.div>
                    );
                })}
            </div>
        </motion.div>
    );
}
