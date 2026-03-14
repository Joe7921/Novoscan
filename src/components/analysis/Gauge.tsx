import React from 'react';

interface GaugeProps {
    score: number;
    label: string;
    colorOverride?: string;
}

const Gauge: React.FC<GaugeProps> = ({ score, label, colorOverride }) => {
    const percentage = Math.max(0, Math.min(100, score));

    let colorClass = colorOverride;
    if (!colorClass) {
        if (percentage >= 80) colorClass = 'text-emerald-500';
        else if (percentage >= 60) colorClass = 'text-blue-500';
        else if (percentage >= 40) colorClass = 'text-amber-500';
        else colorClass = 'text-red-500';
    }

    const strokeDasharray = 251.2;
    const strokeDashoffset = strokeDasharray - (strokeDasharray * percentage) / 100;

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-28 h-28 md:w-32 md:h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                        className="text-slate-100 stroke-current"
                        strokeWidth="8"
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                    ></circle>
                    <circle
                        className={`${colorClass} stroke-current transition-all duration-1000 ease-out`}
                        strokeWidth="8"
                        strokeLinecap="round"
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                    ></circle>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-2xl md:text-3xl font-bold text-slate-800">{percentage}</span>
                    <span className="text-xs text-slate-500">/100</span>
                </div>
            </div>
            <span className="mt-2 font-medium text-slate-700 text-center text-sm">{label}</span>
        </div>
    );
};

export default Gauge;
