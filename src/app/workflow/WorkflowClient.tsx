'use client';

/**
 * 工作流管理中心 — 客户端交互组件
 *
 * 功能：
 * - 预设卡片展示（5 个内置预设）
 * - 一键切换当前工作流
 * - JSON 导入/导出
 * - 本地存储（localStorage）
 * - 可视化编辑器 + 引导式向导
 * - 版本历史管理
 * - 分享码生成
 *
 * UI 现代化：WorkspaceShell + Tailwind + CSS 变量 + 暗色模式
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Sparkles, Pencil, Globe, FileDown, FileUp,
    Play, Trash2, Clock, ChevronRight, X, Share2, History,
    Zap, CheckCircle, Loader2,
} from 'lucide-react';
import WorkspaceShell from '@/components/layout/WorkspaceShell';
import BottomTabBar from '@/components/layout/BottomTabBar';
import { validateWorkflow } from '@/workflow/validator';
import { useWorkflowVersions, type WorkflowVersion } from './useWorkflowVersions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WorkflowEditorInitial = any;

// 懒加载编辑器（@xyflow/react 较重，延迟加载）
const WorkflowEditor = dynamic(() => import('./WorkflowEditor'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-screen bg-white dark:bg-[var(--novo-bg-base)]">
            <Loader2 className="w-8 h-8 text-novo-blue dark:text-blue-400 animate-spin" />
        </div>
    ),
});

// 引导式创建向导
const WorkflowWizard = dynamic(() => import('./WorkflowWizard'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-screen bg-white dark:bg-[var(--novo-bg-base)]">
            <Loader2 className="w-8 h-8 text-novo-blue dark:text-blue-400 animate-spin" />
        </div>
    ),
});

interface PresetInfo {
    id: string;
    name: string;
    nameEn: string;
    description: string;
    descriptionEn: string;
    icon: string;
    nodeCount: number;
    estimatedDuration?: string;
}

interface WorkflowClientProps {
    presets: PresetInfo[];
}

/** localStorage key */
const ACTIVE_WORKFLOW_KEY = 'novoscan_active_workflow';
const CUSTOM_WORKFLOWS_KEY = 'novoscan_custom_workflows';

// ==================== 管线流程预览 ====================

const PIPELINE_FLOWS: Record<string, string> = {
    'novoscan-default': '📚学术 → 🏭产业 → 🔍竞品 → 🌐跨域  ⟹  💡创新  ⟹  ⚔️辩论?  ⟹  ⚖️仲裁  ⟹  🛡️质量',
    'quick-academic': '📚学术  ⟹  💡创新  ⟹  ⚖️仲裁  ⟹  🛡️质量',
    'minimal': '📚学术  ⟹  ⚖️仲裁  ⟹  🛡️质量',
    'forced-debate': '📚学术 → 🏭产业 → 🔍竞品  ⟹  💡创新  ⟹  ⚔️强制辩论  ⟹  ⚖️仲裁  ⟹  🛡️质量',
    'industry-focus': '🏭产业 → 🔍竞品  ⟹  ⚖️仲裁  ⟹  🛡️质量',
};

function PipelinePreview({ id }: { id: string }) {
    const flow = PIPELINE_FLOWS[id];
    if (!flow) return <div className="text-xs text-gray-400 dark:text-[var(--novo-text-muted)]">自定义管线（悬浮预览暂不支持）</div>;

    return (
        <div className="text-xs leading-relaxed">
            <div className="text-[10px] font-bold text-gray-500 dark:text-[var(--novo-text-secondary)] mb-1 uppercase tracking-wider">
                管线流程预览
            </div>
            <div className="text-gray-600 dark:text-[var(--novo-text-secondary)] font-mono text-[11px]">{flow}</div>
        </div>
    );
}

// ==================== 工作流卡片 ====================

interface CardProps {
    workflow: PresetInfo;
    index: number;
    isActive: boolean;
    onActivate: (id: string) => void;
    onExport: (id: string) => void;
    onEdit: (id?: string) => void;
    isExporting: boolean;
    onDelete?: (id: string) => void;
    isCustom?: boolean;
    onShowVersions?: (id: string) => void;
    onShare?: (id: string) => void;
}

function WorkflowCard({ workflow, index, isActive, onActivate, onExport, onEdit, isExporting, onDelete, isCustom, onShowVersions, onShare }: CardProps) {
    const [showPipeline, setShowPipeline] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
        >
            <div
                className={`group relative rounded-2xl border p-5 h-full transition-all duration-300 hover:-translate-y-0.5 ${
                    isActive
                        ? 'bg-gradient-to-br from-blue-50/80 via-purple-50/30 to-white dark:from-blue-500/5 dark:via-purple-500/3 dark:to-[var(--novo-bg-surface)] border-novo-blue/40 dark:border-blue-500/30 shadow-md dark:shadow-[0_0_25px_rgba(96,165,250,0.1)]'
                        : 'bg-white/95 dark:bg-[var(--novo-bg-surface)] border-gray-100/80 dark:border-[var(--novo-border-default)] hover:border-gray-300 dark:hover:border-[var(--novo-border-strong)] hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(96,165,250,0.06)]'
                }`}
                onMouseEnter={() => setShowPipeline(true)}
                onMouseLeave={() => setShowPipeline(false)}
            >
                {/* 悬浮光效 */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-cyan-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/3 group-hover:to-cyan-500/3 transition-all duration-500 pointer-events-none" />

                {/* 激活标记 */}
                {isActive && (
                    <div className="absolute -top-2.5 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-novo-blue to-purple-600 shadow-sm">
                        ✓ 使用中
                    </div>
                )}

                {/* 头部 */}
                <div className="relative flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 bg-gray-50 dark:bg-[var(--novo-bg-base)] rounded-xl flex items-center justify-center text-2xl border border-gray-200 dark:border-[var(--novo-border-default)] shrink-0 group-hover:border-novo-blue/30 dark:group-hover:border-blue-500/20 transition-colors">
                        {workflow.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-[var(--novo-text-primary)] truncate group-hover:text-novo-blue dark:group-hover:text-blue-300 transition-colors">
                            {workflow.name}
                        </h3>
                        <div className="text-[11px] text-gray-400 dark:text-[var(--novo-text-muted)] truncate">{workflow.nameEn}</div>
                    </div>
                </div>

                {/* 描述 */}
                <p className="relative text-xs text-gray-500 dark:text-[var(--novo-text-secondary)] leading-relaxed mb-3 line-clamp-2 min-h-[2.5rem]">
                    {workflow.description}
                </p>

                {/* 元数据标签 */}
                <div className="relative flex flex-wrap gap-1.5 mb-3">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[var(--novo-bg-elevated)] text-gray-500 dark:text-[var(--novo-text-muted)] border border-gray-200/50 dark:border-[var(--novo-border-default)]">
                        🔗 {workflow.nodeCount} 节点
                    </span>
                    {workflow.estimatedDuration && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[var(--novo-bg-elevated)] text-gray-500 dark:text-[var(--novo-text-muted)] border border-gray-200/50 dark:border-[var(--novo-border-default)]">
                            ⏱️ {workflow.estimatedDuration}
                        </span>
                    )}
                    {isCustom && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20">
                            🛠️ 自定义
                        </span>
                    )}
                </div>

                {/* 悬浮管线预览 */}
                <AnimatePresence>
                    {showPipeline && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="relative mb-3 overflow-hidden"
                        >
                            <div className="p-3 rounded-xl bg-gray-50 dark:bg-[var(--novo-bg-base)] border border-gray-100 dark:border-[var(--novo-border-default)]">
                                <PipelinePreview id={workflow.id} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 操作按钮 */}
                <div className="relative flex items-center gap-1.5 pt-3 border-t border-gray-100 dark:border-[var(--novo-border-default)]">
                    {!isActive ? (
                        <button
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-novo-blue to-purple-600 hover:from-blue-500 hover:to-purple-500 transition-all active:scale-95"
                            onClick={() => onActivate(workflow.id)}
                        >
                            <Play className="w-3 h-3" />
                            使用此模板
                        </button>
                    ) : (
                        <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-novo-blue dark:text-blue-400 bg-novo-blue/10 dark:bg-blue-500/10 border border-novo-blue/20 dark:border-blue-500/20 cursor-default" disabled>
                            <CheckCircle className="w-3 h-3" />
                            当前使用中
                        </button>
                    )}
                    <button
                        className="p-1.5 rounded-lg text-gray-400 dark:text-[var(--novo-text-muted)] hover:bg-gray-100 dark:hover:bg-[var(--novo-bg-elevated)] hover:text-gray-600 dark:hover:text-[var(--novo-text-secondary)] transition-colors"
                        onClick={() => onExport(workflow.id)}
                        disabled={isExporting}
                        title="导出 JSON"
                    >
                        {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        className="p-1.5 rounded-lg text-gray-400 dark:text-[var(--novo-text-muted)] hover:bg-gray-100 dark:hover:bg-[var(--novo-bg-elevated)] hover:text-gray-600 dark:hover:text-[var(--novo-text-secondary)] transition-colors"
                        onClick={() => onEdit(workflow.id)}
                        title="可视化编辑"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {isCustom && onDelete && (
                        <button
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-colors"
                            onClick={() => {
                                if (confirm(`确定删除 "${workflow.name}" 吗？`)) {
                                    onDelete(workflow.id);
                                }
                            }}
                            title="删除"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {onShowVersions && (
                        <button
                            className="p-1.5 rounded-lg text-gray-400 dark:text-[var(--novo-text-muted)] hover:bg-gray-100 dark:hover:bg-[var(--novo-bg-elevated)] hover:text-gray-600 dark:hover:text-[var(--novo-text-secondary)] transition-colors"
                            onClick={() => onShowVersions(workflow.id)}
                            title="版本历史"
                        >
                            <History className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {onShare && (
                        <button
                            className="p-1.5 rounded-lg text-gray-400 dark:text-[var(--novo-text-muted)] hover:bg-gray-100 dark:hover:bg-[var(--novo-bg-elevated)] hover:text-gray-600 dark:hover:text-[var(--novo-text-secondary)] transition-colors"
                            onClick={() => onShare(workflow.id)}
                            title="分享到社区"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

// ==================== 版本历史面板 ====================

interface VersionHistoryPanelProps {
    workflowId: string;
    workflowName: string;
    onClose: () => void;
    onRollback: (snapshot: Record<string, unknown>) => void;
}

function VersionHistoryPanel({ workflowId, workflowName, onClose, onRollback }: VersionHistoryPanelProps) {
    const { versions, rollback, deleteVersion, clearAll } = useWorkflowVersions(workflowId);

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        return `${month}/${day} ${h}:${m}`;
    };

    const handleRollback = (version: number) => {
        const snapshot = rollback(version);
        if (snapshot) {
            onRollback(snapshot);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white dark:bg-[var(--novo-bg-surface)] rounded-2xl w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col shadow-2xl dark:shadow-[0_25px_50px_rgba(0,0,0,0.4)] border border-gray-200 dark:border-[var(--novo-border-default)] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* 面板头部 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[var(--novo-border-default)]">
                    <div>
                        <div className="text-sm font-bold text-gray-900 dark:text-[var(--novo-text-primary)] flex items-center gap-2">
                            <History className="w-4 h-4 text-novo-blue dark:text-blue-400" />
                            版本历史
                        </div>
                        <div className="text-[11px] text-gray-400 dark:text-[var(--novo-text-muted)] mt-0.5">{workflowName}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        {versions.length > 0 && (
                            <button
                                className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                onClick={() => {
                                    if (confirm('确定清空所有版本历史吗？')) clearAll();
                                }}
                            >
                                🗑️ 清空全部
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-[var(--novo-bg-elevated)] hover:text-gray-600 dark:hover:text-[var(--novo-text-secondary)] transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 版本列表 */}
                <div className="flex-1 overflow-y-auto p-3">
                    {versions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="text-3xl mb-3">📦</div>
                            <p className="text-sm font-bold text-gray-500 dark:text-[var(--novo-text-muted)] mb-1">暂无版本记录</p>
                            <p className="text-[11px] text-gray-400 dark:text-[var(--novo-text-muted)]">在编辑器中保存工作流后自动创建</p>
                        </div>
                    ) : (
                        versions.map((v: WorkflowVersion) => (
                            <div key={v.version} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-[var(--novo-border-default)] mb-2 hover:bg-gray-50 dark:hover:bg-[var(--novo-bg-elevated)] transition-colors">
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-gray-700 dark:text-[var(--novo-text-primary)] truncate">{v.description}</div>
                                    <div className="text-[10px] text-gray-400 dark:text-[var(--novo-text-muted)] mt-0.5">
                                        {formatTime(v.timestamp)} · {v.nodeCount} 个节点
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 ml-3">
                                    <button
                                        className="text-[10px] font-bold px-2.5 py-1 rounded-lg text-novo-blue dark:text-blue-400 border border-novo-blue/20 dark:border-blue-500/20 hover:bg-novo-blue/5 dark:hover:bg-blue-500/10 transition-colors"
                                        onClick={() => handleRollback(v.version)}
                                    >
                                        ⬅️ 回退
                                    </button>
                                    <button
                                        className="p-1 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                        onClick={() => deleteVersion(v.version)}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </motion.div>
        </div>
    );
}

// ==================== 主页面组件 ====================

export default function WorkflowClient({ presets }: WorkflowClientProps) {
    const [activeId, setActiveId] = useState<string>('novoscan-default');
    const [customWorkflows, setCustomWorkflows] = useState<PresetInfo[]>([]);
    const [importError, setImportError] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState<string | null>(null);
    const [exportingId, setExportingId] = useState<string | null>(null);
    const [shareCode, setShareCode] = useState<string | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [wizardOpen, setWizardOpen] = useState(false);
    const [editorWorkflow, setEditorWorkflow] = useState<WorkflowEditorInitial>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [versionPanelId, setVersionPanelId] = useState<string | null>(null);

    // 加载上次选择的工作流
    useEffect(() => {
        const stored = localStorage.getItem(ACTIVE_WORKFLOW_KEY);
        if (stored) setActiveId(stored);

        const customs = localStorage.getItem(CUSTOM_WORKFLOWS_KEY);
        if (customs) {
            try {
                setCustomWorkflows(JSON.parse(customs));
            } catch { /* ignore */ }
        }
    }, []);

    // 切换工作流
    const handleActivate = useCallback((id: string) => {
        setActiveId(id);
        localStorage.setItem(ACTIVE_WORKFLOW_KEY, id);
    }, []);

    // 导出 JSON
    const handleExport = useCallback(async (id: string) => {
        setExportingId(id);
        try {
            const { loadPreset } = await import('@/workflow/validator');
            const workflow = loadPreset(id);
            if (!workflow) {
                alert('无法加载该工作流');
                return;
            }
            const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `workflow-${id}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setExportingId(null);
        }
    }, []);

    // 导入 JSON
    const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportError(null);
        setImportSuccess(null);

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const json = JSON.parse(reader.result as string);
                const result = validateWorkflow(json);
                if (!result.valid) {
                    setImportError(`校验失败：${result.errors.join('；')}`);
                    return;
                }
                const info: PresetInfo = {
                    id: json.id || `custom-${Date.now()}`,
                    name: json.name || '自定义工作流',
                    nameEn: json.nameEn || 'Custom Workflow',
                    description: json.description || '',
                    descriptionEn: json.descriptionEn || '',
                    icon: json.icon || '📋',
                    nodeCount: json.nodes?.length || 0,
                    estimatedDuration: json.config?.estimatedDuration,
                };
                const updated = [...customWorkflows.filter(c => c.id !== info.id), info];
                setCustomWorkflows(updated);
                localStorage.setItem(CUSTOM_WORKFLOWS_KEY, JSON.stringify(updated));
                localStorage.setItem(`novoscan_wf_${info.id}`, JSON.stringify(json));
                setImportSuccess(`已导入: ${info.name}`);
                if (result.warnings.length > 0) {
                    setImportSuccess(`已导入: ${info.name}（警告: ${result.warnings.join('；')}）`);
                }
            } catch (err) {
                setImportError(`解析失败：${err instanceof Error ? err.message : '无效的 JSON 文件'}`);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }, [customWorkflows]);

    // 删除自定义工作流
    const handleDeleteCustom = useCallback((id: string) => {
        const updated = customWorkflows.filter(c => c.id !== id);
        setCustomWorkflows(updated);
        localStorage.setItem(CUSTOM_WORKFLOWS_KEY, JSON.stringify(updated));
        localStorage.removeItem(`novoscan_wf_${id}`);
        if (activeId === id) {
            setActiveId('novoscan-default');
            localStorage.setItem(ACTIVE_WORKFLOW_KEY, 'novoscan-default');
        }
    }, [customWorkflows, activeId]);

    const allWorkflows = [...presets, ...customWorkflows];

    // 打开编辑器
    const openEditor = useCallback(async (presetId?: string) => {
        if (presetId) {
            try {
                const { loadPreset } = await import('@/workflow/validator');
                const wf = loadPreset(presetId);
                setEditorWorkflow(wf);
            } catch {
                setEditorWorkflow(null);
            }
        } else {
            setEditorWorkflow(null);
        }
        setEditorOpen(true);
    }, []);

    // 编辑器保存回调
    const handleEditorSave = useCallback(() => {
        const customs = JSON.parse(localStorage.getItem(CUSTOM_WORKFLOWS_KEY) || '[]');
        setCustomWorkflows(customs);
    }, []);

    // 分享工作流
    const handleShare = useCallback(async (id: string) => {
        try {
            let wfJson: Record<string, unknown> | null = null;
            const stored = localStorage.getItem(`novoscan_wf_${id}`);
            if (stored) {
                wfJson = JSON.parse(stored);
            } else {
                const { loadPreset } = await import('@/workflow/validator');
                const preset = loadPreset(id);
                if (preset) wfJson = preset as unknown as Record<string, unknown>;
            }
            if (!wfJson) {
                alert('无法加载该工作流');
                return;
            }

            const shareData = {
                ...wfJson,
                meta: {
                    ...(wfJson.meta as Record<string, unknown> || {}),
                    sharedBy: (wfJson as Record<string, unknown>).author || 'Anonymous',
                    sharedAt: Date.now(),
                    tags: ['community'],
                    communityId: btoa(`${id}-${Date.now()}`).slice(0, 12),
                },
            };

            const code = btoa(unescape(encodeURIComponent(JSON.stringify(shareData))));
            setShareCode(code);

            try {
                await navigator.clipboard.writeText(code);
                setImportSuccess('✅ 分享码已复制到剪贴板！可发送给其他用户在社区市场导入');
                setTimeout(() => setImportSuccess(null), 5000);
            } catch {
                // 剪贴板失败，显示分享码弹窗
            }
        } catch (err) {
            alert(`分享失败：${err instanceof Error ? err.message : '未知错误'}`);
        }
    }, []);

    // 如果向导打开，渲染向导
    if (wizardOpen) {
        return (
            <WorkflowWizard
                onComplete={() => {
                    setWizardOpen(false);
                    const customs = JSON.parse(localStorage.getItem(CUSTOM_WORKFLOWS_KEY) || '[]');
                    setCustomWorkflows(customs);
                }}
                onCancel={() => setWizardOpen(false)}
            />
        );
    }

    // 如果编辑器打开，只渲染编辑器
    if (editorOpen) {
        return (
            <WorkflowEditor
                initialWorkflow={editorWorkflow}
                onSave={handleEditorSave}
                onClose={() => setEditorOpen(false)}
            />
        );
    }

    return (
        <WorkspaceShell>
        <div className="min-h-screen bg-white dark:bg-[var(--novo-bg-base)] text-gray-900 dark:text-[var(--novo-text-primary)] flex flex-col" style={{ overflowX: 'clip' }}>
            {/* 背景装饰 — 仅暗色模式 */}
            <div className="fixed inset-0 pointer-events-none z-0 hidden dark:block">
                <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[150px]" />
                <div className="absolute bottom-1/4 right-1/3 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[150px]" />
            </div>

            <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 lg:pb-8">
                {/* 顶部导航 + 标题 */}
                <div className="mb-6">
                    <Link href="/" className="inline-flex items-center gap-2 text-gray-400 dark:text-[var(--novo-text-muted)] hover:text-novo-blue dark:hover:text-blue-400 font-bold text-sm transition-colors mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        返回首页
                    </Link>
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 bg-novo-blue/10 dark:bg-blue-500/15 rounded-xl flex items-center justify-center border border-novo-blue/20 dark:border-blue-500/20">
                                <Zap className="w-4.5 h-4.5 text-novo-blue dark:text-blue-400" />
                            </div>
                            <span className="text-[10px] font-bold text-novo-blue dark:text-blue-400 uppercase tracking-[0.2em]">Workflow Manager</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white mb-1">
                            ⚡ 工作流管理中心
                        </h1>
                        <p className="text-sm text-gray-400 dark:text-[var(--novo-text-secondary)] max-w-xl">
                            选择预设管线，或导入自定义工作流，让分析完全按你的需求运行。
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
                    {/* 当前激活标识 */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[var(--novo-bg-surface)] border border-gray-200 dark:border-[var(--novo-border-default)]">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-xs text-gray-500 dark:text-[var(--novo-text-secondary)]">
                            当前使用：<strong className="text-gray-900 dark:text-[var(--novo-text-primary)]">{allWorkflows.find(w => w.id === activeId)?.name || activeId}</strong>
                        </span>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2">
                        <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-600 hover:bg-green-500 transition-all active:scale-95"
                            onClick={() => setWizardOpen(true)}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            引导创建
                        </button>
                        <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-novo-blue to-purple-600 hover:from-blue-500 hover:to-purple-500 transition-all active:scale-95"
                            onClick={() => openEditor()}
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            新建工作流
                        </button>
                        <Link
                            href="/community"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-50 dark:bg-[var(--novo-bg-surface)] text-gray-500 dark:text-[var(--novo-text-muted)] border border-gray-200 dark:border-[var(--novo-border-default)] hover:border-gray-300 dark:hover:border-[var(--novo-border-strong)] transition-all"
                        >
                            <Globe className="w-3.5 h-3.5" />
                            社区市场
                        </Link>
                        <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-50 dark:bg-[var(--novo-bg-surface)] text-gray-500 dark:text-[var(--novo-text-muted)] border border-gray-200 dark:border-[var(--novo-border-default)] hover:border-gray-300 dark:hover:border-[var(--novo-border-strong)] transition-all"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <FileUp className="w-3.5 h-3.5" />
                            导入 JSON
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={handleImport}
                        />
                    </div>
                </motion.div>

                {/* Toast 提示 */}
                <AnimatePresence>
                    {importError && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-5 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold border bg-red-50 dark:bg-red-500/5 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20"
                        >
                            <span>❌ {importError}</span>
                            <button onClick={() => setImportError(null)} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </motion.div>
                    )}
                    {importSuccess && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-5 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold border bg-green-50 dark:bg-green-500/5 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20"
                        >
                            <span>{importSuccess}</span>
                            <button onClick={() => setImportSuccess(null)} className="ml-2 opacity-50 hover:opacity-100 transition-opacity">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 分享码弹窗 */}
                <AnimatePresence>
                    {shareCode && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-5 overflow-hidden"
                        >
                            <div className="bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/20 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-green-600 dark:text-green-400">🔗 分享码已生成</span>
                                    <button onClick={() => setShareCode(null)} className="text-green-400 hover:text-green-600 transition-colors">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <textarea
                                    readOnly
                                    value={shareCode}
                                    className="w-full h-14 font-mono text-[10px] border border-green-200 dark:border-green-500/20 rounded-lg p-2 resize-none bg-white dark:bg-[var(--novo-bg-base)] text-gray-600 dark:text-[var(--novo-text-secondary)] focus:outline-none"
                                    onClick={e => (e.target as HTMLTextAreaElement).select()}
                                />
                                <p className="text-[10px] text-gray-400 dark:text-[var(--novo-text-muted)] mt-1.5">
                                    将此分享码发送给其他用户，对方可在「🌐 社区市场」中通过「🔗 分享码导入」使用
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* 内置预设 */}
                <section className="mb-8">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-[var(--novo-text-muted)] uppercase tracking-wider">📋 内置预设</span>
                            <span className="text-[9px] text-gray-300 dark:text-[var(--novo-text-muted)]">{presets.length} 个</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {presets.map((preset, i) => (
                                <WorkflowCard
                                    key={preset.id}
                                    workflow={preset}
                                    index={i}
                                    isActive={activeId === preset.id}
                                    onActivate={handleActivate}
                                    onExport={handleExport}
                                    onEdit={openEditor}
                                    isExporting={exportingId === preset.id}
                                    onShowVersions={setVersionPanelId}
                                    onShare={handleShare}
                                />
                            ))}
                        </div>
                    </motion.div>
                </section>

                {/* 自定义工作流 */}
                {customWorkflows.length > 0 && (
                    <section className="mb-8">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-[10px] font-bold text-gray-400 dark:text-[var(--novo-text-muted)] uppercase tracking-wider">🛠️ 自定义工作流</span>
                                <span className="text-[9px] text-gray-300 dark:text-[var(--novo-text-muted)]">{customWorkflows.length} 个</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {customWorkflows.map((wf, i) => (
                                    <WorkflowCard
                                        key={wf.id}
                                        workflow={wf}
                                        index={i}
                                        isActive={activeId === wf.id}
                                        onActivate={handleActivate}
                                        onExport={handleExport}
                                        onEdit={openEditor}
                                        isExporting={exportingId === wf.id}
                                        onDelete={handleDeleteCustom}
                                        onShowVersions={setVersionPanelId}
                                        onShare={handleShare}
                                        isCustom
                                    />
                                ))}
                            </div>
                        </motion.div>
                    </section>
                )}

                {/* 版本历史面板 */}
                <AnimatePresence>
                    {versionPanelId && (
                        <VersionHistoryPanel
                            workflowId={versionPanelId}
                            workflowName={allWorkflows.find(w => w.id === versionPanelId)?.name || versionPanelId}
                            onClose={() => setVersionPanelId(null)}
                            onRollback={(snapshot) => {
                                localStorage.setItem(`novoscan_wf_${versionPanelId}`, JSON.stringify(snapshot));
                                setEditorWorkflow(snapshot as WorkflowEditorInitial);
                                setVersionPanelId(null);
                                setEditorOpen(true);
                            }}
                        />
                    )}
                </AnimatePresence>
            </main>

            <BottomTabBar />
        </div>
        </WorkspaceShell>
    );
}
