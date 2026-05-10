/**
 * C6: StudioStatusBar — 画布底部状态栏
 *
 * 显示当前管线名、节点/边数量、保存状态。
 */

import { useStudioStore } from '@/lib/studioStore'

export default function StudioStatusBar() {
  const { nodes, edges, currentFilename, isDirty, currentPipeline, studioMode, selectedNodeId } = useStudioStore()

  return (
    <div
      className="flex items-center gap-4 px-4 py-1.5 text-[9px] border-t"
      style={{
        background: 'var(--novo-bg-elevated)',
        borderColor: 'var(--novo-border-default)',
        color: 'var(--novo-text-muted)',
      }}
    >
      <span
        className="px-1.5 py-0.5 rounded font-semibold"
        style={{
          background: studioMode === 'agentic' ? 'rgba(124,58,237,0.1)' : 'rgba(37,99,235,0.1)',
          color: studioMode === 'agentic' ? '#7C3AED' : '#2563EB',
        }}
      >
        {studioMode === 'agentic' ? 'Agentic · 智能体' : 'Standard · 传统'}
      </span>
      <span>
        {currentPipeline?.name || '未加载管线'}
        {currentFilename && ` (${currentFilename})`}
      </span>
      <span>{nodes.length} 节点</span>
      <span>{edges.length} 边</span>
      {selectedNodeId && (
        <span style={{ color: 'var(--novo-text-secondary)' }}>选中: {selectedNodeId}</span>
      )}
      <div className="flex-1" />
      <span>
        {isDirty ? (
          <span style={{ color: 'var(--novo-accent-warning)' }}>● 未保存</span>
        ) : (
          <span style={{ color: 'var(--novo-accent-success)' }}>● 已保存</span>
        )}
      </span>
    </div>
  )
}
