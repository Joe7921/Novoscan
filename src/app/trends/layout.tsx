/**
 * 趋势洞察页面 — 独立 SEO 页面
 *
 * 将 TrendingInnovations 做成独立的公开页面，
 * 每日自动更新，成为 SEO 长尾内容入口。
 */
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://novoscan.cn';

export const metadata: Metadata = {
    title: '创新趋势洞察 — AI 实时追踪全球创新动态',
    description:
        '基于 AI 实时分析的全球创新趋势雷达。覆盖工程、科学、医学、社会科学等多个领域，每日自动更新最具创新价值和上升势能的研究方向。',
    keywords: [
        '创新趋势', 'AI趋势分析', '技术前沿', '研究方向',
        '学术动态', '创新雷达', '全球创新', '技术趋势',
    ],
    openGraph: {
        title: '创新趋势洞察 | Novoscan',
        description: 'AI 实时追踪的全球创新趋势，每日更新，覆盖多学科领域。',
        url: `${SITE_URL}/trends`,
        images: [`${SITE_URL}/og-brand.png`],
    },
    alternates: {
        canonical: `${SITE_URL}/trends`,
    },
};

// CollectionPage 结构化数据 — 声明此页面是创新趋势合集
const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '全球创新趋势洞察',
    description: '基于 AI 实时分析的全球创新趋势雷达，覆盖多学科领域，每日自动更新。',
    url: `${SITE_URL}/trends`,
    isPartOf: {
        '@type': 'WebSite',
        name: 'Novoscan',
        url: SITE_URL,
    },
    about: {
        '@type': 'Thing',
        name: '创新趋势',
        description: '全球最新的学术和技术创新研究方向',
    },
};

export default function TrendsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
            />
            {children}
        </>
    );
}
