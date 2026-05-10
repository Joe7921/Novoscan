/**
 * Phase 10a-UX S4: ThinkingIndicator — AI 思考阶段指示器
 *
 * 显示脉冲动画和实时计时器，thinking 结束后折叠为单行摘要。
 */

import { useState, useEffect, useRef } from 'react'
import { Brain } from 'lucide-react'

interface Props {
  status: 'running' | 'done' | 'error'
  durationMs?: number
}

export default function ThinkingIndicator({ status, durationMs }: Props) {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    if (status !== 'running') return
    startRef.current = Date.now()
    const timer = setInterval(() => {
      setElapsed(Date.now() - startRef.current)
    }, 100)
    return () => clearInterval(timer)
  }, [status])

  const displayMs = status === 'done' && durationMs != null ? durationMs : elapsed
  const seconds = (displayMs / 1000).toFixed(1)

  if (status === 'done') {
    return (
      <div className="flex items-center gap-1.5 py-1 text-[9px]" style={{ color: 'var(--novo-text-muted)' }}>
        <Brain className="w-3 h-3" style={{ color: 'var(--novo-text-disabled)' }} />
        <span>思考 {seconds}s</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-1.5">
      <Brain className="w-3.5 h-3.5 thinking-pulse" style={{ color: 'var(--novo-accent-primary)' }} />
      <span className="text-[10px] font-medium" style={{ color: 'var(--novo-text-secondary)' }}>
        正在思考...
      </span>
      <span className="text-[9px] font-mono" style={{ color: 'var(--novo-text-muted)' }}>
        {seconds}s
      </span>
      <div className="flex items-center gap-0.5 ml-1">
        <span className="thinking-dot" style={{ animationDelay: '0ms' }} />
        <span className="thinking-dot" style={{ animationDelay: '150ms' }} />
        <span className="thinking-dot" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}
