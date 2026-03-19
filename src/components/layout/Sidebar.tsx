'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  Briefcase,
  Clock,
  FileText,
  Store,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LayoutDashboard,
  FlaskConical,
  GitBranch,
  Users,
  Moon,
  Sun,
  Settings,
} from 'lucide-react';
import { ProjectIcon } from '../icons/ProjectIcon';


/* ===================================================================
 * Sidebar — Dify 风格侧边导航栏
 * 固定左侧，支持收起/展开动画
 * 移动端可通过 Overlay 展开
 *
 * 导航分组对标 Dify：
 *   产品    → Novoscan / Bizscan
 *   Studio  → Studio 总览 / 工作流 / 实验室
 *   生态    → 插件市场 / 社区
 *   工具    → 历史记录 / 技术文档
 * =================================================================== */

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  language: 'zh' | 'en';
}

interface NavItem {
  href: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  labelEn: string;
  color: string;
  activeColor: string;
}

/* ===== 产品导航 ===== */
const productNavItems: NavItem[] = [
  {
    href: '/',
    icon: Sparkles,
    label: 'Novoscan',
    labelEn: 'Novoscan',
    color: 'text-[var(--novo-text-secondary)]',
    activeColor: 'text-[var(--novo-accent-primary)]',
  },
  {
    href: '/bizscan',
    icon: Briefcase,
    label: 'Bizscan',
    labelEn: 'Bizscan',
    color: 'text-[var(--novo-text-secondary)]',
    activeColor: 'text-orange-500 dark:text-orange-400',
  },
];

/* ===== Studio 导航 ===== */
const studioNavItems: NavItem[] = [
  {
    href: '/studio',
    icon: LayoutDashboard,
    label: 'Studio',
    labelEn: 'Studio',
    color: 'text-[var(--novo-text-secondary)]',
    activeColor: 'text-purple-500 dark:text-purple-400',
  },
  {
    href: '/workflow',
    icon: GitBranch,
    label: '工作流',
    labelEn: 'Workflow',
    color: 'text-[var(--novo-text-secondary)]',
    activeColor: 'text-cyan-500 dark:text-cyan-400',
  },
  {
    href: '/playground',
    icon: FlaskConical,
    label: '实验室',
    labelEn: 'Playground',
    color: 'text-[var(--novo-text-secondary)]',
    activeColor: 'text-emerald-500 dark:text-emerald-400',
  },
];

/* ===== 生态导航 ===== */
const ecosystemNavItems: NavItem[] = [
  {
    href: '/marketplace',
    icon: Store,
    label: '插件市场',
    labelEn: 'Marketplace',
    color: 'text-[var(--novo-text-secondary)]',
    activeColor: 'text-[var(--novo-accent-primary)]',
  },
  {
    href: '/community',
    icon: Users,
    label: '社区',
    labelEn: 'Community',
    color: 'text-[var(--novo-text-secondary)]',
    activeColor: 'text-[var(--novo-accent-primary)]',
  },
];

/* ===== 工具导航 ===== */
const toolNavItems: NavItem[] = [
  {
    href: '/history',
    icon: Clock,
    label: '历史记录',
    labelEn: 'History',
    color: 'text-[var(--novo-text-secondary)]',
    activeColor: 'text-[var(--novo-accent-primary)]',
  },
  {
    href: '/docs',
    icon: FileText,
    label: '技术文档',
    labelEn: 'Docs',
    color: 'text-[var(--novo-text-secondary)]',
    activeColor: 'text-[var(--novo-accent-primary)]',
  },
  {
    href: '/profile',
    icon: Settings,
    label: '设置',
    labelEn: 'Settings',
    color: 'text-[var(--novo-text-secondary)]',
    activeColor: 'text-[var(--novo-accent-primary)]',
  },
];

/* ===== 导航分组定义 ===== */
const navGroups = [
  { key: 'products', labelZh: '产品', labelEn: 'Products', items: productNavItems },
  { key: 'studio', labelZh: 'Studio', labelEn: 'Studio', items: studioNavItems },
  { key: 'ecosystem', labelZh: '生态', labelEn: 'Ecosystem', items: ecosystemNavItems },
  { key: 'tools', labelZh: '工具', labelEn: 'Tools', items: toolNavItems },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, language }) => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isZh = language === 'zh';

  /* === 暗色模式切换 === */
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const toggleDarkMode = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = item.href === '/'
      ? pathname === '/'
      : pathname === item.href || pathname.startsWith(item.href + '/');
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={[
          'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
          'hover:bg-[var(--novo-sidebar-item-hover)]',
          isActive
            ? 'bg-[var(--novo-sidebar-item-active)] font-bold'
            : '',
        ].join(' ')}
        title={collapsed ? (isZh ? item.label : item.labelEn) : undefined}
      >
        <span
          className={[
            'flex-shrink-0 w-5 h-5 transition-colors duration-200',
            isActive ? item.activeColor : item.color,
          ].join(' ')}
        >
          <Icon className="w-5 h-5" />
        </span>
        {!collapsed && (
          <span
            className={[
              'text-sm whitespace-nowrap overflow-hidden transition-all duration-200',
              isActive
                ? 'text-[var(--novo-sidebar-text-active)]'
                : 'text-[var(--novo-sidebar-text)]',
            ].join(' ')}
          >
            {isZh ? item.label : item.labelEn}
          </span>
        )}
        {isActive && (
          <span className="absolute left-0 w-[3px] h-6 rounded-r-full bg-[var(--novo-accent-primary)]" />
        )}
      </Link>
    );
  };

  const renderNavGroup = (group: typeof navGroups[number], index: number) => (
    <div key={group.key}>
      {index > 0 && (
        <div className="my-3 mx-3 h-px bg-[var(--novo-sidebar-border)]" />
      )}
      <div className="space-y-0.5">
        {!collapsed && (
          <p className="px-3 py-1 text-[10px] font-bold text-[var(--novo-text-muted)] uppercase tracking-widest">
            {isZh ? group.labelZh : group.labelEn}
          </p>
        )}
        {group.items.map(renderNavItem)}
      </div>
    </div>
  );

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo 区域 — 点击返回首页 */}
      <Link
        href="/"
        className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-4 py-5 border-b border-[var(--novo-sidebar-border)] hover:bg-[var(--novo-sidebar-item-hover)] transition-colors duration-200`}
      >
        <div className="w-9 h-9 rounded-xl bg-[var(--novo-accent-primary-light)] flex items-center justify-center flex-shrink-0">
          <ProjectIcon className="w-5 h-5 text-[var(--novo-accent-primary)]" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-lg font-black tracking-tight leading-none">
              <span className="gradient-text-brand">Novo</span>
              <span className="text-[var(--novo-text-primary)]">scan</span>
            </span>
            <span className="text-[9px] text-[var(--novo-text-muted)] font-medium tracking-wider leading-none mt-0.5 truncate">
              {isZh ? '开源创新评估引擎' : 'Open Source Innovation Engine'}
            </span>
          </div>
        )}
      </Link>

      {/* 主导航 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {navGroups.map(renderNavGroup)}
      </nav>

      {/* 底部区域 */}
      <div className="px-3 py-3 border-t border-[var(--novo-sidebar-border)] space-y-2">
        {/* 暗色模式切换 */}
        <button
          onClick={toggleDarkMode}
          className="flex items-center justify-center w-full py-2 rounded-lg text-[var(--novo-text-muted)] hover:text-[var(--novo-text-primary)] hover:bg-[var(--novo-sidebar-item-hover)] transition-all duration-200"
          aria-label={isDark ? '切换为亮色模式' : '切换为暗色模式'}
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4" />
              {!collapsed && <span className="text-xs font-medium ml-2">{isZh ? '亮色模式' : 'Light Mode'}</span>}
            </>
          ) : (
            <>
              <Moon className="w-4 h-4" />
              {!collapsed && <span className="text-xs font-medium ml-2">{isZh ? '暗色模式' : 'Dark Mode'}</span>}
            </>
          )}
        </button>

        {/* 收起/展开按钮 — 仅桌面端显示 */}
        <button
          onClick={onToggle}
          className="hidden lg:flex items-center justify-center w-full py-2 rounded-lg text-[var(--novo-text-muted)] hover:text-[var(--novo-text-primary)] hover:bg-[var(--novo-sidebar-item-hover)] transition-all duration-200"
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span className="text-xs font-medium">{isZh ? '收起' : 'Collapse'}</span>
            </>
          )}
        </button>

      </div>
    </div>
  );

  return (
    <>
      {/* 桌面侧边栏 */}
      <aside
        className={[
          'hidden lg:flex flex-col fixed left-0 top-0 h-screen z-40',
          'bg-[var(--novo-sidebar-bg)] border-r border-[var(--novo-sidebar-border)]',
          'transition-all duration-300 ease-in-out',
          collapsed ? 'w-[var(--novo-sidebar-width-collapsed)]' : 'w-[var(--novo-sidebar-width)]',
        ].join(' ')}
      >
        {sidebarContent}
      </aside>

      {/* 移动端 Hamburger 按钮 */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-xl bg-[var(--novo-bg-surface)] border border-[var(--novo-border-default)] shadow-[var(--novo-shadow-sm)] flex items-center justify-center text-[var(--novo-text-secondary)]"
        aria-label="打开菜单"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* 移动端抽屉 Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* 侧边栏抽屉 */}
          <aside className="absolute left-0 top-0 h-full w-[280px] bg-[var(--novo-sidebar-bg)] border-r border-[var(--novo-sidebar-border)] shadow-[var(--novo-shadow-xl)] animate-slide-in-left">
            {/* 关闭按钮 */}
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--novo-text-muted)] hover:text-[var(--novo-text-primary)] hover:bg-[var(--novo-bg-hover)]"
              aria-label="关闭菜单"
            >
              <X className="w-4 h-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};

export default Sidebar;
