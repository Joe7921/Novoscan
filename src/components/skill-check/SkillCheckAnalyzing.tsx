import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Database, Fingerprint, Activity, Terminal } from 'lucide-react';

/* ────────────────────────────── 类型定义 ────────────────────────────── */

interface SkillCheckAnalyzingProps {
    idea: string;
    isDataReady: boolean;
    onComplete: () => void;
    // SSE 实时数据
    sseProgress?: number;
    sseLogs?: string[];
    ssePhase?: string;
    sseMessage?: string;
}

/* ────────────────────────────── 阶段配置 ────────────────────────────── */

const STEPS = [
    {
        id: 'parse',
        icon: Cpu,
        title: '想法解析与特征提取',
        color: '#4285F4',
        phase: 'parsing',
    },
    {
        id: 'search',
        icon: Database,
        title: '多源数据深度采集',
        color: '#FBBC05',
        phase: 'gathering',
    },
    {
        id: 'evaluate',
        icon: Fingerprint,
        title: '4-Agent 多维评估',
        color: '#34A853',
        phase: 'evaluating',
    },
];

/* ────────────────────────────── 主组件 ────────────────────────────── */

export default function SkillCheckAnalyzing({
    idea, isDataReady, onComplete,
    sseProgress = 0, sseLogs = [], ssePhase = '', sseMessage = '',
}: SkillCheckAnalyzingProps) {
    const logsEndRef = useRef<HTMLDivElement>(null);

    // 根据 SSE phase 确定当前步骤
    const currentStep = ssePhase === 'parsing' ? 0 : ssePhase === 'gathering' ? 1 : ssePhase === 'evaluating' ? 2 : (sseProgress >= 100 ? 2 : 0);
    const activeColor = STEPS[currentStep]?.color || STEPS[0].color;

    // 自动滚动日志到底部
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [sseLogs]);

    // 格式化日志项
    const formattedLogs = sseLogs.map((log) => {
        let tag = 'SYSTEM';
        let type: 'system' | 'info' | 'success' = 'info';
        if (log.startsWith('[系统]')) { tag = 'SYSTEM'; type = 'system'; }
        else if (log.startsWith('[编排器]')) { tag = 'ORCH'; type = 'info'; }
        else if (log.startsWith('[Registry')) { tag = 'SCOUT'; type = 'info'; }
        else if (log.startsWith('[实战')) { tag = 'CASE'; type = 'info'; }
        else if (log.startsWith('[创新')) { tag = 'NOVELTY'; type = 'info'; }
        else if (log.startsWith('[战略')) { tag = 'ARBITER'; type = 'info'; }
        else if (log.startsWith('[错误]')) { tag = 'ERROR'; type = 'system'; }
        else if (log.includes('完成')) { type = 'success'; }
        return { tag, text: log.replace(/^\[.*?\]\s*/, ''), type };
    });

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] px-4 font-sans text-gray-800 relative z-20">

            {/* 顶部：雷达扫描动画 */}
            <div className="relative w-40 h-40 mb-6 flex items-center justify-center">
                <motion.div
                    animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full"
                    style={{ border: `1px solid ${activeColor}30` }}
                />
                <motion.div
                    animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                    transition={{ duration: 2, delay: 0.7, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full"
                    style={{ border: `1px solid ${activeColor}20` }}
                />
                <motion.div
                    className="absolute inset-0 rounded-full overflow-hidden"
                    style={{ background: `conic-gradient(from 0deg, transparent 70%, ${activeColor}66 100%)` }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                >
                    <div className="w-full h-full bg-transparent border-4 border-white/50 rounded-full" />
                </motion.div>
                <div
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center relative z-10 border"
                    style={{ boxShadow: `0 0 30px ${activeColor}30`, borderColor: `${activeColor}20` }}
                >
                    <motion.div
                        animate={{ scale: [0.9, 1.1, 0.9] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Activity className="w-8 h-8 animate-pulse" style={{ color: activeColor }} />
                    </motion.div>
                </div>
            </div>

            {/* 当前进度信息 */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm text-gray-500 font-medium mb-5 text-center max-w-lg"
            >
                {sseMessage || '初始化 Clawscan 引擎...'}
            </motion.p>

            {/* 步骤管道 — 紧凑水平布局 */}
            <div className="flex items-center gap-2 mb-6">
                {STEPS.map((step, index) => {
                    const isActive = index === currentStep;
                    const isCompleted = index < currentStep;
                    return (
                        <React.Fragment key={step.id}>
                            <motion.div
                                animate={{
                                    backgroundColor: isActive ? `${step.color}20` : isCompleted ? '#10b98120' : 'transparent',
                                    scale: isActive ? 1.05 : 1,
                                }}
                                transition={{ duration: 0.3 }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                                style={{
                                    border: `1px solid ${isActive ? step.color + '40' : isCompleted ? '#10b98140' : '#e5e7eb'}`,
                                }}
                            >
                                <step.icon
                                    className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`}
                                    style={{ color: isActive ? step.color : isCompleted ? '#10b981' : '#9ca3af' }}
                                />
                                <span
                                    className="text-[11px] font-bold font-mono hidden sm:inline"
                                    style={{ color: isActive ? step.color : isCompleted ? '#10b981' : '#9ca3af' }}
                                >
                                    {step.title}
                                </span>
                            </motion.div>
                            {index < STEPS.length - 1 && (
                                <div className="w-6 h-px" style={{ backgroundColor: isCompleted ? '#10b981' : '#e5e7eb' }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* 实时日志面板 — macOS 终端风格 */}
            <div
                className="w-full max-w-2xl rounded-xl overflow-hidden"
                style={{
                    background: '#ffffff',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    border: '1px solid #e5e7eb',
                }}
            >
                {/* 终端头部 */}
                <div
                    className="flex items-center justify-between px-4 py-2"
                    style={{
                        background: 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)',
                        borderBottom: '1px solid #e5e7eb',
                    }}
                >
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1.5 mr-1">
                            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: sseProgress >= 100 ? '#34d058' : '#ff6b6b' }} />
                            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#f9c74f' }} />
                            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#52c41a' }} />
                        </div>
                        <div className="p-1 rounded-md" style={{ backgroundColor: `${activeColor}15` }}>
                            <Activity className="w-3.5 h-3.5" style={{ color: activeColor }} />
                        </div>
                        <span className="text-sm text-gray-700 font-bold font-mono">Clawscan 实时分析</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full rounded-full"
                                style={{ background: `linear-gradient(90deg, ${activeColor}80, ${activeColor})` }}
                                animate={{ width: `${sseProgress}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono tabular-nums font-bold">{sseProgress}%</span>
                    </div>
                </div>

                {/* 日志内容区 */}
                <div
                    className="p-4 h-48 overflow-y-auto font-mono text-xs md:text-[13px] space-y-1"
                    style={{ scrollbarWidth: 'thin' }}
                >
                    {formattedLogs.length === 0 && (
                        <div className="text-gray-400 animate-pulse flex items-start gap-2">
                            <span style={{ color: activeColor }}>$</span>
                            <span>Clawscan 4-Agent Engine v2.0 — Initializing...</span>
                        </div>
                    )}
                    <AnimatePresence initial={false}>
                        {formattedLogs.map((log, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-start gap-2 leading-relaxed"
                            >
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${log.type === 'system' ? 'bg-blue-50 text-google-blue' :
                                    log.type === 'success' ? 'bg-green-50 text-green-600' :
                                        'bg-gray-100 text-gray-500'
                                    }`}>
                                    {log.tag}
                                </span>
                                <span className={
                                    log.type === 'system' ? 'text-gray-800 font-semibold' :
                                        log.type === 'success' ? 'text-green-600' :
                                            'text-gray-500'
                                }>
                                    {log.text}
                                </span>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {sseProgress < 100 && formattedLogs.length > 0 && (
                        <motion.span
                            className="inline-block w-1.5 h-3 ml-1 align-middle mt-1"
                            style={{ backgroundColor: activeColor }}
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                        />
                    )}
                    <div ref={logsEndRef} />
                </div>

                {/* 底部进度条 */}
                <div className="h-[3px] w-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
                    <motion.div
                        className="h-full"
                        style={{
                            background: sseProgress >= 100
                                ? 'linear-gradient(90deg, #059669, #10b981)'
                                : `linear-gradient(90deg, ${activeColor}80, ${activeColor})`,
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${sseProgress}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
            </div>

            {/* 底部 HUD 状态栏 */}
            <div className="w-full max-w-2xl mt-4">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <motion.div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: activeColor }}
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 truncate">
                            Clawscan 4-Agent Engine Active
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {STEPS.map((s, i) => (
                            <div
                                key={s.id}
                                className="w-1.5 h-1.5 rounded-full transition-colors duration-500"
                                style={{
                                    backgroundColor: i < currentStep ? '#10b981' : i === currentStep ? s.color : '#d1d5db',
                                    opacity: i <= currentStep ? 1 : 0.4,
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
