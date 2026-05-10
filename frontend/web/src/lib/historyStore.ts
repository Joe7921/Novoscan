/**
 * 历史记录本地存储
 *
 * 使用 localStorage 持久化每次分析完成的报告。
 * 单条约 10-50KB，localStorage 5MB 限制约可存 100+ 条。
 * 超出容量时自动淘汰最早记录。
 */

import type { FinalReport } from '@/types/report'

const STORAGE_KEY = 'novoscan:history'
const MAX_RECORDS = 100

export interface HistoryRecord {
  id: string
  createdAt: string
  userInput: string
  detectionType: string
  mode: 'standard' | 'agentic'
  score: number | null
  noveltyLevel: string | null
  report: FinalReport | null
  /** Agentic 模式的最终文本输出 */
  agenticOutput: string | null
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function loadRecords(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as HistoryRecord[]
    return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch {
    return []
  }
}

export function saveRecord(
  params: Omit<HistoryRecord, 'id' | 'createdAt'>
): HistoryRecord {
  const record: HistoryRecord = {
    ...params,
    id: generateId(),
    createdAt: new Date().toISOString(),
  }

  const records = loadRecords()
  records.unshift(record)

  // 超出限制时淘汰最早记录
  while (records.length > MAX_RECORDS) {
    records.pop()
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // 容量不足，删除最早一半后重试
    const half = records.slice(0, Math.floor(records.length / 2))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(half))
    } catch {
      // 彻底写不下，静默失败
    }
  }

  return record
}

export function deleteRecord(id: string): void {
  const records = loadRecords().filter(r => r.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch { /* ignore */ }
}

export function clearAll(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}
