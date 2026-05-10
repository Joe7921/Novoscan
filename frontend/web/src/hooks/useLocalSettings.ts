/**
 * 本地持久化设置 Hook
 *
 * 使用 localStorage 存储用户偏好，支持默认值和类型安全。
 */

import { useState, useCallback } from 'react'

const STORAGE_PREFIX = 'novoscan:'

export interface NovoSettings {
  /** 是否已完成新手引导 */
  onboardingDone: boolean
  /** 用户偏好的检测类型 */
  defaultDetectionType: string
  /** 用户偏好的模式 */
  defaultMode: 'standard' | 'agentic'
  /** 最近一次分析的时间戳 */
  lastAnalysisAt: string | null
}

const DEFAULTS: NovoSettings = {
  onboardingDone: false,
  defaultDetectionType: 'auto',
  defaultMode: 'standard',
  lastAnalysisAt: null,
}

function readStorage(): NovoSettings {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}settings`)
    if (raw) {
      return { ...DEFAULTS, ...JSON.parse(raw) }
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

function writeStorage(settings: NovoSettings): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}settings`, JSON.stringify(settings))
  } catch { /* quota exceeded or private mode */ }
}

export function useLocalSettings() {
  const [settings, setSettingsState] = useState<NovoSettings>(readStorage)

  const updateSettings = useCallback((patch: Partial<NovoSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch }
      writeStorage(next)
      return next
    })
  }, [])

  const resetSettings = useCallback(() => {
    writeStorage(DEFAULTS)
    setSettingsState({ ...DEFAULTS })
  }, [])

  return { settings, updateSettings, resetSettings }
}
