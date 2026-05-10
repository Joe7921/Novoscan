import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, AlertTriangle, ExternalLink, FileSearch } from 'lucide-react'
import type { AgentScoreDetail, ReportEvidenceItem } from '@/types/report'

interface AgentCardProps {
  agent: AgentScoreDetail
  index: number
  evidenceItems?: ReportEvidenceItem[]
}

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--novo-accent-success)'
  if (score >= 40) return 'var(--novo-accent-warning)'
  return 'var(--novo-accent-danger)'
}

function confidenceStyle(c: string): { bg: string; text: string; label: string } {
  switch (c) {
    case 'high':
      return { bg: 'var(--novo-accent-success-light)', text: 'var(--novo-accent-success)', label: '高置信' }
    case 'medium':
      return { bg: 'var(--novo-accent-warning-light)', text: 'var(--novo-accent-warning)', label: '中置信' }
    default:
      return { bg: 'var(--novo-accent-danger-light)', text: 'var(--novo-accent-danger)', label: '低置信' }
  }
}

export default function AgentCard({ agent, index, evidenceItems = [] }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false)
  const color = scoreColor(agent.score)
  const conf = confidenceStyle(agent.confidence)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="novo-card overflow-hidden"
    >
      {/* 头部 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--novo-bg-hover)]"
      >
        {/* 分数 */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
        >
          {agent.score}
        </div>

        {/* 名称 + 标签 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate" style={{ color: 'var(--novo-text-primary)' }}>
              {agent.name}
            </span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: conf.bg, color: conf.text }}
            >
              {conf.label}
            </span>
            {agent.isFallback && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background: 'var(--novo-accent-warning-light)', color: 'var(--novo-accent-warning)' }}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                降级
              </span>
            )}
          </div>
          {/* 进度条 */}
          <div className="w-full h-1.5 rounded-full mt-2" style={{ background: 'var(--novo-bg-active)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(agent.score, 100)}%` }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
            />
          </div>
        </div>

        {/* 展开箭头 */}
        <ChevronDown
          className="w-4 h-4 shrink-0 transition-transform"
          style={{
            color: 'var(--novo-text-muted)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* 展开详情 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--novo-border-default)' }}>
              {/* 分析摘要 */}
              {agent.analysis && (
                <div className="pt-3">
                  <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--novo-text-muted)' }}>分析摘要</div>
                  <div className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--novo-text-secondary)' }}>
                    {agent.analysis}
                  </div>
                </div>
              )}

              {/* 维度评分 */}
              {agent.dimensionScores.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold mb-2" style={{ color: 'var(--novo-text-muted)' }}>维度评分</div>
                  <div className="space-y-2">
                    {agent.dimensionScores.map((dim, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-medium" style={{ color: 'var(--novo-text-secondary)' }}>
                            {dim.name}
                          </span>
                          <span className="text-[10px] font-bold" style={{ color: scoreColor(dim.score) }}>
                            {dim.score}
                          </span>
                        </div>
                        <div className="w-full h-1 rounded-full" style={{ background: 'var(--novo-bg-active)' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(dim.score, 100)}%`, background: scoreColor(dim.score) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top-3 证据 */}
              {evidenceItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <FileSearch className="w-3 h-3" style={{ color: 'var(--novo-text-muted)' }} />
                    <div className="text-[10px] font-bold" style={{ color: 'var(--novo-text-muted)' }}>
                      核心证据 ({evidenceItems.length})
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {evidenceItems.slice(0, 3).map(ev => (
                      <div
                        key={ev.id}
                        className="flex items-start gap-2 px-2 py-1.5 rounded-lg text-[10px]"
                        style={{ background: 'var(--novo-bg-surface)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-semibold truncate" style={{ color: 'var(--novo-text-primary)' }}>
                              {ev.title}
                            </span>
                            {ev.url && (
                              <a href={ev.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                <ExternalLink className="w-2.5 h-2.5" style={{ color: 'var(--novo-accent-primary)' }} />
                              </a>
                            )}
                          </div>
                          <span style={{ color: 'var(--novo-text-muted)' }}>
                            {ev.source}{ev.year ? ` · ${ev.year}` : ''} · {ev.stance}
                          </span>
                        </div>
                        <span
                          className="font-bold font-mono shrink-0"
                          style={{ color: scoreColor(ev.relevanceScore * 100) }}
                        >
                          {(ev.relevanceScore * 100).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
