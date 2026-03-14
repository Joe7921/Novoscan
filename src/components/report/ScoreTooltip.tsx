import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info } from 'lucide-react';

interface ScoreTooltipProps {
    score?: number | string;
    type?: 'novelty' | 'academic' | 'industry' | 'consistency' | 'custom';
    title?: string;
    description?: string;
    className?: string;
    scoreClassName?: string;
    children?: React.ReactNode;
}

const getScoreDetails = (type: string) => {
    switch (type) {
        case 'novelty':
            return {
                title: '新颖度得分 (Novelty Score)',
                desc: '由 AI 模型综合评估。分数越高，表示该技术在学术和产业中的突破性越强，越具有开创性和稀缺价值。'
            };
        case 'academic':
            return {
                title: '学术创新分 (Academic Score)',
                desc: '基于学术界的关注度、引用网络分析、顶级期刊分布以及研究时效性等指标综合计算的结果。'
            };
        case 'industry':
            return {
                title: '产业创新分 (Industry Score)',
                desc: '基于 GitHub 开源活跃度、商业产品重叠率、开发者社区讨论热度与落地可行性等工程维度的评估结果。'
            };
        case 'consistency':
            return {
                title: '一致性得分 (Consistency Score)',
                desc: '交叉验证学术与产业生态的数据连续性和合理性，识别虚假热度或片面指标。'
            };
        default:
            return { title: '评分原理', desc: '基于系统多维数据模型计算得出的综合评分。' };
    }
};

export const ScoreTooltip: React.FC<ScoreTooltipProps> = ({
    score,
    type = 'custom',
    title,
    description,
    className = '',
    scoreClassName = '',
    children
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const details = type === 'custom' ? { title: title || '评分说明', desc: description || '' } : getScoreDetails(type);

    return (
        <div
            className={`relative inline-flex items-center group cursor-help ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={() => setIsHovered(true)}
            onTouchEnd={() => setIsHovered(false)}
        >
            {children ? children : (
                <span className={`inline-flex items-center gap-1 ${scoreClassName}`}>
                    {score}
                    <Info className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                </span>
            )}

            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3.5 bg-white/95 dark:bg-gray-800/95 rounded-xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 z-50 pointer-events-none"
                    >
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5 flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-indigo-500" />
                            {details.title}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                            {details.desc}
                        </div>

                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-white/95 dark:border-t-gray-800/95 drop-shadow-sm" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
