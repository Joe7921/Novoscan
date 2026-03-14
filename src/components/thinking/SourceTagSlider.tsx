'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 来源标签滑入组件
 * Agent 发现新引用时，在卡片右侧滑入小标签，堆叠显示最近 3 个，停留 3s 后淡出
 * 标签可点击跳转到原始来源页面
 */

interface SourceLabel {
  label: string;
  agentId: string;
  timestamp: number;
  /** 可选：来源链接 URL，点击标签可跳转 */
  url?: string;
}

interface SourceTagSliderProps {
  /** 来源标签队列（按时间排序） */
  labels: SourceLabel[];
  /** Agent 主题色 */
  agentColor: string;
}

export default function SourceTagSlider({ labels, agentColor }: SourceTagSliderProps) {
  // 管理可见的标签（最多显示最近 3 个，自动移除过期标签）
  const [visibleLabels, setVisibleLabels] = useState<(SourceLabel & { id: string })[]>([]);
  const lastLenRef = useRef(0);

  // 当 labels 数组增长时添加新标签
  useEffect(() => {
    if (labels.length > lastLenRef.current) {
      const newLabels = labels.slice(lastLenRef.current);
      setVisibleLabels(prev => {
        const updated = [
          ...prev,
          ...newLabels.map(l => ({ ...l, id: `${l.timestamp}_${Math.random().toString(36).slice(2, 6)}` })),
        ];
        // 只保留最近 3 个
        return updated.slice(-3);
      });
    }
    lastLenRef.current = labels.length;
  }, [labels]);

  // 每个标签停留 3s 后自动淡出移除
  useEffect(() => {
    if (visibleLabels.length === 0) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setVisibleLabels(prev =>
        prev.filter(l => now - l.timestamp < 3000)
      );
    }, 500);

    return () => clearInterval(timer);
  }, [visibleLabels.length]);

  if (visibleLabels.length === 0) return null;

  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-1 items-end z-20 pr-1" style={{ pointerEvents: 'auto' }}>
      <AnimatePresence>
        {visibleLabels.map((label) => {
          // 标签内容（共用样式）
          const tagContent = (
            <>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: agentColor }} />
              {label.label}
              {/* 有链接时显示外链小图标 */}
              {label.url && (
                <svg className="w-2.5 h-2.5 flex-shrink-0 opacity-60" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4.5 1.5H2a.5.5 0 00-.5.5v8a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V7.5M7.5 1.5h3m0 0v3m0-3L6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </>
          );

          // 共用样式 class 和 style
          const tagClassName = "flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold whitespace-nowrap shadow-sm";
          const tagStyle = {
            background: `linear-gradient(135deg, ${agentColor}15, ${agentColor}08)`,
            border: `1px solid ${agentColor}30`,
            color: agentColor,
          };

          return (
            <motion.div
              key={label.id}
              initial={{ x: 80, opacity: 0, scale: 0.85 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              {label.url ? (
                // 有 URL 时渲染为可点击链接
                <a
                  href={label.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${tagClassName} cursor-pointer hover:shadow-md transition-shadow duration-200`}
                  style={tagStyle}
                  title={label.url}
                >
                  {tagContent}
                </a>
              ) : (
                // 无 URL 时渲染为普通标签
                <div className={tagClassName} style={tagStyle}>
                  {tagContent}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
