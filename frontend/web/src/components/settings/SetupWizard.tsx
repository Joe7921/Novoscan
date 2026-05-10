/**
 * WeFlow 风格 Setup Wizard — 首次启动分步引导
 *
 * 左右分栏布局，4 步引导：欢迎 → 模型配置 → 数据源 → 完成
 * 复用 providerStore + PROVIDER_TEMPLATES 完成实际配置
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Server, Database, Rocket,
  ArrowLeft, ArrowRight, Check, ExternalLink,
  Eye, EyeOff, Loader2, AlertCircle,
  BookOpen, Library, FileText, Globe, Code2,
  Shield,
} from 'lucide-react'
import { useProviderStore } from '@/lib/providerStore'
import { PROVIDER_TEMPLATES } from '@/lib/providerTemplates'
import type { ProviderTemplate } from '@/types/provider'

// ════════════════════════════════════════════════════════════
// 步骤定义
// ════════════════════════════════════════════════════════════

interface WizardStep {
  id: string
  title: string
  subtitle: string
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>
  color: string
}

const STEPS: WizardStep[] = [
  { id: 'welcome',    title: '欢迎',     subtitle: '准备开始配置',         icon: Sparkles, color: 'var(--novo-accent-primary)' },
  { id: 'model',      title: '模型配置',  subtitle: '连接 AI 模型服务',     icon: Server,   color: 'var(--novo-accent-info)' },
  { id: 'datasource', title: '数据源',    subtitle: '配置搜索引擎（可选）',  icon: Database, color: 'var(--novo-accent-success)' },
  { id: 'complete',   title: '完成',      subtitle: '开始使用',            icon: Rocket,   color: 'var(--novo-accent-warning)' },
]

// ════════════════════════════════════════════════════════════
// 推荐的 Provider 模板（向导中展示前 6 个最常用）
// ════════════════════════════════════════════════════════════

const QUICK_PROVIDERS = ['deepseek', 'siliconflow', 'dashscope', 'openai', 'openrouter', 'ollama']

// ════════════════════════════════════════════════════════════
// 数据源列表
// ════════════════════════════════════════════════════════════

const DATA_SOURCES = [
  { id: 'openalex',  name: 'OpenAlex',      desc: '开放学术数据库，涵盖论文、引用',   icon: BookOpen, color: 'var(--novo-accent-primary)',  free: true },
  { id: 'arxiv',     name: 'arXiv',         desc: '预印本数据库，前沿研究论文',       icon: Library,  color: 'var(--novo-accent-success)',  free: true },
  { id: 'crossref',  name: 'CrossRef',      desc: '文献元数据，DOI 与出版信息',       icon: FileText, color: 'var(--novo-accent-info)',     free: true },
  { id: 'brave',     name: 'Brave Search',  desc: '网页搜索，产业动态与竞品情报',     icon: Globe,    color: 'var(--novo-accent-warning)',  free: false, envVar: 'BRAVE_API_KEY' },
  { id: 'github',    name: 'GitHub',        desc: '开源项目搜索，Star 数与活跃度',    icon: Code2,    color: 'var(--novo-accent-danger)',   free: true,  envVar: 'GITHUB_TOKEN' },
]

// ════════════════════════════════════════════════════════════
// 主组件
// ════════════════════════════════════════════════════════════

interface SetupWizardProps {
  onComplete: () => void
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const canGoBack = currentStep > 0
  const canGoNext = currentStep < STEPS.length - 1
  const isLastStep = currentStep === STEPS.length - 1

  const goNext = () => { if (canGoNext) setCurrentStep(s => s + 1) }
  const goBack = () => { if (canGoBack) setCurrentStep(s => s - 1) }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
      style={{ background: 'var(--novo-bg-base)' }}
    >
      {/* ── 左侧导航栏 ── */}
      <div
        className="w-[260px] shrink-0 flex flex-col border-r"
        style={{ background: 'var(--novo-bg-surface)', borderColor: 'var(--novo-border-default)' }}
      >
        {/* Logo */}
        <div className="px-6 pt-8 pb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: 'var(--novo-accent-primary-light)', color: 'var(--novo-accent-primary)' }}
            >
              🔬
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>Novoscan</div>
              <div className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: 'var(--novo-text-muted)' }}>
                SETUP
              </div>
            </div>
          </div>
        </div>

        {/* 步骤列表 */}
        <div className="flex-1 px-4 space-y-1">
          {STEPS.map((step, idx) => {
            const Icon = step.icon
            const isActive = idx === currentStep
            const isDone = idx < currentStep

            return (
              <button
                key={step.id}
                onClick={() => idx <= currentStep && setCurrentStep(idx)}
                disabled={idx > currentStep}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
                style={{
                  background: isActive ? 'var(--novo-accent-primary)' : 'transparent',
                  cursor: idx <= currentStep ? 'pointer' : 'default',
                  opacity: idx > currentStep ? 0.5 : 1,
                }}
              >
                {/* 圆点指示器 */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{
                    background: isActive
                      ? 'rgba(255,255,255,0.25)'
                      : isDone
                        ? 'var(--novo-accent-primary-light)'
                        : 'var(--novo-bg-hover)',
                    color: isActive
                      ? 'white'
                      : isDone
                        ? 'var(--novo-accent-primary)'
                        : 'var(--novo-text-disabled)',
                  }}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </div>

                {/* 文字 */}
                <div className="min-w-0">
                  <div
                    className="text-[11px] font-semibold"
                    style={{ color: isActive ? 'white' : 'var(--novo-text-primary)' }}
                  >
                    {step.title}
                  </div>
                  <div
                    className="text-[9px] truncate"
                    style={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--novo-text-muted)' }}
                  >
                    {step.subtitle}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* 底部隐私声明 */}
        <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--novo-border-default)' }}>
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--novo-text-disabled)' }} />
            <span className="text-[9px] leading-relaxed" style={{ color: 'var(--novo-text-disabled)' }}>
              所有配置存储在本地浏览器，不上传服务器
            </span>
          </div>
        </div>
      </div>

      {/* ── 右侧内容区 ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 步骤内容 */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {currentStep === 0 && <StepWelcome />}
              {currentStep === 1 && <StepModelConfig />}
              {currentStep === 2 && <StepDataSource />}
              {currentStep === 3 && <StepComplete onComplete={onComplete} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 底部导航 */}
        <div
          className="shrink-0 flex items-center justify-between px-10 py-4 border-t"
          style={{ borderColor: 'var(--novo-border-default)', background: 'var(--novo-bg-surface)' }}
        >
          <button
            onClick={goBack}
            disabled={!canGoBack}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              color: canGoBack ? 'var(--novo-text-secondary)' : 'var(--novo-text-disabled)',
              cursor: canGoBack ? 'pointer' : 'default',
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            上一步
          </button>

          {!isLastStep ? (
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: 'var(--novo-accent-primary)',
                color: 'white',
                boxShadow: 'var(--novo-shadow-sm)',
              }}
            >
              下一步
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: 'var(--novo-accent-success)',
                color: 'white',
                boxShadow: 'var(--novo-shadow-sm)',
              }}
            >
              <Rocket className="w-3.5 h-3.5" />
              开始使用
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════
// Step 1: 欢迎
// ════════════════════════════════════════════════════════════

function StepWelcome() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-10 text-center">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6"
        style={{ background: 'var(--novo-accent-primary-light)' }}
      >
        🔬
      </div>
      <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--novo-text-primary)' }}>
        欢迎使用 Novoscan
      </h1>
      <p className="text-sm mb-8 max-w-md leading-relaxed" style={{ color: 'var(--novo-text-secondary)' }}>
        AI 多智能体创新检测引擎——多源检索、多专家评分、对抗辩论、终裁报告，一站式评估你的创新想法。
      </p>

      <div
        className="max-w-lg w-full rounded-2xl p-6 text-left"
        style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}
      >
        <p className="text-xs leading-relaxed" style={{ color: 'var(--novo-text-secondary)' }}>
          接下来的几个步骤将引导你连接 AI 模型服务以提供分析功能。
        </p>
        <div className="mt-4 space-y-2">
          {[
            { icon: Server, text: '配置 AI 模型（DeepSeek / OpenAI / Ollama 等）', color: 'var(--novo-accent-info)' },
            { icon: Database, text: '了解数据源（学术 + 网页搜索，可跳过）', color: 'var(--novo-accent-success)' },
            { icon: Rocket, text: '完成配置，立即开始创新评估', color: 'var(--novo-accent-warning)' },
          ].map(({ icon: Icon, text, color }) => (
            <div key={text} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <span className="text-[11px]" style={{ color: 'var(--novo-text-primary)' }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Step 2: 模型配置
// ════════════════════════════════════════════════════════════

function StepModelConfig() {
  const { addProviderFromTemplate, updateProvider, providers, syncBackend } = useProviderStore()
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

  // 找到向导中添加的 Provider
  const activeProvider = providers.find(p => {
    const tmpl = PROVIDER_TEMPLATES.find(t => t.name === p.name)
    return tmpl && tmpl.id === selectedTemplateId
  })

  const handleSelectTemplate = (template: ProviderTemplate) => {
    // 检查是否已存在同名 Provider
    const existing = providers.find(p => p.name === template.name)
    if (existing) {
      setSelectedTemplateId(template.id)
      setApiKey(existing.apiKey)
      return
    }
    const newP = addProviderFromTemplate(template)
    setSelectedTemplateId(template.id)
    setApiKey('')
  }

  const handleSaveKey = () => {
    if (!activeProvider || !apiKey.trim()) return
    updateProvider(activeProvider.id, { apiKey: apiKey.trim(), enabled: true })
    syncBackend()
  }

  const handleTest = useCallback(async () => {
    if (!activeProvider) return
    setTesting(true)
    setTestResult(null)
    try {
      const url = `${activeProvider.baseUrl.replace(/\/+$/, '')}/models`
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      })
      if (resp.ok) {
        setTestResult({ ok: true })
        // 测试成功自动保存
        handleSaveKey()
      } else {
        setTestResult({ ok: false, error: `HTTP ${resp.status} ${resp.statusText}` })
      }
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : '网络异常' })
    }
    setTesting(false)
  }, [activeProvider, apiKey])

  const quickTemplates = PROVIDER_TEMPLATES.filter(t => QUICK_PROVIDERS.includes(t.id))

  return (
    <div className="px-10 py-8 max-w-2xl">
      <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--novo-text-primary)' }}>
        模型配置
      </h2>
      <p className="text-xs mb-6" style={{ color: 'var(--novo-text-muted)' }}>
        选择一个 AI 模型服务商并填入 API Key。支持所有 OpenAI 兼容接口。
      </p>

      {/* Provider 快速选择 */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {quickTemplates.map(tmpl => {
          const isSelected = selectedTemplateId === tmpl.id
          return (
            <button
              key={tmpl.id}
              onClick={() => handleSelectTemplate(tmpl)}
              className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-left transition-all border"
              style={{
                background: isSelected ? 'var(--novo-accent-primary)' : 'var(--novo-bg-elevated)',
                borderColor: isSelected ? 'var(--novo-accent-primary)' : 'var(--novo-border-default)',
                color: isSelected ? 'white' : 'var(--novo-text-primary)',
              }}
            >
              <span className="text-xl">{tmpl.icon}</span>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold truncate">{tmpl.name}</div>
                <div className="text-[9px] truncate" style={{ opacity: 0.6 }}>{tmpl.description}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 选中后的配置表单 */}
      {selectedTemplateId && activeProvider && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 space-y-4"
          style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{activeProvider.icon}</span>
            <span className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>
              {activeProvider.name}
            </span>
            {activeProvider.enabled && activeProvider.apiKey && (
              <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'var(--novo-accent-success-light)', color: 'var(--novo-accent-success)' }}>
                已配置
              </span>
            )}
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-secondary)' }}>
              Base URL
            </label>
            <input
              type="text"
              value={activeProvider.baseUrl}
              onChange={e => updateProvider(activeProvider.id, { baseUrl: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg novo-input"
              placeholder="https://api.xxx.com/v1"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-secondary)' }}>
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="w-full px-3 py-2 pr-16 text-xs rounded-lg novo-input"
                placeholder="sk-..."
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="p-1 rounded hover:bg-[var(--novo-bg-hover)] transition-colors"
                >
                  {showKey
                    ? <EyeOff className="w-3.5 h-3.5" style={{ color: 'var(--novo-text-muted)' }} />
                    : <Eye className="w-3.5 h-3.5" style={{ color: 'var(--novo-text-muted)' }} />
                  }
                </button>
              </div>
            </div>
          </div>

          {/* 默认模型 */}
          {activeProvider.models.length > 0 && (
            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-secondary)' }}>
                默认模型
              </label>
              <select
                className="w-full px-3 py-2 text-xs rounded-lg novo-input"
                defaultValue={activeProvider.models[0]?.id}
              >
                {activeProvider.models.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 获取 Key 链接 */}
          {(() => {
            const tmpl = PROVIDER_TEMPLATES.find(t => t.id === selectedTemplateId)
            return tmpl?.docUrl ? (
              <a
                href={tmpl.docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-medium transition-colors"
                style={{ color: 'var(--novo-accent-primary)' }}
              >
                获取 API Key
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : null
          })()}

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleTest}
              disabled={!apiKey.trim() || testing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold transition-all"
              style={{
                background: apiKey.trim() ? 'var(--novo-accent-primary)' : 'var(--novo-bg-hover)',
                color: apiKey.trim() ? 'white' : 'var(--novo-text-disabled)',
                cursor: apiKey.trim() && !testing ? 'pointer' : 'default',
              }}
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              测试连接
            </button>
            <button
              onClick={handleSaveKey}
              disabled={!apiKey.trim()}
              className="px-4 py-2 rounded-xl text-[11px] font-medium transition-all"
              style={{
                background: 'var(--novo-bg-hover)',
                color: apiKey.trim() ? 'var(--novo-text-primary)' : 'var(--novo-text-disabled)',
              }}
            >
              跳过测试，直接保存
            </button>
          </div>

          {/* 测试结果 */}
          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[10px]"
              style={{
                background: testResult.ok ? 'var(--novo-accent-success-light)' : 'var(--novo-accent-danger-light)',
                color: testResult.ok ? 'var(--novo-accent-success)' : 'var(--novo-accent-danger)',
              }}
            >
              {testResult.ok ? (
                <><Check className="w-3.5 h-3.5" /> 连接成功！模型服务可用。</>
              ) : (
                <><AlertCircle className="w-3.5 h-3.5" /> 连接失败：{testResult.error}</>
              )}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* 未选择时的提示 */}
      {!selectedTemplateId && (
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: 'var(--novo-bg-surface)', border: '1px dashed var(--novo-border-default)' }}
        >
          <Server className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--novo-text-disabled)' }} />
          <p className="text-xs" style={{ color: 'var(--novo-text-muted)' }}>
            选择上方的服务商开始配置，也可以点击"下一步"稍后在设置中配置
          </p>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Step 3: 数据源
// ════════════════════════════════════════════════════════════

function StepDataSource() {
  return (
    <div className="px-10 py-8 max-w-2xl">
      <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--novo-text-primary)' }}>
        数据源
      </h2>
      <p className="text-xs mb-6" style={{ color: 'var(--novo-text-muted)' }}>
        Novoscan 使用多个数据源进行多源检索。以下数据源中大部分免费，无需额外配置即可使用。
      </p>

      <div className="space-y-2">
        {DATA_SOURCES.map(ds => {
          const Icon = ds.icon
          return (
            <div
              key={ds.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-all"
              style={{ borderColor: 'var(--novo-border-default)', background: 'var(--novo-bg-elevated)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${ds.color} 12%, transparent)` }}
              >
                <Icon className="w-4.5 h-4.5" style={{ color: ds.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: 'var(--novo-text-primary)' }}>
                    {ds.name}
                  </span>
                  {ds.free ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--novo-accent-success-light)', color: 'var(--novo-accent-success)' }}>
                      免费
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--novo-accent-warning-light)', color: 'var(--novo-accent-warning)' }}>
                      需要 API Key
                    </span>
                  )}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--novo-text-muted)' }}>
                  {ds.desc}
                </div>
              </div>
              {ds.envVar && (
                <code
                  className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    background: 'var(--novo-bg-surface)',
                    color: 'var(--novo-text-muted)',
                    fontFamily: 'var(--novo-font-mono)',
                    border: '1px solid var(--novo-border-default)',
                  }}
                >
                  {ds.envVar}
                </code>
              )}
            </div>
          )
        })}
      </div>

      <div
        className="mt-5 rounded-xl px-4 py-3"
        style={{ background: 'var(--novo-accent-primary-light)' }}
      >
        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--novo-accent-primary)' }}>
          <strong>提示：</strong>OpenAlex、arXiv、CrossRef 无需配置即可使用。
          Brave Search 需要 API Key（在后端 .env 文件中配置 BRAVE_API_KEY）。
          你可以直接点击"下一步"跳过此步，稍后在设置页中配置。
        </p>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Step 4: 完成
// ════════════════════════════════════════════════════════════

function StepComplete({ onComplete }: { onComplete: () => void }) {
  const { providers } = useProviderStore()
  const configuredProviders = providers.filter(p => p.enabled && p.apiKey)
  const hasModel = configuredProviders.length > 0

  return (
    <div className="flex flex-col items-center justify-center h-full px-10 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6"
        style={{ background: 'var(--novo-accent-success-light)' }}
      >
        {hasModel ? '🎉' : '🚀'}
      </motion.div>

      <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--novo-text-primary)' }}>
        {hasModel ? '一切就绪！' : '准备就绪'}
      </h2>
      <p className="text-sm mb-8 max-w-md leading-relaxed" style={{ color: 'var(--novo-text-secondary)' }}>
        {hasModel
          ? '模型已配置，现在可以开始评估你的创新想法了。'
          : '你跳过了模型配置，稍后可以在设置页面中完成。'
        }
      </p>

      {/* 配置摘要 */}
      <div
        className="max-w-sm w-full rounded-2xl p-5 text-left mb-8"
        style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}
      >
        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--novo-text-muted)' }}>
          配置摘要
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--novo-text-secondary)' }}>AI 模型服务</span>
            <span className="text-xs font-semibold" style={{ color: hasModel ? 'var(--novo-accent-success)' : 'var(--novo-accent-warning)' }}>
              {hasModel
                ? configuredProviders.map(p => p.name).join(', ')
                : '未配置'
              }
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--novo-text-secondary)' }}>免费数据源</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--novo-accent-success)' }}>
              3 个可用
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--novo-text-secondary)' }}>分析模式</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--novo-accent-primary)' }}>
              Standard + Agentic
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={onComplete}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-lg"
        style={{
          background: 'var(--novo-accent-primary)',
          color: 'white',
          boxShadow: 'var(--novo-shadow-md)',
        }}
      >
        <Rocket className="w-4 h-4" />
        开始使用 Novoscan
      </button>
    </div>
  )
}
