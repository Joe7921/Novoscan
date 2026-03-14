/**
 * 跨域知识图谱服务（Cross-Domain Knowledge Graph Service）
 *
 * 职责：
 * 1. 将跨域侦察兵发现的桥梁持久化到 Supabase
 * 2. 查询历史桥梁，为新查询提供已有的跨域知识
 * 3. 与 NovoDNA 基因库联动，发现"技术原理相近但应用场景差异大"的创新邻居
 */

import { supabaseAdmin } from '@/lib/supabase';
import { generateQueryHash } from './innovationService';
import type { CrossDomainBridge, KnowledgeGraphNode, KnowledgeGraphEdge } from '@/agents/types';

// ==================== 类型定义 ====================

/** Supabase 存储的跨域桥梁记录 */
export interface StoredBridgeRecord {
    id: number;
    query: string;
    query_hash: string;
    source_field: string;
    target_field: string;
    tech_principle: string;
    novelty_potential: number;
    bridge_data: CrossDomainBridge;
    created_at: string;
}

// ==================== 核心函数 ====================

/**
 * 将跨域桥梁存入 Supabase cross_domain_bridges 表
 */
export async function storeCrossDomainBridges(
    query: string,
    bridges: CrossDomainBridge[],
    knowledgeGraph?: { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }
): Promise<void> {
    if (!bridges || bridges.length === 0) return;

    try {
        const queryHash = await generateQueryHash(query);

        // 批量插入桥梁
        const rows = bridges.map(bridge => ({
            query,
            query_hash: queryHash,
            source_field: bridge.sourceField,
            target_field: bridge.targetField,
            tech_principle: bridge.techPrinciple,
            novelty_potential: bridge.noveltyPotential,
            bridge_data: bridge,
            knowledge_graph: knowledgeGraph || null,
        }));

        const { error } = await supabaseAdmin
            .from('cross_domain_bridges')
            .upsert(rows, { onConflict: 'query_hash,target_field' });

        if (error) {
            console.warn('[CrossDomainService] 存储桥梁失败:', error.message);
        } else {
            console.log(`[CrossDomainService] ✅ ${bridges.length} 条跨域桥梁已存储`);
        }
    } catch (err: any) {
        console.error('[CrossDomainService] 存储异常:', err.message);
    }
}

/**
 * 查询已存在的相关跨域桥梁
 * 根据技术原理关键词模糊匹配
 */
export async function findExistingBridges(
    techPrincipleKeywords: string[],
    limit: number = 10
): Promise<StoredBridgeRecord[]> {
    try {
        if (!techPrincipleKeywords || techPrincipleKeywords.length === 0) return [];

        // 使用 OR 条件模糊匹配技术原理
        let query = supabaseAdmin
            .from('cross_domain_bridges')
            .select('*')
            .order('novelty_potential', { ascending: false })
            .limit(limit);

        // 对每个关键词做 ilike 模糊匹配
        const orConditions = techPrincipleKeywords
            .slice(0, 5)
            .map(kw => `tech_principle.ilike.%${kw}%`)
            .join(',');

        query = query.or(orConditions);

        const { data, error } = await query;

        if (error) {
            console.warn('[CrossDomainService] 查询历史桥梁失败:', error.message);
            return [];
        }

        return (data || []) as StoredBridgeRecord[];
    } catch (err: any) {
        console.error('[CrossDomainService] 查询异常:', err.message);
        return [];
    }
}

/**
 * 与 NovoDNA 基因库联动 —— 查找"技术原理相近但应用场景差异大"的邻居
 * 这些邻居天然就是跨域迁移的候选对象
 */
export async function findCrossDomainDNANeighbors(
    techPrincipleValue: number,
    appScenarioValue: number,
    limit: number = 5
): Promise<Array<{ query: string; techSimilarity: number; scenarioDifference: number }>> {
    try {
        const { data, error } = await supabaseAdmin
            .from('innovation_dna')
            .select('query, tech_principle, app_scenario')
            .limit(200);

        if (error || !data || data.length === 0) return [];

        // 找到 techPrinciple 相近但 appScenario 差异大的邻居
        const candidates = data
            .map(row => ({
                query: row.query,
                techSimilarity: 1 - Math.abs(row.tech_principle - techPrincipleValue),
                scenarioDifference: Math.abs(row.app_scenario - appScenarioValue),
            }))
            // techSimilarity 高且 scenarioDifference 大的最有价值
            .filter(c => c.techSimilarity > 0.6 && c.scenarioDifference > 0.3)
            .sort((a, b) => {
                // 综合评分：相似度 * 差异度
                const scoreA = a.techSimilarity * a.scenarioDifference;
                const scoreB = b.techSimilarity * b.scenarioDifference;
                return scoreB - scoreA;
            })
            .slice(0, limit);

        return candidates;
    } catch (err: any) {
        console.error('[CrossDomainService] DNA 联动查询失败:', err.message);
        return [];
    }
}

/**
 * 从历史跨域桥梁构建更大范围的知识图谱
 * 用于在前端展示全局跨域知识网络
 */
export async function buildGlobalCrossFieldGraph(
    limit: number = 50
): Promise<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }> {
    try {
        const { data, error } = await supabaseAdmin
            .from('cross_domain_bridges')
            .select('source_field, target_field, tech_principle, novelty_potential')
            .order('novelty_potential', { ascending: false })
            .limit(limit);

        if (error || !data || data.length === 0) {
            return { nodes: [], edges: [] };
        }

        const nodeMap = new Map<string, KnowledgeGraphNode>();
        const edges: KnowledgeGraphEdge[] = [];

        for (const row of data) {
            // 源领域节点
            const sourceId = `field_${row.source_field.replace(/\s/g, '_')}`;
            if (!nodeMap.has(sourceId)) {
                nodeMap.set(sourceId, {
                    id: sourceId,
                    label: row.source_field,
                    field: row.source_field,
                    type: 'application',
                });
            }

            // 目标领域节点
            const targetId = `field_${row.target_field.replace(/\s/g, '_')}`;
            if (!nodeMap.has(targetId)) {
                nodeMap.set(targetId, {
                    id: targetId,
                    label: row.target_field,
                    field: row.target_field,
                    type: 'application',
                });
            }

            // 技术原理节点
            const principleId = `principle_${row.tech_principle.slice(0, 20).replace(/\s/g, '_')}`;
            if (!nodeMap.has(principleId)) {
                nodeMap.set(principleId, {
                    id: principleId,
                    label: row.tech_principle,
                    field: '通用',
                    type: 'principle',
                });
            }

            // 连接边
            edges.push({
                source: sourceId,
                target: principleId,
                relation: 'same_principle',
                strength: (row.novelty_potential || 50) / 100,
            });
            edges.push({
                source: principleId,
                target: targetId,
                relation: 'inspires',
                strength: (row.novelty_potential || 50) / 100,
            });
        }

        return {
            nodes: Array.from(nodeMap.values()),
            edges,
        };
    } catch (err: any) {
        console.error('[CrossDomainService] 全局图谱构建失败:', err.message);
        return { nodes: [], edges: [] };
    }
}

/**
 * 合并多个知识图谱（去重节点、合并边）
 * 用于将当次分析的局部图谱与数据库中的全局历史图谱合并
 */
export function mergeKnowledgeGraphs(
    ...graphs: Array<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] }>
): { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } {
    const nodeMap = new Map<string, KnowledgeGraphNode>();
    const edgeMap = new Map<string, KnowledgeGraphEdge>();

    for (const graph of graphs) {
        if (!graph) continue;

        // 合并节点（按 id 去重，后来的覆盖前者）
        for (const node of (graph.nodes || [])) {
            if (node && node.id) {
                nodeMap.set(node.id, node);
            }
        }

        // 合并边（按 source+target+relation 去重，取最大 strength）
        for (const edge of (graph.edges || [])) {
            if (edge && edge.source && edge.target) {
                const key = `${edge.source}__${edge.target}__${edge.relation}`;
                const existing = edgeMap.get(key);
                if (!existing || edge.strength > existing.strength) {
                    edgeMap.set(key, edge);
                }
            }
        }
    }

    return {
        nodes: Array.from(nodeMap.values()),
        edges: Array.from(edgeMap.values()),
    };
}

