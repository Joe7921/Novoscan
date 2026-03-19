import type { ThemePreset } from '@/contexts/ThemeContext';

/* ===================================================================
 * 主题预设 — 用户可一键切换或基于预置二次定制
 * =================================================================== */

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Deep Ocean',
    nameZh: '深海蓝（默认）',
    overrides: {},
  },
  {
    id: 'warm',
    name: 'Warm Sunset',
    nameZh: '暖色夕阳',
    overrides: {
      primaryColor: '#F97316',
      bgBase: '#FFF7ED',
      bgSurface: '#FFEDD5',
    },
  },
  {
    id: 'mono',
    name: 'Minimal Mono',
    nameZh: '极简单色',
    overrides: {
      primaryColor: '#18181B',
      bgBase: '#FAFAFA',
      bgSurface: '#F4F4F5',
      radiusScale: 0.5,
    },
  },
  {
    id: 'academic',
    name: 'Academic White',
    nameZh: '学术白',
    overrides: {
      primaryColor: '#1E40AF',
      bgBase: '#FFFFFF',
      bgSurface: '#F8FAFC',
      radiusScale: 0.7,
      fontScale: 1.05,
    },
  },
  {
    id: 'emerald',
    name: 'Emerald Focus',
    nameZh: '翡翠聚焦',
    overrides: {
      primaryColor: '#059669',
      bgBase: '#ECFDF5',
      bgSurface: '#D1FAE5',
    },
  },
  {
    id: 'violet',
    name: 'Violet Dream',
    nameZh: '紫罗兰之梦',
    overrides: {
      primaryColor: '#7C3AED',
      bgBase: '#F5F3FF',
      bgSurface: '#EDE9FE',
    },
  },
];
