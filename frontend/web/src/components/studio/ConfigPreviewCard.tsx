/**
 * Phase P10a-S5: ConfigPreviewCard — Agentic 配置变更预览卡片
 *
 * 对标 Dify Variable Inspect，在 DesignAssistant 中展示
 * update_agentic_config Tool 返回的配置变更 diff。
 */

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, Settings2, ChevronDown, ChevronRight } from 'lucide-react'

interface ConfigPreview {
  changes: string[]
  warnings: string[]
  reloadOk: boolean
  configSnapshot: {
    temperature?: number
    max_iterations?: number
    tools_enabled?: string[]
    tools_disabled?: string[]
  }
}

interface Props {
  preview: ConfigPreview
}

export default function ConfigPreviewCard({ preview }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { changes, warnings, reloadOk, configSnapshot } = preview

  return (
    <div
      className="rounded-xl border my-1 overflow-hidden"
      style={{
        borderColor: reloadOk ? 'rgba(5,150,105,0.3)' : 'rgba(239,68,68,0.3)',
        background: 'var(--novo-bg-surface)',
      }}
    >
      {/* 头部 */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
        style={{ background: reloadOk ? 'rgba(5,150,105,0.06)' : 'rgba(239,68,68,0.06)' }}
        onClick={() => setExpanded(v => !v)}
      >
        <Settings2 className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
        <span className="text-[9px] font-bold flex-1" style={{ color: 'var(--novo-text-primary)' }}>
          配置变更预览
        </span>
        {reloadOk ? (
          <CheckCircle2 className="w-3 h-3" style={{ color: '#059669' }} />
        ) : (
          <AlertTriangle className="w-3 h-3" style={{ color: '#EF4444' }} />
        )}
        <span className="text-[8px]" style={{ color: reloadOk ? '#059669' : '#EF4444' }}>
          {reloadOk ? '已生效' : '重载失败'}
        </span>
        {expanded
          ? <ChevronDown className="w-3 h-3" style={{ color: 'var(--novo-text-disabled)' }} />
          : <ChevronRight className="w-3 h-3" style={{ color: 'var(--novo-text-disabled)' }} />
        }
      </div>

      {/* 变更摘要（始终显示） */}
      <div className="px-3 py-1.5 space-y-0.5">
        {changes.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[8px]" style={{ color: 'var(--novo-text-secondary)' }}>
            <span className="w-1 h-1 rounded-full shrink-0" style={{ background: '#7C3AED' }} />
            <span>{c}</span>
          </div>
        ))}
      </div>

      {/* 警告 */}
      {warnings.length > 0 && (
        <div className="px-3 py-1 space-y-0.5" style={{ background: 'rgba(245,158,11,0.06)' }}>
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[8px]" style={{ color: '#D97706' }}>
              <AlertTriangle className="w-2.5 h-2.5 shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* 展开详情 */}
      {expanded && configSnapshot && (
        <div className="px-3 py-2 border-t space-y-1" style={{ borderColor: 'var(--novo-border-default)' }}>
          <div className="text-[7px] font-semibold" style={{ color: 'var(--novo-text-disabled)' }}>
            配置快照
          </div>
          {configSnapshot.temperature !== undefined && (
            <div className="flex items-center justify-between text-[8px]">
              <span style={{ color: 'var(--novo-text-secondary)' }}>temperature</span>
              <span className="font-mono" style={{ color: 'var(--novo-text-primary)' }}>{configSnapshot.temperature}</span>
            </div>
          )}
          {configSnapshot.max_iterations !== undefined && (
            <div className="flex items-center justify-between text-[8px]">
              <span style={{ color: 'var(--novo-text-secondary)' }}>max_iterations</span>
              <span className="font-mono" style={{ color: 'var(--novo-text-primary)' }}>{configSnapshot.max_iterations}</span>
            </div>
          )}
          {configSnapshot.tools_enabled && configSnapshot.tools_enabled.length > 0 && (
            <div className="text-[8px]">
              <span style={{ color: 'var(--novo-text-secondary)' }}>启用: </span>
              <span className="font-mono" style={{ color: '#059669' }}>
                {configSnapshot.tools_enabled.join(', ')}
              </span>
            </div>
          )}
          {configSnapshot.tools_disabled && configSnapshot.tools_disabled.length > 0 && (
            <div className="text-[8px]">
              <span style={{ color: 'var(--novo-text-secondary)' }}>禁用: </span>
              <span className="font-mono" style={{ color: '#EF4444' }}>
                {configSnapshot.tools_disabled.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
