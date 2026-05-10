import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Trash2,
  ChevronLeft,
  Clock,
  FlaskConical,
  Cpu,
} from 'lucide-react'
import { loadRecords, deleteRecord, clearAll, type HistoryRecord } from '@/lib/historyStore'
import type { AnalysisState } from '@/hooks/useAnalysis'
import ResultView from '@/components/analysis/ResultView'

function scoreColor(score: number | null): string {
  if (score == null) return 'var(--novo-text-muted)'
  if (score >= 75) return 'var(--novo-accent-success)'
  if (score >= 50) return 'var(--novo-accent-warning)'
  return 'var(--novo-accent-danger)'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} 小时前`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} 天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** 将 HistoryRecord 转为 ResultView 所需的 AnalysisState 最小子集 */
function recordToState(rec: HistoryRecord): AnalysisState {
  const report = rec.report
  const body = report?.report
  return {
    phase: 'completed',
    mode: rec.mode,
    threadId: null,
    error: null,
    analyzedIntent: null,
    nodes: [],
    evaluationResults: [],
    finalScore: rec.score,
    finalJudgment: body?.arbitration?.summary ?? null,
    reportJson: report as unknown as Record<string, unknown> | null,
    debateHistory: [],
    debateRound: 0,
    toolCalls: [],
    finalOutput: rec.agenticOutput,
    runtimeState: null,
    pauseTarget: null,
    pausePhase: null,
    waitingFor: null,
    pendingFinalScore: null,
    pendingToolCallsCount: null,
    agentProgress: [],
    debateExchanges: [],
    streamingTokens: '',
    executionPath: [],
    stageDurations: {},
  }
}

export default function ReportsPage() {
  const [records, setRecords] = useState<HistoryRecord[]>(loadRecords)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const refresh = useCallback(() => setRecords(loadRecords()), [])

  const handleDelete = useCallback((id: string) => {
    deleteRecord(id)
    refresh()
  }, [refresh])

  const handleClearAll = useCallback(() => {
    clearAll()
    refresh()
    setConfirmClear(false)
  }, [refresh])

  const viewingRecord = useMemo(
    () => records.find(r => r.id === viewingId) ?? null,
    [records, viewingId],
  )

  // 查看详情
  if (viewingRecord) {
    const fakeState = recordToState(viewingRecord)
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <button
          onClick={() => setViewingId(null)}
          className="flex items-center gap-1.5 mb-4 text-xs font-medium transition-all hover:bg-[var(--novo-bg-hover)] px-3 py-1.5 rounded-lg"
          style={{ color: 'var(--novo-text-secondary)' }}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          返回历史列表
        </button>
        <div className="mb-3">
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)' }}>
            {formatDate(viewingRecord.createdAt)}
          </span>
          {viewingRecord.userInput && (
            <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--novo-text-secondary)' }}>
              「{viewingRecord.userInput.slice(0, 200)}{viewingRecord.userInput.length > 200 ? '...' : ''}」
            </p>
          )}
        </div>
        <ResultView state={fakeState} onReset={() => setViewingId(null)} />
      </div>
    )
  }

  // 历史列表
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold" style={{ color: 'var(--novo-text-primary)' }}>
            历史记录
          </h1>
          {records.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--novo-accent-primary-light)', color: 'var(--novo-accent-primary)' }}>
              {records.length}
            </span>
          )}
        </div>
        {records.length > 0 && (
          <div className="relative">
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:bg-[var(--novo-bg-hover)]"
                style={{ color: 'var(--novo-text-muted)' }}
              >
                <Trash2 className="w-3 h-3" />
                清空全部
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                  style={{ background: 'var(--novo-accent-danger)', color: 'white' }}
                >
                  确认清空
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                  style={{ color: 'var(--novo-text-muted)', border: '1px solid var(--novo-border-default)' }}
                >
                  取消
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 空状态 */}
      {records.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--novo-accent-primary-light)' }}
          >
            <FileText className="w-7 h-7" style={{ color: 'var(--novo-accent-primary)' }} />
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--novo-text-primary)' }}>
            暂无记录
          </h2>
          <p className="text-sm" style={{ color: 'var(--novo-text-muted)' }}>
            完成分析后结果将自动保存到此处。
          </p>
        </motion.div>
      )}

      {/* 记录列表 */}
      <AnimatePresence>
        <div className="space-y-2">
          {records.map((rec, i) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: i * 0.03 }}
              className="novo-card p-4 cursor-pointer transition-all hover:shadow-md group"
              onClick={() => setViewingId(rec.id)}
            >
              <div className="flex items-start gap-3">
                {/* 分数 */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
                  style={{
                    background: `color-mix(in srgb, ${scoreColor(rec.score)} 10%, transparent)`,
                    color: scoreColor(rec.score),
                  }}
                >
                  {rec.score != null ? rec.score.toFixed(0) : '—'}
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold truncate" style={{ color: 'var(--novo-text-primary)' }}>
                      {rec.userInput
                        ? rec.userInput.slice(0, 60) + (rec.userInput.length > 60 ? '...' : '')
                        : '未记录输入'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDate(rec.createdAt)}
                    </span>
                    <span className="flex items-center gap-0.5">
                      {rec.mode === 'standard'
                        ? <FlaskConical className="w-2.5 h-2.5" />
                        : <Cpu className="w-2.5 h-2.5" />
                      }
                      {rec.mode === 'standard' ? 'Standard' : 'Agentic'}
                    </span>
                    {rec.noveltyLevel && (
                      <span className="px-1.5 py-0.5 rounded-full" style={{ background: 'var(--novo-bg-surface)' }}>
                        {rec.noveltyLevel}
                      </span>
                    )}
                  </div>
                </div>

                {/* 删除 */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(rec.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-[var(--novo-accent-danger-light)]"
                  style={{ color: 'var(--novo-accent-danger)' }}
                  title="删除此记录"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  )
}
