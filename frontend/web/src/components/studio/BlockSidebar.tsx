/**
 * C2: BlockSidebar — 积木侧边栏
 *
 * 展示三类积木列表，支持拖拽到画布（通过 dnd-kit）。
 * 搜索框 + 分类折叠。
 */

import { useState, useMemo } from 'react'
import { Bot, MousePointerClick, FileText, Search, ChevronDown, GripVertical, X } from 'lucide-react'
import { useStudioStore } from '@/lib/studioStore'
import type { AnyBlockMeta, BlockType, AgentBlockMeta } from '@/types/blocks'
import { AGENT_ROLE_DEFINITIONS } from '@/types/blocks'

const TYPE_META: Record<BlockType, { label: string; icon: typeof Bot; color: string }> = {
  agent:       { label: 'Agent',    icon: Bot,               color: '#2563EB' },
  interaction: { label: '交互模式', icon: MousePointerClick, color: '#EA580C' },
  report:      { label: '报告插件', icon: FileText,          color: '#16A34A' },
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  intent:    { label: '意图分析', color: '#4338CA' },
  retrieval: { label: '信息检索', color: '#16A34A' },
  scoring:   { label: '评分评估', color: '#2563EB' },
  orchestration: { label: '编排控制', color: '#7C3AED' },
  transform: { label: '数据转换', color: '#0D9488' },
  custom:    { label: '自定义',   color: '#6B7280' },
}

function getCategoryMeta(cat: string) {
  return CATEGORY_LABELS[cat] || { label: cat || '未分类', color: '#6B7280' }
}

function getRoleLabel(roleType: string | undefined): { icon: string; label: string; color: string } | null {
  if (!roleType) return null
  const def = AGENT_ROLE_DEFINITIONS.find(r => r.type === roleType)
  return def ? { icon: def.icon, label: def.label, color: def.color } : null
}

export default function BlockSidebar() {
  const blocksResponse = useStudioStore(s => s.blocksResponse)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const filterFn = (list: AnyBlockMeta[]) => {
    const q = search.toLowerCase()
    return list.filter(b => !q || b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q) || b.description.toLowerCase().includes(q))
  }

  // Agent 按 category 分子组
  const agentGroups = useMemo(() => {
    if (!blocksResponse) return []
    const filtered = filterFn(blocksResponse.agents as AnyBlockMeta[])
    const grouped = new Map<string, AnyBlockMeta[]>()
    for (const agent of filtered) {
      const cat = agent.category || 'custom'
      if (!grouped.has(cat)) grouped.set(cat, [])
      grouped.get(cat)!.push(agent)
    }
    return Array.from(grouped.entries()).map(([cat, items]) => ({ cat, items }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocksResponse, search])

  // 交互/报告保持扁平
  const interactionItems = useMemo(() => blocksResponse ? filterFn(blocksResponse.interactions as AnyBlockMeta[]) : [], [blocksResponse, search])
  const reportItems = useMemo(() => blocksResponse ? filterFn(blocksResponse.reports as AnyBlockMeta[]) : [], [blocksResponse, search])

  const onDragStart = (e: React.DragEvent, block: AnyBlockMeta, blockType: BlockType) => {
    e.dataTransfer.setData('application/novoscan-block', JSON.stringify({
      id: block.id,
      blockType,
    }))
    e.dataTransfer.effectAllowed = 'move'
    // 拖拽时半透明反馈
    const el = e.currentTarget as HTMLElement
    el.style.opacity = '0.5'
    requestAnimationFrame(() => { el.style.opacity = '1' })
  }

  const toggle = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div
      className="w-56 shrink-0 flex flex-col h-full overflow-hidden border-r"
      style={{ background: 'var(--novo-bg-base)', borderColor: 'var(--novo-border-default)' }}
    >
      {/* 搜索框 */}
      <div className="p-3 border-b" style={{ borderColor: 'var(--novo-border-default)' }}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--novo-text-disabled)' }} />
          <input
            type="text"
            placeholder="搜索积木..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-2 rounded-lg text-xs outline-none"
            style={{
              background: 'var(--novo-bg-surface)',
              color: 'var(--novo-text-primary)',
              border: '1px solid var(--novo-border-default)',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--novo-bg-hover)]">
              <X className="w-3 h-3" style={{ color: 'var(--novo-text-disabled)' }} />
            </button>
          )}
        </div>
      </div>

      {/* 积木列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* ── Agent 积木（按 category 分组） ── */}
        <div>
          <button
            onClick={() => toggle('agent')}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors hover:bg-[var(--novo-bg-hover)]"
            style={{ color: '#2563EB' }}
          >
            <Bot className="w-3.5 h-3.5" />
            Agent
            <span className="text-[9px] font-normal ml-auto" style={{ color: 'var(--novo-text-muted)' }}>
              {agentGroups.reduce((sum, g) => sum + g.items.length, 0)}
            </span>
            <ChevronDown
              className="w-3 h-3 transition-transform"
              style={{ transform: collapsed['agent'] ? 'rotate(-90deg)' : 'none', color: 'var(--novo-text-disabled)' }}
            />
          </button>

          {!collapsed['agent'] && (
            <div className="ml-2 space-y-0.5 mt-0.5">
              {agentGroups.map(({ cat, items }) => {
                const catMeta = getCategoryMeta(cat)
                const catKey = `agent-${cat}`
                return (
                  <div key={catKey}>
                    {/* 子分组标题 */}
                    <button
                      onClick={() => toggle(catKey)}
                      className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold transition-colors hover:bg-[var(--novo-bg-hover)]"
                      style={{ color: catMeta.color }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: catMeta.color }} />
                      {catMeta.label}
                      <span className="text-[8px] font-normal ml-auto" style={{ color: 'var(--novo-text-disabled)' }}>
                        {items.length}
                      </span>
                      <ChevronDown
                        className="w-2.5 h-2.5 transition-transform"
                        style={{ transform: collapsed[catKey] ? 'rotate(-90deg)' : 'none', color: 'var(--novo-text-disabled)' }}
                      />
                    </button>

                    {!collapsed[catKey] && (
                      <div className="space-y-0.5 mt-0.5">
                        {items.map(block => {
                          const role = getRoleLabel((block as AgentBlockMeta).role_type || undefined)
                          return (
                            <div
                              key={block.id}
                              draggable
                              onDragStart={e => onDragStart(e, block, 'agent')}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab text-[10px] transition-colors hover:bg-[var(--novo-bg-hover)] active:cursor-grabbing"
                              title={block.notes ? `💡 ${block.notes}\n\n${block.description}` : block.description}
                            >
                              <GripVertical className="w-3 h-3 shrink-0" style={{ color: 'var(--novo-text-disabled)' }} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium truncate" style={{ color: 'var(--novo-text-primary)' }}>
                                    {block.name}
                                  </span>
                                  {role && (
                                    <span
                                      className="shrink-0 text-[7px] px-1 py-0 rounded"
                                      style={{ background: `${role.color}15`, color: role.color }}
                                    >
                                      {role.icon}{role.label}
                                    </span>
                                  )}
                                </div>
                                <div className="truncate" style={{ color: 'var(--novo-text-muted)', fontSize: '9px' }}>
                                  {block.id}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
              {agentGroups.length === 0 && (
                <div className="text-[9px] px-2 py-2 text-center" style={{ color: 'var(--novo-text-disabled)' }}>
                  无匹配项
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 交互积木 ── */}
        <SectionGroup
          type="interaction"
          items={interactionItems}
          collapsed={!!collapsed['interaction']}
          onToggle={() => toggle('interaction')}
          onDragStart={onDragStart}
        />

        {/* ── 报告积木 ── */}
        <SectionGroup
          type="report"
          items={reportItems}
          collapsed={!!collapsed['report']}
          onToggle={() => toggle('report')}
          onDragStart={onDragStart}
        />
      </div>
    </div>
  )
}

// 交互/报告的简单折叠组
function SectionGroup({
  type, items, collapsed, onToggle, onDragStart,
}: {
  type: BlockType
  items: AnyBlockMeta[]
  collapsed: boolean
  onToggle: () => void
  onDragStart: (e: React.DragEvent, block: AnyBlockMeta, blockType: BlockType) => void
}) {
  const meta = TYPE_META[type]
  const Icon = meta.icon
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors hover:bg-[var(--novo-bg-hover)]"
        style={{ color: meta.color }}
      >
        <Icon className="w-3.5 h-3.5" />
        {meta.label}
        <span className="text-[9px] font-normal ml-auto" style={{ color: 'var(--novo-text-muted)' }}>
          {items.length}
        </span>
        <ChevronDown
          className="w-3 h-3 transition-transform"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', color: 'var(--novo-text-disabled)' }}
        />
      </button>
      {!collapsed && (
        <div className="space-y-0.5 mt-0.5">
          {items.map(block => (
            <div
              key={block.id}
              draggable
              onDragStart={e => onDragStart(e, block, type)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab text-[10px] transition-colors hover:bg-[var(--novo-bg-hover)] active:cursor-grabbing"
              title={block.notes ? `💡 ${block.notes}\n\n${block.description}` : block.description}
            >
              <GripVertical className="w-3 h-3 shrink-0" style={{ color: 'var(--novo-text-disabled)' }} />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate" style={{ color: 'var(--novo-text-primary)' }}>
                  {block.name}
                </div>
                <div className="truncate" style={{ color: 'var(--novo-text-muted)', fontSize: '9px' }}>
                  {block.id}
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-[9px] px-2 py-2 text-center" style={{ color: 'var(--novo-text-disabled)' }}>
              无匹配项
            </div>
          )}
        </div>
      )}
    </div>
  )
}
