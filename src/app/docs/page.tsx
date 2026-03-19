'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, BookOpen, Cpu, Search, Brain, ShieldCheck,
    Users, Database, Star, MessageCircle, Lock, HelpCircle,
    ChevronRight, Sparkles, Lightbulb, GitBranch, Layers,
    Zap, Eye, Target, BarChart3, Shield, Menu, X,
    Activity, TrendingUp, FileBarChart2, Gauge, Flame,
    Cog, Briefcase, Sigma, Globe, Coins, Dna, Repeat,
    Share2, Radar, Timer, Bell, Plug, Code, FlaskConical
} from 'lucide-react';
import WorkspaceShell from '@/components/layout/WorkspaceShell';
import BottomTabBar from '@/components/layout/BottomTabBar';
import { Language } from '@/types';

/* ============================================================
   章节数据定义 — 层级结构
   ============================================================ */

interface Section {
    id: string;
    title: string;
    icon: React.ReactNode;
    color: string;
}

interface Chapter {
    id: string;
    title: string;
    icon: React.ReactNode;
    color: string;
    children: Section[];
}

const CHAPTERS: Chapter[] = [
    {
        id: 'ch-brand', title: '品牌概览', icon: <BookOpen className="w-4 h-4" />, color: 'text-novo-blue',
        children: [
            { id: 'overview', title: '什么是 Novoscan', icon: <BookOpen className="w-3.5 h-3.5" />, color: 'text-novo-blue' },
            { id: 'how-it-works', title: '工作原理', icon: <Cpu className="w-3.5 h-3.5" />, color: 'text-novo-red' },
        ],
    },
    {
        id: 'ch-novoscan', title: 'Novoscan 学术+产业查重', icon: <Sparkles className="w-4 h-4" />, color: 'text-novo-blue',
        children: [
            { id: 'novoscan-deep', title: 'Novoscan 深度解读', icon: <Sparkles className="w-3.5 h-3.5" />, color: 'text-novo-blue' },
            { id: 'flash-mode', title: 'Novoscan Flash 极速模式', icon: <Zap className="w-3.5 h-3.5" />, color: 'text-yellow-500' },
            { id: 'novo-discover', title: 'NovoDiscover 跨域探索', icon: <Globe className="w-3.5 h-3.5" />, color: 'text-purple-500' },
            { id: 'novo-debate', title: 'NovoDebate 辩论引擎', icon: <Repeat className="w-3.5 h-3.5" />, color: 'text-rose-500' },
            { id: 'privacy-mode', title: '隐私检索模式', icon: <Lock className="w-3.5 h-3.5" />, color: 'text-violet-500' },
        ],
    },
    {
        id: 'ch-clawscan', title: 'Clawscan Skill 查重', icon: <Cog className="w-4 h-4" />, color: 'text-orange-500',
        children: [
            { id: 'skill-check-deep', title: 'Clawscan 深度解读', icon: <Cog className="w-3.5 h-3.5" />, color: 'text-orange-500' },
        ],
    },
    {
        id: 'ch-bizscan', title: 'Bizscan 商业评估', icon: <Briefcase className="w-4 h-4" />, color: 'text-pink-500',
        children: [
            { id: 'bizscan-deep', title: 'Bizscan 深度解读', icon: <Briefcase className="w-3.5 h-3.5" />, color: 'text-pink-500' },
        ],
    },
    {
        id: 'ch-platform', title: '平台功能与服务', icon: <Layers className="w-4 h-4" />, color: 'text-amber-500',
        children: [
            { id: 'novo-dna', title: 'NovoDNA 创新基因图谱', icon: <Dna className="w-3.5 h-3.5" />, color: 'text-emerald-500' },
            { id: 'novo-mind', title: 'NovoMind 创新人格评测', icon: <FlaskConical className="w-3.5 h-3.5" />, color: 'text-fuchsia-500' },
            { id: 'novo-evo', title: 'NovoscanEVO 智能体进化', icon: <Brain className="w-3.5 h-3.5" />, color: 'text-violet-500' },

            { id: 'public-share', title: '公开报告与社交分享', icon: <Share2 className="w-3.5 h-3.5" />, color: 'text-teal-500' },
            { id: 'mcp-service', title: 'MCP 远程服务', icon: <Plug className="w-3.5 h-3.5" />, color: 'text-orange-500' },
        ],
    },
    {
        id: 'ch-arch', title: '核心技术架构', icon: <Cpu className="w-4 h-4" />, color: 'text-purple-500',
        children: [
            { id: 'multi-agent', title: '多代理架构', icon: <Users className="w-3.5 h-3.5" />, color: 'text-purple-500' },
            { id: 'data-sources', title: '数据源与检索引擎', icon: <Database className="w-3.5 h-3.5" />, color: 'text-amber-500' },
            { id: 'scoring', title: 'NovoStarchart 评分', icon: <Star className="w-3.5 h-3.5" />, color: 'text-yellow-500' },
            { id: 'follow-up', title: '智能追问系统', icon: <MessageCircle className="w-3.5 h-3.5" />, color: 'text-teal-500' },
        ],
    },
    {
        id: 'ch-eng', title: '工程与数据', icon: <Flame className="w-4 h-4" />, color: 'text-rose-500',
        children: [
            { id: 'tech-highlights', title: '工程亮点深度解读', icon: <Flame className="w-3.5 h-3.5" />, color: 'text-rose-500' },
            { id: 'data-utilization', title: '数据高利用率架构', icon: <Activity className="w-3.5 h-3.5" />, color: 'text-cyan-500' },
            { id: 'report-arch', title: '三层递进报告架构', icon: <FileBarChart2 className="w-3.5 h-3.5" />, color: 'text-violet-500' },
            { id: 'trend-system', title: '创新趋势系统', icon: <TrendingUp className="w-3.5 h-3.5" />, color: 'text-emerald-500' },
        ],
    },
    {
        id: 'ch-trust', title: '透明与信任', icon: <Shield className="w-4 h-4" />, color: 'text-sky-500',
        children: [
            { id: 'math-foundation', title: '评分系统数学基础', icon: <Sigma className="w-3.5 h-3.5" />, color: 'text-sky-500' },
            { id: 'privacy', title: '隐私与安全', icon: <Lock className="w-3.5 h-3.5" />, color: 'text-gray-600' },
            { id: 'faq', title: '常见问题', icon: <HelpCircle className="w-3.5 h-3.5" />, color: 'text-indigo-500' },
        ],
    },
];

// 扁平化所有子章节用于滚动监听
const ALL_SECTIONS = CHAPTERS.flatMap(ch => ch.children);

// 根据子章节 id 找到所属大章节 id
function getParentChapterId(sectionId: string): string {
    for (const ch of CHAPTERS) {
        if (ch.children.some(s => s.id === sectionId)) return ch.id;
    }
    return CHAPTERS[0].id;
}

/* ============================================================
   文档页面主组件
   ============================================================ */

export default function DocsPage() {
    const [language, setLanguage] = useState<'zh' | 'en'>('zh');
    const [activeSection, setActiveSection] = useState('overview');
    const [isMobileTocOpen, setIsMobileTocOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);

    const activeChapterId = getParentChapterId(activeSection);

    // 滚动监听 - 高亮当前章节
    useEffect(() => {
        const handleScroll = () => {
            // 高亮当前章节
            const offset = 120;
            for (let i = ALL_SECTIONS.length - 1; i >= 0; i--) {
                const el = document.getElementById(ALL_SECTIONS[i].id);
                if (el && el.getBoundingClientRect().top <= offset) {
                    setActiveSection(ALL_SECTIONS[i].id);
                    break;
                }
            }
            // 是否已滚动（用于折叠目录栏）
            setIsScrolled(window.scrollY > 80);
            // 阅读进度
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            setScrollProgress(docHeight > 0 ? Math.min(1, window.scrollY / docHeight) : 0);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToSection = useCallback((id: string) => {
        // 先关闭移动端面板，等待 DOM 更新完毕后再执行滚动
        setIsMobileTocOpen(false);
        setActiveSection(id);
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) {
                const offset = 100;
                const y = el.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        }, 80);
    }, []);

    return (
        <WorkspaceShell>
        <div className="min-h-screen relative flex flex-col text-gray-900 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 max-w-[100vw] pb-20 lg:pb-0" style={{ overflowX: 'clip' }}>
            {/* 背景装饰 */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-novo-blue/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-novo-red/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-novo-yellow/5 rounded-full blur-[120px] pointer-events-none" />


            {/* 移动端目录切换按钮 — 滚动时自动折叠缩小 */}
            <div className={`lg:hidden sticky top-16 z-40 transition-all duration-300 ${isScrolled ? 'bg-white shadow-md px-3 py-1.5' : 'bg-white px-4 py-3'} ${isMobileTocOpen ? 'border-transparent' : 'border-b border-gray-200'}`}>
                <button
                    onClick={() => setIsMobileTocOpen(!isMobileTocOpen)}
                    className={`flex justify-between items-center w-full font-bold text-gray-700 transition-all duration-300 ${isScrolled ? 'text-xs' : 'text-sm'}`}
                >
                    <div className="flex items-center gap-1.5">
                        {isMobileTocOpen
                            ? <X className={`text-novo-red transition-all duration-300 ${isScrolled ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                            : <Menu className={`text-novo-blue transition-all duration-300 ${isScrolled ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                        }
                        <span className={isMobileTocOpen ? 'text-gray-900' : ''}>目录导航</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-gray-500 font-medium bg-gray-100/80 rounded-full border border-gray-200 transition-all duration-300 ${isScrolled ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}>
                        <span className="truncate max-w-[120px]">
                            {ALL_SECTIONS.find(s => s.id === activeSection)?.title || '选择章节'}
                        </span>
                        <ChevronRight className={`w-3 h-3 transition-transform ${isMobileTocOpen ? 'rotate-90' : ''}`} />
                    </div>
                </button>

                {/* 阅读进度条 */}
                <div className={`absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-novo-blue via-novo-red to-novo-yellow transition-all duration-150 rounded-full`}
                    style={{ width: `${scrollProgress * 100}%` }}
                />

                {/* 下拉面板 */}
                <AnimatePresence>
                    {isMobileTocOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, height: 'auto', filter: 'blur(0px)' }}
                            exit={{ opacity: 0, height: 0, filter: 'blur(4px)' }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="absolute top-full left-0 w-full bg-white border-b border-gray-200 shadow-2xl overflow-hidden z-40"
                        >
                            <div className="max-h-[65vh] overflow-y-auto px-4 py-4 flex flex-col gap-1.5 custom-scrollbar">
                                {CHAPTERS.map(ch => (
                                    <div key={ch.id} className="mb-2">
                                        <div className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${ch.color}`}>
                                            {ch.icon}
                                            {ch.title}
                                        </div>
                                        <div className="flex flex-col gap-0.5 mt-1">
                                            {ch.children.map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => scrollToSection(s.id)}
                                                    className={`flex items-center gap-2 pl-7 pr-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left w-full ${activeSection === s.id
                                                        ? 'bg-novo-blue/10 text-novo-blue border border-novo-blue/20 shadow-sm'
                                                        : 'text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <span className={activeSection === s.id ? s.color : 'text-gray-400'}>{s.icon}</span>
                                                    <span className="truncate flex-1">{s.title}</span>
                                                    {activeSection === s.id && (
                                                        <motion.div
                                                            layoutId="mobile-toc-indicator"
                                                            className="w-1.5 h-1.5 rounded-full bg-novo-blue flex-shrink-0"
                                                        />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 主体内容区 — 侧边栏与内容共处一个 flex 容器，侧边栏从头 sticky */}
            <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 xl:px-10 flex gap-10 pb-20">

                {/* 左侧目录 — 桌面端（层级结构），从 Navbar 下方开始 sticky */}
                <aside className="hidden lg:block w-64 flex-shrink-0">
                    <div className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 pt-8">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 px-3">目录</div>
                        <nav className="flex flex-col gap-1">
                            {CHAPTERS.map(ch => (
                                <div key={ch.id} className="mb-1.5">
                                    {/* 大章节标题 — 分组用，不可点击 */}
                                    <div className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-colors ${activeChapterId === ch.id ? ch.color : 'text-gray-400'
                                        }`}>
                                        {ch.icon}
                                        {ch.title}
                                    </div>
                                    {/* 子章节 — 可点击跳转 */}
                                    <div className="flex flex-col gap-0.5 mt-0.5">
                                        {ch.children.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => scrollToSection(s.id)}
                                                className={`flex items-center gap-2 pl-7 pr-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 text-left ${activeSection === s.id
                                                    ? 'bg-white shadow-sm border border-gray-200 text-gray-900 font-semibold'
                                                    : 'text-gray-500 hover:bg-white/95 hover:text-gray-800'
                                                    }`}
                                            >
                                                <span className={activeSection === s.id ? s.color : 'text-gray-400'}>{s.icon}</span>
                                                <span className="truncate">{s.title}</span>
                                                {activeSection === s.id && (
                                                    <motion.div
                                                        layoutId="toc-indicator"
                                                        className="ml-auto w-1.5 h-1.5 rounded-full bg-novo-blue flex-shrink-0"
                                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                                                    />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </nav>
                    </div>
                </aside>

                {/* 右侧文档内容（包含页面头部） */}
                <main className="flex-1 min-w-0">
                    {/* 页面头部 */}
                    <div className="pt-8 pb-6">
                        <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-novo-blue font-bold text-sm transition-colors mb-6">
                            <ArrowLeft className="w-4 h-4" />
                            返回首页
                        </Link>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-novo-blue/10 rounded-xl flex items-center justify-center border border-novo-blue/20">
                                    <BookOpen className="w-5 h-5 text-novo-blue" />
                                </div>
                                <span className="text-xs font-bold text-novo-blue/80 uppercase tracking-widest">Documentation</span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900 mb-3">
                                Novoscan 官方文档
                            </h1>
                            <p className="text-base sm:text-lg text-gray-500 max-w-2xl font-medium">
                                深入了解 Novoscan 的技术架构、多代理推理引擎、数据检索体系和产品功能。
                            </p>
                        </motion.div>
                    </div>

                    <div className="max-w-3xl">

                        {/* ========== 大章节一：品牌概览 ========== */}
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-xs font-black text-novo-blue bg-novo-blue/10 px-2.5 py-1 rounded-full">一</span>
                            <span className="text-sm font-black text-gray-800 tracking-wide">品牌概览</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-novo-blue/20 to-transparent" />
                        </div>

                        {/* ==================== §1 什么是 Novoscan ==================== */}
                        <DocSection id="overview">
                            <SectionHeader icon={<BookOpen />} color="blue" title="什么是 Novoscan" />
                            <div className="text-center mb-6">
                                <p className="text-lg font-black text-gray-800 tracking-tight">创新查重 / 评估领域的垂直化 AI 代理应用</p>
                                <p className="text-sm text-gray-500 mt-1 italic">「省下的是资源，算出的是未来」</p>
                            </div>
                            <p className="doc-text">
                                <strong>Novoscan</strong> 是基于多智能体（Multi-Agent）架构的创新性分析品牌。
                                它整合了三条垂直业务线，覆盖从学术查新、开发者生态评估到商业想法验证的完整创新评估闭环——
                                帮助用户在投入大量资源之前，用 AI 快速「算出」创新方向的可行性。
                            </p>

                            <h3 className="doc-h3 mt-8">三大业务线</h3>
                            <div className="grid sm:grid-cols-3 gap-4 mt-4">
                                <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/40">
                                    <div className="text-lg font-black text-novo-blue">Novoscan</div>
                                    <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mt-1">学术 + 产业创新查重</div>
                                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">穿透百万级学术论文和产业信号网络，6 名 AI 专家交叉验证，输出量化创新指标和 NovoStarchart 雷达图。</p>
                                </div>
                                <div className="p-4 rounded-2xl border border-orange-200 bg-orange-50/40">
                                    <div className="text-lg font-black text-orange-500">Clawscan</div>
                                    <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mt-1">OpenClaw Skill 查重 + 落地构想评估</div>
                                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">接入 ClawHub Registry 全量数据，三路并行采集 + 4 Agent 评估，输出 Skill 匹配清单、功能覆盖矩阵和落地实战案例分析。</p>
                                </div>
                                <div className="p-4 rounded-2xl border border-pink-200 bg-pink-50/40">
                                    <div className="text-lg font-black text-pink-500">Bizscan</div>
                                    <div className="text-[10px] font-bold text-pink-400 uppercase tracking-wider mt-1">商业想法评估</div>
                                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">5 层 7 Agent 工业级编排，输出 BII 商业创新指数和 S/A/B/C/D 评级，含竞品拆解和可行性分析。</p>
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-3 gap-4 mt-6">
                                <FeatureCard icon={<Zap className="w-5 h-5" />} color="blue" title="极速分析" desc="数秒完成百万级数据检索与多维度 AI 推理" />
                                <FeatureCard icon={<Eye className="w-5 h-5" />} color="red" title="全维透视" desc="学术 + 产业 + 竞品 + 开源 四维交叉验证" />
                                <FeatureCard icon={<Target className="w-5 h-5" />} color="green" title="精准评估" desc="量化创新指标，多名 AI 专家共识裁决" />
                            </div>
                            <InfoBox variant="highlight" className="mt-6">
                                Novoscan 不只是关键词匹配——每条业务线都部署了独立的多 Agent 编排拓扑，
                                通过结构化推理和交叉质证，得出工业级别的创新性评估报告。
                            </InfoBox>
                        </DocSection>

                        {/* ==================== §2 工作原理 ==================== */}
                        <DocSection id="how-it-works">
                            <SectionHeader icon={<Cpu />} color="red" title="工作原理" />
                            <p className="doc-text">
                                Novoscan 的核心分析流程分为 <strong>5 个阶段</strong>，每个阶段紧密衔接，最终输出高可信度的创新性评估报告。
                            </p>

                            <div className="mt-8 space-y-0">
                                <PipelineStep step={1} title="双轨并行检索" color="blue"
                                    desc="同时向全球学术数据库（OpenAlex、arXiv、CrossRef、CORE）和产业信号源（Brave Search、SerpAPI、GitHub）发起并行检索，在数秒内获取跨维度原始数据。"
                                    icon={<Search className="w-5 h-5" />}
                                />
                                <PipelineStep step={2} title="多 Agent 深度推理" color="red"
                                    desc="将检索数据分发给 4 名 Layer1 专家 Agent（学术审查员、产业分析员、竞品侦探、创新评估师），各 Agent 独立进行结构化推理和多维评分。"
                                    icon={<Brain className="w-5 h-5" />}
                                />
                                <PipelineStep step={3} title="交叉质证与仲裁" color="yellow"
                                    desc="仲裁员 Agent 汇集所有专家意见，动态调整置信度权重，解决评分冲突，给出加权综合评分和共识裁决。"
                                    icon={<GitBranch className="w-5 h-5" />}
                                />
                                <PipelineStep step={4} title="质量检查" color="green"
                                    desc="质量守卫 Agent 对最终报告进行逻辑一致性检查，标记异常和潜在偏差，确保输出质量达到工业级标准。"
                                    icon={<ShieldCheck className="w-5 h-5" />}
                                />
                                <PipelineStep step={5} title="报告生成与可视化" color="purple"
                                    desc="将分析结果结构化渲染为可交互报告，包含 NovoStarchart 六维雷达图、高相似论文对标、产业信号图谱等可视化组件。"
                                    icon={<BarChart3 className="w-5 h-5" />}
                                    isLast
                                />
                            </div>

                            <InfoBox variant="tip" className="mt-6">
                                整个分析流程采用 SSE（Server-Sent Events）实时流式传输，用户可以在分析过程中实时观察每个 Agent 的推理进展。
                            </InfoBox>
                        </DocSection>

                        {/* ========== 大章节二：Novoscan 学术+产业查重 ========== */}
                        <div className="flex items-center gap-3 mb-6 mt-12">
                            <span className="text-xs font-black text-novo-blue bg-novo-blue/10 px-2.5 py-1 rounded-full">二</span>
                            <span className="text-sm font-black text-gray-800 tracking-wide">Novoscan 学术+产业查重</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-novo-blue/20 to-transparent" />
                        </div>

                        {/* ==================== §3.1 Novoscan 常规模式深度解读 ==================== */}
                        <DocSection id="novoscan-deep">
                            <SectionHeader icon={<Sparkles />} color="blue" title="Novoscan 深度解读" />
                            <p className="doc-text">
                                <strong>Novoscan（常规模式）</strong>是三大业务线中的核心引擎，面向科研人员和技术团队，
                                提供<strong>学术 + 产业</strong>双维度创新性评估。它部署了<strong>4 层 6 Agent 精密编排拓扑</strong>和<strong>七源双轨检索引擎</strong>，
                                是整个 Novoscan 品牌的旗舰分析模式。
                            </p>

                            <h3 className="doc-h3 mt-8">七源双轨并行检索</h3>
                            <p className="doc-text">分析启动后，系统同时向学术和产业两条轨道发起并行检索：</p>
                            <div className="mt-4 space-y-4">
                                <div>
                                    <div className="text-xs font-black text-novo-blue uppercase tracking-wider mb-2">学术轨道 · 4 源聚合</div>
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <DataSourceCard name="OpenAlex" desc="覆盖 2.5 亿+ 学术作品的开放学术图谱，按相关度 + 引用量排序" color="blue" />
                                        <DataSourceCard name="arXiv" desc="全球最大预印本论文库，覆盖物理、数学、CS 等前沿领域" color="red" />
                                        <DataSourceCard name="CrossRef" desc="DOI 注册组织，1.4 亿+ 学术元数据，双策略检索（精确 + 宽泛）" color="green" />
                                        <DataSourceCard name="CORE" desc="全球最大开放获取论文聚合器，2 亿+ 全文，语义搜索" color="yellow" />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-black text-novo-green uppercase tracking-wider mb-2">产业轨道 · 3 源信号</div>
                                    <div className="grid sm:grid-cols-3 gap-3">
                                        <DataSourceCard name="Brave Search" desc="隐私优先网页搜索，捕获行业新闻和技术落地动态" color="orange" />
                                        <DataSourceCard name="SerpAPI" desc="Google 搜索结构化 API，获取产业报告和市场分析" color="blue" />
                                        <DataSourceCard name="GitHub API" desc="开源生态扫描，按 Stars 和 相关度排序" color="gray" />
                                    </div>
                                </div>
                            </div>

                            <h3 className="doc-h3 mt-8">交叉验证与可信度计算</h3>
                            <p className="doc-text">
                                双轨检索完成后，系统自动执行<strong>学术-产业交叉验证</strong>：计算概念重叠度、
                                领域一致性评分，并识别红旗信号（如学术热度高但产业空白、或产业落地快但学术基础薄弱），
                                为后续 Agent 推理提供校准后的可信度基线。
                            </p>

                            <h3 className="doc-h3 mt-8">4 层 6 Agent 编排拓扑</h3>
                            <div className="mt-4 mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">执行拓扑 · 120 秒强制截止</div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-black flex-shrink-0 mt-0.5">L1</span>
                                        <div>
                                            <span className="font-bold text-gray-800">并行层</span>
                                            <span className="text-gray-500 ml-2">学术审查员 + 产业分析员 + 竞品侦探 — 三 Agent 同时独立执行</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-black flex-shrink-0 mt-0.5">L2</span>
                                        <div>
                                            <span className="font-bold text-gray-800">串行层</span>
                                            <span className="text-gray-500 ml-2">创新评估师 — 综合三份 L1 报告进行交叉质疑，生成 NovoStarchart</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-black flex-shrink-0 mt-0.5">L3</span>
                                        <div>
                                            <span className="font-bold text-gray-800">裁决层</span>
                                            <span className="text-gray-500 ml-2">仲裁员 — 置信度加权、冲突解决、最终综合裁决（优先 DeepSeek R1）</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs font-black flex-shrink-0 mt-0.5">L4</span>
                                        <div>
                                            <span className="font-bold text-gray-800">质检层</span>
                                            <span className="text-gray-500 ml-2">质量守卫 — 逻辑一致性检查、评分异常标记</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <h3 className="doc-h3 mt-6">6 Agent 职责详解</h3>
                            <div className="space-y-4 mt-4">
                                <AgentCard name="学术审查员" nameEn="Academic Reviewer" role="深度分析学术检索数据，从技术成熟度、论文覆盖度、学术空白、引用密度、发展趋势 5 个维度评估技术的学术基础。识别高相似论文并进行语义对标。" icon="📚" color="blue" />
                                <AgentCard name="产业分析员" nameEn="Industry Analyst" role="分析产业信号数据（网页搜索结果、GitHub 开源项目），评估技术在工业界的落地状况、市场热度和开源生态成熟度。" icon="🏭" color="green" />
                                <AgentCard name="竞品侦探" nameEn="Competitor Detective" role="从产业和学术数据中识别潜在竞品，分析竞争格局、技术壁垒和差异化空间。" icon="🔍" color="orange" />
                                <AgentCard name="创新评估师" nameEn="Innovation Evaluator" role="综合三份 L1 报告进行交叉质疑，从原创性、技术壁垒、市场时机、执行可行性 4 维度评估创新性，生成 NovoStarchart 六维雷达图。" icon="💡" color="purple" />
                                <AgentCard name="仲裁员" nameEn="Arbitrator" role="整合四位专家意见，根据置信度动态调整权重，系统性解决评分冲突，给出最终的加权综合评分、共识度判定和行动建议。优先使用 DeepSeek R1 深度推理模型。" icon="⚖️" color="yellow" />
                                <AgentCard name="质量守卫" nameEn="Quality Guard" role="对最终报告进行逻辑一致性审查，检测评分矛盾、证据链断裂等质量问题，确保输出达到工业级可信标准。" icon="🛡️" color="gray" />
                            </div>

                            <h3 className="doc-h3 mt-8">独特分析输出</h3>
                            <div className="mt-4 grid sm:grid-cols-2 gap-3">
                                <FeatureCard icon={<Star className="w-5 h-5" />} color="blue" title="NovoStarchart" desc="六维创新性雷达图：技术突破性、学术空白度、市场时机、执行可行性、竞争壁垒、生态成熟度" />
                                <FeatureCard icon={<BarChart3 className="w-5 h-5" />} color="red" title="高相似论文对标" desc="语义匹配最相似的学术论文，逐篇标注相似点和差异点" />
                                <FeatureCard icon={<TrendingUp className="w-5 h-5" />} color="green" title="产业信号图谱" desc="GitHub Star 趋势、网页热度、开源生态成熟度可视化" />
                                <FeatureCard icon={<MessageCircle className="w-5 h-5" />} color="yellow" title="Follow-Up 追问" desc="首次分析后支持多轮智能追问，逐步精化分析结果" />
                            </div>

                            <h3 className="doc-h3 mt-8">智能降级策略</h3>
                            <div className="space-y-3 mt-4">
                                <DataChainItem layer="学术" title="学术审查员降级" desc="根据检索到的论文数量和引用密度推断学术空白度。0 篇命中 = 80 分（高度空白），每增 1 篇 -2 分，下限 15 分。" color="blue" />
                                <DataChainItem layer="产业" title="产业分析员降级" desc="根据网页搜索结果和 GitHub 仓库数量推断产业落地度。0 条 = 75 分（未落地），每增 1 条 -3 分，下限 10 分。" color="green" />
                                <DataChainItem layer="评估" title="创新评估师降级" desc="当 L1 Agent 全部超时时，基于原始检索数据的统计特征（论文数 / 引用量 / 搜索结果数）生成保守评分。" color="purple" />
                                <DataChainItem layer="仲裁" title="仲裁员降级" desc="直接基于可用的 Agent 评分进行置信度加权。降级 Agent 权重自动调低，确保最终评分偏保守。" color="yellow" />
                            </div>

                            <InfoBox variant="highlight" className="mt-6">
                                Novoscan 常规模式的所有 Agent 超时控制在 35 秒/个，总流程 120 秒截止。
                                SSE 实时流式传输让用户在分析过程中可以实时观察每个 Agent 的推理进展和状态变化。
                            </InfoBox>
                        </DocSection>

                        {/* ==================== Novoscan Flash 极速模式 ==================== */}
                        <DocSection id="flash-mode">
                            <SectionHeader icon={<Zap />} color="yellow" title="Novoscan Flash 极速模式" />
                            <p className="doc-text">
                                <strong>Novoscan Flash</strong> 是 Novoscan 的极速分析通道。它保留了核心的双轨检索能力，
                                但精简了 Agent 编排层——仅用<strong>单 Agent 快速评估</strong>替代完整的 4 层 6 Agent 拓扑，
                                将分析时间从 60-120 秒压缩到 <strong>10-20 秒</strong>。
                            </p>

                            <h3 className="doc-h3 mt-8">原理</h3>
                            <p className="doc-text">
                                Flash 编排器（flashOrchestrator.ts）触发与标准模式相同的七源双轨并行检索，
                                但检索完成后仅调用一名综合评估 Agent 进行全维度推理。这名 Agent 同时扮演学术审查员、竞品侦探和创新评估师三个角色，
                                在一次 AI 调用中输出结构化评估报告。
                            </p>

                            <h3 className="doc-h3 mt-6">适用场景</h3>
                            <div className="mt-4 grid sm:grid-cols-2 gap-3">
                                <FeatureCard icon={<Zap className="w-5 h-5" />} color="yellow" title="高频初筛" desc="快速筛选大量创意，锁定值得深入分析的方向" />
                                <FeatureCard icon={<Timer className="w-5 h-5" />} color="blue" title="时间敏感" desc="会议中即时评估、头脑风暴快速验证" />
                            </div>

                            <h3 className="doc-h3 mt-6">使用说明</h3>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="在首页输入框下方，切换模式为「极速」（默认为标准模式）" />
                                <StepItem step={2} text="输入研究想法，点击检查创新性" />
                                <StepItem step={3} text="10-20 秒内获得精简版报告，含综合评分和核心发现" />
                                <StepItem step={4} text="如需深入分析，可在报告底部切换至标准模式重新分析" />
                            </div>

                            <InfoBox variant="tip" className="mt-6">
                                未登录用户的前 3 次免费使用默认为 Flash 模式，降低首次体验门槛。登录后 Flash 模式无限次使用（0 NovoCredits）。
                            </InfoBox>
                        </DocSection>

                        {/* ==================== NovoDiscover 跨域探索 ==================== */}
                        <DocSection id="novo-discover">
                            <SectionHeader icon={<Globe />} color="purple" title="NovoDiscover 跨域创新探索" />
                            <p className="doc-text">
                                <strong>NovoDiscover</strong> 是 Novoscan 的跨领域灵感发现引擎。
                                它运行一名独立的<strong>跨域侦察兵 Agent</strong>（Cross-Domain Scout），
                                负责在用户当前研究领域之外的领域中，识别可迁移的技术、方法和范式。
                            </p>

                            <h3 className="doc-h3 mt-8">原理</h3>
                            <p className="doc-text">
                                跨域侦察兵 Agent 接收标准模式的检索数据和 NovoDNA 基因图谱（如有），
                                结合历史跨域桥梁数据库，通过类比推理（Analogical Reasoning）找出其他领域中解决类似问题的方案。
                                每条跨域桥梁包含：源领域、目标领域、迁移路径、可行性评分和参考案例。
                            </p>
                            <div className="mt-4 mb-6 p-4 bg-purple-50/50 rounded-2xl border border-purple-200">
                                <div className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-2">跨域桥梁数据结构</div>
                                <div className="space-y-2 text-xs text-gray-600">
                                    <div className="flex items-start gap-2"><span className="font-bold text-purple-700">sourceDomain</span><span>灵感来源领域（如生物学）</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-purple-700">targetDomain</span><span>可迁移到的目标领域（如计算机科学）</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-purple-700">transferInsight</span><span>迁移路径和具体思路</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-purple-700">score</span><span>迁移可行性评分（0-100）</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-purple-700">references</span><span>支撑案例和参考文献</span></div>
                                </div>
                            </div>

                            <h3 className="doc-h3 mt-6">使用说明</h3>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="在标准模式下提交分析请求（Flash 不含此功能）" />
                                <StepItem step={2} text="分析完成后，报告中自动展示「NovoDiscover 跨域创新迁移洞察」区块" />
                                <StepItem step={3} text="查看每条跨域桥梁的源领域、迁移路径和可行性评分" />
                                <StepItem step={4} text="展开跨域知识图谱可视化，直观了解领域间的关联网络" />
                            </div>

                            <InfoBox variant="note" className="mt-6">
                                跨域桥梁会持久化存储。系统在后续分析中会参考历史桥梁数据，实现跨域知识的增量积累。
                                仲裁员 Agent 还会对跨域建议进行可信度验证，标记疑似虚构的案例。
                            </InfoBox>
                        </DocSection>

                        {/* ==================== NovoDebate 辩论引擎 ==================== */}
                        <DocSection id="novo-debate">
                            <SectionHeader icon={<Repeat />} color="red" title="NovoDebate 辩论引擎" />
                            <p className="doc-text">
                                <strong>NovoDebate</strong> 是 Novoscan 标准模式中的对抗性验证机制。
                                当 Layer 1 专家 Agent 之间的评分分歧超过阈值时，系统自动触发辩手 Agent（Debater），
                                让持不同观点的 Agent 进行<strong>多轮结构化辩论</strong>，最终由仲裁员基于辩论结果调整评分。
                            </p>

                            <h3 className="doc-h3 mt-8">原理</h3>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="检测分歧：当两个 Agent 评分差 > 阈值时，自动配对为辩论组" />
                                <StepItem step={2} text="正方陈述：高分 Agent 的立场和论据" />
                                <StepItem step={3} text="反方质疑：低分 Agent 的反驳和证据" />
                                <StepItem step={4} text="多轮交锋：最多 3 轮交替辩论，每轮均需回应对方论点" />
                                <StepItem step={5} text="仲裁员裁决：基于辩论质量调整最终评分（调整幅度与辩论轮数挂钩）" />
                            </div>

                            <h3 className="doc-h3 mt-6">使用说明</h3>
                            <p className="doc-text">
                                NovoDebate 完全自动触发——用户无需任何额外操作。当分析完成后，如果存在辩论记录，
                                报告中「辩论时间线」区块会自动展示：
                            </p>
                            <div className="mt-4 grid sm:grid-cols-2 gap-3">
                                <FeatureCard icon={<Activity className="w-5 h-5" />} color="red" title="分歧热力图" desc="可视化各维度的分歧严重程度" />
                                <FeatureCard icon={<MessageCircle className="w-5 h-5" />} color="blue" title="辩论回放" desc="逐轮展示正反方论点和反驳" />
                            </div>
                        </DocSection>

                        {/* ==================== 隐私检索模式 ==================== */}
                        <DocSection id="privacy-mode">
                            <SectionHeader icon={<Lock />} color="violet" title="隐私检索模式" />
                            <p className="doc-text">
                                <strong>隐私检索</strong>类似 Google Gemini 的「隐私对话」功能。
                                开启后，本次分析的所有数据<strong>不会被持久化到任何数据库</strong>——
                                不保存搜索历史、不更新用户偏好、不写入创新趋势、不触发 Agent 记忆进化。
                                分析结果仅存在于当前浏览器会话中，关闭页面后即彻底消失。
                            </p>

                            <h3 className="doc-h3 mt-8">保护范围</h3>
                            <p className="doc-text">
                                隐私模式在 API 层从源头拦截了以下全部写入操作：
                            </p>
                            <div className="mt-4 grid sm:grid-cols-2 gap-3">
                                <FeatureCard icon={<Database className="w-5 h-5" />} color="violet" title="跳过数据库写入" desc="search_history 表不保存本次查询和分析结果" />
                                <FeatureCard icon={<TrendingUp className="w-5 h-5" />} color="violet" title="跳过趋势记录" desc="创新点不提取到 innovations 表，不影响平台趋势统计" />
                                <FeatureCard icon={<Brain className="w-5 h-5" />} color="violet" title="跳过 Agent 记忆" desc="NovoscanEVO 不保存本次分析经验到记忆库" />
                                <FeatureCard icon={<Users className="w-5 h-5" />} color="violet" title="跳过用户画像" desc="不记录搜索事件、不更新用户偏好和行为标签" />
                            </div>

                            <h3 className="doc-h3 mt-6">不受影响的功能</h3>
                            <p className="doc-text">
                                隐私模式<strong>仅屏蔽数据持久化</strong>，以下核心分析能力完全保留：
                            </p>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="七源双轨检索引擎照常运行，检索质量不受影响" />
                                <StepItem step={2} text="4 层 6 Agent 完整拓扑正常推理（含 NovoDebate 辩论）" />
                                <StepItem step={3} text="NovoDiscover 跨域探索照常触发" />
                                <StepItem step={4} text="NovoDNA 基因图谱照常生成（仅不持久化）" />
                            </div>

                            <h3 className="doc-h3 mt-6">使用说明</h3>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="在搜索框下方工具栏中，点击「隐私检索」按钮（🔒 图标）" />
                                <StepItem step={2} text="按钮变为紫色高亮态，表示隐私模式已激活" />
                                <StepItem step={3} text="正常输入想法并提交分析，所有功能照常使用" />
                                <StepItem step={4} text="分析完成后结果仅存在于当前页面，刷新或关闭后不可恢复" />
                            </div>

                            <InfoBox variant="highlight" className="mt-6">
                                隐私检索适用于 Novoscan（标准 + Flash）、Clawscan 和 Bizscan 全部三条业务线。
                                开启后不消耗 NovoCredits（等同 Flash 的免费策略），让用户可以无顾虑地试探敏感课题。
                            </InfoBox>
                        </DocSection>

                        {/* ========== 大章节三：Clawscan Skill 查重 ========== */}
                        <div className="flex items-center gap-3 mb-6 mt-12">
                            <span className="text-xs font-black text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-full">三</span>
                            <span className="text-sm font-black text-gray-800 tracking-wide">Clawscan Skill 查重</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-orange-500/20 to-transparent" />
                        </div>

                        {/* ==================== Clawscan 深度解读 ==================== */}
                        <DocSection id="skill-check-deep">
                            <SectionHeader icon={<Cog />} color="orange" title="Clawscan 深度解读" />
                            <p className="doc-text">
                                <strong>Clawscan</strong> 是 Novoscan 针对 OpenClaw 生态的垂直业务线，覆盖<strong>Skill 查重</strong>和<strong>落地构想评估</strong>两大场景。
                                它通过<strong>3 层 4 Agent 编排拓扑</strong>和<strong>三路并行数据采集</strong>，为广大 OpenClaw 玩家提供便捷的 Skill 查重功能，并深入评估其 OpenClaw 落地生产场景想法的可行性。
                            </p>

                            <h3 className="doc-h3 mt-8">三路并行数据采集</h3>
                            <p className="doc-text">分析启动前，系统从三个数据源并行采集原始信号：</p>
                            <div className="grid sm:grid-cols-3 gap-3 mt-4">
                                <DataSourceCard name="ClawHub Registry" desc="拉取全量 Skill 列表，按安装量排序，SWR 缓存（1h TTL + 4h 旧数据窗口 + 后台刷新）" color="orange" />
                                <DataSourceCard name="Brave + SerpAPI" desc="4 组 OpenClaw 特化查询（中英双语），搜索落地实战案例和部署经验" color="blue" />
                                <DataSourceCard name="GitHub API" desc="搜索开源实现，按 Star 降序排列，最小 5 星过滤" color="gray" />
                            </div>

                            <h3 className="doc-h3 mt-8">智能预处理管线</h3>
                            <div className="space-y-4 mt-4">
                                <HighlightCard
                                    num={1} title="PII 脱敏引擎" color="red"
                                    problem="用户输入可能包含邮箱、手机号、身份证等敏感信息"
                                    solution="正则表达式实时脱敏：邮箱→[EMAIL]、手机→[PHONE]、身份证→[ID]、URL→[URL:域名]"
                                    details={[
                                        '保留 URL 域名信息用于后续分析',
                                        '脱敏在 AI 解析之前执行，确保敏感数据永远不会发送到 AI 模型',
                                        '记录脱敏数量用于日志审计',
                                    ]}
                                />
                                <HighlightCard
                                    num={2} title="AI 结构化解析" color="blue"
                                    problem="用户自然语言描述需要转换为结构化数据才能被 Agent 高效消费"
                                    solution="AI 提取 7 个结构化字段：核心能力点、搜索关键词、同义词/英文对照、平台类型、分类、问题描述、目标用户"
                                    details={[
                                        '关键词自动包含 openclaw/claw/skill 等生态专用词',
                                        '降级策略：AI 解析失败时，通过分词 + 停用词过滤提取关键词',
                                    ]}
                                />
                                <HighlightCard
                                    num={3} title="smartPreFilter 零 AI 预筛" color="green"
                                    problem="全量 Registry 可能有数千个 Skill，全部送入 AI 分析成本过高"
                                    solution="基于关键词匹配 + 安装量权重的零 AI 预筛，将候选集压缩到 18 个"
                                    details={[
                                        '名称匹配权重 x5，描述匹配权重 x2',
                                        '安装量 log10 加权，优先保留高安装量 Skill',
                                        '不足 5 个匹配时自动补充高安装量 Skill 作为基准',
                                    ]}
                                />
                            </div>

                            <h3 className="doc-h3 mt-8">3 层 4 Agent 编排拓扑</h3>
                            <div className="mt-4 mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">执行拓扑 · 120 秒强制截止</div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-black flex-shrink-0 mt-0.5">L1</span>
                                        <div>
                                            <span className="font-bold text-gray-800">并行层</span>
                                            <span className="text-gray-500 ml-2">Registry 侦察员 + 实战案例分析师 — 同时独立执行</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-black flex-shrink-0 mt-0.5">L2</span>
                                        <div>
                                            <span className="font-bold text-gray-800">串行层</span>
                                            <span className="text-gray-500 ml-2">创新度审计师 — 交叉验证 L1 两份报告</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-black flex-shrink-0 mt-0.5">L3</span>
                                        <div>
                                            <span className="font-bold text-gray-800">裁决层</span>
                                            <span className="text-gray-500 ml-2">战略仲裁官 — 最终评分、评级和行动建议</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <AgentCard name="Registry 侦察员" nameEn="Registry Scout" role="分析预筛后的候选 Skill 列表，计算每个 Skill 与用户构想的语义相似度（0-100%）、匹配功能点、覆盖率。输出排序后的 Skill 匹配清单。" icon="🔍" color="orange" />
                                <AgentCard name="实战案例分析师" nameEn="Case Analyst" role="分析网络搜索和 GitHub 数据，识别 OpenClaw 落地实战案例，提取关键洞察（技术栈、部署规模、相关度评分）。输出结构化案例清单。" icon="📋" color="blue" />
                                <AgentCard name="创新度审计师" nameEn="Novelty Auditor" role="交叉验证 Registry 匹配结果和实战案例，识别创新亮点和差异化因素，分析生态空白区域。输出创新度评价和 Gap 分析。" icon="💡" color="green" />
                                <AgentCard name="战略仲裁官" nameEn="Strategic Arbiter" role="综合三份报告，计算综合评分（0-100）和重复度等级（none/low/medium/high），输出 Grade（S/A/B/C/D/F）、一句话判定和分类行动建议（proceed/differentiate/pivot/abandon）。" icon="⚖️" color="yellow" />
                            </div>

                            <h3 className="doc-h3 mt-8">独特分析输出</h3>
                            <div className="mt-4 grid sm:grid-cols-2 gap-3">
                                <FeatureCard icon={<Target className="w-5 h-5" />} color="blue" title="Skill 匹配清单" desc="按语义相似度排序，展示匹配功能点和覆盖率，Top 10" />
                                <FeatureCard icon={<Layers className="w-5 h-5" />} color="red" title="功能覆盖矩阵" desc="用户核心能力 vs 现有 Skill 覆盖情况的全景对照表" />
                                <FeatureCard icon={<Lightbulb className="w-5 h-5" />} color="green" title="实战案例库" desc="OpenClaw 落地案例，含技术栈、部署规模和关键洞察" />
                            </div>

                            <InfoBox variant="note" className="mt-6">
                                Skill Check 流程总耗时控制在 120 秒以内。每个 Agent 独立 35 秒超时 + AbortController 资源回收。
                                降级时 Registry 侦察员评分降至 30 分（极保守），实战案例分析师降至 20 分。
                            </InfoBox>
                        </DocSection>

                        {/* ========== 大章节四：Bizscan 商业评估 ========== */}
                        <div className="flex items-center gap-3 mb-6 mt-12">
                            <span className="text-xs font-black text-pink-500 bg-pink-500/10 px-2.5 py-1 rounded-full">四</span>
                            <span className="text-sm font-black text-gray-800 tracking-wide">Bizscan 商业评估</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-pink-500/20 to-transparent" />
                        </div>

                        {/* ==================== Bizscan 深度解读 ==================== */}
                        <DocSection id="bizscan-deep">
                            <SectionHeader icon={<Briefcase />} color="red" title="Bizscan 深度解读" />
                            <p className="doc-text">
                                <strong>Bizscan（商业查重）</strong>是 Novoscan 面向创业者和产品经理的商业想法评估系统。
                                它部署了<strong>5 层 7 Agent 工业级编排拓扑</strong>，是 Novoscan 三大模式中最复杂、最深度的分析引擎。
                            </p>

                            <h3 className="doc-h3 mt-8">四源产业信号采集</h3>
                            <p className="doc-text">Bizscan 的数据采集覆盖四个维度的产业信号源：</p>
                            <div className="grid sm:grid-cols-2 gap-3 mt-4">
                                <DataSourceCard name="Brave + SerpAPI" desc="多角度网络搜索，捕获行业动态、融资新闻、市场分析" color="blue" />
                                <DataSourceCard name="Product Hunt" desc="已上线产品扫描，识别同赛道竞品和用户反馈" color="orange" />
                                <DataSourceCard name="GitHub" desc="开源替代方案搜索，评估技术生态成熟度" color="gray" />
                                <DataSourceCard name="众筹平台" desc="Kickstarter/Indiegogo 信号，验证市场需求热度" color="green" />
                            </div>

                            <h3 className="doc-h3 mt-8">5 层 7 Agent 编排拓扑</h3>
                            <p className="doc-text">
                                Bizscan 采用比常规查重更复杂的<strong>分层依赖编排</strong>。Layer 内部并行执行，Layer 之间串行，总串行等待仅 3 次，
                                在保证分析深度的同时最大化并行效率。
                            </p>
                            <div className="mt-4 mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">5 层执行拓扑 · 150 秒强制截止</div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-black flex-shrink-0 mt-0.5">L1</span>
                                        <div><span className="font-bold text-gray-800">并行层</span><span className="text-gray-500 ml-2">市场侦察员 + 竞品拆解师 — 无上游依赖，同时启动</span></div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-black flex-shrink-0 mt-0.5">L2</span>
                                        <div><span className="font-bold text-gray-800">并行层</span><span className="text-gray-500 ml-2">创新度审计师 + 可行性检验师 — 依赖 L1 全部报告</span></div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs font-black flex-shrink-0 mt-0.5">L3</span>
                                        <div><span className="font-bold text-gray-800">串行层</span><span className="text-gray-500 ml-2">交叉验证引擎 — 依赖 L1+L2 全部 4 份报告（Bizscan 独有）</span></div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-black flex-shrink-0 mt-0.5">L4</span>
                                        <div><span className="font-bold text-gray-800">裁决层</span><span className="text-gray-500 ml-2">战略仲裁官 — 依赖全部上游报告（额外 +10s 超时）</span></div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-black flex-shrink-0 mt-0.5">L5</span>
                                        <div><span className="font-bold text-gray-800">质检层</span><span className="text-gray-500 ml-2">质量护卫 — 纯逻辑层，无 AI 调用，毫秒级完成</span></div>
                                    </div>
                                </div>
                            </div>

                            <h3 className="doc-h3 mt-6">7 Agent 职责详解</h3>
                            <div className="space-y-4 mt-4">
                                <AgentCard name="市场侦察员" nameEn="Market Scout" role="模拟 McKinsey/BCG 市场研究分析师。5 步推理：行业识别 → TAM/SAM/SOM 推算 → 增长趋势 → 饱和度 → 需求验证。输出市场规模估算、增长趋势(explosive/growing/stable/declining)和饱和度(oversaturated~blue-ocean)。" icon="📊" color="blue" />
                                <AgentCard name="竞品拆解师" nameEn="Competitor Profiler" role="模拟 YC/a16z 竞争情报分析师。5 步分析：竞品全景扫描 → 分层（直接/间接/潜在威胁）→ Top3-5 深度拆解 → 护城河分析 → 进入壁垒。输出 3-8 个竞品详细档案。" icon="🔍" color="orange" />
                                <AgentCard name="创新度审计师" nameEn="Novelty Auditor" role="充当'魔鬼代言人'，质疑每个创新点。将想法拆解为 P（问题）/S（方案）/M（模式）三层逐层查重，判定创新类型：A类（范式）→ B类（组合）→ C类（增量）→ D类（伪创新）。" icon="💡" color="purple" />
                                <AgentCard name="可行性检验师" nameEn="Feasibility Examiner" role="模拟资深 CTO。5 维评估：技术栈成熟度 → 成本结构（开发/基础设施/获客）→ MVP 时间线 → 规模化难度 → 风险清单。对 MVP 速度和团队门槛量化评分。" icon="⚙️" color="green" />
                                <AgentCard name="交叉验证引擎" nameEn="Cross Validator" role="Bizscan 独有层。作为元分析师（Meta-Analyst），不分析商业想法本身，而是分析其他分析师的报告。识别分歧（>20 分差异）、证据冲突，输出校准后的四维评分和一致性评分。" icon="🔄" color="yellow" />
                                <AgentCard name="战略仲裁官" nameEn="Strategic Arbiter" role="模拟顶级 VC 合伙人。基于校准评分计算 BII 指数（加权公式），AI 可在 ±5 范围微调。输出 Grade 评级、一句话判定、3-5 条可执行战略建议和风险警告。" icon="⚖️" color="yellow" />
                                <AgentCard name="质量护卫" nameEn="Quality Guard" role="纯逻辑层。6 项检查：降级标记 → 极端值检测 → BII 一致性 → 评分分散度 → 交叉验证一致性 → 必填字段完整性。输出一致性评分 0-100 和 pass/fail。" icon="🛡️" color="gray" />
                            </div>

                            <h3 className="doc-h3 mt-8">BII 商业创新指数</h3>
                            <p className="doc-text">Bizscan 的最终评分使用独创的 <strong>BII（Business Innovation Index）</strong>指数体系。</p>
                            <div className="mt-4 p-4 bg-orange-50/50 rounded-2xl border border-orange-200">
                                <div className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-3">加权公式</div>
                                <p className="text-sm text-gray-800 font-mono">
                                    BII = 语义新颖度 x <strong>0.25</strong> + 竞争态势 x <strong>0.30</strong> + 市场空白 x <strong>0.25</strong> + 可行性 x <strong>0.20</strong>
                                </p>
                            </div>
                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="text-left px-3 py-2 border border-gray-200 font-bold text-gray-700">Grade</th>
                                            <th className="text-left px-3 py-2 border border-gray-200 font-bold text-gray-700">BII 区间</th>
                                            <th className="text-left px-3 py-2 border border-gray-200 font-bold text-gray-700">含义</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            ['S', '\u2265 90', '\ud83c\udfc6 极具投资价值，市场空白 + 高可行性'],
                                            ['A', '75-89', '\ud83e\udd47 优秀，差异化明显，值得全力推进'],
                                            ['B', '55-74', '\ud83d\udc4d 良好，有差异化空间，需精准定位'],
                                            ['C', '35-54', '\u26a0\ufe0f 一般，竞争中等，需强化差异化'],
                                            ['D', '< 35', '\u274c 风险高，竞品密集或可行性低'],
                                        ].map(([grade, range, desc], i) => (
                                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                                <td className="px-3 py-2 border border-gray-200 font-black text-gray-900">{grade}</td>
                                                <td className="px-3 py-2 border border-gray-200 font-medium text-gray-700">{range}</td>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-600">{desc}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <h3 className="doc-h3 mt-8">智能降级策略</h3>
                            <div className="space-y-3 mt-4">
                                <DataChainItem layer="市场" title="市场侦察员降级" desc="根据网页搜索结果数量推断市场蓝海度：0 条 = 70 分，每增 1 条 -2 分，下限 20 分。同时推断市场饱和度（>15条 = crowded）。" color="blue" />
                                <DataChainItem layer="竞品" title="竞品拆解师降级" desc="综合网页结果 + Product Hunt 产品数推断竞争密度：0 条 = 80 分，每增 1 条 -3 分，下限 15 分。" color="red" />
                                <DataChainItem layer="验证" title="交叉验证引擎降级" desc="直接取各 Agent 原始评分作为校准评分，一致性分标记为 50 分，并在证据冲突中标注异常。" color="green" />
                                <DataChainItem layer="仲裁" title="战略仲裁官降级" desc="基于校准评分直接计算 BII 加权值，确定 Grade。AI 可在 ±5 分范围内微调 BII，超出则强制回退基准值。" color="yellow" />
                            </div>

                            <InfoBox variant="highlight" className="mt-6">
                                Bizscan 与常规查重的核心差别：总超时 150 秒（多 30 秒），战略仲裁官额外 +10 秒超时，且包含交叉验证引擎（Bizscan 独有设计），
                                确保多 Agent 间的评分一致性和证据可靠性。
                            </InfoBox>
                        </DocSection>

                        {/* ========== 大章节五：平台功能与服务 ========== */}
                        <div className="flex items-center gap-3 mb-6 mt-12">
                            <span className="text-xs font-black text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">五</span>
                            <span className="text-sm font-black text-gray-800 tracking-wide">平台功能与服务</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 to-transparent" />
                        </div>

                        {/* ==================== NovoDNA 创新基因图谱 ==================== */}
                        <DocSection id="novo-dna">
                            <SectionHeader icon={<Dna />} color="green" title="NovoDNA 创新基因图谱" />
                            <p className="doc-text">
                                <strong>NovoDNA</strong> 是 Novoscan 的创新基因提取引擎，采用<strong>折叠式设计</strong>。
                                它从每次分析中提取课题的 <strong>5 维创新基因向量</strong>（原创突破 / 技术深度 / 应用广度 / 时效趋势 / 跨域迁移），
                                并构建持续进化的创新基因图谱。
                            </p>

                            <h3 className="doc-h3 mt-8">折叠式交互设计</h3>
                            <div className="mt-4 grid sm:grid-cols-2 gap-3">
                                <FeatureCard icon={<Gauge className="w-5 h-5" />} color="green" title="折叠态" desc="雷达图 + 唯一性评分 + 5 维向量数值，一屏快速线览核心指标" />
                                <FeatureCard icon={<Eye className="w-5 h-5" />} color="blue" title="展开态" desc="星座图、密度热力图、突变推荐、邻居卡片、空白地带等全量可视化" />
                            </div>

                            <h3 className="doc-h3 mt-6">5 维基因向量</h3>
                            <div className="mt-4 mb-6 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200">
                                <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">基因片段结构</div>
                                <div className="space-y-2 text-xs text-gray-600">
                                    <div className="flex items-start gap-2"><span className="font-bold text-emerald-700">原创突破</span><span>对现有技术的突破程度，核心衡量课题是否提出全新的解决方案</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-emerald-700">技术深度</span><span>所涉及技术的复杂度和专业性门槛</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-emerald-700">应用广度</span><span>潜在应用场景的多样性和市场覆盖面</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-emerald-700">时效趋势</span><span>课题的时间敏感度，是否踩中当前技术浪潮</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-emerald-700">跨域迁移</span><span>跨越学科边界迁移应用的可能性</span></div>
                                </div>
                            </div>

                            <h3 className="doc-h3 mt-6">DNA Harvester 收割器</h3>
                            <p className="doc-text">
                                后端配套 <strong>DNA Harvester</strong> 收割器，通过 Vercel Cron 每周一自动执行，
                                从 OpenAlex 拓取各领域高引论文，提取 5 维 DNA 向量并入库。配合零 AI 调用的<strong>领域分类器</strong>（覆盖 12+ 学科）自动打标签，
                                持续丰富基因库与创新图谱的密度。
                            </p>

                            <h3 className="doc-h3 mt-6">双向进化机制</h3>
                            <p className="doc-text">
                                NovoDNA 与 NovoDiscover 形成<strong>正反馈闭环</strong>：
                                每次分析产生的新基因会丰富基因库，而 NovoDiscover 在下次分析时会参考基因库中的交叉领域候选基因，
                                实现「搜索优化 DNA → DNA 反哺搜索」的双向进化。
                            </p>

                            <h3 className="doc-h3 mt-6">使用说明</h3>
                            <p className="doc-text">
                                NovoDNA 自动运行于 Novoscan、Bizscan 和 Clawscan 三大业务线。
                                分析完成后，报告中会展示「NovoDNA 创新基因图谱」折叠卡片，点击展开可查看全量可视化。
                            </p>
                        </DocSection>

                        {/* ==================== NovoscanEVO 智能体进化 ==================== */}
                        <DocSection id="novo-evo">
                            <SectionHeader icon={<Brain />} color="purple" title="NovoscanEVO 智能体记忆进化" />
                            <p className="doc-text">
                                <strong>NovoscanEVO</strong> 赋予 Novoscan 的 Agent 集群<strong>跨会话学习能力</strong>。
                                每次分析不仅服务当前用户，还会将分析经验沉淀到 Agent 记忆库中，
                                使得系统在后续分析同领域课题时越来越精准。
                            </p>

                            <h3 className="doc-h3 mt-8">原理</h3>
                            <p className="doc-text">
                                NovoscanEVO 基于 RAG（Retrieval-Augmented Generation）范式：
                            </p>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="经验提取：每次分析完成后，提取评分校准教训、领域特征和分析策略" />
                                <StepItem step={2} text="记忆存储：结构化经验写入 Supabase，按领域和主题索引" />
                                <StepItem step={3} text="记忆检索：下次分析时，根据输入主题从记忆库中检索最相关的过往经验" />
                                <StepItem step={4} text="上下文注入：检索到的经验作为额外 Prompt 注入各 Agent，引导更精准的推理" />
                            </div>

                            <h3 className="doc-h3 mt-6">使用说明</h3>
                            <p className="doc-text">
                                NovoscanEVO 完全自动运行。当报告中出现「NovoscanEVO 智能体记忆进化」面板时，
                                说明本次分析参考了历史经验。面板展示经验来源数量、匹配的主题和具体洞察。
                            </p>

                            <InfoBox variant="highlight" className="mt-6">
                                记忆注入有 Token 上限控制。系统会自动裁剪经验长度，确保不会挤占 Agent 的核心推理空间。
                                每次最多注入 5 条最相关的历史经验。
                            </InfoBox>
                        </DocSection>



                        {/* ==================== NovoMind 创新人格评测 ==================== */}
                        <DocSection id="novo-mind">
                            <SectionHeader icon={<FlaskConical />} color="fuchsia" title="NovoMind 对话式创新人格评测" />
                            <p className="doc-text">
                                <strong>NovoMind</strong> 是 Novoscan 的对话式创新人格评测系统。
                                采用<strong>三代理架构</strong>（访谈代理 + BARS 评估代理 + IDEA 评估代理），通过 5-15 轮自然对话，
                                同时生成五维创新力量化评分和四维创新人格原型画像。
                            </p>

                            <h3 className="doc-h3 mt-8">三代理架构</h3>
                            <div className="mt-4 space-y-4">
                                <AgentCard name="访谈代理" nameEn="Interviewer (V4)" role="使用 DeepSeek R1 进行隐式推理。V4 灵活版：万人通用开场白、动态深度调节、五维度覆盖保障。中期自动检查缺失维度并引导话题补全。" icon="🗣️" color="blue" />
                                <AgentCard name="BARS 评估代理" nameEn="BARS Evaluator" role="基于行为锚定等级评价量表（BARS），从五个维度独立量化评分（1.0-5.0）。每个维度附带原话引用和推理依据。" icon="📊" color="green" />
                                <AgentCard name="IDEA 评估代理" nameEn="IDEA Evaluator" role="基于四维双极模型（Input/Direction/Execution/Alliance），输出 0-100 分和 16 型创新人格原型代码（如 VDPS → 布道师）。" icon="🧬" color="purple" />
                            </div>

                            <h3 className="doc-h3 mt-6">BARS 五维评估</h3>
                            <div className="mt-4 mb-6 p-4 bg-fuchsia-50/50 rounded-2xl border border-fuchsia-200">
                                <div className="text-xs font-bold text-fuchsia-500 uppercase tracking-wider mb-2">行为锚定量表维度（1.0 - 5.0）</div>
                                <div className="space-y-2 text-xs text-gray-600">
                                    <div className="flex items-start gap-2"><span className="font-bold text-fuchsia-700">认知开放度</span><span>兴趣广度、对新事物的态度和跨领域探索意愿</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-fuchsia-700">破局重构力</span><span>挑战现状、打破规则并构建全新解决方案的倾向</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-fuchsia-700">模糊容忍度</span><span>在不确定性中决策的能力和心态</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-fuchsia-700">创新内驱力</span><span>内在驱动力强度，做事的核心动力来源</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-fuchsia-700">落地执行力</span><span>将创意转化为行动的能力和方法论</span></div>
                                </div>
                            </div>

                            <h3 className="doc-h3 mt-6">IDEA 四维人格模型</h3>
                            <div className="mt-4 mb-6 p-4 bg-violet-50/50 rounded-2xl border border-violet-200">
                                <div className="text-xs font-bold text-violet-500 uppercase tracking-wider mb-2">四维双极评分（0-100）</div>
                                <div className="space-y-2 text-xs text-gray-600">
                                    <div className="flex items-start gap-2"><span className="font-bold text-violet-700">Input 信息摄取</span><span>V 远见型（跨域扫描）↔ O 洞察型（垂直深耕）</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-violet-700">Direction 思维定向</span><span>D 发散型（多线程探索）↔ C 收敛型（聚焦精化）</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-violet-700">Execution 执行动能</span><span>P 探索型（快速试错）↔ B 构建型（体系化打磨）</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-violet-700">Alliance 协作生态</span><span>S 连接者（跨界协作）↔ I 独行者（深度自主）</span></div>
                                </div>
                            </div>

                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="text-left px-3 py-2 border border-gray-200 font-bold text-gray-700">族群</th>
                                            <th className="text-left px-3 py-2 border border-gray-200 font-bold text-gray-700">成员</th>
                                            <th className="text-left px-3 py-2 border border-gray-200 font-bold text-gray-700">核心特征</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            ['🔥 点火者', '布道师 / 发明家 / 造梦师 / 哲学家', '远见驱动，善于开创'],
                                            ['🏛️ 掌舵者', '指挥官 / 先锋 / 元帅 / 建筑师', '战略导向，精准执行'],
                                            ['🔍 发现者', '炼金师 / 侦探 / 大使 / 猎手', '洞察驱动，善于发现'],
                                            ['⚙️ 守护者', '操盘手 / 工匠 / 总管 / 督察', '稳健务实，确保品质'],
                                        ].map(([clan, members, trait], i) => (
                                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                                <td className="px-3 py-2 border border-gray-200 font-bold text-gray-900">{clan}</td>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-700">{members}</td>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-600">{trait}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <h3 className="doc-h3 mt-8">行为信号收集 & 画像进化</h3>
                            <p className="doc-text">
                                用户在 Novoscan 的日常操作（搜索、追问、推荐点击）被自动收集并映射到 IDEA 四维度，
                                持续校准对话画像。每 20 个行为数据点自动解锁<strong>偏差洞察报告</strong>——展示"你说的 vs 你做的"差异分析。
                            </p>

                            <h3 className="doc-h3 mt-6">使用说明</h3>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="在个人中心找到 NovoMind 卡片，点击「开始评测」" />
                                <StepItem step={2} text="与 AI 进行 5-15 轮自然对话，AI 会通过开放式提问引导你分享思考方式" />
                                <StepItem step={3} text="对话结束后，系统并行调用 BARS + IDEA 双评估代理生成报告" />
                                <StepItem step={4} text="查看 BARS 五维评分（含行为锚定证据）和 IDEA 创新人格原型卡片" />
                                <StepItem step={5} text="持续使用 Novoscan 搜索 → 行为数据积累 → 画像精度提升 → 解锁偏差洞察" />
                            </div>

                            <InfoBox variant="tip" className="mt-6">
                                评测结果持久化至 Supabase，重新评测会覆盖旧结果。IDEA 画像随行为数据持续进化——行为权重从 0% 逐步增长至 50%，综合画像越用越准。
                            </InfoBox>
                        </DocSection>

                        {/* ==================== 公开报告与社交分享 ==================== */}
                        <DocSection id="public-share">
                            <SectionHeader icon={<Share2 />} color="teal" title="公开报告与社交分享" />
                            <p className="doc-text">
                                Novoscan 支持将分析报告<strong>一键公开并分享到社交平台</strong>。
                                公开报告拥有独立的 SSR 页面、动态 OG 海报和 SEO 优化，
                                让你的创新洞察触达更广泛的受众。
                            </p>

                            <h3 className="doc-h3 mt-8">原理</h3>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="用户点击分享按钮，系统将报告核心数据写入 public_reports 表" />
                                <StepItem step={2} text="生成唯一的公开链接（/report/[id]），SSR 渲染完整报告" />
                                <StepItem step={3} text="/api/og 动态生成 1200×630 社交分享海报（含评分、摘要、CTA）" />
                                <StepItem step={4} text="动态 sitemap 自动包含所有公开报告 URL，搜索引擎可索引" />
                            </div>

                            <h3 className="doc-h3 mt-6">使用说明</h3>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="分析完成后，点击报告顶部的「分享」按钮" />
                                <StepItem step={2} text="选择分享方式：复制链接 / 分享到 Twitter / LinkedIn / 微信" />
                                <StepItem step={3} text="分享链接在社交平台自动展示精美的 OG 卡片预览" />
                            </div>

                            <InfoBox variant="note" className="mt-6">
                                首页底部「热门报告」区块自动展示浏览量最高的公开报告，增加优质内容的曝光。
                                公开报告支持完整的 SEO 元数据，有助于被搜索引擎收录。
                            </InfoBox>
                        </DocSection>

                        {/* ==================== MCP 远程服务 ==================== */}
                        <DocSection id="mcp-service">
                            <SectionHeader icon={<Plug />} color="orange" title="MCP 远程服务 (Model Context Protocol)" />
                            <p className="doc-text">
                                Novoscan 提供符合 <strong>MCP 协议</strong>的远程服务端点，
                                允许 <strong>Claude Desktop / Cursor / ChatGPT</strong> 等主流 LLM 客户端直接调用 Novoscan Flash 分析能力。
                                开发者可以在自己的 AI 工作流中无缝集成创新性评估。
                            </p>

                            <h3 className="doc-h3 mt-8">原理与架构</h3>
                            <p className="doc-text">
                                MCP 服务基于 <code>mcp-handler</code> 适配器和 <code>@modelcontextprotocol/sdk</code> 构建，
                                通过 Streamable HTTP 传输协议暴露工具。服务端点位于 <code>/api/mcp</code>。
                            </p>

                            <h3 className="doc-h3 mt-6">暴露工具</h3>
                            <div className="mt-4 grid sm:grid-cols-2 gap-3">
                                <FeatureCard icon={<Zap className="w-5 h-5" />} color="yellow" title="novoscan_analyze" desc="创新性极速评估。输入想法描述 + 可选领域/语言，返回 0-100 评分和结构化报告" />
                                <FeatureCard icon={<Activity className="w-5 h-5" />} color="green" title="novoscan_status" desc="服务状态检查。返回版本号、运行状态、时间戳" />
                            </div>

                            <h3 className="doc-h3 mt-6">双通道鉴权</h3>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="OAuth 2.0 流程：通过 /api/oauth/authorize → /api/oauth/token 获取 Bearer Token，适用于 ChatGPT 等支持 OAuth 的客户端" />
                                <StepItem step={2} text="API Key 直传：通过 Supabase mcp_api_keys 表管理订阅密钥（含计划等级、每日限额、有效期），环境变量 MCP_API_KEYS 兆底" />
                            </div>

                            <InfoBox variant="note" className="mt-6">
                                服务以 <code>required: false</code> 模式运行，兼容无 OAuth 的客户端（如 Cursor）。最长支持 120 秒超时。
                            </InfoBox>

                            <h3 className="doc-h3 mt-6">快速接入</h3>
                            <p className="doc-text">
                                在 Claude Desktop 或 Cursor 的 MCP 配置文件中添加：
                            </p>
                            <div className="mt-4 p-4 bg-orange-50/60 rounded-2xl border border-orange-200 overflow-x-auto">
                                <pre className="text-sm text-gray-700 font-mono leading-relaxed">
                                    {`{
  "mcpServers": {
    "novoscan": {
      "url": "https://your-domain.com/api/mcp"
    }
  }
}`}
                                </pre>
                            </div>

                            <h3 className="doc-h3 mt-6">使用说明</h3>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="获取 API Key：由管理员在 Supabase mcp_api_keys 表中创建，或通过环境变量 MCP_API_KEYS 配置" />
                                <StepItem step={2} text="配置客户端：将上述 JSON 添加到 Claude Desktop / Cursor 的 MCP 配置文件" />
                                <StepItem step={3} text="调用工具：在对话中请求 AI 客户端评估某个创新想法，客户端会自动调用 novoscan_analyze 工具" />
                                <StepItem step={4} text="查看结果：AI 客户端收到 JSON 格式的评分 + 报告，并以自然语言呈现给用户" />
                            </div>
                        </DocSection>

                        {/* ========== 大章节六：核心技术架构 ========== */}
                        <div className="flex items-center gap-3 mb-6 mt-12">
                            <span className="text-xs font-black text-purple-500 bg-purple-500/10 px-2.5 py-1 rounded-full">六</span>
                            <span className="text-sm font-black text-gray-800 tracking-wide">核心技术架构</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-purple-500/20 to-transparent" />
                        </div>

                        {/* ==================== §4 多代理架构 ==================== */}
                        <DocSection id="multi-agent">
                            <SectionHeader icon={<Users />} color="purple" title="多代理架构" />
                            <p className="doc-text">
                                Novoscan 的核心竞争力在于其<strong>工业级多智能体（Multi-Agent）推理架构</strong>。
                                不同于传统的单一 AI 模型分析，Novoscan 部署了 6 名各司其职的 AI 专家代理，采用分层并行 + 串行的执行拓扑。
                            </p>

                            <div className="mt-6 mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">执行拓扑</div>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-black flex-shrink-0 mt-0.5">L1</span>
                                        <div>
                                            <span className="font-bold text-gray-800">并行层</span>
                                            <span className="text-gray-500 ml-2">学术审查员 + 产业分析员 + 竞品侦探 — 同时独立执行</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-black flex-shrink-0 mt-0.5">L2</span>
                                        <div>
                                            <span className="font-bold text-gray-800">串行层</span>
                                            <span className="text-gray-500 ml-2">创新评估师 — 综合三份 L1 报告进行交叉质疑</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 text-xs font-black flex-shrink-0 mt-0.5">L3</span>
                                        <div>
                                            <span className="font-bold text-gray-800">裁决层</span>
                                            <span className="text-gray-500 ml-2">仲裁员 — 动态权重调整、冲突解决、最终裁决</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs font-black flex-shrink-0 mt-0.5">L4</span>
                                        <div>
                                            <span className="font-bold text-gray-800">质检层</span>
                                            <span className="text-gray-500 ml-2">质量守卫 — 逻辑一致性检查、异常标记</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <AgentCard
                                    name="学术审查员"
                                    nameEn="Academic Reviewer"
                                    role="深度分析学术检索数据，从技术成熟度、论文覆盖度、学术空白、引用密度、发展趋势 5 个维度评估技术的学术基础。识别高相似论文并进行语义对标。"
                                    icon="📚"
                                    color="blue"
                                />
                                <AgentCard
                                    name="产业分析员"
                                    nameEn="Industry Analyst"
                                    role="分析产业信号数据（网页搜索结果、GitHub 开源项目），评估技术在工业界的落地状况、市场热度和开源生态成熟度。"
                                    icon="🏭"
                                    color="green"
                                />
                                <AgentCard
                                    name="竞品侦探"
                                    nameEn="Competitor Detective"
                                    role="从产业和学术数据中识别潜在竞品，分析竞争格局、技术壁垒和差异化空间。"
                                    icon="🔍"
                                    color="orange"
                                />
                                <AgentCard
                                    name="创新评估师"
                                    nameEn="Innovation Evaluator"
                                    role="综合三份 Layer1 报告进行交叉质疑，从原创性、技术壁垒、市场时机、执行可行性 4 个维度评估创新性，并生成 NovoStarchart 六维雷达图。"
                                    icon="💡"
                                    color="purple"
                                />
                                <AgentCard
                                    name="仲裁员"
                                    nameEn="Arbitrator"
                                    role="整合四位专家意见，根据置信度动态调整权重，系统性解决评分冲突，给出最终的加权综合评分、共识度判定和行动建议。优先使用 DeepSeek R1 深度推理模型。"
                                    icon="⚖️"
                                    color="yellow"
                                />
                                <AgentCard
                                    name="质量守卫"
                                    nameEn="Quality Guard"
                                    role="对最终报告进行逻辑一致性审查，检测评分矛盾、证据链断裂等质量问题，确保输出达到工业级可信标准。"
                                    icon="🛡️"
                                    color="gray"
                                />
                            </div>

                            <InfoBox variant="note" className="mt-6">
                                每个 Agent 都有独立的超时控制（35 秒）和智能降级机制。当某个 Agent 超时时，系统会基于原始数据的统计特征生成有信息量的降级评估，而非简单返回固定分数，确保分析流程永不中断。
                            </InfoBox>
                        </DocSection>

                        {/* ==================== §5 数据源与检索引擎 ==================== */}
                        <DocSection id="data-sources">
                            <SectionHeader icon={<Database />} color="amber" title="数据源与检索引擎" />
                            <p className="doc-text">
                                Novoscan 采用<strong>双轨并行检索引擎</strong>，同时从学术和产业两个维度获取原始数据，确保分析的全面性和权威性。
                            </p>

                            <h3 className="doc-h3 mt-8">学术检索轨道</h3>
                            <p className="doc-text">
                                四源聚合检索，覆盖全球主流学术数据库：
                            </p>
                            <div className="grid sm:grid-cols-2 gap-3 mt-4">
                                <DataSourceCard name="OpenAlex" desc="覆盖 2.5 亿+ 学术作品的开放学术图谱" color="blue" />
                                <DataSourceCard name="arXiv" desc="全球最大的预印本论文库，覆盖物理、数学、CS 等" color="red" />
                                <DataSourceCard name="CrossRef" desc="DOI 注册组织，覆盖 1.4 亿+ 学术元数据" color="green" />
                                <DataSourceCard name="CORE" desc="全球最大开放获取论文聚合器，2 亿+ 全文" color="yellow" />
                            </div>

                            <h3 className="doc-h3 mt-8">产业信号轨道</h3>
                            <p className="doc-text">
                                三源产业信号捕获，追踪技术在工业界的真实落地状况：
                            </p>
                            <div className="grid sm:grid-cols-3 gap-3 mt-4">
                                <DataSourceCard name="Brave Search" desc="隐私优先的网页搜索引擎" color="orange" />
                                <DataSourceCard name="SerpAPI" desc="Google 搜索结果结构化 API" color="blue" />
                                <DataSourceCard name="GitHub API" desc="全球最大开源代码托管平台" color="gray" />
                            </div>

                            <InfoBox variant="note" className="mt-6">
                                检索结果会经过交叉验证（Cross Validation），系统自动计算学术-产业一致性评分、概念重叠度，并识别红旗信号，确保数据质量。
                            </InfoBox>
                        </DocSection>

                        {/* ==================== §6 NovoStarchart 评分 ==================== */}
                        <DocSection id="scoring">
                            <SectionHeader icon={<Star />} color="yellow" title="NovoStarchart 评分体系" />
                            <p className="doc-text">
                                NovoStarchart 是 Novoscan 独创的<strong>六维创新性评估雷达图</strong>，由创新评估师 Agent 在综合分析后生成，
                                为用户提供直观的创新性全景视图。
                            </p>

                            <div className="mt-6 grid sm:grid-cols-2 gap-3">
                                <ScoreDimension name="技术突破性" nameEn="Tech Breakthrough" desc="技术方案在现有技术基础上的突破程度" />
                                <ScoreDimension name="学术空白度" nameEn="Academic Gap" desc="该方向在学术研究中的空白程度" />
                                <ScoreDimension name="市场时机" nameEn="Market Timing" desc="当前是否是该技术进入市场的最佳时机" />
                                <ScoreDimension name="执行可行性" nameEn="Feasibility" desc="技术方案的实际落地和执行难度" />
                                <ScoreDimension name="竞争壁垒" nameEn="Competitive Moat" desc="技术方案构建竞争壁垒的能力" />
                                <ScoreDimension name="生态成熟度" nameEn="Ecosystem Maturity" desc="相关工具链、社区和基础设施的成熟度" />
                            </div>

                            <h3 className="doc-h3 mt-8">综合评分机制</h3>
                            <p className="doc-text">
                                最终的综合创新评分由仲裁员 Agent 通过加权算法生成。权重根据各专家 Agent 的置信度动态调整：
                            </p>
                            <ul className="doc-list mt-3">
                                <li><strong>高置信度</strong>（high）：权重系数 × 1.2</li>
                                <li><strong>中置信度</strong>（medium）：权重系数 × 1.0</li>
                                <li><strong>低置信度</strong>（low）：权重系数 × 0.7</li>
                            </ul>
                            <p className="doc-text mt-3">
                                同时，仲裁员会评估专家之间的<strong>共识度</strong>（strong / moderate / weak），并记录少数派异议，
                                确保评估结果的透明度和可追溯性。
                            </p>
                        </DocSection>

                        {/* ==================== §7 智能追问系统 ==================== */}
                        <DocSection id="follow-up">
                            <SectionHeader icon={<MessageCircle />} color="teal" title="智能追问系统" />
                            <p className="doc-text">
                                Novoscan 的<strong>Follow-Up 智能追问系统</strong>允许用户在首次分析后进行多轮深度追问，逐步精化分析结果，
                                挖掘更深层次的洞察。
                            </p>

                            <h3 className="doc-h3 mt-6">工作流程</h3>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="首次分析完成后，系统自动生成 3-5 个基于分析结果的追问问题" />
                                <StepItem step={2} text="用户可选择感兴趣的追问问题，也可输入自定义问题" />
                                <StepItem step={3} text="系统重新触发多 Agent 分析流程，注入追问上下文进行精化推理" />
                                <StepItem step={4} text="报告实时更新，评分和分析结论根据新信息动态调整" />
                                <StepItem step={5} text="支持多轮追问（Round 2, 3, ...），每轮都会生成新的追问建议" />
                            </div>

                            <InfoBox variant="tip" className="mt-6">
                                追问系统的精化分析会将原始分析结果作为上下文传入，因此精化后的报告比首次分析更加精准和聚焦。
                            </InfoBox>
                        </DocSection>

                        {/* ========== 大章节七：工程与数据 ========== */}
                        <div className="flex items-center gap-3 mb-6 mt-12">
                            <span className="text-xs font-black text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-full">七</span>
                            <span className="text-sm font-black text-gray-800 tracking-wide">工程与数据</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-rose-500/20 to-transparent" />
                        </div>

                        {/* ==================== §8 工程亮点深度解读 ==================== */}
                        <DocSection id="tech-highlights">
                            <SectionHeader icon={<Flame />} color="red" title="工程亮点深度解读" />
                            <p className="doc-text">
                                Novoscan 不是一个简单的 API 调用包装器，而是一个经过深度工程优化的工业级系统。以下是我们引以为豪的核心技术实现。
                            </p>

                            {/* 亮点 1: 智能降级 */}
                            <div className="mt-8 space-y-6">
                                <HighlightCard
                                    num={1}
                                    title="智能降级 Fallback 引擎"
                                    color="blue"
                                    problem="传统方案中，Agent 超时直接返回固定分数（如 50 分），导致信息丢失严重"
                                    solution="基于原始检索数据的统计特征进行分布推断生成有信息量的降级评估"
                                    details={[
                                        '学术审查员：根据检索论文数量反推学术空白度（0 篇 = 85 分，20+ 篇 = 30 分），结合引用密度动态修正',
                                        '产业分析员：根据网页讨论数 + GitHub 项目数推断市场蓝海度（0 条 = 80 分，20+ 条 = 25 分）',
                                        '竞品侦探：识别高星项目（>5000⭐）计算竞争密度，零竞品场景给出 85 分高创新性评估',
                                        '创新评估师降级时自动生成六维 NovoStarchart 推断值，而非全部归零',
                                    ]}
                                />

                                {/* 亮点 2: AbortController */}
                                <HighlightCard
                                    num={2}
                                    title="AbortController 资源回收"
                                    color="red"
                                    problem="Agent 超时后底层 AI API 调用仍在运行，浪费昂贵的 Token 和服务器资源"
                                    solution="超时时通过 AbortController 立即取消底层 fetch 请求，实现零浪费超时控制"
                                    details={[
                                        '每个 Agent 启动时创建独立的 AbortController 实例',
                                        '超时 Promise.race 触发时立即调用 abort()，底层 HTTP 请求即刻终止',
                                        '异常捕获路径也包含 abort（防止内存泄漏），确保无论何种退出方式都会回收资源',
                                        '配合 TOTAL_MAX_DURATION（120秒全局截止时间），动态计算每个 Agent 的剩余可用时间',
                                    ]}
                                />

                                {/* 亮点 3: 动态权重 */}
                                <HighlightCard
                                    num={3}
                                    title="置信度驱动的动态权重仲裁"
                                    color="yellow"
                                    problem="不同 Agent 的分析质量参差不齐，简单平均会被低质量评分拖后腿"
                                    solution="仲裁员根据每个 Agent 自报的置信度（high/medium/low）动态调整其在最终评分中的权重"
                                    details={[
                                        '基础权重分配：学术 30% / 产业 25% / 创新 35% / 竞品 10%',
                                        '高置信度 → 权重 ×1.2；低置信度 → 权重 ×0.7',
                                        '统计推断（Fallback）的 Agent 自动标记为 low 置信度，降低其对最终评分的影响',
                                        '仲裁员记录共识度（strong/moderate/weak）和少数派异议，确保评判过程完全透明',
                                    ]}
                                />

                                {/* 亮点 4: 七源交叉验证 */}
                                <HighlightCard
                                    num={4}
                                    title="七源双轨交叉验证引擎"
                                    color="green"
                                    problem="单一来源的数据会存在偏见和盲区，仅靠学术数据无法反映工业界现状"
                                    solution="学术四源 + 产业三源并行检索，自动计算一致性评分、概念重叠度，并识别红旗信号"
                                    details={[
                                        '学术支撑度（strong/moderate/weak）：基于论文数量和引用密度',
                                        '产业支撑度：基于网页讨论热度和开源项目活跃度',
                                        '开源验证：自动检查 GitHub 上是否已存在类似实现',
                                        '概念重叠分析：提取学术关键词和产业关键词的交集，衡量两个维度的一致性',
                                        '红旗检测：如「学术大量研究但产业零落地」等矛盾信号',
                                    ]}
                                />

                                {/* 亮点 5: 质量守卫 */}
                                <HighlightCard
                                    num={5}
                                    title="质量守卫纯逻辑审查"
                                    color="purple"
                                    problem="AI 生成的报告可能存在逻辑矛盾（如评分很高但结论很负面），影响用户信任"
                                    solution="质量守卫 Agent 对最终报告进行纯逻辑一致性审查（不调用 AI API），毫秒级完成"
                                    details={[
                                        '检测评分矛盾：如学术 90 + 产业 20 → 标记异常',
                                        '证据链检查：验证每个结论是否都有对应的数据支撑',
                                        '一致性评分 0-100：量化报告整体的逻辑可靠性',
                                        '输出详细警告列表，在前端报告中以独立区块展示',
                                    ]}
                                />
                            </div>
                        </DocSection>

                        {/* ==================== §9 数据高利用率架构 ==================== */}
                        <DocSection id="data-utilization">
                            <SectionHeader icon={<Activity />} color="teal" title="数据高利用率架构" />
                            <p className="doc-text">
                                Novoscan 对从七个数据源检索到的每一比特数据都进行了<strong>极致利用</strong>。
                                数据不仅被 Agent 消费用于推理，还会在报告的不同层级中以多种形式呈现给用户。
                            </p>

                            <h3 className="doc-h3 mt-8">四层数据消费链</h3>
                            <p className="doc-text">
                                每一条检索数据至少被消费 4 次：
                            </p>

                            <div className="space-y-3 mt-4">
                                <DataChainItem
                                    layer="Layer 1"
                                    title="Agent 推理输入"
                                    desc="原始检索数据（论文标题/摘要/引用/GitHub Star/网页摘要）作为 Agent Prompt 的一部分，驱动 AI 深度推理。每个 Agent 独立消费和解读同一份数据。"
                                    color="blue"
                                />
                                <DataChainItem
                                    layer="Layer 2"
                                    title="Agent 输出重组"
                                    desc="Agent 输出的 keyFindings、redFlags、dimensionScores、confidenceReasoning 从 4 个 Agent 聚合到统一面板，交叉展示优势 vs 风险对照。"
                                    color="red"
                                />
                                <DataChainItem
                                    layer="Layer 3"
                                    title="交叉验证引擎"
                                    desc="双轨检索结果在验证引擎中自动计算一致性评分、概念重叠度、学术/产业支撑度，生成独立的可信度报告。"
                                    color="green"
                                />
                                <DataChainItem
                                    layer="Layer 4"
                                    title="原始数据透传"
                                    desc="全部七源原始数据（论文列表、GitHub 仓库、网页讨论、微信公众号文章）完整透传到前端，用户可在报告底部按需展开查看每一条原始数据。"
                                    color="yellow"
                                />
                            </div>

                            <h3 className="doc-h3 mt-8">数据字段级利用清单</h3>
                            <p className="doc-text">
                                以学术侧数据为例，每个字段都被充分利用：
                            </p>

                            <div className="mt-4 overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="text-left px-3 py-2 border border-gray-200 font-bold text-gray-700">数据字段</th>
                                            <th className="text-left px-3 py-2 border border-gray-200 font-bold text-gray-700">消费位置</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            ['论文数量 totalPapers', '学术审查员评分 + 智能 Fallback 推断 + 检索原始数据面板 + 交叉验证'],
                                            ['引用数 totalCitations', '引用密度维度评分 + Fallback 修正 + 统计卡片展示'],
                                            ['平均引用 avgCitation', '学术成熟度推断 + Fallback 分数修正（>100 则 -10分）'],
                                            ['开放获取数 openAccessCount', '检索报告展示 + 数据可得性评估'],
                                            ['分源计数 bySource', '四源分布标签（OA/AR/CR/CO）+ 原始数据面板'],
                                            ['热门概念 topConcepts', '研究方向标签云 + Agent Prompt 注入'],
                                            ['论文标题/摘要', '语义相似度计算 + SimilarityBar 对标展示 + Agent 推理依据'],
                                            ['GitHub Stars', '竞品密度评分 + 开源生态排行 + 原始数据展示'],
                                            ['市场情绪 sentiment', '产业热度标签（🔥热门/🌡️温和/❄️冷静）'],
                                        ].map(([field, usage], i) => (
                                            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                                <td className="px-3 py-2 border border-gray-200 font-medium text-gray-800 whitespace-nowrap">{field}</td>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-600">{usage}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <InfoBox variant="highlight" className="mt-6">
                                这种「同一数据多维度消费」的架构设计，确保了用户付出的每一次检索都物超所值——不仅获得 AI 的推理结论，
                                还可以追溯到每一条原始证据。
                            </InfoBox>
                        </DocSection>

                        {/* ==================== §10 三层递进报告架构 ==================== */}
                        <DocSection id="report-arch">
                            <SectionHeader icon={<FileBarChart2 />} color="purple" title="三层递进报告架构" />
                            <p className="doc-text">
                                Novoscan 的分析报告采用独创的<strong>「结论→证据→原始数据」三层递进架构</strong>，
                                让用户以最高效的方式消化信息：一屏看完核心结论，按需深入每一层证据。
                            </p>

                            <div className="mt-8 space-y-4">
                                <ReportLayerCard
                                    layer={1}
                                    title="结论仪表盘 Hero"
                                    subtitle="一屏看完核心结论"
                                    color="indigo"
                                    items={[
                                        '双评分仪表盘：学术创新综合分 + 产业实践可行性（环形进度条动画）',
                                        'AI 综合决策建议：渐变高亮卡片，仲裁员深度推理的最终结论',
                                        'NovoStarchart 六维雷达图：SVG 实时渲染，支持 hover 交互',
                                        '七源交叉验证可信度徽章：学术支撑/产业支撑/开源验证三维度速览',
                                        'AI Quality 质量检查状态：一致性评分 + Pass/Alert 标识',
                                    ]}
                                />
                                <ReportLayerCard
                                    layer={2}
                                    title="证据摘要层"
                                    subtitle="可折叠手风琴，按需展开"
                                    color="violet"
                                    items={[
                                        '优势 vs 风险对照面板：聚合全部 4 个 Agent 的 keyFindings 和 redFlags',
                                        '多智能体分析报告：完整的 5 个 Agent 可视化分析',
                                        'AI 深度思考过程：查看每个 Agent 的原始分析文本和仲裁员思维链（CoT）',
                                        '专家置信度总览：4 位专家的评分 + 置信度 + 置信理由',
                                        '仲裁决策明细：加权评分构成柱状图、已解决分歧、少数派异议、下一步建议',
                                        '评分维度拆解面板：学术/产业维度的细粒度子评分',
                                    ]}
                                />
                                <ReportLayerCard
                                    layer={3}
                                    title="原始数据层"
                                    subtitle="折叠区，需点击展开"
                                    color="slate"
                                    items={[
                                        '高相似度学术论文列表：语义相似度条 + 标题 + 关键差异',
                                        '全网相关资讯卡片：来源类型标签 + 摘要',
                                        '微信公众号文章：从产业搜索中提取的中文文章，含作者和日期',
                                        '七源检索原始数据总览：学术四源（论文数/引用/概念）+ 产业三源（讨论数/项目数/GitHub排行）',
                                        '深度审查报告：完整的学术/产业结构化子章节',
                                    ]}
                                />
                            </div>

                            <InfoBox variant="tip" className="mt-6">
                                这种三层架构借鉴了金字塔原理——结论先行，证据随后，原始数据兜底。
                                90% 的用户只需要看第一层就能做出决策，但需要深入验证时，所有数据都触手可及。
                            </InfoBox>
                        </DocSection>

                        {/* ==================== §11 创新趋势系统 ==================== */}
                        <DocSection id="trend-system">
                            <SectionHeader icon={<TrendingUp />} color="green" title="创新趋势系统" />
                            <p className="doc-text">
                                Novoscan 基于平台上所有用户的分析活动数据，每 <strong>2 天</strong>计算一次创新趋势快照，
                                通过可视化图表展示全球创新热度变化。
                            </p>

                            <h3 className="doc-h3 mt-8">趋势计算周期</h3>
                            <div className="space-y-3 mt-4">
                                <StepItem step={1} text="每 2 天触发一次趋势快照计算（Cron Job 或 API 调用）" />
                                <StepItem step={2} text="聚合该周期内所有分析记录：总搜索量、活跃创新数、新创新数、平均创新性评分" />
                                <StepItem step={3} text="按学科领域统计分布：计算每个 Domain 的搜索占比和趋势变化" />
                                <StepItem step={4} text="生成 TrendSnapshot 写入数据库，供前端图表消费" />
                            </div>

                            <h3 className="doc-h3 mt-8">可视化组件</h3>
                            <p className="doc-text">
                                首页的创新趋势区域展示以下图表：
                            </p>
                            <div className="mt-4 grid sm:grid-cols-2 gap-3">
                                <FeatureCard icon={<Gauge className="w-5 h-5" />} color="blue" title="统计卡片" desc="总创新数 / 近 7 日搜索量 / 平均新颖度 / 活跃领域数，带动画计数器" />
                                <FeatureCard icon={<TrendingUp className="w-5 h-5" />} color="red" title="趋势面积图" desc="近 10 个周期的搜索量和新创新数变化趋势（Recharts Area）" />
                                <FeatureCard icon={<BarChart3 className="w-5 h-5" />} color="green" title="领域分布柱状图" desc="各学科领域的搜索量分布，带学科图标和配色" />
                            </div>

                            <InfoBox variant="note" className="mt-6">
                                趋势数据采用前端 120 秒本地缓存策略，避免频繁请求后端 API。图表使用 Recharts 渲染，支持 hover tooltip 和自定义圆角样式。
                            </InfoBox>
                        </DocSection>

                        {/* ========== 大章节八：透明与信任 ========== */}
                        <div className="flex items-center gap-3 mb-6 mt-12">
                            <span className="text-xs font-black text-sky-500 bg-sky-500/10 px-2.5 py-1 rounded-full">八</span>
                            <span className="text-sm font-black text-gray-800 tracking-wide">透明与信任</span>
                            <div className="flex-1 h-px bg-gradient-to-r from-sky-500/20 to-transparent" />
                        </div>

                        {/* ==================== §12 评分系统数学基础 ==================== */}
                        <DocSection id="math-foundation">
                            <SectionHeader icon={<Sigma />} color="blue" title="评分系统数学基础" />
                            <p className="doc-text">
                                Novoscan 的所有评分机制均可追溯到现实世界的数学学科和工业标准。
                                下文透明披露每个评分组件的理论基础，供审计和学术引用。
                            </p>

                            {/* --- 1. WSM --- */}
                            <h3 className="doc-h3 mt-8">① 加权和模型（WSM）</h3>
                            <div className="mt-3 p-4 bg-sky-50/60 rounded-2xl border border-sky-200">
                                <div className="text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-2">应用于：BII 商业创新指数 · NovoStarchart 综合评分</div>
                                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                                    <strong>Weighted Sum Model</strong>（加权和模型）是运筹学中最经典的多准则决策方法。
                                    给定 <em>n</em> 个维度评分 <em>s₁…sₙ</em> 和对应权重 <em>w₁…wₙ</em>（∑wᵢ = 1），综合评分为：
                                </p>
                                <div className="p-3 bg-white rounded-xl border border-sky-100 font-mono text-sm text-center">
                                    S = ∑ wᵢ · sᵢ = w₁s₁ + w₂s₂ + … + wₙsₙ
                                </div>
                                <div className="mt-3 text-xs text-gray-500 space-y-1">
                                    <p>▸ <strong>BII 公式</strong>：w = (0.25, 0.30, 0.25, 0.20)，竞争态势权重最高因为创业领域竞争格局对结果影响最大</p>
                                    <p>▸ <strong>NovoStarchart</strong>：不同 Agent 的置信度作为动态权重，属于 WSM 的自适应变体</p>
                                    <p>▸ 文献：Fishburn, P.C. (1967) "Additive Utilities with Incomplete Product Set"</p>
                                </div>
                            </div>

                            {/* --- 2. AHP --- */}
                            <h3 className="doc-h3 mt-8">② 层次分析法（AHP）</h3>
                            <div className="mt-3 p-4 bg-amber-50/60 rounded-2xl border border-amber-200">
                                <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-2">应用于：NovoStarchart 六维雷达评分</div>
                                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                                    <strong>Analytic Hierarchy Process</strong> 由 Thomas L. Saaty 于 1970 年代提出，是多准则决策分析（MCDA）的金标准方法。
                                    NovoStarchart 的 6 维度评分体系参照了 AHP 的“目标层—准则层—方案层”分解思想：
                                </p>
                                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                                    <div className="p-2 bg-amber-100 rounded-lg font-bold text-amber-800">目标层<br />综合创新评分</div>
                                    <div className="p-2 bg-amber-100 rounded-lg font-bold text-amber-800">准则层<br />6 个维度</div>
                                    <div className="p-2 bg-amber-100 rounded-lg font-bold text-amber-800">方案层<br />4 Agent 报告</div>
                                </div>
                                <div className="mt-3 text-xs text-gray-500">
                                    <p>▸ 文献：Saaty, T.L. (1980) "The Analytic Hierarchy Process", McGraw-Hill</p>
                                    <p>▸ 其一致性比率（CR）检查思想对应了我们的质量护卫层</p>
                                </div>
                            </div>

                            {/* --- 3. Bayesian --- */}
                            <h3 className="doc-h3 mt-8">③ 贝叶斯后验加权</h3>
                            <div className="mt-3 p-4 bg-violet-50/60 rounded-2xl border border-violet-200">
                                <div className="text-[10px] font-bold text-violet-500 uppercase tracking-wider mb-2">应用于：置信度驱动的动态权重仲裁 · 智能降级推断</div>
                                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                                    贝叶斯定理提供了在已知证据下更新置信度的数学框架。
                                    Novoscan 的置信度加权机制直接复用了这一原理：
                                </p>
                                <div className="p-3 bg-white rounded-xl border border-violet-100 font-mono text-sm text-center">
                                    P(H|E) = P(E|H) · P(H) / P(E)
                                </div>
                                <div className="mt-3 text-xs text-gray-500 space-y-1">
                                    <p>▸ <strong>权重仲裁</strong>：high 置信度 Agent 的权重等价于“似然函数 P(E|H) 较大”，其评分在原始分基础上被放大</p>
                                    <p>▸ <strong>降级推断</strong>：Agent 超时时，利用已有数据构建先验分布 P(H)，等价于贝叶斯先验估计</p>
                                    <p>▸ 文献：Gelman, A. et al. (2013) "Bayesian Data Analysis", 3rd ed., CRC Press</p>
                                </div>
                            </div>

                            {/* --- 4. Fleiss' Kappa --- */}
                            <h3 className="doc-h3 mt-8">④ 多评分者一致性（Fleiss' κ）</h3>
                            <div className="mt-3 p-4 bg-green-50/60 rounded-2xl border border-green-200">
                                <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-2">应用于：交叉验证引擎一致性评分 · 质量护卫评分分散度检查</div>
                                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                                    <strong>Fleiss' Kappa</strong>（κ）由 Joseph Fleiss 于 1971 年提出，是衡量多个评分者间一致性的统计量。
                                    Bizscan 的交叉验证引擎的“一致性评分”直接映射了这一概念：
                                </p>
                                <div className="p-3 bg-white rounded-xl border border-green-100 font-mono text-sm text-center">
                                    κ = (P̅ - P̅ₑ) / (1 - P̅ₑ)
                                </div>
                                <div className="mt-3 grid sm:grid-cols-2 gap-2">
                                    {[
                                        ['κ > 0.80', '强一致 (strong)', '→ 对应 consistencyScore > 80'],
                                        ['0.60-0.80', '中等一致 (moderate)', '→ 对应 consistencyScore 60-80'],
                                        ['0.40-0.60', '弱一致 (fair)', '→ 触发警告'],
                                        ['κ < 0.40', '达到不一致 (poor)', '→ 被质量护卫扣分'],
                                    ].map(([k, label, mapped], i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                                            <span className="font-mono font-bold text-green-700 flex-shrink-0">{k}</span>
                                            <span>{label} {mapped}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-3 text-xs text-gray-500">
                                    ▸ 文献：Fleiss, J.L. (1971) "Measuring nominal scale agreement among many raters", Psychological Bulletin
                                </p>
                            </div>

                            {/* --- 5. Delphi --- */}
                            <h3 className="doc-h3 mt-8">⑤ Delphi 方法</h3>
                            <div className="mt-3 p-4 bg-rose-50/60 rounded-2xl border border-rose-200">
                                <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-2">应用于：多 Agent 独立评分 + 综合仲裁的整体架构</div>
                                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                                    <strong>Delphi 方法</strong>由兰德公司于 1950 年代提出，是结构化专家判断的金标准方法。
                                    Novoscan 的多 Agent 架构完美复现了 Delphi 的核心流程：
                                </p>
                                <div className="space-y-2 text-xs text-gray-600">
                                    <div className="flex items-start gap-2"><span className="font-bold text-rose-600 flex-shrink-0">➀</span><span><strong>匿名性</strong>: 各 Agent 独立评分，不受其他 Agent 影响（Layer 内并行执行）</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-rose-600 flex-shrink-0">➁</span><span><strong>统计聚合</strong>: 仲裁官以加权和的方式聚合所有专家意见，而非简单平均</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-rose-600 flex-shrink-0">➂</span><span><strong>反馈迭代</strong>: 交叉验证引擎提供第二轮“反馈”，各评分被校准后再进入仲裁</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-rose-600 flex-shrink-0">➃</span><span><strong>少数派记录</strong>: 仲裁官输出 dissent 字段，保留不同意见，对应 Delphi 的“少数报告”</span></div>
                                </div>
                                <p className="mt-3 text-xs text-gray-500">
                                    ▸ 文献：Linstone, H.A. & Turoff, M. (1975) "The Delphi Method: Techniques and Applications"
                                </p>
                            </div>

                            {/* --- 6. TF-IDF / BM25 --- */}
                            <h3 className="doc-h3 mt-8">⑥ TF-IDF / BM25 变体</h3>
                            <div className="mt-3 p-4 bg-orange-50/60 rounded-2xl border border-orange-200">
                                <div className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-2">应用于：smartPreFilter 零 AI 预筛</div>
                                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                                    smartPreFilter 的关键词匹配 + 安装量加权机制是经典信息检索模型的简化变体：
                                </p>
                                <div className="p-3 bg-white rounded-xl border border-orange-100 font-mono text-xs text-center leading-6">
                                    <div>TF-IDF: score(t, d) = tf(t,d) · log(N / df(t))</div>
                                    <div className="mt-1">Novoscan: score = Σ matchᵢ · wᵢ + log₁₀(installs) · 0.5</div>
                                </div>
                                <div className="mt-3 text-xs text-gray-500 space-y-1">
                                    <p>▸ 名称匹配权重 5 → 等价于 TF-IDF 中 title field 的 boost factor</p>
                                    <p>▸ log₁₀(installs) → 等价于 BM25 的文档权威度加成</p>
                                    <p>▸ 文献：Robertson, S.E. & Zaragoza, H. (2009) "The Probabilistic Relevance Framework: BM25 and Beyond"</p>
                                </div>
                            </div>

                            {/* --- 7. Mahalanobis --- */}
                            <h3 className="doc-h3 mt-8">⑦ Mahalanobis 距离 / 异常检测</h3>
                            <div className="mt-3 p-4 bg-slate-50/60 rounded-2xl border border-slate-200">
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">应用于：质量护卫极端值检测 · 评分分散度检查</div>
                                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                                    质量护卫层的“评分极端值检查”和“分散度检查”基于统计学中的异常检测原理：
                                </p>
                                <div className="space-y-2 text-xs text-gray-600">
                                    <div className="flex items-start gap-2"><span className="font-bold text-slate-700">IQR 法则</span><span>评分 &lt; 5 或 &gt; 98 触发警告 → 等价于 1.5×IQR 异常值检测（Tukey, 1977）</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-slate-700">Range</span><span>max-min 差值 &gt; 50 触发警告 → 等价于样本方差异常大的检测</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-slate-700">BII 偏移</span><span>BII 与四维均分差 &gt; 20 触发 issue → 等价于 Mahalanobis 距离的单维简化</span></div>
                                </div>
                                <p className="mt-3 text-xs text-gray-500">
                                    ▸ 文献：Tukey, J.W. (1977) "Exploratory Data Analysis", Addison-Wesley
                                </p>
                            </div>

                            {/* --- 8. MLE --- */}
                            <h3 className="doc-h3 mt-8">⑧ 最大似然估计（MLE）</h3>
                            <div className="mt-3 p-4 bg-teal-50/60 rounded-2xl border border-teal-200">
                                <div className="text-[10px] font-bold text-teal-500 uppercase tracking-wider mb-2">应用于：智能降级引擎的统计推断评分</div>
                                <p className="text-sm text-gray-700 leading-relaxed mb-3">
                                    当 Agent 超时时，降级引擎基于已有数据的统计特征推断评分，这是最大似然估计的实战应用：
                                </p>
                                <div className="space-y-2 text-xs text-gray-600">
                                    <div className="flex items-start gap-2"><span className="font-bold text-teal-700">市场降级</span><span>score = max(20, 75 - webCount · 2) → 以搜索结果数作为观测数据，用线性模型估计市场饺和度</span></div>
                                    <div className="flex items-start gap-2"><span className="font-bold text-teal-700">竞品降级</span><span>score = max(15, 80 - totalCompetitors · 3) → 以竞品数作为观测量，线性回归推断竞争强度</span></div>
                                </div>
                                <div className="mt-3 p-3 bg-white rounded-xl border border-teal-100 font-mono text-xs text-center">
                                    θ̂(MLE) = argmax L(θ|x) → 用已知数据 x 估计最可能的评分 θ
                                </div>
                                <p className="mt-3 text-xs text-gray-500">
                                    ▸ 文献：Myung, I.J. (2003) "Tutorial on Maximum Likelihood Estimation", J. of Mathematical Psychology
                                </p>
                            </div>

                            <InfoBox variant="highlight" className="mt-8">
                                所有评分公式均可在源码中直接审计。权重参数硬编码于编排器和仲裁官中，无隐藏的调分逻辑。
                                每个 Agent 的 Prompt 均包含明确的评分标准表，确保 AI 评分可复现、可解释。
                            </InfoBox>
                        </DocSection>

                        {/* ==================== §13 隐私与安全 ==================== */}
                        <DocSection id="privacy">
                            <SectionHeader icon={<Lock />} color="gray" title="隐私与安全" />
                            <p className="doc-text">
                                Novoscan 高度重视用户数据的隐私保护。系统提供多层隐私保障机制。
                            </p>

                            <div className="mt-6 space-y-4">
                                <PrivacyItem
                                    icon={<Shield className="w-5 h-5" />}
                                    title="隐私模式"
                                    desc="开启隐私模式后，分析记录不会被保存到本地 IndexedDB 或云端数据库。每次分析都是独立的一次性会话。"
                                />
                                <PrivacyItem
                                    icon={<Lock className="w-5 h-5" />}
                                    title="数据加密传输"
                                    desc="所有数据传输均通过 HTTPS 加密通道，确保分析内容在传输过程中不被窃取。"
                                />
                                <PrivacyItem
                                    icon={<Eye className="w-5 h-5" />}
                                    title="最小化数据收集"
                                    desc="系统仅收集分析所需的必要数据。用户偏好学习功能仅在登录状态下启用，且用户可随时关闭。"
                                />
                                <PrivacyItem
                                    icon={<Users className="w-5 h-5" />}
                                    title="认证体系"
                                    desc="基于 Supabase Auth 的安全认证体系，支持 Google OAuth 等主流登录方式。未登录用户有一次免费使用机会。"
                                />
                            </div>
                        </DocSection>

                        {/* ==================== §9 常见问题 ==================== */}
                        <DocSection id="faq">
                            <SectionHeader icon={<HelpCircle />} color="indigo" title="常见问题" />

                            <div className="mt-6 space-y-4">
                                <FaqItem
                                    q="Novoscan 支持哪些 AI 模型？"
                                    a="目前支持 DeepSeek V3（默认）和 MiniMax M2.5。仲裁员 Agent 优先使用 DeepSeek R1 深度推理模型以获得更高质量的裁决分析。"
                                />
                                <FaqItem
                                    q="分析一次需要多长时间？"
                                    a="常规查重模式通常在 30-60 秒内完成。Bizscan 商业评估模式由于涉及更多 Agent 协作，可能需要 60-120 秒。系统设有 120 秒（常规）/ 150 秒（Bizscan）的总流程强制截止时间。"
                                />
                                <FaqItem
                                    q="如何选择合适的功能模式？"
                                    a="如果你是科研人员，需要评估研究想法的学术创新性，请使用「常规查重」。如果你需要快速验证某项技术方案，使用「Skill 查重」。如果你是创业者，需要评估商业想法的市场可行性和竞争力，使用「商业查重 Bizscan」。"
                                />
                                <FaqItem
                                    q="免费使用有什么限制？"
                                    a="未登录用户可以免费使用一次常规查重，Bizscan 也有一次免费额度。登录后可不受限使用所有功能。"
                                />
                                <FaqItem
                                    q="分析结果可以导出吗？"
                                    a="是的，常规查重模式支持将分析报告导出为学术风格的 PDF 文档，包含完整的方法论说明、关键发现和数据图表。"
                                />
                                <FaqItem
                                    q="什么是学科聚焦筛选？"
                                    a="在常规查重模式中，你可以选择特定的学科领域（如工学 > 机器学习），系统会在分析时优先关注该领域的期刊、顶会和代表性研究者，提供更专业精准的评估。"
                                />
                                <FaqItem
                                    q="Agent 超时会影响结果质量吗？"
                                    a="不会。Novoscan 采用智能降级机制——当某个 Agent 超时时，系统会基于原始检索数据的统计特征生成有信息量的降级评估，而非简单返回一个固定分数。最终结果仍然具有参考价值。"
                                />
                            </div>
                        </DocSection>

                        {/* 页脚 */}
                        <div className="mt-16 pt-8 border-t border-gray-200 text-center">
                            <p className="text-sm text-gray-400 font-medium">
                                © {new Date().getFullYear()} Novoscan · Powered by Multi-Agent Reasoning Engine
                            </p>
                            <Link href="/" className="inline-flex items-center gap-2 mt-4 text-sm font-bold text-novo-blue hover:underline">
                                <ArrowLeft className="w-4 h-4" />
                                返回首页开始分析
                            </Link>
                        </div>

                    </div>
                </main>
            </div >
            <BottomTabBar />
        </div >
        </WorkspaceShell>
    );
}


/* ============================================================
   子组件
   ============================================================ */

function DocSection({ id, children }: { id: string; children: React.ReactNode }) {
    return (
        <motion.section
            id={id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            className="mb-16 scroll-mt-28"
        >
            {children}
        </motion.section>
    );
}

function SectionHeader({ icon, color, title }: { icon: React.ReactNode; color: string; title: string }) {
    const colorMap: Record<string, string> = {
        blue: 'bg-novo-blue/10 text-novo-blue border-novo-blue/20',
        red: 'bg-novo-red/10 text-novo-red border-novo-red/20',
        green: 'bg-novo-green/10 text-novo-green border-novo-green/20',
        yellow: 'bg-yellow-100 text-yellow-600 border-yellow-200',
        purple: 'bg-purple-100 text-purple-600 border-purple-200',
        amber: 'bg-amber-100 text-amber-600 border-amber-200',
        teal: 'bg-teal-100 text-teal-600 border-teal-200',
        gray: 'bg-gray-100 text-gray-600 border-gray-200',
        indigo: 'bg-indigo-100 text-indigo-600 border-indigo-200',
        orange: 'bg-orange-100 text-orange-600 border-orange-200',
    };
    return (
        <div className="flex items-center gap-3 mb-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorMap[color] || colorMap.blue}`}>
                {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">{title}</h2>
        </div>
    );
}

function FeatureCard({ icon, color, title, desc }: { icon: React.ReactNode; color: string; title: string; desc: string }) {
    const colorMap: Record<string, string> = {
        blue: 'bg-novo-blue/10 text-novo-blue border-novo-blue/20',
        red: 'bg-novo-red/10 text-novo-red border-novo-red/20',
        green: 'bg-novo-green/10 text-novo-green border-novo-green/20',
    };
    return (
        <div className="p-4 bg-white/95 rounded-2xl border border-gray-200/60 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-3 ${colorMap[color] || colorMap.blue}`}>
                {icon}
            </div>
            <h4 className="font-bold text-gray-900 text-sm mb-1">{title}</h4>
            <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
        </div>
    );
}

function PipelineStep({ step, title, desc, icon, color, isLast }: { step: number; title: string; desc: string; icon: React.ReactNode; color: string; isLast?: boolean }) {
    const colorMap: Record<string, string> = {
        blue: 'bg-novo-blue text-white',
        red: 'bg-novo-red text-white',
        yellow: 'bg-yellow-400 text-yellow-900',
        green: 'bg-novo-green text-white',
        purple: 'bg-purple-500 text-white',
    };
    return (
        <div className="flex gap-4">
            <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${colorMap[color]}`}>
                    {step}
                </div>
                {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
            </div>
            <div className={`pb-8 ${isLast ? '' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-400">{icon}</span>
                    <h4 className="font-bold text-gray-900">{title}</h4>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}

function ModeCard({ title, icon, color, path, features, desc }: { title: string; icon: React.ReactNode; color: string; path: string; features: string[]; desc: string }) {
    const colorMap: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
        blue: { bg: 'bg-novo-blue/5', border: 'border-novo-blue/20', icon: 'text-novo-blue', badge: 'bg-novo-blue/10 text-novo-blue' },
        yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-500', badge: 'bg-yellow-100 text-yellow-700' },
        amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', badge: 'bg-amber-100 text-amber-700' },
    };
    const c = colorMap[color] || colorMap.blue;

    return (
        <div className={`p-6 rounded-2xl border ${c.bg} ${c.border} hover:shadow-md transition-shadow`}>
            <div className="flex items-center gap-3 mb-3">
                <span className={c.icon}>{icon}</span>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">{title}</h3>
                <Link href={path} className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${c.badge} hover:opacity-80 transition-opacity`}>
                    前往 →
                </Link>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">{desc}</p>
            <div className="space-y-1.5">
                {features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AgentCard({ name, nameEn, role, icon, color }: { name: string; nameEn: string; role: string; icon: string; color: string }) {
    const colorMap: Record<string, string> = {
        blue: 'border-l-novo-blue',
        green: 'border-l-novo-green',
        orange: 'border-l-orange-400',
        purple: 'border-l-purple-500',
        yellow: 'border-l-yellow-400',
        gray: 'border-l-gray-400',
    };
    return (
        <div className={`p-4 bg-white/95 rounded-xl border border-gray-200/60 border-l-4 ${colorMap[color]} hover:shadow-sm transition-shadow`}>
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{icon}</span>
                <span className="font-bold text-gray-900">{name}</span>
                <span className="text-xs text-gray-400 font-medium">{nameEn}</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">{role}</p>
        </div>
    );
}

function InfoBox({ variant, className = '', children }: { variant: 'note' | 'tip' | 'highlight'; className?: string; children: React.ReactNode }) {
    const styles = {
        note: 'bg-blue-50 border-blue-200 text-blue-800',
        tip: 'bg-green-50 border-green-200 text-green-800',
        highlight: 'bg-amber-50 border-amber-200 text-amber-800',
    };
    const icons = {
        note: '📌',
        tip: '💡',
        highlight: '✨',
    };
    return (
        <div className={`p-4 rounded-xl border text-sm leading-relaxed ${styles[variant]} ${className}`}>
            <span className="mr-2">{icons[variant]}</span>
            {children}
        </div>
    );
}

function DataSourceCard({ name, desc, color }: { name: string; desc: string; color: string }) {
    const colorMap: Record<string, string> = {
        blue: 'border-l-novo-blue',
        red: 'border-l-novo-red',
        green: 'border-l-novo-green',
        yellow: 'border-l-yellow-400',
        orange: 'border-l-orange-400',
        gray: 'border-l-gray-400',
    };
    return (
        <div className={`p-3 bg-white/95 rounded-lg border border-gray-200/60 border-l-4 ${colorMap[color]}`}>
            <div className="font-bold text-gray-900 text-sm">{name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
        </div>
    );
}

function ScoreDimension({ name, nameEn, desc }: { name: string; nameEn: string; desc: string }) {
    return (
        <div className="p-3 bg-white/95 rounded-xl border border-gray-200/60 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="font-bold text-gray-900 text-sm">{name}</span>
                <span className="text-xs text-gray-400">{nameEn}</span>
            </div>
            <p className="text-xs text-gray-500">{desc}</p>
        </div>
    );
}

function StepItem({ step, text }: { step: number; text: string }) {
    return (
        <div className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-100 text-teal-600 text-xs font-black flex-shrink-0 mt-0.5">{step}</span>
            <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
        </div>
    );
}

function PrivacyItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
    return (
        <div className="flex items-start gap-4 p-4 bg-white/95 rounded-xl border border-gray-200/60">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 text-gray-600">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">{title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}

function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="bg-white/95 rounded-xl border border-gray-200/60 overflow-hidden hover:shadow-sm transition-shadow">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-4 text-left"
            >
                <span className="font-bold text-gray-900 text-sm pr-4">{q}</span>
                <ChevronRight className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="px-4 pb-4 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
                            {a}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function HighlightCard({ num, title, color, problem, solution, details }: { num: number; title: string; color: string; problem: string; solution: string; details: string[] }) {
    const colorMap: Record<string, { num: string; border: string; bg: string; icon: string }> = {
        blue: { num: 'bg-novo-blue text-white', border: 'border-l-novo-blue', bg: 'bg-blue-50/30', icon: 'text-novo-blue' },
        red: { num: 'bg-novo-red text-white', border: 'border-l-novo-red', bg: 'bg-red-50/30', icon: 'text-novo-red' },
        yellow: { num: 'bg-yellow-400 text-yellow-900', border: 'border-l-yellow-400', bg: 'bg-yellow-50/30', icon: 'text-yellow-600' },
        green: { num: 'bg-novo-green text-white', border: 'border-l-novo-green', bg: 'bg-green-50/30', icon: 'text-novo-green' },
        purple: { num: 'bg-purple-500 text-white', border: 'border-l-purple-500', bg: 'bg-purple-50/30', icon: 'text-purple-500' },
    };
    const c = colorMap[color] || colorMap.blue;
    return (
        <div className={`p-5 rounded-2xl border border-gray-200/60 border-l-4 ${c.border} ${c.bg}`}>
            <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-black flex-shrink-0 ${c.num}`}>{num}</span>
                <h4 className="font-black text-gray-900 text-base tracking-tight">{title}</h4>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                    <div className="text-[10px] font-bold text-rose-500 uppercase mb-1">❌ 问题</div>
                    <p className="text-xs text-rose-800 leading-relaxed">{problem}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="text-[10px] font-bold text-emerald-500 uppercase mb-1">✅ 方案</div>
                    <p className="text-xs text-emerald-800 leading-relaxed">{solution}</p>
                </div>
            </div>
            <div className="space-y-1.5">
                {details.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className={`text-xs mt-0.5 flex-shrink-0 ${c.icon}`}>▸</span>
                        <span className="leading-relaxed">{d}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function DataChainItem({ layer, title, desc, color }: { layer: string; title: string; desc: string; color: string }) {
    const colorMap: Record<string, string> = {
        blue: 'bg-novo-blue text-white',
        red: 'bg-novo-red text-white',
        green: 'bg-novo-green text-white',
        yellow: 'bg-yellow-400 text-yellow-900',
    };
    return (
        <div className="flex items-start gap-4 p-4 bg-white/95 rounded-xl border border-gray-200/60">
            <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-[10px] font-black flex-shrink-0 mt-0.5 ${colorMap[color]}`}>
                {layer}
            </span>
            <div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">{title}</h4>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}

function ReportLayerCard({ layer, title, subtitle, color, items }: { layer: number; title: string; subtitle: string; color: string; items: string[] }) {
    const colorMap: Record<string, { bg: string; border: string; num: string }> = {
        indigo: { bg: 'bg-indigo-50/50', border: 'border-indigo-200', num: 'bg-indigo-500 text-white' },
        violet: { bg: 'bg-violet-50/50', border: 'border-violet-200', num: 'bg-violet-500 text-white' },
        slate: { bg: 'bg-slate-50/50', border: 'border-slate-200', num: 'bg-slate-500 text-white' },
    };
    const c = colorMap[color] || colorMap.indigo;
    return (
        <div className={`p-5 rounded-2xl border ${c.bg} ${c.border}`}>
            <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black flex-shrink-0 ${c.num}`}>L{layer}</span>
                <div>
                    <h4 className="font-black text-gray-900 text-sm">{title}</h4>
                    <p className="text-xs text-gray-500">{subtitle}</p>
                </div>
            </div>
            <div className="space-y-1.5">
                {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
