import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Play, Clock, Settings, Command, LayoutDashboard, Cpu, Package } from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>
  action: () => void
  keywords: string[]
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const commands: CommandItem[] = [
    {
      id: 'playground',
      label: 'Playground',
      icon: Play,
      action: () => { navigate('/'); setOpen(false) },
      keywords: ['playground', '分析', '创新', 'analyze', 'new'],
    },
    {
      id: 'studio',
      label: 'Studio',
      icon: LayoutDashboard,
      action: () => { navigate('/studio'); setOpen(false) },
      keywords: ['studio', '工作台', '画布', 'workspace'],
    },
    {
      id: 'studio-agentic',
      label: 'Studio Agentic 智能体模式',
      icon: Cpu,
      action: () => { navigate('/studio?mode=agentic'); setOpen(false) },
      keywords: ['agentic', '自主', '智能体', '智能体工作流', '传统工作流'],
    },
    {
      id: 'history',
      label: '历史记录',
      icon: Clock,
      action: () => { navigate('/history'); setOpen(false) },
      keywords: ['历史', '报告', 'history', 'report'],
    },
    {
      id: 'components',
      label: '组件仓库',
      icon: Package,
      action: () => { navigate('/components'); setOpen(false) },
      keywords: ['组件', '积木', 'components', 'blocks', 'agent', '插件'],
    },
    {
      id: 'settings',
      label: '设置',
      icon: Settings,
      action: () => { navigate('/settings'); setOpen(false) },
      keywords: ['设置', '模型', 'settings', 'model', 'config'],
    },
  ]

  const filtered = query.trim()
    ? commands.filter(c =>
        c.label.includes(query) ||
        c.keywords.some(k => k.toLowerCase().includes(query.toLowerCase()))
      )
    : commands

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setOpen(prev => !prev)
      setQuery('')
      setActiveIndex(0)
    }
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filtered[activeIndex]) {
      filtered[activeIndex].action()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: 'var(--novo-bg-overlay)' }}
            onClick={() => setOpen(false)}
          />

          {/* 面板 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 z-50 w-[480px] rounded-2xl overflow-hidden"
            style={{
              background: 'var(--novo-bg-elevated)',
              border: '1px solid var(--novo-border-default)',
              boxShadow: 'var(--novo-shadow-xl)',
            }}
          >
            {/* 搜索栏 */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '1px solid var(--novo-border-default)' }}
            >
              <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--novo-text-muted)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleListKeyDown}
                placeholder="输入命令..."
                className="flex-1 bg-transparent text-sm border-none outline-none"
                style={{ color: 'var(--novo-text-primary)' }}
              />
              <kbd
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)', border: '1px solid var(--novo-border-default)' }}
              >
                ESC
              </kbd>
            </div>

            {/* 命令列表 */}
            <div className="py-2 max-h-[300px] overflow-y-auto">
              {filtered.length === 0 && (
                <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--novo-text-muted)' }}>
                  无匹配命令
                </div>
              )}
              {filtered.map((cmd, i) => {
                const Icon = cmd.icon
                return (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    onMouseEnter={() => setActiveIndex(i)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors"
                    style={{
                      background: i === activeIndex ? 'var(--novo-bg-hover)' : 'transparent',
                      color: 'var(--novo-text-primary)',
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--novo-text-muted)' }} />
                    <span className="flex-1">{cmd.label}</span>
                  </button>
                )
              })}
            </div>

            {/* 底部提示 */}
            <div
              className="flex items-center gap-3 px-4 py-2 text-[10px]"
              style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)', borderTop: '1px solid var(--novo-border-default)' }}
            >
              <span className="flex items-center gap-1">
                <Command className="w-2.5 h-2.5" /> K 打开
              </span>
              <span>↑↓ 选择</span>
              <span>↵ 执行</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
