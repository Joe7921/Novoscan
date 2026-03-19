'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * 搜索框打字机效果占位符
 * 输入框为空时循环展示示例查询的打字效果。
 * 用户点击/聚焦后停止动画。
 */

const EXAMPLES_ZH = [
    'AI 生成式药物研发的临床应用前景',
    '具身智能家庭服务机器人技术可行性',
    '脑机接口消费级可穿戴产品创新空间',
    '碳捕获结合区块链碳交易市场潜力',
    '大语言模型在法律合规自动化中的应用',
    '合成生物学驱动的新型材料开发方向',
];

const EXAMPLES_EN = [
    'AI-driven drug discovery for rare diseases',
    'Embodied home robot with multimodal perception',
    'Consumer-grade BCI for productivity augmentation',
    'Carbon capture with blockchain carbon credits',
    'LLM applications in legal compliance automation',
    'Synthetic biology-driven novel materials R&D',
];

interface TypewriterPlaceholderProps {
    language: 'zh' | 'en';
    isActive: boolean; // 输入框是否有内容或处于聚焦状态
}

export default function TypewriterPlaceholder({ language, isActive }: TypewriterPlaceholderProps) {
    const [text, setText] = useState('');
    const [exampleIdx, setExampleIdx] = useState(0);
    const [charIdx, setCharIdx] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const examples = language === 'zh' ? EXAMPLES_ZH : EXAMPLES_EN;

    useEffect(() => {
        // 有内容或聚焦时停止打字
        if (isActive) {
            setText('');
            return;
        }

        const currentExample = examples[exampleIdx % examples.length];

        timerRef.current = setTimeout(() => {
            if (!isDeleting) {
                // 打字阶段
                if (charIdx < currentExample.length) {
                    setText(currentExample.slice(0, charIdx + 1));
                    setCharIdx(prev => prev + 1);
                } else {
                    // 打完后暂停 2 秒再删除
                    setTimeout(() => setIsDeleting(true), 2000);
                }
            } else {
                // 删除阶段
                if (charIdx > 0) {
                    setCharIdx(prev => prev - 1);
                    setText(currentExample.slice(0, charIdx - 1));
                } else {
                    // 删完后切换到下一个示例
                    setIsDeleting(false);
                    setExampleIdx(prev => prev + 1);
                }
            }
        }, isDeleting ? 25 : 60);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [charIdx, isDeleting, exampleIdx, isActive, examples]);

    if (isActive) return null;

    return (
        <div className="absolute inset-0 flex items-start pointer-events-none px-4 pt-4 sm:pt-5">
            <span className="text-gray-400/70 text-sm sm:text-base font-medium truncate">
                {text}
                <span className="animate-pulse text-novo-blue/60">|</span>
            </span>
        </div>
    );
}
