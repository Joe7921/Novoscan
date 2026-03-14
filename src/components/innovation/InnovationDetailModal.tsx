import React, { useState, useEffect } from 'react';
import { getRelatedInnovations } from '@/lib/services/innovation/relationService';
import { Lightbulb, X, Network, Info, Search } from 'lucide-react';
import { ScoreTooltip } from '@/components/report/ScoreTooltip';
import { motion, AnimatePresence } from 'framer-motion';
import ModalPortal from '@/components/ui/ModalPortal';

interface InnovationDetail {
    innovation_id: string;
    keyword: string;
    category: string;
    domain_id?: string;
    novelty_score: number;
    search_count: number;
    first_seen_at?: string;
}

interface InnovationDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    innovation: InnovationDetail | null;
    relatedInnovations?: unknown[];
    onSearch?: (keyword: string) => void;
}

import { getDomainDisplayInfo } from '@/lib/constants/domains';

const InnovationDetailModal: React.FC<InnovationDetailModalProps> = ({
    isOpen,
    onClose,
    innovation,
    relatedInnovations: externalRelated,
    onSearch,
}) => {
    const [related, setRelated] = useState<any[]>([]);

    useEffect(() => {
        if (innovation?.innovation_id) {
            getRelatedInnovations(innovation.innovation_id).then(setRelated);
        } else {
            setRelated([]);
        }
    }, [innovation]);

    // 合并外部传入和内部获取的推荐数据
    const allRelated = related.length > 0 ? related : (externalRelated || []);

    console.log('[InnovationDetailModal] 渲染:', { isOpen, innovation, allRelated });

    const domainInfo = innovation ? getDomainDisplayInfo(innovation.domain_id, innovation.category) : null;
    const categoryLabel = domainInfo ? domainInfo.nameZh : '';
    const categoryColorClass = domainInfo ? domainInfo.colorClasses : { bg: '', text: '' };
    const score = innovation?.novelty_score ?? 0;
    const searchCount = innovation?.search_count ?? 0;

    return (
        <ModalPortal>
            <AnimatePresence>
                {isOpen && innovation && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/20 flex items-center justify-center p-4"
                        style={{ zIndex: 9999 }}
                        onClick={onClose}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
                            className="bg-white/95 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-indigo-500/10 border border-white/60 ring-1 ring-indigo-50/50 relative max-h-[85vh] overflow-y-auto scrollbar-hide flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 头部 */}
                            <div className="flex justify-between items-start mb-5">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                        <Lightbulb className="text-indigo-500" />
                                        {innovation.keyword}
                                    </h3>
                                    <span className={`inline-block mt-1.5 px-2.5 py-0.5 text-xs font-medium rounded-md ${categoryColorClass.bg} ${categoryColorClass.text}`}>
                                        {categoryLabel}
                                    </span>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                                >
                                    <X />
                                </button>
                            </div>

                            {/* 数据展示 */}
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <ScoreTooltip type="novelty">
                                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-4 rounded-xl text-center hover:shadow-md transition-shadow cursor-help">
                                        <div className="text-3xl font-bold text-indigo-600">{score}</div>
                                        <div className="text-xs text-slate-500 mt-1 flex justify-center items-center gap-1">创新分 <Info className="w-3 h-3" /></div>
                                    </div>
                                </ScoreTooltip>
                                <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 p-4 rounded-xl text-center">
                                    <div className="text-3xl font-bold text-orange-500">{searchCount}</div>
                                    <div className="text-xs text-slate-500 mt-1">被检索次数</div>
                                </div>
                            </div>

                            {/* 描述 */}
                            <div className="text-sm text-slate-600 mb-5 leading-relaxed bg-slate-50 rounded-xl p-4">
                                <p>这是一个<b>{categoryLabel}</b>类型的创新方向。</p>
                                <p className="mt-2">在 AI 分析中获得了 <b className="text-indigo-600">{score} 分</b>的新颖度评价。</p>
                                <p className="mt-2 text-slate-500">
                                    {searchCount > 0
                                        ? `已有 ${searchCount} 人检索过此创新点。`
                                        : '这是一个新发现的创新点！'}
                                </p>
                            </div>

                            {/* 相关推荐 */}
                            {allRelated.length > 0 && (
                                <div className="mb-5">
                                    <h4 className="text-sm font-semibold text-slate-700 mb-2.5 flex items-center gap-1.5">
                                        <Network className="text-sm text-amber-500" />
                                        看了这个的人还关注：
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {allRelated.map((rel, idx) => (
                                            <button
                                                key={rel.innovation_id || idx}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log('[Modal] 点击推荐:', rel.keyword);
                                                    onClose();
                                                    onSearch?.(rel.keyword);
                                                }}
                                                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-full hover:bg-indigo-100 hover:text-indigo-700 transition-colors cursor-pointer"
                                            >
                                                {rel.keyword}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 提示：没有相关推荐时 */}
                            {allRelated.length === 0 && (
                                <div className="mb-5 text-xs text-slate-400 flex items-center gap-1.5 bg-slate-50 rounded-lg p-3">
                                    <Info className="text-sm" />
                                    点击不同的创新点标签，系统会自动建立关联推荐
                                </div>
                            )}

                            {/* 底部按钮 */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => onSearch?.(innovation.keyword)}
                                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Search className="text-sm" />
                                    用这个关键词搜索
                                </button>
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    关闭
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </ModalPortal>
    );
};

export default InnovationDetailModal;
