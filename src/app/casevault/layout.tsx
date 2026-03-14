/**
 * CaseVault 子页面布局 — 独立 SEO 元数据
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'CaseVault — AI 行业应用图谱',
    description:
        '可视化展示 OpenClaw/MCP/AI Agent 实战案例库的行业分布、核心能力、技术栈和成熟度分布。探索 AI 在各行业的真实落地案例。',
    openGraph: {
        title: 'CaseVault — AI 行业应用图谱 | Novoscan',
        description: 'AI Agent 实战案例生态分布图谱，覆盖多个行业和技术栈。',
    },
};

export default function CaseVaultLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
