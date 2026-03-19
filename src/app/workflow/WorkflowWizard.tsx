'use client';

/**
 * 引导式工作流创建向导
 *
 * 3 步完成一个自定义工作流：
 * Step 1: 选择基础模板（预设/空白）
 * Step 2: 增删节点 + 配置
 * Step 3: 确认保存
 */

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

const WorkflowEditor = dynamic(() => import('./WorkflowEditor'), {
    ssr: false,
    loading: () => <div style={{ padding: '40px', textAlign: 'center' }}>⏳ 加载编辑器...</div>,
});

interface WizardProps {
    onComplete: () => void;
    onCancel: () => void;
}

interface TemplateOption {
    id: string;
    name: string;
    icon: string;
    description: string;
    nodeCount: number;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
    { id: '', name: '空白画布', icon: '📄', description: '从零开始，完全自由', nodeCount: 0 },
    { id: 'novoscan-default', name: '完整管线', icon: '⚡', description: '七源双轨 10 节点完整管线', nodeCount: 10 },
    { id: 'quick-academic', name: '快速学术', icon: '📚', description: '学术聚焦 4 节点快速分析', nodeCount: 4 },
    { id: 'minimal', name: '最小管线', icon: '🚀', description: '3 节点快速出结果', nodeCount: 3 },
    { id: 'forced-debate', name: '强制辩论', icon: '⚖️', description: '强制触发辩论深度验证', nodeCount: 8 },
    { id: 'industry-focus', name: '产业重点', icon: '🏭', description: '聚焦商业化可行性', nodeCount: 5 },
];

export default function WorkflowWizard({ onComplete, onCancel }: WizardProps) {
    const [step, setStep] = useState(1);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [loadedWorkflow, setLoadedWorkflow] = useState<any>(null);
    const [workflowName, setWorkflowName] = useState('我的工作流');

    // Step 1: 选择模板
    const handleSelectTemplate = useCallback(async (templateId: string) => {
        setSelectedTemplate(templateId);
        if (templateId) {
            try {
                const { loadPreset } = await import('@/workflow/validator');
                const wf = loadPreset(templateId);
                setLoadedWorkflow(wf);
                setWorkflowName(wf?.name ? `${wf.name}（自定义）` : '我的工作流');
            } catch {
                setLoadedWorkflow(null);
            }
        } else {
            setLoadedWorkflow(null);
            setWorkflowName('我的工作流');
        }
        setStep(2);
    }, []);

    // Step 3: 保存完成
    const handleSave = useCallback(() => {
        setStep(3);
        setTimeout(() => onComplete(), 1500);
    }, [onComplete]);

    return (
        <div className="wiz-container">
            {/* 步骤指示器 */}
            <div className="wiz-steps">
                {[1, 2, 3].map(s => (
                    <div key={s} className={`wiz-step ${step >= s ? 'wiz-step-active' : ''} ${step === s ? 'wiz-step-current' : ''}`}>
                        <div className="wiz-step-dot">{step > s ? '✓' : s}</div>
                        <div className="wiz-step-label">
                            {s === 1 ? '选择模板' : s === 2 ? '编辑配置' : '保存完成'}
                        </div>
                    </div>
                ))}
                <div className="wiz-step-line" />
            </div>

            {/* Step 1: 选择模板 */}
            {step === 1 && (
                <div className="wiz-content">
                    <h2 className="wiz-title">Step 1 — 选择一个基础模板</h2>
                    <p className="wiz-desc">选择预设模板快速开始，或从空白画布自由创建</p>
                    <div className="wiz-template-grid">
                        {TEMPLATE_OPTIONS.map(tpl => (
                            <button
                                key={tpl.id}
                                className="wiz-template-card"
                                onClick={() => handleSelectTemplate(tpl.id)}
                            >
                                <span className="wiz-template-icon">{tpl.icon}</span>
                                <div className="wiz-template-name">{tpl.name}</div>
                                <div className="wiz-template-desc">{tpl.description}</div>
                                {tpl.nodeCount > 0 && (
                                    <div className="wiz-template-meta">🔗 {tpl.nodeCount} 节点</div>
                                )}
                            </button>
                        ))}
                    </div>
                    <button className="wiz-btn-cancel" onClick={onCancel}>取消</button>
                </div>
            )}

            {/* Step 2: 编辑器 */}
            {step === 2 && (
                <div className="wiz-editor-wrap">
                    <WorkflowEditor
                        initialWorkflow={loadedWorkflow}
                        onSave={handleSave}
                        onClose={() => setStep(1)}
                    />
                </div>
            )}

            {/* Step 3: 完成 */}
            {step === 3 && (
                <div className="wiz-content wiz-done">
                    <div className="wiz-done-icon">🎉</div>
                    <h2 className="wiz-title">工作流已保存！</h2>
                    <p className="wiz-desc">「{workflowName}」已添加到你的自定义工作流列表</p>
                </div>
            )}

            <style jsx>{`
                .wiz-container {
                    min-height: 100vh;
                    background: var(--novo-bg-surface);
                }

                .wiz-steps {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 2rem;
                    padding: 1.5rem 2rem;
                    background: var(--novo-bg-elevated);
                    border-bottom: 1px solid var(--novo-border-default);
                    position: relative;
                }

                .wiz-step {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    z-index: 1;
                }

                .wiz-step-dot {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    font-weight: 600;
                    background: var(--novo-bg-surface);
                    border: 2px solid var(--novo-border-default);
                    color: var(--novo-text-muted);
                    transition: all 0.3s;
                }

                .wiz-step-active .wiz-step-dot {
                    background: linear-gradient(135deg, var(--novo-brand-primary), var(--novo-brand-secondary));
                    border-color: transparent;
                    color: white;
                }

                .wiz-step-label {
                    font-size: 0.8rem;
                    color: var(--novo-text-muted);
                }

                .wiz-step-active .wiz-step-label {
                    color: var(--novo-text-primary);
                    font-weight: 500;
                }

                .wiz-step-line {
                    position: absolute;
                    top: 50%;
                    left: 25%;
                    right: 25%;
                    height: 2px;
                    background: var(--novo-border-default);
                    z-index: 0;
                }

                .wiz-content {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 2rem;
                }

                .wiz-title {
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: var(--novo-text-primary);
                    margin: 0 0 0.5rem;
                }

                .wiz-desc {
                    color: var(--novo-text-secondary);
                    font-size: 0.9rem;
                    margin-bottom: 1.5rem;
                }

                .wiz-template-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .wiz-template-card {
                    padding: 1.25rem;
                    border-radius: 10px;
                    border: 1px solid var(--novo-border-default);
                    background: var(--novo-bg-elevated);
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                }

                .wiz-template-card:hover {
                    border-color: var(--novo-brand-primary);
                    box-shadow: 0 4px 16px rgba(66, 133, 244, 0.08);
                    transform: translateY(-2px);
                }

                .wiz-template-icon {
                    font-size: 2rem;
                    display: block;
                    margin-bottom: 0.5rem;
                }

                .wiz-template-name {
                    font-weight: 600;
                    font-size: 0.9rem;
                    color: var(--novo-text-primary);
                    margin-bottom: 0.25rem;
                }

                .wiz-template-desc {
                    font-size: 0.75rem;
                    color: var(--novo-text-secondary);
                    margin-bottom: 0.5rem;
                }

                .wiz-template-meta {
                    font-size: 0.7rem;
                    color: var(--novo-text-muted);
                }

                .wiz-btn-cancel {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--novo-border-default);
                    border-radius: 6px;
                    background: var(--novo-bg-elevated);
                    color: var(--novo-text-secondary);
                    cursor: pointer;
                    font-size: 0.85rem;
                }

                .wiz-editor-wrap {
                    height: calc(100vh - 80px);
                }

                .wiz-done {
                    text-align: center;
                    padding-top: 4rem;
                }

                .wiz-done-icon {
                    font-size: 4rem;
                    margin-bottom: 1rem;
                    animation: wiz-bounce 0.5s ease;
                }

                @keyframes wiz-bounce {
                    0% { transform: scale(0); }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }

                @media (max-width: 600px) {
                    .wiz-template-grid { grid-template-columns: 1fr; }
                    .wiz-steps { gap: 1rem; }
                    .wiz-step-label { display: none; }
                }
            `}</style>
        </div>
    );
}
