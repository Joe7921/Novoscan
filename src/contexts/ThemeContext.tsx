'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

/* ===================================================================
 * ThemeContext — 主题上下文 Provider
 * 对标 Dify 的 ThemeBuilder，支持运行时自定义 Design Token
 * =================================================================== */

export type ThemeMode = 'light' | 'dark' | 'system';
export type LayoutMode = 'sidebar' | 'topnav' | 'compact';

/** 可覆盖的主题 Token 子集 */
export interface ThemeOverrides {
  /** 主色调 */
  primaryColor?: string;
  /** 背景基色 */
  bgBase?: string;
  /** 表面色 */
  bgSurface?: string;
  /** 圆角尺寸（px） */
  radiusScale?: number;
  /** 字体大小比例 */
  fontScale?: number;
}

/** 主题预设 */
export interface ThemePreset {
  id: string;
  name: string;
  nameZh: string;
  overrides: ThemeOverrides;
}

interface ThemeContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
  overrides: ThemeOverrides;
  setOverrides: (overrides: ThemeOverrides) => void;
  applyPreset: (preset: ThemePreset) => void;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useThemeContext = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeContext 必须在 ThemeProvider 内部使用');
  return ctx;
};

const STORAGE_KEY = 'novoscan-theme-prefs';

/** 将 ThemeOverrides 应用到 :root CSS 变量 */
function applyOverridesToDOM(overrides: ThemeOverrides) {
  const root = document.documentElement;
  if (overrides.primaryColor) {
    root.style.setProperty('--novo-accent-primary', overrides.primaryColor);
    root.style.setProperty('--novo-brand-primary', overrides.primaryColor);
    root.style.setProperty('--novo-border-focus', overrides.primaryColor);
    // Light variant
    root.style.setProperty(
      '--novo-accent-primary-light',
      `${overrides.primaryColor}1a`
    );
  }
  if (overrides.bgBase) {
    root.style.setProperty('--novo-bg-base', overrides.bgBase);
    root.style.setProperty('--background', overrides.bgBase);
  }
  if (overrides.bgSurface) {
    root.style.setProperty('--novo-bg-surface', overrides.bgSurface);
  }
  if (overrides.radiusScale !== undefined) {
    const scale = overrides.radiusScale;
    root.style.setProperty('--novo-radius-sm', `${Math.round(6 * scale)}px`);
    root.style.setProperty('--novo-radius-md', `${Math.round(10 * scale)}px`);
    root.style.setProperty('--novo-radius-lg', `${Math.round(16 * scale)}px`);
    root.style.setProperty('--novo-radius-xl', `${Math.round(24 * scale)}px`);
    root.style.setProperty('--novo-radius-2xl', `${Math.round(32 * scale)}px`);
  }
  if (overrides.fontScale !== undefined) {
    const s = overrides.fontScale;
    root.style.setProperty('--novo-font-size-xs', `${0.75 * s}rem`);
    root.style.setProperty('--novo-font-size-sm', `${0.875 * s}rem`);
    root.style.setProperty('--novo-font-size-base', `${1 * s}rem`);
    root.style.setProperty('--novo-font-size-lg', `${1.125 * s}rem`);
    root.style.setProperty('--novo-font-size-xl', `${1.25 * s}rem`);
  }
}

/** 清除 DOM 上的自定义 CSS 覆盖 */
function clearOverridesFromDOM() {
  const root = document.documentElement;
  const props = [
    '--novo-accent-primary', '--novo-brand-primary', '--novo-border-focus',
    '--novo-accent-primary-light',
    '--novo-bg-base', '--background',
    '--novo-bg-surface',
    '--novo-radius-sm', '--novo-radius-md', '--novo-radius-lg',
    '--novo-radius-xl', '--novo-radius-2xl',
    '--novo-font-size-xs', '--novo-font-size-sm', '--novo-font-size-base',
    '--novo-font-size-lg', '--novo-font-size-xl',
  ];
  props.forEach(p => root.style.removeProperty(p));
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>('sidebar');
  const [overrides, setOverridesState] = useState<ThemeOverrides>({});

  // 初始化：从 localStorage 恢复
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const prefs = JSON.parse(saved);
        if (prefs.themeMode) setThemeModeState(prefs.themeMode);
        if (prefs.layoutMode) setLayoutModeState(prefs.layoutMode);
        if (prefs.overrides) {
          setOverridesState(prefs.overrides);
          applyOverridesToDOM(prefs.overrides);
        }
      }
    } catch {
      // 忽略 parse 错误
    }
  }, []);

  // 持久化
  const persist = useCallback(
    (mode: ThemeMode, layout: LayoutMode, ovr: ThemeOverrides) => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ themeMode: mode, layoutMode: layout, overrides: ovr })
        );
      } catch {
        // 忽略
      }
    },
    []
  );

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      setThemeModeState(mode);
      // 应用暗色类名
      const html = document.documentElement;
      if (mode === 'dark') {
        html.classList.add('dark');
      } else if (mode === 'light') {
        html.classList.remove('dark');
      } else {
        // system
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.classList.toggle('dark', prefersDark);
      }
      persist(mode, layoutMode, overrides);
    },
    [layoutMode, overrides, persist]
  );

  const setLayoutMode = useCallback(
    (mode: LayoutMode) => {
      setLayoutModeState(mode);
      persist(themeMode, mode, overrides);
    },
    [themeMode, overrides, persist]
  );

  const setOverrides = useCallback(
    (ovr: ThemeOverrides) => {
      setOverridesState(ovr);
      applyOverridesToDOM(ovr);
      persist(themeMode, layoutMode, ovr);
    },
    [themeMode, layoutMode, persist]
  );

  const applyPreset = useCallback(
    (preset: ThemePreset) => {
      setOverrides(preset.overrides);
    },
    [setOverrides]
  );

  const resetToDefault = useCallback(() => {
    setOverridesState({});
    clearOverridesFromDOM();
    persist(themeMode, layoutMode, {});
  }, [themeMode, layoutMode, persist]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        layoutMode,
        setLayoutMode,
        overrides,
        setOverrides,
        applyPreset,
        resetToDefault,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
