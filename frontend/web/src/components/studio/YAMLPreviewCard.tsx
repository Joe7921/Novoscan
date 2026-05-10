/**
 * Phase 10a-S4: YAMLPreviewCard — YAML/JSON 预览卡片
 *
 * 在 DesignAssistant 中展示 Studio Agent 生成的配置预览，
 * 支持"应用到画布"、"复制"操作。
 */

import { useState } from 'react'
import { Copy, Check, PlusCircle, FileCode2 } from 'lucide-react'
import { useStudioStore } from '@/lib/studioStore'

export interface YAMLPreview {
  blockType: 'agent' | 'interaction' | 'report' | 'pipeline'
  blockId: string
  content: string
}

interface Props {
  preview: YAMLPreview
  compact?: boolean
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  agent:       { label: 'Agent',       color: '#2563EB' },
  interaction: { label: 'Interaction', color: '#7C3AED' },
  report:      { label: 'Report',      color: '#059669' },
  pipeline:    { label: 'Pipeline',    color: '#D97706' },
}

export default function YAMLPreviewCard({ preview, compact = false }: Props) {
  const [copied, setCopied] = useState(false)
  const [applied, setApplied] = useState(false)
  const addNode = useStudioStore(s => s.addNode)
  const loadPipeline = useStudioStore(s => s.loadPipeline)

  const typeInfo = TYPE_LABELS[preview.blockType] || TYPE_LABELS.agent

  const handleCopy = () => {
    navigator.clipboard.writeText(preview.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const handleApplyToCanvas = () => {
    if (preview.blockType === 'pipeline') {
      try {
        const pipelineDef = JSON.parse(preview.content)
        loadPipeline(pipelineDef, `${preview.blockId || 'new_pipeline'}.json`)
        setApplied(true)
      } catch {
        // JSON 解析失败，忽略
      }
    } else {
      const nodeType = preview.blockType === 'agent' ? 'agent'
        : preview.blockType === 'interaction' ? 'interaction'
        : 'report'

      addNode({
        id: preview.blockId || `new_${nodeType}_${Date.now()}`,
        type: nodeType,
        ...(nodeType === 'agent' ? { agent_id: preview.blockId } : {}),
        ...(nodeType === 'interaction' ? { interaction_id: preview.blockId } : {}),
        ...(nodeType === 'report' ? { report_id: preview.blockId } : {}),
        description: '',
      })
      setApplied(true)
    }
    setTimeout(() => setApplied(false), 2000)
  }

  // 截取预览内容（最多 20 行）
  const lines = preview.content.split('\n')
  const displayContent = lines.length > 20
    ? lines.slice(0, 20).join('\n') + '\n...'
    : preview.content

  return (
    <div
      className={`overflow-hidden ${compact ? 'rounded-none' : 'rounded-lg my-1.5'}`}
      style={{
        border: compact ? 'none' : `1px solid color-mix(in srgb, ${typeInfo.color} 30%, transparent)`,
        background: 'var(--novo-bg-surface)',
      }}
    >
      {/* 头部：类型标签 + ID */}
      <div
        className="flex items-center gap-2 px-2.5 py-1.5"
        style={{
          background: `color-mix(in srgb, ${typeInfo.color} 8%, transparent)`,
          borderBottom: `1px solid color-mix(in srgb, ${typeInfo.color} 20%, transparent)`,
        }}
      >
        <FileCode2 className="w-3 h-3" style={{ color: typeInfo.color }} />
        <span
          className="text-[8px] font-bold px-1.5 py-0.5 rounded"
          style={{
            background: `color-mix(in srgb, ${typeInfo.color} 15%, transparent)`,
            color: typeInfo.color,
          }}
        >
          {typeInfo.label}
        </span>
        <span className="text-[9px] font-mono flex-1" style={{ color: 'var(--novo-text-secondary)' }}>
          {preview.blockId}
        </span>
      </div>

      {/* 代码预览 */}
      <pre
        className="px-2.5 py-2 text-[8px] font-mono leading-relaxed overflow-x-auto whitespace-pre"
        style={{
          color: 'var(--novo-text-secondary)',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      >
        {displayContent}
      </pre>

      {/* 操作按钮 */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5"
        style={{
          borderTop: '1px solid var(--novo-border-default)',
          background: 'var(--novo-bg-base)',
        }}
      >
        <button
          onClick={handleApplyToCanvas}
          disabled={applied}
          className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-medium transition-colors"
          style={{
            background: applied
              ? 'color-mix(in srgb, var(--novo-accent-success) 15%, transparent)'
              : `color-mix(in srgb, ${typeInfo.color} 12%, transparent)`,
            color: applied ? 'var(--novo-accent-success)' : typeInfo.color,
          }}
        >
          {applied ? (
            <><Check className="w-2.5 h-2.5" /> 已应用</>
          ) : (
            <><PlusCircle className="w-2.5 h-2.5" /> 应用到画布</>
          )}
        </button>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-medium transition-colors hover:bg-[var(--novo-bg-hover)]"
          style={{ color: 'var(--novo-text-muted)' }}
        >
          {copied ? (
            <><Check className="w-2.5 h-2.5" /> 已复制</>
          ) : (
            <><Copy className="w-2.5 h-2.5" /> 复制</>
          )}
        </button>
      </div>
    </div>
  )
}
