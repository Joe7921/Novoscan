import { motion } from 'framer-motion'
import { Lightbulb } from 'lucide-react'
import type { KeyFinding } from '@/types/report'

interface KeyFindingsProps {
  findings: KeyFinding[]
}

export default function KeyFindings({ findings }: KeyFindingsProps) {
  if (findings.length === 0) return null

  return (
    <div className="novo-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4" style={{ color: 'var(--novo-accent-warning)' }} />
        <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>关键发现</h3>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold"
          style={{ background: 'var(--novo-accent-warning-light)', color: 'var(--novo-accent-warning)' }}
        >
          {findings.length} 条
        </span>
      </div>
      <div className="space-y-2">
        {findings.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
            style={{ background: 'var(--novo-bg-surface)' }}
          >
            <span
              className="text-[10px] font-bold w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'var(--novo-accent-primary-light)', color: 'var(--novo-accent-primary)' }}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold leading-relaxed" style={{ color: 'var(--novo-text-primary)' }}>
                {f.title}
              </div>
              {f.description && (
                <div className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'var(--novo-text-muted)' }}>
                  {f.description}
                </div>
              )}
              {f.source && (
                <span
                  className="inline-block text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--novo-bg-active)', color: 'var(--novo-text-muted)' }}
                >
                  {f.source}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
