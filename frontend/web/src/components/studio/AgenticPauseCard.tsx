import { useEffect, useState } from 'react'
import { Check, Cpu, MessageSquarePlus, Square } from 'lucide-react'
import type { AgenticResumeRequest, ResumeRequest } from '@/lib/api'
import type { AnalysisState } from '@/hooks/useAnalysis'

const DEFAULT_RESUME_ACTIONS: Array<{ id: AgenticResumeRequest['action']; label: string; description?: string }> = [
  { id: 'approve_and_continue', label: '继续执行', description: '确认当前暂停点并继续执行。' },
  { id: 'revise_inputs', label: '修正输入', description: '修改输入或补充说明后重新启动本次运行。' },
  { id: 'abort', label: '终止运行', description: '结束本次运行并保留当前快照。' },
]

function isKnownResumeAction(actionId: string): actionId is AgenticResumeRequest['action'] {
  return actionId === 'approve_and_continue' || actionId === 'revise_inputs' || actionId === 'abort'
}

export interface AgenticPauseCardProps {
  state: AnalysisState
  currentInput: string
  onSyncInput: (value: string) => void
  onResume: (
    action: ResumeRequest['action'] | AgenticResumeRequest['action'],
    feedback?: string,
    revisedUserInput?: string,
    enabledTools?: string[] | null,
  ) => void
}

export default function AgenticPauseCard({ state, currentInput, onSyncInput, onResume }: AgenticPauseCardProps) {
  const [revising, setRevising] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [revisedInput, setRevisedInput] = useState(currentInput)
  const resumeActions = state.runtimeState?.resume_actions?.length
    ? state.runtimeState.resume_actions
    : DEFAULT_RESUME_ACTIONS
  const canRevise = resumeActions.some(action => action.id === 'revise_inputs')
  const unsupportedActions = resumeActions.filter(action => !isKnownResumeAction(action.id))

  useEffect(() => {
    setRevisedInput(currentInput)
  }, [currentInput])

  useEffect(() => {
    if (!canRevise) {
      setRevising(false)
    }
  }, [canRevise])

  const pauseTarget = state.pauseTarget ?? state.runtimeState?.pause_target ?? '-'
  const pausePhase = state.pausePhase ?? state.runtimeState?.pause_phase ?? '-'
  const waitingFor = state.waitingFor ?? state.runtimeState?.waiting_for ?? 'resume'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="novo-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4" style={{ color: 'var(--novo-accent-info)' }} />
          <h3 className="text-xs font-bold" style={{ color: 'var(--novo-text-primary)' }}>Agentic 已暂停，等待恢复动作</h3>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-xl px-3 py-2" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
            <div style={{ color: 'var(--novo-text-muted)' }}>pause_target</div>
            <div className="mt-1 font-semibold" style={{ color: 'var(--novo-text-primary)' }}>{pauseTarget}</div>
          </div>
          <div className="rounded-xl px-3 py-2" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
            <div style={{ color: 'var(--novo-text-muted)' }}>pause_phase</div>
            <div className="mt-1 font-semibold" style={{ color: 'var(--novo-text-primary)' }}>{pausePhase}</div>
          </div>
          <div className="rounded-xl px-3 py-2" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
            <div style={{ color: 'var(--novo-text-muted)' }}>waiting_for</div>
            <div className="mt-1 font-semibold" style={{ color: 'var(--novo-text-primary)' }}>{waitingFor}</div>
          </div>
          <div className="rounded-xl px-3 py-2" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
            <div style={{ color: 'var(--novo-text-muted)' }}>runtime_status</div>
            <div className="mt-1 font-semibold" style={{ color: 'var(--novo-text-primary)' }}>{state.runtimeState?.status ?? 'paused'}</div>
          </div>
          <div className="rounded-xl px-3 py-2" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
            <div style={{ color: 'var(--novo-text-muted)' }}>pending_final_score</div>
            <div className="mt-1 font-semibold" style={{ color: 'var(--novo-text-primary)' }}>{state.pendingFinalScore ?? '-'}</div>
          </div>
          <div className="rounded-xl px-3 py-2" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
            <div style={{ color: 'var(--novo-text-muted)' }}>tool_calls_count</div>
            <div className="mt-1 font-semibold" style={{ color: 'var(--novo-text-primary)' }}>{state.pendingToolCallsCount ?? state.toolCalls.length}</div>
          </div>
        </div>

        {revising && (
          <div className="space-y-2">
            <textarea
              value={revisedInput}
              onChange={e => setRevisedInput(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-[11px] rounded-xl novo-input resize-none"
              placeholder="修正后的输入将用于重新恢复 Agentic 执行"
            />
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-[11px] rounded-xl novo-input resize-none"
              placeholder="可选：补充说明给 Agentic 运行时"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {resumeActions.map(action => {
            if (!isKnownResumeAction(action.id)) {
              return (
                <button
                  key={action.id}
                  disabled
                  title={action.description || `当前前端暂不支持动作 ${action.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)', border: '1px solid var(--novo-border-default)' }}
                >
                  {action.label}
                </button>
              )
            }

            if (action.id === 'approve_and_continue') {
              return (
                <button
                  key={action.id}
                  title={action.description || undefined}
                  onClick={() => onResume('approve_and_continue', feedback)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold"
                  style={{ background: 'var(--novo-accent-success)', color: 'white' }}
                >
                  <Check className="w-3.5 h-3.5" />
                  {action.label}
                </button>
              )
            }

            if (action.id === 'revise_inputs') {
              return !revising ? (
                <button
                  key={action.id}
                  title={action.description || undefined}
                  onClick={() => setRevising(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold"
                  style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-secondary)', border: '1px solid var(--novo-border-default)' }}
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  {action.label}
                </button>
              ) : (
                <button
                  key={action.id}
                  title={action.description || undefined}
                  onClick={() => {
                    const nextInput = revisedInput.trim() || currentInput
                    onSyncInput(nextInput)
                    onResume('revise_inputs', feedback, nextInput)
                  }}
                  disabled={!revisedInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold disabled:opacity-50"
                  style={{ background: 'var(--novo-accent-warning)', color: 'white' }}
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  {action.label}
                </button>
              )
            }

            return (
              <button
                key={action.id}
                title={action.description || undefined}
                onClick={() => onResume('abort', feedback)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold"
                style={{ background: 'var(--novo-accent-danger)', color: 'white' }}
              >
                <Square className="w-3.5 h-3.5" />
                {action.label}
              </button>
            )
          })}
        </div>

        {unsupportedActions.length > 0 && (
          <div className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>
            暂未支持的 runtime 动作：{unsupportedActions.map(action => action.id).join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
