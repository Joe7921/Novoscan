import { motion } from 'framer-motion'
import { ShieldAlert } from 'lucide-react'
import type { RiskFlag } from '@/types/report'

interface RiskTableProps {
  risks: RiskFlag[]
}

const severityStyle: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  high: {
    bg: 'var(--novo-accent-danger-light)',
    text: 'var(--novo-accent-danger)',
    dot: 'var(--novo-accent-danger)',
    label: '高',
  },
  medium: {
    bg: 'var(--novo-accent-warning-light)',
    text: 'var(--novo-accent-warning)',
    dot: 'var(--novo-accent-warning)',
    label: '中',
  },
  low: {
    bg: 'var(--novo-accent-success-light)',
    text: 'var(--novo-accent-success)',
    dot: 'var(--novo-accent-success)',
    label: '低',
  },
}

export default function RiskTable({ risks }: RiskTableProps) {
  if (risks.length === 0) {
    return (
      <div className="novo-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4" style={{ color: 'var(--novo-accent-success)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>风险清单</h3>
        </div>
        <p className="text-xs" style={{ color: 'var(--novo-text-muted)' }}>暂无风险提示</p>
      </div>
    )
  }

  return (
    <div className="novo-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-4 h-4" style={{ color: 'var(--novo-accent-danger)' }} />
        <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>风险清单</h3>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold"
          style={{ background: 'var(--novo-accent-danger-light)', color: 'var(--novo-accent-danger)' }}
        >
          {risks.length} 项
        </span>
      </div>
      <div className="space-y-2">
        {risks.map((r, i) => {
          const s = severityStyle[r.severity] ?? severityStyle.medium
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
              style={{ background: 'var(--novo-bg-surface)' }}
            >
              {/* 严重度指示 */}
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 shrink-0"
                style={{ background: s.bg, color: s.text }}
              >
                {s.label}
              </span>
              {/* 风险描述 */}
              <div className="flex-1 min-w-0">
                <div className="text-xs leading-relaxed" style={{ color: 'var(--novo-text-primary)' }}>
                  {r.risk}
                </div>
                {r.sourceAgent && (
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--novo-text-muted)' }}>
                    来源: {r.sourceAgent}
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
