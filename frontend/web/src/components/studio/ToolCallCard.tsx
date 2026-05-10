/**
 * Phase 10a-UX S3: ToolCallCard — 可折叠 Tool 调用卡片
 *
 * Windsurf/Cursor 风格的 Tool 调用展示：
 * - CardHeader: 图标 + 工具友好名 + 参数摘要 + 状态徽章 + 耗时
 * - CardBody:   折叠区 → 完整参数 + 返回结果
 * - InlinePreview: 当 has_preview 时内嵌 YAMLPreviewCard
 */

import { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Wrench,
  Clock,
} from 'lucide-react'
import YAMLPreviewCard from './YAMLPreviewCard'
import type { YAMLPreview } from './YAMLPreviewCard'

export interface ToolCallStep {
  toolName: string
  toolLabel: string
  argsSummary: string
  args?: Record<string, unknown>
  status: 'running' | 'done' | 'error'
  resultSummary?: string
  resultDetail?: string
  durationMs?: number
  hasPreview?: boolean
  yamlPreview?: YAMLPreview
}

interface Props {
  step: ToolCallStep
}

const TOOL_ICONS: Record<string, string> = {
  create_agent: '🤖',
  create_interaction: '🔄',
  create_report: '📊',
  modify_block: '✏️',
  create_pipeline: '🔗',
  list_blocks: '📋',
  validate_yaml: '✅',
  dry_run_pipeline: '🧪',
}

export default function ToolCallCard({ step }: Props) {
  const [expanded, setExpanded] = useState(false)

  const isRunning = step.status === 'running'
  const isError = step.status === 'error'
  const isDone = step.status === 'done'

  const icon = TOOL_ICONS[step.toolName] || '🔧'

  const borderColor = isError
    ? 'color-mix(in srgb, var(--novo-accent-danger) 25%, transparent)'
    : isDone
      ? 'color-mix(in srgb, var(--novo-accent-success) 20%, transparent)'
      : 'color-mix(in srgb, var(--novo-accent-primary) 20%, transparent)'

  const headerBg = isError
    ? 'color-mix(in srgb, var(--novo-accent-danger) 4%, transparent)'
    : isDone
      ? 'color-mix(in srgb, var(--novo-accent-success) 3%, transparent)'
      : 'color-mix(in srgb, var(--novo-accent-primary) 4%, transparent)'

  return (
    <div
      className="rounded-lg overflow-hidden my-1 transition-all duration-200"
      style={{ border: `1px solid ${borderColor}` }}
    >
      {/* ── CardHeader: 可点击切换折叠 ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left transition-colors hover:brightness-95"
        style={{ background: headerBg }}
      >
        {/* 折叠箭头 */}
        {expanded ? (
          <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--novo-text-muted)' }} />
        ) : (
          <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--novo-text-muted)' }} />
        )}

        {/* Tool 图标 */}
        <span className="text-[10px] flex-shrink-0">{icon}</span>

        {/* 工具名 */}
        <span className="text-[9px] font-semibold flex-shrink-0" style={{ color: 'var(--novo-text-primary)' }}>
          {step.toolLabel}
        </span>

        {/* 参数摘要 / 结果摘要 */}
        <span
          className="text-[8px] truncate flex-1 mx-1"
          style={{ color: 'var(--novo-text-muted)' }}
          title={isDone ? step.resultSummary : step.argsSummary}
        >
          {isDone && step.resultSummary ? `→ ${step.resultSummary}` : step.argsSummary}
        </span>

        {/* 状态徽章 */}
        <span className="flex items-center gap-1 flex-shrink-0">
          {isRunning && (
            <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--novo-accent-primary)' }} />
          )}
          {isDone && (
            <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--novo-accent-success)' }} />
          )}
          {isError && (
            <XCircle className="w-3 h-3" style={{ color: 'var(--novo-accent-danger)' }} />
          )}
        </span>

        {/* 耗时 */}
        {step.durationMs != null && step.durationMs > 0 && (
          <span className="flex items-center gap-0.5 text-[8px] flex-shrink-0" style={{ color: 'var(--novo-text-disabled)' }}>
            <Clock className="w-2.5 h-2.5" />
            {(step.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </button>

      {/* ── CardBody: 折叠区 ── */}
      <div
        className="transition-all duration-200 overflow-hidden"
        style={{ maxHeight: expanded ? '400px' : '0px' }}
      >
        <div className="px-3 py-2 space-y-2" style={{ borderTop: `1px solid ${borderColor}`, background: 'var(--novo-bg-surface)' }}>
          {/* 参数列表 */}
          {step.args && Object.keys(step.args).length > 0 && (
            <div>
              <div className="text-[8px] font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--novo-text-muted)' }}>
                <Wrench className="w-2.5 h-2.5" />
                参数
              </div>
              <div className="space-y-0.5">
                {Object.entries(step.args).map(([k, v]) => (
                  <div key={k} className="flex gap-1.5 text-[8px]">
                    <span className="font-mono font-medium flex-shrink-0" style={{ color: 'var(--novo-accent-primary)' }}>{k}:</span>
                    <span className="font-mono truncate" style={{ color: 'var(--novo-text-secondary)' }}>
                      {typeof v === 'string' ? (v.length > 80 ? v.slice(0, 77) + '...' : v) : JSON.stringify(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 返回结果 */}
          {step.resultDetail && (
            <div>
              <div className="text-[8px] font-semibold mb-1" style={{ color: 'var(--novo-text-muted)' }}>
                返回结果
              </div>
              <pre
                className="text-[8px] font-mono leading-relaxed rounded p-1.5 overflow-x-auto whitespace-pre-wrap"
                style={{
                  background: 'var(--novo-bg-base)',
                  color: 'var(--novo-text-secondary)',
                  maxHeight: '150px',
                  overflowY: 'auto',
                }}
              >
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(step.resultDetail), null, 2)
                  } catch {
                    return step.resultDetail
                  }
                })()}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* ── InlinePreview: YAML 预览内嵌 ── */}
      {step.yamlPreview && (
        <div style={{ borderTop: `1px solid ${borderColor}` }}>
          <YAMLPreviewCard preview={step.yamlPreview} compact />
        </div>
      )}
    </div>
  )
}
