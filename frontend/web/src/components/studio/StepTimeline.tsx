/**
 * Phase 10a-UX S5: StepTimeline — 进度时间线容器
 *
 * 左侧竖线 + 圆点节点，包裹 ThinkingIndicator / ToolCallCard / TextBlock，
 * 状态驱动的颜色和动画。
 */

import type { ReactNode } from 'react'

export interface TimelineItem {
  id: string
  status: 'running' | 'done' | 'error'
  children: ReactNode
}

interface Props {
  items: TimelineItem[]
}

export default function StepTimeline({ items }: Props) {
  if (items.length === 0) return null

  return (
    <div className="relative pl-4">
      {/* 竖线 */}
      <div
        className="absolute left-[7px] top-2 bottom-2 w-[1.5px]"
        style={{ background: 'var(--novo-border-default)' }}
      />

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        const dotColor =
          item.status === 'error'
            ? 'var(--novo-accent-danger)'
            : item.status === 'done'
              ? 'var(--novo-accent-success)'
              : 'var(--novo-accent-primary)'

        return (
          <div key={item.id} className={`relative ${isLast ? '' : 'pb-1'}`}>
            {/* 圆点 */}
            <div
              className={`absolute left-[-13px] top-[8px] w-[9px] h-[9px] rounded-full border-2 ${
                item.status === 'running' ? 'timeline-dot-running' : ''
              }`}
              style={{
                borderColor: dotColor,
                background: item.status === 'running' ? 'transparent' : dotColor,
              }}
            />
            {/* 内容 */}
            <div className="min-w-0">{item.children}</div>
          </div>
        )
      })}
    </div>
  )
}
