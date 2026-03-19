/**
 * PromptABPanel — Prompt A/B 对比面板
 *
 * 同一节点挂两个 Prompt，并排对比渲染结果。
 * 支持实时编辑和预览。
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { renderPreview } from '@/workflow/prompt-template';

interface PromptABPanelProps {
    /** 当前 Prompt 内容（版本 A） */
    promptA: string;
    /** Agent ID（用于默认模板加载） */
    agentId?: string;
    /** 节点名称 */
    nodeName?: string;
    /** 选中版本后回调 */
    onSelect?: (prompt: string, version: 'A' | 'B') => void;
    /** 关闭面板 */
    onClose?: () => void;
}

export default function PromptABPanel({
    promptA: initialPromptA,
    agentId,
    nodeName,
    onSelect,
    onClose,
}: PromptABPanelProps) {
    const [promptA, setPromptA] = useState(initialPromptA);
    const [promptB, setPromptB] = useState('');
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

    // 自动加载默认模板作为 B 版本（如果 A 已有内容）
    const loadDefaultAsB = useCallback(async () => {
        if (!agentId) return;
        const { getDefaultPrompt } = await import('@/workflow/prompt-template');
        const tpl = getDefaultPrompt(agentId);
        if (tpl) {
            setPromptB(tpl.content);
        }
    }, [agentId]);

    // 实时预览渲染
    const previewA = useMemo(() => {
        if (!promptA.trim()) return null;
        return renderPreview(promptA);
    }, [promptA]);

    const previewB = useMemo(() => {
        if (!promptB.trim()) return null;
        return renderPreview(promptB);
    }, [promptB]);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <div style={{
                background: 'white',
                borderRadius: '16px',
                width: '90vw',
                maxWidth: '1200px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
                overflow: 'hidden',
            }}>
                {/* 头部 */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #E5E7EB',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                            🔬 Prompt A/B 对比测试
                        </div>
                        {nodeName && (
                            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '2px' }}>
                                节点：{nodeName}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* 编辑/预览切换 */}
                        <div style={{
                            display: 'flex',
                            background: '#F3F4F6',
                            borderRadius: '8px',
                            padding: '2px',
                        }}>
                            {(['edit', 'preview'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    style={{
                                        padding: '4px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: activeTab === tab ? 'white' : 'transparent',
                                        boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                        fontSize: '0.75rem',
                                        fontWeight: activeTab === tab ? 600 : 400,
                                        cursor: 'pointer',
                                        color: activeTab === tab ? '#1F2937' : '#6B7280',
                                    }}
                                >
                                    {tab === 'edit' ? '✏️ 编辑' : '👁️ 预览'}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '1.2rem',
                                cursor: 'pointer',
                                color: '#6B7280',
                                padding: '4px 8px',
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* A/B 对比主体 */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0',
                    flex: 1,
                    overflow: 'hidden',
                }}>
                    {/* 版本 A */}
                    <div style={{ borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column' }}>
                        <div style={{
                            padding: '10px 16px',
                            background: '#EFF6FF',
                            borderBottom: '1px solid #E5E7EB',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1E40AF' }}>
                                🅰️ 版本 A {promptA.trim() ? '' : '（空）'}
                            </span>
                            {onSelect && (
                                <button
                                    onClick={() => onSelect(promptA, 'A')}
                                    style={{
                                        fontSize: '0.65rem',
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid #3B82F6',
                                        background: '#3B82F6',
                                        color: 'white',
                                        cursor: 'pointer',
                                    }}
                                >
                                    ✓ 使用此版
                                </button>
                            )}
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                            {activeTab === 'edit' ? (
                                <textarea
                                    value={promptA}
                                    onChange={e => setPromptA(e.target.value)}
                                    placeholder="编辑版本 A 的 Prompt..."
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        minHeight: '200px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '8px',
                                        padding: '10px',
                                        fontFamily: 'monospace',
                                        fontSize: '0.75rem',
                                        lineHeight: 1.6,
                                        resize: 'none',
                                        outline: 'none',
                                    }}
                                />
                            ) : (
                                <div style={{
                                    background: '#F9FAFB',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '0.75rem',
                                    lineHeight: 1.6,
                                    whiteSpace: 'pre-wrap',
                                    fontFamily: 'monospace',
                                    minHeight: '200px',
                                }}>
                                    {previewA ? (
                                        <>
                                            <div style={{ marginBottom: '4px', fontSize: '0.65rem', color: previewA.valid ? '#22C55E' : '#F59E0B' }}>
                                                {previewA.valid ? '✅ 所有变量已匹配' : `⚠️ ${previewA.warnings.join('；')}`}
                                            </div>
                                            {previewA.rendered}
                                        </>
                                    ) : (
                                        <span style={{ color: '#9CA3AF' }}>暂无内容</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 版本 B */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{
                            padding: '10px 16px',
                            background: '#FEF3C7',
                            borderBottom: '1px solid #E5E7EB',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#92400E' }}>
                                🅱️ 版本 B {promptB.trim() ? '' : '（空）'}
                            </span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    onClick={loadDefaultAsB}
                                    style={{
                                        fontSize: '0.65rem',
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid #D1D5DB',
                                        background: 'white',
                                        color: '#6B7280',
                                        cursor: 'pointer',
                                    }}
                                >
                                    📋 加载默认
                                </button>
                                {onSelect && (
                                    <button
                                        onClick={() => onSelect(promptB, 'B')}
                                        style={{
                                            fontSize: '0.65rem',
                                            padding: '3px 8px',
                                            borderRadius: '4px',
                                            border: '1px solid #F59E0B',
                                            background: '#F59E0B',
                                            color: 'white',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        ✓ 使用此版
                                    </button>
                                )}
                            </div>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                            {activeTab === 'edit' ? (
                                <textarea
                                    value={promptB}
                                    onChange={e => setPromptB(e.target.value)}
                                    placeholder="编辑版本 B 的 Prompt（可加载默认模板作为对比基准）..."
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        minHeight: '200px',
                                        border: '1px solid #E5E7EB',
                                        borderRadius: '8px',
                                        padding: '10px',
                                        fontFamily: 'monospace',
                                        fontSize: '0.75rem',
                                        lineHeight: 1.6,
                                        resize: 'none',
                                        outline: 'none',
                                    }}
                                />
                            ) : (
                                <div style={{
                                    background: '#FFFBEB',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '0.75rem',
                                    lineHeight: 1.6,
                                    whiteSpace: 'pre-wrap',
                                    fontFamily: 'monospace',
                                    minHeight: '200px',
                                }}>
                                    {previewB ? (
                                        <>
                                            <div style={{ marginBottom: '4px', fontSize: '0.65rem', color: previewB.valid ? '#22C55E' : '#F59E0B' }}>
                                                {previewB.valid ? '✅ 所有变量已匹配' : `⚠️ ${previewB.warnings.join('；')}`}
                                            </div>
                                            {previewB.rendered}
                                        </>
                                    ) : (
                                        <span style={{ color: '#9CA3AF' }}>暂无内容，点击「加载默认」开始对比</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 底部提示 */}
                <div style={{
                    padding: '10px 16px',
                    borderTop: '1px solid #E5E7EB',
                    fontSize: '0.65rem',
                    color: '#9CA3AF',
                    display: 'flex',
                    justifyContent: 'space-between',
                }}>
                    <span>预览使用 Mock 数据渲染，可用变量：{'{{query}} {{language}} {{domainHint}} {{academicData}} ...'}</span>
                    <span>选中版本后将应用到节点配置</span>
                </div>
            </div>
        </div>
    );
}
