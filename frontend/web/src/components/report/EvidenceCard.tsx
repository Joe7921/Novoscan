import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ExternalLink,
  BookOpen,
  Code2,
  Newspaper,
  FileText,
  Award,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  CircleHelp,
  Link2,
} from 'lucide-react'
import type { ReportEvidenceItem } from '@/types/report'

const SOURCE_TYPE_META: Record<string, { icon: React.FC<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
  '学术论文': { icon: BookOpen, color: 'var(--novo-accent-primary)' },
  '开源项目': { icon: Code2, color: 'var(--novo-accent-success)' },
  '行业报告': { icon: FileText, color: 'var(--novo-accent-info)' },
  '新闻':     { icon: Newspaper, color: 'var(--novo-accent-warning)' },
  '专利':     { icon: Award, color: 'var(--novo-accent-danger)' },
}

const STANCE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  '支持': { bg: 'var(--novo-accent-success-light)', text: 'var(--novo-accent-success)', label: '支持' },
  '反对': { bg: 'var(--novo-accent-danger-light)', text: 'var(--novo-accent-danger)', label: '反对' },
  '中性': { bg: 'var(--novo-bg-active)', text: 'var(--novo-text-muted)', label: '中性' },
}

function relevanceColor(score: number): string {
  if (score >= 0.8) return 'var(--novo-accent-success)'
  if (score >= 0.5) return 'var(--novo-accent-warning)'
  return 'var(--novo-accent-danger)'
}

type UserMarkValue = 'useful' | 'useless' | 'uncertain' | null

interface EvidenceCardProps {
  item: ReportEvidenceItem
  selected?: boolean
  onToggleSelect?: (id: string) => void
  userMark?: UserMarkValue
  onUserMark?: (id: string, mark: UserMarkValue) => void
  allItems?: ReportEvidenceItem[]
}

const MARK_META: Record<string, { icon: React.FC<{ className?: string; style?: React.CSSProperties }>; color: string; label: string }> = {
  useful:    { icon: ThumbsUp,   color: 'var(--novo-accent-success)', label: '有用' },
  useless:   { icon: ThumbsDown,  color: 'var(--novo-accent-danger)',  label: '无用' },
  uncertain: { icon: CircleHelp,  color: 'var(--novo-accent-warning)', label: '存疑' },
}

export default function EvidenceCard({ item, selected, onToggleSelect, userMark, onUserMark, allItems }: EvidenceCardProps) {
  const [expanded, setExpanded] = useState(false)

  const typeMeta = SOURCE_TYPE_META[item.sourceType] || { icon: HelpCircle, color: 'var(--novo-text-muted)' }
  const TypeIcon = typeMeta.icon
  const stanceStyle = STANCE_STYLE[item.stance] || STANCE_STYLE['中性']

  return (
    <div
      className="rounded-xl border transition-all"
      style={{
        borderColor: selected ? 'var(--novo-accent-primary)' : 'var(--novo-border-default)',
        background: selected ? 'var(--novo-accent-primary-light)' : 'var(--novo-bg-elevated)',
      }}
    >
      {/* 头部（始终可见） */}
      <div
        className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* 选择框 */}
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={(e) => { e.stopPropagation(); onToggleSelect(item.id) }}
            className="mt-0.5 shrink-0 accent-[var(--novo-accent-primary)]"
          />
        )}

        {/* 类型图标 */}
        <TypeIcon className="w-4 h-4 mt-0.5 shrink-0" style={{ color: typeMeta.color }} />

        {/* 标题 + 元信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold truncate" style={{ color: 'var(--novo-text-primary)' }}>
              {item.title}
            </span>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
              >
                <ExternalLink className="w-3 h-3" style={{ color: 'var(--novo-accent-primary)' }} />
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>
              {item.source}{item.year ? ` · ${item.year}` : ''}
            </span>
            <span
              className="text-[10px] font-bold px-1.5 py-0 rounded-full"
              style={{ background: stanceStyle.bg, color: stanceStyle.text }}
            >
              {stanceStyle.label}
            </span>
            <span className="text-[10px] px-1.5 py-0 rounded-full" style={{ background: 'var(--novo-bg-active)', color: 'var(--novo-text-muted)' }}>
              {item.dimension}
            </span>
          </div>
        </div>

        {/* 相关性分数 */}
        <div className="flex flex-col items-end shrink-0">
          <span
            className="text-sm font-bold font-mono"
            style={{ color: relevanceColor(item.relevanceScore) }}
          >
            {(item.relevanceScore * 100).toFixed(0)}
          </span>
          <span className="text-[9px]" style={{ color: 'var(--novo-text-disabled)' }}>相关性</span>
        </div>

        {/* 展开箭头 */}
        <ChevronDown
          className="w-3.5 h-3.5 mt-0.5 shrink-0 transition-transform"
          style={{
            color: 'var(--novo-text-muted)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          }}
        />
      </div>

      {/* 展开详情 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: 'var(--novo-border-default)' }}>
              {/* 相关性推理 */}
              {item.relevanceReasoning && (
                <div className="mt-2">
                  <div className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--novo-text-secondary)' }}>
                    为什么相关
                  </div>
                  <div className="text-[11px] leading-relaxed" style={{ color: 'var(--novo-text-muted)' }}>
                    {item.relevanceReasoning}
                  </div>
                </div>
              )}

              {/* 核心摘录 */}
              {item.keyExcerpt && (
                <div>
                  <div className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--novo-text-secondary)' }}>
                    核心论点
                  </div>
                  <div
                    className="text-[11px] leading-relaxed italic px-2 py-1 rounded border-l-2"
                    style={{
                      color: 'var(--novo-text-muted)',
                      borderLeftColor: 'var(--novo-accent-primary)',
                      background: 'var(--novo-bg-surface)',
                    }}
                  >
                    "{item.keyExcerpt}"
                  </div>
                </div>
              )}

              {/* 引用信息 */}
              {item.citationInfo && (
                <div>
                  <div className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--novo-text-secondary)' }}>
                    引用信息
                  </div>
                  <div className="text-[10px] font-mono" style={{ color: 'var(--novo-text-muted)' }}>
                    {[
                      item.citationInfo.author,
                      item.citationInfo.year,
                      item.citationInfo.journal,
                      item.citationInfo.doi,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
              )}

              {/* 关联证据 */}
              {item.relatedEvidenceIds && item.relatedEvidenceIds.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 mb-0.5">
                    <Link2 className="w-3 h-3" style={{ color: 'var(--novo-text-muted)' }} />
                    <div className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-secondary)' }}>
                      关联证据
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.relatedEvidenceIds.map(rid => {
                      const related = allItems?.find(e => e.id === rid)
                      return (
                        <span
                          key={rid}
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: 'var(--novo-accent-primary-light)', color: 'var(--novo-accent-primary)' }}
                        >
                          {related ? related.title.slice(0, 20) + (related.title.length > 20 ? '...' : '') : rid}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* HITL 标记 + 来源 Agent */}
              <div className="flex items-center justify-between">
                <div className="text-[10px]" style={{ color: 'var(--novo-text-disabled)' }}>
                  来源：{item.agentName || '未知'}
                </div>
                {onUserMark && (
                  <div className="flex items-center gap-1">
                    {(['useful', 'useless', 'uncertain'] as const).map(mk => {
                      const meta = MARK_META[mk]
                      const Icon = meta.icon
                      const isActive = userMark === mk
                      return (
                        <button
                          key={mk}
                          onClick={(e) => { e.stopPropagation(); onUserMark(item.id, isActive ? null : mk) }}
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold transition-all"
                          style={{
                            background: isActive ? `color-mix(in srgb, ${meta.color} 15%, transparent)` : 'transparent',
                            color: isActive ? meta.color : 'var(--novo-text-disabled)',
                            border: `1px solid ${isActive ? meta.color : 'var(--novo-border-default)'}`,
                          }}
                        >
                          <Icon className="w-2.5 h-2.5" />
                          {meta.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
