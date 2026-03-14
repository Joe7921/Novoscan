/**
 * Tracker 子页面布局 — 独立 SEO 元数据
 */
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://novoscan.cn';

export const metadata: Metadata = {
    title: 'NovoTracker — 创新趋势监控',
    description:
        '设置关键词订阅，自动追踪创新领域的最新动态。第一时间掌握学术论文和产业趋势变化，科研基金申请和技术战略规划的高效助手。',
    openGraph: {
        title: 'NovoTracker — 创新趋势监控 | Novoscan',
        description: '自动追踪创新趋势，定期扫描最新学术论文和行业动态。',
        url: `${SITE_URL}/tracker`,
        images: [`${SITE_URL}/og-brand.png`],
    },
    keywords: [
        '创新监控', '趋势追踪', 'NovoTracker', '学术动态',
        'AI监控', '技术趋势', '创新趋势', '定期扫描',
    ],
    alternates: {
        canonical: `${SITE_URL}/tracker`,
    },
};

export default function TrackerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
