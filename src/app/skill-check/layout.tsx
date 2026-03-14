/**
 * Clawscan (Skill-check) 子页面布局 — 独立 SEO 元数据
 */
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://novoscan.cn';

export const metadata: Metadata = {
    title: 'Clawscan — AI 创新查重与评估 | OpenClaw 生态 Skill 查重',
    description:
        '接入 OpenClaw ClawHub Registry 全量 Skill 数据，三路并行采集 + 4 Agent 评估，精准定位创新盲区。输出 Skill 匹配清单和落地实战案例分析，OpenClaw 开发者和 AI Agent 开发者的必备工具。',
    openGraph: {
        title: 'Clawscan — AI 创新查重与评估 | Novoscan',
        description: 'AI 驱动的创新查重工具，多数据源对比分析，快速评估创新独创性。',
        url: `${SITE_URL}/skill-check`,
        images: [`${SITE_URL}/og-brand.png`],
    },
    keywords: [
        'AI查重', '创新查重', 'Skill查重', 'Clawscan',
        'OpenClaw', 'OpenClaw Skill', 'OpenClaw 查重', 'ClawHub',
        'AI Agent', 'AI评估', '创新性评估', '专利查新',
        'OpenClaw 开发者', 'Skill 查重工具', 'Agent 查重',
        'openclaw skill search', 'clawhub registry',
    ],
    alternates: {
        canonical: `${SITE_URL}/skill-check`,
    },
};

export default function SkillCheckLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {/* SSR 可爬取 SEO 内容 — 对用户不可见 */}
            <div className="sr-only" aria-hidden="false">
                <h1>Clawscan — AI 创新查重与原创性评估 | OpenClaw 生态</h1>
                <p>
                    Clawscan 是专为 OpenClaw 生态打造的 AI 创新查重工具。直接接入 ClawHub Registry 全量 Skill 数据，
                    三路并行采集 + 4 Agent 协作评估，数十秒内告诉你：你的 Skill 创意是否已有人实现、
                    还有多少创新空间、同类竞品有哪些。无论你是 OpenClaw 开发者、AI Agent 创作者，
                    还是想查重学术论文创新性的研究者，Clawscan 都是你的必备工具。
                </p>

                <h2>OpenClaw 用户为什么需要 Clawscan？</h2>
                <p>
                    在 OpenClaw 生态中发布 Skill 之前，你需要知道：这个 Skill 是否已经有人做过？
                    ClawHub 上有没有类似的实现？你的方案有什么独特之处？
                    Clawscan 能在数十秒内回答这些问题，帮你避免重复造轮子，找到真正的创新方向。
                    支持 OpenClaw Skill、GitHub 项目、学术论文三源交叉查重。
                </p>

                <h2>创新查重 vs 论文查重</h2>
                <p>
                    论文查重（知网查重、维普查重、万方查重）检测的是文字重复率，告诉你"有多少内容和别人一样"。
                    创新查重（Clawscan）检测的是想法新颖度，告诉你"这个方向有没有人做过、还有多少创新空间"。
                    两者互补，建议先用 Clawscan 确认选题创新性，再用知网检查文字查重。
                </p>

                <h2>免费创新查重工具</h2>
                <p>
                    Clawscan 提供免费体验：未登录用户 3 次免费查重，登录后 Flash 模式无限免费使用，
                    10 秒出结果。适用于 OpenClaw Skill 查重、毕业论文选题查新、专利申请前调研、创业想法验证等场景。
                </p>
            </div>
            {children}
        </>
    );
}
