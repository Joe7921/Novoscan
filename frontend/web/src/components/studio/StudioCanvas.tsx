/**
 * C5: StudioCanvas — React Flow 主画布
 *
 * 渲染节点和边，处理拖放、节点点击。
 */

import { useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useStudioStore, type StudioNodeData } from '@/lib/studioStore'
import StudioNode from './StudioNode'

const nodeTypes = { studioNode: StudioNode }

export default function StudioCanvas() {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    selectNode, addNode, blocksCache,
  } = useStudioStore()

  const rfInstance = useRef<ReactFlowInstance | null>(null)

  const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    selectNode(node.id)
  }, [selectNode])

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  // 处理从侧边栏拖入
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/novoscan-block')
    if (!raw) return

    try {
      const { id: blockId, blockType } = JSON.parse(raw) as { id: string; blockType: string }
      const meta = blocksCache.get(blockId)

      // 生成唯一节点 ID
      const nodeId = `${blockId}_${Date.now().toString(36)}`

      // 通用 ID 字段映射：三层积木对等处理
      const idFieldMap: Record<string, string> = {
        agent: 'agent_id',
        interaction: 'interaction_id',
        report: 'report_id',
      }
      const idField = idFieldMap[blockType]

      // 获取鼠标落点对应的画布坐标
      const dropPosition = rfInstance.current
        ? rfInstance.current.screenToFlowPosition({ x: e.clientX, y: e.clientY })
        : undefined

      addNode({
        id: nodeId,
        type: blockType as 'agent' | 'interaction' | 'report',
        ...(idField ? { [idField]: blockId } : {}),
        description: meta?.description || '',
      }, dropPosition)
    } catch {
      console.warn('拖放数据解析失败')
    }
  }, [addNode, blocksCache])

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onInit={(instance) => { rfInstance.current = instance }}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: 'var(--novo-border-strong, #94a3b8)', strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={15} size={1} color="var(--novo-border-default, #e2e8f0)" />
        <Controls
          showInteractive={false}
          style={{ bottom: 16, left: 16 }}
        />
        <MiniMap
          nodeColor={(node) => {
            const d = node.data as unknown as StudioNodeData
            switch (d.blockType) {
              case 'agent': return '#2563EB'
              case 'interaction': return '#EA580C'
              case 'report': return '#16A34A'
              default: return '#6B7280'
            }
          }}
          maskColor="rgba(0,0,0,0.05)"
          style={{ bottom: 16, right: 16, width: 120, height: 80 }}
        />
      </ReactFlow>
    </div>
  )
}
