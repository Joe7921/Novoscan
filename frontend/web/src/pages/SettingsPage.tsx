import { useState, useEffect } from 'react'
import {
  RotateCcw, Server, Database, SlidersHorizontal,
  Wrench, Blocks, ChevronRight, Cloud,
} from 'lucide-react'
import ProviderSettings from '@/components/settings/ProviderSettings'
import DataSourceConfig from '@/components/settings/DataSourceConfig'
import ToolManager from '@/components/settings/ToolManager'
import { useLocalSettings } from '@/hooks/useLocalSettings'
import { fetchBlocks } from '@/lib/api'
import type { BlocksResponse } from '@/types/blocks'

type SettingsSection = 'providers' | 'datasource' | 'preferences' | 'tools' | 'blocks'

const SECTIONS: { key: SettingsSection; label: string; icon: typeof Server; color: string }[] = [
  { key: 'providers',   label: '模型服务',  icon: Cloud,              color: '#2563EB' },
  { key: 'datasource',  label: '数据源',    icon: Database,           color: '#16A34A' },
  { key: 'preferences', label: '偏好设置',  icon: SlidersHorizontal,  color: '#7C3AED' },
  { key: 'tools',       label: '工具注册表', icon: Wrench,             color: '#0891B2' },
  { key: 'blocks',      label: '组件注册表', icon: Blocks,             color: '#EA580C' },
]

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useLocalSettings()
  const [activeSection, setActiveSection] = useState<SettingsSection>('providers')
  const [blocksData, setBlocksData] = useState<BlocksResponse | null>(null)

  useEffect(() => {
    fetchBlocks().then(r => setBlocksData(r)).catch(() => {})
  }, [])

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* ── 左侧导航栏 ── */}
      <nav
        className="w-52 shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ background: 'var(--novo-bg-base)', borderColor: 'var(--novo-border-default)' }}
      >
        <div className="px-4 pt-6 pb-3">
          <h1 className="text-lg font-bold" style={{ color: 'var(--novo-text-primary)' }}>设置</h1>
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--novo-text-muted)' }}>系统配置与注册表管理</p>
        </div>

        <div className="flex-1 px-2 space-y-0.5">
          {SECTIONS.map(sec => {
            const Icon = sec.icon
            const active = activeSection === sec.key
            return (
              <button
                key={sec.key}
                onClick={() => setActiveSection(sec.key)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all"
                style={{
                  background: active ? `color-mix(in srgb, ${sec.color} 8%, transparent)` : 'transparent',
                  color: active ? sec.color : 'var(--novo-text-secondary)',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {sec.label}
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </button>
            )
          })}
        </div>

        <div className="px-3 pb-4 pt-2 border-t" style={{ borderColor: 'var(--novo-border-default)' }}>
          <button
            onClick={resetSettings}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium transition-all hover:bg-[var(--novo-bg-hover)]"
            style={{ color: 'var(--novo-text-muted)' }}
          >
            <RotateCcw className="w-3 h-3" />
            重置所有设置
          </button>
        </div>
      </nav>

      {/* ── 右侧内容面板 ── */}
      <main className={`flex-1 overflow-hidden ${activeSection === 'providers' ? '' : 'overflow-y-auto px-8 py-8'}`}>
        <div className={activeSection === 'providers' ? 'h-full' : 'max-w-2xl'}>
          {activeSection === 'providers' && <ProviderSettings />}

          {activeSection === 'datasource' && <DataSourceConfig />}

          {activeSection === 'preferences' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold mb-1" style={{ color: 'var(--novo-text-primary)' }}>偏好设置</h2>
                <p className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>个性化分析行为与界面偏好</p>
              </div>
              <div className="novo-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--novo-text-primary)' }}>默认检测类型</div>
                    <div className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>新分析时的默认检测类型</div>
                  </div>
                  <select
                    value={settings.defaultDetectionType}
                    onChange={e => updateSettings({ defaultDetectionType: e.target.value })}
                    className="text-xs px-2 py-1.5 rounded-lg novo-input"
                  >
                    <option value="auto">自动检测</option>
                    <option value="academic">学术创新</option>
                    <option value="industrial">产业创新</option>
                    <option value="skill">技术创新</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--novo-text-primary)' }}>默认分析模式</div>
                    <div className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>Standard（传统工作流）或 Agentic（智能体工作流）</div>
                  </div>
                  <select
                    value={settings.defaultMode}
                    onChange={e => updateSettings({ defaultMode: e.target.value as 'standard' | 'agentic' })}
                    className="text-xs px-2 py-1.5 rounded-lg novo-input"
                  >
                    <option value="standard">Standard</option>
                    <option value="agentic">Agentic</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--novo-text-primary)' }}>新手引导</div>
                    <div className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>
                      {settings.onboardingDone ? '已完成' : '未完成'}
                    </div>
                  </div>
                  <button
                    onClick={() => updateSettings({ onboardingDone: false })}
                    className="text-[11px] px-2.5 py-1 rounded-lg transition-all"
                    style={{
                      background: 'var(--novo-accent-primary-light)',
                      color: 'var(--novo-accent-primary)',
                    }}
                  >
                    重新引导
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'tools' && <ToolManager />}

          {activeSection === 'blocks' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold mb-1" style={{ color: 'var(--novo-text-primary)' }}>积木注册表</h2>
                <p className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>三层积木体系概览 — Agent · 交互模式 · 报告插件</p>
              </div>
              <div className="novo-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Blocks className="w-4 h-4" style={{ color: 'var(--novo-accent-primary)' }} />
                  <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>已注册积木</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-auto"
                    style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)' }}>
                    {blocksData?.total ?? 0} 个
                  </span>
                </div>
                {blocksData && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(37,99,235,0.05)' }}>
                      <div className="text-2xl font-bold" style={{ color: '#2563EB' }}>{blocksData.agents.length}</div>
                      <div className="text-[10px] mt-1" style={{ color: 'var(--novo-text-muted)' }}>Agent</div>
                    </div>
                    <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(234,88,12,0.05)' }}>
                      <div className="text-2xl font-bold" style={{ color: '#EA580C' }}>{blocksData.interactions.length}</div>
                      <div className="text-[10px] mt-1" style={{ color: 'var(--novo-text-muted)' }}>交互模式</div>
                    </div>
                    <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(22,163,74,0.05)' }}>
                      <div className="text-2xl font-bold" style={{ color: '#16A34A' }}>{blocksData.reports.length}</div>
                      <div className="text-[10px] mt-1" style={{ color: 'var(--novo-text-muted)' }}>报告插件</div>
                    </div>
                  </div>
                )}
                <div className="text-center pt-2">
                  <a href="/blocks" className="text-[11px] font-medium transition-colors hover:underline"
                    style={{ color: 'var(--novo-accent-primary)' }}>
                    查看完整积木浏览器 →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
