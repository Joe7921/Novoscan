import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { FlaskConical, Cpu, Loader2, ChevronDown, Server, Workflow, AlertCircle, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchHealth, fetchPipelines } from '@/lib/api'
import type { PipelineListItem } from '@/types/blocks'

interface InputPanelProps {
  onSubmit: (input: string, detectionType: string, mode: 'standard' | 'agentic', opts?: { pipeline?: string }) => void
  disabled?: boolean
}

const TYPEWRITER_HINTS = [
  '用 AI 检测分子对接社交平台的创新性...',
  '基于大语言模型的自动化代码审计工具...',
  '利用联邦学习实现医疗数据隐私保护...',
  '新型固态电解质电池的产业化路径...',
]

const DETECTION_TYPES = [
  { value: 'auto',       label: '自动检测' },
  { value: 'academic',   label: '学术创新' },
  { value: 'industrial', label: '产业创新' },
  { value: 'skill',      label: '技术创新' },
]

export default function InputPanel({ onSubmit, disabled }: InputPanelProps) {
  const [input, setInput] = useState('')
  const [detectionType, setDetectionType] = useState('auto')
  const [mode, setMode] = useState<'standard' | 'agentic'>('standard')
  const [isCustom, setIsCustom] = useState(false)
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null)
  const [pipelines, setPipelines] = useState<PipelineListItem[]>([])
  const [placeholder, setPlaceholder] = useState('')
  const [modelInfo, setModelInfo] = useState<{ provider: string; ready: boolean } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchHealth()
      .then(h => setModelInfo({ provider: h.model_provider, ready: h.model_ready }))
      .catch(() => setModelInfo(null))
    fetchPipelines()
      .then(r => setPipelines(r.pipelines.filter(p => !p.is_builtin)))
      .catch(() => {})
  }, [])

  // 打字机 placeholder 动态
  useEffect(() => {
    let hintIdx = 0
    let charIdx = 0
    let isDeleting = false

    function tick() {
      const current = TYPEWRITER_HINTS[hintIdx]
      if (!isDeleting) {
        charIdx++
        setPlaceholder(current.slice(0, charIdx))
        if (charIdx === current.length) {
          isDeleting = true
          timerRef.current = setTimeout(tick, 2000)
          return
        }
      } else {
        charIdx--
        setPlaceholder(current.slice(0, charIdx))
        if (charIdx === 0) {
          isDeleting = false
          hintIdx = (hintIdx + 1) % TYPEWRITER_HINTS.length
        }
      }
      timerRef.current = setTimeout(tick, isDeleting ? 30 : 60)
    }

    timerRef.current = setTimeout(tick, 600)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const canSubmit = input.trim().length > 0 && !disabled

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit(input.trim(), detectionType, mode, {
      pipeline: isCustom && selectedPipeline ? selectedPipeline : undefined,
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) {
      handleSubmit()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      {/* 标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--novo-text-primary)' }}>
          Playground
        </h1>
        <p className="text-sm" style={{ color: 'var(--novo-text-secondary)' }}>
          输入你的创新想法，AI 多智能体引擎将为你全面评估
        </p>
      </div>

      {/* 未配置模型提示 */}
      {modelInfo && !modelInfo.ready && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4"
          style={{ background: 'var(--novo-accent-warning-light)', border: '1px solid color-mix(in srgb, var(--novo-accent-warning) 30%, transparent)' }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--novo-accent-warning)' }} />
          <span className="text-xs flex-1" style={{ color: 'var(--novo-text-primary)' }}>
            尚未配置 AI 模型，请先在设置中配置后再开始分析。
          </span>
          <Link
            to="/settings"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-all"
            style={{ background: 'var(--novo-accent-primary)', color: 'white' }}
          >
            <Settings className="w-3 h-3" />
            去配置
          </Link>
        </motion.div>
      )}

      {/* 输入框 */}
      <div className="novo-card p-1 mb-4">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || '描述你的创新想法...'}
          disabled={disabled}
          rows={4}
          className="w-full px-4 py-3 text-sm bg-transparent border-none resize-none focus:outline-none"
          style={{ color: 'var(--novo-text-primary)' }}
        />
        <div className="flex items-center justify-between px-3 py-2 border-t" style={{ borderColor: 'var(--novo-border-default)' }}>
          {/* 左侧：检测类型 */}
          <div className="relative">
            <select
              value={detectionType}
              onChange={e => setDetectionType(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-lg appearance-none pr-6 cursor-pointer novo-input"
            >
              {DETECTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--novo-text-muted)' }} />
          </div>

          {/* 中间：模型状态 */}
          {modelInfo && (
            <a
              href="/settings"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-all hover:bg-[var(--novo-bg-hover)]"
              style={{ color: 'var(--novo-text-muted)' }}
              title="点击进入设置配置模型"
            >
              <Server className="w-3 h-3" />
              <span className="font-medium">{modelInfo.provider || '未配置'}</span>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: modelInfo.ready ? 'var(--novo-accent-success)' : 'var(--novo-accent-danger)' }}
              />
            </a>
          )}

          {/* 右侧：提交按钮 */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: canSubmit ? 'var(--novo-accent-primary)' : 'var(--novo-bg-active)',
              color: canSubmit ? 'white' : 'var(--novo-text-disabled)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? 'var(--novo-shadow-sm)' : 'none',
            }}
          >
            {disabled ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FlaskConical className="w-4 h-4" />
            )}
            {disabled ? '分析中...' : '开始分析'}
          </button>
        </div>
      </div>

      {/* 模式切换 */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => { setMode('standard'); setIsCustom(false) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: mode === 'standard' && !isCustom ? 'var(--novo-accent-primary-light)' : 'transparent',
            color: mode === 'standard' && !isCustom ? 'var(--novo-accent-primary)' : 'var(--novo-text-muted)',
            border: `1px solid ${mode === 'standard' && !isCustom ? 'var(--novo-accent-primary)' : 'var(--novo-border-default)'}`,
          }}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Standard
        </button>
        <button
          onClick={() => { setMode('agentic'); setIsCustom(false) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: mode === 'agentic' && !isCustom ? 'var(--novo-accent-info-light)' : 'transparent',
            color: mode === 'agentic' && !isCustom ? 'var(--novo-accent-info)' : 'var(--novo-text-muted)',
            border: `1px solid ${mode === 'agentic' && !isCustom ? 'var(--novo-accent-info)' : 'var(--novo-border-default)'}`,
          }}
        >
          <Cpu className="w-3.5 h-3.5" />
          Agentic
        </button>
        {pipelines.length > 0 && (
          <button
            onClick={() => setIsCustom(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: isCustom ? 'var(--novo-accent-warning-light, rgba(234,179,8,0.1))' : 'transparent',
              color: isCustom ? 'var(--novo-accent-warning, #CA8A04)' : 'var(--novo-text-muted)',
              border: `1px solid ${isCustom ? 'var(--novo-accent-warning, #CA8A04)' : 'var(--novo-border-default)'}`,
            }}
          >
            <Workflow className="w-3.5 h-3.5" />
            Custom
          </button>
        )}
      </div>

      {/* Custom 管线选择器 */}
      {isCustom && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <select
            value={selectedPipeline || ''}
            onChange={e => setSelectedPipeline(e.target.value || null)}
            className="text-xs px-3 py-1.5 rounded-lg appearance-none cursor-pointer novo-input"
          >
            <option value="">选择自定义管线...</option>
            {pipelines.map(p => (
              <option key={p.filename} value={p.filename}>
                {p.name} ({p.node_count} 节点)
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-center text-[10px] mt-2" style={{ color: 'var(--novo-text-muted)' }}>
        {isCustom
          ? 'Custom · 自定义工作流：使用 Studio 中创建的自定义管线运行分析'
          : mode === 'standard'
            ? 'Standard · 传统工作流：按预定义管线顺序执行，支持人工审核意图'
            : 'Agentic · 智能体工作流：AI 自主决策，自动选择工具与执行路径'}
      </p>
    </motion.div>
  )
}
