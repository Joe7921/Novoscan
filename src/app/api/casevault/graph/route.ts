export const dynamic = 'force-dynamic';

/**
 * CaseVault — 行业应用图谱 API
 *
 * GET — 从案例库中聚合生成行业应用图谱数据
 *
 * 查询参数:
 *   - industry: 按行业过滤（可选）
 *   - limit: 每个层级返回的最大数量（默认 20）
 *
 * 成本：零 API 消耗（纯 Supabase 查询）
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@/utils/supabase/server';

// ==================== 图谱数据结构 ====================

interface GraphNode {
    label: string;
    count: number;
    children?: GraphNode[];
}

interface IndustryGraph {
    totalCases: number;
    industries: GraphNode[];
    topCapabilities: GraphNode[];
    topTechnologies: GraphNode[];
    sourceDistribution: GraphNode[];
    maturityDistribution: GraphNode[];
}

// ==================== API 入口 ====================

export async function GET(request: Request) {
    try {
        // 🔒 用户认证
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { success: false, error: '请先登录' },
                { status: 401 }
            );
        }

        const url = new URL(request.url);
        const industry = url.searchParams.get('industry');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

        // 构建基础查询
        let query = supabaseAdmin
            .from('case_library')
            .select('industry, tags, capabilities, technology_stack, source_type, maturity, quality_score');

        if (industry) {
            query = query.eq('industry', industry);
        }

        // 仅查询质量分 >= 30 的案例
        query = query.gte('quality_score', 30);

        const { data: cases, error } = await query;

        if (error) {
            console.error('[CaseVault/Graph] 查询失败:', error.message);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        if (!cases || cases.length === 0) {
            return NextResponse.json({
                success: true,
                graph: {
                    totalCases: 0,
                    industries: [],
                    topCapabilities: [],
                    topTechnologies: [],
                    sourceDistribution: [],
                    maturityDistribution: [],
                } as IndustryGraph,
            });
        }

        // ===== 聚合统计 =====
        const industryMap = new Map<string, number>();
        const capabilityMap = new Map<string, number>();
        const technologyMap = new Map<string, number>();
        const sourceMap = new Map<string, number>();
        const maturityMap = new Map<string, number>();

        for (const c of cases) {
            // 行业
            industryMap.set(c.industry, (industryMap.get(c.industry) || 0) + 1);

            // 能力点
            if (Array.isArray(c.capabilities)) {
                for (const cap of c.capabilities) {
                    capabilityMap.set(cap, (capabilityMap.get(cap) || 0) + 1);
                }
            }

            // 技术栈
            if (Array.isArray(c.technology_stack)) {
                for (const tech of c.technology_stack) {
                    technologyMap.set(tech, (technologyMap.get(tech) || 0) + 1);
                }
            }

            // 来源分布
            sourceMap.set(c.source_type, (sourceMap.get(c.source_type) || 0) + 1);

            // 成熟度分布
            maturityMap.set(c.maturity, (maturityMap.get(c.maturity) || 0) + 1);
        }

        // 转为排序后的数组
        const toSortedNodes = (map: Map<string, number>, maxCount: number): GraphNode[] => {
            return Array.from(map.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, maxCount)
                .map(([label, count]) => ({ label, count }));
        };

        const graph: IndustryGraph = {
            totalCases: cases.length,
            industries: toSortedNodes(industryMap, limit),
            topCapabilities: toSortedNodes(capabilityMap, limit),
            topTechnologies: toSortedNodes(technologyMap, limit),
            sourceDistribution: toSortedNodes(sourceMap, 10),
            maturityDistribution: toSortedNodes(maturityMap, 10),
        };

        return NextResponse.json({ success: true, graph });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[CaseVault/Graph] 错误:', msg);
        return NextResponse.json(
            { success: false, error: msg },
            { status: 500 }
        );
    }
}
