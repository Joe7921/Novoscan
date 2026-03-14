import React from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles, Database, Globe, Bot } from 'lucide-react';
import PrivacyToggle from '@/components/ui/PrivacyToggle';
import AntigravityCard from '@/components/antigravity/AntigravityCard';
import AntigravityButton from '@/components/antigravity/AntigravityButton';
import { ModelProvider, MODEL_OPTIONS } from '@/types';

export type ClawscanMode = 'registry' | 'full';

interface SkillCheckFormProps {
    idea: string;
    setIdea: (val: string) => void;
    onSubmit: () => void;
    isPrivateMode: boolean;
    onPrivacyToggle: () => void;
    mode: ClawscanMode;
    onModeChange: (mode: ClawscanMode) => void;
    selectedModel: ModelProvider;
    setSelectedModel: (model: ModelProvider) => void;
}

const MODES = [
    {
        id: 'registry' as ClawscanMode,
        icon: Database,
        title: 'Skill 查新',
        subtitle: '快速 · 省资源',
        description: '仅检索 ClawHub Registry，AI 语义匹配',
        color: 'google-blue',
        agents: '2 Agent',
        speed: '~15s',
        cost: 4,
    },
    {
        id: 'full' as ClawscanMode,
        icon: Globe,
        title: '落地想法评估',
        subtitle: '深度 · 全网查重',
        description: 'Registry + 网络案例 + GitHub + 4 Agent 深度评估',
        color: 'google-green',
        agents: '4 Agent',
        speed: '~60s',
        cost: 10,
    },
];

export default function SkillCheckForm({ idea, setIdea, onSubmit, isPrivateMode, onPrivacyToggle, mode, onModeChange, selectedModel, setSelectedModel }: SkillCheckFormProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, type: 'spring', bounce: 0.4 }}
            className="w-full max-w-4xl mx-auto mt-2 sm:mt-4 md:mt-12 lg:mt-16 px-4 sm:px-6 relative z-10"
        >
            <div className="text-center mb-12">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-google-blue/10 border border-google-blue/20 text-google-blue text-sm font-bold mb-6 mx-auto"
                >
                    <Sparkles className="w-5 h-5" />
                    <span>Clawscan</span>
                </motion.div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-center uppercase leading-[1.1] text-gray-900 mb-6">
                    避免重复<span className="text-google-blue">造轮子</span>
                </h1>

                <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto font-medium tracking-tight px-2 sm:px-0">
                    选择查重模式，一键评估你的 OpenClaw 创新构想。
                </p>
            </div>

            {/* 模式选择器 */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 max-w-2xl mx-auto"
            >
                {MODES.map((m) => {
                    const isActive = mode === m.id;
                    const Icon = m.icon;
                    return (
                        <button
                            key={m.id}
                            onClick={() => onModeChange(m.id)}
                            className={`relative p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 text-left group
                                ${isActive
                                    ? `border-${m.color} bg-${m.color}/5 shadow-lg shadow-${m.color}/10`
                                    : 'border-gray-200 bg-white/95 hover:border-gray-300 hover:bg-white/80'}
                            `}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="mode-indicator"
                                    className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-${m.color}`}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                />
                            )}
                            <div className="flex items-center gap-2.5 mb-2">
                                <div className={`p-1.5 rounded-lg ${isActive ? `bg-${m.color}/10 text-${m.color}` : 'bg-gray-100 text-gray-400'} transition-colors`}>
                                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div>
                                    <div className={`font-black text-sm sm:text-base ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>{m.title}</div>
                                    <div className={`text-[10px] sm:text-xs font-bold ${isActive ? `text-${m.color}` : 'text-gray-400'}`}>{m.subtitle}</div>
                                </div>
                            </div>
                            <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed mb-2">{m.description}</p>
                            <div className="flex items-center gap-3 text-[10px] sm:text-[11px] font-mono">
                                <span className={`px-1.5 py-0.5 rounded ${isActive ? `bg-${m.color}/10 text-${m.color}` : 'bg-gray-100 text-gray-400'} font-bold`}>
                                    {m.agents}
                                </span>
                                <span className="text-gray-400">{m.speed}</span>
                                <span className={`px-1.5 py-0.5 rounded font-bold ${isActive ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                                    💰 {m.cost} 点
                                </span>
                            </div>
                        </button>
                    );
                })}
            </motion.div>

            <AntigravityCard
                glassmorphism={true}
                className="p-1 sm:p-2 !bg-white/95 hover:!bg-white/95 !border-white/60 !shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] ring-1 ring-white/40 relative z-20"
                hoverEffect={true}
            >
                <div className="relative w-full flex flex-col h-full bg-white/95 rounded-[1.75rem] md:rounded-[2.75rem] p-4 sm:p-6 md:p-8">
                    <textarea
                        value={idea}
                        onChange={(e) => setIdea(e.target.value)}
                        placeholder={mode === 'registry'
                            ? '描述你想开发的 Skill 功能：核心能力是什么？AI 会自动匹配 ClawHub 已有方案...'
                            : '描述你想开发的 OpenClaw 创新应用：它解决什么问题？面向谁？核心功能是什么？AI 会自动提取关键词并全面查重...'
                        }
                        className="w-full h-48 sm:h-64 bg-transparent border-none outline-none resize-none text-gray-800 text-lg sm:text-xl md:text-2xl placeholder-gray-400 font-medium leading-relaxed"
                        autoFocus
                    />

                    <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-gray-200/50">
                        {/* 模型选择器 */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                            <span className="text-xs text-gray-500 font-bold flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 flex-shrink-0">
                                <Bot className="w-4 h-4 text-gray-900" />
                                模型选择
                            </span>
                            <div className="flex bg-gray-100 p-1 rounded-[2rem] border border-gray-200 overflow-x-auto w-full sm:w-auto scrollbar-hide snap-x" style={{ WebkitOverflowScrolling: 'touch' }}>
                                {MODEL_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => setSelectedModel(option.id)}
                                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all duration-300 flex items-center gap-1.5 snap-center ${selectedModel === option.id
                                            ? 'text-gray-900 shadow-md bg-white/95 border border-white/60'
                                            : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                                            }`}
                                        title={option.description.zh}
                                    >
                                        <span className="flex items-center gap-1.5">
                                            {selectedModel === option.id && (
                                                <span className="w-2 h-2 rounded-full bg-google-blue" aria-hidden="true" />
                                            )}
                                            <span>{option.name}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 底部操作栏 */}
                        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-end gap-3">
                            <div className="flex items-center gap-3">
                                <div className="text-sm text-gray-400 font-medium">
                                    {idea.length} / 2000 字符
                                </div>
                                <PrivacyToggle isPrivate={isPrivateMode} onToggle={onPrivacyToggle} />
                            </div>
                            <AntigravityButton
                                onClick={onSubmit}
                                disabled={idea.trim().length === 0}
                                variant="primary"
                                size="lg"
                                icon={<Search className="w-5 h-5" />}
                                className="shadow-2xl shadow-google-blue/20 px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto"
                            >
                                {mode === 'registry' ? '快速查新' : '深度评估'}
                            </AntigravityButton>
                            <span className="text-[11px] font-bold text-gray-400 whitespace-nowrap flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                                💰 {mode === 'registry' ? '4' : '10'} 点
                            </span>
                        </div>
                    </div>
                </div>
            </AntigravityCard>
        </motion.div>
    );
}
