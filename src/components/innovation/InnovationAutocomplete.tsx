import React, { useState, useRef, useEffect, useCallback } from 'react';
import { searchInnovations } from '@/lib/services/innovation/innovationService';
import { Language } from '@/types';
import debounce from 'lodash/debounce';
import { Sparkles, Search, TrendingUp, Mic } from 'lucide-react';

interface Suggestion {
    innovation_id: string;
    keyword: string;
    category: string;
    domain_id?: string;
    novelty_score: number;
    search_count: number;
}

interface InnovationAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    placeholder?: string;
    language: Language;
}

import { getDomainDisplayInfo } from '@/lib/constants/domains';

const InnovationAutocomplete: React.FC<InnovationAutocompleteProps> = ({
    value,
    onChange,
    onSubmit,
    placeholder,
    language,
}) => {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isLoading, setIsLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isZh = language === 'zh';

    // 防抖搜索
    const debouncedSearch = useCallback(
        debounce(async (query: string) => {
            if (query.length < 2) {
                setSuggestions([]);
                setShowDropdown(false);
                return;
            }

            setIsLoading(true);
            try {
                const results = await searchInnovations(query, 8);
                setSuggestions(results);
                setShowDropdown(results.length > 0);
                setActiveIndex(-1);
            } catch {
                setSuggestions([]);
            }
            setIsLoading(false);
        }, 300),
        []
    );

    // 输入变化时触发搜索
    useEffect(() => {
        debouncedSearch(value);
        return () => debouncedSearch.cancel();
    }, [value, debouncedSearch]);

    // 点击外部关闭下拉
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 选择联想词
    const handleSelect = (keyword: string) => {
        onChange(keyword);
        setShowDropdown(false);
        setActiveIndex(-1);
        textareaRef.current?.focus();
    };

    // 键盘导航
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showDropdown || suggestions.length === 0) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
                break;
            case 'Enter':
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < suggestions.length) {
                    handleSelect(suggestions[activeIndex].keyword);
                } else {
                    setShowDropdown(false);
                    onSubmit();
                }
                break;
            case 'Escape':
                setShowDropdown(false);
                setActiveIndex(-1);
                break;
        }
    };

    return (
        <div ref={containerRef} className="relative w-full">
            {/* 输入区 - Minimalist Antigravity Style */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    if (suggestions.length > 0) setShowDropdown(true);
                }}
                placeholder={placeholder}
                className="w-full h-28 sm:h-32 md:h-40 p-3 sm:p-4 bg-transparent text-gray-900 placeholder-gray-300 font-bold text-lg sm:text-xl md:text-2xl lg:text-3xl leading-tight resize-none focus:outline-none focus:ring-0"
            />

            {/* 加载指示器 */}
            {isLoading && (
                <div className="absolute top-4 right-4">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-google-blue rounded-full animate-spin" />
                </div>
            )}

            {/* 字数统计 + 语音输入 */}
            <div className="absolute bottom-2 right-3 flex items-center gap-2">
                {/* 语音输入按钮（仅在支持的浏览器显示） */}
                {typeof window !== 'undefined' && 'webkitSpeechRecognition' in window && (
                    <button
                        type="button"
                        onClick={() => {
                            const SpeechRecognition = (window as unknown).webkitSpeechRecognition;
                            const recognition = new SpeechRecognition();
                            recognition.lang = isZh ? 'zh-CN' : 'en-US';
                            recognition.onresult = (event: unknown) => {
                                const transcript = event.results[0][0].transcript;
                                onChange(value + transcript);
                            };
                            recognition.start();
                        }}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                        aria-label={isZh ? '语音输入' : 'Voice input'}
                        title={isZh ? '语音输入' : 'Voice input'}
                    >
                        <Mic className="w-4 h-4" />
                    </button>
                )}
                {/* 字数统计 */}
                <span className={`text-[10px] font-bold transition-colors ${
                    value.length === 0 ? 'text-gray-300' :
                    value.length < 5 ? 'text-amber-400' :
                    value.length > 100 ? 'text-amber-400' :
                    'text-gray-400'
                }`}>
                    {value.length > 0 && (
                        <>
                            {value.length}
                            <span className="text-gray-300">/100</span>
                            {value.length < 5 && (
                                <span className="ml-1 text-amber-400">
                                    {isZh ? '建议增加更多细节' : 'Add more details'}
                                </span>
                            )}
                        </>
                    )}
                </span>
            </div>

            {/* 联想下拉面板 - Clean White List */}
            {showDropdown && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 sm:left-0 sm:right-0 -mx-3 sm:mx-0 top-full mt-4 bg-white/95 rounded-2xl sm:rounded-3xl shadow-[0_20px_60px_-15px_rgba(31,38,135,0.15)] border border-white/60 overflow-hidden z-[100] transform origin-top transition-all">
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-50 bg-gray-50/50">
                        <span className="text-[10px] sm:text-xs font-bold text-gray-400 flex items-center gap-2 tracking-widest uppercase">
                            <Sparkles className="w-3.5 h-3.5 text-google-blue" />
                            {isZh ? '知识网络联想' : 'Knowledge Network Suggestions'}
                        </span>
                    </div>
                    <div className="max-h-[50vh] sm:max-h-[60vh] overflow-y-auto">
                        {suggestions.map((item, index) => (
                            <button
                                key={item.innovation_id}
                                onClick={() => handleSelect(item.keyword)}
                                onMouseEnter={() => setActiveIndex(index)}
                                className={`w-full px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 text-left transition-colors border-l-4 ${index === activeIndex
                                    ? 'bg-gray-50 border-google-blue'
                                    : 'bg-white/95 border-transparent hover:bg-gray-50/80 hover:border-gray-200'
                                    }`}
                            >
                                {/* 搜索图标 */}
                                <Search className="text-gray-300 w-4 h-4 hidden sm:block flex-shrink-0" />

                                {/* 关键词 */}
                                <span className={`flex-1 w-full sm:w-auto text-sm sm:text-base md:text-lg font-bold truncate transition-colors ${index === activeIndex ? 'text-google-blue' : 'text-gray-900'
                                    }`}>
                                    {item.keyword}
                                </span>

                                {/* 类别标签与指标 */}
                                <div className="flex items-center gap-2 mt-1 sm:mt-0 w-full sm:w-auto overflow-hidden">
                                    {/* 类别标签 */}
                                    {(() => {
                                        const domainInfo = getDomainDisplayInfo(item.domain_id, item.category);
                                        const classes = domainInfo.colorClasses;
                                        return (
                                            <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-extrabold flex-shrink-0 border border-transparent ${classes.bg} ${classes.text}`}>
                                                {isZh ? domainInfo.nameZh : domainInfo.nameEn}
                                            </span>
                                        );
                                    })()}

                                    {/* 检索次数 */}
                                    <span className="text-[10px] sm:text-xs font-bold text-gray-400 flex-shrink-0 flex items-center gap-1 w-auto sm:w-12 ml-auto sm:justify-end">
                                        <TrendingUp className="w-3 h-3" />
                                        {item.search_count || 1}
                                    </span>

                                    {/* 得分 */}
                                    <span className="text-xs sm:text-sm font-black text-gray-900 flex-shrink-0 min-w-[2rem] sm:w-8 text-center sm:text-right bg-gray-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md">
                                        {item.novelty_score}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-t border-gray-50 bg-gray-50/80 flex justify-between items-center">
                        <span className="text-[10px] sm:text-xs font-semibold text-gray-400 hidden sm:inline">
                            {isZh ? '↑↓ 导航  ↵ 选择  Esc 关闭' : '↑↓ Navigate  ↵ Select  Esc Close'}
                        </span>
                        <span className="text-[10px] sm:text-xs font-semibold text-gray-400 sm:hidden">
                            {isZh ? '点击以选择' : 'Tap to select'}
                        </span>
                        <span className="text-[10px] sm:text-xs font-bold text-google-blue bg-google-blue/10 px-2 py-1 rounded-md">
                            {suggestions.length} {isZh ? '个结果' : 'results'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(InnovationAutocomplete);
