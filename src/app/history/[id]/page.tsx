'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Navbar from '@/components/layout/Navbar';
import BottomTabBar from '@/components/layout/BottomTabBar';
import { ArrowLeft } from 'lucide-react';
import { db } from '@/lib/db';

// 复用主页的报告渲染组件（懒加载）
const AnalysisView = dynamic(() => import('@/components/analysis'), {
    ssr: false,
    loading: () => (
        <div className="w-full max-w-5xl mx-auto mt-8 animate-pulse">
            <div className="grid md:grid-cols-2 gap-6 mb-6">
                {[0, 1].map(i => (
                    <div key={i} className="bg-white/95 rounded-2xl border border-slate-200 p-6 h-48" />
                ))}
            </div>
            <div className="bg-gradient-to-r from-indigo-200/40 via-purple-200/40 to-violet-200/40 rounded-2xl p-6 mb-6 h-32" />
        </div>
    ),
});

/**
 * 将服务端返回的 result 构建为 AnalysisView 需要的 report 结构
 * 与 HomeClient 的构建逻辑保持一致
 */
function buildReportFromResult(result: any) {
    const ai = result.aiAnalysis || {};
    const webSources = (result.industry?.webResults || []).slice(0, 4).map((w: any) => ({
        title: w.title || 'Web Result',
        url: w.url || '#',
        summary: w.snippet || w.description || '',
        type: 'News' as const
    }));
    const ghSources = (result.industry?.githubRepos || []).slice(0, 3).map((r: any) => ({
        title: r.name || 'GitHub Project',
        url: r.url || `https://github.com/${r.fullName || r.name || ''}`,
        summary: r.description || `⭐ ${r.stars || 0} stars`,
        type: 'Github' as const
    }));
    const builtInternetSources = [...webSources, ...ghSources];

    return {
        noveltyScore: result.arbitration?.overallScore || result.noveltyScore || ai.noveltyScore || result.finalCredibility?.score || 0,
        internetNoveltyScore: result.industryAnalysis?.score || result.arbitration?.weightedBreakdown?.industry?.raw || ai.internetNoveltyScore || 0,
        practicalScore: result.practicalScore || null,
        noveltyLevel: result.finalCredibility?.level === 'high' ? 'High' : result.finalCredibility?.level === 'medium' ? 'Medium' : 'Low',
        summary: ai.summary || result.arbitration?.summary || result.summary || result.recommendation || '',
        marketPotential: result.recommendation || '',
        technicalFeasibility: result.recommendation || '',
        keyInnovations: result.academic?.results?.slice(0, 5).map((r: any) => r.title) || [],
        challenges: result.crossValidation?.redFlags || [],
        futureDirections: [],
        suggestions: [],
        similarWorks: result.academic?.results || [],
        dualTrackResult: result,
        similarPapers: ai.similarPapers || result.similarPapers || [],
        internetSources: builtInternetSources.length > 0 ? builtInternetSources : (ai.internetSources || []),
        keyDifferentiators: ai.keyDifferentiators || result.keyDifferentiators || '',
        improvementSuggestions: ai.improvementSuggestions || result.improvementSuggestions || '',
        sections: ai.sections || result.sections || null,
        usedModel: result.usedModel,
        fromCache: true,
        isPartial: result.isPartial || ai.isPartial || false,
        academicReview: result.academicReview || null,
        industryAnalysis: result.industryAnalysis || null,
        innovationEvaluation: result.innovationEvaluation || null,
        competitorAnalysis: result.competitorAnalysis || null,
        arbitration: result.arbitration || null,
        qualityCheck: result.qualityCheck || null,
        innovationRadar: result.innovationRadar || result.innovationEvaluation?.innovationRadar || null,
        debate: result.debate || null,
        innovationDNA: result.innovationDNA || null,
        crossDomainTransfer: result.crossDomainTransfer || null,
        memoryInsight: result.memoryInsight || null,
    };
}

/**
 * 搜索历史报告详情页
 *
 * 优先从 IndexedDB 缓存读取报告，未命中时再请求 API。
 * 首次加载后将报告写入缓存，下次访问即可秒开。
 */
export default function HistoryDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<any>(null);
    const [dualResult, setDualResult] = useState<any>(null);
    const [query, setQuery] = useState('');
    const [fromCache, setFromCache] = useState(false);

    useEffect(() => {
        if (!id) return;

        async function loadRecord() {
            setLoading(true);
            setError(null);

            // 1. 优先尝试从 IndexedDB 缓存读取
            try {
                if (db.historyReportCache) {
                    const cached = await db.historyReportCache.get(id);
                    if (cached) {
                        console.log('[HistoryDetail] 命中 IndexedDB 缓存:', id);
                        setQuery(cached.query);
                        setDualResult(cached.result);
                        setReport(buildReportFromResult(cached.result));
                        setFromCache(true);
                        setLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.warn('[HistoryDetail] 缓存读取失败，降级为 API 请求');
            }

            // 2. 缓存未命中，请求 API
            try {
                const res = await fetch(`/api/history/${id}`);
                const json = await res.json();

                if (!json.success) {
                    setError(json.error || '加载失败');
                    setLoading(false);
                    return;
                }

                const record = json.record;
                const result = record.result;
                setQuery(record.query);

                if (!result || result.success === false) {
                    setError('该记录为失败/异常记录，无法查看报告');
                    setLoading(false);
                    return;
                }

                setDualResult(result);
                setReport(buildReportFromResult(result));
                setLoading(false);

                // 3. 写入 IndexedDB 缓存
                try {
                    if (db.historyReportCache) {
                        await db.historyReportCache.put({
                            historyId: id,
                            query: record.query,
                            result,
                            cachedAt: Date.now(),
                        });
                        console.log('[HistoryDetail] 报告已写入 IndexedDB 缓存:', id);
                    }
                } catch (e) {
                    console.warn('[HistoryDetail] 缓存写入失败（不影响主流程）');
                }
            } catch (e: any) {
                setError(e.message || '网络错误');
                setLoading(false);
            }
        }

        loadRecord();
    }, [id]);

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-20 lg:pb-0">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-24">
                {/* 顶部导航 */}
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={() => router.push('/history')}
                        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                        <ArrowLeft size={18} />
                        返回搜索历史
                    </button>
                    {fromCache && (
                        <span className="text-[11px] bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full font-medium border border-emerald-200">
                            ⚡ 本地缓存
                        </span>
                    )}
                </div>

                {/* 查询标题 */}
                {query && (
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6 break-words">
                        {query}
                    </h1>
                )}

                {/* 加载状态 */}
                {loading && (
                    <div className="text-center py-20 text-slate-500">
                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                        加载报告中...
                    </div>
                )}

                {/* 错误状态 */}
                {error && !loading && (
                    <div className="text-center py-20">
                        <div className="text-4xl mb-4">😞</div>
                        <p className="text-slate-600 font-medium">{error}</p>
                        <button
                            onClick={() => router.push('/history')}
                            className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
                        >
                            返回历史列表
                        </button>
                    </div>
                )}

                {/* 报告内容 */}
                {!loading && !error && report && (
                    <AnalysisView
                        report={report}
                        onReset={() => router.push('/history')}
                        language="zh"
                        query={query}
                        dualResult={dualResult}
                    />
                )}
            </div>

            <BottomTabBar />
        </div>
    );
}
