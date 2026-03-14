'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Shield } from 'lucide-react';
import type { ScanMode, Language } from '@/types';

interface FlashModeToggleProps {
    scanMode: ScanMode;
    onModeChange: (mode: ScanMode) => void;
    language: Language;
}

export default function FlashModeToggle({ scanMode, onModeChange, language }: FlashModeToggleProps) {
    const isZh = language === 'zh';

    const modes = [
        {
            id: 'standard' as ScanMode,
            label: isZh ? '标准' : 'Std',
            icon: Shield,
            color: 'from-slate-600 to-slate-800',
        },
        {
            id: 'flash' as ScanMode,
            label: isZh ? '极速' : 'Flash',
            icon: Zap,
            color: 'from-amber-500 to-orange-600',
        },
    ];

    return (
        <div className="inline-flex items-center bg-white/95 border border-gray-200/80 rounded-full p-0.5 shadow-sm flex-shrink-0">
            {modes.map((mode) => {
                const isActive = scanMode === mode.id;
                const Icon = mode.icon;

                return (
                    <button
                        key={mode.id}
                        onClick={() => onModeChange(mode.id)}
                        className={`
                            relative flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold
                            whitespace-nowrap transition-all duration-300 ease-out cursor-pointer select-none
                            ${isActive
                                ? 'text-white shadow-md'
                                : 'text-gray-400 hover:text-gray-600'
                            }
                        `}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="scanModeIndicator"
                                className={`absolute inset-0 bg-gradient-to-r ${mode.color} rounded-full`}
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                            />
                        )}

                        <span className="relative z-10 flex items-center gap-1">
                            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive && mode.id === 'flash' ? 'animate-pulse' : ''}`} />
                            <span>{mode.label}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

