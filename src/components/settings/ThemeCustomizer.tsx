'use client';

import React, { useState } from 'react';
import { useThemeContext } from '@/contexts/ThemeContext';
import { THEME_PRESETS } from '@/lib/theme/presets';
import { Palette, RotateCcw, ChevronDown, ChevronUp, Check } from 'lucide-react';

/* ===================================================================
 * ThemeCustomizer — 主题定制面板
 * 对标 Dify 的 ThemeBuilder
 * 支持修改主色调、背景色、圆角、字体比例
 * 实时预览 + 预设切换
 * =================================================================== */

const ThemeCustomizer: React.FC = () => {
  const {
    themeMode, setThemeMode, layoutMode, setLayoutMode,
    overrides, setOverrides, applyPreset, resetToDefault,
  } = useThemeContext();

  const [expanded, setExpanded] = useState(false);

  const activePresetId = THEME_PRESETS.find(p => {
    const o = p.overrides;
    return (
      (o.primaryColor || undefined) === overrides.primaryColor &&
      (o.bgBase || undefined) === overrides.bgBase
    );
  })?.id || 'custom';

  return (
    <div className="novo-card p-0 overflow-hidden">
      {/* 标题栏 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--novo-bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-[var(--novo-accent-primary)]" />
          <span className="text-sm font-bold text-[var(--novo-text-primary)]">
            主题定制
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[var(--novo-text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--novo-text-muted)]" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--novo-border-default)]">
          {/* 主题模式 */}
          <div className="pt-3">
            <label className="text-xs font-bold text-[var(--novo-text-muted)] uppercase tracking-wider">模式</label>
            <div className="flex gap-1.5 mt-2">
              {(['light', 'dark', 'system'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setThemeMode(mode)}
                  className={[
                    'flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-all',
                    themeMode === mode
                      ? 'bg-[var(--novo-accent-primary)] text-white shadow-sm'
                      : 'bg-[var(--novo-bg-hover)] text-[var(--novo-text-secondary)] hover:text-[var(--novo-text-primary)]',
                  ].join(' ')}
                >
                  {mode === 'light' ? '☀️ 亮色' : mode === 'dark' ? '🌙 暗色' : '💻 系统'}
                </button>
              ))}
            </div>
          </div>

          {/* 预设切换 */}
          <div>
            <label className="text-xs font-bold text-[var(--novo-text-muted)] uppercase tracking-wider">预设主题</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {THEME_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={[
                    'relative flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-[10px] font-bold transition-all',
                    'border',
                    activePresetId === preset.id
                      ? 'border-[var(--novo-accent-primary)] bg-[var(--novo-accent-primary-light)] text-[var(--novo-accent-primary)]'
                      : 'border-[var(--novo-border-default)] hover:border-[var(--novo-border-strong)] text-[var(--novo-text-secondary)]',
                  ].join(' ')}
                >
                  {/* 预览色块 */}
                  <div
                    className="w-6 h-6 rounded-full border border-[var(--novo-border-default)]"
                    style={{
                      backgroundColor: preset.overrides.primaryColor || 'var(--novo-accent-primary)',
                    }}
                  />
                  <span className="truncate w-full text-center">{preset.nameZh}</span>
                  {activePresetId === preset.id && (
                    <Check className="absolute top-1 right-1 w-3 h-3 text-[var(--novo-accent-primary)]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 自定义主色调 */}
          <div>
            <label className="text-xs font-bold text-[var(--novo-text-muted)] uppercase tracking-wider">主色调</label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="color"
                value={overrides.primaryColor || '#4285F4'}
                onChange={e => setOverrides({ ...overrides, primaryColor: e.target.value })}
                className="w-8 h-8 rounded-lg border border-[var(--novo-border-default)] cursor-pointer"
              />
              <input
                type="text"
                value={overrides.primaryColor || '#4285F4'}
                onChange={e => setOverrides({ ...overrides, primaryColor: e.target.value })}
                className="novo-input flex-1 px-3 py-1.5 text-xs font-mono"
                placeholder="#4285F4"
              />
            </div>
          </div>

          {/* 圆角比例 */}
          <div>
            <label className="text-xs font-bold text-[var(--novo-text-muted)] uppercase tracking-wider">
              圆角 ({Math.round((overrides.radiusScale || 1) * 100)}%)
            </label>
            <input
              type="range"
              min="0.2"
              max="2"
              step="0.1"
              value={overrides.radiusScale || 1}
              onChange={e => setOverrides({ ...overrides, radiusScale: parseFloat(e.target.value) })}
              className="w-full mt-2 accent-[var(--novo-accent-primary)]"
            />
          </div>

          {/* 字体比例 */}
          <div>
            <label className="text-xs font-bold text-[var(--novo-text-muted)] uppercase tracking-wider">
              字体大小 ({Math.round((overrides.fontScale || 1) * 100)}%)
            </label>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={overrides.fontScale || 1}
              onChange={e => setOverrides({ ...overrides, fontScale: parseFloat(e.target.value) })}
              className="w-full mt-2 accent-[var(--novo-accent-primary)]"
            />
          </div>

          {/* 布局模式 */}
          <div>
            <label className="text-xs font-bold text-[var(--novo-text-muted)] uppercase tracking-wider">布局</label>
            <div className="flex gap-1.5 mt-2">
              {(['sidebar', 'topnav', 'compact'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setLayoutMode(mode)}
                  className={[
                    'flex-1 px-3 py-2 text-xs font-bold rounded-lg transition-all',
                    layoutMode === mode
                      ? 'bg-[var(--novo-accent-primary)] text-white shadow-sm'
                      : 'bg-[var(--novo-bg-hover)] text-[var(--novo-text-secondary)] hover:text-[var(--novo-text-primary)]',
                  ].join(' ')}
                >
                  {mode === 'sidebar' ? '📐 侧栏' : mode === 'topnav' ? '📏 顶栏' : '📦 紧凑'}
                </button>
              ))}
            </div>
          </div>

          {/* 重置按钮 */}
          <button
            onClick={resetToDefault}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[var(--novo-text-muted)] hover:text-[var(--novo-accent-danger)] rounded-lg hover:bg-[var(--novo-accent-danger-light)] transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            恢复默认
          </button>
        </div>
      )}
    </div>
  );
};

export default ThemeCustomizer;
