'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, ChevronRight, X, Sparkles } from 'lucide-react';
import { DOMAIN_REGISTRY, SUB_DOMAIN_SEEDS } from '@/lib/constants/domains';
import type { Language } from '@/types';

interface DomainSelectorProps {
    language: Language;
    selectedDomainId: string | null;
    onDomainChange: (domainId: string | null) => void;
    selectedSubDomainId: string | null;
    onSubDomainChange: (subDomainId: string | null) => void;
}

const DomainSelector: React.FC<DomainSelectorProps> = ({
    language,
    selectedDomainId,
    onDomainChange,
    selectedSubDomainId,
    onSubDomainChange,
}) => {
    const isZh = language === 'zh';

    // 筛选当前选中大类下的子学科
    const filteredSubDomains = useMemo(() => {
        if (!selectedDomainId) return [];
        return SUB_DOMAIN_SEEDS.filter(s => s.domainId === selectedDomainId);
    }, [selectedDomainId]);

    // 获取当前选中的学科显示信息
    const selectedDomain = DOMAIN_REGISTRY.find(d => d.id === selectedDomainId);
    const selectedSubDomain = SUB_DOMAIN_SEEDS.find(s => s.id === selectedSubDomainId);

    // 清除全部选择
    const handleClear = () => {
        onDomainChange(null);
        onSubDomainChange(null);
    };

    // 选择大类时清除子学科
    const handleDomainSelect = (domainId: string) => {
        if (domainId === selectedDomainId) {
            // 点击相同的大类 → 取消选择
            handleClear();
        } else {
            onDomainChange(domainId);
            onSubDomainChange(null);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-4 sm:mt-6 lg:mt-10"
        >
            {/* 标题行 + 精度提升提示 */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 font-bold">
                    <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-gray-900" />
                    <span>{isZh ? '学科聚焦' : 'Domain Focus'}</span>
                    <span className="text-gray-400 font-normal">
                        {isZh ? '（可选）' : '(Optional)'}
                    </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-google-green/10 border border-google-green/20 text-google-green text-[10px] sm:text-xs font-bold">
                    <Sparkles className="w-3 h-3" />
                    <span>{isZh ? '选择学科可提升精度约 30%' : 'Selecting a domain improves accuracy ~30%'}</span>
                </div>
            </div>

            {/* 已选择的学科摘要（简洁模式） */}
            <AnimatePresence>
                {selectedDomain && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-3 flex items-center gap-2 text-xs sm:text-sm"
                    >
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold ${selectedDomain.colorClasses.bg} ${selectedDomain.colorClasses.text} ${selectedDomain.colorClasses.border} border`}>
                            <span className={`w-2 h-2 rounded-full ${selectedDomain.colorClasses.dot}`} />
                            {selectedDomain.nameZh}
                        </span>
                        {selectedSubDomain && (
                            <>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold ${selectedDomain.colorClasses.bg} ${selectedDomain.colorClasses.text} ${selectedDomain.colorClasses.border} border`}>
                                    {selectedSubDomain.nameZh}
                                </span>
                            </>
                        )}
                        <button
                            onClick={handleClear}
                            className="ml-1 p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
                            title={isZh ? '清除选择' : 'Clear selection'}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 一级学科选择 — 药丸按钮行 */}
            <div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                {DOMAIN_REGISTRY.map((domain) => {
                    const isActive = domain.id === selectedDomainId;
                    return (
                        <button
                            key={domain.id}
                            onClick={() => handleDomainSelect(domain.id)}
                            className={`group px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-300 border ${isActive
                                ? `${domain.colorClasses.bg} ${domain.colorClasses.text} ${domain.colorClasses.border} shadow-sm`
                                : 'bg-white/50 text-gray-500 border-gray-200 hover:bg-white/80 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <span className="flex items-center gap-1.5">
                                {isActive && (
                                    <span className={`w-2 h-2 rounded-full ${domain.colorClasses.dot}`} />
                                )}
                                <span>{domain.nameZh}</span>
                                <span className="text-gray-400 font-normal hidden sm:inline">
                                    {domain.nameEn}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* 二级子学科选择（仅在选中大类且有子学科时显示） */}
            <AnimatePresence>
                {selectedDomainId && filteredSubDomains.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-3 pt-3 border-t border-gray-100"
                    >
                        <div className="text-[10px] sm:text-xs text-gray-400 font-bold mb-2 flex items-center gap-1.5">
                            <ChevronRight className="w-3 h-3" />
                            {isZh ? '细分方向（可选）' : 'Sub-discipline (optional)'}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {filteredSubDomains.map((sub) => {
                                const isActive = sub.id === selectedSubDomainId;
                                const parentDomain = DOMAIN_REGISTRY.find(d => d.id === sub.domainId);
                                return (
                                    <button
                                        key={sub.id}
                                        onClick={() => onSubDomainChange(isActive ? null : sub.id)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 border ${isActive
                                            ? `${parentDomain?.colorClasses.bg || 'bg-gray-50'} ${parentDomain?.colorClasses.text || 'text-gray-700'} ${parentDomain?.colorClasses.border || 'border-gray-200'} shadow-sm`
                                            : 'bg-white/40 text-gray-500 border-gray-200/60 hover:bg-white/70 hover:text-gray-600'
                                            }`}
                                    >
                                        {sub.nameZh}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default DomainSelector;
