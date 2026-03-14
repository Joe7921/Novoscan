import React from 'react';
import { SimilarPaper, Language } from '@/types';
import { BadgeCheck, Award, FileText, Quote, User, Link } from 'lucide-react';

interface SimilarityBarProps {
    paper: SimilarPaper;
    language: Language;
}

const SimilarityBar: React.FC<SimilarityBarProps> = ({ paper, language }) => {
    const isZh = language === 'zh';

    const getSimColor = (sim: number) => {
        if (sim >= 80) return 'bg-red-500';
        if (sim >= 60) return 'bg-amber-500';
        if (sim >= 40) return 'bg-blue-500';
        return 'bg-emerald-500';
    };

    const getSimTextClass = (sim: number) => {
        if (sim >= 80) return 'text-red-600';
        if (sim >= 60) return 'text-amber-600';
        if (sim >= 40) return 'text-blue-600';
        return 'text-emerald-600';
    };

    const getAuthorityBadge = (level?: string) => {
        switch (level) {
            case 'high':
                return { label: isZh ? '顶刊/高引' : 'Top Venue', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', icon: <BadgeCheck className="w-4 h-4" /> };
            case 'medium':
                return { label: isZh ? '知名期刊' : 'Notable', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: <Award className="w-4 h-4" /> };
            case 'low':
                return { label: isZh ? '普通来源' : 'Standard', bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', icon: <FileText className="w-4 h-4" /> };
            default:
                return null;
        }
    };

    const authorityBadge = getAuthorityBadge(paper.authorityLevel);

    return (
        <div className="mb-4 last:mb-0 bg-white/95 border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            {/* 标题行 */}
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-slate-800 text-sm flex-1 mr-3">{paper.title}</h4>
                <span className={`text-xs font-bold px-2 py-1 rounded-full bg-slate-50 ${getSimTextClass(paper.similarityScore)} whitespace-nowrap border border-slate-100`}>
                    {paper.similarityScore}% {isZh ? '相似' : 'Similar'}
                </span>
            </div>

            {/* 权威度 + 引用 + 发表处 */}
            <div className="flex flex-wrap items-center gap-2 mb-2">
                {authorityBadge && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border ${authorityBadge.bg} ${authorityBadge.text} ${authorityBadge.border}`}>
                        {authorityBadge.icon}
                        {authorityBadge.label}
                    </span>
                )}
                {paper.venue && (
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        {paper.venue}
                    </span>
                )}
                {paper.citationCount != null && paper.citationCount > 0 && (
                    <span className="text-xs text-slate-500 flex items-center gap-0.5">
                        <Quote />
                        {isZh ? `引用 ${paper.citationCount}` : `${paper.citationCount} citations`}
                    </span>
                )}
                {paper.year && (
                    <span className="text-xs text-slate-400">{paper.year}</span>
                )}
            </div>

            {/* 相似度进度条 */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3">
                <div className={`${getSimColor(paper.similarityScore)} h-1.5 rounded-full`} style={{ width: `${paper.similarityScore}%` }}></div>
            </div>

            {/* 关键差异 */}
            {paper.keyDifference && (
                <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                    <span className="font-medium text-slate-700">{isZh ? '关键差异：' : 'Key difference: '}</span>
                    {paper.keyDifference}
                </p>
            )}

            {/* 论文描述 */}
            {paper.description && (
                <p className="text-xs text-slate-500 mb-2 leading-relaxed line-clamp-2">
                    {paper.description}
                </p>
            )}

            {/* 作者 + 链接 */}
            {paper.authors && (
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    <User className="text-[14px]" /> {paper.authors}
                </div>
            )}
            {paper.url && (
                <a href={paper.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-2 w-fit">
                    <Link className="text-[14px]" />
                    {isZh ? '查看论文' : 'View Paper'}
                </a>
            )}
        </div>
    );
};

export default SimilarityBar;
