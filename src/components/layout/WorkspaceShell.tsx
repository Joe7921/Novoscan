'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import dynamic from 'next/dynamic';

const CommandPalette = dynamic(() => import('./CommandPalette'), { ssr: false });

/* ===================================================================
 * WorkspaceShell — 全局布局外壳
 *
 * 对标 Dify 的 Studio 布局框架。
 * 自管理 sidebar 状态（收起/展开），持久化到 localStorage。
 * 所有页面只需 <WorkspaceShell> 包裹即可获得完整导航。
 *
 * 功能：
 *   - Sidebar 折叠状态 localStorage 持久化
 *   - 移动端左边缘右滑手势打开侧边栏
 *   - ⌘K / Ctrl+K 全局搜索面板
 * =================================================================== */

const SIDEBAR_STORAGE_KEY = 'novoscan-sidebar-collapsed';

interface WorkspaceShellProps {
  children: React.ReactNode;
  /** 语言，默认 'zh' */
  language?: 'zh' | 'en';
  /** 是否使用全高布局（h-screen），适合编辑器页面 */
  fullHeight?: boolean;
}

const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  children,
  language = 'zh',
  fullHeight = false,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // ========== Sidebar 折叠状态持久化 ==========
  useEffect(() => {
    // 读取持久化的折叠状态
    const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
    // 移动端强制折叠
    if (window.innerWidth < 1024) {
      setCollapsed(true);
    }
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // ========== ⌘K / Ctrl+K 快捷键 ==========
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ========== 移动端左边缘右滑手势 ==========
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    // 仅在屏幕左 30px 边缘区域内开始的触摸才响应
    if (touch.clientX <= 30) {
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = Math.abs(touch.clientY - touchStartY.current);

    // 右滑距离 > 60px 且水平运动大于垂直运动 → 触发打开侧边栏
    if (deltaX > 60 && deltaX > deltaY) {
      // 触发 Sidebar 移动端抽屉打开（通过点击 hamburger 按钮模拟）
      const hamburger = document.querySelector<HTMLButtonElement>('[aria-label="打开菜单"]');
      hamburger?.click();
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }, []);

  return (
    <div
      className={`flex ${fullHeight ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-[var(--novo-bg-base)]`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 侧边栏 */}
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleSidebar}
        language={language}
      />

      {/* 主内容区 — 桌面端根据侧边栏宽度添加左侧边距 */}
      <div
        className={[
          'flex-1 flex flex-col min-w-0 transition-all duration-300',
          collapsed
            ? 'lg:ml-[var(--novo-sidebar-width-collapsed)]'
            : 'lg:ml-[var(--novo-sidebar-width)]',
        ].join(' ')}
      >
        {children}
      </div>

      {/* 全局搜索面板 */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        language={language}
      />
    </div>
  );
};

export default WorkspaceShell;

