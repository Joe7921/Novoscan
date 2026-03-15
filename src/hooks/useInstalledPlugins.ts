/**
 * 插件安装状态管理 Hook
 *
 * 使用 LocalStorage 持久化已安装插件的列表。
 * 在 Marketplace 卡片和详情页中显示「已安装」标记。
 *
 * @example
 * ```tsx
 * const { isInstalled, install, uninstall, installedIds } = useInstalledPlugins()
 *
 * // 检查某插件
 * if (isInstalled('patent-scout')) { ... }
 *
 * // 标记安装
 * install('github-trends')
 * ```
 */

'use client'

import { useState, useCallback, useEffect } from 'react'

/** LocalStorage key */
const STORAGE_KEY = 'novoscan_installed_plugins'

/** 安装记录 */
interface InstallRecord {
  id: string
  installedAt: string   // ISO 日期
  version: string
}

/**
 * 从 LocalStorage 安全读取已安装列表
 */
function readInstalled(): InstallRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * 安全写入 LocalStorage
 */
function writeInstalled(records: InstallRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // LocalStorage 可能满或被禁用，静默失败
  }
}

/**
 * useInstalledPlugins — 管理本地已安装插件状态
 */
export function useInstalledPlugins() {
  const [installed, setInstalled] = useState<InstallRecord[]>([])

  // 初始化：从 LocalStorage 加载
  useEffect(() => {
    setInstalled(readInstalled())
  }, [])

  /** 检查某插件是否已安装 */
  const isInstalled = useCallback(
    (pluginId: string): boolean => {
      return installed.some(r => r.id === pluginId)
    },
    [installed]
  )

  /** 标记插件为已安装 */
  const install = useCallback(
    (pluginId: string, version = '1.0.0') => {
      setInstalled(prev => {
        // 已存在则跳过
        if (prev.some(r => r.id === pluginId)) return prev
        const next = [
          ...prev,
          { id: pluginId, installedAt: new Date().toISOString(), version },
        ]
        writeInstalled(next)
        return next
      })
    },
    []
  )

  /** 取消安装标记 */
  const uninstall = useCallback(
    (pluginId: string) => {
      setInstalled(prev => {
        const next = prev.filter(r => r.id !== pluginId)
        writeInstalled(next)
        return next
      })
    },
    []
  )

  /** 获取安装记录 */
  const getInstallRecord = useCallback(
    (pluginId: string): InstallRecord | undefined => {
      return installed.find(r => r.id === pluginId)
    },
    [installed]
  )

  return {
    /** 已安装的 ID 列表 */
    installedIds: installed.map(r => r.id),
    /** 完整安装记录 */
    installedRecords: installed,
    /** 已安装数量 */
    installedCount: installed.length,
    /** 检查是否已安装 */
    isInstalled,
    /** 标记已安装 */
    install,
    /** 取消安装 */
    uninstall,
    /** 获取安装记录 */
    getInstallRecord,
  }
}
