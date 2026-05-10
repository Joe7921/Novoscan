import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Swords,
  Scale,
  FileBarChart,
  RotateCcw,
  Cpu,
  BookOpen,
} from 'lucide-react'
import type { AnalysisState } from '@/hooks/useAnalysis'
import type { FinalReport, ReportEvidenceItem } from '@/types/report'
import ScoreGauge from '@/components/report/ScoreGauge'
import RadarChart from '@/components/report/RadarChart'
import AgentCard from '@/components/report/AgentCard'
import KeyFindings from '@/components/report/KeyFindings'
import RiskTable from '@/components/report/RiskTable'
import EvidencePanel from '@/components/report/EvidencePanel'
import ExportButtons from '@/components/report/ExportButtons'

interface ResultViewProps {
  state: AnalysisState
  onReset: () => void
}

export default function ResultView({ state, onReset }: ResultViewProps) {
  const isAgentic = state.mode === 'agentic'

  // 安全解构 reportJson → FinalReport
  const report = useMemo<FinalReport | null>(() => {
    if (!state.reportJson) return null
    try {
      const r = state.reportJson as unknown as FinalReport
      if (r?.report) return r
    } catch { /* ignore */ }
    return null
  }, [state.reportJson])

  const body = report?.report ?? null

  // 证据数据：优先从 report_json.report.evidenceItems 获取
  const evidenceItems = useMemo<ReportEvidenceItem[]>(() => {
    return body?.evidenceItems ?? []
  }, [body])

  // 按 agentName 分组证据
  const evidenceByAgent = useMemo(() => {
    const map = new Map<string, ReportEvidenceItem[]>()
    for (const ev of evidenceItems) {
      const key = ev.agentName || '未知'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return map
  }, [evidenceItems])

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-4"
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: 'var(--novo-text-primary)' }}>
          分析完成
        </h2>
        <div className="flex items-center gap-2">
          {report && <ExportButtons report={report} />}
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-[var(--novo-bg-hover)]"
            style={{ color: 'var(--novo-text-secondary)' }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            新分析
          </button>
        </div>
      </div>

      {/* ════════════ 可视化报告（Standard + Agentic 统一渲染） ════════════ */}
      {body && (
        <>
          {/* 高管摘要 */}
          {body.executiveSummary && (
            <div className="novo-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4" style={{ color: 'var(--novo-accent-primary)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>高管摘要</h3>
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--novo-text-secondary)' }}>
                {body.executiveSummary}
              </div>
            </div>
          )}

          {/* 总分仪表 + 雷达图 */}
          {body.meta && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="novo-card p-5 flex items-center justify-center">
                <ScoreGauge meta={body.meta} />
              </div>
              {body.arbitration?.radarScores?.length >= 3 && (
                <div className="novo-card p-5 flex items-center justify-center">
                  <RadarChart scores={body.arbitration.radarScores} />
                </div>
              )}
            </div>
          )}

          {/* Agent 评分卡片 */}
          {body.agentScores?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileBarChart className="w-4 h-4" style={{ color: 'var(--novo-accent-primary)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>评分详情</h3>
              </div>
              <div className="space-y-2">
                {body.agentScores.map((agent, i) => (
                  <AgentCard
                    key={i}
                    agent={agent}
                    index={i}
                    evidenceItems={evidenceByAgent.get(agent.name) ?? []}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 关键发现 */}
          {body.keyFindings?.length > 0 && (
            <KeyFindings findings={body.keyFindings} />
          )}

          {/* 风险清单 */}
          <RiskTable risks={body.riskFlags ?? []} />

          {/* 仲裁结论 */}
          {body.arbitration?.summary && (
            <div className="novo-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Scale className="w-4 h-4" style={{ color: 'var(--novo-accent-primary)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>仲裁结论</h3>
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--novo-text-secondary)' }}>
                {body.arbitration.summary}
              </div>
            </div>
          )}

          {/* 证据面板 */}
          {evidenceItems.length > 0 && (
            <div className="novo-card p-5">
              <EvidencePanel items={evidenceItems} />
            </div>
          )}
        </>
      )}

      {/* ════════════ Agentic 模式纯文本回退（无 report 时显示） ════════════ */}
      {isAgentic && !body && state.finalOutput && (
        <div className="novo-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4" style={{ color: 'var(--novo-accent-info)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>Agentic 智能体输出</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--novo-accent-info-light)', color: 'var(--novo-accent-info)' }}>
              {state.toolCalls.length} 次工具调用
            </span>
          </div>
          <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--novo-text-primary)' }}>
            {state.finalOutput}
          </div>
        </div>
      )}

      {/* ════════════ 无报告数据时的回退（兼容旧状态字段） ════════════ */}
      {!isAgentic && !body && state.finalScore != null && (
        <div className="novo-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-4 h-4" style={{ color: 'var(--novo-accent-primary)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>仲裁裁决</h3>
          </div>
          <div className="text-4xl font-bold mb-3" style={{ color: 'var(--novo-accent-primary)' }}>
            {state.finalScore.toFixed(1)}
          </div>
          {state.finalJudgment && (
            <div className="text-sm leading-relaxed" style={{ color: 'var(--novo-text-secondary)' }}>
              {state.finalJudgment}
            </div>
          )}
        </div>
      )}

      {/* 辩论记录 — 法庭式布局 */}
      {state.debateHistory.length > 0 && (() => {
        const structured = state.debateHistory.filter(e => typeof e !== 'string') as Record<string, unknown>[]
        const plain = state.debateHistory.filter(e => typeof e === 'string') as string[]

        const rounds = new Map<number, { pro?: Record<string, unknown>; con?: Record<string, unknown>; judge?: Record<string, unknown> }>()
        for (const e of structured) {
          const r = Number(e.round ?? 0)
          if (!rounds.has(r)) rounds.set(r, {})
          const role = e.role as string | undefined
          if (role === 'pro') rounds.get(r)!.pro = e
          else if (role === 'con') rounds.get(r)!.con = e
          else rounds.get(r)!.judge = e
        }

        return (
          <div className="novo-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Swords className="w-4 h-4" style={{ color: 'var(--novo-accent-danger)' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>辩论记录</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--novo-accent-danger-light)', color: 'var(--novo-accent-danger)' }}>
                {state.debateRound} 轮
              </span>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-hide">
              {Array.from(rounds.entries()).map(([round, sides]) => (
                <div key={round}>
                  <div className="text-[10px] font-bold text-center mb-2" style={{ color: 'var(--novo-text-muted)' }}>
                    — Round {round} —
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* 正方 */}
                    <div
                      className="rounded-xl p-3 border-l-3"
                      style={{ background: 'rgba(66,133,244,0.06)', borderLeftWidth: 3, borderLeftColor: 'var(--novo-accent-primary)' }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--novo-accent-primary-light)', color: 'var(--novo-accent-primary)' }}>
                          正方
                        </span>
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--novo-accent-primary)' }}>
                          {String(sides.pro?.speaker || '—')}
                        </span>
                      </div>
                      <div className="text-[11px] leading-relaxed" style={{ color: 'var(--novo-text-secondary)' }}>
                        {String(sides.pro?.content || '—')}
                      </div>
                    </div>
                    {/* 反方 */}
                    <div
                      className="rounded-xl p-3 border-r-3"
                      style={{ background: 'rgba(234,67,53,0.06)', borderRightWidth: 3, borderRightColor: 'var(--novo-accent-danger)' }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5 justify-end">
                        <span className="text-[10px] font-semibold" style={{ color: 'var(--novo-accent-danger)' }}>
                          {String(sides.con?.speaker || '—')}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--novo-accent-danger-light)', color: 'var(--novo-accent-danger)' }}>
                          反方
                        </span>
                      </div>
                      <div className="text-[11px] leading-relaxed text-right" style={{ color: 'var(--novo-text-secondary)' }}>
                        {String(sides.con?.content || '—')}
                      </div>
                    </div>
                  </div>
                  {/* 裁判裁决 */}
                  {sides.judge && (
                    <div className="mt-2 text-center">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--novo-accent-warning-light)', color: 'var(--novo-accent-warning)' }}
                      >
                        <Scale className="w-2.5 h-2.5" />
                        {String(sides.judge.content || '裁决')}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* 非结构化条目回退 */}
              {plain.map((text, i) => (
                <div key={`plain-${i}`} className="text-xs px-3 py-2 rounded-lg" style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-secondary)' }}>
                  {text}
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </motion.div>
  )
}
