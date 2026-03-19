import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* === 兼容旧变量（确保现有组件不破坏） === */
        background: "var(--background)",
        foreground: "var(--foreground)",
        /* === 旧 google 四色 → novo 品牌色（保持不变的色值） === */
        'novo-blue': '#4285F4',
        'novo-red': '#EA4335',
        'novo-yellow': '#FBBC05',
        'novo-green': '#34A853',
        // 暗色主题三层表面系统
        'dark-base': '#0B1120',
        'dark-surface': '#131B2E',
        'dark-elevated': '#1A2540',

        /* === 新 Design Token 语义色 === */
        novo: {
          // 品牌色
          primary: 'var(--novo-accent-primary)',
          'primary-hover': 'var(--novo-accent-primary-hover)',
          'primary-light': 'var(--novo-accent-primary-light)',
          // 语义色
          success: 'var(--novo-accent-success)',
          'success-light': 'var(--novo-accent-success-light)',
          warning: 'var(--novo-accent-warning)',
          'warning-light': 'var(--novo-accent-warning-light)',
          danger: 'var(--novo-accent-danger)',
          'danger-light': 'var(--novo-accent-danger-light)',
          info: 'var(--novo-accent-info)',
          'info-light': 'var(--novo-accent-info-light)',
          // 表面
          'bg-base': 'var(--novo-bg-base)',
          'bg-surface': 'var(--novo-bg-surface)',
          'bg-elevated': 'var(--novo-bg-elevated)',
          'bg-hover': 'var(--novo-bg-hover)',
          'bg-active': 'var(--novo-bg-active)',
          // 文字
          'text-primary': 'var(--novo-text-primary)',
          'text-secondary': 'var(--novo-text-secondary)',
          'text-muted': 'var(--novo-text-muted)',
          // 边框
          'border': 'var(--novo-border-default)',
          'border-light': 'var(--novo-border-light)',
          'border-strong': 'var(--novo-border-strong)',
        },
      },
      borderRadius: {
        'novo-sm': 'var(--novo-radius-sm)',
        'novo-md': 'var(--novo-radius-md)',
        'novo-lg': 'var(--novo-radius-lg)',
        'novo-xl': 'var(--novo-radius-xl)',
        'novo-2xl': 'var(--novo-radius-2xl)',
        '4xl': '2rem',
        '5xl': '3rem',
      },
      boxShadow: {
        'novo-xs': 'var(--novo-shadow-xs)',
        'novo-sm': 'var(--novo-shadow-sm)',
        'novo-md': 'var(--novo-shadow-md)',
        'novo-lg': 'var(--novo-shadow-lg)',
        'novo-xl': 'var(--novo-shadow-xl)',
        'novo-glow': 'var(--novo-shadow-glow)',
      },
      spacing: {
        'novo-xs': 'var(--novo-space-xs)',
        'novo-sm': 'var(--novo-space-sm)',
        'novo-md': 'var(--novo-space-md)',
        'novo-lg': 'var(--novo-space-lg)',
        'novo-xl': 'var(--novo-space-xl)',
        'novo-2xl': 'var(--novo-space-2xl)',
        'sidebar': 'var(--novo-sidebar-width)',
        'sidebar-collapsed': 'var(--novo-sidebar-width-collapsed)',
        'topbar': 'var(--novo-topbar-height)',
      },
      fontFamily: {
        sans: ['var(--novo-font-sans)'],
        mono: ['var(--novo-font-mono)'],
      },
      fontSize: {
        'novo-xs': 'var(--novo-font-size-xs)',
        'novo-sm': 'var(--novo-font-size-sm)',
        'novo-base': 'var(--novo-font-size-base)',
        'novo-lg': 'var(--novo-font-size-lg)',
        'novo-xl': 'var(--novo-font-size-xl)',
        'novo-2xl': 'var(--novo-font-size-2xl)',
        'novo-3xl': 'var(--novo-font-size-3xl)',
        'novo-4xl': 'var(--novo-font-size-4xl)',
      },
      keyframes: {
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-20px) scale(1.02)' },
        },
        'float-medium': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-15px) scale(1.01)' },
        },
        'float-fast': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-10px) scale(1.03)' },
        },
        'loading-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(60%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'float-slow': 'float-slow 8s ease-in-out infinite',
        'float-medium': 'float-medium 6s ease-in-out infinite',
        'float-fast': 'float-fast 4s ease-in-out infinite',
        'slide-in-left': 'slide-in-left 0.3s ease-out both',
      },
    },
  },
  plugins: [],
};
export default config;
