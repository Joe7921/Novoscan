import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Server, CheckCircle2, XCircle, Loader2, RefreshCw, ChevronDown,
  Shield, ArrowDownRight, Save, Eye, EyeOff,
} from 'lucide-react'
import {
  fetchHealth, fetchModelConfig, updateModelConfig,
  type HealthResponse, type ModelConfigResponse, type ModelConfigUpdate,
} from '@/lib/api'

// ── 预设供应商 ──
const PROVIDERS = [
  { id: 'deepseek',  label: 'DeepSeek',  baseUrl: 'https://api.deepseek.com/v1',       models: ['deepseek-chat', 'deepseek-reasoner'], color: '#4285F4' },
  { id: 'openai',    label: 'OpenAI',     baseUrl: 'https://api.openai.com/v1',          models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'], color: '#10A37F' },
  { id: 'minimax',   label: 'MiniMax',    baseUrl: 'https://api.minimax.chat/v1',        models: ['abab6.5s-chat', 'abab5.5-chat'], color: '#FF6B35' },
  { id: 'moonshot',  label: 'Moonshot',   baseUrl: 'https://api.moonshot.cn/v1',         models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], color: '#7C3AED' },
  { id: 'zhipu',     label: '智谱 AI',    baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-plus', 'glm-4', 'glm-4-flash'], color: '#2563EB' },
  { id: 'ollama',    label: 'Ollama',     baseUrl: 'http://localhost:11434/v1',           models: ['llama3', 'qwen2', 'mistral'], color: '#0D9488' },
  { id: 'custom',    label: '自定义',     baseUrl: '',                                    models: [], color: '#6B7280' },
]

export default function ModelConfig() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [config, setConfig] = useState<ModelConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // 表单状态
  const [provider, setProvider] = useState('deepseek')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [modelName, setModelName] = useState('')
  const [temperature, setTemperature] = useState(0.3)
  const [structuredOutput, setStructuredOutput] = useState(false)
  const [showKey, setShowKey] = useState(false)

  // 降级链
  const [fbApiKey, setFbApiKey] = useState('')
  const [fbBaseUrl, setFbBaseUrl] = useState('')
  const [fbModelName, setFbModelName] = useState('')
  const [showFbKey, setShowFbKey] = useState(false)
  const [fbExpanded, setFbExpanded] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, c] = await Promise.all([fetchHealth(), fetchModelConfig()])
      setHealth(h)
      setConfig(c)
      // 从后端配置填充表单
      const p = PROVIDERS.find(p => p.id === c.primary.provider) || PROVIDERS.find(p => p.id === 'custom')!
      setProvider(p.id)
      setBaseUrl(c.primary.base_url)
      setModelName(c.primary.model_name)
      setTemperature(c.primary.temperature)
      setStructuredOutput(c.primary.supports_structured_output)
      if (c.has_fallback) {
        setFbBaseUrl(c.fallback.base_url)
        setFbModelName(c.fallback.model_name)
        setFbExpanded(true)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // 切换供应商自动填充 baseUrl
  const handleProviderChange = (id: string) => {
    setProvider(id)
    const p = PROVIDERS.find(p => p.id === id)
    if (p && p.baseUrl) {
      setBaseUrl(p.baseUrl)
      if (p.models.length > 0) setModelName(p.models[0])
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const payload: ModelConfigUpdate = {
        model_provider: provider,
        llm_base_url: baseUrl,
        llm_model_name: modelName,
        llm_temperature: temperature,
        llm_supports_structured_output: structuredOutput,
      }
      if (apiKey) payload.llm_api_key = apiKey
      if (fbBaseUrl) {
        payload.fallback_base_url = fbBaseUrl
        payload.fallback_model_name = fbModelName
        if (fbApiKey) payload.fallback_api_key = fbApiKey
      }
      const result = await updateModelConfig(payload)
      setSaveMsg(
        result.primary_ok
          ? `✅ 已保存，主模型就绪${result.fallback_ok ? '，备用模型就绪' : ''}`
          : '⚠️ 已保存，但主模型连接异常，请检查 API Key 和 Base URL'
      )
      // 刷新健康检查
      const h = await fetchHealth()
      setHealth(h)
      setApiKey('')
      setFbApiKey('')
    } catch (e) {
      setSaveMsg(`❌ 保存失败: ${(e as Error).message}`)
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 5000)
    }
  }

  const isOnline = health?.status === 'ok'
  const currentProvider = PROVIDERS.find(p => p.id === provider) || PROVIDERS[PROVIDERS.length - 1]
  const modelOptions = currentProvider.models

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* ── 引擎状态 ── */}
      <div className="novo-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4" style={{ color: 'var(--novo-accent-primary)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>引擎状态</h3>
          </div>
          <button
            onClick={loadAll}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--novo-bg-hover)]"
            style={{ color: 'var(--novo-text-muted)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading && !health && (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--novo-text-muted)' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> 正在连接引擎...
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'var(--novo-accent-danger-light)', color: 'var(--novo-accent-danger)' }}>
            <XCircle className="w-4 h-4 shrink-0" /> 引擎离线 — {error}
          </div>
        )}
        {health && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {isOnline
                ? <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--novo-accent-success)' }} />
                : <XCircle className="w-4 h-4" style={{ color: 'var(--novo-accent-danger)' }} />}
              <span className="text-sm font-semibold" style={{ color: isOnline ? 'var(--novo-accent-success)' : 'var(--novo-accent-danger)' }}>
                {isOnline ? '在线' : '异常'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="引擎" value={health.engine} />
              <InfoItem label="版本" value={health.version} />
              <InfoItem label="模型供应商" value={health.model_provider} />
              <InfoItem label="模型就绪" value={health.model_ready ? '是' : '否'} />
            </div>
          </div>
        )}
      </div>

      {/* ── 供应商选择器 ── */}
      <div className="novo-card p-5">
        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--novo-text-primary)' }}>模型供应商</h3>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all border"
              style={{
                borderColor: provider === p.id ? p.color : 'var(--novo-border-default)',
                background: provider === p.id ? `color-mix(in srgb, ${p.color} 8%, transparent)` : 'transparent',
                color: provider === p.id ? p.color : 'var(--novo-text-secondary)',
              }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              {p.label}
            </button>
          ))}
        </div>

        {/* 配置表单 */}
        <div className="space-y-3">
          <FormField label="API Key" hint="密钥不会明文存储到前端">
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={config?.primary.api_key || 'sk-your-key'}
                className="w-full text-xs px-3 py-2 pr-8 rounded-lg novo-input font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
                style={{ color: 'var(--novo-text-disabled)' }}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </FormField>

          <FormField label="Base URL">
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="w-full text-xs px-3 py-2 rounded-lg novo-input font-mono"
            />
          </FormField>

          <FormField label="模型名称">
            {modelOptions.length > 0 ? (
              <div className="relative">
                <select
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg novo-input font-mono appearance-none"
                >
                  {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
                  {!modelOptions.includes(modelName) && modelName && (
                    <option value={modelName}>{modelName} (当前)</option>
                  )}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--novo-text-disabled)' }} />
              </div>
            ) : (
              <input
                type="text"
                value={modelName}
                onChange={e => setModelName(e.target.value)}
                placeholder="model-name"
                className="w-full text-xs px-3 py-2 rounded-lg novo-input font-mono"
              />
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={`Temperature: ${temperature}`}>
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-[var(--novo-accent-primary)]"
              />
            </FormField>
            <FormField label="Structured Output">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={structuredOutput}
                  onChange={e => setStructuredOutput(e.target.checked)}
                  className="rounded accent-[var(--novo-accent-primary)]"
                />
                <span className="text-[10px]" style={{ color: 'var(--novo-text-secondary)' }}>
                  {structuredOutput ? 'GPT-4 / Gemini 模式' : '兼容模式（DeepSeek 等）'}
                </span>
              </label>
            </FormField>
          </div>
        </div>
      </div>

      {/* ── 降级链 ── */}
      <div className="novo-card p-5">
        <button
          onClick={() => setFbExpanded(!fbExpanded)}
          className="w-full flex items-center gap-2 text-sm font-bold"
          style={{ color: 'var(--novo-text-primary)' }}
        >
          <Shield className="w-4 h-4" style={{ color: '#EA580C' }} />
          降级链配置
          <span className="text-[9px] font-normal px-1.5 py-0.5 rounded-full ml-1" style={{
            background: config?.has_fallback ? 'rgba(22,163,74,0.1)' : 'rgba(107,114,128,0.1)',
            color: config?.has_fallback ? '#16A34A' : 'var(--novo-text-muted)',
          }}>
            {config?.has_fallback ? '已配置' : '未配置'}
          </span>
          <ChevronDown
            className="w-3.5 h-3.5 ml-auto transition-transform"
            style={{ transform: fbExpanded ? 'none' : 'rotate(-90deg)', color: 'var(--novo-text-disabled)' }}
          />
        </button>

        {fbExpanded && (
          <div className="mt-4 space-y-3">
            {/* 可视化降级链 */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[10px]" style={{ background: 'var(--novo-bg-surface)' }}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: currentProvider.color }} />
                <span className="font-semibold" style={{ color: 'var(--novo-text-primary)' }}>
                  {currentProvider.label} · {modelName || '未设置'}
                </span>
              </div>
              <ArrowDownRight className="w-3.5 h-3.5" style={{ color: 'var(--novo-text-disabled)' }} />
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: fbBaseUrl ? '#EA580C' : 'var(--novo-text-disabled)' }} />
                <span className="font-semibold" style={{ color: fbBaseUrl ? '#EA580C' : 'var(--novo-text-disabled)' }}>
                  {fbModelName || '备用模型'}
                </span>
              </div>
              <ArrowDownRight className="w-3.5 h-3.5" style={{ color: 'var(--novo-text-disabled)' }} />
              <span style={{ color: 'var(--novo-accent-danger)' }}>❌ 失败</span>
            </div>

            <FormField label="备用 API Key">
              <div className="relative">
                <input
                  type={showFbKey ? 'text' : 'password'}
                  value={fbApiKey}
                  onChange={e => setFbApiKey(e.target.value)}
                  placeholder={config?.fallback.api_key || 'sk-fallback-key'}
                  className="w-full text-xs px-3 py-2 pr-8 rounded-lg novo-input font-mono"
                />
                <button
                  onClick={() => setShowFbKey(!showFbKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
                  style={{ color: 'var(--novo-text-disabled)' }}
                >
                  {showFbKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </FormField>
            <FormField label="备用 Base URL">
              <input
                type="text"
                value={fbBaseUrl}
                onChange={e => setFbBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full text-xs px-3 py-2 rounded-lg novo-input font-mono"
              />
            </FormField>
            <FormField label="备用模型名称">
              <input
                type="text"
                value={fbModelName}
                onChange={e => setFbModelName(e.target.value)}
                placeholder="gpt-4o-mini"
                className="w-full text-xs px-3 py-2 rounded-lg novo-input font-mono"
              />
            </FormField>
          </div>
        )}
      </div>

      {/* ── 保存按钮 ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: saving ? 'var(--novo-bg-surface)' : 'var(--novo-accent-primary)',
            color: saving ? 'var(--novo-text-muted)' : 'white',
          }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saving ? '保存中...' : '保存配置'}
        </button>
        {saveMsg && (
          <span className="text-[11px] font-medium" style={{ color: saveMsg.startsWith('✅') ? 'var(--novo-accent-success)' : saveMsg.startsWith('⚠️') ? '#EA580C' : 'var(--novo-accent-danger)' }}>
            {saveMsg}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ── 辅助组件 ──

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--novo-bg-surface)' }}>
      <div className="text-[10px] font-bold" style={{ color: 'var(--novo-text-muted)' }}>{label}</div>
      <div className="text-xs font-medium mt-0.5" style={{ color: 'var(--novo-text-primary)', fontFamily: 'var(--novo-font-mono)' }}>{value}</div>
    </div>
  )
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <label className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-muted)' }}>{label}</label>
        {hint && <span className="text-[9px]" style={{ color: 'var(--novo-text-disabled)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}
