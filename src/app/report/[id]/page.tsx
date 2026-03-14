import { Metadata } from 'next';
import { getPublicReport } from '@/lib/services/export/shareService';
import PublicReportClient from './PublicReportClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
    params: { id: string };
}

// 动态生成 Meta 标签
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const reportId = params.id;
    const report = await getPublicReport(reportId);

    if (!report) {
        return {
            title: '报告未找到 | Novoscan',
            description: '该报告不存在或已被删除。',
        };
    }

    const title = 'Novoscan AI 创新评估报告';
    const description = report.idea_summary || '来自 Novoscan 的多智能体创新深度评估报告。';
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://novoscan.cn';
    
    // 指向新的 OG 图片生成 API
    const ogImageUrl = `${baseUrl}/api/og/${reportId}`;

    return {
        title: title,
        description: description,
        openGraph: {
            title: title,
            description: description,
            url: `${baseUrl}/report/${reportId}`,
            siteName: 'Novoscan',
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: 'Novoscan 分析报告',
                },
            ],
            type: 'website',
        },
        twitter: {
            card: 'summary_large_image',
            title: title,
            description: description,
            images: [ogImageUrl],
        },
    };
}

// Server Component：拉取数据并渲染 Client 组件
export default async function PublicReportPage({ params }: Props) {
    const reportId = params.id;
    const report = await getPublicReport(reportId);

    if (!report) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center p-8 bg-slate-800/50 rounded-2xl border border-white/10">
                    <h2 className="text-xl font-bold text-white mb-2">报告未找到</h2>
                    <p className="text-slate-400 text-sm">该分析报告不存在或已被删除</p>
                </div>
            </div>
        );
    }

    // 将数据库的结构转换为前端友好的结构传递
    const publicData = {
        id: report.id,
        ideaSummary: report.idea_summary,
        overallScore: report.overall_score,
        noveltyLevel: report.novelty_level,
        keyFinding: report.key_finding || '',
        createdAt: report.created_at,
        viewCount: report.view_count,
        reportType: report.report_type,
        // 这里取出原始 JSON 数据 (含 雷达图 / 评分拆解 等)
        reportJson: report.report_json,
    };

    return <PublicReportClient data={publicData} />;
}
