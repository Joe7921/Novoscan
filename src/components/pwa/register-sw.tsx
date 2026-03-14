'use client';

import { useEffect } from 'react';

/**
 * PWA Service Worker 注册组件
 * 仅在生产环境 + 支持 SW 的浏览器中注册
 */
export function RegisterSW() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker 注册成功，scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker 注册失败:', err);
        });
    }
  }, []);

  return null; // 纯逻辑组件，不渲染任何 UI
}
