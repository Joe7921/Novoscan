/**
 * AI Provider 状态管理 — Zustand + localStorage 持久化
 *
 * 对标 CherryStudio 的多 Provider 架构：
 * - 多 Provider 并存，各自独立配置
 * - 降级链自动重试（失败时按序切换）
 * - 默认 Provider / 默认 Model
 */

import { create } from 'zustand'
import type { AIProvider, ModelConfig, ProviderSettings, ProviderTemplate } from '@/types/provider'
import { EMPTY_PROVIDER_SETTINGS } from '@/types/provider'
import { updateModelConfig } from '@/lib/api'

const STORAGE_KEY = 'novoscan_providers'

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function loadFromStorage(): ProviderSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as ProviderSettings
      if (parsed && Array.isArray(parsed.providers)) return parsed
    }
  } catch { /* ignore */ }
  return EMPTY_PROVIDER_SETTINGS
}

function saveToStorage(state: ProviderSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

/**
 * 将当前激活 Provider 同步到后端 .env 热更新接口
 * 降级链中第二个可用 Provider 同步为 fallback
 */
function syncToBackend(state: ProviderSettings) {
  const { providers, defaultProviderId, defaultModelId, fallbackChain } = state

  // 找 primary
  let primary: AIProvider | undefined
  if (defaultProviderId) {
    primary = providers.find(p => p.id === defaultProviderId && p.enabled && p.apiKey)
  }
  if (!primary) {
    primary = providers.find(p => p.enabled && p.apiKey)
  }
  if (!primary) return

  const primaryModel = defaultModelId
    ? primary.models.find(m => m.id === defaultModelId)?.id || primary.models[0]?.id || ''
    : primary.models[0]?.id || ''

  // 找 fallback（降级链中第一个不是 primary 的可用 Provider）
  let fallback: AIProvider | undefined
  for (const fid of fallbackChain) {
    if (fid === primary.id) continue
    const fp = providers.find(p => p.id === fid && p.enabled && p.apiKey)
    if (fp) { fallback = fp; break }
  }

  const payload: Record<string, unknown> = {
    llm_api_key: primary.apiKey,
    llm_base_url: primary.baseUrl,
    llm_model_name: primaryModel,
  }

  if (fallback) {
    payload.fallback_api_key = fallback.apiKey
    payload.fallback_base_url = fallback.baseUrl
    payload.fallback_model_name = fallback.models[0]?.id || ''
  }

  updateModelConfig(payload as Parameters<typeof updateModelConfig>[0]).catch(err => {
    console.warn('[ProviderStore] 后端同步失败:', err)
  })
}

// ── Store 类型 ──

interface ProviderStoreState extends ProviderSettings {
  // ── 查询 ──
  getActiveProvider: () => AIProvider | null
  getActiveModel: () => ModelConfig | null
  getProvider: (id: string) => AIProvider | null

  // ── Provider CRUD ──
  addProviderFromTemplate: (template: ProviderTemplate) => AIProvider
  updateProvider: (id: string, data: Partial<AIProvider>) => void
  removeProvider: (id: string) => void
  toggleProvider: (id: string) => void
  setDefaultProvider: (id: string) => void
  setDefaultModel: (modelId: string) => void

  // ── 模型管理 ──
  addModel: (providerId: string, model: ModelConfig) => void
  removeModel: (providerId: string, modelId: string) => void

  // ── 降级链 ──
  reorderFallbackChain: (ids: string[]) => void

  // ── 手动触发后端同步 ──
  syncBackend: () => void
}

export const useProviderStore = create<ProviderStoreState>()((set, get) => {
  const initial = loadFromStorage()

  const persist = () => {
    const { providers, defaultProviderId, defaultModelId, fallbackChain } = get()
    saveToStorage({ providers, defaultProviderId, defaultModelId, fallbackChain })
  }

  return {
    ...initial,

    // ── 查询 ──

    getActiveProvider: () => {
      const { providers, defaultProviderId } = get()
      if (defaultProviderId) {
        const p = providers.find(p => p.id === defaultProviderId && p.enabled)
        if (p) return p
      }
      return providers.find(p => p.enabled && p.apiKey) || null
    },

    getActiveModel: () => {
      const provider = get().getActiveProvider()
      if (!provider) return null
      const { defaultModelId } = get()
      if (defaultModelId) {
        const m = provider.models.find(m => m.id === defaultModelId)
        if (m) return m
      }
      return provider.models[0] || null
    },

    getProvider: (id: string) => {
      return get().providers.find(p => p.id === id) || null
    },

    // ── Provider CRUD ──

    addProviderFromTemplate: (template: ProviderTemplate) => {
      const { providers } = get()
      const isFirst = providers.length === 0
      const newProvider: AIProvider = {
        id: genId(),
        type: template.type,
        name: template.name,
        apiKey: '',
        baseUrl: template.defaultBaseUrl,
        models: [...template.defaultModels],
        enabled: false,
        isDefault: isFirst,
        icon: template.icon,
        notes: '',
        createdAt: new Date().toISOString(),
      }
      set(state => ({
        providers: [...state.providers, newProvider],
        defaultProviderId: isFirst ? newProvider.id : state.defaultProviderId,
        defaultModelId: isFirst && newProvider.models.length > 0
          ? newProvider.models[0].id
          : state.defaultModelId,
        fallbackChain: [...state.fallbackChain, newProvider.id],
      }))
      persist()
      return newProvider
    },

    updateProvider: (id: string, data: Partial<AIProvider>) => {
      set(state => ({
        providers: state.providers.map(p =>
          p.id === id ? { ...p, ...data } : p
        ),
      }))
      persist()
    },

    removeProvider: (id: string) => {
      set(state => ({
        providers: state.providers.filter(p => p.id !== id),
        defaultProviderId: state.defaultProviderId === id ? null : state.defaultProviderId,
        fallbackChain: state.fallbackChain.filter(fid => fid !== id),
      }))
      persist()
    },

    toggleProvider: (id: string) => {
      set(state => ({
        providers: state.providers.map(p =>
          p.id === id ? { ...p, enabled: !p.enabled } : p
        ),
      }))
      persist()
    },

    setDefaultProvider: (id: string) => {
      set(state => ({
        defaultProviderId: id,
        providers: state.providers.map(p => ({
          ...p,
          isDefault: p.id === id,
        })),
      }))
      persist()
    },

    setDefaultModel: (modelId: string) => {
      set({ defaultModelId: modelId })
      persist()
    },

    // ── 模型管理 ──

    addModel: (providerId: string, model: ModelConfig) => {
      set(state => ({
        providers: state.providers.map(p =>
          p.id === providerId
            ? { ...p, models: [...p.models, model] }
            : p
        ),
      }))
      persist()
    },

    removeModel: (providerId: string, modelId: string) => {
      set(state => ({
        providers: state.providers.map(p =>
          p.id === providerId
            ? { ...p, models: p.models.filter(m => m.id !== modelId) }
            : p
        ),
      }))
      persist()
    },

    // ── 降级链 ──

    reorderFallbackChain: (ids: string[]) => {
      set({ fallbackChain: ids })
      persist()
    },

    // ── 手动后端同步 ──

    syncBackend: () => {
      const { providers, defaultProviderId, defaultModelId, fallbackChain } = get()
      syncToBackend({ providers, defaultProviderId, defaultModelId, fallbackChain })
    },
  }
})
