import { NavLink } from 'react-router-dom'
import { Play, Clock, Settings, LayoutDashboard, Package } from 'lucide-react'

const navItems = [
  { to: '/',            icon: Play,             label: 'Playground' },
  { to: '/studio',      icon: LayoutDashboard,  label: 'Studio' },
  { to: '/history',     icon: Clock,            label: '历史记录' },
  { to: '/components',  icon: Package,          label: '组件仓库' },
  { to: '/settings',    icon: Settings,         label: '设置' },
]

export default function Sidebar() {
  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col"
      style={{
        width: 'var(--novo-sidebar-width)',
        background: 'var(--novo-sidebar-bg)',
        borderRight: '1px solid var(--novo-sidebar-border)',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ background: 'var(--novo-accent-primary)', color: 'white' }}
        >
          N
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>
            Novoscan
          </div>
          <div className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>
            Open Core
          </div>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => [
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
              isActive
                ? 'font-semibold'
                : 'hover:bg-[var(--novo-sidebar-item-hover)]',
            ].join(' ')}
            style={({ isActive }) => ({
              color: isActive ? 'var(--novo-sidebar-text-active)' : 'var(--novo-sidebar-text)',
              background: isActive ? 'var(--novo-sidebar-item-active)' : undefined,
            })}
          >
            <item.icon className="w-[18px] h-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* 底部 */}
      <div
        className="px-4 py-3 text-[10px]"
        style={{ color: 'var(--novo-text-muted)', borderTop: '1px solid var(--novo-sidebar-border)' }}
      >
        v0.1.0 · LangGraph Engine
      </div>
    </aside>
  )
}
