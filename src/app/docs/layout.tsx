/**
 * 文档页面布局 — 独立 SEO 元数据 + FAQ JSON-LD
 *
 * 文档页包含大量技术内容，是 SEO 长尾关键词的核心入口。
 * 添加 FAQPage 结构化数据以在 Google 搜索结果中展示 FAQ 富文本片段。
 */
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://novoscan.cn';

export const metadata: Metadata = {
    title: 'Novoscan 官方文档 — 多智能体 AI 创新评估技术指南',
    description:
        '深入了解 Novoscan 的多代理架构、七源双轨检索引擎、NovoStarchart 评分体系、NovoDNA 基因图谱等核心技术。覆盖 Novoscan、Clawscan、Bizscan 三大业务线的完整产品文档。',
    keywords: [
        'Novoscan文档', '多智能体架构', 'AI创新评估', 'NovoStarchart',
        'NovoDNA', 'NovoDebate', 'Bizscan', 'Clawscan',
        'AI查重', '创新性分析', '技术评估文档',
    ],
    openGraph: {
        title: 'Novoscan 官方文档 — 多智能体 AI 创新评估技术指南',
        description: '涵盖 Novoscan 全平台的技术架构、产品功能和使用指南。',
        url: `${SITE_URL}/docs`,
        images: [`${SITE_URL}/og-brand.png`],
    },
    alternates: {
        canonical: `${SITE_URL}/docs`,
    },
};

// FAQ 结构化数据 — 映射文档中的常见问题章节
const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: '什么是 Novoscan？',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Novoscan 是基于多智能体（Multi-Agent）架构的创新性分析品牌。它整合了三条垂直业务线——Novoscan（学术+产业创新查重）、Clawscan（Skill 查重）、Bizscan（商业想法评估），覆盖从学术查新到商业验证的完整创新评估闭环。',
            },
        },
        {
            '@type': 'Question',
            name: 'Novoscan 的分析需要多长时间？',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '标准模式 60-120 秒内完成完整的多 Agent 深度分析。Flash 极速模式仅需 10-20 秒即可获得精简版报告。',
            },
        },
        {
            '@type': 'Question',
            name: 'Novoscan 支持哪些数据源？',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Novoscan 采用七源双轨并行检索：学术轨道覆盖 OpenAlex（2.5亿+学术作品）、arXiv、CrossRef（1.4亿+元数据）、CORE（2亿+全文）；产业轨道覆盖 Brave Search、SerpAPI、GitHub API。',
            },
        },
        {
            '@type': 'Question',
            name: '隐私检索模式如何保护我的数据？',
            acceptedAnswer: {
                '@type': 'Answer',
                text: '开启隐私检索后，本次分析的所有数据不会被持久化到任何数据库——不保存搜索历史、不更新用户偏好、不写入创新趋势、不触发 Agent 记忆进化。分析结果仅存在于当前浏览器会话中。',
            },
        },
        {
            '@type': 'Question',
            name: 'Novoscan 是免费的吗？',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Novoscan 开源版所有功能完全免费使用，包括标准模式和 Flash 极速模式，无需任何积分或付费。',
            },
        },
    ],
};

export default function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />
            {children}
        </>
    );
}
