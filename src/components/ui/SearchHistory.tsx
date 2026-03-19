import React, { useEffect, useState } from 'react';
import { getSearchHistory, clearSearchHistory } from '@/lib/db/searchHistoryService';
import { Language } from '@/types';
import type { LocalSearchRecord } from '@/lib/db/schema';
import { History, Trash2, FileSearch } from 'lucide-react';
import AntigravityCard from '@/components/antigravity/AntigravityCard';

interface SearchHistoryProps {
    language: Language;
    onSearch?: (query: string) => void;
}

const SearchHistory: React.FC<SearchHistoryProps> = ({ language, onSearch }) => {
    const [records, setRecords] = useState<LocalSearchRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const isZh = language === 'zh';

    const loadHistory = () => {
        setLoading(true);
        getSearchHistory(10)
            .then((data) => {
                setRecords(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        loadHistory();
    }, []);

    const handleClear = async () => {
        await clearSearchHistory();
        setRecords([]);
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMs / 3600000);

        if (diffMin < 1) return isZh ? '刚刚' : 'Just now';
        if (diffMin < 60) return isZh ? `${diffMin}分钟前` : `${diffMin}m ago`;
        if (diffHr < 24) return isZh ? `${diffHr}小时前` : `${diffHr}h ago`;
        return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <AntigravityCard className="flex flex-col h-full bg-white/95 border border-gray-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <h3 className="font-black text-2xl text-gray-900 flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gray-50 text-novo-blue">
                        <History className="w-6 h-6" />
                    </div>
                    {isZh ? '搜索历史' : 'Search History'}
                </h3>
                {records.length > 0 && (
                    <button
                        onClick={handleClear}
                        className="text-xs font-bold text-gray-400 hover:text-novo-red transition-colors flex items-center gap-1.5 bg-gray-50 hover:bg-novo-red/10 px-3 py-1.5 rounded-full border border-transparent hover:border-novo-red/20"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        {isZh ? '清空' : 'Clear'}
                    </button>
                )}
            </div>

            <div className="flex-grow">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-pulse flex space-x-3 justify-center">
                            <div className="h-3 w-3 bg-novo-blue rounded-full"></div>
                            <div className="h-3 w-3 bg-novo-red rounded-full flex-[0_0_auto] delay-100"></div>
                            <div className="h-3 w-3 bg-novo-yellow rounded-full flex-[0_0_auto] delay-200"></div>
                        </div>
                    </div>
                ) : records.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        {/* 空状态 SVG 插图 */}
                        <svg viewBox="0 0 200 160" fill="none" className="w-40 h-32 mx-auto mb-5">
                            {/* 放大镜 */}
                            <circle cx="85" cy="70" r="30" stroke="#e2e8f0" strokeWidth="4" fill="none">
                                <animate attributeName="r" values="30;32;30" dur="3s" repeatCount="indefinite" />
                            </circle>
                            <line x1="107" y1="92" x2="130" y2="115" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
                            {/* 火花 */}
                            <circle cx="70" cy="55" r="2" fill="#4285F4" opacity="0.4">
                                <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="100" cy="60" r="1.5" fill="#FBBC05" opacity="0.3">
                                <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2.5s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="80" cy="85" r="1.5" fill="#34A853" opacity="0.3">
                                <animate attributeName="opacity" values="0.3;0.6;0.3" dur="1.8s" repeatCount="indefinite" />
                            </circle>
                            {/* 小文档 */}
                            <rect x="140" y="40" width="30" height="38" rx="4" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />
                            <line x1="148" y1="50" x2="162" y2="50" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                            <line x1="148" y1="57" x2="158" y2="57" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                            <line x1="148" y1="64" x2="160" y2="64" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <p className="text-lg font-bold text-gray-900">{isZh ? '还没有搜索记录' : 'No search history yet'}</p>
                        <p className="text-sm mt-2 text-gray-500 font-medium mb-5">{isZh ? '你的每一次创新探索都会被记录在这里' : 'Every innovation exploration will be recorded here'}</p>
                        <a
                            href="/"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                        >
                            {isZh ? '去首页开始第一次分析 →' : 'Start your first analysis →'}
                        </a>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {records.map((record) => (
                            <div
                                key={record.id}
                                className="p-4 rounded-2xl bg-white/95 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-novo-blue/30 transition-all duration-300 cursor-pointer group/item"
                                onClick={() => onSearch?.(record.query)}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-base text-gray-700 group-hover/item:text-novo-blue transition-colors line-clamp-2 flex-1 font-bold tracking-wide">
                                        {record.query}
                                    </p>
                                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                        <span className="text-[11px] font-bold text-gray-400 whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded-md">
                                            {formatTime(record.timestamp)}
                                        </span>
                                        {record.credibility !== undefined && (
                                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-black border uppercase tracking-wider ${record.credibility > 75 ? 'bg-novo-green/10 text-novo-green border-novo-green/20' :
                                                record.credibility > 50 ? 'bg-novo-yellow/20 text-yellow-700 border-novo-yellow/30' :
                                                    'bg-novo-red/10 text-novo-red border-novo-red/20'
                                                }`}>
                                                {record.credibility}分
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {record.extractedInnovations?.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {record.extractedInnovations.slice(0, 3).map((inv, i) => (
                                            <span
                                                key={i}
                                                className="px-2.5 py-1 bg-gray-50 text-gray-600 border border-gray-100 rounded-full text-xs font-bold"
                                            >
                                                {inv.keyword}
                                            </span>
                                        ))}
                                        {record.extractedInnovations.length > 3 && (
                                            <span className="px-2.5 py-1 bg-white/95 text-gray-400 border border-gray-100 rounded-full text-xs font-bold shadow-sm">
                                                +{record.extractedInnovations.length - 3}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.02);
                    border-radius: 6px;
                    margin-block: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(66, 133, 244, 0.5); /* Google Blue */
                }
            `}</style>
        </AntigravityCard>
    );
};

export default React.memo(SearchHistory);
