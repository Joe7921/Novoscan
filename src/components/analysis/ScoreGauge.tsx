import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Language } from '@/types';

interface ScoreGaugeProps {
    score: number;
    label: string;
    type: 'academic' | 'industry';
    language?: Language;
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score, label, type, language = 'zh' }) => {
    const isZh = language === 'zh';
    const [animatedScore, setAnimatedScore] = useState(0);

    // Determine color based on score
    const getColor = (val: number) => {
        if (val >= 80) return type === 'academic' ? '#4f46e5' : '#10b981'; // Indigo / Emerald
        if (val >= 60) return '#3b82f6'; // Blue
        if (val >= 40) return '#f59e0b'; // Amber
        return '#ef4444'; // Red
    };

    const getSubLabel = (val: number) => {
        if (val >= 80) return isZh ? (type === 'academic' ? '高度创新' : '高可行性') : (type === 'academic' ? 'Highly Novel' : 'Highly Feasible');
        if (val >= 60) return isZh ? (type === 'academic' ? '中等创新' : '中等可行') : (type === 'academic' ? 'Moderately Novel' : 'Moderately Feasible');
        if (val >= 40) return isZh ? (type === 'academic' ? '边缘创新' : '低可行性') : (type === 'academic' ? 'Marginally Novel' : 'Low Feasibility');
        return isZh ? (type === 'academic' ? '缺乏创新' : '难以落地') : (type === 'academic' ? 'Not Novel' : 'Unfeasible');
    };

    useEffect(() => {
        const duration = 1500; // 1.5s
        const steps = 60;
        const stepTime = duration / steps;
        let current = 0;

        // Ensure score is valid
        const finalScore = Math.max(0, Math.min(100, isNaN(score) ? 0 : score));

        const timer = setInterval(() => {
            current += finalScore / steps;
            if (current >= finalScore) {
                setAnimatedScore(finalScore);
                clearInterval(timer);
            } else {
                setAnimatedScore(Math.floor(current));
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [score]);

    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (animatedScore / 100) * circumference;
    const color = getColor(animatedScore);

    return (
        <div className="flex flex-col items-center justify-center p-6 bg-white/95 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
            {/* Decorative gradient blob */}
            <div
                className="absolute w-32 h-32 rounded-full blur-[40px] opacity-20 transition-colors duration-1000"
                style={{ backgroundColor: color }}
            />

            <div className="relative w-40 h-40 flex items-center justify-center">
                {/* Background Circle */}
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="transparent"
                        stroke="#f1f5f9"
                        strokeWidth="12"
                        strokeLinecap="round"
                    />
                </svg>

                {/* Animated Progress Circle */}
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <motion.circle
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="transparent"
                        stroke={color}
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        style={{ willChange: 'stroke-dashoffset' }}
                    />
                </svg>

                {/* Inner Content */}
                <div className="flex flex-col items-center justify-center relative z-10 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] rounded-full w-[100px] h-[100px] border border-gray-50">
                    <motion.span
                        className="text-4xl font-black tabular-nums tracking-tighter"
                        style={{ color: color }}
                    >
                        {animatedScore}
                    </motion.span>
                </div>
            </div>

            <div className="mt-5 text-center relative z-10 w-full">
                <h4 className="text-sm font-bold text-gray-800 uppercase tracking-widest">{label}</h4>
                <div
                    className="mt-2 text-[11px] font-bold px-3 py-1 rounded-full inline-block transition-colors duration-500 border"
                    style={{
                        backgroundColor: `${color}15`,
                        color: color,
                        borderColor: `${color}30`
                    }}
                >
                    {getSubLabel(animatedScore)}
                </div>
                {/* #14 直觉解读文案 */}
                <p className="mt-2 text-[11px] text-gray-400 leading-relaxed px-2">
                    {animatedScore >= 80
                        ? (isZh
                            ? `${animatedScore}/100 — ${type === 'academic' ? '处于前沿水平，具有显著突破性' : '商业落地条件成熟，建议推进'}`
                            : `${animatedScore}/100 — ${type === 'academic' ? 'Cutting-edge level with significant breakthroughs' : 'Strong commercial viability, recommended to advance'}`)
                        : animatedScore >= 60
                            ? (isZh
                                ? `${animatedScore}/100 — ${type === 'academic' ? '具有中等创新空间，建议深化差异化' : '具备可行性基础，需完善商业模型'}`
                                : `${animatedScore}/100 — ${type === 'academic' ? 'Moderate innovation space, deepen differentiation' : 'Feasibility basis exists, refine business model'}`)
                            : animatedScore >= 40
                                ? (isZh
                                    ? `${animatedScore}/100 — ${type === 'academic' ? '与现有研究重叠较多，需寻找独特切角' : '商业模式需大幅调整'}`
                                    : `${animatedScore}/100 — ${type === 'academic' ? 'Significant overlap with existing work, find unique angle' : 'Business model needs significant adjustment'}`)
                                : (isZh
                                    ? `${animatedScore}/100 — ${type === 'academic' ? '已有大量类似工作，建议重新定位' : '落地难度较大，考虑转向或迭代'}`
                                    : `${animatedScore}/100 — ${type === 'academic' ? 'Extensive similar work exists, consider repositioning' : 'High implementation difficulty, consider pivoting'}`)
                    }
                </p>
            </div>
        </div>
    );
};

export default React.memo(ScoreGauge);
