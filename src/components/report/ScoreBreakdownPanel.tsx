import React from 'react';
import { motion } from 'framer-motion';
import { Language } from '@/types';
import { ScoreTooltip } from '@/components/report/ScoreTooltip';

interface Dimension {
    name: string;
    weight: number;
    score: number;
    description: string;
}

interface ScoreBreakdownPanelProps {
    academicScore: number;
    industryScore: number;
    academicDimensions?: Dimension[];
    industryDimensions?: Dimension[];
    language?: Language;
}

const ScoreBreakdownPanel: React.FC<ScoreBreakdownPanelProps> = ({
    academicScore,
    industryScore,
    academicDimensions,
    industryDimensions,
    language = 'zh'
}) => {
    const isZh = language === 'zh';

    const defaultAcademicDims: Dimension[] = academicDimensions || [
        { name: isZh ? '技术相似度 (反向)' : 'Technical Similarity (Inv)', weight: 30, score: 85, description: isZh ? '分析核心算法与现有论文的结构差异' : 'Structural differences from existing papers' },
        { name: isZh ? '时间新颖度' : 'Temporal Novelty', weight: 20, score: 92, description: isZh ? '该技术路线在近三年的提出频率' : 'Frequency of proposal in recent 3 years' },
        { name: isZh ? '领域稀缺度' : 'Domain Scarcity', weight: 20, score: 78, description: isZh ? '相关研究在目标细分领域的集聚程度' : 'Concentration of research in sub-domain' },
        { name: isZh ? '引用影响力' : 'Citation Impact', weight: 15, score: 65, description: isZh ? '相似技术的平均被引次数评估' : 'Average citations of similar tech' },
        { name: isZh ? '权威期刊占比' : 'Top Tier Ratio', weight: 15, score: 70, description: isZh ? '相似文献在顶级期刊/会议的分布' : 'Distribution in top tier journals/conferences' }
    ];

    const defaultIndustryDims: Dimension[] = industryDimensions || [
        { name: isZh ? '开源实现稀缺度' : 'Open Source Scarcity', weight: 30, score: 88, description: isZh ? 'GitHub等平台类似仓库的数量与活跃度' : 'Quantity and activity of similar repos' },
        { name: isZh ? '商业产品覆盖率 (反向)' : 'Commercial Coverage (Inv)', weight: 25, score: 75, description: isZh ? '市面已有成熟商业产品的重叠度' : 'Overlap with existing commercial products' },
        { name: isZh ? '社区讨论热度' : 'Community Buzz', weight: 20, score: 60, description: isZh ? '技术社区(HackerNews, Reddit)的痛点讨论' : 'Discussions in tech communities' },
        { name: isZh ? '技术成熟度' : 'Tech Readiness Level', weight: 15, score: 45, description: isZh ? '实现该方案所需的工程基建完备度' : 'Infrastructure readiness for implementation' },
        { name: isZh ? '落地可行性' : 'Feasibility', weight: 10, score: 82, description: isZh ? '结合成本与现有生态的综合预判' : 'Comprehensive judgment with cost and ecology' }
    ];

    const DimensionBar = ({ dim, colorClass, bgClass }: { dim: Dimension, colorClass: string, bgClass: string }) => (
        <div className="mb-4">
            <div className="flex justify-between items-end mb-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">{dim.name}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                        {dim.weight}%
                    </span>
                </div>
                <span className={`text-sm font-black ${colorClass}`}>{dim.score}/100</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-1 relative">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${dim.score}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full ${bgClass}`}
                />
            </div>
            <p className="text-[10px] text-gray-400 line-clamp-1">{dim.description}</p>
        </div>
    );

    return (
        <div className="w-full bg-white/95 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-200/60 transition-all hover:shadow-md">
            <div className="mb-8">
                <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                    <span className="bg-gradient-to-r from-teal-500 to-emerald-600 text-transparent bg-clip-text">
                        {isZh ? '双维交叉评分矩阵' : 'Dual-Dimension Scoring Matrix'}
                    </span>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold ml-2">Explainable AI</span>
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                    {isZh ? '业内唯一打破单一学术查重盲区的复合评价算法，每个评分皆有据可查。' : 'The only composite evaluation algorithm breaking the blind spot of single academic plagiarism checks.'}
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 md:gap-12">
                {/* Academic Column */}
                <div className="relative">
                    <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gray-200 to-transparent hidden md:block"></div>

                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <ScoreTooltip score={academicScore} type="academic">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                                    <span className="text-xl font-black">{academicScore}</span>
                                </div>
                            </ScoreTooltip>
                            <div>
                                <h4 className="font-bold text-gray-900 text-lg leading-tight">{isZh ? '学术创新分' : 'Academic Score'}</h4>
                                <div className="text-xs text-blue-600 font-medium">Academic Novelty</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{isZh ? '最高权重维度' : 'Top Weight'}</div>
                            <div className="text-xs font-bold text-gray-700">{defaultAcademicDims[0].name}</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {defaultAcademicDims.map((dim, idx) => (
                            <DimensionBar
                                key={`acad-${idx}`}
                                dim={dim}
                                colorClass="text-blue-600"
                                bgClass="bg-gradient-to-r from-blue-400 to-indigo-500"
                            />
                        ))}
                    </div>
                </div>

                {/* Industry Column */}
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <ScoreTooltip score={industryScore} type="industry">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                                    <span className="text-xl font-black">{industryScore}</span>
                                </div>
                            </ScoreTooltip>
                            <div>
                                <h4 className="font-bold text-gray-900 text-lg leading-tight">{isZh ? '产业创新分' : 'Industry Score'}</h4>
                                <div className="text-xs text-purple-600 font-medium">Practical Viability</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{isZh ? '最高权重维度' : 'Top Weight'}</div>
                            <div className="text-xs font-bold text-gray-700">{defaultIndustryDims[0].name}</div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {defaultIndustryDims.map((dim, idx) => (
                            <DimensionBar
                                key={`ind-${idx}`}
                                dim={dim}
                                colorClass="text-purple-600"
                                bgClass="bg-gradient-to-r from-purple-400 to-fuchsia-500"
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScoreBreakdownPanel;
