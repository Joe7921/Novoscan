'use client';

import React, { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

/**
 * 实时统计条组件
 * 在 Agent 区域上方展示一行实时统计数据，数字使用 CountUp 动画
 * 支持中英文国际化
 */

interface LiveStatsBarProps {
  /** 已分析文献数 */
  papers: number;
  /** 竞品数 */
  competitors: number;
  /** 网页数 */
  webPages: number;
  /** 语言（默认中文） */
  language?: 'zh' | 'en';
}

/** 带 CountUp 动画的数字展示 */
function AnimatedNumber({ value, color }: { value: number; color: string }) {
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) => Math.round(v));
  const displayRef = useRef<HTMLSpanElement>(null);
  const prevRef = useRef(0);

  useEffect(() => {
    // 从上一个值动画到新值
    const controls = animate(motionVal, value, {
      duration: 0.8,
      ease: 'easeOut',
    });
    prevRef.current = value;
    return controls.stop;
  }, [value, motionVal]);

  // 订阅 motion value 变化并手动更新 DOM（避免频繁 re-render）
  useEffect(() => {
    const unsubscribe = rounded.on('change', (v) => {
      if (displayRef.current) {
        displayRef.current.textContent = String(v);
      }
    });
    return unsubscribe;
  }, [rounded]);

  return (
    <span
      ref={displayRef}
      className="font-black tabular-nums"
      style={{ color }}
    >
      {Math.round(value)}
    </span>
  );
}

export default function LiveStatsBar({ papers, competitors, webPages, language = 'zh' }: LiveStatsBarProps) {
  // 如果所有数据都是 0，不显示
  if (papers === 0 && competitors === 0 && webPages === 0) return null;

  const isZh = language === 'zh';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex items-center justify-center gap-3 sm:gap-5 px-4 py-2.5 mb-3 rounded-xl text-xs sm:text-sm font-medium"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(248,250,252,0.95))',
        border: '1px solid rgba(226,232,240,0.8)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {papers > 0 && (
        <div className="flex items-center gap-1.5">
          <span>📚</span>
          {isZh ? (
            <>
              <span className="text-gray-500">已分析</span>
              <AnimatedNumber value={papers} color="#4285F4" />
              <span className="text-gray-500">篇文献</span>
            </>
          ) : (
            <>
              <AnimatedNumber value={papers} color="#4285F4" />
              <span className="text-gray-500">{papers === 1 ? 'paper' : 'papers'}</span>
            </>
          )}
        </div>
      )}
      {papers > 0 && (competitors > 0 || webPages > 0) && (
        <span className="text-gray-300">·</span>
      )}
      {competitors > 0 && (
        <div className="flex items-center gap-1.5">
          <span>🔎</span>
          <AnimatedNumber value={competitors} color="#34A853" />
          <span className="text-gray-500">{isZh ? '个竞品' : (competitors === 1 ? 'competitor' : 'competitors')}</span>
        </div>
      )}
      {competitors > 0 && webPages > 0 && (
        <span className="text-gray-300">·</span>
      )}
      {webPages > 0 && (
        <div className="flex items-center gap-1.5">
          <span>🌐</span>
          <AnimatedNumber value={webPages} color="#EA4335" />
          <span className="text-gray-500">{isZh ? '条网页' : (webPages === 1 ? 'webpage' : 'webpages')}</span>
        </div>
      )}
    </motion.div>
  );
}
