import { useState, useMemo, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Filter,
  ArrowUpDown,
  FileSearch,
  BookMarked,
  Loader2,
} from 'lucide-react'
import type { ReportEvidenceItem } from '@/types/report'
import { generateCitationStream } from '@/lib/api'
import { consumeSSE } from '@/lib/sse'
import EvidenceCard from './EvidenceCard'

type SortKey = 'relevance' | 'year' | 'stance'
type FilterDimension = '全部' | string
type FilterStance = '全部' | '支持' | '反对' | '中性'
type FilterSourceType = '全部' | string

interface EvidencePanelProps {
  items: ReportEvidenceItem[]
  topic?: string
}

export default function EvidencePanel({ items, topic = '' }: EvidencePanelProps) {
  const [sortKey, setSortKey] = useState<SortKey>('relevance')
  const [filterDimension, setFilterDimension] = useState<FilterDimension>('全部')
  const [filterStance, setFilterStance] = useState<FilterStance>('全部')
  const [filterSourceType, setFilterSourceType] = useState<FilterSourceType>('全部')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [citationText, setCitationText] = useState('')
  const [citationLoading, setCitationLoading] = useState(false)
  const [userMarks, setUserMarks] = useState<Map<string, 'useful' | 'useless' | 'uncertain'>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  const dimensions = useMemo(() => {
    const set = new Set(items.map(i => i.dimension))
    return ['全部', ...Array.from(set)]
  }, [items])

  const sourceTypes = useMemo(() => {
    const set = new Set(items.map(i => i.sourceType))
    return ['全部', ...Array.from(set)]
  }, [items])

  const filtered = useMemo(() => {
    let list = [...items]
    if (filterDimension !== '全部') list = list.filter(i => i.dimension === filterDimension)
    if (filterStance !== '全部') list = list.filter(i => i.stance === filterStance)
    if (filterSourceType !== '全部') list = list.filter(i => i.sourceType === filterSourceType)

    if (sortKey === 'relevance') list.sort((a, b) => b.relevanceScore - a.relevanceScore)
    else if (sortKey === 'year') list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    else if (sortKey === 'stance') {
      const order: Record<string, number> = { '支持': 0, '反对': 1, '中性': 2 }
      list.sort((a, b) => (order[a.stance] ?? 3) - (order[b.stance] ?? 3))
    }
    return list
  }, [items, filterDimension, filterStance, filterSourceType, sortKey])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleUserMark = useCallback((id: string, mark: 'useful' | 'useless' | 'uncertain' | null) => {
    setUserMarks(prev => {
      const next = new Map(prev)
      if (mark === null) next.delete(id)
      else next.set(id, mark)
      return next
    })
  }, [])

  const handleGenerateCitation = useCallback(async () => {
    const selected = items.filter(i => selectedIds.has(i.id))
    if (selected.length === 0) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setCitationLoading(true)
    setCitationText('')

    try {
      const res = await generateCitationStream({
        evidence_items: selected as unknown as Record<string, unknown>[],
        topic,
      }, ac.signal)

      if (!res.ok) {
        setCitationText(`生成失败: HTTP ${res.status}`)
        setCitationLoading(false)
        return
      }

      await consumeSSE(res, (evt) => {
        if (evt.event === 'citation_token') {
          setCitationText(prev => prev + (evt.data.token as string))
        }
      }, (err) => {
        setCitationText(prev => prev + `\n\n[错误: ${err.message}]`)
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setCitationText(`生成失败: ${(err as Error).message}`)
      }
    } finally {
      setCitationLoading(false)
    }
  }, [items, selectedIds, topic])

  if (items.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSearch className="w-4 h-4" style={{ color: 'var(--novo-accent-primary)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>
            证据面板
          </h3>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-mono"
            style={{ background: 'var(--novo-accent-primary-light)', color: 'var(--novo-accent-primary)' }}
          >
            {items.length} 条
          </span>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleGenerateCitation}
            disabled={citationLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{
              background: 'var(--novo-accent-primary)',
              color: 'white',
              opacity: citationLoading ? 0.6 : 1,
            }}
          >
            {citationLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <BookMarked className="w-3 h-3" />
            )}
            生成引用段落 ({selectedIds.size})
          </button>
        )}
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5" style={{ color: 'var(--novo-text-muted)' }} />

        {/* 维度筛选 */}
        <select
          value={filterDimension}
          onChange={e => setFilterDimension(e.target.value)}
          className="text-[11px] px-2 py-1 rounded-lg border bg-transparent"
          style={{ borderColor: 'var(--novo-border-default)', color: 'var(--novo-text-secondary)' }}
        >
          {dimensions.map(d => <option key={d} value={d}>{d === '全部' ? '全部维度' : d}</option>)}
        </select>

        {/* 立场筛选 */}
        <select
          value={filterStance}
          onChange={e => setFilterStance(e.target.value as FilterStance)}
          className="text-[11px] px-2 py-1 rounded-lg border bg-transparent"
          style={{ borderColor: 'var(--novo-border-default)', color: 'var(--novo-text-secondary)' }}
        >
          <option value="全部">全部立场</option>
          <option value="支持">支持</option>
          <option value="反对">反对</option>
          <option value="中性">中性</option>
        </select>

        {/* 来源类型筛选 */}
        <select
          value={filterSourceType}
          onChange={e => setFilterSourceType(e.target.value)}
          className="text-[11px] px-2 py-1 rounded-lg border bg-transparent"
          style={{ borderColor: 'var(--novo-border-default)', color: 'var(--novo-text-secondary)' }}
        >
          {sourceTypes.map(t => <option key={t} value={t}>{t === '全部' ? '全部类型' : t}</option>)}
        </select>

        {/* 排序 */}
        <div className="flex items-center gap-1 ml-auto">
          <ArrowUpDown className="w-3 h-3" style={{ color: 'var(--novo-text-muted)' }} />
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-[11px] px-2 py-1 rounded-lg border bg-transparent"
            style={{ borderColor: 'var(--novo-border-default)', color: 'var(--novo-text-secondary)' }}
          >
            <option value="relevance">相关性</option>
            <option value="year">年份</option>
            <option value="stance">立场</option>
          </select>
        </div>
      </div>

      {/* 证据列表 */}
      <div className="space-y-2">
        {filtered.map(item => (
          <EvidenceCard
            key={item.id}
            item={item}
            selected={selectedIds.has(item.id)}
            onToggleSelect={toggleSelect}
            userMark={userMarks.get(item.id) ?? null}
            onUserMark={handleUserMark}
            allItems={items}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-6 text-xs" style={{ color: 'var(--novo-text-muted)' }}>
            无匹配证据
          </div>
        )}
      </div>

      {/* 引用段落输出 */}
      {citationText && (
        <div className="novo-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookMarked className="w-4 h-4" style={{ color: 'var(--novo-accent-info)' }} />
            <h4 className="text-xs font-bold" style={{ color: 'var(--novo-text-primary)' }}>
              生成的引用段落
            </h4>
          </div>
          <div
            className="text-xs whitespace-pre-wrap leading-relaxed"
            style={{ color: 'var(--novo-text-secondary)' }}
          >
            {citationText}
            {citationLoading && (
              <span
                className="inline-block w-1.5 h-3 ml-0.5 animate-pulse"
                style={{ background: 'var(--novo-accent-primary)' }}
              />
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
