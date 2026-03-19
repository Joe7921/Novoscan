/**
 * RetryProgressPanel — Agent 修复进度面板
 * 从 analysis/index.tsx 提取
 */
import React from 'react';
import { Loader2 as Loader2Icon } from 'lucide-react';

/** Agent ID → 中英文名称映射 */
export const AGENT_DISPLAY_NAMES: Record<string, { zh: string; en: string }> = {
    academicReviewer: { zh: '学术审查员', en: 'Academic' },
    industryAnalyst: { zh: '产业分析员', en: 'Industry' },
    competitorDetective: { zh: '竞品侦探', en: 'Competitor' },
    innovationEvaluator: { zh: '创新评估师', en: 'Innovation' },
};

interface RetryProgressPanelProps {
    retryingAgents: Set<string>;
    retryProgress?: { total: number; completed: number; startTime: number } | null;
    isZh: boolean;
}

const RetryProgressPanel: React.FC<RetryProgressPanelProps> = ({ retryingAgents, retryProgress, isZh }) => {
    const [elapsed, setElapsed] = React.useState(0);

    React.useEffect(() => {
        if (!retryProgress) return;
        const timer = setInterval(() => {
            setElapsed(Math.floor((Date.now() - retryProgress.startTime) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [retryProgress]);

    const agentIds = Array.from(retryingAgents);

    return (
        <div className="flex flex-col gap-2 flex-shrink-0 min-w-[200px]">
            {/* 顶部状态条 */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md">
                <Loader2Icon size={14} className="animate-spin flex-shrink-0" />
                <span>{isZh ? '修复中' : 'Fixing'}</span>
                <span className="opacity-80">{retryProgress ? `${retryProgress.total}` : agentIds.length} {isZh ? '位专家' : 'agents'}</span>
                <span className="ml-auto tabular-nums opacity-70">{elapsed}s</span>
            </div>
            {/* Agent 列表 */}
            <div className="flex flex-wrap gap-1.5 px-1">
                {agentIds.map(id => {
                    const name = AGENT_DISPLAY_NAMES[id];
                    return (
                        <div
                            key={id}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-[11px] font-semibold text-blue-700 animate-pulse"
                        >
                            <Loader2Icon size={10} className="animate-spin" />
                            {name ? (isZh ? name.zh : name.en) : id}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RetryProgressPanel;
