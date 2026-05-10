/**
 * 模型服务管理 — 对标 CherryStudio，Novo 设计系统
 *
 * 左右分栏：左侧 Provider 列表 + 右侧详情配置面板
 * 支持：模板快速添加 / 多 Provider 并存 / 连通性检测 / 模型管理 / 降级链
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Check, X, AlertCircle, Loader2,
  ExternalLink, Trash2, Eye, EyeOff, RefreshCw,
  Star, ChevronDown, GripVertical, Shield,
} from 'lucide-react'
import { useProviderStore } from '@/lib/providerStore'
import { PROVIDER_TEMPLATES } from '@/lib/providerTemplates'
import type { AIProvider, ProviderTemplate, ModelConfig } from '@/types/provider'

// ════════════════════════════════════════════════════════════
// Provider 列表项
// ════════════════════════════════════════════════════════════

function ProviderListItem({
  provider,
  isSelected,
  onClick,
}: {
  provider: AIProvider
  isSelected: boolean
  onClick: () => void
}) {
  const hasKey = !!provider.apiKey

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all group"
      style={{
        background: isSelected ? 'var(--novo-accent-primary)' : 'transparent',
        color: isSelected ? 'white' : 'var(--novo-text-primary)',
      }}
    >
      <span
        className="text-lg flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
        style={{
          background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--novo-bg-surface)',
        }}
      >
        {provider.icon || '🤖'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold truncate flex items-center gap-1">
          {provider.name}
          {provider.isDefault && (
            <Star className="w-2.5 h-2.5 fill-current" style={{ color: isSelected ? 'white' : '#F59E0B' }} />
          )}
        </div>
        <div className="text-[9px] truncate" style={{ opacity: 0.6 }}>
          {provider.models.length} 个模型
        </div>
      </div>
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{
          background: provider.enabled
            ? (hasKey ? (isSelected ? 'white' : 'var(--novo-accent-success)') : '#F59E0B')
            : (isSelected ? 'rgba(255,255,255,0.4)' : 'var(--novo-text-disabled)'),
        }}
      />
    </button>
  )
}

// ════════════════════════════════════════════════════════════
// 添加 Provider 弹窗
// ════════════════════════════════════════════════════════════

function AddProviderDialog({
  onSelect,
  onClose,
}: {
  onSelect: (template: ProviderTemplate) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? PROVIDER_TEMPLATES.filter(
        t =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description.includes(search)
      )
    : PROVIDER_TEMPLATES

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ background: 'var(--novo-bg-overlay)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="w-[480px] rounded-2xl overflow-hidden"
          style={{
            background: 'var(--novo-bg-elevated)',
            border: '1px solid var(--novo-border-default)',
            boxShadow: 'var(--novo-shadow-xl)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* 顶部 */}
          <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid var(--novo-border-default)' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>
                添加模型服务商
              </h3>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--novo-bg-hover)] transition-colors">
                <X className="w-4 h-4" style={{ color: 'var(--novo-text-muted)' }} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--novo-text-disabled)' }} />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索服务商..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg novo-input"
              />
            </div>
          </div>

          {/* 列表 */}
          <div className="max-h-[50vh] overflow-y-auto p-3 space-y-1">
            {filtered.map(template => (
              <button
                key={template.id}
                onClick={() => { onSelect(template); onClose() }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-[var(--novo-bg-hover)] group"
              >
                <span
                  className="text-xl w-9 h-9 flex items-center justify-center rounded-lg shrink-0"
                  style={{ background: 'var(--novo-bg-surface)' }}
                >
                  {template.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: 'var(--novo-text-primary)' }}>
                    {template.name}
                  </div>
                  <div className="text-[10px] truncate" style={{ color: 'var(--novo-text-muted)' }}>
                    {template.description}
                  </div>
                </div>
                <Plus
                  className="w-4 h-4 shrink-0 transition-colors"
                  style={{ color: 'var(--novo-text-disabled)' }}
                />
              </button>
            ))}

            {/* 自定义 */}
            <div className="my-2" style={{ borderTop: '1px solid var(--novo-border-default)' }} />
            <button
              onClick={() => {
                onSelect({
                  id: 'custom',
                  name: '自定义 (OpenAI 兼容)',
                  icon: '🔧',
                  type: 'openai-compatible',
                  defaultBaseUrl: '',
                  description: '任何兼容 OpenAI Chat Completions API 的服务',
                  docUrl: '',
                  defaultModels: [],
                })
                onClose()
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-[var(--novo-bg-hover)]"
            >
              <span
                className="text-xl w-9 h-9 flex items-center justify-center rounded-lg shrink-0"
                style={{ background: 'var(--novo-bg-surface)', border: '1px dashed var(--novo-border-default)' }}
              >
                🔧
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold" style={{ color: 'var(--novo-text-primary)' }}>自定义服务商</div>
                <div className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>配置兼容 OpenAI 格式的任意接口</div>
              </div>
              <Plus className="w-4 h-4 shrink-0" style={{ color: 'var(--novo-text-disabled)' }} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ════════════════════════════════════════════════════════════
// Provider 详情面板
// ════════════════════════════════════════════════════════════

function ProviderDetailPanel({ provider }: { provider: AIProvider }) {
  const {
    updateProvider, removeProvider, toggleProvider,
    setDefaultProvider, addModel, removeModel, syncBackend,
  } = useProviderStore()

  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [newModelId, setNewModelId] = useState('')

  const tmpl = PROVIDER_TEMPLATES.find(t => t.name === provider.name)

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const resp = await fetch(`${provider.baseUrl.replace(/\/+$/, '')}/models`, {
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
        },
        signal: AbortSignal.timeout(8000),
      })
      if (resp.ok) {
        setTestResult({ ok: true })
      } else {
        setTestResult({ ok: false, error: `HTTP ${resp.status} ${resp.statusText}` })
      }
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : '网络异常' })
    }
    setTesting(false)
  }, [provider.apiKey, provider.baseUrl])

  const handleAddModel = useCallback(() => {
    const id = newModelId.trim()
    if (!id) return
    const model: ModelConfig = { id, name: id, supportsStreaming: true }
    addModel(provider.id, model)
    setNewModelId('')
  }, [newModelId, provider.id, addModel])

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-xl space-y-6">

        {/* ── 顶部：Logo + 名称 + 开关 ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="text-2xl w-12 h-12 flex items-center justify-center rounded-xl"
              style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}
            >
              {provider.icon || '🤖'}
            </span>
            <div>
              <input
                type="text"
                value={provider.name}
                onChange={e => updateProvider(provider.id, { name: e.target.value })}
                className="text-base font-bold bg-transparent border-none outline-none"
                style={{ color: 'var(--novo-text-primary)' }}
                placeholder="服务商名称"
              />
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)' }}
                >
                  {provider.type.toUpperCase()}
                </span>
                {!provider.isDefault ? (
                  <button
                    onClick={() => setDefaultProvider(provider.id)}
                    className="text-[10px] font-medium transition-colors"
                    style={{ color: 'var(--novo-accent-primary)' }}
                  >
                    设为默认
                  </button>
                ) : (
                  <span className="text-[10px] font-medium flex items-center gap-0.5" style={{ color: '#F59E0B' }}>
                    <Star className="w-2.5 h-2.5 fill-current" /> 默认
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>
              {provider.enabled ? '启用中' : '已停用'}
            </span>
            <button
              onClick={() => toggleProvider(provider.id)}
              className="relative w-9 h-5 rounded-full transition-colors"
              style={{ background: provider.enabled ? 'var(--novo-accent-primary)' : 'var(--novo-bg-active)' }}
            >
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                style={{ left: provider.enabled ? '18px' : '2px' }}
              />
            </button>
          </div>
        </div>

        {/* ── API Key ── */}
        <div className="novo-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold" style={{ color: 'var(--novo-text-primary)' }}>
              API 凭据
            </label>
            {tmpl?.docUrl && (
              <a
                href={tmpl.docUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-medium flex items-center gap-1 transition-colors hover:underline"
                style={{ color: 'var(--novo-accent-primary)' }}
              >
                获取 Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
          <div className="flex">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={provider.apiKey}
                onChange={e => updateProvider(provider.id, { apiKey: e.target.value })}
                placeholder={provider.type === 'ollama' ? '无需凭据' : 'sk-your-key'}
                className="w-full text-xs px-3 py-2 pr-8 rounded-l-lg novo-input font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
                style={{ color: 'var(--novo-text-disabled)' }}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1 px-3 py-2 text-[10px] font-semibold rounded-r-lg transition-colors border -ml-px"
              style={{
                background: 'var(--novo-bg-surface)',
                borderColor: 'var(--novo-border-default)',
                color: 'var(--novo-text-secondary)',
              }}
            >
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              检测
            </button>
          </div>
          {testResult && (
            <div
              className="flex items-center gap-2 text-[10px] px-3 py-2 rounded-lg"
              style={{
                background: testResult.ok ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
                color: testResult.ok ? 'var(--novo-accent-success)' : 'var(--novo-accent-danger)',
              }}
            >
              {testResult.ok ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {testResult.ok ? '连接成功' : `连接失败: ${testResult.error}`}
            </div>
          )}

          {/* Base URL */}
          <div>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-muted)' }}>
              接口地址 (Base URL)
            </label>
            <input
              type="text"
              value={provider.baseUrl}
              onChange={e => updateProvider(provider.id, { baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
              className="w-full text-xs px-3 py-2 rounded-lg novo-input font-mono"
            />
            <p className="text-[9px] mt-1" style={{ color: 'var(--novo-text-disabled)' }}>
              支持兼容 OpenAI Chat Completions API 的代理地址
            </p>
          </div>
        </div>

        {/* ── 模型管理 ── */}
        <div className="novo-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--novo-text-primary)' }}>
              可用模型
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)' }}
              >
                {provider.models.length}
              </span>
            </h4>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {provider.models.map(model => (
              <div
                key={model.id}
                className="group flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] transition-colors"
                style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}
              >
                <span className="font-mono" style={{ color: 'var(--novo-text-primary)' }}>{model.id}</span>
                {model.supportsReasoning && (
                  <span
                    className="text-[8px] font-bold uppercase px-1 py-0.5 rounded"
                    style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1' }}
                  >
                    R1
                  </span>
                )}
                <button
                  onClick={() => removeModel(provider.id, model.id)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all hover:bg-[var(--novo-accent-danger-light)]"
                  style={{ color: 'var(--novo-accent-danger)' }}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newModelId}
              onChange={e => setNewModelId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddModel()}
              placeholder="输入模型 ID，回车添加..."
              className="flex-1 px-3 py-1.5 text-[10px] rounded-lg novo-input font-mono"
              style={{ border: '1px dashed var(--novo-border-default)' }}
            />
            <button
              onClick={handleAddModel}
              disabled={!newModelId.trim()}
              className="px-3 py-1.5 text-[10px] font-semibold rounded-lg transition-all"
              style={{
                background: newModelId.trim() ? 'var(--novo-accent-primary)' : 'var(--novo-bg-surface)',
                color: newModelId.trim() ? 'white' : 'var(--novo-text-disabled)',
              }}
            >
              添加
            </button>
          </div>
        </div>

        {/* ── 备注 ── */}
        <div className="novo-card p-5">
          <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-muted)' }}>
            备注
          </label>
          <textarea
            value={provider.notes || ''}
            onChange={e => updateProvider(provider.id, { notes: e.target.value })}
            placeholder="可选备注..."
            rows={2}
            className="w-full text-[10px] px-3 py-2 rounded-lg novo-input resize-none"
          />
        </div>

        {/* ── 操作栏 ── */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={syncBackend}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors"
            style={{ background: 'var(--novo-accent-primary-light)', color: 'var(--novo-accent-primary)' }}
          >
            <RefreshCw className="w-3 h-3" /> 同步到引擎
          </button>
          <button
            onClick={() => {
              if (confirm('确认删除该服务商配置？')) removeProvider(provider.id)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-[var(--novo-accent-danger-light)]"
            style={{ color: 'var(--novo-accent-danger)' }}
          >
            <Trash2 className="w-3 h-3" /> 移除服务商
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 降级链面板
// ════════════════════════════════════════════════════════════

function FallbackChainPanel() {
  const { providers, fallbackChain, reorderFallbackChain } = useProviderStore()
  const enabledProviders = providers.filter(p => p.enabled && p.apiKey)

  const moveUp = (idx: number) => {
    if (idx <= 0) return
    const arr = [...fallbackChain]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    reorderFallbackChain(arr)
  }

  const moveDown = (idx: number) => {
    if (idx >= fallbackChain.length - 1) return
    const arr = [...fallbackChain]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    reorderFallbackChain(arr)
  }

  if (enabledProviders.length < 2) {
    return (
      <div className="novo-card p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: '#EA580C' }} />
          <h3 className="text-xs font-bold" style={{ color: 'var(--novo-text-primary)' }}>降级链</h3>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)' }}>
            需启用 ≥2 个服务商
          </span>
        </div>
        <p className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>
          当一个 AI 服务失败时，系统按降级链顺序自动重试下一个服务商。
          请先启用并配置至少 2 个服务商的 API Key。
        </p>
      </div>
    )
  }

  return (
    <div className="novo-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4" style={{ color: '#EA580C' }} />
        <h3 className="text-xs font-bold" style={{ color: 'var(--novo-text-primary)' }}>降级链</h3>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(22,163,74,0.1)', color: 'var(--novo-accent-success)' }}>
          {enabledProviders.length} 个可用
        </span>
      </div>
      <p className="text-[9px]" style={{ color: 'var(--novo-text-muted)' }}>
        失败时按从上到下顺序自动重试。拖动调整优先级。
      </p>
      <div className="space-y-1">
        {fallbackChain.map((id, idx) => {
          const p = providers.find(pp => pp.id === id)
          if (!p) return null
          return (
            <div
              key={id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'var(--novo-bg-surface)' }}
            >
              <GripVertical className="w-3 h-3 cursor-move" style={{ color: 'var(--novo-text-disabled)' }} />
              <span className="text-sm">{p.icon}</span>
              <span className="text-[10px] font-semibold flex-1" style={{ color: 'var(--novo-text-primary)' }}>
                {p.name}
              </span>
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: p.enabled && p.apiKey ? 'var(--novo-accent-success)' : 'var(--novo-text-disabled)' }}
              />
              <div className="flex gap-0.5">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="text-[9px] px-1 py-0.5 rounded transition-colors disabled:opacity-30"
                  style={{ color: 'var(--novo-text-muted)' }}
                >
                  ↑
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === fallbackChain.length - 1}
                  className="text-[9px] px-1 py-0.5 rounded transition-colors disabled:opacity-30"
                  style={{ color: 'var(--novo-text-muted)' }}
                >
                  ↓
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 空状态
// ════════════════════════════════════════════════════════════

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'var(--novo-bg-surface)' }}
        >
          <Search className="w-7 h-7" style={{ color: 'var(--novo-text-disabled)' }} />
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--novo-text-muted)' }}>
          在左侧选择或添加模型服务以开始配置
        </p>
        <button
          onClick={onAdd}
          className="text-[11px] font-semibold px-4 py-2 rounded-xl transition-all"
          style={{ background: 'var(--novo-accent-primary)', color: 'white' }}
        >
          <Plus className="w-3.5 h-3.5 inline mr-1" />
          添加服务商
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 主组件
// ════════════════════════════════════════════════════════════

export default function ProviderSettingsPage() {
  const { providers, addProviderFromTemplate } = useProviderStore()
  const [selectedId, setSelectedId] = useState<string | null>(providers[0]?.id || null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showFallback, setShowFallback] = useState(false)

  const validSelectedId = providers.some(p => p.id === selectedId)
    ? selectedId
    : providers[0]?.id || null

  const selectedProvider = validSelectedId
    ? providers.find(p => p.id === validSelectedId) || null
    : null

  const handleAdd = useCallback((template: ProviderTemplate) => {
    const newP = addProviderFromTemplate(template)
    setSelectedId(newP.id)
  }, [addProviderFromTemplate])

  return (
    <div className="flex h-full">
      {/* ── 左侧面板 ── */}
      <div
        className="w-[200px] shrink-0 flex flex-col border-r"
        style={{ background: 'var(--novo-bg-base)', borderColor: 'var(--novo-border-default)' }}
      >
        <div className="px-3 pt-4 pb-2 flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--novo-text-disabled)' }}>
            服务商列表
          </span>
          <button
            onClick={() => setShowAddDialog(true)}
            className="p-1 rounded-lg transition-colors hover:bg-[var(--novo-bg-hover)]"
            style={{ color: 'var(--novo-text-muted)' }}
            title="添加服务商"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-3">
          {providers.map(p => (
            <ProviderListItem
              key={p.id}
              provider={p}
              isSelected={validSelectedId === p.id}
              onClick={() => setSelectedId(p.id)}
            />
          ))}
          {providers.length === 0 && (
            <button
              onClick={() => setShowAddDialog(true)}
              className="w-full flex flex-col items-center justify-center p-5 rounded-xl mt-2 transition-colors"
              style={{ border: '2px dashed var(--novo-border-default)', color: 'var(--novo-text-muted)' }}
            >
              <Plus className="w-5 h-5 mb-1" />
              <span className="text-[10px]">添加服务商</span>
            </button>
          )}
        </div>

        {/* 降级链入口 */}
        <div className="px-2 pb-3 border-t pt-2" style={{ borderColor: 'var(--novo-border-default)' }}>
          <button
            onClick={() => { setShowFallback(!showFallback); setSelectedId(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-medium transition-all"
            style={{
              background: showFallback ? 'rgba(234,88,12,0.08)' : 'transparent',
              color: showFallback ? '#EA580C' : 'var(--novo-text-muted)',
            }}
          >
            <Shield className="w-3.5 h-3.5" />
            降级链
            <ChevronDown
              className="w-3 h-3 ml-auto transition-transform"
              style={{ transform: showFallback ? 'rotate(180deg)' : 'none' }}
            />
          </button>
        </div>
      </div>

      {/* ── 右侧面板 ── */}
      <div className="flex-1 min-w-0 overflow-hidden" style={{ background: 'var(--novo-bg-elevated)' }}>
        {showFallback ? (
          <div className="p-6">
            <FallbackChainPanel />
          </div>
        ) : selectedProvider ? (
          <ProviderDetailPanel provider={selectedProvider} />
        ) : (
          <EmptyState onAdd={() => setShowAddDialog(true)} />
        )}
      </div>

      {/* 弹窗 */}
      {showAddDialog && (
        <AddProviderDialog
          onSelect={handleAdd}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  )
}
