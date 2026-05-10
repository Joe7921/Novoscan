import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Blocks,
  Bot,
  MousePointerClick,
  FileText,
  ChevronRight,
  Loader2,
  AlertCircle,
  Package,
  Tag,
  Download,
  ArrowRight,
} from 'lucide-react'
import { fetchBlocks, getBlockExportUrl } from '@/lib/api'
import type { BlocksResponse, AnyBlockMeta, AgentBlockMeta } from '@/types/blocks'
import { AGENT_ROLE_DEFINITIONS } from '@/types/blocks'

type BlockType = 'agents' | 'interactions' | 'reports'

const TABS: { key: BlockType; label: string; icon: typeof Bot; color: string }[] = [
  { key: 'agents',       label: 'Agent 组件',  icon: Bot,               color: 'var(--novo-accent-primary)' },
  { key: 'interactions',  label: '交互组件',    icon: MousePointerClick, color: 'var(--novo-accent-warning)' },
  { key: 'reports',       label: '报告组件',    icon: FileText,          color: 'var(--novo-accent-success)' },
]

function categoryColor(cat: string): string {
  switch (cat) {
    case 'core': return 'var(--novo-accent-primary)'
    case 'scoring': return '#2563EB'
    case 'retrieval': return '#16A34A'
    case 'intent': return '#4338CA'
    case 'search': return 'var(--novo-accent-success)'
    default: return 'var(--novo-text-muted)'
  }
}

const CATEGORY_ORDER = ['intent', 'retrieval', 'scoring', 'transform', 'custom']
const CATEGORY_LABELS: Record<string, string> = {
  intent: '意图分析', retrieval: '信息检索', scoring: '评分评估', transform: '数据转换', custom: '自定义',
}

function getRoleTag(roleType: string | undefined) {
  if (!roleType) return null
  const def = AGENT_ROLE_DEFINITIONS.find(r => r.type === roleType)
  return def ? { icon: def.icon, label: def.label, color: def.color } : null
}

function groupByCategory(agents: AnyBlockMeta[]): { cat: string; label: string; items: AnyBlockMeta[] }[] {
  const map = new Map<string, AnyBlockMeta[]>()
  for (const a of agents) {
    const c = a.category || 'custom'
    if (!map.has(c)) map.set(c, [])
    map.get(c)!.push(a)
  }
  const result: { cat: string; label: string; items: AnyBlockMeta[] }[] = []
  for (const cat of CATEGORY_ORDER) {
    if (map.has(cat)) {
      result.push({ cat, label: CATEGORY_LABELS[cat] || cat, items: map.get(cat)! })
      map.delete(cat)
    }
  }
  for (const [cat, items] of map) {
    result.push({ cat, label: CATEGORY_LABELS[cat] || cat, items })
  }
  return result
}

export default function BlocksPage() {
  const [data, setData] = useState<BlocksResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<BlockType>('agents')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchBlocks()
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const blocks: AnyBlockMeta[] = data ? data[activeTab] as AnyBlockMeta[] : []

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--novo-accent-primary)' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="novo-card p-5 max-w-sm text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--novo-accent-danger)' }} />
          <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--novo-accent-danger)' }}>加载失败</h3>
          <p className="text-xs" style={{ color: 'var(--novo-text-muted)' }}>{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchBlocks().then(d => { setData(d); setLoading(false) }).catch(e => { setError(e.message); setLoading(false) }) }}
            className="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: 'var(--novo-accent-primary)', color: 'white' }}
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* 标题 */}
      <div className="flex items-center gap-2.5 mb-6">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--novo-accent-primary-light)' }}
        >
          <Blocks className="w-5 h-5" style={{ color: 'var(--novo-accent-primary)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--novo-text-primary)' }}>组件仓库</h1>
          <p className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>
            共 {data?.total ?? 0} 个已注册组件 — Agent · 交互模式 · 报告插件
          </p>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1.5 p-1 rounded-xl mb-6" style={{ background: 'var(--novo-bg-surface)' }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          const count = data ? data[tab.key].length : 0
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: active ? 'var(--novo-bg-elevated)' : 'transparent',
                color: active ? tab.color : 'var(--novo-text-muted)',
                boxShadow: active ? 'var(--novo-shadow-sm)' : 'none',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: active ? `color-mix(in srgb, ${tab.color} 12%, transparent)` : 'var(--novo-bg-active)',
                  color: active ? tab.color : 'var(--novo-text-disabled)',
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 积木列表 */}
      {blocks.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--novo-text-disabled)' }} />
          <p className="text-sm" style={{ color: 'var(--novo-text-muted)' }}>此分类暂无组件</p>
        </div>
      ) : activeTab === 'agents' ? (
        /* Agent 按 category 分组 */
        <div className="space-y-5">
          {groupByCategory(blocks).map(({ cat, label, items }) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: categoryColor(cat) }} />
                <span className="text-xs font-bold" style={{ color: categoryColor(cat) }}>{label}</span>
                <span className="text-[9px]" style={{ color: 'var(--novo-text-disabled)' }}>{items.length}</span>
                <div className="flex-1 h-px ml-2" style={{ background: 'var(--novo-border-default)' }} />
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {items.map((block, i) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      index={i}
                      activeTab={activeTab}
                      expandedId={expandedId}
                      setExpandedId={setExpandedId}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {blocks.map((block, i) => (
              <BlockCard
                key={block.id}
                block={block}
                index={i}
                activeTab={activeTab}
                expandedId={expandedId}
                setExpandedId={setExpandedId}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function BlockCard({ block, index, activeTab, expandedId, setExpandedId }: {
  block: AnyBlockMeta; index: number; activeTab: BlockType; expandedId: string | null; setExpandedId: (fn: (prev: string | null) => string | null) => void
}) {
  const roleTag = activeTab === 'agents' ? getRoleTag((block as AgentBlockMeta).role_type || undefined) : null

  return (
    <motion.div
      key={block.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="novo-card overflow-hidden"
    >
      <button
        onClick={() => setExpandedId(prev => prev === block.id ? null : block.id)}
        className="w-full flex items-center gap-3 p-4 text-left transition-all hover:bg-[var(--novo-bg-hover)]"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${categoryColor(block.category)} 10%, transparent)` }}
        >
          {activeTab === 'agents' && <Bot className="w-4 h-4" style={{ color: categoryColor(block.category) }} />}
          {activeTab === 'interactions' && <MousePointerClick className="w-4 h-4" style={{ color: categoryColor(block.category) }} />}
          {activeTab === 'reports' && <FileText className="w-4 h-4" style={{ color: categoryColor(block.category) }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold" style={{ color: 'var(--novo-text-primary)' }}>
              {block.name}
            </span>
            <span
              className="text-[8px] px-1.5 py-0.5 rounded-full"
              style={{ background: `color-mix(in srgb, ${categoryColor(block.category)} 10%, transparent)`, color: categoryColor(block.category) }}
            >
              {block.category}
            </span>
            {roleTag && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{ background: `${roleTag.color}12`, color: roleTag.color }}
              >
                {roleTag.icon} {roleTag.label}
              </span>
            )}
          </div>
          <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--novo-text-muted)' }}>
            {block.description || '暂无描述'}
          </p>
        </div>
        <ChevronRight
          className="w-3.5 h-3.5 shrink-0 transition-transform"
          style={{
            color: 'var(--novo-text-disabled)',
            transform: expandedId === block.id ? 'rotate(90deg)' : 'none',
          }}
        />
      </button>

      {/* 展开详情 */}
      <AnimatePresence>
        {expandedId === block.id && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-0 grid grid-cols-2 gap-x-6 gap-y-2 text-[10px]"
              style={{ borderTop: '1px solid var(--novo-border-default)' }}
            >
              <div className="pt-3">
                <span style={{ color: 'var(--novo-text-muted)' }}>ID</span>
                <div className="font-mono font-medium mt-0.5" style={{ color: 'var(--novo-text-primary)' }}>{block.id}</div>
              </div>
              <div className="pt-3">
                <span style={{ color: 'var(--novo-text-muted)' }}>版本</span>
                <div className="font-medium mt-0.5" style={{ color: 'var(--novo-text-primary)' }}>{block.version || '—'}</div>
              </div>
              <div>
                <span style={{ color: 'var(--novo-text-muted)' }}>来源</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <Tag className="w-2.5 h-2.5" style={{ color: 'var(--novo-text-disabled)' }} />
                  <span className="font-medium" style={{ color: 'var(--novo-text-primary)' }}>
                    {(block.source ?? 'builtin') === 'builtin' ? '内置' : block.source}
                  </span>
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--novo-text-muted)' }}>分类</span>
                <div className="font-medium mt-0.5" style={{ color: categoryColor(block.category) }}>{block.category}</div>
              </div>
              {roleTag && (
                <div>
                  <span style={{ color: 'var(--novo-text-muted)' }}>角色</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span>{roleTag.icon}</span>
                    <span className="font-medium" style={{ color: roleTag.color }}>{roleTag.label}</span>
                  </div>
                </div>
              )}
              <div className="col-span-2">
                <span style={{ color: 'var(--novo-text-muted)' }}>描述</span>
                <div className="font-medium mt-0.5 leading-relaxed" style={{ color: 'var(--novo-text-secondary)' }}>
                  {block.description || '暂无描述'}
                </div>
              </div>

              {/* inputs */}
              {block.inputs && block.inputs.length > 0 && (
                <div>
                  <span style={{ color: 'var(--novo-text-muted)' }}>输入</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {block.inputs.map((inp: string) => (
                      <span key={inp} className="px-1.5 py-0.5 rounded font-mono"
                        style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-secondary)', fontSize: '9px' }}>
                        {inp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* outputs */}
              {block.outputs && block.outputs.length > 0 && (
                <div>
                  <span style={{ color: 'var(--novo-text-muted)' }}>输出</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {block.outputs.map((out: string) => (
                      <span key={out} className="px-1.5 py-0.5 rounded font-mono"
                        style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-secondary)', fontSize: '9px' }}>
                        {out}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* config_schema keys */}
              {block.config_schema && Object.keys(block.config_schema).length > 0 && (
                <div className="col-span-2">
                  <span style={{ color: 'var(--novo-text-muted)' }}>配置参数</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {Object.keys(block.config_schema).map((key: string) => (
                      <span key={key} className="px-1.5 py-0.5 rounded font-mono"
                        style={{ background: 'rgba(37,99,235,0.06)', color: '#2563EB', fontSize: '9px' }}>
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 导出按钮 */}
              <div className="col-span-2 pt-2 flex gap-2">
                <a
                  href={getBlockExportUrl(activeTab === 'agents' ? 'agents' : activeTab === 'interactions' ? 'interactions' : 'reports', block.id)}
                  download
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-medium transition-colors hover:bg-[var(--novo-bg-hover)]"
                  style={{ color: 'var(--novo-accent-primary)', border: '1px solid var(--novo-border-default)' }}
                >
                  <Download className="w-3 h-3" /> 导出 YAML
                </a>
                <a
                  href="/studio/agent-designer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-medium transition-colors hover:bg-[var(--novo-bg-hover)]"
                  style={{ color: 'var(--novo-text-secondary)', border: '1px solid var(--novo-border-default)' }}
                >
                  <ArrowRight className="w-3 h-3" /> 在设计器中打开
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
