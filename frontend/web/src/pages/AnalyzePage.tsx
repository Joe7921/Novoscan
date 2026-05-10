import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAnalysis } from '@/hooks/useAnalysis'
import InputPanel from '@/components/analysis/InputPanel'
import IntentConfirm from '@/components/analysis/IntentConfirm'
import ProgressTracker from '@/components/analysis/ProgressTracker'
import ResultView from '@/components/analysis/ResultView'
import { AlertCircle, LayoutDashboard } from 'lucide-react'
import { saveRecord } from '@/lib/historyStore'
import type { FinalReport } from '@/types/report'

export default function AnalyzePage() {
  const { state, startAnalysis, resume, reset } = useAnalysis()
  const savedRef = useRef(false)
  const inputRef = useRef({ input: '', detectionType: 'auto' })

  // 分析完成时自动保存历史记录
  useEffect(() => {
    if (state.phase === 'completed' && !savedRef.current) {
      savedRef.current = true
      const report = state.reportJson as unknown as FinalReport | null
      saveRecord({
        userInput: inputRef.current.input,
        detectionType: inputRef.current.detectionType,
        mode: state.mode,
        score: state.finalScore ?? report?.report?.meta?.overallScore ?? null,
        noveltyLevel: report?.report?.meta?.noveltyLevel ?? null,
        report: report,
        agenticOutput: state.finalOutput,
      })
    }
    if (state.phase === 'idle') {
      savedRef.current = false
    }
  }, [state.phase, state.reportJson, state.finalScore, state.finalOutput, state.mode])

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full">
        {/* 空闲 → 输入面板 */}
        {state.phase === 'idle' && (
          <InputPanel
            onSubmit={(input, type, mode, opts) => {
              inputRef.current = { input, detectionType: type }
              startAnalysis(input, type, mode, { pipeline: opts?.pipeline })
            }}
          />
        )}

        {/* 分析中 → 进度追踪 */}
        {(state.phase === 'analyzing_intent' || state.phase === 'running') && (
          <>
            <ProgressTracker
              nodes={state.nodes}
              mode={state.mode}
              toolCalls={state.toolCalls}
              agentProgress={state.agentProgress}
              debateExchanges={state.debateExchanges}
              streamingTokens={state.streamingTokens}
            />
            <div className="flex justify-center mt-4">
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: 'transparent',
                  color: 'var(--novo-text-muted)',
                  border: '1px solid var(--novo-border-default)',
                }}
              >
                取消分析
              </button>
            </div>
          </>
        )}

        {/* HITL 等待确认 */}
        {state.phase === 'awaiting_confirmation' && state.analyzedIntent && (
          <IntentConfirm
            intent={state.analyzedIntent}
            onConfirm={() => resume('confirm')}
            onRevise={(fb) => resume('revise', fb)}
          />
        )}

        {/* 完成 → 结果展示 */}
        {state.phase === 'completed' && (
          <>
            <ResultView state={state} onReset={reset} />
            <div className="flex justify-center mt-6 mb-8">
              <Link
                to="/studio"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all hover:shadow-md"
                style={{ background: 'var(--novo-accent-primary)', color: 'white' }}
              >
                <LayoutDashboard className="w-4 h-4" />
                在 Studio 中打开
              </Link>
            </div>
          </>
        )}

        {/* 错误 */}
        {state.phase === 'error' && (
          <div className="max-w-2xl mx-auto">
            <div className="novo-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5" style={{ color: 'var(--novo-accent-danger)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--novo-accent-danger)' }}>分析出错</h3>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--novo-text-secondary)' }}>
                {state.error}
              </p>
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ background: 'var(--novo-accent-primary)', color: 'white' }}
              >
                重新开始
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
