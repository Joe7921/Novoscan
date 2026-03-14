'use client';

import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { motion, Variants } from 'framer-motion';
import {
    Users, Swords, Dna, Star, Zap, BarChart3,
    Brain, Shield, Target, Sparkles, Activity, TrendingUp,
    ChevronRight
} from 'lucide-react';

interface HighlightShowcaseProps {
    language: Language;
}

/* ────────────── 亮点卡片数据 ────────────── */

interface HighlightItem {
    id: string;
    icon: React.ElementType;
    accentIcon: React.ElementType;
    titleZh: string;
    titleEn: string;
    descZh: string;
    descEn: string;
    gradient: string;
    glowColor: string;
    iconBg: string;
    iconColor: string;
    accentColor: string;
    span: string;
    linkHref: string;
    statZh: string;
    statEn: string;
}

const highlights: HighlightItem[] = [
    {
        id: 'multi-agent',
        icon: Users,
        accentIcon: Brain,
        titleZh: '多智能体协作引擎',
        titleEn: 'Multi-Agent Engine',
        descZh: '5 位 AI 专家——学术审查员、产业分析师、创新评估师、竞品侦探与仲裁官——并行推理、交叉验证，构建多维认知网络。',
        descEn: '5 AI experts — Academic Reviewer, Industry Analyst, Innovation Evaluator, Competitor Detective & Arbitrator — reason in parallel and cross-validate.',
        gradient: 'from-blue-600 via-indigo-500 to-violet-500',
        glowColor: 'rgba(99, 102, 241, 0.18)',
        iconBg: 'bg-indigo-500/10',
        iconColor: 'text-indigo-500',
        accentColor: 'text-indigo-300/40',
        span: 'sm:col-span-2',
        linkHref: '/docs#multi-agent',
        statZh: '5 智能体并行',
        statEn: '5 Agents Parallel',
    },
    {
        id: 'novo-debate',
        icon: Swords,
        accentIcon: Shield,
        titleZh: 'NovoDebate 辩论引擎',
        titleEn: 'NovoDebate Engine',
        descZh: '当智能体评分分歧超过阈值时，自动启动对抗式辩论——正方举证、反方质疑——消灭认知盲区。',
        descEn: 'When agent scores diverge beyond threshold, adversarial debate auto-triggers — eliminating cognitive blind spots.',
        gradient: 'from-rose-500 via-pink-500 to-fuchsia-500',
        glowColor: 'rgba(244, 63, 94, 0.18)',
        iconBg: 'bg-rose-500/10',
        iconColor: 'text-rose-500',
        accentColor: 'text-rose-300/40',
        span: '',
        linkHref: '/docs#novo-debate',
        statZh: '对抗式推理',
        statEn: 'Adversarial AI',
    },
    {
        id: 'novo-dna',
        icon: Dna,
        accentIcon: Target,
        titleZh: 'NovoDNA 创新图谱',
        titleEn: 'NovoDNA Innovation Map',
        descZh: '将创新概念映射到五维向量空间，可视化星空图谱定位你在创新宇宙中的坐标与蓝海机会。',
        descEn: 'Maps your innovation into a 5D vector space, visualizing a constellation map to locate your position and blue ocean opportunities.',
        gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
        glowColor: 'rgba(20, 184, 166, 0.18)',
        iconBg: 'bg-teal-500/10',
        iconColor: 'text-teal-500',
        accentColor: 'text-teal-300/40',
        span: '',
        linkHref: '/docs#novo-dna',
        statZh: '5 维向量定位',
        statEn: '5D Vector Space',
    },
    {
        id: 'novo-starchart',
        icon: Star,
        accentIcon: Activity,
        titleZh: 'NovoStarchart 星图雷达',
        titleEn: 'NovoStarchart Radar',
        descZh: '六维雷达量化评估——技术突破、学术价值、市场应用、跨域融合、网络协同和社会贡献——精准定位创新段位。',
        descEn: '6-axis radar quantifies Tech Breakthrough, Academic Value, Market Application, Cross-domain Fusion, Network Synergy & Social Impact.',
        gradient: 'from-amber-500 via-orange-500 to-yellow-500',
        glowColor: 'rgba(245, 158, 11, 0.18)',
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-500',
        accentColor: 'text-amber-300/40',
        span: '',
        linkHref: '/docs#starchart',
        statZh: '6 维量化评估',
        statEn: '6-Axis Radar',
    },
    {
        id: 'flash-mode',
        icon: Zap,
        accentIcon: Sparkles,
        titleZh: 'Flash 极速模式',
        titleEn: 'Flash Mode',
        descZh: '30 秒闪电分析——单模型直推架构，零等待获得核心创新评估，适合快速验证灵感。',
        descEn: '30-second lightning analysis — single-model direct architecture, zero-wait core innovation assessment.',
        gradient: 'from-sky-500 via-blue-500 to-indigo-500',
        glowColor: 'rgba(14, 165, 233, 0.18)',
        iconBg: 'bg-sky-500/10',
        iconColor: 'text-sky-500',
        accentColor: 'text-sky-300/40',
        span: '',
        linkHref: '/docs#flash',
        statZh: '30 秒出报告',
        statEn: '30s Reports',
    },
    {
        id: 'bizscan',
        icon: BarChart3,
        accentIcon: TrendingUp,
        titleZh: 'BizScan 商业评估',
        titleEn: 'BizScan Assessment',
        descZh: '从创新到商业的完整链路——市场规模评估、竞争格局分析、商业模式建议与融资策略规划，一站式完成。',
        descEn: 'Full chain from innovation to business — market sizing, competitive landscape, business model suggestions & funding strategy.',
        gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
        glowColor: 'rgba(139, 92, 246, 0.18)',
        iconBg: 'bg-violet-500/10',
        iconColor: 'text-violet-500',
        accentColor: 'text-violet-300/40',
        span: 'sm:col-span-2 lg:col-span-3',
        linkHref: '/bizscan',
        statZh: '完整商业链路',
        statEn: 'Full Biz Chain',
    },
];

/* ────────────── 动画预设 ────────────── */

const containerVars: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.15 },
    },
};

const cardVars: Variants = {
    hidden: { opacity: 0, y: 40, scale: 0.96 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: 'spring', damping: 22, stiffness: 180 },
    },
};

/* ────────────── Mini SVG 演示动画 ────────────── */

function MiniMultiAgent() {
    return (
        <svg viewBox="0 0 120 80" fill="none" className="w-full h-full opacity-20 group-hover:opacity-40 transition-opacity duration-700">
            <circle cx="60" cy="40" r="8" fill="#6366f1" opacity="0.6">
                <animate attributeName="r" values="8;10;8" dur="2s" repeatCount="indefinite" />
            </circle>
            {[0, 1, 2, 3, 4].map((i) => {
                const angle = (i * 72 - 90) * Math.PI / 180;
                const cx = 60 + Math.cos(angle) * 28;
                const cy = 40 + Math.sin(angle) * 28;
                return (
                    <g key={i}>
                        <line x1="60" y1="40" x2={cx} y2={cy} stroke="#6366f1" strokeWidth="1" opacity="0.3">
                            <animate attributeName="opacity" values="0.3;0.6;0.3" dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
                        </line>
                        <circle cx={cx} cy={cy} r="5" fill="#818cf8" opacity="0.5">
                            <animate attributeName="r" values="5;6;5" dur={`${2 + i * 0.2}s`} repeatCount="indefinite" />
                        </circle>
                    </g>
                );
            })}
        </svg>
    );
}

function MiniDebate() {
    return (
        <svg viewBox="0 0 100 70" fill="none" className="w-full h-full opacity-20 group-hover:opacity-40 transition-opacity duration-700">
            <rect x="5" y="10" width="35" height="16" rx="8" fill="#f43f5e" opacity="0.4">
                <animate attributeName="opacity" values="0.4;0.7;0.4" dur="2s" repeatCount="indefinite" />
            </rect>
            <rect x="10" y="14" width="18" height="2" rx="1" fill="#fff" opacity="0.6" />
            <rect x="10" y="19" width="12" height="2" rx="1" fill="#fff" opacity="0.4" />
            <rect x="60" y="30" width="35" height="16" rx="8" fill="#6366f1" opacity="0.4">
                <animate attributeName="opacity" values="0.4;0.7;0.4" dur="2.5s" repeatCount="indefinite" />
            </rect>
            <rect x="65" y="34" width="18" height="2" rx="1" fill="#fff" opacity="0.6" />
            <rect x="65" y="39" width="14" height="2" rx="1" fill="#fff" opacity="0.4" />
            <path d="M48 25 L52 30 L47 33 L53 40" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
                <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" />
            </path>
        </svg>
    );
}

function MiniDNA() {
    return (
        <svg viewBox="0 0 100 70" fill="none" className="w-full h-full opacity-20 group-hover:opacity-40 transition-opacity duration-700">
            {[[25, 15], [60, 20], [80, 45], [35, 55], [15, 40], [70, 35], [50, 50], [40, 25], [55, 60], [20, 30]].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={i === 3 ? 4 : 2} fill={i === 3 ? '#14b8a6' : '#5eead4'} opacity={0.3 + i * 0.05}>
                    <animate attributeName="opacity" values={`${0.3 + i * 0.05};${0.6 + i * 0.03};${0.3 + i * 0.05}`} dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                </circle>
            ))}
            <circle cx="35" cy="55" r="6" fill="none" stroke="#14b8a6" strokeWidth="1.5" opacity="0.5">
                <animate attributeName="r" values="6;9;6" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
            </circle>
        </svg>
    );
}

function MiniRadar() {
    return (
        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full opacity-20 group-hover:opacity-40 transition-opacity duration-700">
            {[40, 30, 20].map((r, i) => {
                const points = Array.from({ length: 6 }, (_, j) => {
                    const angle = (j * 60 - 90) * Math.PI / 180;
                    return `${50 + Math.cos(angle) * r},${50 + Math.sin(angle) * r}`;
                }).join(' ');
                return <polygon key={i} points={points} fill="none" stroke="#f59e0b" strokeWidth="0.5" opacity={0.2 + i * 0.1} />;
            })}
            <polygon points="50,15 80,32 75,68 50,85 25,62 30,28" fill="#f59e0b" fillOpacity="0.15" stroke="#f59e0b" strokeWidth="1" opacity="0.5">
                <animate attributeName="opacity" values="0.5;0.8;0.5" dur="3s" repeatCount="indefinite" />
            </polygon>
        </svg>
    );
}

function MiniFlash() {
    return (
        <svg viewBox="0 0 80 80" fill="none" className="w-full h-full opacity-20 group-hover:opacity-40 transition-opacity duration-700">
            <path d="M45 10 L30 38 L42 38 L35 70 L55 35 L43 35 Z" fill="#0ea5e9" opacity="0.4">
                <animate attributeName="opacity" values="0.4;0.8;0.4" dur="1.5s" repeatCount="indefinite" />
            </path>
            {[18, 28, 62, 72].map((y, i) => (
                <line key={i} x1="10" y1={y} x2={25 - i * 2} y2={y} stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" opacity="0.3">
                    <animate attributeName="x1" values="10;5;10" dur={`${1 + i * 0.3}s`} repeatCount="indefinite" />
                </line>
            ))}
        </svg>
    );
}

function MiniBizscan() {
    return (
        <svg viewBox="0 0 160 60" fill="none" className="w-full h-full opacity-20 group-hover:opacity-40 transition-opacity duration-700">
            {[20, 45, 30, 55, 40, 50, 35].map((h, i) => (
                <rect key={i} x={15 + i * 20} y={60 - h} width="12" height={h} rx="3" fill="#8b5cf6" opacity={0.2 + i * 0.05}>
                    <animate attributeName="height" values={`${h};${h + 5};${h}`} dur={`${2 + i * 0.2}s`} repeatCount="indefinite" />
                    <animate attributeName="y" values={`${60 - h};${55 - h};${60 - h}`} dur={`${2 + i * 0.2}s`} repeatCount="indefinite" />
                </rect>
            ))}
            <path d="M20 45 Q50 20 80 30 Q110 15 140 10" stroke="#a78bfa" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5">
                <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2.5s" repeatCount="indefinite" />
            </path>
        </svg>
    );
}

const MINI_ANIMATIONS: Record<string, React.FC> = {
    'multi-agent': MiniMultiAgent,
    'novo-debate': MiniDebate,
    'novo-dna': MiniDNA,
    'novo-starchart': MiniRadar,
    'flash-mode': MiniFlash,
    'bizscan': MiniBizscan,
};

/* ────────────── 颜色映射 ────────────── */

function getHexColor(iconColor: string): string {
    if (iconColor.includes('indigo')) return '#6366f1';
    if (iconColor.includes('rose')) return '#f43f5e';
    if (iconColor.includes('teal')) return '#14b8a6';
    if (iconColor.includes('amber')) return '#f59e0b';
    if (iconColor.includes('sky')) return '#0ea5e9';
    return '#8b5cf6';
}

/* ────────────── 主组件 ────────────── */

const HighlightShowcase: React.FC<HighlightShowcaseProps> = ({ language }) => {
    const isZh = language === 'zh';

    /* ────────── 实时统计数据 ────────── */
    const [stats, setStats] = React.useState<{
        totalAnalyses: number;
        totalDebates: number;
        totalDNA: number;
    } | null>(null);

    React.useEffect(() => {
        fetch('/api/platform-stats')
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => setStats(data))
            .catch(() => {
                // API 失败时使用 fallback 值
                setStats({ totalAnalyses: 10000, totalDebates: 2500, totalDNA: 8000 });
            });
    }, []);

    // 格式化数字：1234 → "1,234+"
    const fmt = (n: number) => `${n.toLocaleString()}+`;

    return (
        <section className="w-full max-w-6xl mx-auto py-16 sm:py-20 px-4 sm:px-6 relative z-10">
            {/* 板块标题 */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6 }}
                className="text-center mb-12 sm:mb-16"
            >
                <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.2em] uppercase text-indigo-500 bg-indigo-50 px-4 py-1.5 rounded-full mb-4">
                    <Sparkles className="w-3.5 h-3.5" />
                    {isZh ? '核心技术亮点' : 'Core Technology'}
                </span>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
                    {isZh ? '不止于搜索，重新定义创新评估' : 'Beyond Search, Redefining Innovation Assessment'}
                </h2>
                <p className="mt-3 text-sm sm:text-base text-gray-400 max-w-2xl mx-auto font-medium">
                    {isZh
                        ? '融合多智能体推理、对抗辩论、向量图谱等前沿 AI 技术，为你的创新想法提供前所未有的深度洞察。'
                        : 'Combining multi-agent reasoning, adversarial debate, vector mapping and cutting-edge AI for unprecedented deep insights.'}
                </p>

                {/* 使用统计总览徽章 — 实时数据 */}
                <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50/80 border border-indigo-100 px-3 py-1.5 rounded-full">
                        <Users className="w-3 h-3" />
                        {stats
                            ? (isZh ? `${fmt(stats.totalAnalyses)} 次深度分析` : `${fmt(stats.totalAnalyses)} Deep Analyses`)
                            : (isZh ? '加载中…' : 'Loading…')}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-600 bg-rose-50/80 border border-rose-100 px-3 py-1.5 rounded-full">
                        <Swords className="w-3 h-3" />
                        {stats
                            ? (isZh ? `${fmt(stats.totalDebates)} 次辩论推演` : `${fmt(stats.totalDebates)} Debates Triggered`)
                            : (isZh ? '加载中…' : 'Loading…')}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-600 bg-teal-50/80 border border-teal-100 px-3 py-1.5 rounded-full">
                        <Dna className="w-3 h-3" />
                        {stats
                            ? (isZh ? `${fmt(stats.totalDNA)} 创新基因入库` : `${fmt(stats.totalDNA)} Innovation Genes`)
                            : (isZh ? '加载中…' : 'Loading…')}
                    </span>
                </div>
            </motion.div>

            {/* Bento Grid 卡片 */}
            <motion.div
                variants={containerVars}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-60px' }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
            >
                {highlights.map((item) => {
                    const Icon = item.icon;
                    const MiniAnim = MINI_ANIMATIONS[item.id];
                    const hexColor = getHexColor(item.iconColor);

                    return (
                        <motion.div
                            key={item.id}
                            variants={cardVars}
                            whileHover={{
                                y: -6,
                                transition: { type: 'spring', damping: 18, stiffness: 300 },
                            }}
                            className={`group relative p-6 sm:p-7 rounded-3xl border border-gray-100/80 bg-white/95 overflow-hidden cursor-default transition-all duration-300 hover:border-gray-200/60 hover:shadow-xl ${item.span}`}
                        >
                            {/* 背景发光 */}
                            <div
                                className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                                style={{ background: item.glowColor }}
                            />

                            {/* 装饰性圆环 */}
                            <div className="absolute -top-8 -right-8 w-32 h-32 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                                <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
                                    <circle cx="60" cy="60" r="50" stroke={hexColor} strokeWidth="0.5" opacity="0.3">
                                        <animate attributeName="r" values="50;56;50" dur="3s" repeatCount="indefinite" />
                                    </circle>
                                    <circle cx="60" cy="60" r="35" stroke={hexColor} strokeWidth="0.5" opacity="0.2">
                                        <animate attributeName="r" values="35;40;35" dur="4s" repeatCount="indefinite" />
                                    </circle>
                                </svg>
                            </div>

                            {/* Mini SVG 演示动画 */}
                            <div className="absolute bottom-2 right-2 w-24 h-20 pointer-events-none">
                                {MiniAnim && <MiniAnim />}
                            </div>

                            {/* 顶部行：渐变标签 + 统计徽章 */}
                            <div className="flex items-center gap-2 mb-4 flex-wrap">
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${item.gradient} shadow-sm`}>
                                    <Icon className="w-3 h-3" strokeWidth={2.5} />
                                    <span>{isZh ? item.titleZh.split(' ')[0] : item.id.toUpperCase()}</span>
                                </div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-gray-500 bg-gray-100/80 border border-gray-200/60">
                                    <Activity className="w-2.5 h-2.5" />
                                    {isZh ? item.statZh : item.statEn}
                                </span>
                            </div>

                            {/* 图标 */}
                            <div className={`w-12 h-12 rounded-2xl ${item.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 mb-4`}>
                                <Icon className={`w-6 h-6 ${item.iconColor}`} strokeWidth={2} />
                            </div>

                            {/* 标题 */}
                            <h3 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight leading-snug mb-2">
                                {isZh ? item.titleZh : item.titleEn}
                            </h3>

                            {/* 描述 */}
                            <p className="text-sm text-gray-400 leading-relaxed font-medium relative z-10 mb-4">
                                {isZh ? item.descZh : item.descEn}
                            </p>

                            {/* 了解更多链接 */}
                            <Link
                                href={item.linkHref}
                                className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors duration-200 relative z-10 group/link"
                            >
                                <span>{isZh ? '了解更多' : 'Learn more'}</span>
                                <ChevronRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
                            </Link>
                        </motion.div>
                    );
                })}
            </motion.div>
        </section>
    );
};

export default React.memo(HighlightShowcase);
