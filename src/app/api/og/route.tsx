export const dynamic = 'force-dynamic';

/**
 * GET /api/og — 动态 Open Graph 图片生成
 *
 * 使用 Next.js 内置的 ImageResponse 在边缘渲染精美的社交分享海报。
 * 支持参数：
 *   ?title=想法摘要
 *   &score=85
 *   &type=novoscan|bizscan|clawscan|flash
 *   &level=High|Medium|Low
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// 加载中文字体 — Edge Runtime 下 ImageResponse 必须显式提供字体数据才能渲染 CJK 字符
const fontUrl = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@700;900&display=swap';

async function loadFont(): Promise<ArrayBuffer> {
    // 从 Google Fonts CSS 中提取实际字体文件 URL
    const css = await fetch(fontUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; en-us)' },
    }).then(r => r.text());
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('(opentype|truetype|woff2?)'\)/);
    if (!match) throw new Error('无法解析字体 URL');
    return fetch(match[1]).then(r => r.arrayBuffer());
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    const title = searchParams.get('title') || 'Novoscan AI 创新分析';
    const score = parseInt(searchParams.get('score') || '0', 10);
    const type = searchParams.get('type') || 'novoscan';
    const level = searchParams.get('level') || 'Medium';

    // 加载中文字体
    let fontData: ArrayBuffer | null = null;
    try {
        fontData = await loadFont();
    } catch {
        // 字体加载失败时降级使用系统默认字体
    }

    // 类型配置
    const typeLabels: Record<string, { label: string; emoji: string; gradient: string[] }> = {
        novoscan: { label: 'Novoscan 深度分析', emoji: '🔬', gradient: ['#3b82f6', '#8b5cf6'] },
        flash: { label: 'Flash 极速分析', emoji: '⚡', gradient: ['#f59e0b', '#ef4444'] },
        bizscan: { label: 'Bizscan 商业分析', emoji: '📊', gradient: ['#8b5cf6', '#a855f7'] },
        clawscan: { label: 'Clawscan 创新查重', emoji: '🛡️', gradient: ['#10b981', '#14b8a6'] },
    };

    const typeInfo = typeLabels[type] || typeLabels.novoscan;

    // 评分颜色
    const getScoreColor = (s: number) => {
        if (s >= 80) return '#10b981';
        if (s >= 60) return '#3b82f6';
        if (s >= 40) return '#f59e0b';
        return '#ef4444';
    };

    const levelInfo: Record<string, { text: string; color: string }> = {
        High: { text: '🟢 高创新性', color: '#10b981' },
        Medium: { text: '🟡 中等创新性', color: '#f59e0b' },
        Low: { text: '🔴 低创新性', color: '#ef4444' },
    };

    const levelData = levelInfo[level] || levelInfo.Medium;

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    background: `linear-gradient(135deg, ${typeInfo.gradient[0]}15, #ffffff, ${typeInfo.gradient[1]}10)`,
                    padding: '60px',
                    fontFamily: '"Noto Sans SC", sans-serif',
                    position: 'relative',
                }}
            >
                {/* 装饰圆形 */}
                <div
                    style={{
                        position: 'absolute',
                        top: '-80px',
                        right: '-80px',
                        width: '300px',
                        height: '300px',
                        borderRadius: '50%',
                        background: `${typeInfo.gradient[0]}15`,
                        display: 'flex',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: '-60px',
                        left: '-60px',
                        width: '200px',
                        height: '200px',
                        borderRadius: '50%',
                        background: `${typeInfo.gradient[1]}10`,
                        display: 'flex',
                    }}
                />

                {/* 顶部品牌 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
                    <span style={{ fontSize: '28px' }}>✨</span>
                    <span style={{ fontSize: '28px', fontWeight: 900, color: '#1e293b' }}>
                        Novoscan
                    </span>
                    <span
                        style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: 'white',
                            background: `linear-gradient(135deg, ${typeInfo.gradient[0]}, ${typeInfo.gradient[1]})`,
                            padding: '4px 14px',
                            borderRadius: '50px',
                        }}
                    >
                        {typeInfo.emoji} {typeInfo.label}
                    </span>
                </div>

                {/* 想法标题 */}
                <div
                    style={{
                        fontSize: title.length > 30 ? '36px' : '44px',
                        fontWeight: 900,
                        color: '#0f172a',
                        lineHeight: 1.3,
                        marginBottom: '40px',
                        maxWidth: '800px',
                        display: 'flex',
                    }}
                >
                    {title.length > 60 ? title.slice(0, 60) + '...' : title}
                </div>

                {/* 底部评分区 */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '40px',
                        marginTop: 'auto',
                    }}
                >
                    {/* 评分圆环 */}
                    {score > 0 && (
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            <div
                                style={{
                                    width: '100px',
                                    height: '100px',
                                    borderRadius: '50%',
                                    border: `6px solid ${getScoreColor(score)}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'column',
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: '36px',
                                        fontWeight: 900,
                                        color: getScoreColor(score),
                                        lineHeight: 1,
                                    }}
                                >
                                    {score}
                                </span>
                            </div>
                            <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 700 }}>
                                创新评分
                            </span>
                        </div>
                    )}

                    {/* 创新等级 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span
                            style={{
                                fontSize: '18px',
                                fontWeight: 700,
                                color: levelData.color,
                            }}
                        >
                            {levelData.text}
                        </span>
                        <span style={{ fontSize: '14px', color: '#94a3b8' }}>
                            由 AI 多智能体协作分析生成
                        </span>
                    </div>

                    {/* 右侧 CTA */}
                    <div
                        style={{
                            marginLeft: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: `linear-gradient(135deg, ${typeInfo.gradient[0]}, ${typeInfo.gradient[1]})`,
                            color: 'white',
                            padding: '12px 28px',
                            borderRadius: '50px',
                            fontSize: '16px',
                            fontWeight: 700,
                        }}
                    >
                        查看完整报告 →
                    </div>
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
            ...(fontData && {
                fonts: [
                    {
                        name: 'Noto Sans SC',
                        data: fontData,
                        weight: 700 as const,
                        style: 'normal' as const,
                    },
                ],
            }),
        }
    );
}
