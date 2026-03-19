'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Sparkles,
  Briefcase,
  LayoutDashboard,
  GitBranch,
  FlaskConical,
  Store,
  Users,
  Clock,
  FileText,
  Settings,
  ArrowRight,
  Command,
} from 'lucide-react';

/* ===================================================================
 * CommandPalette — 全局搜索/跳转面板
 *
 * 对标 Dify / Linear / Raycast 的 ⌘K 面板。
 * 支持模糊搜索页面、快速导航。
 *
 * 快捷键：⌘K (macOS) / Ctrl+K (Windows/Linux)
 * =================================================================== */

interface CommandItem {
  id: string;
  label: string;
  labelEn: string;
  description: string;
  href: string;
  icon: React.FC<{ className?: string }>;
  group: string;
  keywords: string[];
}

const COMMAND_ITEMS: CommandItem[] = [
  // 产品
  {
    id: 'novoscan',
    label: 'Novoscan 扫描',
    labelEn: 'Novoscan Scan',
    description: '输入创新想法，AI 自动评估可行性',
    href: '/',
    icon: Sparkles,
    group: '产品',
    keywords: ['scan', '扫描', '分析', '首页', 'home', 'novoscan'],
  },
  {
    id: 'bizscan',
    label: 'Bizscan 商析',
    labelEn: 'Bizscan',
    description: '企业级商业可行性分析',
    href: '/bizscan',
    icon: Briefcase,
    group: '产品',
    keywords: ['biz', '商业', '企业', 'business', 'bizscan'],
  },
  // Studio
  {
    id: 'studio',
    label: 'Studio 总览',
    labelEn: 'Studio Overview',
    description: '构建与测试工作台入口',
    href: '/studio',
    icon: LayoutDashboard,
    group: 'Studio',
    keywords: ['studio', '工作台', '构建'],
  },
  {
    id: 'workflow',
    label: '工作流编辑器',
    labelEn: 'Workflow Editor',
    description: '可视化拖拽构建 AI 分析流程',
    href: '/workflow',
    icon: GitBranch,
    group: 'Studio',
    keywords: ['workflow', '工作流', '流程', '编辑器', 'dag'],
  },
  {
    id: 'playground',
    label: 'Agent 实验室',
    labelEn: 'Agent Playground',
    description: '单独测试 Agent 插件',
    href: '/playground',
    icon: FlaskConical,
    group: 'Studio',
    keywords: ['playground', '实验室', 'agent', '测试'],
  },
  // 生态
  {
    id: 'marketplace',
    label: '插件市场',
    labelEn: 'Marketplace',
    description: '浏览和安装社区插件',
    href: '/marketplace',
    icon: Store,
    group: '生态',
    keywords: ['marketplace', '市场', '插件', 'plugin', '商店'],
  },
  {
    id: 'community',
    label: '社区',
    labelEn: 'Community',
    description: '模板分享与讨论',
    href: '/community',
    icon: Users,
    group: '生态',
    keywords: ['community', '社区', '模板'],
  },
  // 工具
  {
    id: 'history',
    label: '历史记录',
    labelEn: 'History',
    description: '查看分析历史',
    href: '/history',
    icon: Clock,
    group: '工具',
    keywords: ['history', '历史', '记录'],
  },
  {
    id: 'docs',
    label: '技术文档',
    labelEn: 'Docs',
    description: 'API 文档和使用指南',
    href: '/docs',
    icon: FileText,
    group: '工具',
    keywords: ['docs', '文档', 'api', '指南'],
  },
  {
    id: 'settings',
    label: '设置',
    labelEn: 'Settings',
    description: '模型偏好、语言和个人配置',
    href: '/profile',
    icon: Settings,
    group: '工具',
    keywords: ['settings', '设置', '配置', '偏好', 'profile', '个人'],
  },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  language?: 'zh' | 'en';
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  language = 'zh',
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isZh = language === 'zh';

  // 模糊搜索
  const filteredItems = useMemo(() => {
    if (!query.trim()) return COMMAND_ITEMS;
    const q = query.toLowerCase();
    return COMMAND_ITEMS.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.labelEn.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.keywords.some(kw => kw.includes(q))
    );
  }, [query]);

  // 按组分组
  const groupedItems = useMemo(() => {
    const groups: { group: string; items: CommandItem[] }[] = [];
    const seen = new Set<string>();
    for (const item of filteredItems) {
      if (!seen.has(item.group)) {
        seen.add(item.group);
        groups.push({ group: item.group, items: [] });
      }
      groups.find(g => g.group === item.group)!.items.push(item);
    }
    return groups;
  }, [filteredItems]);

  // 打开时聚焦并重置
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          router.push(item.href);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [filteredItems, selectedIndex, router, onClose]
  );

  // 查询变化时重置选中索引
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // 滚动选中项可见
  useEffect(() => {
    const selectedEl = listRef.current?.querySelector('[data-selected="true"]');
    selectedEl?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
          onClick={onClose}
        >
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* 面板 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg mx-4 bg-[var(--novo-bg-surface)] border border-[var(--novo-border-default)] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* 搜索栏 */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--novo-border-default)]">
              <Search className="w-5 h-5 text-[var(--novo-text-muted)] flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isZh ? '搜索页面或功能…' : 'Search pages or features…'}
                className="flex-1 bg-transparent text-[var(--novo-text-primary)] text-sm placeholder-[var(--novo-text-muted)] outline-none"
              />
              <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-[var(--novo-text-muted)] bg-[var(--novo-bg-hover)] border border-[var(--novo-border-default)] rounded">
                ESC
              </kbd>
            </div>

            {/* 结果列表 */}
            <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--novo-text-muted)]">
                  {isZh ? '没有找到匹配结果' : 'No results found'}
                </div>
              ) : (
                groupedItems.map((group) => (
                  <div key={group.group}>
                    <div className="px-4 py-1.5 text-[10px] font-bold text-[var(--novo-text-muted)] uppercase tracking-widest">
                      {group.group}
                    </div>
                    {group.items.map((item) => {
                      flatIndex++;
                      const isSelected = flatIndex === selectedIndex;
                      const Icon = item.icon;
                      const currentIndex = flatIndex;
                      return (
                        <button
                          key={item.id}
                          data-selected={isSelected}
                          onClick={() => {
                            router.push(item.href);
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className={[
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100',
                            isSelected
                              ? 'bg-[var(--novo-accent-primary)]/10'
                              : 'hover:bg-[var(--novo-bg-hover)]',
                          ].join(' ')}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-[var(--novo-accent-primary)]/15' : 'bg-[var(--novo-bg-hover)]'}`}>
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-[var(--novo-accent-primary)]' : 'text-[var(--novo-text-muted)]'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${isSelected ? 'text-[var(--novo-accent-primary)]' : 'text-[var(--novo-text-primary)]'}`}>
                              {isZh ? item.label : item.labelEn}
                            </div>
                            <div className="text-[11px] text-[var(--novo-text-muted)] truncate">
                              {item.description}
                            </div>
                          </div>
                          {isSelected && (
                            <ArrowRight className="w-4 h-4 text-[var(--novo-accent-primary)] flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* 底部快捷键提示 */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--novo-border-default)] text-[10px] text-[var(--novo-text-muted)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-[var(--novo-bg-hover)] border border-[var(--novo-border-default)] rounded text-[10px] font-mono">↑↓</kbd>
                  {isZh ? '选择' : 'Navigate'}
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-[var(--novo-bg-hover)] border border-[var(--novo-border-default)] rounded text-[10px] font-mono">↵</kbd>
                  {isZh ? '确认' : 'Open'}
                </span>
              </div>
              <span className="flex items-center gap-1">
                <Command className="w-3 h-3" />
                <span>K</span>
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
