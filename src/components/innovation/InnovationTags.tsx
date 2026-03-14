import React, { useState } from 'react';
import { Language } from '@/types';
import { recordCoOccurrence, getRelatedInnovations } from '@/lib/services/innovation/relationService';
import InnovationDetailModal from './InnovationDetailModal';
import { Tag } from 'lucide-react';
import { ScoreTooltip } from '@/components/report/ScoreTooltip';

interface InnovationTag {
    keyword: string;
    category: string;
    noveltyScore: number;
    innovationId?: string;
    innovation_id?: string;
    domainId?: string;
    novelty_score?: number;
    search_count?: number;
    hasAcademic?: boolean;    // 新增：学术支撑
    hasIndustry?: boolean;    // 新增：产业热度
    hasOpenSource?: boolean;  // 新增：开源实现
}

interface InnovationTagsProps {
    innovations: InnovationTag[];
    language: Language;
    onTagClick?: (keyword: string) => void;
}

import { getDomainDisplayInfo } from '@/lib/constants/domains';

const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-500';
};

const InnovationTags: React.FC<InnovationTagsProps> = ({ innovations, language, onTagClick }) => {
    const isZh = language === 'zh';
    const [selectedInnovation, setSelectedInnovation] = useState<any>(null);
    const [lastViewedId, setLastViewedId] = useState<string | null>(null);
    const [relatedInnovations, setRelatedInnovations] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    if (!innovations || innovations.length === 0) return null;

    // 点击标签 → 弹窗 + 记录关联
    const handleTagClick = async (inv: InnovationTag) => {
        console.log('[InnovationTags] 点击标签:', inv.keyword, 'ID:', inv.innovationId || inv.innovation_id || '(无ID)');

        const invId = inv.innovationId || inv.innovation_id || null;

        // 记录关联（如果有 ID 且之前看过别的标签）
        if (invId && lastViewedId && lastViewedId !== invId) {
            console.log('[InnovationTags] 记录关联:', lastViewedId, '→', invId);
            recordCoOccurrence(lastViewedId, invId).catch(console.error);

            try {
                const related = await getRelatedInnovations(invId, 5);
                setRelatedInnovations(related);
            } catch {
                setRelatedInnovations([]);
            }
        } else {
            setRelatedInnovations([]);
        }

        // 更新最后查看 ID
        if (invId) setLastViewedId(invId);

        // 构造弹窗数据并打开
        const modalData = {
            innovation_id: invId || `temp_${Date.now()}`,
            keyword: inv.keyword,
            category: inv.category,
            novelty_score: inv.noveltyScore || inv.novelty_score || 0,
            search_count: inv.search_count || 0,
        };
        console.log('[InnovationTags] 打开弹窗:', modalData);
        setSelectedInnovation(modalData);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedInnovation(null);
    };

    const handleSearchFromModal = (keyword: string) => {
        handleCloseModal();
        onTagClick?.(keyword);
    };

    return (
        <>
            <div className="bg-white/95 rounded-3xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg text-slate-800 mb-3 flex items-center gap-2">
                    <Tag className="text-emerald-500" />
                    {isZh ? '提取的创新点' : 'Extracted Innovations'}
                </h3>

                <div className="mb-2">
                    <h4 className="text-sm text-slate-500">
                        {isZh ? '💡 识别到的创新点：' : '💡 Identified innovations:'}
                    </h4>
                </div>

                <div className="flex flex-wrap gap-2">
                    {innovations.map((inv, index) => {
                        const domainInfo = getDomainDisplayInfo(inv.domainId, inv.category);
                        const style = domainInfo.colorClasses;
                        const score = inv.noveltyScore || inv.novelty_score || 0;

                        return (
                            <button
                                key={inv.innovationId || inv.innovation_id || index}
                                onClick={() => handleTagClick(inv)}
                                className={`group relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 cursor-pointer ${style.bg} ${style.border} hover:shadow-sm`}
                                title={
                                    inv.hasAcademic || inv.hasIndustry || inv.hasOpenSource
                                        ? `学术支撑：${inv.hasAcademic ? '有' : '无'} | 产业热度：${inv.hasIndustry ? '🔥' : '无'} | 开源实现：${inv.hasOpenSource ? '有' : '无'}`
                                        : undefined
                                }
                            >
                                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                                    {inv.keyword}
                                </span>
                                <ScoreTooltip type="novelty">
                                    <span className={`text-xs font-bold flex items-center gap-0.5 cursor-help ${getScoreColor(score)}`}>
                                        {score}分
                                    </span>
                                </ScoreTooltip>

                                {/* 数据来源徽章 (Hover显示) */}
                                {(inv.hasAcademic || inv.hasIndustry || inv.hasOpenSource) && (
                                    <span className="absolute -top-2 -right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {inv.hasAcademic && <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" title="学术验证"></span>}
                                        {inv.hasIndustry && <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm" title="产业验证"></span>}
                                        {inv.hasOpenSource && <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" title="开源实现"></span>}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 详情弹窗 */}
            <InnovationDetailModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                innovation={selectedInnovation}
                relatedInnovations={relatedInnovations}
                onSearch={handleSearchFromModal}
            />
        </>
    );
};

export default InnovationTags;
