import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, PenLine, AlertCircle } from 'lucide-react'

interface IntentConfirmProps {
  intent: Record<string, unknown>
  onConfirm: () => void
  onRevise: (feedback: string) => void
}

export default function IntentConfirm({ intent, onConfirm, onRevise }: IntentConfirmProps) {
  const [revising, setRevising] = useState(false)
  const [feedback, setFeedback] = useState('')

  function handleRevise() {
    if (feedback.trim()) {
      onRevise(feedback.trim())
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto"
    >
      <div className="novo-card p-6">
        {/* 头部 */}
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5" style={{ color: 'var(--novo-accent-warning)' }} />
          <h2 className="text-base font-bold" style={{ color: 'var(--novo-text-primary)' }}>
            请确认意图分析结果
          </h2>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--novo-text-secondary)' }}>
          AI 已解析你的创新想法。确认无误后将进入检索和评分阶段。
        </p>

        {/* 意图信息 */}
        <div
          className="rounded-xl p-4 mb-5 space-y-2"
          style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}
        >
          {intent.core_idea != null && (
            <div>
              <span className="text-[10px] font-bold" style={{ color: 'var(--novo-text-muted)' }}>核心创意</span>
              <p className="text-sm font-medium" style={{ color: 'var(--novo-text-primary)' }}>
                {String(intent.core_idea)}
              </p>
            </div>
          )}
          {Array.isArray(intent.keywords) && (
            <div>
              <span className="text-[10px] font-bold" style={{ color: 'var(--novo-text-muted)' }}>关键词</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {(intent.keywords as string[]).map((kw: string, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'var(--novo-accent-primary-light)', color: 'var(--novo-accent-primary)' }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
          {intent.domain != null && (
            <div>
              <span className="text-[10px] font-bold" style={{ color: 'var(--novo-text-muted)' }}>检测领域</span>
              <p className="text-sm" style={{ color: 'var(--novo-text-primary)' }}>{String(intent.domain)}</p>
            </div>
          )}
          {intent.detection_type != null && (
            <div>
              <span className="text-[10px] font-bold" style={{ color: 'var(--novo-text-muted)' }}>检测类型</span>
              <p className="text-sm" style={{ color: 'var(--novo-text-primary)' }}>{String(intent.detection_type)}</p>
            </div>
          )}
        </div>

        {/* 修正输入 */}
        {revising && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4"
          >
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="请说明需要修正的内容..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-xl novo-input resize-none"
            />
          </motion.div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          <button
            onClick={onConfirm}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'var(--novo-accent-success)',
              color: 'white',
              boxShadow: 'var(--novo-shadow-sm)',
            }}
          >
            <Check className="w-4 h-4" />
            确认并继续
          </button>
          {!revising ? (
            <button
              onClick={() => setRevising(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'var(--novo-bg-surface)',
                color: 'var(--novo-text-secondary)',
                border: '1px solid var(--novo-border-default)',
              }}
            >
              <PenLine className="w-4 h-4" />
              修正
            </button>
          ) : (
            <button
              onClick={handleRevise}
              disabled={!feedback.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: feedback.trim() ? 'var(--novo-accent-warning)' : 'var(--novo-bg-active)',
                color: feedback.trim() ? 'white' : 'var(--novo-text-disabled)',
                cursor: feedback.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              <PenLine className="w-4 h-4" />
              提交修正
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
