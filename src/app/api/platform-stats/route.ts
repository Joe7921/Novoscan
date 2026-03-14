import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // ISR: 5 分钟重新生成

/**
 * 公开平台统计端点 — 无需鉴权
 * 返回三个核心指标供首页 HighlightShowcase 展示：
 *   - totalAnalyses: 深度分析总次数 (search_history)
 *   - totalDebates:  辩论推演次数 (agent_experiences where debate_summary 非空)
 *   - totalDNA:      创新基因入库数 (innovation_dna)
 *
 * 服务端内存缓存 60 秒，避免频繁查询数据库。
 */

// ────────── 内存缓存 ──────────
interface StatsCache {
    data: { totalAnalyses: number; totalDebates: number; totalDNA: number };
    expiresAt: number;
}
let statsCache: StatsCache | null = null;
const CACHE_TTL_MS = 60_000; // 60 秒

export async function GET() {
    try {
        const now = Date.now();

        // 命中缓存
        if (statsCache && now < statsCache.expiresAt) {
            return NextResponse.json(statsCache.data, {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
                },
            });
        }

        // 并行查询三个统计值
        const [analysesRes, debatesRes, dnaRes] = await Promise.all([
            // 1. 深度分析总数
            supabaseAdmin
                .from('search_history')
                .select('*', { count: 'exact', head: true }),
            // 2. 辩论推演次数（debate_summary 非空的记录数）
            supabaseAdmin
                .from('agent_experiences')
                .select('*', { count: 'exact', head: true })
                .neq('debate_summary', ''),
            // 3. 创新基因入库数
            supabaseAdmin
                .from('innovation_dna')
                .select('*', { count: 'exact', head: true }),
        ]);

        const totalAnalyses = analysesRes.count ?? 0;
        const totalDebates = debatesRes.count ?? 0;
        const totalDNA = dnaRes.count ?? 0;

        const data = { totalAnalyses, totalDebates, totalDNA };

        // 写入缓存
        statsCache = { data, expiresAt: now + CACHE_TTL_MS };

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error: unknown) {
        console.error('[Platform Stats API] 查询失败:', error);
        return NextResponse.json(
            { totalAnalyses: 0, totalDebates: 0, totalDNA: 0 },
            { status: 500 }
        );
    }
}
