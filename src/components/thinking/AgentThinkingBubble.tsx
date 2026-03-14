'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Agent 思考气泡组件
 * 在 Agent 终端卡片下方显示半透明气泡，逐字打字机效果展示思考片段
 */

interface AgentThinkingBubbleProps {
  /** 当前思考文本 */
  snippet: string;
  /** Agent 主题色 */
  agentColor: string;
}

export default function AgentThinkingBubble({ snippet, agentColor }: AgentThinkingBubbleProps) {
  // 打字机状态：逐字显示的文本
  const [displayText, setDisplayText] = useState('');
  // 当前正在打字的目标文本
  const targetRef = useRef('');
  // 打字机 interval 引用
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // 用于跟踪 snippet 切换的 key
  const [snippetKey, setSnippetKey] = useState(0);

  useEffect(() => {
    if (!snippet) return;

    // snippet 变化时重置打字机
    targetRef.current = snippet;
    setDisplayText('');
    setSnippetKey(prev => prev + 1);

    let charIdx = 0;
    // 清除旧的 interval
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      charIdx++;
      if (charIdx <= targetRef.current.length) {
        setDisplayText(targetRef.current.slice(0, charIdx));
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, 30); // ~30ms/字

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [snippet]);

  if (!snippet) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={snippetKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.3 }}
        className="relative mt-1.5 ml-3 mr-2"
      >
        {/* 左侧小三角指向 Agent 卡片 */}
        <div
          className="absolute -left-1.5 top-2.5 w-0 h-0"
          style={{
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
            borderRight: `6px solid ${agentColor}20`,
          }}
        />
        {/* 气泡主体 */}
        <div
          className="relative rounded-lg px-3 py-2 text-[11px] leading-relaxed font-medium backdrop-blur-sm"
          style={{
            background: `linear-gradient(135deg, rgba(0,0,0,0.72), rgba(0,0,0,0.60))`,
            color: 'rgba(255,255,255,0.92)',
            borderLeft: `2px solid ${agentColor}60`,
          }}
        >
          <span>{displayText}</span>
          {/* 打字光标 */}
          {displayText.length < snippet.length && (
            <motion.span
              className="inline-block w-[2px] h-3 ml-0.5 align-middle"
              style={{ backgroundColor: agentColor }}
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
