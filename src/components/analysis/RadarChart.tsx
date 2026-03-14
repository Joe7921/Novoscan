import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/types';

// NovoStarchart 六维创新性评估雷达图

interface RadarDimension {
    key: string;
    nameZh: string;
    nameEn: string;
    score: number; // 0-100
    reasoning: string;
}

interface RadarChartProps {
    data?: RadarDimension[];
    language?: Language;
}

// 六维配色方案 - 每个维度独立渐变色
const DIMENSION_COLORS = [
    { stroke: '#6366f1', fill: 'rgba(99, 102, 241, 0.15)', dot: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)' },   // 技术突破 - 靛蓝
    { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)', dot: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },   // 商业模式 - 琥珀
    { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.15)', dot: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },    // 用户体验 - 翠绿
    { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.15)', dot: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)' },    // 组织能力 - 紫色
    { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.15)', dot: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },    // 网络协同 - 蓝色
    { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.15)', dot: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)' },     // 社会贡献 - 青色
];

// 默认六维数据（无后端数据时的兜底）
const DEFAULT_DATA: RadarDimension[] = [
    { key: 'techBreakthrough', nameZh: '技术突破', nameEn: 'Tech Breakthrough', score: 0, reasoning: '等待分析...' },
    { key: 'businessModel', nameZh: '商业模式', nameEn: 'Business Model', score: 0, reasoning: '等待分析...' },
    { key: 'userExperience', nameZh: '用户体验', nameEn: 'User Experience', score: 0, reasoning: '等待分析...' },
    { key: 'orgCapability', nameZh: '组织能力', nameEn: 'Org Capability', score: 0, reasoning: '等待分析...' },
    { key: 'networkEcosystem', nameZh: '网络协同', nameEn: 'Network', score: 0, reasoning: '等待分析...' },
    { key: 'socialImpact', nameZh: '社会贡献', nameEn: 'Social Impact', score: 0, reasoning: '等待分析...' },
];

// 综合评级映射
function getGrade(avgScore: number): { grade: string; color: string; label: string; labelEn: string } {
    if (avgScore >= 80) return { grade: 'S', color: '#a855f7', label: '颠覆创新', labelEn: 'Disruptive' };
    if (avgScore >= 65) return { grade: 'A', color: '#10b981', label: '高度创新', labelEn: 'Highly Innovative' };
    if (avgScore >= 50) return { grade: 'B', color: '#3b82f6', label: '具备创新', labelEn: 'Innovative' };
    if (avgScore >= 35) return { grade: 'C', color: '#f59e0b', label: '创新一般', labelEn: 'Moderate' };
    return { grade: 'D', color: '#ef4444', label: '创新不足', labelEn: 'Low Innovation' };
}

// 简化标签显示名
function getShortLabel(dim: RadarDimension, isZh: boolean): string {
    if (isZh) {
        // 取中文名的前4个字
        return dim.nameZh.length > 4 ? dim.nameZh.slice(0, 4) : dim.nameZh;
    }
    return dim.nameEn.length > 12 ? dim.nameEn.slice(0, 12) : dim.nameEn;
}

const RadarChart: React.FC<RadarChartProps> = ({ data, language = 'zh' }) => {
    const isZh = language === 'zh';
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const dimensions = useMemo(() => {
        if (data && data.length === 6) return data;
        return DEFAULT_DATA;
    }, [data]);

    const hasData = data && data.length === 6 && data.some(d => d.score > 0);

    const size = 340;
    const center = size / 2;
    const radius = (size / 2) * 0.6;

    // 计算坐标（从顶部开始，顺时针）
    const getCoord = (value: number, index: number) => {
        const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
        const distance = (value / 100) * radius;
        return {
            x: center + distance * Math.cos(angle),
            y: center + distance * Math.sin(angle),
        };
    };

    // 网格层级
    const gridLevels = [20, 40, 60, 80, 100];

    // 数据多边形
    const dataPoints = dimensions.map((d, i) => getCoord(d.score, i));
    const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

    // 综合评级
    const avgScore = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / 6);
    const grade = getGrade(avgScore);

    // Tooltip 位置计算
    const getTooltipPos = (index: number) => {
        const { x, y } = getCoord(110, index);
        return { x, y };
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-5 bg-white/95 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
            {/* 标题 */}
            <div className="w-full flex justify-between items-center mb-4 px-1 z-10">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 leading-none flex items-center gap-2">
                        <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 text-transparent bg-clip-text">
                            NovoStarchart
                        </span>
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1">
                        {isZh ? '六维创新质量体检 — 这个创意好不好' : '6D Innovation Quality Check — How good is this idea'}
                    </p>
                </div>
                {hasData && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: 'spring' }}
                        className="flex items-center gap-1.5"
                    >
                        <span
                            className="text-xl font-black"
                            style={{ color: grade.color }}
                        >
                            {grade.grade}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500">
                            {isZh ? grade.label : grade.labelEn}
                        </span>
                    </motion.div>
                )}
            </div>

            {/* 雷达图主体 */}
            <div className="relative w-full max-w-[340px] aspect-square flex items-center justify-center">
                <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full overflow-visible">
                    <defs>
                        {/* 数据区域径向渐变 */}
                        <radialGradient id="novoStarGrad" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="rgba(99, 102, 241, 0.25)" />
                            <stop offset="70%" stopColor="rgba(139, 92, 246, 0.12)" />
                            <stop offset="100%" stopColor="rgba(6, 182, 212, 0.05)" />
                        </radialGradient>
                        {/* 中心光晕 */}
                        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor={grade.color} stopOpacity="0.15" />
                            <stop offset="100%" stopColor={grade.color} stopOpacity="0" />
                        </radialGradient>
                    </defs>

                    {/* 网格线 */}
                    <g>
                        {gridLevels.map((level, li) => {
                            const points = Array.from({ length: 6 }).map((_, i) => {
                                const { x, y } = getCoord(level, i);
                                return `${x},${y}`;
                            }).join(' ');
                            return (
                                <polygon
                                    key={`grid-${level}`}
                                    points={points}
                                    fill="none"
                                    stroke={li === gridLevels.length - 1 ? '#cbd5e1' : '#f1f5f9'}
                                    strokeWidth={li === gridLevels.length - 1 ? '1.5' : '0.8'}
                                    strokeDasharray={li < gridLevels.length - 1 ? '2 3' : 'none'}
                                />
                            );
                        })}
                    </g>

                    {/* 轴线 + 彩色端点 */}
                    {dimensions.map((_, i) => {
                        const { x, y } = getCoord(100, i);
                        const color = DIMENSION_COLORS[i];
                        return (
                            <g key={`axis-${i}`}>
                                <line
                                    x1={center}
                                    y1={center}
                                    x2={x}
                                    y2={y}
                                    stroke="#e2e8f0"
                                    strokeWidth="1"
                                />
                                {/* 轴线端点彩色小圆 */}
                                <circle
                                    cx={x}
                                    cy={y}
                                    r="3"
                                    fill={color.dot}
                                    opacity={0.4}
                                />
                            </g>
                        );
                    })}

                    {/* 中心光晕 */}
                    {hasData && (
                        <circle
                            cx={center}
                            cy={center}
                            r={radius * 0.4}
                            fill="url(#centerGlow)"
                        />
                    )}

                    {/* 数据区域填充 */}
                    {hasData && (
                        <motion.polygon
                            points={dataPolygon}
                            fill="url(#novoStarGrad)"
                            stroke="url(#novoStarStroke)"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            style={{ transformOrigin: `${center}px ${center}px` }}
                        />
                    )}

                    {/* 数据区域描边（多彩渐变效果 - 通过分段线实现） */}
                    {hasData && dataPoints.map((point, i) => {
                        const nextPoint = dataPoints[(i + 1) % 6];
                        const color = DIMENSION_COLORS[i];
                        return (
                            <motion.line
                                key={`edge-${i}`}
                                x1={point.x}
                                y1={point.y}
                                x2={nextPoint.x}
                                y2={nextPoint.y}
                                stroke={color.stroke}
                                strokeWidth="2"
                                strokeLinecap="round"
                                opacity={0.7}
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 0.6, delay: 0.3 + i * 0.08 }}
                            />
                        );
                    })}

                    {/* 数据圆点 + 脉动动画 */}
                    {hasData && dataPoints.map((point, i) => {
                        const color = DIMENSION_COLORS[i];
                        const score = dimensions[i].score;
                        const isHovered = hoveredIndex === i;
                        // 高分维度的脉动更明显
                        const pulseScale = score >= 70 ? 2.5 : score >= 50 ? 2 : 1.5;

                        return (
                            <g key={`point-${i}`}>
                                {/* 脉动光环 */}
                                {score >= 50 && (
                                    <motion.circle
                                        cx={point.x}
                                        cy={point.y}
                                        r="4"
                                        fill="none"
                                        stroke={color.stroke}
                                        strokeWidth="1"
                                        initial={{ scale: 1, opacity: 0.6 }}
                                        animate={{
                                            scale: [1, pulseScale],
                                            opacity: [0.6, 0],
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            delay: i * 0.3,
                                        }}
                                        style={{ transformOrigin: `${point.x}px ${point.y}px` }}
                                    />
                                )}
                                {/* 主数据点 */}
                                <motion.circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={isHovered ? 6 : 4.5}
                                    fill="#ffffff"
                                    stroke={color.stroke}
                                    strokeWidth={isHovered ? 3 : 2.5}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: 0.6 + i * 0.1, type: 'spring' }}
                                    style={{ cursor: 'pointer', filter: isHovered ? `drop-shadow(0 0 6px ${color.glow})` : 'none' }}
                                    onMouseEnter={() => setHoveredIndex(i)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                />
                            </g>
                        );
                    })}

                    {/* 维度标签 */}
                    {dimensions.map((d, i) => {
                        const labelDist = 125;
                        const { x, y } = getCoord(labelDist, i);
                        const isLeft = x < center - 10;
                        const isRight = x > center + 10;
                        const textAnchor = isLeft ? 'end' : isRight ? 'start' : 'middle';
                        const yOffset = y < center - 10 ? -6 : y > center + 10 ? 12 : 4;
                        const color = DIMENSION_COLORS[i];
                        const isHovered = hoveredIndex === i;

                        return (
                            <g key={`label-${i}`}>
                                <motion.text
                                    x={x}
                                    y={y + yOffset}
                                    textAnchor={textAnchor}
                                    className={`text-[10px] font-bold tracking-wide ${isHovered ? 'fill-gray-900' : 'fill-gray-600'}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.8 }}
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setHoveredIndex(i)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                >
                                    {getShortLabel(d, isZh)}
                                </motion.text>
                                {/* 得分标注 */}
                                {hasData && (
                                    <motion.text
                                        x={x}
                                        y={y + yOffset + 13}
                                        textAnchor={textAnchor}
                                        className="text-[10px] font-black"
                                        style={{ fill: color.stroke }}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 1 }}
                                    >
                                        {d.score}
                                    </motion.text>
                                )}
                            </g>
                        );
                    })}

                    {/* 中心装饰 */}
                    {hasData && (
                        <g>
                            <circle cx={center} cy={center} r="2" fill={grade.color} opacity={0.6} />
                        </g>
                    )}
                </svg>

                {/* Tooltip */}
                <AnimatePresence>
                    {hoveredIndex !== null && hasData && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                            className="absolute z-50 bg-white/95 shadow-xl rounded-xl border border-gray-200 p-3 min-w-[180px] max-w-[240px] pointer-events-none"
                            style={{
                                left: '50%',
                                bottom: '4px',
                                transform: 'translateX(-50%)',
                            }}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <div
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: DIMENSION_COLORS[hoveredIndex].stroke }}
                                />
                                <span className="text-xs font-bold text-gray-900">
                                    {isZh ? dimensions[hoveredIndex].nameZh : dimensions[hoveredIndex].nameEn}
                                </span>
                                <span
                                    className="text-xs font-black ml-auto"
                                    style={{ color: DIMENSION_COLORS[hoveredIndex].stroke }}
                                >
                                    {dimensions[hoveredIndex].score}/100
                                </span>
                            </div>
                            <p className="text-[10px] text-gray-600 leading-relaxed line-clamp-3">
                                {dimensions[hoveredIndex].reasoning}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 底部微型图例 */}
            {hasData && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                    className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3 px-2"
                >
                    {dimensions.map((d, i) => (
                        <div
                            key={d.key}
                            className="flex items-center gap-1 cursor-pointer"
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            <div
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: DIMENSION_COLORS[i].stroke }}
                            />
                            <span className="text-[9px] text-gray-500 font-medium">
                                {getShortLabel(d, isZh)}
                            </span>
                        </div>
                    ))}
                </motion.div>
            )}
        </div>
    );
};

export default React.memo(RadarChart);
