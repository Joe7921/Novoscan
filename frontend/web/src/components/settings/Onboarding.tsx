import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowRight, FlaskConical, Database, FileText } from 'lucide-react'

interface OnboardingProps {
  onComplete: () => void
}

const STEPS = [
  {
    icon: Sparkles,
    color: 'var(--novo-accent-primary)',
    title: '欢迎使用 Novoscan',
    description: 'AI 多智能体创新检测引擎，帮助你快速评估创新想法的学术新颖性、产业可行性与竞争态势。',
  },
  {
    icon: FlaskConical,
    color: 'var(--novo-accent-success)',
    title: '两种分析模式',
    description: 'Standard 模式：三个专业 Agent 并行评分 + 辩论仲裁。\nAgentic 模式：自主规划工具链，灵活调用搜索引擎。',
  },
  {
    icon: Database,
    color: 'var(--novo-accent-warning)',
    title: '五大数据源',
    description: 'OpenAlex · arXiv · CrossRef 免费学术搜索\nBrave Search 网页搜索（需 API Key）\nGitHub 开源项目搜索',
  },
  {
    icon: FileText,
    color: 'var(--novo-accent-danger)',
    title: '报告导出',
    description: '分析完成后可一键导出 PDF 或 Word 文档，包含评分详情、证据列表、风险分析等完整报告。',
  },
]

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'var(--novo-bg-overlay)' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-[420px] rounded-2xl overflow-hidden"
          style={{
            background: 'var(--novo-bg-elevated)',
            border: '1px solid var(--novo-border-default)',
            boxShadow: 'var(--novo-shadow-xl)',
          }}
        >
          {/* 内容区 */}
          <div className="px-8 pt-8 pb-6 text-center">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: `color-mix(in srgb, ${current.color} 12%, transparent)` }}
              >
                <Icon className="w-7 h-7" style={{ color: current.color }} />
              </div>
              <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--novo-text-primary)' }}>
                {current.title}
              </h2>
              <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--novo-text-secondary)' }}>
                {current.description}
              </p>
            </motion.div>
          </div>

          {/* 底部操作 */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderTop: '1px solid var(--novo-border-default)', background: 'var(--novo-bg-surface)' }}
          >
            {/* 步骤指示器 */}
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all"
                  style={{
                    width: i === step ? 16 : 6,
                    height: 6,
                    background: i === step ? 'var(--novo-accent-primary)' : 'var(--novo-border-default)',
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {!isLast && (
                <button
                  onClick={onComplete}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:bg-[var(--novo-bg-hover)]"
                  style={{ color: 'var(--novo-text-muted)' }}
                >
                  跳过
                </button>
              )}
              <button
                onClick={() => isLast ? onComplete() : setStep(s => s + 1)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: 'var(--novo-accent-primary)',
                  color: 'white',
                  boxShadow: 'var(--novo-shadow-sm)',
                }}
              >
                {isLast ? '开始使用' : '下一步'}
                {!isLast && <ArrowRight className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
