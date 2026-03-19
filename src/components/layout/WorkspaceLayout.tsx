'use client';

import React from 'react';
import Sidebar from './Sidebar';

/* ===================================================================
 * WorkspaceLayout — Studio 核心布局组件
 * Sidebar + TopBar + MainContent
 * 对标 Dify 的 Studio 布局
 * =================================================================== */

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  /** 语言 */
  language: 'zh' | 'en';
  /** 侧边栏是否收起 */
  sidebarCollapsed: boolean;
  /** 切换侧边栏 */
  onToggleSidebar: () => void;
  /** 顶部工具栏内容（可选） */
  topBarContent?: React.ReactNode;
  /** 右侧面板内容（如证据面板、Agent 状态面板） */
  rightPanel?: React.ReactNode;
  /** 右侧面板是否展开 */
  rightPanelOpen?: boolean;
}

const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  children,
  language,
  sidebarCollapsed,
  onToggleSidebar,
  topBarContent,
  rightPanel,
  rightPanelOpen = false,
}) => {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--novo-bg-base)]">
      {/* === 侧边栏 === */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={onToggleSidebar}
        language={language}
      />

      {/* === 主内容区 === */}
      <div
        className={[
          'flex-1 flex flex-col min-w-0 transition-all duration-300',
          // 桌面端根据侧边栏状态添加左侧边距
          sidebarCollapsed
            ? 'lg:ml-[var(--novo-sidebar-width-collapsed)]'
            : 'lg:ml-[var(--novo-sidebar-width)]',
        ].join(' ')}
      >
        {/* === 顶部工具栏 === */}
        {topBarContent && (
          <header
            className={[
              'h-[var(--novo-topbar-height)] flex items-center px-4 sm:px-6',
              'bg-[var(--novo-topbar-bg)] border-b border-[var(--novo-topbar-border)]',
              'flex-shrink-0',
            ].join(' ')}
          >
            {topBarContent}
          </header>
        )}

        {/* === 中心工作区 === */}
        <div className="flex flex-1 overflow-hidden">
          {/* 主体内容 */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>

          {/* === 右侧面板（可选） === */}
          {rightPanel && rightPanelOpen && (
            <aside
              className={[
                'hidden xl:block w-[360px] flex-shrink-0',
                'border-l border-[var(--novo-border-default)]',
                'bg-[var(--novo-bg-surface)]',
                'overflow-y-auto',
                'animate-slide-in-left',
              ].join(' ')}
              style={{ animationDirection: 'reverse', transform: 'scaleX(-1)' }}
            >
              <div style={{ transform: 'scaleX(-1)' }}>
                {rightPanel}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceLayout;
