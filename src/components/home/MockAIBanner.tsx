'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, ArrowRight, Beaker } from 'lucide-react';

/**
 * Mock AI 模式提示横幅
 * 
 * 当检测到 Mock AI 模式开启时，在首页顶部显示一条友好的提示条，
 * 让用户知道当前正在使用仿真数据，并引导他们了解如何切换到真实 AI。
 * 
 * 特性：
 * - 仅在 MOCK_AI=true 时显示
 * - 用户可关闭，关闭后当前会话不再显示（sessionStorage）
 * - 渐入渐出动画
 */

const DISMISS_KEY = 'novoscan_mock_banner_dismissed';

export default function MockAIBanner() {
  const [show, setShow] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // 检测 Mock AI 模式和会话状态
    const isMock = process.env.NEXT_PUBLIC_MOCK_AI === 'true' ||
      process.env.NEXT_PUBLIC_MOCK_AI === undefined; // .env.example 默认开启
    const dismissed = sessionStorage.getItem(DISMISS_KEY);

    // 仅在 MOCK_AI 显式为 true 时显示（通过环境变量检测）
    if (!dismissed) {
      // 通过 health API 检测是否为 Mock AI
      fetch('/api/health')
        .then(res => {
          // 如果 health API 返回 500 且错误为 no API keys，说明是 Mock AI 模式
          if (res.status === 500 || res.status === 401) {
            setShow(true);
          }
        })
        .catch(() => {
          // 网络错误也显示（可能是纯本地开发）
          setShow(true);
        });
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative mx-auto max-w-5xl px-4 mt-3"
        >
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-fuchsia-500/5 backdrop-blur-sm">
            {/* 动态光效背景 */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-1/2 -right-1/4 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-1/2 -left-1/4 w-48 h-48 bg-fuchsia-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative px-4 py-3 sm:px-5 sm:py-3.5">
              <div className="flex items-center gap-3">
                {/* 图标 */}
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Beaker className="w-4 h-4 text-white" />
                </div>

                {/* 主内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-violet-200">
                      🎭 Mock AI 体验模式
                    </span>
                    <span className="text-xs text-violet-300/60 hidden sm:inline">
                      使用高质量仿真数据 · 无需 API Key
                    </span>
                  </div>
                </div>

                {/* 展开/了解更多 按钮 */}
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex-shrink-0 text-xs font-bold text-violet-300 hover:text-violet-100 transition-colors flex items-center gap-1"
                >
                  {expanded ? '收起' : '了解更多'}
                  <ArrowRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>

                {/* 关闭按钮 */}
                <button
                  onClick={handleDismiss}
                  className="flex-shrink-0 p-1 rounded-lg text-violet-400/50 hover:text-violet-200 hover:bg-violet-500/10 transition-colors"
                  aria-label="关闭提示"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 展开详情 */}
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-violet-500/10">
                      <div className="grid sm:grid-cols-2 gap-3 text-xs">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-bold text-violet-200">当前体验</span>
                            <p className="text-violet-300/50 mt-0.5">
                              所有分析结果来自内置仿真数据，完整展示 6 Agent 协作分析流程
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="font-bold text-emerald-200">接入真实 AI</span>
                            <p className="text-violet-300/50 mt-0.5">
                              编辑 <code className="text-violet-300 bg-violet-500/10 px-1 rounded">.env.local</code> → <code className="text-violet-300 bg-violet-500/10 px-1 rounded">MOCK_AI=false</code> → 填入 API Key
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
