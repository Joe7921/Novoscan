import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Search,
  BarChart3,
  Swords,
  Scale,
  ShieldCheck,
  FileText,
  Check,
  Loader2,
  Wrench,
} from 'lucide-react'
import type {
  NodeProgress,
  ToolCallRecord,
  AgentProgressItem,
  DebateExchangeItem,
} from '@/hooks/useAnalysis'

/* ── 节点元数据 ── */

const NODE_META: Record<string, { label: string; icon: React.FC<{ className?: string; style?: React.CSSProperties }> }> = {
  intent_analyzer:  { label: '意图分析',   icon: Brain },
  retrieval:        { label: '多源检索',   icon: Search },
  scoring:          { label: '三Agent评分', icon: BarChart3 },
  debate:           { label: '辩论交锋',   icon: Swords },
  arbitration:      { label: '仲裁裁决',   icon: Scale },
  quality_gate:     { label: '质量门检',   icon: ShieldCheck },
  report_assembly:  { label: '报告组装',   icon: FileText },
}

/* ── Props ── */

interface ProgressTrackerProps {
  nodes: NodeProgress[]
  mode: 'standard' | 'agentic'
  toolCalls?: ToolCallRecord[]
  agentProgress?: AgentProgressItem[]
  debateExchanges?: DebateExchangeItem[]
  streamingTokens?: string
}

/* ── 耗时格式化 ── */

function formatDuration(start?: number, end?: number): string | null {
  if (!start || !end) return null
  const sec = ((end - start) / 1000).toFixed(1)
  return `${sec}s`
}

/* ── 圆形状态指示器 ── */

function NodeDot({ status }: { status: NodeProgress['status'] }) {
  const size = 28
  const r = 10
  const cx = size / 2
  const cy = size / 2
  if (status === 'done') {
    return (
      <svg width={size} height={size} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="var(--novo-accent-success)" />
        <Check className="w-3 h-3" style={{ color: 'white' }} x={cx - 6} y={cy - 6} />
        <foreignObject x={cx - 6} y={cy - 6} width={12} height={12}>
          <Check className="w-3 h-3" style={{ color: 'white' }} />
        </foreignObject>
      </svg>
    )
  }
  if (status === 'running') {
    return (
      <svg width={size} height={size} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="var(--novo-accent-primary)" opacity={0.15} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--novo-accent-primary)" strokeWidth={2}>
          <animate attributeName="r" values="8;11;8" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r={4} fill="var(--novo-accent-primary)" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--novo-border-default)" strokeWidth={1.5} strokeDasharray="3 3" />
    </svg>
  )
}

/* ── 内联工具调用列表 ── */

function InlineToolChain({ calls }: { calls: NodeProgress['nodeToolCalls'] }) {
  if (!calls || calls.length === 0) return null
  return (
    <div className="ml-1 mt-1.5 space-y-1">
      {calls.map((tc, i) => (
        <div key={i} className="flex items-center gap-1.5 text-[11px]">
          <Wrench className="w-3 h-3 shrink-0" style={{ color: 'var(--novo-accent-info)' }} />
          <span className="font-mono font-medium" style={{ color: 'var(--novo-text-secondary)' }}>
            {tc.tool}
          </span>
          {tc.status === 'running' && (
            <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--novo-accent-primary)' }} />
          )}
          {tc.status === 'done' && tc.resultPreview && (
            <span className="truncate max-w-[200px]" style={{ color: 'var(--novo-text-muted)' }}>
              {tc.resultPreview.slice(0, 80)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Agent SVG 头像 ── */

const AGENT_AVATAR: Record<string, { emoji: string; bg: string }> = {
  'academic_scorer':       { emoji: '🎓', bg: 'var(--novo-accent-primary)' },
  'industry_analyst':      { emoji: '🏭', bg: 'var(--novo-accent-success)' },
  'competitor_detective':   { emoji: '🔍', bg: 'var(--novo-accent-danger)' },
}

function AgentAvatar({ name, size = 22 }: { name: string; size?: number }) {
  const meta = AGENT_AVATAR[name]
  if (meta) {
    return (
      <div
        className="rounded-md flex items-center justify-center shrink-0"
        style={{ width: size, height: size, background: `color-mix(in srgb, ${meta.bg} 15%, transparent)`, fontSize: size * 0.55 }}
      >
        {meta.emoji}
      </div>
    )
  }
  // 默认：取首字母 SVG
  const letter = name.charAt(0).toUpperCase()
  return (
    <svg width={size} height={size} className="shrink-0">
      <rect width={size} height={size} rx={4} fill="var(--novo-accent-info)" opacity={0.15} />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.5} fontWeight={700} fill="var(--novo-accent-info)">
        {letter}
      </text>
    </svg>
  )
}

/* ── 评分 Agent 并发卡片 ── */

function AgentForkPanel({ items }: { items: AgentProgressItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="ml-1 mt-2 flex gap-2 flex-wrap">
      {items.map((ag) => (
        <div
          key={ag.agentName}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] border"
          style={{
            borderColor: ag.isFallback ? 'var(--novo-accent-warning)' : 'var(--novo-accent-success)',
            background: ag.isFallback ? 'var(--novo-accent-warning-light)' : 'var(--novo-accent-success-light)',
          }}
        >
          <AgentAvatar name={ag.agentName} />
          <div>
            <div className="font-semibold" style={{ color: 'var(--novo-text-primary)' }}>
              {ag.agentName}
            </div>
            <div className="font-mono font-bold" style={{
              color: ag.isFallback ? 'var(--novo-accent-warning)' : 'var(--novo-accent-success)',
            }}>
              {ag.score}
              <span className="ml-1 font-normal text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>
                {ag.confidence}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── 辩论实况面板 ── */

function DebateLivePanel({ exchanges }: { exchanges: DebateExchangeItem[] }) {
  if (exchanges.length === 0) return null
  return (
    <div className="ml-1 mt-2 space-y-2">
      {exchanges.map((ex, i) => {
        const outcomeLabel =
          ex.outcome === 'challenger_wins' ? `${ex.proAgent} 胜` :
          ex.outcome === 'defender_wins' ? `${ex.conAgent} 胜` : '平局'
        const outcomeColor =
          ex.outcome === 'draw' ? 'var(--novo-text-muted)' : 'var(--novo-accent-primary)'
        return (
          <div key={i} className="rounded-lg p-2 text-[11px]" style={{ background: 'var(--novo-bg-surface)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold" style={{ color: 'var(--novo-text-secondary)' }}>
                Round {ex.round}
              </span>
              <span className="font-bold" style={{ color: outcomeColor }}>
                {outcomeLabel}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded px-2 py-1" style={{ background: 'rgba(66,133,244,0.08)' }}>
                <div className="font-semibold mb-0.5" style={{ color: 'var(--novo-accent-primary)' }}>
                  {ex.proAgent}
                </div>
                <div className="line-clamp-2" style={{ color: 'var(--novo-text-muted)' }}>
                  {ex.proPreview}
                </div>
              </div>
              <div className="rounded px-2 py-1" style={{ background: 'rgba(234,67,53,0.08)' }}>
                <div className="font-semibold mb-0.5" style={{ color: 'var(--novo-accent-danger)' }}>
                  {ex.conAgent}
                </div>
                <div className="line-clamp-2" style={{ color: 'var(--novo-text-muted)' }}>
                  {ex.conPreview}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── 流式 Token 展示 ── */

function StreamingText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [text])
  if (!text) return null
  const display = text.length > 200 ? '...' + text.slice(-200) : text
  return (
    <div
      ref={ref}
      className="ml-1 mt-1.5 px-2 py-1.5 rounded text-[11px] font-mono max-h-16 overflow-y-auto whitespace-pre-wrap"
      style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)' }}
    >
      {display}
      <span className="inline-block w-1.5 h-3 ml-0.5 animate-pulse" style={{ background: 'var(--novo-accent-primary)' }} />
    </div>
  )
}

/* ══════════════════════════════════════════════════
   主组件
   ══════════════════════════════════════════════════ */

export default function ProgressTracker({
  nodes,
  mode,
  toolCalls = [],
  agentProgress = [],
  debateExchanges = [],
  streamingTokens = '',
}: ProgressTrackerProps) {

  /* ── Agentic 模式 ── */
  if (mode === 'agentic') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <div className="novo-card p-5">
          <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--novo-text-primary)' }}>
            Agentic · 智能体工作流
          </h3>

          {/* 流式 Token */}
          {streamingTokens && <StreamingText text={streamingTokens} />}

          <div className="space-y-2 mt-3">
            {toolCalls.length === 0 && !streamingTokens && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--novo-text-muted)' }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Agent 正在思考...
              </div>
            )}
            {toolCalls.map((tc, i) => (
              <div
                key={i}
                className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ background: 'var(--novo-bg-surface)' }}
              >
                <span className="font-mono font-bold shrink-0" style={{ color: 'var(--novo-accent-info)' }}>
                  [{i + 1}]
                </span>
                <div className="min-w-0">
                  <span className="font-semibold" style={{ color: 'var(--novo-text-primary)' }}>
                    {tc.tool}
                  </span>
                  {tc.resultPreview && (
                    <p className="mt-0.5 truncate" style={{ color: 'var(--novo-text-muted)' }}>
                      {tc.resultPreview.slice(0, 100)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    )
  }

  /* ── Standard 模式 Timeline ── */
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="novo-card p-5">
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--novo-text-primary)' }}>
          Standard · 传统工作流
        </h3>
        <div className="relative">
          {nodes.map((node, i) => {
            const meta = NODE_META[node.name]
            if (!meta) return null
            const Icon = meta.icon
            const isRunning = node.status === 'running'
            const isDone = node.status === 'done'
            const isPending = node.status === 'pending'
            const duration = formatDuration(node.startedAt, node.completedAt)
            const isLast = i === nodes.length - 1

            return (
              <div key={node.name} className="relative flex">
                {/* 左侧 Timeline 竖线 + 圆点 */}
                <div className="flex flex-col items-center mr-3">
                  <NodeDot status={node.status} />
                  {!isLast && (
                    <div
                      className="w-px flex-1 min-h-[16px]"
                      style={{
                        background: isDone ? 'var(--novo-accent-success)' : 'var(--novo-border-default)',
                        opacity: isDone ? 0.4 : 1,
                      }}
                    />
                  )}
                </div>

                {/* 右侧内容 */}
                <div className="flex-1 pb-4 min-w-0">
                  {/* 节点标题行 */}
                  <div className="flex items-center gap-2 h-7">
                    <Icon
                      className="w-4 h-4 shrink-0"
                      style={{
                        color: isRunning ? 'var(--novo-accent-primary)' : isDone ? 'var(--novo-accent-success)' : 'var(--novo-text-disabled)',
                      }}
                    />
                    <span
                      className="text-xs font-semibold"
                      style={{
                        color: isRunning ? 'var(--novo-accent-primary)' : isDone ? 'var(--novo-text-primary)' : 'var(--novo-text-muted)',
                      }}
                    >
                      {meta.label}
                    </span>
                    {/* 耗时 / 状态标签 */}
                    {isDone && duration && (
                      <span className="text-[10px] font-mono" style={{ color: 'var(--novo-accent-success)' }}>
                        {duration}
                      </span>
                    )}
                    {isRunning && (
                      <span className="text-[10px] font-mono flex items-center gap-1" style={{ color: 'var(--novo-accent-primary)' }}>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        running
                      </span>
                    )}
                    {isPending && (
                      <span className="text-[10px]" style={{ color: 'var(--novo-text-disabled)' }}>
                        pending
                      </span>
                    )}
                    {/* 摘要数据 */}
                    {isDone && node.summary && (() => {
                      const s = node.summary!
                      let text = ''
                      if (node.name === 'intent_analyzer' && s.core_idea) text = String(s.core_idea).slice(0, 30)
                      else if (node.name === 'scoring' && s.agent_count != null) text = `${String(s.agent_count)} agents · gap ${String(s.score_gap)}`
                      else if (node.name === 'arbitration' && s.final_score != null) text = `${String(s.final_score)}分`
                      return text ? (
                        <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--novo-text-muted)' }}>
                          {text}
                        </span>
                      ) : null
                    })()}
                  </div>

                  {/* 内联展开区域 */}
                  <AnimatePresence>
                    {/* 检索节点：工具调用链 */}
                    {node.name === 'retrieval' && (isDone || isRunning) && (
                      <motion.div
                        key="retrieval-tools"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <InlineToolChain calls={node.nodeToolCalls} />
                      </motion.div>
                    )}

                    {/* 评分节点：并发 Agent 卡片 */}
                    {node.name === 'scoring' && (isDone || isRunning) && agentProgress.length > 0 && (
                      <motion.div
                        key="scoring-agents"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <AgentForkPanel items={agentProgress} />
                      </motion.div>
                    )}

                    {/* 辩论节点：实况面板 */}
                    {node.name === 'debate' && (isDone || isRunning) && debateExchanges.length > 0 && (
                      <motion.div
                        key="debate-live"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <DebateLivePanel exchanges={debateExchanges} />
                      </motion.div>
                    )}

                    {/* 当前活跃节点的流式 Token */}
                    {isRunning && streamingTokens && (
                      <motion.div
                        key="streaming-tokens"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <StreamingText text={streamingTokens} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
