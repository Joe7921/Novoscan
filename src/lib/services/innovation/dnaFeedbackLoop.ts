/**
 * NovoDNA 双向进化引擎（Bidirectional Evolution Engine）
 *
 * 方向一：搜索 → DNA（已有：搜索完成后提取向量存入基因库）
 * 方向二：DNA → 搜索（本模块）：
 *   1. preScanDNAInsight     — 搜索前快速洞察，发现基因库中的相似存量
 *   2. generateDNAEnhancedKeywords — 基于邻居差异的增强搜索关键词
 *   3. postSearchDNARanking  — 搜索后基因加权修正评分
 *   4. evolutionaryFeedback  — 进化反馈：用搜索结果反向修正 DNA 精度
 */

import { supabaseAdmin } from '@/lib/supabase';
import {
    DNAVector,
    DNA_DIMENSION_KEYS,
    DNA_DIMENSION_LABELS,
    DNADimensionKey,
    calculateGeneticDistance,
    distanceToSimilarity,
} from './innovationDNA';

// ==================== 类型定义 ====================

/** 搜索前 DNA 预洞察 */
export interface DNAPreScanInsight {
    /** 是否有足够基因库数据进行洞察 */
    hasInsight: boolean;
    /** 估算的粗略向量（基于简单文本特征，不需要 AI 调用） */
    estimatedVector: DNAVector | null;
    /** 基因库中最相似的 N 个查询 */
    similarQueries: Array<{
        query: string;
        distance: number;
        similarity: 'high' | 'medium' | 'low';
    }>;
    /** 基于邻居分析的增强关键词 */
    enhancedKeywords: string[];
    /** 密度预警等级 */
    crowdingWarning: 'blue_ocean' | 'moderate' | 'red_ocean' | 'unknown';
    /** 人类可读的洞察摘要（注入 Agent prompt） */
    insightSummary: string;
    /** 基因库总量 */
    genePoolSize: number;
}

/** DNA 加权修正结果 */
export interface DNARankingAdjustment {
    /** 是否触发了修正 */
    adjusted: boolean;
    /** 原始评分 */
    originalScore: number;
    /** 修正后评分 */
    adjustedScore: number;
    /** 修正幅度（正=加分，负=减分） */
    delta: number;
    /** 修正原因 */
    reason: string;
    /** 蓝海/红海标记 */
    zoneType: 'blue_ocean' | 'moderate' | 'red_ocean';
    /** 独特性百分位（相对于整个基因库） */
    uniquenessPercentile: number;
}

/** 进化反馈记录 */
export interface EvolutionFeedback {
    /** 预测 vs 实际的偏差 */
    predictionDeviation: number;
    /** 校准方向 */
    calibrationDirection: 'more_unique' | 'less_unique' | 'accurate';
    /** 基因库中被本次搜索新增的信息点 */
    newInsightsAdded: number;
    /** 进化迭代次数（当前查询是第几次被搜索） */
    evolutionGeneration: number;
}

// ==================== 核心函数 ====================

/**
 * 搜索前 DNA 预洞察 — 快速从基因库获取上下文
 * 不依赖 AI 调用，纯数据库查询 + 文本匹配，延迟 <500ms
 */
export async function preScanDNAInsight(query: string): Promise<DNAPreScanInsight> {
    const emptyInsight: DNAPreScanInsight = {
        hasInsight: false,
        estimatedVector: null,
        similarQueries: [],
        enhancedKeywords: [],
        crowdingWarning: 'unknown',
        insightSummary: '',
        genePoolSize: 0,
    };

    try {
        // 1. 从基因库拉取所有记录（小规模阶段直接全量，大规模后可用向量索引）
        const { data: pool, error } = await supabaseAdmin
            .from('innovation_dna')
            .select('id, query, tech_principle, app_scenario, target_user, impl_path, biz_model')
            .limit(200);

        if (error || !pool || pool.length < 3) {
            // 基因库太小，无法提供有意义的洞察
            return { ...emptyInsight, genePoolSize: pool?.length || 0 };
        }

        // 2. 基于文本相似度估算粗略向量（轻量级，不调 AI）
        const estimatedVector = estimateVectorFromText(query, pool);

        // 3. 计算与所有基因的距离
        const distances = pool.map(row => {
            const rowVec: DNAVector = [
                row.tech_principle, row.app_scenario,
                row.target_user, row.impl_path, row.biz_model,
            ];
            return {
                query: row.query,
                vector: rowVec,
                distance: calculateGeneticDistance(estimatedVector, rowVec),
            };
        }).sort((a, b) => a.distance - b.distance);

        // 4. 提取最近邻
        const similarQueries = distances.slice(0, 5).map(d => ({
            query: d.query,
            distance: Math.round(d.distance * 100) / 100,
            similarity: distanceToSimilarity(d.distance),
        }));

        // 5. 从邻居查询中提取增强关键词
        const enhancedKeywords = extractKeywordsFromNeighbors(
            query, similarQueries.map(s => s.query)
        );

        // 6. 计算密度预警
        const avgDistance = distances.reduce((s, d) => s + d.distance, 0) / distances.length;
        const nearCount = distances.filter(d => d.distance < 0.3).length;
        const crowdingWarning: DNAPreScanInsight['crowdingWarning'] =
            nearCount >= 3 ? 'red_ocean' :
                nearCount >= 1 ? 'moderate' :
                    avgDistance > 0.8 ? 'blue_ocean' : 'moderate';

        // 7. 生成人类可读摘要（注入 Agent prompt 使用）
        const crowdingText = crowdingWarning === 'red_ocean' ? '⚠️ 红海预警：基因库中有多个高度相似的创意'
            : crowdingWarning === 'blue_ocean' ? '✅ 蓝海信号：基因库中未找到高度相似创意'
                : '📊 密度适中：基因库中有部分相关创意';

        const insightSummary = [
            `[NovoDNA 预洞察] 基因库规模: ${pool.length} 个创意`,
            crowdingText,
            nearCount > 0 ? `最近邻: "${similarQueries[0].query}" (距离=${similarQueries[0].distance})` : '',
            enhancedKeywords.length > 0 ? `增强关键词: ${enhancedKeywords.join(', ')}` : '',
        ].filter(Boolean).join('\n');

        return {
            hasInsight: true,
            estimatedVector,
            similarQueries,
            enhancedKeywords,
            crowdingWarning,
            insightSummary,
            genePoolSize: pool.length,
        };
    } catch (err: any) {
        console.warn('[NovoDNA/FeedbackLoop] preScanDNAInsight 失败:', err.message);
        return emptyInsight;
    }
}

/**
 * 搜索后 DNA 加权修正 — 基于基因密度调整最终评分
 *
 * 核心逻辑：
 *   - 创意在稀疏区域 → 加分（蓝海奖励，最多 +8）
 *   - 创意在拥挤区域 → 减分（红海惩罚，最多 -8）
 *   - 中间地带 → 微调 ±3
 */
export function postSearchDNARanking(
    uniquenessScore: number,       // 0-100，来自密度分析
    overallCrowding: number,       // 0-1，来自密度分析
    originalScore: number,         // 原始综合评分
    genePoolSize: number,          // 基因库大小
): DNARankingAdjustment {
    // 基因库太小时不做修正（<5 条数据统计意义不足）
    if (genePoolSize < 5) {
        return {
            adjusted: false,
            originalScore,
            adjustedScore: originalScore,
            delta: 0,
            reason: '基因库数据不足（<5），跳过 NovoDNA 加权',
            zoneType: 'moderate',
            uniquenessPercentile: 50,
        };
    }

    // 计算独特性百分位
    const uniquenessPercentile = Math.round(uniquenessScore);

    // 计算加权幅度
    let delta: number;
    let zoneType: DNARankingAdjustment['zoneType'];
    let reason: string;

    if (uniquenessScore >= 75 && overallCrowding < 0.3) {
        // 蓝海区域：高独特性 + 低拥挤 → 加分
        delta = Math.round((uniquenessScore - 60) * 0.2);  // 最多 +8
        delta = Math.min(delta, 8);
        zoneType = 'blue_ocean';
        reason = `🌊 蓝海加权 +${delta}：独特性 ${uniquenessPercentile}%，拥挤度仅 ${Math.round(overallCrowding * 100)}%`;
    } else if (uniquenessScore <= 30 && overallCrowding > 0.6) {
        // 红海区域：低独特性 + 高拥挤 → 减分
        delta = -Math.round((60 - uniquenessScore) * 0.15);  // 最多 -8
        delta = Math.max(delta, -8);
        zoneType = 'red_ocean';
        reason = `🔴 红海惩罚 ${delta}：独特性仅 ${uniquenessPercentile}%，拥挤度 ${Math.round(overallCrowding * 100)}%`;
    } else {
        // 中间地带：微调
        delta = uniquenessScore > 50
            ? Math.round((uniquenessScore - 50) * 0.06)   // 最多 +3
            : -Math.round((50 - uniquenessScore) * 0.06); // 最多 -3
        delta = Math.max(-3, Math.min(3, delta));
        zoneType = 'moderate';
        reason = delta !== 0
            ? `📊 NovoDNA 微调 ${delta > 0 ? '+' : ''}${delta}：独特性 ${uniquenessPercentile}%`
            : `📊 NovoDNA 评估：独特性 ${uniquenessPercentile}%，无需修正`;
    }

    const adjustedScore = Math.max(5, Math.min(98, originalScore + delta));

    return {
        adjusted: delta !== 0,
        originalScore,
        adjustedScore,
        delta,
        reason,
        zoneType,
        uniquenessPercentile,
    };
}

/**
 * 进化反馈 — 用搜索结果反向修正 DNA 精度
 *
 * 对比「DNA 预测的独特性」与「搜索实际发现的竞品数量」之间的偏差，
 * 将校准信息存入基因库，使后续查询更准确。
 */
export async function evolutionaryFeedback(
    queryHash: string,
    dnaUniquenessScore: number,    // NovoDNA 给出的独特性评分 (0-100)
    searchNoveltyScore: number,    // 搜索结果给出的综合创新评分 (0-100)
    competitorCount: number,       // 搜索发现的竞品数量
): Promise<EvolutionFeedback> {
    // 计算预测偏差
    const predictionDeviation = Math.abs(dnaUniquenessScore - searchNoveltyScore);

    // 判断校准方向
    let calibrationDirection: EvolutionFeedback['calibrationDirection'];
    if (predictionDeviation < 15) {
        calibrationDirection = 'accurate';
    } else if (dnaUniquenessScore > searchNoveltyScore) {
        calibrationDirection = 'less_unique';  // DNA 过于乐观
    } else {
        calibrationDirection = 'more_unique';  // DNA 过于悲观
    }

    // 更新基因库中该条目的进化元数据
    let evolutionGeneration = 1;
    try {
        const { data: existing } = await supabaseAdmin
            .from('innovation_dna')
            .select('evolution_generation, search_novelty_score')
            .eq('query_hash', queryHash)
            .maybeSingle();

        if (existing) {
            evolutionGeneration = (existing.evolution_generation || 0) + 1;

            await supabaseAdmin
                .from('innovation_dna')
                .update({
                    search_novelty_score: searchNoveltyScore,
                    competitor_count: competitorCount,
                    prediction_deviation: predictionDeviation,
                    calibration_direction: calibrationDirection,
                    evolution_generation: evolutionGeneration,
                    last_evolved_at: new Date().toISOString(),
                })
                .eq('query_hash', queryHash);

            console.log(
                `[NovoDNA/Evolution] 进化反馈: query_hash=${queryHash}, ` +
                `偏差=${predictionDeviation.toFixed(1)}, 方向=${calibrationDirection}, ` +
                `代数=${evolutionGeneration}`
            );
        }
    } catch (err: any) {
        console.warn('[NovoDNA/Evolution] 进化反馈写入失败:', err.message);
    }

    return {
        predictionDeviation,
        calibrationDirection,
        newInsightsAdded: competitorCount > 0 ? 1 : 0,
        evolutionGeneration,
    };
}

// ==================== 内部工具函数 ====================

/**
 * 基于文本特征快速估算 DNA 向量（不调用 AI）
 * 通过关键词匹配和基因库均值加权来推断
 */
function estimateVectorFromText(
    query: string,
    pool: Array<{
        query: string;
        tech_principle: number; app_scenario: number;
        target_user: number; impl_path: number; biz_model: number;
    }>
): DNAVector {
    const queryLower = query.toLowerCase();

    // 使用 Jaccard 文本相似度对基因库加权
    const weights: number[] = pool.map(row => {
        const rowChars = new Set(row.query.split(''));
        const queryChars = new Set(query.split(''));
        const intersection = Array.from(queryChars).filter(c => rowChars.has(c)).length;
        const union = new Set(Array.from(queryChars).concat(Array.from(rowChars))).size;
        return union > 0 ? intersection / union : 0;
    });

    const totalWeight = weights.reduce((s, w) => s + w, 0);
    if (totalWeight < 0.01) {
        // 完全没有文本重叠，返回中间值
        return [0.5, 0.5, 0.5, 0.5, 0.5];
    }

    // 加权平均各维度
    const vector: DNAVector = [0, 0, 0, 0, 0];
    const dimKeys = ['tech_principle', 'app_scenario', 'target_user', 'impl_path', 'biz_model'] as const;

    for (let d = 0; d < 5; d++) {
        let weightedSum = 0;
        for (let i = 0; i < pool.length; i++) {
            weightedSum += weights[i] * pool[i][dimKeys[d]];
        }
        vector[d] = Math.round((weightedSum / totalWeight) * 100) / 100;
    }

    // 关键词修正：某些特征词会强烈影响特定维度
    const techKeywords = ['ai', '机器学习', '深度学习', '区块链', '量子', 'transformer', 'llm', '大模型', 'neural'];
    const newScenarioKeywords = ['元宇宙', 'vr', 'ar', '太空', '脑机', '基因编辑', '自动驾驶'];
    const newBizKeywords = ['订阅', 'saas', 'dao', '代币', 'nft', 'freemium', '众筹'];

    if (techKeywords.some(k => queryLower.includes(k))) vector[0] = Math.min(1, vector[0] + 0.15);
    if (newScenarioKeywords.some(k => queryLower.includes(k))) vector[1] = Math.min(1, vector[1] + 0.2);
    if (newBizKeywords.some(k => queryLower.includes(k))) vector[4] = Math.min(1, vector[4] + 0.15);

    return vector;
}

/**
 * 从邻居查询中提取差异化关键词
 * 找到邻居有但当前查询没有的关键词
 */
function extractKeywordsFromNeighbors(
    currentQuery: string,
    neighborQueries: string[]
): string[] {
    if (neighborQueries.length === 0) return [];

    const currentWords = new Set(
        currentQuery.split(/[\s,，、；;.。!！?？()（）\[\]【】]+/).filter(w => w.length >= 2)
    );

    const neighborWords = new Map<string, number>();
    for (const nq of neighborQueries) {
        const words = nq.split(/[\s,，、；;.。!！?？()（）\[\]【】]+/).filter(w => w.length >= 2);
        for (const w of words) {
            if (!currentWords.has(w)) {
                neighborWords.set(w, (neighborWords.get(w) || 0) + 1);
            }
        }
    }

    // 出现在多个邻居中的词更有价值
    return Array.from(neighborWords.entries())
        .filter(([_, count]) => count >= 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([word]) => word);
}
