/**
 * C1: StudioNode — React Flow 自定义节点
 *
 * 根据 blockType 渲染不同外观，自动生成 Handle（连接点）。
 */

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Bot, MousePointerClick, FileText, Cog, Play, Flag, RefreshCw, Loader2 } from 'lucide-react'
import type { StudioNodeData } from '@/lib/studioStore'
import { useDebugStore } from '@/lib/debugStore'
import type { ReportBlockMeta, AgentBlockMeta } from '@/types/blocks'

const DEBUG_STATUS_COLORS: Record<string, string> = {
  done: '#10B981',
  error: '#EF4444',
  running: '#F59E0B',
  stale: '#A78BFA',
}

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: typeof Bot; iconColor: string }> = {
  agent:       { bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.3)',  icon: Bot,               iconColor: '#2563EB' },
  interaction: { bg: 'rgba(234,88,12,0.06)', border: 'rgba(234,88,12,0.3)',  icon: MousePointerClick, iconColor: '#EA580C' },
  report:      { bg: 'rgba(22,163,74,0.06)', border: 'rgba(22,163,74,0.3)',  icon: FileText,          iconColor: '#16A34A' },
  logic:       { bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.3)', icon: Cog,            iconColor: '#6B7280' },
}

// 过滤器 Agent 专属样式
const FILTER_STYLE = { bg: 'rgba(13,148,136,0.06)', border: 'rgba(13,148,136,0.3)', icon: RefreshCw, iconColor: '#0D9488' }

function StudioNodeInner({ data, id, selected, dragging }: NodeProps) {
  const d = data as unknown as StudioNodeData
  const isTerminal = d.label === 'START' || d.label === 'END'
  const debugCache = useDebugStore(s => s.nodeCache[id])

  // 过滤器 Agent 使用专属样式
  const isFilter = d.blockType === 'agent' && (d.meta as AgentBlockMeta | undefined)?.role_type === 'filter'
  const style = isFilter ? FILTER_STYLE : (TYPE_STYLES[d.blockType] || TYPE_STYLES.logic)
  const Icon = isTerminal ? (d.label === 'START' ? Play : Flag) : style.icon

  // Report 节点的 sections 数量
  const sectionsCount = d.blockType === 'report' ? ((d.meta as ReportBlockMeta | undefined)?.sections?.length ?? 0) : 0

  return (
    <div
      className={`relative rounded-xl px-3 py-2.5 min-w-[160px] transition-all ${d.blockType === 'report' ? 'max-w-[280px]' : 'max-w-[220px]'}`}
      style={{
        background: isTerminal ? 'var(--novo-bg-elevated)' : style.bg,
        border: `1.5px solid ${selected ? style.iconColor : style.border}`,
        boxShadow: dragging ? `0 8px 24px rgba(0,0,0,0.15)` : selected ? `0 0 0 2px ${style.iconColor}33` : 'none',
        opacity: dragging ? 0.7 : 1,
        transform: dragging ? 'scale(1.03)' : 'none',
      }}
    >
      {/* 顶部 handle */}
      {d.label !== 'START' && (
        <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white" />
      )}

      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: isTerminal ? 'var(--novo-bg-surface)' : `${style.iconColor}15` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: style.iconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--novo-text-primary)' }}>
            {d.label}
          </div>
          {d.notes && !isTerminal ? (
            <div className="text-[9px] truncate mt-0.5" style={{ color: style.iconColor, opacity: 0.7 }} title={d.notes}>
              {d.notes}
            </div>
          ) : d.description && !isTerminal ? (
            <div className="text-[9px] truncate mt-0.5" style={{ color: 'var(--novo-text-muted)' }}>
              {d.description}
            </div>
          ) : null}
        </div>
      </div>

      {/* Report sections 角标 / Filter 角标 */}
      {!isTerminal && d.blockType === 'report' && sectionsCount > 0 && (
        <div className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-full text-[7px] font-bold border border-white"
          style={{ background: '#16A34A', color: 'white' }}>
          {sectionsCount} sections
        </div>
      )}
      {!isTerminal && isFilter && (
        <div className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-full text-[7px] font-bold border border-white"
          style={{ background: '#0D9488', color: 'white' }}>
          转换层
        </div>
      )}

      {/* 运行状态指示 */}
      {d.status && d.status !== 'idle' && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
          style={{
            background: d.status === 'running' ? '#F59E0B' : d.status === 'done' ? '#10B981' : '#EF4444',
          }}
        />
      )}

      {/* S4: Last Run 调试角标 */}
      {debugCache && debugCache.status !== 'idle' && !isTerminal && (
        <div
          className="absolute -bottom-1.5 -right-1.5 flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[7px] font-bold border border-white"
          style={{ background: DEBUG_STATUS_COLORS[debugCache.status] || '#6B7280', color: 'white' }}
        >
          {debugCache.status === 'running' && <Loader2 className="w-2 h-2 animate-spin" />}
          {debugCache.status === 'done' && `${debugCache.duration_ms}ms`}
          {debugCache.status === 'error' && 'ERR'}
          {debugCache.status === 'stale' && 'STALE'}
        </div>
      )}

      {/* 底部 handle */}
      {d.label !== 'END' && (
        <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-gray-400 !border-2 !border-white" />
      )}
    </div>
  )
}

export const StudioNode = memo(StudioNodeInner)
export default StudioNode
