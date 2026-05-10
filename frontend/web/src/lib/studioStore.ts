/**
 * Studio 画布状态管理 — Zustand Store
 *
 * 管理 React Flow 节点/边、积木元数据缓存、管线加载/保存。
 */

import { create } from 'zustand'
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from '@xyflow/react'
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react'
import dagre from 'dagre'
import type {
  AnyBlockMeta,
  PipelineDefinition,
  PipelineNode,
  PipelineEdge,
  BlocksResponse,
} from '../types/blocks'

// ══════════════════════════════════════════════════════════════
// 节点 data 类型
// ══════════════════════════════════════════════════════════════

export interface StudioNodeData {
  label: string
  blockType: 'agent' | 'interaction' | 'report' | 'logic'
  blockId?: string           // agent_id / interaction_id / report_id
  description?: string
  config?: Record<string, unknown>
  meta?: AnyBlockMeta        // 关联的积木元数据
  notes?: string             // 用户自定义注释（覆盖 meta.notes 默认值）
  status?: 'idle' | 'running' | 'done' | 'error'
}

// ══════════════════════════════════════════════════════════════
// Dagre 自动布局
// ══════════════════════════════════════════════════════════════

const NODE_WIDTH = 200
const NODE_HEIGHT = 70

function layoutWithDagre(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 80 })

  nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach(e => g.setEdge(e.source, e.target))

  dagre.layout(g)

  return nodes.map(n => {
    const pos = g.node(n.id)
    return {
      ...n,
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    }
  })
}

// ══════════════════════════════════════════════════════════════
// Pipeline JSON ↔ React Flow 转换
// ══════════════════════════════════════════════════════════════

function pipelineToFlow(
  pipeline: PipelineDefinition,
  blocksCache: Map<string, AnyBlockMeta>,
): { nodes: Node[]; edges: Edge[] } {
  const rawNodes: Node[] = [
    // START 虚拟节点
    {
      id: 'START',
      type: 'studioNode',
      position: { x: 0, y: 0 },
      data: { label: 'START', blockType: 'logic', description: '管线入口' } satisfies StudioNodeData,
    },
    ...pipeline.nodes.map((pn: PipelineNode) => {
      const refId = pn.agent_id || pn.interaction_id || pn.report_id
      const meta = refId ? blocksCache.get(refId) : undefined
      return {
        id: pn.id,
        type: 'studioNode',
        position: { x: 0, y: 0 },
        data: {
          label: meta?.name || pn.id,
          blockType: pn.type === 'logic' ? 'logic' : pn.type,
          blockId: refId,
          description: pn.description || meta?.description || '',
          config: pn.config,
          meta,
        } satisfies StudioNodeData,
      } as Node
    }),
    // END 虚拟节点
    {
      id: 'END',
      type: 'studioNode',
      position: { x: 0, y: 0 },
      data: { label: 'END', blockType: 'logic', description: '管线出口' } satisfies StudioNodeData,
    },
  ]

  const rawEdges: Edge[] = pipeline.edges.map((pe: PipelineEdge, i: number) => ({
    id: `e-${i}-${pe.from}-${pe.to}`,
    source: pe.from,
    target: pe.to,
    label: pe.condition || undefined,
    type: pe.condition ? 'smoothstep' : 'default',
    animated: !!pe.condition,
    data: { condition: pe.condition },
  }))

  const layoutedNodes = layoutWithDagre(rawNodes, rawEdges)
  return { nodes: layoutedNodes, edges: rawEdges }
}

function flowToPipeline(
  nodes: Node[],
  edges: Edge[],
  basePipeline: PipelineDefinition,
): PipelineDefinition {
  const pipelineNodes: PipelineNode[] = nodes
    .filter(n => n.id !== 'START' && n.id !== 'END')
    .map(n => {
      const d = n.data as unknown as StudioNodeData
      const pn: PipelineNode = {
        id: n.id,
        type: d.blockType,
        description: d.description,
        config: d.config,
      }
      if (d.blockType === 'agent' && d.blockId) pn.agent_id = d.blockId
      if (d.blockType === 'interaction' && d.blockId) pn.interaction_id = d.blockId
      if (d.blockType === 'report' && d.blockId) pn.report_id = d.blockId
      return pn
    })

  const pipelineEdges: PipelineEdge[] = edges.map(e => {
    const pe: PipelineEdge = { from: e.source, to: e.target }
    const cond = (e.data as Record<string, unknown>)?.condition as string | undefined
    if (cond) pe.condition = cond
    return pe
  })

  const interruptBefore = nodes
    .filter(n => {
      const d = n.data as unknown as StudioNodeData
      return d.blockType === 'interaction' && d.blockId?.includes('hitl')
    })
    .map(n => n.id)

  return {
    ...basePipeline,
    nodes: pipelineNodes,
    edges: pipelineEdges,
    interrupt_before: interruptBefore.length > 0 ? interruptBefore : basePipeline.interrupt_before,
  }
}

// ══════════════════════════════════════════════════════════════
// Zustand Store
// ══════════════════════════════════════════════════════════════

interface StudioState {
  // React Flow 节点/边
  nodes: Node[]
  edges: Edge[]
  onNodesChange: OnNodesChange
  onEdgesChange: OnEdgesChange
  onConnect: OnConnect

  // 管线
  currentPipeline: PipelineDefinition | null
  currentFilename: string | null
  isDirty: boolean

  // 积木缓存
  blocksCache: Map<string, AnyBlockMeta>
  blocksResponse: BlocksResponse | null

  // 选中
  selectedNodeId: string | null

  // 运行模式
  studioMode: 'standard' | 'agentic'
  setStudioMode: (mode: 'standard' | 'agentic') => void

  // 操作
  loadPipeline: (pipeline: PipelineDefinition, filename: string) => void
  setBlocksCache: (resp: BlocksResponse) => void
  addNode: (node: PipelineNode, position?: { x: number; y: number }) => void
  removeNode: (nodeId: string) => void
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void
  updateNodeNotes: (nodeId: string, notes: string) => void
  updateEdgeCondition: (edgeId: string, condition: string) => void
  selectNode: (nodeId: string | null) => void
  autoLayout: () => void
  toPipelineJSON: () => PipelineDefinition | null
  markClean: () => void
}

export const useStudioStore = create<StudioState>((set, get) => ({
  nodes: [],
  edges: [],
  currentPipeline: null,
  currentFilename: null,
  isDirty: false,
  blocksCache: new Map(),
  blocksResponse: null,
  selectedNodeId: null,
  studioMode: 'standard',
  setStudioMode: (mode) => set({ studioMode: mode }),

  onNodesChange: (changes) => {
    set(s => ({ nodes: applyNodeChanges(changes, s.nodes), isDirty: true }))
  },
  onEdgesChange: (changes) => {
    set(s => ({ edges: applyEdgeChanges(changes, s.edges), isDirty: true }))
  },
  onConnect: (connection) => {
    set(s => ({ edges: addEdge(connection, s.edges), isDirty: true }))
  },

  loadPipeline: (pipeline, filename) => {
    const { blocksCache } = get()
    const { nodes, edges } = pipelineToFlow(pipeline, blocksCache)
    set({ nodes, edges, currentPipeline: pipeline, currentFilename: filename, isDirty: false, selectedNodeId: null })
  },

  setBlocksCache: (resp) => {
    const cache = new Map<string, AnyBlockMeta>()
    for (const a of resp.agents) cache.set(a.id, a)
    for (const i of resp.interactions) cache.set(i.id, i)
    for (const r of resp.reports) cache.set(r.id, r)
    set({ blocksCache: cache, blocksResponse: resp })
  },

  addNode: (pn, position) => {
    const { blocksCache, nodes, edges } = get()
    const refId = pn.agent_id || pn.interaction_id || pn.report_id
    const meta = refId ? blocksCache.get(refId) : undefined

    const newNode: Node = {
      id: pn.id,
      type: 'studioNode',
      position: position || { x: 250, y: nodes.length * 100 },
      data: {
        label: meta?.name || pn.id,
        blockType: pn.type === 'logic' ? 'logic' : pn.type,
        blockId: refId,
        description: pn.description || meta?.description || '',
        config: pn.config,
        meta,
        notes: meta?.notes || '',
      } satisfies StudioNodeData,
    }

    set({ nodes: [...nodes, newNode], isDirty: true })

    // 智能连线：report 节点插入 END 前，agent/interaction 插入最后一个非 report 节点后
    const updatedEdges = [...get().edges]
    const endEdgeIdx = updatedEdges.findIndex(e => e.target === 'END')

    if (pn.type === 'report') {
      // Report 节点：直接插入 END 前（支持多个 report 并行连接到 END）
      if (endEdgeIdx >= 0) {
        const prevSource = updatedEdges[endEdgeIdx].source
        updatedEdges[endEdgeIdx] = { ...updatedEdges[endEdgeIdx], source: pn.id }
        updatedEdges.push({
          id: `e-auto-${prevSource}-${pn.id}`,
          source: prevSource,
          target: pn.id,
        })
        set({ edges: updatedEdges })
      }
    } else {
      // Agent/Interaction：插入到最后一个非 report 节点之后
      // 找到所有连接到 report 节点或 END 的边的源节点中，最后一个非 report 的
      const reportNodeIds = new Set(
        nodes
          .filter(n => (n.data as unknown as StudioNodeData).blockType === 'report')
          .map(n => n.id)
      )
      // 找到连接到 report 节点的边
      const edgeToReport = updatedEdges.find(e => reportNodeIds.has(e.target))

      if (edgeToReport) {
        // 在 report 节点前插入
        const prevSource = edgeToReport.source
        const edgeIdx = updatedEdges.indexOf(edgeToReport)
        updatedEdges[edgeIdx] = { ...edgeToReport, source: pn.id }
        updatedEdges.push({
          id: `e-auto-${prevSource}-${pn.id}`,
          source: prevSource,
          target: pn.id,
        })
        set({ edges: updatedEdges })
      } else if (endEdgeIdx >= 0) {
        // 没有 report 节点，正常插入 END 前
        const prevSource = updatedEdges[endEdgeIdx].source
        updatedEdges[endEdgeIdx] = { ...updatedEdges[endEdgeIdx], source: pn.id }
        updatedEdges.push({
          id: `e-auto-${prevSource}-${pn.id}`,
          source: prevSource,
          target: pn.id,
        })
        set({ edges: updatedEdges })
      }
    }
  },

  removeNode: (nodeId) => {
    if (nodeId === 'START' || nodeId === 'END') return
    set(s => ({
      nodes: s.nodes.filter(n => n.id !== nodeId),
      edges: s.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      isDirty: true,
      selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
    }))
  },

  updateNodeConfig: (nodeId, config) => {
    set(s => ({
      nodes: s.nodes.map(n =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, config: { ...(n.data as unknown as StudioNodeData).config, ...config } } }
          : n
      ),
      isDirty: true,
    }))
  },

  updateNodeNotes: (nodeId, notes) => {
    set(s => ({
      nodes: s.nodes.map(n =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, notes } }
          : n
      ),
      isDirty: true,
    }))
  },

  updateEdgeCondition: (edgeId, condition) => {
    set(s => ({
      edges: s.edges.map(e =>
        e.id === edgeId
          ? {
              ...e,
              label: condition || undefined,
              animated: !!condition,
              type: condition ? 'smoothstep' : 'default',
              data: { ...e.data, condition },
            }
          : e
      ),
      isDirty: true,
    }))
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  autoLayout: () => {
    const { nodes, edges } = get()
    const layouted = layoutWithDagre(nodes, edges)
    set({ nodes: layouted })
  },

  toPipelineJSON: () => {
    const { nodes, edges, currentPipeline } = get()
    if (!currentPipeline) return null
    return flowToPipeline(nodes, edges, currentPipeline)
  },

  markClean: () => set({ isDirty: false }),
}))
