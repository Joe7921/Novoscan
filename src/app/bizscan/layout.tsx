/**
 * Bizscan 子页面布局 — 独立 SEO 元数据
 */
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://novoscan.cn';

export const metadata: Metadata = {
    title: 'Bizscan — AI 商业可行性分析',
    description:
        '5 层 7 Agent 工业级 AI 架构，数十秒输出 BII 商业创新指数和 S/A/B/C/D 评级。含竞品拆解、市场规模估算和可行性深度分析，创业者和投资人的必备工具。',
    openGraph: {
        title: 'Bizscan — AI 商业可行性分析 | Novoscan',
        description: 'AI 驱动的商业想法可行性评估，多维度深度分析，数十秒出报告。',
        url: `${SITE_URL}/bizscan`,
        images: [`${SITE_URL}/og-brand.png`],
    },
    keywords: [
        'AI商业分析', '商业可行性', '创业评估', '市场分析',
        'Bizscan', 'AI商业评估', '竞品分析', '商业模式',
    ],
    alternates: {
        canonical: `${SITE_URL}/bizscan`,
    },
};

export default function BizscanLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {/* SSR 可爬取 SEO 内容 — 对用户不可见 */}
            <div className="sr-only" aria-hidden="false">
                <h1>Bizscan — AI 驱动的商业可行性深度分析</h1>
                <p>
                    Bizscan 是 Novoscan 旗下的 AI 商业可行性分析工具，采用 5 层 7 Agent 工业级架构，
                    数十秒内为你的商业想法生成 BII 商业创新指数和 S/A/B/C/D 评级。
                    覆盖竞品拆解、市场规模估算、商业模式评估、技术可行性分析等核心维度。
                </p>
                <h2>适用场景</h2>
                <ul>
                    <li>创业者验证商业想法可行性</li>
                    <li>投资人快速评估项目价值</li>
                    <li>创业大赛参赛选手优化商业计划书</li>
                    <li>产品经理评估新功能的市场潜力</li>
                    <li>MBA 学生撰写商业分析报告</li>
                </ul>
                <h2>免费商业分析工具</h2>
                <p>
                    Bizscan 提供免费体验机会。未登录用户可免费使用 3 次 AI 商业分析，
                    登录后 Flash 模式无限使用。比传统咨询公司更快、更便宜、更客观。
                </p>
            </div>
            {children}
        </>
    );
}
