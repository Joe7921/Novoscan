'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Language, ModelProvider, ScanMode } from '@/types';
import { AppState } from '@/types';

/* ===================================================================
 * AppContext — 全局应用状态 Provider
 * 替代 HomeClient 中的全局状态 useState
 * 对标 Dify 的 Provider Tree 架构
 * =================================================================== */

interface AppContextValue {
  // === 应用状态 ===
  appState: AppState;
  setAppState: (state: AppState) => void;

  // === 语言 ===
  language: Language;
  setLanguage: (lang: Language) => void;

  // === 扫描模式 ===
  scanMode: ScanMode;
  setScanMode: (mode: ScanMode) => void;

  // === 模型选择 ===
  selectedModel: ModelProvider;
  setSelectedModel: (model: ModelProvider) => void;

  // === 学科聚焦 ===
  selectedDomainId: string | null;
  setSelectedDomainId: (id: string | null) => void;
  selectedSubDomainId: string | null;
  setSelectedSubDomainId: (id: string | null) => void;

  // === 隐私模式 ===
  isPrivateMode: boolean;
  togglePrivateMode: () => void;

  // === UI 状态 ===
  toastMessage: string | null;
  showToast: (msg: string, duration?: number) => void;
  clearToast: () => void;

  // === 侧边栏 ===
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext 必须在 AppProvider 内部使用');
  return ctx;
};

interface AppProviderProps {
  children: React.ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [appState, setAppState] = useState<AppState>(AppState.INPUT);
  const [language, setLanguage] = useState<Language>('zh');
  const [scanMode, setScanMode] = useState<ScanMode>('standard');
  const [selectedModel, setSelectedModel] = useState<ModelProvider>('minimax');
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [selectedSubDomainId, setSelectedSubDomainId] = useState<string | null>(null);
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const togglePrivateMode = useCallback(() => setIsPrivateMode(prev => !prev), []);
  const toggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), []);

  const showToast = useCallback((msg: string, duration = 4000) => {
    setToastMessage(msg);
    if (duration > 0) {
      setTimeout(() => setToastMessage(null), duration);
    }
  }, []);

  const clearToast = useCallback(() => setToastMessage(null), []);

  // 移动端默认折叠侧边栏
  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const value: AppContextValue = {
    appState,
    setAppState,
    language,
    setLanguage,
    scanMode,
    setScanMode,
    selectedModel,
    setSelectedModel,
    selectedDomainId,
    setSelectedDomainId,
    selectedSubDomainId,
    setSelectedSubDomainId,
    isPrivateMode,
    togglePrivateMode,
    toastMessage,
    showToast,
    clearToast,
    sidebarCollapsed,
    toggleSidebar,
    setSidebarCollapsed,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
