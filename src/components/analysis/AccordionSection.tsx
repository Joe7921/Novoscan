/**
 * AccordionSection — 通用可折叠手风琴区块
 * 从 analysis/index.tsx 提取
 */
import React from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionSectionProps {
    icon: React.ReactNode;
    title: string;
    defaultOpen?: boolean;
    badge?: string;
    badgeColor?: string;
    children: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
    icon,
    title,
    defaultOpen = false,
    badge,
    badgeColor = 'bg-slate-100 text-slate-600',
    children,
}) => (
    <details open={defaultOpen} className="group rounded-2xl border border-slate-200 bg-white/95 shadow-sm overflow-hidden transition-all hover:shadow-md">
        <summary className="flex items-center gap-3 px-6 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
            <span className="text-lg">{icon}</span>
            <span className="font-bold text-slate-800 flex-1">{title}</span>
            {badge && (
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${badgeColor}`}>{badge}</span>
            )}
            <ChevronDown size={18} className="text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-6 pb-6 pt-2 border-t border-slate-100 animate-fade-in">
            {children}
        </div>
    </details>
);

export default AccordionSection;
