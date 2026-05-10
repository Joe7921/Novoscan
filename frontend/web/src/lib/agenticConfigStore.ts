/**
 * Phase T2: Agentic 配置状态管理 — Zustand Store
 *
 * 管理 Orchestrator 的 Tool 列表、System Prompt、模型参数、Prompt 版本历史。
 */

import { create } from 'zustand'
import {
  fetchAgenticConfig,
  updateAgenticConfig,
  type AgenticConfig,
  type AgenticToolConfig,
  type AgenticConfigUpdate,
} from './api'

interface PromptVersion {
  timestamp: string
  content: string
  length: number
}

interface AgenticConfigState {
  // 状态
  config: AgenticConfig | null
  loading: boolean
  error: string | null
  dirty: boolean
  lastSyncAt: number | null

  // 本地编辑缓冲
  localPrompt: string
  localTemperature: number
  localMaxIterations: number
  localTools: AgenticToolConfig[]

  // Prompt 版本历史
  promptVersions: PromptVersion[]

  // Actions
  fetchConfig: () => Promise<void>

  // 本地编辑（不立即同步后端）
  setLocalPrompt: (prompt: string) => void
  setLocalTemperature: (temp: number) => void
  setLocalMaxIterations: (iter: number) => void
  toggleTool: (toolId: string) => void
  setToolEnabled: (toolId: string, enabled: boolean) => void
  setAllToolsEnabled: (enabled: boolean) => void

  // 同步到后端
  syncToBackend: () => Promise<boolean>

  // Prompt 版本
  savePromptVersion: () => void
  restorePromptVersion: (index: number) => void
}

export const useAgenticConfigStore = create<AgenticConfigState>((set, get) => ({
  config: null,
  loading: false,
  error: null,
  dirty: false,
  lastSyncAt: null,
  localPrompt: '',
  localTemperature: 0.3,
  localMaxIterations: 25,
  localTools: [],
  promptVersions: [],

  fetchConfig: async () => {
    set({ loading: true, error: null })
    try {
      const config = await fetchAgenticConfig()
      set({
        config,
        loading: false,
        localPrompt: config.system_prompt || '',
        localTemperature: config.model?.temperature ?? 0.3,
        localMaxIterations: config.model?.max_iterations ?? 25,
        localTools: config.tools || [],
        promptVersions: config.prompt_history || [],
        dirty: false,
        lastSyncAt: Date.now(),
      })
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  setLocalPrompt: (prompt) => set({ localPrompt: prompt, dirty: true }),
  setLocalTemperature: (temp) => set({ localTemperature: temp, dirty: true }),
  setLocalMaxIterations: (iter) => set({ localMaxIterations: iter, dirty: true }),

  toggleTool: (toolId) => {
    set(s => ({
      localTools: s.localTools.map(t =>
        t.id === toolId ? { ...t, enabled: !t.enabled } : t
      ),
      dirty: true,
    }))
  },

  setToolEnabled: (toolId, enabled) => {
    set(s => ({
      localTools: s.localTools.map(t =>
        t.id === toolId ? { ...t, enabled } : t
      ),
      dirty: true,
    }))
  },

  setAllToolsEnabled: (enabled) => {
    set(s => ({
      localTools: s.localTools.map(t => ({ ...t, enabled })),
      dirty: true,
    }))
  },

  syncToBackend: async () => {
    const { config, localPrompt, localTemperature, localMaxIterations, localTools } = get()
    if (!config) return false

    const payload: AgenticConfigUpdate = {}

    if (localPrompt !== config.system_prompt) {
      payload.system_prompt = localPrompt
    }
    if (localTemperature !== config.model?.temperature || localMaxIterations !== config.model?.max_iterations) {
      payload.model = { temperature: localTemperature, max_iterations: localMaxIterations }
    }

    const toolChanges = localTools.filter((lt, i) => {
      const ct = config.tools[i]
      return ct && lt.enabled !== ct.enabled
    })
    if (toolChanges.length > 0) {
      payload.tools = localTools.map(t => ({ id: t.id, enabled: t.enabled }))
    }

    // 无变更
    if (Object.keys(payload).length === 0) {
      set({ dirty: false })
      return true
    }

    try {
      const result = await updateAgenticConfig(payload)
      if (result.status === 'ok') {
        // 刷新配置
        await get().fetchConfig()
        return result.reload_ok
      }
      return false
    } catch (err) {
      set({ error: (err as Error).message })
      return false
    }
  },

  savePromptVersion: () => {
    set(s => ({
      promptVersions: [
        ...s.promptVersions,
        { timestamp: new Date().toISOString(), content: s.localPrompt, length: s.localPrompt.length },
      ].slice(-20),
    }))
  },

  restorePromptVersion: (index) => {
    const { promptVersions } = get()
    if (promptVersions[index]) {
      set({ localPrompt: promptVersions[index].content, dirty: true })
    }
  },
}))
