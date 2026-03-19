'use client';

/**
 * Novoscan 可视化工作流编辑器
 *
 * 基于 @xyflow/react（React Flow v12）构建。
 *
 * 布局：
 * - 左侧：Agent 节点调色板（拖拽添加）
 * - 中间：画布（拖拽连线 + 自动布局）
 * - 右侧：选中节点配置面板
 * - 底部：工具栏（保存/导出/加载预设/运行测试）
 */

import React, { useState, useCallback, useRef, useMemo, useEffect, DragEvent } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    addEdge,
    MarkerType,
    type Node,
    type Edge,
    type Connection,
    type NodeTypes,
    type OnConnect,
    type XYPosition,
    ReactFlowProvider,
    getBezierPath,
    BaseEdge,
    EdgeLabelRenderer,
    type EdgeTypes,
    useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { validateWorkflow } from '@/workflow/validator';
import { useWorkflowRunner, type NodeRunStatus } from './useWorkflowRunner';
import { renderPreview } from '@/workflow/prompt-template';
import { useWorkflowVersions } from './useWorkflowVersions';
import dynamic from 'next/dynamic';

const PromptABPanel = dynamic(() => import('./PromptABPanel'), { ssr: false });

// ==================== 类型定义 ====================

interface AgentPaletteItem {
    agentId: string;
    name: string;
    nameEn: string;
    icon: string;
    role: 'standard' | 'cross' | 'arbitrator' | 'debate' | 'quality' | 'retry';
    layer: string;
    description: string;
}

interface WorkflowEditorProps {
    /** 初始工作流 JSON（从预设加载时传入） */
    initialWorkflow?: {
        id: string;
        name: string;
        nodes: Array<Record<string, unknown>>;
        edges: Array<Record<string, unknown>>;
        config: Record<string, unknown>;
    };
    /** 保存回调 */
    onSave?: (workflow: Record<string, unknown>) => void;
    /** 关闭编辑器回调 */
    onClose?: () => void;
}

// ==================== 内置 + 插件 Agent 调色板 ====================

/** 插件 Agent 信息（从 API 获取） */
interface PluginAgentInfo {
    id: string;
    name: string;
    nameEn: string;
    description: string;
    icon: string;
    role: string;
    layer: string;
    source: string;
}

const PALETTE_ITEMS: AgentPaletteItem[] = [
    { agentId: 'academic-reviewer', name: '学术审查员', nameEn: 'Academic', icon: '📚', role: 'standard', layer: 'L1', description: '检索学术文献' },
    { agentId: 'industry-analyst', name: '产业分析员', nameEn: 'Industry', icon: '🏭', role: 'standard', layer: 'L1', description: '分析产业趋势' },
    { agentId: 'competitor-detective', name: '竞品侦探', nameEn: 'Competitor', icon: '🔍', role: 'standard', layer: 'L1', description: '侦察竞品项目' },
    { agentId: 'cross-domain-scout', name: '跨域侦察兵', nameEn: 'CrossDomain', icon: '🌐', role: 'standard', layer: 'L1', description: '探索跨领域迁移' },
    { agentId: 'innovation-evaluator', name: '创新评估师', nameEn: 'Innovation', icon: '💡', role: 'cross', layer: 'L2', description: '交叉评估创新性' },
    { agentId: 'novo-debate', name: 'NovoDebate', nameEn: 'Debate', icon: '⚔️', role: 'debate', layer: 'L2.5', description: '对抗辩论引擎' },
    { agentId: 'arbitrator', name: '首席仲裁员', nameEn: 'Arbitrator', icon: '⚖️', role: 'arbitrator', layer: 'L3', description: '综合裁决' },
    { agentId: 'quality-guard', name: '质量把关', nameEn: 'Quality', icon: '🛡️', role: 'quality', layer: 'L4', description: '一致性检查' },
    { agentId: 'retry-node', name: '重试/循环', nameEn: 'Retry', icon: '🔁', role: 'retry', layer: 'L4', description: '质量不通过时回退重跑' },
];

// 节点类型 → 颜色映射
const ROLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    standard: { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF' },
    cross: { bg: '#FFF7ED', border: '#F97316', text: '#9A3412' },
    debate: { bg: '#FDF2F8', border: '#EC4899', text: '#9D174D' },
    arbitrator: { bg: '#F5F3FF', border: '#8B5CF6', text: '#5B21B6' },
    quality: { bg: '#F0FDF4', border: '#22C55E', text: '#166534' },
    parallel: { bg: '#F0F9FF', border: '#0EA5E9', text: '#0C4A6E' },
    condition: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E' },
    retry: { bg: '#FEF3C7', border: '#D97706', text: '#78350F' },
};

// 插件 Agent 专属配色
const PLUGIN_COLOR = { bg: '#FDF4FF', border: '#A855F7', text: '#7E22CE' };

// ==================== 节点状态灯配置 ====================

const STATUS_LIGHT: Record<NodeRunStatus, { color: string; glow: string; animate?: string }> = {
    idle:      { color: '#D1D5DB', glow: '#D1D5DB40' },
    running:   { color: '#FBBF24', glow: '#FBBF2480', animate: 'wfe-pulse 1.2s ease-in-out infinite' },
    completed: { color: '#22C55E', glow: '#22C55E80' },
    failed:    { color: '#EF4444', glow: '#EF444480' },
    fallback:  { color: '#F97316', glow: '#F9731680' },
};

// ==================== 自定义节点组件 ====================

function AgentNodeComponent({ data }: { data: Record<string, unknown> }) {
    const role = (data.role as string) || 'standard';
    const colors = ROLE_COLORS[role] || ROLE_COLORS.standard;
    const isSelected = data._selected as boolean;
    const runStatus = (data._runStatus as NodeRunStatus) || 'idle';
    const durationMs = data._durationMs as number | undefined;
    const light = STATUS_LIGHT[runStatus];

    return (
        <div style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: colors.bg,
            border: `2px solid ${isSelected ? colors.border : runStatus === 'running' ? '#FBBF24' : `${colors.border}80`}`,
            minWidth: '140px',
            boxShadow: isSelected
                ? `0 0 0 2px ${colors.border}40`
                : runStatus === 'running'
                    ? '0 0 12px #FBBF2440'
                    : '0 1px 4px rgba(0,0,0,0.06)',
            transition: 'all 0.3s',
            cursor: 'pointer',
            position: 'relative',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1.3rem' }}>{data.icon as string}</span>
                <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: colors.text }}>
                        {data.label as string}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
                        {data.nameEn as string}
                    </div>
                </div>
            </div>
            {typeof data.timeout === 'number' && data.timeout > 0 && (
                <div style={{ fontSize: '0.65rem', color: '#9CA3AF', marginTop: '4px' }}>
                    ⏱️ {Math.round(data.timeout / 1000)}s
                </div>
            )}
            {/* 动态状态灯 */}
            <div style={{
                position: 'absolute',
                top: '6px',
                right: '8px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: light.color,
                boxShadow: `0 0 6px ${light.glow}`,
                animation: light.animate || 'none',
                transition: 'background 0.3s, box-shadow 0.3s',
            }} />
            {/* 耗时显示 */}
            {durationMs != null && durationMs > 0 && (
                <div style={{
                    position: 'absolute',
                    bottom: '4px',
                    right: '8px',
                    fontSize: '0.55rem',
                    color: runStatus === 'failed' ? '#EF4444' : runStatus === 'fallback' ? '#F97316' : '#6B7280',
                    fontFamily: 'monospace',
                }}>
                    {(durationMs / 1000).toFixed(1)}s
                </div>
            )}
        </div>
    );
}

const nodeTypes: NodeTypes = {
    agentNode: AgentNodeComponent,
};

// ==================== 自定义重试回环边 ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RetryEdgeComponent(props: any) {
    const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd } = props;
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX, sourceY, targetX, targetY,
        sourcePosition, targetPosition,
        curvature: 0.6,
    });

    const maxRetries = (data?.maxRetries as number) || 3;

    return (
        <>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    stroke: '#D97706',
                    strokeWidth: 2,
                    strokeDasharray: '8 4',
                    animation: 'retryEdgeDash 1s linear infinite',
                }}
            />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: 'all',
                        background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                        border: '1px solid #D97706',
                        borderRadius: '10px',
                        padding: '2px 8px',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: '#78350F',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 4px rgba(217,119,6,0.2)',
                    }}
                >
                    🔁 重试 ×{maxRetries}
                </div>
            </EdgeLabelRenderer>
        </>
    );
}

const edgeTypes: EdgeTypes = {
    retryEdge: RetryEdgeComponent,
};

// ==================== 工具函数 ====================

function workflowToFlow(wf: WorkflowEditorProps['initialWorkflow']): { nodes: Node[]; edges: Edge[] } {
    if (!wf) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    for (const n of wf.nodes) {
        const type = n.type as string;
        const paletteItem = PALETTE_ITEMS.find(p => p.agentId === (n.agentId as string));

        // 跳过 parallel 节点 — 在编辑器中用连线暗示并行
        if (type === 'parallel') continue;

        const role = (n.role as string) || type;
        const position = (n.position as XYPosition) || { x: Math.random() * 600, y: Math.random() * 400 };

        nodes.push({
            id: n.id as string,
            type: 'agentNode',
            position,
            data: {
                label: paletteItem?.name || (n.label as string) || (n.agentId as string) || type,
                nameEn: paletteItem?.nameEn || (n.agentId as string) || '',
                icon: paletteItem?.icon || (n.icon as string) || '📋',
                role,
                agentId: n.agentId || '',
                nodeType: type,
                timeout: n.timeout || paletteItem?.agentId ? undefined : undefined,
                fallbackStrategy: n.fallbackStrategy || 'statistical',
            },
        });
    }

    for (const e of wf.edges) {
        // 检测是否是 retry 回环边（源节点为 retry 类型）
        const sourceNode = wf.nodes.find(n => (n.id as string) === (e.source as string));
        const isRetryEdge = (sourceNode?.type as string) === 'retry';
        const retryMaxRetries = isRetryEdge ? ((sourceNode as Record<string, unknown>)?.maxRetries as number) || 3 : 3;

        edges.push({
            id: `e-${e.source}-${e.target}`,
            source: e.source as string,
            target: e.target as string,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: isRetryEdge ? '#D97706' : undefined },
            ...(isRetryEdge
                ? { type: 'retryEdge', data: { maxRetries: retryMaxRetries } }
                : { style: { stroke: '#94A3B8', strokeWidth: 2 } }
            ),
        });
    }

    // 展开 parallel 节点的 childNodeIds 为 source 到后续节点的连线
    for (const n of wf.nodes) {
        if ((n.type as string) === 'parallel') {
            const parallelId = n.id as string;
            const childIds = (n.childNodeIds as string[]) || [];
            // 找到 parallel 后续的边
            const outEdges = wf.edges.filter(e => (e.source as string) === parallelId);
            for (const child of childIds) {
                for (const out of outEdges) {
                    edges.push({
                        id: `e-${child}-${out.target}`,
                        source: child,
                        target: out.target as string,
                        animated: true,
                        markerEnd: { type: MarkerType.ArrowClosed },
                        style: { stroke: '#94A3B8', strokeWidth: 2 },
                    });
                }
            }
        }
    }

    return { nodes, edges };
}

function flowToWorkflow(
    nodes: Node[],
    edges: Edge[],
    name: string
): Record<string, unknown> {
    // 检测并行节点：多个没有入边的节点即是并行组
    const incomingSources = new Set(edges.map(e => e.target));
    const entryNodes = nodes.filter(n => !incomingSources.has(n.id));

    const wfNodes: Array<Record<string, unknown>> = [];
    const wfEdges: Array<Record<string, unknown>> = [];

    // 如果有多个入口节点，包装成 parallel
    if (entryNodes.length > 1) {
        const parallelId = 'parallel-auto';
        wfNodes.push({
            id: parallelId,
            type: 'parallel',
            label: '并行执行',
            childNodeIds: entryNodes.map(n => n.id),
            position: { x: 300, y: 50 },
        });
        // 找到这些入口节点的共同下游
        const downstreams = new Set<string>();
        for (const entry of entryNodes) {
            for (const edge of edges) {
                if (edge.source === entry.id) downstreams.add(edge.target);
            }
        }
        for (const target of downstreams) {
            wfEdges.push({ source: parallelId, target });
        }
    }

    for (const node of nodes) {
        const d = node.data;
        const nodeType = (d.nodeType as string) || 'agent';
        wfNodes.push({
            id: node.id,
            type: nodeType,
            ...(nodeType === 'agent' ? {
                agentId: d.agentId,
                role: d.role,
                fallbackStrategy: d.fallbackStrategy || 'statistical',
                ...(d.customPrompt ? { customPrompt: d.customPrompt } : {}),
            } : {}),
            ...(nodeType === 'debate' ? {
                timeout: d.timeout || 45000,
                minScoreDivergence: d.minScoreDivergence ?? 15,
                ...(d.maxRounds ? { maxRounds: d.maxRounds } : {}),
                ...(d.participants && (d.participants as string[]).length > 0 ? { participants: d.participants } : {}),
                ...(d.debateMode && d.debateMode !== 'structured' ? { debateMode: d.debateMode } : {}),
                ...(d.customPrompt ? { customPrompt: d.customPrompt } : {}),
                ...(d.autoSwapRoles === false ? { autoSwapRoles: false } : {}),
                ...(d.convergenceEnabled === false ? { convergenceEnabled: false } : {}),
            } : {}),
            ...(nodeType === 'quality' ? {
                label: d.label || '质量把关',
                icon: d.icon || '🛡️',
            } : {}),
            ...(nodeType === 'retry' ? {
                maxRetries: d.maxRetries ?? 2,
                retryCondition: d.retryCondition || { field: 'qualityPassed', operator: '==', value: false },
                targetNodeId: d.targetNodeId || '',
            } : {}),
            label: d.label,
            icon: d.icon,
            position: node.position,
        });
    }

    // 排除已被 parallel 处理的边
    const parallelChildIds = new Set(entryNodes.length > 1 ? entryNodes.map(n => n.id) : []);
    for (const edge of edges) {
        // 跳过从 parallel 子节点到共同下游的边（已在上面处理）
        if (parallelChildIds.has(edge.source)) continue;
        wfEdges.push({ source: edge.source, target: edge.target });
    }

    return {
        id: `custom-${Date.now()}`,
        name,
        nameEn: name,
        version: '1.0.0',
        description: '通过可视化编辑器创建的自定义工作流',
        descriptionEn: 'Custom workflow created via visual editor',
        icon: '🎨',
        author: 'User',
        isPreset: false,
        nodes: wfNodes,
        edges: wfEdges,
        config: {
            totalTimeout: 380000,
            circuitBreakerThreshold: 3,
            estimatedDuration: '自定义',
        },
    };
}

// ==================== 主编辑器（需要包在 ReactFlowProvider 内） ====================

function EditorInner({ initialWorkflow, onSave, onClose }: WorkflowEditorProps) {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { screenToFlowPosition } = useReactFlow();

    const initial = useMemo(() => workflowToFlow(initialWorkflow), [initialWorkflow]);
    const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [workflowName, setWorkflowName] = useState(initialWorkflow?.name || '我的工作流');
    const [validationMsg, setValidationMsg] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<string | null>(null);
    const [testQuery, setTestQuery] = useState('');
    const [showPerfPanel, setShowPerfPanel] = useState(false);
    const [customAgents, setCustomAgents] = useState<PluginAgentInfo[]>([]);

    // 运行时可视化 hook
    const runner = useWorkflowRunner();

    // 版本管理 hook
    const workflowId = initialWorkflow?.id || 'new-workflow';
    const versionMgr = useWorkflowVersions(workflowId);

    // 获取插件 Agent 列表
    useEffect(() => {
        fetch('/api/plugins/agents')
            .then(r => r.ok ? r.json() : { agents: [] })
            .then(data => setCustomAgents(data.agents || []))
            .catch(() => {});
    }, []);

    // 同步 runner 状态到画布节点（驱动状态灯）
    useEffect(() => {
        setNodes(nds => nds.map(n => {
            const info = runner.nodeStatuses[n.id];
            if (!info) return n;
            const newData = {
                ...n.data,
                _runStatus: info.status,
                _durationMs: info.durationMs,
            };
            // 避免无谓的重渲染
            if (n.data._runStatus === info.status && n.data._durationMs === info.durationMs) return n;
            return { ...n, data: newData };
        }));
    }, [runner.nodeStatuses, setNodes]);

    // 连线
    const onConnect: OnConnect = useCallback((connection: Connection) => {
        // 检测是否从 retry 节点连出
        const sourceNode = nodes.find(n => n.id === connection.source);
        const isRetry = (sourceNode?.data?.nodeType as string) === 'retry';
        const maxRetries = isRetry ? ((sourceNode?.data?.maxRetries as number) || 3) : 3;

        setEdges(eds => addEdge({
            ...connection,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, color: isRetry ? '#D97706' : undefined },
            ...(isRetry
                ? { type: 'retryEdge', data: { maxRetries } }
                : { style: { stroke: '#94A3B8', strokeWidth: 2 } }
            ),
        }, eds));
    }, [setEdges, nodes]);

    // 选中节点
    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
    }, []);

    // 点画布空白取消选中
    const onPaneClick = useCallback(() => {
        setSelectedNode(null);
    }, []);

    // 拖放添加节点
    const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const agentId = e.dataTransfer.getData('application/novoscan-agent');
        if (!agentId) return;

        // 查找内置 Agent 或插件 Agent
        const builtinItem = PALETTE_ITEMS.find(p => p.agentId === agentId);
        const pluginItem = !builtinItem ? customAgents.find(a => a.id === agentId) : null;
        if (!builtinItem && !pluginItem) return;

        const name = builtinItem?.name || pluginItem?.name || agentId;
        const nameEn = builtinItem?.nameEn || pluginItem?.nameEn || agentId;
        const icon = builtinItem?.icon || pluginItem?.icon || '🤖';
        const role = builtinItem?.role || pluginItem?.role || 'standard';

        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const newNode: Node = {
            id: `${agentId}-${Date.now()}`,
            type: 'agentNode',
            position,
            data: {
                label: name,
                nameEn,
                icon,
                role,
                agentId,
                nodeType: role === 'debate' ? 'debate' : role === 'quality' ? 'quality' : role === 'retry' ? 'retry' : 'agent',
                timeout: role === 'arbitrator' ? 90000 : role === 'debate' ? 45000 : pluginItem ? 60000 : 120000,
                fallbackStrategy: 'statistical',
                isPlugin: !!pluginItem,
            },
        };
        setNodes(nds => [...nds, newNode]);
    }, [screenToFlowPosition, setNodes, customAgents]);

    // 删除选中节点
    const deleteSelectedNode = useCallback(() => {
        if (!selectedNode) return;
        setNodes(nds => nds.filter(n => n.id !== selectedNode.id));
        setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
        setSelectedNode(null);
    }, [selectedNode, setNodes, setEdges]);

    // 保存
    const handleSave = useCallback(() => {
        const wf = flowToWorkflow(nodes, edges, workflowName);
        const result = validateWorkflow(wf);
        if (!result.valid) {
            setValidationMsg(`❌ 校验失败：${result.errors.join('；')}`);
            return;
        }
        setValidationMsg('✅ 校验通过！');
        onSave?.(wf);
        // 同时存到 localStorage
        const info = {
            id: wf.id,
            name: wf.name,
            nameEn: wf.nameEn,
            description: wf.description,
            descriptionEn: wf.descriptionEn,
            icon: wf.icon,
            nodeCount: (wf.nodes as unknown[]).length,
        };
        const customs = JSON.parse(localStorage.getItem('novoscan_custom_workflows') || '[]');
        const updated = [...customs.filter((c: { id: string }) => c.id !== wf.id), info];
        localStorage.setItem('novoscan_custom_workflows', JSON.stringify(updated));
        localStorage.setItem(`novoscan_wf_${wf.id}`, JSON.stringify(wf));

        // 自动创建版本快照
        versionMgr.createVersion(wf);
    }, [nodes, edges, workflowName, onSave, versionMgr]);

    // 导出 JSON
    const handleExport = useCallback(() => {
        const wf = flowToWorkflow(nodes, edges, workflowName);
        const blob = new Blob([JSON.stringify(wf, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workflow-${workflowName}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, [nodes, edges, workflowName]);

    // 模拟运行测试（驱动节点状态灯变化）
    const handleTest = useCallback(async () => {
        const wf = flowToWorkflow(nodes, edges, workflowName);
        const result = validateWorkflow(wf);
        if (!result.valid) {
            setTestResult(`❌ 无法运行：${result.errors.join('；')}`);
            return;
        }

        // 节点列表（排除 parallel 包装节点）
        const wfNodes = (wf.nodes as Array<{ id: string; type: string; label?: string; agentId?: string; icon?: string }>);
        const executableNodes = wfNodes.filter(n => n.type !== 'parallel');

        // 将工作流节点 ID 映射到画布节点 ID（画布节点 ID 带时间戳后缀）
        const canvasNodes = nodes.filter(n => n.type === 'agentNode');
        const simulatedNodes = executableNodes.map(wfNode => {
            const canvasNode = canvasNodes.find(cn => {
                const cAgentId = (cn.data.agentId as string) || '';
                return cAgentId === wfNode.agentId || cn.id === wfNode.id;
            });
            const paletteItem = PALETTE_ITEMS.find(p => p.agentId === wfNode.agentId);
            return {
                id: canvasNode?.id || wfNode.id,
                label: wfNode.label || paletteItem?.name || wfNode.agentId || wfNode.type,
                icon: wfNode.icon || paletteItem?.icon || '📋',
                type: wfNode.type,
            };
        });

        setTestResult(null);
        const summary = await runner.startRun(simulatedNodes);

        // 显示运行结果
        const statusIcons = { completed: '🟢', failed: '🔴', fallback: '🟠', idle: '⚪', running: '🟡' };
        const lines = summary.steps.map((s: string, i: number) => `${i + 1}. ${s.replace('completed', '✅').replace('failed', '❌').replace('fallback', '⚠️')}`);
        setTestResult([
            `${summary.state === 'completed' ? '✅' : '🛑'} 运行${summary.state === 'completed' ? '完成' : '已中止'}`,
            `⏱️ 总耗时: ${(summary.totalDurationMs / 1000).toFixed(1)}s`,
            `${statusIcons.completed} ${summary.completedCount} 成功  ${statusIcons.failed} ${summary.failedCount} 失败  ${statusIcons.fallback} ${summary.fallbackCount} 降级`,
            '',
            '执行详情：',
            ...lines,
        ].join('\n'));
    }, [nodes, edges, workflowName, runner]);

    // 真实运行（调用引擎 API）
    const handleRealRun = useCallback(async () => {
        if (!testQuery.trim()) {
            setTestResult('❗ 请先在工具栏中输入测试查询内容');
            return;
        }

        const wf = flowToWorkflow(nodes, edges, workflowName);
        const valResult = validateWorkflow(wf);
        if (!valResult.valid) {
            setTestResult(`❌ 无法运行：${valResult.errors.join('；')}`);
            return;
        }

        // 获取画布上的节点 ID
        const canvasNodeIds = nodes
            .filter(n => n.type === 'agentNode')
            .map(n => n.id);

        setTestResult(null);
        await runner.startRealRun(wf, testQuery.trim(), canvasNodeIds);

        // 显示真实运行结果
        if (runner.summary) {
            const s = runner.summary;
            const lines = [
                `${s.state === 'completed' ? '✅' : '🛑'} 真实运行${s.state === 'completed' ? '完成' : '已中止'}`,
                `⏱️ 总耗时: ${(s.totalDurationMs / 1000).toFixed(1)}s`,
                `🟢 ${s.completedCount} 成功  🔴 ${s.failedCount} 失败  🟠 ${s.fallbackCount} 降级`,
            ];
            if (s.overallScore !== undefined) {
                lines.push(`📊 综合评分: ${s.overallScore}/100`);
            }
            if (s.resultSummary) {
                lines.push('', '📝 分析摘要：', s.resultSummary);
            }
            setTestResult(lines.join('\n'));
        }
    }, [nodes, edges, workflowName, testQuery, runner]);

    return (
        <div className="wfe-layout">
            {/* ===== 左侧：节点调色板 ===== */}
            <div className="wfe-palette">
                <div className="wfe-palette-title">🧩 节点调色板</div>
                <div className="wfe-palette-hint">拖拽到画布添加节点</div>
                {(['L1', 'L2', 'L2.5', 'L3', 'L4'] as const).map(layer => {
                    const items = PALETTE_ITEMS.filter(p => p.layer === layer);
                    if (items.length === 0) return null;
                    return (
                        <div key={layer} className="wfe-palette-group">
                            <div className="wfe-palette-layer">{layer}</div>
                            {items.map(item => (
                                <div
                                    key={item.agentId}
                                    className="wfe-palette-item"
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/novoscan-agent', item.agentId);
                                        e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    style={{
                                        borderLeftColor: ROLE_COLORS[item.role]?.border || '#94A3B8',
                                    }}
                                >
                                    <span className="wfe-palette-icon">{item.icon}</span>
                                    <div>
                                        <div className="wfe-palette-name">{item.name}</div>
                                        <div className="wfe-palette-desc">{item.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })}

                {/* 插件 Agent 分区 */}
                {customAgents.length > 0 && (
                    <div className="wfe-palette-group">
                        <div className="wfe-palette-layer" style={{ background: '#F3E8FF', color: '#7E22CE' }}>🔌 插件 Agent</div>
                        {customAgents.map(agent => (
                            <div
                                key={agent.id}
                                className="wfe-palette-item"
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('application/novoscan-agent', agent.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                style={{ borderLeftColor: PLUGIN_COLOR.border }}
                            >
                                <span className="wfe-palette-icon">{agent.icon || '🤖'}</span>
                                <div>
                                    <div className="wfe-palette-name">{agent.name}</div>
                                    <div className="wfe-palette-desc">{agent.description || '自定义插件'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ===== 中间：画布 ===== */}
            <div className="wfe-canvas" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes.map(n => ({ ...n, data: { ...n.data, _selected: selectedNode?.id === n.id } }))}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={onNodeClick}
                    onPaneClick={onPaneClick}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    snapToGrid
                    snapGrid={[15, 15]}
                    defaultEdgeOptions={{
                        animated: true,
                        markerEnd: { type: MarkerType.ArrowClosed },
                        style: { stroke: '#94A3B8', strokeWidth: 2 },
                    }}
                >
                    <Background gap={15} size={1} color="#E5E7EB" />
                    <Controls position="bottom-left" />
                    <MiniMap
                        nodeColor={(n) => ROLE_COLORS[(n.data?.role as string) || 'standard']?.border || '#94A3B8'}
                        style={{ borderRadius: '8px' }}
                    />

                    {/* 顶部面板：工作流名称 */}
                    <Panel position="top-center">
                        <div className="wfe-name-panel">
                            <input
                                type="text"
                                className="wfe-name-input"
                                value={workflowName}
                                onChange={e => setWorkflowName(e.target.value)}
                                placeholder="工作流名称"
                            />
                        </div>
                    </Panel>
                </ReactFlow>

                {/* 底部工具栏 */}
                <div className="wfe-toolbar">
                    <button className="wfe-tb-btn wfe-tb-save" onClick={handleSave}>
                        💾 保存 {versionMgr.versionCount > 0 ? `(v${versionMgr.versionCount})` : ''}
                    </button>
                    <button className="wfe-tb-btn" onClick={handleExport}>📤 导出 JSON</button>
                    {runner.runnerState === 'running' ? (
                        <button className="wfe-tb-btn wfe-tb-abort" onClick={runner.abort}>⏹️ 中止运行</button>
                    ) : (
                        <>
                            <button className="wfe-tb-btn wfe-tb-test" onClick={handleTest}>▶️ 模拟测试</button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="text"
                                    placeholder="输入测试查询内容..."
                                    value={testQuery}
                                    onChange={e => setTestQuery(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleRealRun(); }}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.75rem',
                                        width: '180px',
                                        background: '#fff',
                                    }}
                                />
                                <button
                                    className="wfe-tb-btn wfe-tb-test"
                                    onClick={handleRealRun}
                                    style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white' }}
                                >
                                    🔬 真实运行
                                </button>
                            </div>
                        </>
                    )}
                    {runner.runnerState !== 'idle' && runner.runnerState !== 'running' && (
                        <>
                            <button className="wfe-tb-btn" onClick={runner.reset}>🔄 重置状态</button>
                            <button
                                className="wfe-tb-btn"
                                onClick={() => setShowPerfPanel(p => !p)}
                                style={showPerfPanel ? { background: '#EFF6FF', borderColor: '#3B82F6', color: '#3B82F6' } : {}}
                            >
                                📊 性能分析
                            </button>
                        </>
                    )}
                    {onClose && <button className="wfe-tb-btn wfe-tb-close" onClick={onClose}>✕ 关闭</button>}
                </div>

                {/* 校验/测试消息 */}
                {validationMsg && (
                    <div className="wfe-msg" onClick={() => setValidationMsg(null)}>
                        {validationMsg}
                    </div>
                )}
                {testResult && (
                    <div className="wfe-msg wfe-msg-test" onClick={() => setTestResult(null)}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>{testResult}</pre>
                    </div>
                )}

                {/* 性能分析面板 */}
                {showPerfPanel && runner.runnerState !== 'idle' && (
                    <PerformancePanel
                        nodeStatuses={runner.nodeStatuses}
                        summary={runner.summary}
                        nodes={nodes}
                        onClose={() => setShowPerfPanel(false)}
                    />
                )}
            </div>

            {/* ===== 右侧：配置面板 ===== */}
            <div className="wfe-config">
                {selectedNode ? (
                    <NodeConfigPanel
                        node={selectedNode}
                        onUpdate={(data) => {
                            setNodes(nds => nds.map(n =>
                                n.id === selectedNode.id ? { ...n, data: { ...n.data, ...data } } : n
                            ));
                            setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, ...data } } : null);
                        }}
                        onDelete={deleteSelectedNode}
                    />
                ) : (
                    <div className="wfe-config-empty">
                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👆</div>
                        <div>点击节点查看配置</div>
                        <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                            或从左侧拖拽添加新节点
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                /* 状态灯脉冲动画 */
                @keyframes wfe-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.3); }
                }
                @keyframes retryEdgeDash {
                    0% { stroke-dashoffset: 0; }
                    100% { stroke-dashoffset: -24; }
                }
                .wfe-layout {
                    display: flex;
                    height: calc(100vh - 60px);
                    background: #F9FAFB;
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid var(--novo-border-default);
                }

                /* 调色板 */
                .wfe-palette {
                    width: 220px;
                    background: var(--novo-bg-elevated);
                    border-right: 1px solid var(--novo-border-default);
                    padding: 16px 12px;
                    overflow-y: auto;
                    flex-shrink: 0;
                }

                .wfe-palette-title {
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: var(--novo-text-primary);
                    margin-bottom: 4px;
                }

                .wfe-palette-hint {
                    font-size: 0.7rem;
                    color: var(--novo-text-muted);
                    margin-bottom: 12px;
                }

                .wfe-palette-group {
                    margin-bottom: 12px;
                }

                .wfe-palette-layer {
                    font-size: 0.65rem;
                    font-weight: 700;
                    color: var(--novo-text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 6px;
                }

                .wfe-palette-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 10px;
                    border-radius: 8px;
                    border-left: 3px solid;
                    background: var(--novo-bg-surface);
                    margin-bottom: 4px;
                    cursor: grab;
                    transition: all 0.15s;
                    font-size: 0.8rem;
                }

                .wfe-palette-item:hover {
                    background: var(--novo-bg-hover);
                    transform: translateX(2px);
                }

                .wfe-palette-item:active {
                    cursor: grabbing;
                }

                .wfe-palette-icon {
                    font-size: 1.2rem;
                    flex-shrink: 0;
                }

                .wfe-palette-name {
                    font-weight: 500;
                    color: var(--novo-text-primary);
                    font-size: 0.8rem;
                }

                .wfe-palette-desc {
                    font-size: 0.65rem;
                    color: var(--novo-text-muted);
                }

                /* 画布 */
                .wfe-canvas {
                    flex: 1;
                    position: relative;
                }

                .wfe-name-panel {
                    background: var(--novo-bg-elevated);
                    padding: 6px 16px;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    border: 1px solid var(--novo-border-default);
                }

                .wfe-name-input {
                    border: none;
                    outline: none;
                    font-size: 0.95rem;
                    font-weight: 600;
                    text-align: center;
                    background: transparent;
                    color: var(--novo-text-primary);
                    width: 200px;
                }

                /* 工具栏 */
                .wfe-toolbar {
                    position: absolute;
                    bottom: 16px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 8px;
                    background: var(--novo-bg-elevated);
                    padding: 8px 12px;
                    border-radius: 10px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
                    border: 1px solid var(--novo-border-default);
                    z-index: 10;
                }

                .wfe-tb-btn {
                    padding: 6px 14px;
                    border-radius: 6px;
                    border: 1px solid var(--novo-border-default);
                    background: var(--novo-bg-elevated);
                    cursor: pointer;
                    font-size: 0.8rem;
                    font-weight: 500;
                    transition: all 0.15s;
                    color: var(--novo-text-primary);
                }

                .wfe-tb-btn:hover {
                    background: var(--novo-bg-hover);
                }

                .wfe-tb-save {
                    background: linear-gradient(135deg, var(--novo-brand-primary), var(--novo-brand-secondary));
                    color: white;
                    border: none;
                }

                .wfe-tb-save:hover { opacity: 0.9; }

                .wfe-tb-test {
                    background: var(--novo-brand-green);
                    color: white;
                    border: none;
                }

                .wfe-tb-test:hover { opacity: 0.9; }

                .wfe-tb-abort {
                    background: #EF4444;
                    color: white;
                    border: none;
                    animation: wfe-pulse 1.5s ease-in-out infinite;
                }

                .wfe-tb-abort:hover { opacity: 0.9; }

                .wfe-tb-close {
                    border-color: #FECACA;
                    color: #DC2626;
                }

                /* 消息 */
                .wfe-msg {
                    position: absolute;
                    top: 16px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--novo-bg-elevated);
                    padding: 10px 16px;
                    border-radius: 8px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
                    border: 1px solid var(--novo-border-default);
                    font-size: 0.85rem;
                    cursor: pointer;
                    z-index: 20;
                    max-width: 90%;
                    animation: wfe-fade-in 0.2s;
                }

                .wfe-msg-test {
                    top: auto;
                    bottom: 80px;
                    max-height: 200px;
                    overflow-y: auto;
                }

                @keyframes wfe-fade-in {
                    from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }

                /* 配置面板 */
                .wfe-config {
                    width: 260px;
                    background: var(--novo-bg-elevated);
                    border-left: 1px solid var(--novo-border-default);
                    padding: 16px;
                    overflow-y: auto;
                    flex-shrink: 0;
                }

                .wfe-config-empty {
                    text-align: center;
                    color: var(--novo-text-muted);
                    padding-top: 60px;
                    font-size: 0.85rem;
                }

                @media (max-width: 900px) {
                    .wfe-palette { display: none; }
                    .wfe-config { display: none; }
                }
            `}</style>
        </div>
    );
}

// ==================== 节点配置面板（含 Prompt 编辑） ====================

function NodeConfigPanel({
    node,
    onUpdate,
    onDelete,
}: {
    node: Node;
    onUpdate: (data: Record<string, unknown>) => void;
    onDelete: () => void;
}) {
    const d = node.data;
    const role = (d.role as string) || 'standard';
    const colors = ROLE_COLORS[role] || ROLE_COLORS.standard;
    const agentId = d.agentId as string;
    const [showPrompt, setShowPrompt] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [showABPanel, setShowABPanel] = useState(false);

    //  Prompt 实时预览
    const promptPreview = useMemo(() => {
        const prompt = (d.customPrompt as string) || '';
        if (!prompt.trim()) return null;
        return renderPreview(prompt);
    }, [d.customPrompt]);

    // 加载默认 Prompt
    const loadDefaultPrompt = useCallback(async () => {
        if (!agentId) return;
        const { getDefaultPrompt } = await import('@/workflow/prompt-template');
        const tpl = getDefaultPrompt(agentId);
        if (tpl) {
            onUpdate({ customPrompt: tpl.content });
        }
    }, [agentId, onUpdate]);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: colors.text }}>
                    {d.icon as string} {d.label as string}
                </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginBottom: '16px' }}>
                ID: {node.id}
            </div>

            {/* 超时设置 */}
            <div className="wfe-cfg-field">
                <label className="wfe-cfg-label">⏱️ 超时 (秒)</label>
                <input
                    type="number"
                    className="wfe-cfg-input"
                    value={Math.round(((d.timeout as number) || 120000) / 1000)}
                    onChange={e => onUpdate({ timeout: Number(e.target.value) * 1000 })}
                    min={5}
                    max={600}
                />
            </div>

            {/* 降级策略（重试节点和质量节点不显示） */}
            {role !== 'quality' && role !== 'retry' && (
                <div className="wfe-cfg-field">
                    <label className="wfe-cfg-label">🔄 降级策略</label>
                    <select
                        className="wfe-cfg-input"
                        value={(d.fallbackStrategy as string) || 'statistical'}
                        onChange={e => onUpdate({ fallbackStrategy: e.target.value })}
                    >
                        <option value="statistical">统计推断</option>
                        <option value="skip">跳过</option>
                        <option value="default">默认值</option>
                    </select>
                </div>
            )}

            {/* 辩论评分阈值 */}
            {role === 'debate' && (
                <>
                    {/* 辩论触发阈值 */}
                    <div className="wfe-cfg-field">
                        <label className="wfe-cfg-label">📊 触发阈值 (评分差)</label>
                        <input
                            type="number"
                            className="wfe-cfg-input"
                            value={(d.minScoreDivergence as number) ?? 15}
                            onChange={e => onUpdate({ minScoreDivergence: Number(e.target.value) })}
                            min={0}
                            max={100}
                        />
                        <div style={{ fontSize: '0.6rem', color: '#9CA3AF', marginTop: '2px' }}>
                            设为 0 = 强制辩论
                        </div>
                    </div>

                    {/* 最大辩论轮次 */}
                    <div className="wfe-cfg-field">
                        <label className="wfe-cfg-label">🔄 最大轮次</label>
                        <input
                            type="number"
                            className="wfe-cfg-input"
                            value={(d.maxRounds as number) ?? 3}
                            onChange={e => onUpdate({ maxRounds: Math.min(10, Math.max(1, Number(e.target.value))) })}
                            min={1}
                            max={10}
                        />
                    </div>

                    {/* 辩论模式 */}
                    <div className="wfe-cfg-field">
                        <label className="wfe-cfg-label">🎭 辩论模式</label>
                        <select
                            className="wfe-cfg-input"
                            value={(d.debateMode as string) || 'structured'}
                            onChange={e => onUpdate({ debateMode: e.target.value })}
                        >
                            <option value="structured">结构化对抗（挑战→反驳→裁判）</option>
                            <option value="freeform">自由辩论（开放讨论）</option>
                        </select>
                    </div>

                    {/* 攻防轮换 */}
                    <div className="wfe-cfg-field" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="checkbox"
                            checked={(d.autoSwapRoles as boolean) !== false}
                            onChange={e => onUpdate({ autoSwapRoles: e.target.checked })}
                            style={{ width: 'auto' }}
                        />
                        <label className="wfe-cfg-label" style={{ marginBottom: 0 }}>⚔️ 攻防轮换</label>
                    </div>

                    {/* 收敛检测 */}
                    <div className="wfe-cfg-field" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                            type="checkbox"
                            checked={(d.convergenceEnabled as boolean) !== false}
                            onChange={e => onUpdate({ convergenceEnabled: e.target.checked })}
                            style={{ width: 'auto' }}
                        />
                        <label className="wfe-cfg-label" style={{ marginBottom: 0 }}>📉 收敛检测（提前终止）</label>
                    </div>

                    {/* 参与者选择 */}
                    <div className="wfe-cfg-field">
                        <label className="wfe-cfg-label">👥 辩手选择</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {[
                                { id: 'academic-reviewer', name: '学术审查员' },
                                { id: 'industry-analyst', name: '产业分析员' },
                                { id: 'innovation-evaluator', name: '创新评估师' },
                                { id: 'competitor-detective', name: '竞品侦探' },
                            ].map(agent => {
                                const participants = (d.participants as string[]) || [];
                                const checked = participants.length === 0 || participants.includes(agent.id);
                                return (
                                    <label key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--novo-text-secondary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={e => {
                                                let next = participants.length === 0
                                                    ? ['academic-reviewer', 'industry-analyst', 'innovation-evaluator', 'competitor-detective']
                                                    : [...participants];
                                                if (e.target.checked) {
                                                    if (!next.includes(agent.id)) next.push(agent.id);
                                                } else {
                                                    next = next.filter(x => x !== agent.id);
                                                }
                                                onUpdate({ participants: next.length >= 4 ? [] : next });
                                            }}
                                            style={{ width: 'auto' }}
                                        />
                                        {agent.name}
                                    </label>
                                );
                            })}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#9CA3AF', marginTop: '2px' }}>
                            全选 = 自动配对；至少选 2 个
                        </div>
                    </div>

                    {/* 辩论自定义 Prompt */}
                    <div className="wfe-cfg-field">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <label className="wfe-cfg-label" style={{ marginBottom: 0 }}>📝 辩论规则 Prompt</label>
                            <button
                                onClick={() => setShowPrompt(!showPrompt)}
                                style={{ fontSize: '0.65rem', background: 'none', border: 'none', color: 'var(--novo-brand-primary)', cursor: 'pointer' }}
                            >
                                {showPrompt ? '收起 ▲' : '展开 ▼'}
                            </button>
                        </div>
                        {showPrompt && (
                            <>
                                <textarea
                                    className="wfe-cfg-input"
                                    style={{ minHeight: '80px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.7rem', lineHeight: 1.5 }}
                                    value={(d.customPrompt as string) || ''}
                                    onChange={e => onUpdate({ customPrompt: e.target.value })}
                                    placeholder="留空 = 使用内置辩论 Prompt"
                                />
                                <button
                                    onClick={() => onUpdate({ customPrompt: '' })}
                                    style={{ fontSize: '0.6rem', marginTop: '4px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #FECACA', background: 'white', color: '#DC2626', cursor: 'pointer' }}
                                >
                                    ✕ 清空
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* 重试节点专属配置 */}
            {role === 'retry' && (
                <>
                    {/* 最大重试次数 */}
                    <div className="wfe-cfg-field">
                        <label className="wfe-cfg-label">🔁 最大重试次数</label>
                        <input
                            type="range"
                            min={1}
                            max={5}
                            value={(d.maxRetries as number) || 2}
                            onChange={e => onUpdate({ maxRetries: Number(e.target.value) })}
                            style={{ width: '100%' }}
                        />
                        <div style={{ fontSize: '0.7rem', color: '#6B7280', textAlign: 'center' }}>
                            {(d.maxRetries as number) || 2} 次
                        </div>
                    </div>

                    {/* 重试条件 */}
                    <div className="wfe-cfg-field">
                        <label className="wfe-cfg-label">❓ 重试条件</label>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <select
                                className="wfe-cfg-input"
                                style={{ flex: 1 }}
                                value={((d.retryCondition as Record<string,unknown>)?.field as string) || 'qualityPassed'}
                                onChange={e => onUpdate({ retryCondition: { ...((d.retryCondition as Record<string,unknown>) || {}), field: e.target.value } })}
                            >
                                <option value="qualityPassed">质量检查通过</option>
                                <option value="consistencyScore">一致性分数</option>
                                <option value="fallbackCount">降级数量</option>
                            </select>
                            <select
                                className="wfe-cfg-input"
                                style={{ width: '50px' }}
                                value={((d.retryCondition as Record<string,unknown>)?.operator as string) || '=='}
                                onChange={e => onUpdate({ retryCondition: { ...((d.retryCondition as Record<string,unknown>) || {}), operator: e.target.value } })}
                            >
                                <option value="==">==</option>
                                <option value="!=">!=</option>
                                <option value=">">&gt;</option>
                                <option value="<">&lt;</option>
                                <option value=">=">&gt;=</option>
                                <option value="<=">&lt;=</option>
                            </select>
                            <input
                                className="wfe-cfg-input"
                                style={{ width: '60px' }}
                                value={String(((d.retryCondition as Record<string,unknown>)?.value) ?? 'false')}
                                onChange={e => {
                                    let val: string | number | boolean = e.target.value;
                                    if (val === 'true') val = true;
                                    else if (val === 'false') val = false;
                                    else if (!isNaN(Number(val))) val = Number(val);
                                    onUpdate({ retryCondition: { ...((d.retryCondition as Record<string,unknown>) || {}), value: val } });
                                }}
                            />
                        </div>
                        <div style={{ fontSize: '0.55rem', color: '#9CA3AF', marginTop: '4px' }}>
                            条件成立时触发重试，例: qualityPassed == false
                        </div>
                    </div>

                    {/* 目标节点 */}
                    <div className="wfe-cfg-field">
                        <label className="wfe-cfg-label">🎯 重试目标节点 ID</label>
                        <input
                            className="wfe-cfg-input"
                            value={(d.targetNodeId as string) || ''}
                            onChange={e => onUpdate({ targetNodeId: e.target.value })}
                            placeholder="填入目标节点的 ID"
                        />
                        <div style={{ fontSize: '0.55rem', color: '#9CA3AF', marginTop: '4px' }}>
                            重试时会回到此节点重新执行
                        </div>
                    </div>
                </>
            )}

            {/* Prompt 编辑区 */}
            {(role === 'standard' || role === 'cross' || role === 'arbitrator') && (
                <div className="wfe-cfg-field" style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label className="wfe-cfg-label" style={{ marginBottom: 0 }}>📝 自定义 Prompt</label>
                        <button
                            onClick={() => setShowPrompt(!showPrompt)}
                            style={{
                                fontSize: '0.65rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--novo-brand-primary)',
                                cursor: 'pointer',
                            }}
                        >
                            {showPrompt ? '收起 ▲' : '展开 ▼'}
                        </button>
                    </div>
                    {showPrompt && (
                        <>
                            <textarea
                                className="wfe-cfg-input"
                                style={{
                                    minHeight: '120px',
                                    resize: 'vertical',
                                    fontFamily: 'monospace',
                                    fontSize: '0.7rem',
                                    lineHeight: 1.5,
                                }}
                                value={(d.customPrompt as string) || ''}
                                onChange={e => onUpdate({ customPrompt: e.target.value })}
                                placeholder="留空 = 使用内置默认 Prompt&#10;支持 {{query}} / {{language}} / {{domainHint}} 等变量"
                            />

                            {/* 实时预览 */}
                            {(d.customPrompt as string)?.trim() && (
                                <div style={{ marginTop: '6px' }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '4px',
                                        }}
                                    >
                                        <button
                                            onClick={() => setShowPreview(!showPreview)}
                                            style={{
                                                fontSize: '0.6rem',
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--novo-brand-primary)',
                                                cursor: 'pointer',
                                                padding: 0,
                                            }}
                                        >
                                            {showPreview ? '👁️ 收起预览 ▲' : '👁️ 实时预览 ▼'}
                                        </button>
                                        {promptPreview && (
                                            <span style={{
                                                fontSize: '0.55rem',
                                                color: promptPreview.valid ? '#22C55E' : '#F59E0B',
                                            }}>
                                                {promptPreview.valid ? '✅ 变量全部匹配' : `⚠️ ${promptPreview.unmatchedVars.length} 个未匹配`}
                                            </span>
                                        )}
                                    </div>
                                    {showPreview && promptPreview && (
                                        <div style={{
                                            background: '#F9FAFB',
                                            borderRadius: '6px',
                                            padding: '8px',
                                            fontSize: '0.65rem',
                                            lineHeight: 1.5,
                                            whiteSpace: 'pre-wrap',
                                            fontFamily: 'monospace',
                                            maxHeight: '160px',
                                            overflowY: 'auto',
                                            border: '1px solid #E5E7EB',
                                            color: '#374151',
                                        }}>
                                            {promptPreview.rendered}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={loadDefaultPrompt}
                                    style={{
                                        fontSize: '0.6rem',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        border: '1px solid var(--novo-border-default)',
                                        background: 'var(--novo-bg-surface)',
                                        color: 'var(--novo-text-secondary)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    📋 加载默认模板
                                </button>
                                <button
                                    onClick={() => setShowABPanel(true)}
                                    style={{
                                        fontSize: '0.6rem',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        border: '1px solid #8B5CF6',
                                        background: '#F5F3FF',
                                        color: '#7C3AED',
                                        cursor: 'pointer',
                                    }}
                                >
                                    🔬 A/B 对比
                                </button>
                                <button
                                    onClick={() => onUpdate({ customPrompt: '' })}
                                    style={{
                                        fontSize: '0.6rem',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        border: '1px solid #FECACA',
                                        background: 'white',
                                        color: '#DC2626',
                                        cursor: 'pointer',
                                    }}
                                >
                                    ✕ 清空
                                </button>
                            </div>
                            <div style={{ fontSize: '0.6rem', color: '#9CA3AF', marginTop: '6px', lineHeight: 1.4 }}>
                                可用变量：{'{{query}} {{language}} {{domainHint}} {{academicData}} {{industryData}} {{competitorData}} {{allAgentOutputs}}'}
                            </div>

                            {/* A/B 对比面板 */}
                            {showABPanel && (
                                <PromptABPanel
                                    promptA={(d.customPrompt as string) || ''}
                                    agentId={agentId}
                                    nodeName={`${d.icon as string} ${d.label as string}`}
                                    onSelect={(prompt) => {
                                        onUpdate({ customPrompt: prompt });
                                        setShowABPanel(false);
                                    }}
                                    onClose={() => setShowABPanel(false)}
                                />
                            )}
                        </>
                    )}
                </div>
            )}

            {/* 删除按钮 */}
            <button
                onClick={onDelete}
                style={{
                    marginTop: '20px',
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #FECACA',
                    background: '#FEF2F2',
                    color: '#DC2626',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                }}
            >
                🗑️ 删除此节点
            </button>

            <style jsx>{`
                .wfe-cfg-field {
                    margin-bottom: 12px;
                }
                .wfe-cfg-label {
                    display: block;
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: var(--novo-text-secondary);
                    margin-bottom: 4px;
                }
                .wfe-cfg-input {
                    width: 100%;
                    padding: 6px 10px;
                    border-radius: 6px;
                    border: 1px solid var(--novo-border-default);
                    font-size: 0.8rem;
                    background: var(--novo-bg-surface);
                    color: var(--novo-text-primary);
                    outline: none;
                }
                .wfe-cfg-input:focus {
                    border-color: var(--novo-brand-primary);
                    box-shadow: 0 0 0 2px rgba(66,133,244,0.1);
                }
            `}</style>
        </div>
    );
}

// ==================== 性能分析面板 ====================

interface PerformancePanelProps {
    nodeStatuses: Record<string, { status: string; durationMs?: number }>;
    summary: { totalDurationMs: number; overallScore?: number } | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    nodes: any[];
    onClose: () => void;
}

function PerformancePanel({ nodeStatuses, summary, nodes, onClose }: PerformancePanelProps) {
    // 收集有耗时的节点
    const perfEntries = Object.entries(nodeStatuses)
        .filter(([, info]) => info.durationMs !== undefined && info.durationMs > 0)
        .map(([nodeId, info]) => {
            const canvasNode = nodes.find(n => n.id === nodeId);
            const label = (canvasNode?.data?.label as string)
                || (canvasNode?.data?.agentId as string)
                || nodeId;
            return {
                nodeId,
                label: label as string,
                durationMs: info.durationMs!,
                status: info.status,
            };
        })
        .sort((a, b) => b.durationMs - a.durationMs);

    if (perfEntries.length === 0) {
        return (
            <div className="wfe-perf-panel">
                <div className="wfe-perf-header">
                    <span>📊 性能分析</span>
                    <button onClick={onClose} className="wfe-perf-close">✕</button>
                </div>
                <div style={{ padding: '16px', color: '#9ca3af', textAlign: 'center' }}>
                    暂无耗时数据。请先运行工作流。
                </div>
            </div>
        );
    }

    const maxDuration = perfEntries[0].durationMs;
    const avgDuration = perfEntries.reduce((s, e) => s + e.durationMs, 0) / perfEntries.length;
    const bottleneckThreshold = avgDuration * 1.5;
    const bottlenecks = perfEntries.filter(e => e.durationMs > bottleneckThreshold);
    const totalMs = summary?.totalDurationMs || perfEntries.reduce((s, e) => s + e.durationMs, 0);

    // 优化建议
    const suggestions: string[] = [];
    if (bottlenecks.length > 0) {
        suggestions.push(`🔴 ${bottlenecks.length} 个瓶颈节点（耗时超过平均值 ${Math.round(bottleneckThreshold)}ms）：${bottlenecks.map(b => b.label).join('、')}`);
    }
    if (perfEntries.length >= 3 && totalMs > 60000) {
        suggestions.push('⚡ 建议将独立节点设为并行执行（拖入并行容器），缩减总耗时');
    }
    if (perfEntries.some(e => e.status === 'fallback')) {
        suggestions.push('🟠 部分节点降级执行。检查 API 超时设置或切换备用模型');
    }
    if (perfEntries.some(e => e.status === 'failed')) {
        suggestions.push('🔴 部分节点失败。检查日志排查错误原因');
    }
    if (suggestions.length === 0) {
        suggestions.push('✅ 各节点耗时均匀，无明显瓶颈');
    }

    const statusColors: Record<string, string> = {
        completed: '#10B981',
        failed: '#EF4444',
        fallback: '#F59E0B',
        running: '#3B82F6',
        idle: '#9ca3af',
    };

    return (
        <div className="wfe-perf-panel">
            <div className="wfe-perf-header">
                <span>📊 性能分析</span>
                <button onClick={onClose} className="wfe-perf-close">✕</button>
            </div>

            {/* 统计摘要 */}
            <div className="wfe-perf-stats">
                <div className="wfe-perf-stat">
                    <span className="wfe-perf-stat-val">{(totalMs / 1000).toFixed(1)}s</span>
                    <span className="wfe-perf-stat-lbl">总耗时</span>
                </div>
                <div className="wfe-perf-stat">
                    <span className="wfe-perf-stat-val">{(avgDuration / 1000).toFixed(1)}s</span>
                    <span className="wfe-perf-stat-lbl">平均</span>
                </div>
                <div className="wfe-perf-stat">
                    <span className="wfe-perf-stat-val">{(maxDuration / 1000).toFixed(1)}s</span>
                    <span className="wfe-perf-stat-lbl">最大</span>
                </div>
                <div className="wfe-perf-stat">
                    <span className="wfe-perf-stat-val" style={{ color: bottlenecks.length > 0 ? '#EF4444' : '#10B981' }}>
                        {bottlenecks.length}
                    </span>
                    <span className="wfe-perf-stat-lbl">瓶颈</span>
                </div>
            </div>

            {/* 柱状图 */}
            <div className="wfe-perf-chart">
                {perfEntries.map(entry => {
                    const pct = Math.max(5, (entry.durationMs / maxDuration) * 100);
                    const isBottleneck = entry.durationMs > bottleneckThreshold;
                    return (
                        <div key={entry.nodeId} className="wfe-perf-bar-row">
                            <div className="wfe-perf-bar-label" title={entry.label}>
                                {entry.label}
                            </div>
                            <div className="wfe-perf-bar-track">
                                <div
                                    className="wfe-perf-bar-fill"
                                    style={{
                                        width: `${pct}%`,
                                        background: isBottleneck
                                            ? 'linear-gradient(90deg, #EF4444, #DC2626)'
                                            : `linear-gradient(90deg, ${statusColors[entry.status] || '#3B82F6'}, ${statusColors[entry.status] || '#3B82F6'}88)`,
                                    }}
                                />
                                <span className="wfe-perf-bar-time">
                                    {entry.durationMs >= 1000
                                        ? `${(entry.durationMs / 1000).toFixed(1)}s`
                                        : `${Math.round(entry.durationMs)}ms`
                                    }
                                    {isBottleneck && ' 🔴'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 优化建议 */}
            <div className="wfe-perf-tips">
                <div style={{ fontWeight: 600, marginBottom: '6px', fontSize: '0.8rem' }}>💡 优化建议</div>
                {suggestions.map((s, i) => (
                    <div key={i} className="wfe-perf-tip">{s}</div>
                ))}
            </div>

            <style jsx>{`
                .wfe-perf-panel {
                    position: absolute;
                    bottom: 60px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 500px;
                    max-width: calc(100% - 40px);
                    max-height: 360px;
                    overflow-y: auto;
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
                    z-index: 20;
                    animation: wfe-perf-in 0.25s ease-out;
                }
                @keyframes wfe-perf-in {
                    from { opacity: 0; transform: translateX(-50%) translateY(12px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                .wfe-perf-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 14px;
                    border-bottom: 1px solid #f3f4f6;
                    font-weight: 600;
                    font-size: 0.85rem;
                }
                .wfe-perf-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 1rem;
                    color: #9ca3af;
                }
                .wfe-perf-stats {
                    display: flex;
                    gap: 0;
                    padding: 10px 14px;
                    border-bottom: 1px solid #f3f4f6;
                }
                .wfe-perf-stat {
                    flex: 1;
                    text-align: center;
                }
                .wfe-perf-stat-val {
                    display: block;
                    font-size: 1rem;
                    font-weight: 700;
                    color: #111827;
                }
                .wfe-perf-stat-lbl {
                    font-size: 0.65rem;
                    color: #9ca3af;
                }
                .wfe-perf-chart {
                    padding: 10px 14px;
                }
                .wfe-perf-bar-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 6px;
                }
                .wfe-perf-bar-label {
                    width: 100px;
                    font-size: 0.7rem;
                    color: #374151;
                    text-align: right;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .wfe-perf-bar-track {
                    flex: 1;
                    height: 18px;
                    background: #f3f4f6;
                    border-radius: 4px;
                    position: relative;
                    overflow: hidden;
                }
                .wfe-perf-bar-fill {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 0.5s ease-out;
                }
                .wfe-perf-bar-time {
                    position: absolute;
                    right: 6px;
                    top: 50%;
                    transform: translateY(-50%);
                    font-size: 0.6rem;
                    font-weight: 600;
                    color: #374151;
                }
                .wfe-perf-tips {
                    padding: 10px 14px;
                    border-top: 1px solid #f3f4f6;
                }
                .wfe-perf-tip {
                    font-size: 0.72rem;
                    color: #4b5563;
                    line-height: 1.5;
                    margin-bottom: 4px;
                }
            `}</style>
        </div>
    );
}

// ==================== 导出（带 Provider 包装） ====================

export default function WorkflowEditor(props: WorkflowEditorProps) {
    return (
        <ReactFlowProvider>
            <EditorInner {...props} />
        </ReactFlowProvider>
    );
}
