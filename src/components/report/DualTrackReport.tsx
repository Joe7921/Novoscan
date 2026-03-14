/**
 * 七源双轨检索报告组件
 *
 * 展示学术四源 + 产业三源的交叉验证结果，
 * 包含可信度仪表盘、双轨对比卡片、交叉验证分析和投资建议。
 */
import React from 'react';
import { Info } from 'lucide-react';
import type { DualTrackResult } from '@/types';

interface Props {
    result: DualTrackResult;
    query: string;
    loading?: boolean;
}

// ==================== 工具函数 ====================

function getCredibilityColor(level: string): string {
    switch (level) {
        case 'high':
            return 'text-green-600 bg-green-50 border-green-200';
        case 'medium':
            return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        case 'low':
            return 'text-red-600 bg-red-50 border-red-200';
        default:
            return 'text-slate-600 bg-slate-50 border-slate-200';
    }
}

function getSentimentLabel(sentiment: string): { text: string; className: string } {
    switch (sentiment) {
        case 'hot':
            return { text: '🔥 热门', className: 'bg-red-100 text-red-700' };
        case 'warm':
            return { text: '🌡️ 温和', className: 'bg-yellow-100 text-yellow-700' };
        case 'cold':
            return { text: '❄️ 冷静', className: 'bg-slate-100 text-slate-600' };
        default:
            return { text: sentiment, className: 'bg-slate-100 text-slate-600' };
    }
}

function getSupportLabel(support: string): { text: string; className: string } {
    switch (support) {
        case 'strong':
            return { text: '强', className: 'text-green-600' };
        case 'moderate':
            return { text: '中', className: 'text-yellow-600' };
        case 'weak':
            return { text: '弱', className: 'text-red-500' };
        default:
            return { text: support, className: 'text-slate-600' };
    }
}

function formatCitations(n: number): string {
    if (n >= 10000) return (n / 1000).toFixed(0) + 'k';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
}

// ==================== 子组件 ====================

/** 加载状态 */
const LoadingState: React.FC = () => (
    <div className="max-w-4xl mx-auto p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4 text-slate-500">七源双轨检索中...</p>
        <p className="mt-1 text-xs text-slate-400">
            正在查询 OpenAlex · arXiv · CrossRef · CORE · Brave · Google · GitHub
        </p>
    </div>
);

/** 可信度仪表盘 */
const CredibilityDashboard: React.FC<{
    credibility?: DualTrackResult['finalCredibility'];
    redFlags: string[];
}> = ({ credibility, redFlags }) => {
    const score = credibility?.score || 0;
    const level = credibility?.level || 'low';
    const reasoning = credibility?.reasoning || [];

    return (
        <section className={`rounded-2xl border-2 p-6 ${getCredibilityColor(level)}`}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <span>🎯</span>创新可信度评估
                    </h2>
                    <div className="flex items-baseline gap-3 mt-2">
                        <span className="text-5xl font-bold">{score}</span>
                        <span className="text-xl opacity-60">/ 100</span>
                        <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${level === 'high'
                                ? 'bg-green-200 text-green-800'
                                : level === 'medium'
                                    ? 'bg-yellow-200 text-yellow-800'
                                    : 'bg-red-200 text-red-800'
                                }`}
                        >
                            {level === 'high' ? '高可信度' : level === 'medium' ? '中等可信度' : '低可信度'}
                        </span>
                    </div>
                </div>
                <div className="flex-1 max-w-md">
                    <h3 className="text-sm font-medium mb-2">评估依据</h3>
                    <ul className="space-y-1.5">
                        {reasoning.slice(0, 3).map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5 text-slate-600">
                                <span className="text-xs mt-0.5 flex-shrink-0">{r.includes('⚠️') ? '⚠️' : '✓'}</span>
                                <span className="text-xs">{r}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            {redFlags.length > 0 && (
                <div className="mt-4 p-4 bg-white/95 rounded-xl border border-red-200">
                    <h3 className="font-semibold text-red-700 flex items-center gap-2">
                        <span>🚩</span>风险提示
                    </h3>
                    <ul className="mt-2 space-y-1">
                        {redFlags.map((flag, i) => (
                            <li key={i} className="text-sm text-red-600">• {flag}</li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
};

/** 学术轨道卡片 */
const AcademicCard: React.FC<{ academic?: DualTrackResult['academic']; query?: string }> = ({ academic, query = '' }) => {
    if (!academic) return null;
    return (
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-blue-900 flex items-center gap-2">
                    <span>📚</span>学术轨道
                </h3>
                <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">四源聚合</span>
            </div>
            <div className="space-y-4">
                {/* 统计数字 */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/95 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-blue-700">{academic?.stats?.totalPapers || 0}</div>
                        <div className="text-xs text-slate-600">相关论文</div>
                    </div>
                    <div className="bg-white/95 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-blue-700">
                            {formatCitations(academic?.stats?.totalCitations || 0)}
                        </div>
                        <div className="text-xs text-slate-600">总引用</div>
                    </div>
                </div>
                {/* 详细指标 */}
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-600">开放获取</span>
                        <span className="font-medium text-green-600">
                            {' '}
                            {(academic?.stats?.openAccessCount || academic?.stats?.fullTextAvailable || 0) as unknown as React.ReactNode} 篇{' '}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-600">数据来源</span>
                        <div className="flex gap-1 text-xs">
                            <a
                                href={`https://openalex.org/works?filter=title.search:${encodeURIComponent(query)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-200 transition"
                            >
                                OA:{academic.stats?.bySource?.openAlex || 0}
                            </a>
                            <a
                                href={`https://arxiv.org/search/?query=${encodeURIComponent(query)}&searchtype=all`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded hover:bg-red-200 transition"
                            >
                                AR:{academic.stats?.bySource?.arxiv || 0}
                            </a>
                            <a
                                href={`https://search.crossref.org/?q=${encodeURIComponent(query)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded hover:bg-green-200 transition"
                            >
                                CR:{academic.stats?.bySource?.crossref || 0}
                            </a>
                            <a
                                href={`https://core.ac.uk/search?q=${encodeURIComponent(query)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded hover:bg-purple-200 transition"
                            >
                                CO:{academic.stats?.bySource?.core || 0}
                            </a>
                        </div>
                    </div>
                </div>
                {/* 热门研究方向 */}
                {(academic.topConcepts?.length || 0) > 0 && (
                    <div>
                        <span className="text-xs text-slate-500">热门研究方向</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            {academic.topConcepts.slice(0, 6).map((concept, i) => (
                                <span
                                    key={i}
                                    className="text-xs bg-white/95 px-2 py-1 rounded-full border border-blue-200 text-blue-700"
                                >
                                    {concept}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

/** 产业轨道卡片 */
const IndustryCard: React.FC<{ industry?: DualTrackResult['industry']; query?: string }> = ({ industry, query = '' }) => {
    if (!industry) return null;
    const sentiment = getSentimentLabel(industry.sentiment);
    const totalStars = (industry.githubRepos || []).reduce((sum, r) => sum + (r.stars || 0), 0);
    const activeCount = (industry.githubRepos || []).filter((r) => r.health === 'active').length;

    return (
        <section className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-orange-900 flex items-center gap-2">
                    <span>🏭</span>产业轨道
                </h3>
                <span className={`text-xs px-2 py-1 rounded-full ${sentiment.className}`}>
                    {sentiment.text}
                </span>
            </div>
            <div className="space-y-4">
                {/* 统计数字 */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/95 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-orange-700">
                            {(industry.webSources?.brave || 0) + (industry.webSources?.serpapi || 0)}
                        </div>
                        <div className="text-xs text-slate-600">网络讨论</div>
                    </div>
                    <div className="bg-white/95 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-orange-700">
                            {(industry.githubRepos || []).length}
                        </div>
                        <div className="text-xs text-slate-600">开源项目</div>
                    </div>
                </div>
                {/* 详细指标 */}
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-600">数据来源</span>
                        <div className="flex gap-1 text-xs flex-wrap">
                            <a
                                href={`https://search.brave.com/search?q=${encodeURIComponent(query)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded hover:bg-orange-300 transition"
                            >
                                Brave:{industry.webSources?.brave || 0}
                            </a>
                            <span
                                className="bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded"
                            >
                                SerpAPI:{industry.webSources?.serpapi || 0}
                            </span>
                            <a
                                href={`https://github.com/search?q=${encodeURIComponent(query)}&type=repositories`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-gray-800 text-white px-1.5 py-0.5 rounded hover:bg-gray-700 transition"
                            >
                                GitHub:{industry.githubRepos?.length || 0}
                            </a>
                        </div>
                    </div>
                    {industry.hasOpenSource && (
                        <>
                            <div className="flex justify-between">
                                <span className="text-slate-600">总 Star</span>
                                <span className="font-medium">{totalStars.toLocaleString()} ⭐️</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-600">活跃项目</span>
                                <span className="font-medium text-green-600">{activeCount} 个</span>
                            </div>
                        </>
                    )}
                </div>
                {/* Top 项目 */}
                {(industry.topProjects?.length || 0) > 0 && (
                    <div>
                        <span className="text-xs text-slate-500">热门开源项目</span>
                        <div className="space-y-1.5 mt-1">
                            {industry.topProjects.slice(0, 3).map((project, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between text-xs bg-white/95 px-3 py-2 rounded-lg border border-orange-200"
                                >
                                    <span className="truncate flex-1 font-medium">{project.name}</span>
                                    <span className="text-orange-600 ml-2 flex-shrink-0">
                                        {' '}
                                        {(project.stars || 0).toLocaleString()}⭐️
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

/** 交叉验证详情 */
const CrossValidationSection: React.FC<{
    validation?: DualTrackResult['crossValidation'];
}> = ({ validation }) => {
    if (!validation) return null;
    const academic = getSupportLabel(validation.academicSupport || 'weak');
    const industry = getSupportLabel(validation.industrySupport || 'weak');

    return (
        <section className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                <span>🔬</span>交叉验证分析
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/95 rounded-xl p-4 text-center border border-slate-200">
                    <div className="text-2xl font-bold text-indigo-600">
                        {validation.consistencyScore || 0}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">一致性评分</div>
                </div>
                <div className="bg-white/95 rounded-xl p-4 text-center border border-slate-200">
                    <div className={`text-lg font-bold ${academic.className}`}>{academic.text}</div>
                    <div className="text-xs text-slate-500 mt-1">学术支撑</div>
                </div>
                <div className="bg-white/95 rounded-xl p-4 text-center border border-slate-200">
                    <div className={`text-lg font-bold ${industry.className}`}>{industry.text}</div>
                    <div className="text-xs text-slate-500 mt-1">产业支撑</div>
                </div>
                <div className="bg-white/95 rounded-xl p-4 text-center border border-slate-200">
                    <div
                        className={`text-lg font-bold ${validation.openSourceVerified ? 'text-green-600' : 'text-slate-400'
                            }`}
                    >
                        {validation.openSourceVerified ? '✓' : '✗'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">开源验证</div>
                </div>
            </div>
            {/* 洞察 */}
            {(validation.insights?.length || 0) > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">📊 洞察</h4>
                    <ul className="space-y-1">
                        {(validation.insights || []).map((insight, i) => (
                            <li key={i} className="text-sm text-blue-700">
                                • {insight}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {/* 概念重叠 */}
            {(validation.conceptOverlap?.length || 0) > 0 && (
                <div className="mt-4">
                    <span className="text-sm text-slate-600">学术与产业共识概念</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {(validation.conceptOverlap || []).slice(0, 8).map((concept, i) => (
                            <span
                                key={i}
                                className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full"
                            >
                                {concept}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};

// ==================== 主组件 ====================

export const DualTrackReport: React.FC<Props> = ({ result, query, loading }) => {
    if (loading) return <LoadingState />;

    const academic = result?.academic;
    const industry = result?.industry;
    const crossValidation = result?.crossValidation;

    // APIs sometimes return user's 'credibility' field instead of 'finalCredibility'
    const finalCredibility = result?.finalCredibility || result?.credibility;
    const recommendation = result?.recommendation || '';

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
            {/* 头部 */}
            <header className="border-b border-slate-200 pb-6">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                    <span>🔍</span>
                    <span>七源双轨交叉验证报告</span>
                    <span className="text-slate-300">|</span>
                    <span>{result?.searchTimeMs || 0}ms</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900">&quot;{query}&quot;</h1>
                <p className="text-slate-500 mt-1">
                    基于学术四源（OpenAlex · arXiv · CrossRef · CORE）+ 产业多源（Brave · SerpAPI多引擎 ·
                    GitHub）交叉验证
                </p>
                {/* AI 引擎选择器信息 */}
                {(result as unknown).engineSelection && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                            <span>🧠</span>
                            {(result as unknown).engineSelection.method === 'ai' ? 'AI 智能选择' : '规则引擎'}:
                        </span>
                        {((result as unknown).engineSelection.serpEngines || []).map((engine: string, i: number) => (
                            <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                {engine === 'google' ? '🌐 Google' : engine === 'baidu' ? '🔍 百度' : engine === 'bing' ? '💻 Bing' : engine === 'duckduckgo' ? '🦆 DDG' : engine}
                            </span>
                        ))}
                        {(result as unknown).engineSelection.useScholar && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">🎓 Scholar</span>
                        )}
                        {(result as unknown).engineSelection.useTrends && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">📈 Trends</span>
                        )}
                    </div>
                )}
            </header>

            {/* 可信度仪表盘 */}
            <CredibilityDashboard
                credibility={finalCredibility}
                redFlags={crossValidation?.redFlags || []}
            />

            {/* 双轨对比卡片 */}
            <div className="grid md:grid-cols-2 gap-6">
                <AcademicCard academic={academic} query={query} />
                <IndustryCard industry={industry} query={query} />
            </div>

            {/* 交叉验证详情 */}
            <CrossValidationSection validation={crossValidation} />

            {/* AI 执行摘要 */}
            {((result as unknown).sections || (result as unknown).keyPoints) ? (
                <div className="space-y-6">
                    {/* 学术审查报告 */}
                    {(result as unknown).sections?.academic && (
                        <section className="bg-white/95 rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span>🎓</span>{(result as unknown).sections.academic.title || '学术审查报告'}
                            </h2>
                            <div className="space-y-4">
                                {((result as unknown).sections.academic.subsections || []).map((sub: unknown, i: number) => (
                                    <div key={i} className="bg-slate-50 rounded-xl p-4">
                                        <h3 className="text-md font-semibold text-slate-700 mb-2">{sub.title}</h3>
                                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{sub.content}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 产业审查报告 */}
                    {(result as unknown).sections?.internet && (
                        <section className="bg-white/95 rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span>🌐</span>{(result as unknown).sections.internet.title || '产业审查报告'}
                            </h2>
                            <div className="space-y-4">
                                {((result as unknown).sections.internet.subsections || []).map((sub: unknown, i: number) => (
                                    <div key={i} className="bg-slate-50 rounded-xl p-4">
                                        <h3 className="text-md font-semibold text-slate-700 mb-2">{sub.title}</h3>
                                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{sub.content}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 关键点总结 */}
                    {(result as unknown).keyPoints && (result as unknown).keyPoints.length > 0 && (
                        <section className="bg-white/95 rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span>🔑</span>关键点总结
                            </h2>
                            <ul className="list-disc pl-5 space-y-2">
                                {((result as unknown).keyPoints as string[]).map((point, i) => (
                                    <li key={i} className="text-slate-600 text-sm">{point}</li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* 综合建议 */}
                    {recommendation && (
                        <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-md">
                            <h3 className="font-bold flex items-center gap-2 mb-3 text-lg">
                                <span>💡</span>综合建议
                            </h3>
                            <p className="text-md leading-relaxed opacity-95 whitespace-pre-wrap">{recommendation}</p>
                        </section>
                    )}
                </div>
            ) : (
                /* 退回旧版的建议显示 */
                recommendation && (
                    <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-md">
                        <h3 className="font-bold flex items-center gap-2 mb-3 text-lg">
                            <span>💡</span>综合建议
                        </h3>
                        <p className="text-md leading-relaxed opacity-95 whitespace-pre-wrap">{recommendation}</p>
                    </section>
                )
            )}

            {/* 页脚 - 带来源说明 tooltip 和 7源链接 */}
            <footer className="text-center text-xs text-slate-400 pt-4 border-t border-slate-200">
                <div className="flex justify-center items-center gap-1.5 sm:gap-2 flex-wrap mb-1">
                    <span className="flex items-center gap-1">
                        数据来源：
                        <div className="group relative flex items-center">
                            <Info className="w-3 h-3 text-slate-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-left">
                                <p className="font-medium mb-1">七源数据说明：</p>
                                <ul className="space-y-1 text-slate-300">
                                    <li>• OpenAlex：开放学术图谱</li>
                                    <li>• arXiv：预印本论文库</li>
                                    <li>• CrossRef：学术文献数据库</li>
                                    <li>• CORE：开放获取论文</li>
                                    <li>• Brave：隐私搜索引擎</li>
                                    <li>• SerpAPI：多引擎（Google/百度/Bing/DDG）</li>
                                    <li>• GitHub：开源代码仓库</li>
                                    <li>• Google Scholar：学术论文搜索</li>
                                    <li>• Google Trends：搜索趋势分析</li>
                                </ul>
                            </div>
                        </div>
                    </span>
                    <a href="https://openalex.org" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition">OpenAlex</a>
                    <span>·</span>
                    <a href="https://arxiv.org" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition">arXiv</a>
                    <span>·</span>
                    <a href="https://www.crossref.org" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition">CrossRef</a>
                    <span>·</span>
                    <a href="https://core.ac.uk" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition">CORE</a>
                    <span>·</span>
                    <a href="https://brave.com/search" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition">Brave</a>
                    <span>·</span>
                    <a href="https://www.google.com" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition">Google</a>
                    <span>·</span>
                    <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition">GitHub</a>
                </div>
                <p className="mt-1">
                    生成时间：{new Date().toLocaleString('zh-CN')} · 七源交叉验证 · 开源验证：
                    {crossValidation?.openSourceVerified ? '已验证' : '未验证'}
                </p>
            </footer>
        </div>
    );
};

export default React.memo(DualTrackReport);
