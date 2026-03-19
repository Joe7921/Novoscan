/**
 * RawDataSection — 第三层原始数据
 * 从 analysis/index.tsx 提取（论文、网络源、微信、深度报告、七源原始数据）
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Language, InternetSource } from '@/types';
import AccordionSection from './AccordionSection';
import SimilarityBar from './SimilarityBar';
import InternetSourceCard from './InternetSourceCard';
import { Compass, Copy, FileText } from 'lucide-react';

const renderMarkdown = (content: string) => (
    <ReactMarkdown
        components={{
            table: ({ node, ...props }) => (
                <div className="w-full overflow-x-auto pb-2 mb-4 scrollbar-hide relative">
                    <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-white/20 to-transparent pointer-events-none md:hidden" />
                    <table className="min-w-full" {...props} />
                </div>
            )
        }}
    >
        {content}
    </ReactMarkdown>
);

interface RawDataSectionProps {
    report: any;
    language: Language;
    dualResult?: any;
}

const RawDataSection: React.FC<RawDataSectionProps> = ({ report, language, dualResult }) => {
    const isZh = language === 'zh';

    return (
        <section className="space-y-3 mb-10">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">
                {isZh ? '📂 原始数据' : '📂 Raw Data'}
            </h3>

            {/* 相似学术论文 */}
            {report.similarPapers && report.similarPapers.length > 0 && (
                <AccordionSection
                    icon={<Copy size={18} className="text-amber-500" />}
                    title={isZh ? '高相似度学术记录' : 'Similar Academic Works'}
                    badge={`${report.similarPapers.length} ${isZh ? '篇' : 'papers'}`}
                    badgeColor="bg-amber-100 text-amber-700"
                >
                    <div className="space-y-3">
                        {report.similarPapers.map((paper: any, idx: number) => (
                            <SimilarityBar key={idx} paper={paper} language={language} />
                        ))}
                    </div>
                </AccordionSection>
            )}

            {/* 全网资讯源 */}
            <AccordionSection
                icon={<Compass size={18} className="text-blue-500" />}
                title={isZh ? '全网相关资讯' : 'Web Sources'}
                badge={`${(report.internetSources || []).length} ${isZh ? '条' : 'sources'}`}
                badgeColor="bg-blue-100 text-blue-700"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(report.internetSources && report.internetSources.length > 0 ? report.internetSources : [{
                        title: isZh ? "暂未提取到有效资源" : "No resources extracted",
                        snippet: isZh ? "请尝试不同关键词..." : "Try different keywords...",
                        url: "#",
                        summary: "-",
                        type: "Other" as const
                    }]).map((source: any, idx: number) => (
                        <InternetSourceCard key={idx} source={source as InternetSource} />
                    ))}
                </div>
            </AccordionSection>

            {/* 微信公众号文章 */}
            {dualResult?.industry?.wechatArticles?.length > 0 && (
                <AccordionSection
                    icon={<span>💬</span>}
                    title={isZh ? '微信公众号文章' : 'WeChat Articles'}
                    badge={`${dualResult.industry.wechatArticles.length} ${isZh ? '篇' : 'articles'}`}
                    badgeColor="bg-green-100 text-green-700"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {dualResult.industry.wechatArticles.map((article: any, idx: number) => (
                            <a key={idx} href={article.url} target="_blank" rel="noopener noreferrer"
                                className="group block bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100 hover:border-green-300 hover:shadow-md transition-all">
                                <div className="flex items-start gap-3">
                                    <span className="text-lg flex-shrink-0 mt-0.5">📱</span>
                                    <div className="flex-1 min-w-0">
                                        <h5 className="font-bold text-sm text-slate-800 group-hover:text-green-700 transition-colors line-clamp-2">{article.title}</h5>
                                        {article.author && (
                                            <span className="inline-block text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full mt-1.5 font-medium">{article.author}</span>
                                        )}
                                        {article.description && (
                                            <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">{article.description}</p>
                                        )}
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-100">微信公众号</span>
                                            {article.publishDate && <span className="text-[10px] text-slate-400">{article.publishDate}</span>}
                                        </div>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                </AccordionSection>
            )}

            {/* AI 深度审查报告 */}
            {report.sections && (
                <AccordionSection
                    icon={<FileText size={18} className="text-indigo-600" />}
                    title={isZh ? '深度审查报告' : 'Deep Review Report'}
                >
                    <div className="space-y-6">
                        {!!(report.sections as any).academic && (
                            <div className="space-y-3">
                                <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                                    <span className="text-blue-500">📚</span> {`${(report.sections as any).academic.title || ''}`}
                                </h4>
                                {((report.sections as any).academic.subsections || []).map((sub: any, i: number) => (
                                    <div key={i} className="prose prose-sm prose-indigo max-w-none">
                                        <strong className="text-slate-700">{sub.title}</strong>
                                        {renderMarkdown(sub.content)}
                                    </div>
                                ))}
                            </div>
                        )}
                        {!!(report.sections as any).internet && (
                            <div className="space-y-3 pt-4 border-t border-slate-100">
                                <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                                    <span className="text-amber-500">🌍</span> {`${(report.sections as any).internet.title || ''}`}
                                </h4>
                                {((report.sections as any).internet.subsections || []).map((sub: any, i: number) => (
                                    <div key={i} className="prose prose-sm prose-indigo max-w-none">
                                        <strong className="text-slate-700">{sub.title}</strong>
                                        {renderMarkdown(sub.content)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </AccordionSection>
            )}

            {/* 七源双轨原始检索数据 */}
            {dualResult && (
                <AccordionSection
                    icon={<span>🔬</span>}
                    title={isZh ? '七源检索原始数据' : '7-Source Raw Data'}
                    badge={`${dualResult.searchTimeMs || 0}ms`}
                    badgeColor="bg-slate-100 text-slate-600"
                >
                    <div className="grid md:grid-cols-2 gap-4">
                        {dualResult.academic && (
                            <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 space-y-3">
                                <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                                    📚 {isZh ? '学术轨道' : 'Academic Track'}
                                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full">{isZh ? '四源聚合' : '4 Sources'}</span>
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-center">
                                    <div className="bg-white/95 rounded-lg p-2">
                                        <div className="text-lg font-bold text-blue-700">{dualResult.academic.stats?.totalPapers || 0}</div>
                                        <div className="text-[10px] text-slate-500">{isZh ? '相关论文' : 'Papers'}</div>
                                    </div>
                                    <div className="bg-white/95 rounded-lg p-2">
                                        <div className="text-lg font-bold text-blue-700">{dualResult.academic.stats?.totalCitations || 0}</div>
                                        <div className="text-[10px] text-slate-500">{isZh ? '总引用' : 'Citations'}</div>
                                    </div>
                                </div>
                                {(dualResult.academic.topConcepts?.length || 0) > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {dualResult.academic.topConcepts.slice(0, 5).map((c: string, i: number) => (
                                            <span key={i} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{c}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {dualResult.industry && (
                            <div className="bg-orange-50/50 rounded-xl p-4 border border-orange-100 space-y-3">
                                <h4 className="font-bold text-orange-900 text-sm flex items-center gap-2">
                                    🏭 {isZh ? '产业轨道' : 'Industry Track'}
                                    <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">{isZh ? '四源聚合' : '4 Sources'}</span>
                                </h4>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-white/95 rounded-lg p-2">
                                        <div className="text-lg font-bold text-orange-700">
                                            {(dualResult.industry.webSources?.brave || 0) + (dualResult.industry.webSources?.serpapi || 0)}
                                        </div>
                                        <div className="text-[10px] text-slate-500">{isZh ? '网络讨论' : 'Web Discuss.'}</div>
                                    </div>
                                    <div className="bg-white/95 rounded-lg p-2">
                                        <div className="text-lg font-bold text-orange-700">{(dualResult.industry.githubRepos || []).length}</div>
                                        <div className="text-[10px] text-slate-500">{isZh ? '开源项目' : 'OSS Projects'}</div>
                                    </div>
                                    <div className="bg-white/95 rounded-lg p-2">
                                        <div className="text-lg font-bold text-green-700">{(dualResult.industry.wechatArticles || []).length}</div>
                                        <div className="text-[10px] text-slate-500">{isZh ? '公众号文章' : 'WeChat'}</div>
                                    </div>
                                </div>
                                {(dualResult.industry.topProjects?.length || 0) > 0 && (
                                    <div className="space-y-1">
                                        {dualResult.industry.topProjects.slice(0, 3).map((p: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between text-xs bg-white/95 px-2 py-1.5 rounded-lg">
                                                <span className="truncate flex-1 font-medium">{p.name}</span>
                                                <span className="text-orange-600 ml-2">{(p.stars || 0).toLocaleString()}⭐</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </AccordionSection>
            )}
        </section>
    );
};

export default RawDataSection;
