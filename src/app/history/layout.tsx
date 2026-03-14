/**
 * 搜索历史子页面布局 — 独立 SEO 元数据
 *
 * 历史记录是用户私有数据，不应被搜索引擎索引，
 * 但允许爬虫跟踪页面内链接。
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '搜索历史 — 我的分析记录',
    description:
        '查看和管理你在 Novoscan 平台上进行的所有创新分析历史记录，包含论文检索数、推荐数和耗时统计。',
    robots: {
        index: false,
        follow: true,
    },
};

export default function HistoryLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
