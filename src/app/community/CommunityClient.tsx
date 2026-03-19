'use client';

/**
 * 社区工作流市场 — 客户端交互组件
 *
 * 功能：
 * - 展示本地已导入的社区工作流
 * - 内置精选社区模板（示例数据）
 * - 一键导入到本地工作流库
 * - 从文件/分享链接导入
 * - 分享码生成与导入
 *
 * UI 现代化：使用 WorkspaceShell 布局 + Tailwind + CSS 变量 + 暗色模式适配
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Upload, Link2, X, Search, Download, Calendar,
  Users, Trash2, ExternalLink, Sparkles, Zap, Leaf, FlaskConical,
} from 'lucide-react';
import WorkspaceShell from '@/components/layout/WorkspaceShell';
import BottomTabBar from '@/components/layout/BottomTabBar';
import { validateWorkflow } from '@/workflow/validator';

// ==================== 类型定义 ====================

interface CommunityWorkflow {
    id: string;
    name: string;
    nameEn: string;
    description: string;
    icon: string;
    author: string;
    nodeCount: number;
    tags: string[];
    downloads: number;
    sharedAt: number;
    /** 完整 JSON（内置预置的才有） */
    snapshot?: Record<string, unknown>;
}

// ==================== 内置精选社区模板 ====================

const FEATURED_TEMPLATES: CommunityWorkflow[] = [
    {
        id: 'community-deep-tech',
        name: '深度科技评估',
        nameEn: 'Deep Tech Assessment',
        description: '适用于前沿科技项目（量子计算、AI芯片、生物技术），增加额外的学术深度分析和专利检索步骤',
        icon: '🔬',
        author: 'Novoscan Team',
        nodeCount: 7,
        tags: ['科技', '深度分析', '专利'],
        downloads: 128,
        sharedAt: Date.now() - 7 * 86400000,
    },
    {
        id: 'community-market-entry',
        name: '市场进入策略',
        nameEn: 'Market Entry Strategy',
        description: '针对新市场进入场景，重点分析竞品格局、供应链和法规风险',
        icon: '🚀',
        author: 'Innovation Lab',
        nodeCount: 6,
        tags: ['市场', '策略', '竞品'],
        downloads: 86,
        sharedAt: Date.now() - 14 * 86400000,
    },
    {
        id: 'community-esg-audit',
        name: 'ESG 合规审查',
        nameEn: 'ESG Compliance Audit',
        description: '围绕 ESG（环境、社会、治理）维度评估创新项目的长期可持续性',
        icon: '🌿',
        author: 'GreenTech DAO',
        nodeCount: 5,
        tags: ['ESG', '可持续', '合规'],
        downloads: 52,
        sharedAt: Date.now() - 30 * 86400000,
    },
    {
        id: 'community-minimal-fast',
        name: '极速轻量分析',
        nameEn: 'Ultra-Fast Minimal',
        description: '仅保留学术+仲裁的最小管线，适合快速筛选、批量评估',
        icon: '⚡',
        author: 'SpeedRunner',
        nodeCount: 3,
        tags: ['快速', '轻量', '批量'],
        downloads: 203,
        sharedAt: Date.now() - 3 * 86400000,
    },
];

/** 模板图标组件映射 */
function getTemplateIcon(icon: string) {
    switch (icon) {
        case '🔬': return <FlaskConical className="w-5 h-5" />;
        case '🚀': return <Sparkles className="w-5 h-5" />;
        case '🌿': return <Leaf className="w-5 h-5" />;
        case '⚡': return <Zap className="w-5 h-5" />;
        default: return <span className="text-xl">{icon}</span>;
    }
}

// localStorage 键
const COMMUNITY_IMPORTED_KEY = 'novoscan_community_imported';

// ==================== 卡片组件 ====================

interface CommunityCardProps {
    workflow: CommunityWorkflow;
    index: number;
    onImport: () => void;
    onDelete?: () => void;
    isImported?: boolean;
}

function CommunityCard({ workflow, index, onImport, onDelete, isImported }: CommunityCardProps) {
    const formatDate = (ts: number) => {
        const d = new Date(ts);
        return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
        >
            <div className="group relative bg-white/95 dark:bg-[var(--novo-bg-surface)] rounded-2xl border border-gray-100/80 dark:border-[var(--novo-border-default)] p-5 h-full transition-all duration-300 hover:border-gray-300 dark:hover:border-[var(--novo-border-strong)] hover:shadow-md dark:hover:shadow-[0_0_30px_rgba(96,165,250,0.08)] hover:-translate-y-0.5">
                {/* 悬浮光效 */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/0 via-blue-500/0 to-cyan-500/0 group-hover:from-purple-500/5 group-hover:via-blue-500/3 group-hover:to-cyan-500/3 transition-all duration-500 pointer-events-none" />

                {/* 头部 */}
                <div className="relative flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 bg-gray-50 dark:bg-[var(--novo-bg-base)] rounded-xl flex items-center justify-center text-2xl border border-gray-200 dark:border-[var(--novo-border-default)] shrink-0 group-hover:border-purple-500/30 dark:group-hover:border-purple-500/20 transition-colors">
                        {workflow.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-[var(--novo-text-primary)] truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {workflow.name}
                        </h3>
                        <div className="text-[11px] text-gray-400 dark:text-[var(--novo-text-muted)] truncate">{workflow.nameEn}</div>
                    </div>
                    {isImported && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shrink-0">
                            已导入
                        </span>
                    )}
                </div>

                {/* 作者 */}
                <div className="relative text-[10px] text-gray-400 dark:text-[var(--novo-text-muted)] mb-2 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {workflow.author}
                </div>

                {/* 描述 */}
                <p className="relative text-xs text-gray-500 dark:text-[var(--novo-text-secondary)] leading-relaxed mb-3 line-clamp-2 min-h-[2.5rem]">
                    {workflow.description}
                </p>

                {/* 标签 */}
                <div className="relative flex flex-wrap gap-1.5 mb-3">
                    {workflow.tags.map(tag => (
                        <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[var(--novo-bg-elevated)] text-gray-500 dark:text-[var(--novo-text-muted)] border border-gray-200/50 dark:border-[var(--novo-border-default)]">
                            {tag}
                        </span>
                    ))}
                </div>

                {/* 底部：元数据 + 操作 */}
                <div className="relative flex items-center justify-between pt-3 border-t border-gray-100 dark:border-[var(--novo-border-default)]">
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-[var(--novo-text-muted)]">
                        <span className="flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            {workflow.nodeCount} 节点
                        </span>
                        <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {workflow.downloads}
                        </span>
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(workflow.sharedAt)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={onImport}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 transition-all active:scale-95"
                        >
                            📥 导入
                        </button>
                        {isImported && onDelete && (
                            <button
                                onClick={() => {
                                    if (confirm(`确定删除「${workflow.name}」吗？`)) onDelete();
                                }}
                                className="p-1 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

// ==================== 主组件 ====================

export default function CommunityClient() {
    const [importedWorkflows, setImportedWorkflows] = useState<CommunityWorkflow[]>([]);
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [shareCodeInput, setShareCodeInput] = useState('');
    const [showShareImport, setShowShareImport] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 加载已导入的社区工作流
    useEffect(() => {
        try {
            const stored = localStorage.getItem(COMMUNITY_IMPORTED_KEY);
            if (stored) setImportedWorkflows(JSON.parse(stored));
        } catch { /* ignore */ }
    }, []);

    // 收集所有标签
    const allTags = Array.from(new Set(
        [...FEATURED_TEMPLATES, ...importedWorkflows].flatMap(w => w.tags)
    ));

    // 过滤
    const filteredFeatured = activeTag
        ? FEATURED_TEMPLATES.filter(w => w.tags.includes(activeTag))
        : FEATURED_TEMPLATES;
    const filteredImported = activeTag
        ? importedWorkflows.filter(w => w.tags.includes(activeTag))
        : importedWorkflows;

    // 导入到本地工作流库
    const importToLocal = useCallback((wf: CommunityWorkflow) => {
        const info = {
            id: wf.id,
            name: wf.name,
            nameEn: wf.nameEn,
            description: wf.description,
            descriptionEn: wf.description,
            icon: wf.icon,
            nodeCount: wf.nodeCount,
        };
        const customs = JSON.parse(localStorage.getItem('novoscan_custom_workflows') || '[]');
        if (customs.some((c: { id: string }) => c.id === wf.id)) {
            setImportMsg({ type: 'error', text: `「${wf.name}」已存在于本地工作流中` });
            setTimeout(() => setImportMsg(null), 3000);
            return;
        }
        const updated = [...customs, info];
        localStorage.setItem('novoscan_custom_workflows', JSON.stringify(updated));

        if (wf.snapshot) {
            localStorage.setItem(`novoscan_wf_${wf.id}`, JSON.stringify(wf.snapshot));
        }

        setImportMsg({ type: 'success', text: `✅ 已导入「${wf.name}」到本地工作流` });
        setTimeout(() => setImportMsg(null), 3000);
    }, []);

    // 从文件导入社区工作流
    const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const json = JSON.parse(reader.result as string);
                const result = validateWorkflow(json);
                if (!result.valid) {
                    setImportMsg({ type: 'error', text: `校验失败：${result.errors.join('；')}` });
                    return;
                }
                const cwf: CommunityWorkflow = {
                    id: json.id || `imported-${Date.now()}`,
                    name: json.name || '导入的工作流',
                    nameEn: json.nameEn || 'Imported Workflow',
                    description: json.description || '',
                    icon: json.icon || '📦',
                    author: json.meta?.sharedBy || json.author || '未知作者',
                    nodeCount: json.nodes?.length || 0,
                    tags: json.meta?.tags || ['导入'],
                    downloads: json.meta?.downloads || 0,
                    sharedAt: json.meta?.sharedAt || Date.now(),
                    snapshot: json,
                };
                const updatedImported = [...importedWorkflows.filter(w => w.id !== cwf.id), cwf];
                setImportedWorkflows(updatedImported);
                localStorage.setItem(COMMUNITY_IMPORTED_KEY, JSON.stringify(updatedImported));
                importToLocal(cwf);
            } catch (err) {
                setImportMsg({ type: 'error', text: `解析失败：${err instanceof Error ? err.message : '无效 JSON'}` });
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }, [importedWorkflows, importToLocal]);

    // 从分享码导入
    const handleShareCodeImport = useCallback(() => {
        if (!shareCodeInput.trim()) return;
        try {
            const decoded = atob(shareCodeInput.trim());
            const json = JSON.parse(decoded);
            const result = validateWorkflow(json);
            if (!result.valid) {
                setImportMsg({ type: 'error', text: `分享码校验失败：${result.errors.join('；')}` });
                return;
            }
            const cwf: CommunityWorkflow = {
                id: json.id || `shared-${Date.now()}`,
                name: json.name || '分享的工作流',
                nameEn: json.nameEn || 'Shared Workflow',
                description: json.description || '',
                icon: json.icon || '🔗',
                author: json.meta?.sharedBy || json.author || '未知作者',
                nodeCount: json.nodes?.length || 0,
                tags: json.meta?.tags || ['分享'],
                downloads: (json.meta?.downloads || 0) + 1,
                sharedAt: json.meta?.sharedAt || Date.now(),
                snapshot: json,
            };
            const updatedImported = [...importedWorkflows.filter(w => w.id !== cwf.id), cwf];
            setImportedWorkflows(updatedImported);
            localStorage.setItem(COMMUNITY_IMPORTED_KEY, JSON.stringify(updatedImported));
            importToLocal(cwf);
            setShareCodeInput('');
            setShowShareImport(false);
        } catch {
            setImportMsg({ type: 'error', text: '分享码格式无效（需要 base64 编码的 JSON）' });
        }
    }, [shareCodeInput, importedWorkflows, importToLocal]);

    // 删除已导入
    const handleDelete = useCallback((id: string) => {
        const updated = importedWorkflows.filter(w => w.id !== id);
        setImportedWorkflows(updated);
        localStorage.setItem(COMMUNITY_IMPORTED_KEY, JSON.stringify(updated));
    }, [importedWorkflows]);

    return (
        <WorkspaceShell>
        <div className="min-h-screen bg-white dark:bg-[var(--novo-bg-base)] text-gray-900 dark:text-[var(--novo-text-primary)] flex flex-col" style={{ overflowX: 'clip' }}>
            {/* 背景装饰 — 仅暗色模式 */}
            <div className="fixed inset-0 pointer-events-none z-0 hidden dark:block">
                <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[150px]" />
                <div className="absolute bottom-1/3 left-1/3 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[150px]" />
                <div className="absolute top-1/2 right-1/2 w-[400px] h-[400px] bg-cyan-600/3 rounded-full blur-[120px]" />
            </div>

            {/* 主内容 */}
            <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 lg:pb-8">

                {/* 顶部导航 + 标题 */}
                <div className="mb-6">
                    <Link href="/workflow" className="inline-flex items-center gap-2 text-gray-400 dark:text-[var(--novo-text-muted)] hover:text-purple-600 dark:hover:text-purple-400 font-bold text-sm transition-colors mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        返回工作流
                    </Link>
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 bg-purple-500/10 dark:bg-purple-500/15 rounded-xl flex items-center justify-center border border-purple-500/20">
                                <Users className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-[0.2em]">Community Market</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white mb-1">
                            🌐 社区工作流市场
                        </h1>
                        <p className="text-sm text-gray-400 dark:text-[var(--novo-text-secondary)] max-w-xl">
                            发现社区创建的工作流模板，一键导入到你的分析管线。
                        </p>
                    </motion.div>
                </div>

                {/* 操作栏 */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6"
                >
                    {/* 标签过滤 */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button
                            onClick={() => setActiveTag(null)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                                !activeTag
                                    ? 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30'
                                    : 'bg-gray-50 dark:bg-[var(--novo-bg-surface)] text-gray-500 dark:text-[var(--novo-text-muted)] border-gray-200 dark:border-[var(--novo-border-default)] hover:text-gray-700 dark:hover:text-[var(--novo-text-secondary)] hover:border-gray-300 dark:hover:border-[var(--novo-border-strong)]'
                            }`}
                        >
                            🌐 全部
                        </button>
                        {allTags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                                    activeTag === tag
                                        ? 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30'
                                        : 'bg-gray-50 dark:bg-[var(--novo-bg-surface)] text-gray-500 dark:text-[var(--novo-text-muted)] border-gray-200 dark:border-[var(--novo-border-default)] hover:text-gray-700 dark:hover:text-[var(--novo-text-secondary)] hover:border-gray-300 dark:hover:border-[var(--novo-border-strong)]'
                                }`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>

                    {/* 导入按钮组 */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setShowShareImport(!showShareImport)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                showShareImport
                                    ? 'bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-300'
                                    : 'bg-gray-50 dark:bg-[var(--novo-bg-surface)] text-gray-500 dark:text-[var(--novo-text-muted)] border-gray-200 dark:border-[var(--novo-border-default)] hover:border-gray-300 dark:hover:border-[var(--novo-border-strong)]'
                            }`}
                        >
                            <Link2 className="w-3.5 h-3.5" />
                            分享码导入
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-50 dark:bg-[var(--novo-bg-surface)] text-gray-500 dark:text-[var(--novo-text-muted)] border border-gray-200 dark:border-[var(--novo-border-default)] hover:border-gray-300 dark:hover:border-[var(--novo-border-strong)] transition-all"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            从文件导入
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={handleFileImport}
                        />
                    </div>
                </motion.div>

                {/* 分享码导入面板 */}
                <AnimatePresence>
                    {showShareImport && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-5 overflow-hidden"
                        >
                            <div className="bg-white dark:bg-[var(--novo-bg-surface)] border border-gray-200 dark:border-[var(--novo-border-default)] rounded-xl p-4">
                                <div className="text-xs font-bold text-gray-700 dark:text-[var(--novo-text-primary)] mb-2 flex items-center gap-2">
                                    <Link2 className="w-3.5 h-3.5 text-purple-500" />
                                    粘贴分享码
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        value={shareCodeInput}
                                        onChange={e => setShareCodeInput(e.target.value)}
                                        placeholder="粘贴 base64 分享码..."
                                        className="flex-1 bg-gray-50 dark:bg-[var(--novo-bg-base)] rounded-lg border border-gray-200 dark:border-[var(--novo-border-default)] px-3 py-2 text-xs text-gray-900 dark:text-[var(--novo-text-primary)] placeholder-gray-400 dark:placeholder-[var(--novo-text-muted)] focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 font-mono transition-colors"
                                    />
                                    <button
                                        onClick={handleShareCodeImport}
                                        disabled={!shareCodeInput.trim()}
                                        className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                                    >
                                        导入
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Toast 提示 */}
                <AnimatePresence>
                    {importMsg && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`mb-5 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold border ${
                                importMsg.type === 'success'
                                    ? 'bg-green-50 dark:bg-green-500/5 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20'
                                    : 'bg-red-50 dark:bg-red-500/5 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
                            }`}
                        >
                            <span>{importMsg.text}</span>
                            <button onClick={() => setImportMsg(null)} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 精选社区模板 */}
                <section className="mb-8">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-[var(--novo-text-muted)] uppercase tracking-wider">⭐ 精选社区模板</span>
                            <span className="text-[9px] text-gray-300 dark:text-[var(--novo-text-muted)]">{filteredFeatured.length} 个</span>
                        </div>
                        {filteredFeatured.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredFeatured.map((wf, i) => (
                                    <CommunityCard
                                        key={wf.id}
                                        workflow={wf}
                                        index={i}
                                        onImport={() => importToLocal(wf)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <Search className="w-8 h-8 text-gray-300 dark:text-[var(--novo-text-muted)] mb-3" />
                                <p className="text-sm text-gray-400 dark:text-[var(--novo-text-muted)]">该标签下无精选模板</p>
                            </div>
                        )}
                    </motion.div>
                </section>

                {/* 已导入的社区工作流 */}
                {filteredImported.length > 0 && (
                    <section className="mb-8">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-[10px] font-bold text-gray-400 dark:text-[var(--novo-text-muted)] uppercase tracking-wider">📦 已导入</span>
                                <span className="text-[9px] text-gray-300 dark:text-[var(--novo-text-muted)]">{filteredImported.length} 个</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredImported.map((wf, i) => (
                                    <CommunityCard
                                        key={wf.id}
                                        workflow={wf}
                                        index={i}
                                        onImport={() => importToLocal(wf)}
                                        onDelete={() => handleDelete(wf.id)}
                                        isImported
                                    />
                                ))}
                            </div>
                        </motion.div>
                    </section>
                )}
            </main>

            <BottomTabBar />
        </div>
        </WorkspaceShell>
    );
}
