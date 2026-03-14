/**
 * NovoDNA 引擎（NovoDNA Engine）
 *
 * 将每个创新想法分解为 5 维基因向量，在创新基因库中计算"基因距离"，
 * 产出创新图谱（Innovation Map），标注最近邻、差异地带和空白地带。
 *
 * 五维向量空间：
 *   0 - techPrinciple  技术原理（0=传统, 1=颠覆性首创）
 *   1 - appScenario    应用场景（0=已有场景, 1=全新场景）
 *   2 - targetUser     目标用户（0=大众已有, 1=全新细分群体）
 *   3 - implPath       实现路径（0=现成方案, 1=全新工程路线）
 *   4 - bizModel       商业模式（0=传统获利, 1=颠覆性获利）
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import { supabaseAdmin } from '@/lib/supabase';
import { generateQueryHash } from './innovationService';
import { classifyDomain, type DomainInfo } from './domainClassifier';
import type { ModelProvider } from '@/types';

// ==================== 类型定义 ====================

/** 5 维标签 key（固定顺序） */
export const DNA_DIMENSION_KEYS = [
    'techPrinciple',
    'appScenario',
    'targetUser',
    'implPath',
    'bizModel',
] as const;

export type DNADimensionKey = typeof DNA_DIMENSION_KEYS[number];

/** 中英文标签 */
export const DNA_DIMENSION_LABELS: Record<DNADimensionKey, { zh: string; en: string }> = {
    techPrinciple: { zh: '技术原理', en: 'Tech Principle' },
    appScenario: { zh: '应用场景', en: 'App Scenario' },
    targetUser: { zh: '目标用户', en: 'Target User' },
    implPath: { zh: '实现路径', en: 'Impl Path' },
    bizModel: { zh: '商业模式', en: 'Biz Model' },
};

/** DNA 向量（固定 5 维，0-1 范围） */
export type DNAVector = [number, number, number, number, number];

/** AI 解析出的单个维度结果 */
export interface DNADimensionResult {
    key: DNADimensionKey;
    value: number;       // 0-1
    reasoning: string;   // AI 推理理由
}

/** 完整的 DNA 提取结果 */
export interface DNAExtractionResult {
    vector: DNAVector;
    dimensions: DNADimensionResult[];
    summary: string;     // AI 对该创意基因的一句话总结
}

/** 基因库中的邻居 */
export interface DNANeighbor {
    id: number;
    query: string;
    vector: DNAVector;
    distance: number;     // 欧几里得距离（0-~2.24）
    similarity: 'high' | 'medium' | 'low';  // 标签化
    domain?: DomainInfo;  // 领域分类标签
}

/** 空白地带 */
export interface DNABlankZone {
    vector: DNAVector;
    minDistToExisting: number;   // 与现有基因库中最近条目的距离
    description: string;         // AI 生成的描述
}

/** 基因变异建议 */
export interface MutationSuggestion {
    fromDimension: DNADimensionKey;   // 需要调整的维度
    currentValue: number;             // 当前值
    suggestedValue: number;           // 建议变异到的值
    targetVector: DNAVector;          // 变异后的完整向量
    distanceGain: number;             // 变异后增加的独特性（与最近邻的距离增量）
    reasoning: string;                // AI 生成的变异理由
    opportunity: string;              // 变异后的蓝海机会描述
    riskLevel: 'low' | 'medium' | 'high';  // 变异风险等级
    nearestCompetitor?: {             // 变异后最近的竞品（关联推荐）
        query: string;                // 竞品名称
        currentDistance: number;      // 变异前与该竞品的距离
        afterDistance: number;        // 变异后与该竞品的距离
    };
}

/** 单个维度的密度分布 */
export interface DimensionDensity {
    key: DNADimensionKey;
    bins: Array<{ min: number; max: number; count: number }>;
    crowdedZone: number;      // 最拥挤的区间中心值 (0-1)
    emptyZone: number;        // 最空旷的区间中心值 (0-1)
    currentPosition: 'crowded' | 'moderate' | 'unique';  // 当前创意在该维度的拥挤度
}

/** 创新空间密度分析 */
export interface DensityProfile {
    totalInnovations: number;         // 基因库总量
    overallCrowding: number;          // 整体拥挤指数 (0-1, 1=极度拥挤)
    uniquenessScore: number;          // 独特性得分 (0-100)
    dimensionDensities: DimensionDensity[];
}

/** Innovation Map 完整数据（v2 升级版） */
export interface InnovationDNAMap {
    query: string;
    vector: DNAVector;
    dimensions: DNADimensionResult[];
    summary: string;
    neighbors: DNANeighbor[];
    blankZones: DNABlankZone[];
    // v2 新增
    mutations: MutationSuggestion[];    // 基因变异建议
    density: DensityProfile | null;     // 密度分析
}

// ==================== 核心函数 ====================

/**
 * 调用 AI 将创意分解为 5 维创新向量
 */
export async function extractDNAVector(
    query: string,
    analysisContext?: string,
    modelProvider: ModelProvider = 'minimax'
): Promise<DNAExtractionResult> {
    const prompt = `
# 系统角色

你是一位创新基因分析专家，擅长将任何创意或发明拆解为标准化的 5 维"创新基因向量"。

# 任务

将以下创意分解为 5 个维度的标准化分数（0.0 到 1.0），每个维度代表该创意在某个方面的创新程度：

**创意**：${query}
${analysisContext ? `\n**参考上下文**：${analysisContext.slice(0, 2000)}` : ''}

# 五维创新基因空间

1. **techPrinciple（技术原理）**：核心技术路线的创新程度
   - 0.0 = 完全使用已有成熟技术
   - 0.5 = 对现有技术做了显著改进
   - 1.0 = 全球首创的全新技术原理

2. **appScenario（应用场景）**：应用领域的新颖程度
   - 0.0 = 在已有场景的常规应用
   - 0.5 = 跨领域迁移应用
   - 1.0 = 开创全新应用领域

3. **targetUser（目标用户）**：用户群体的差异化程度
   - 0.0 = 面向已被充分服务的大众用户
   - 0.5 = 瞄准了被忽视的细分市场
   - 1.0 = 创造了全新的用户需求

4. **implPath（实现路径）**：工程实现方式的创新性
   - 0.0 = 完全现成的技术栈和方案
   - 0.5 = 需要定制化开发但路径清晰
   - 1.0 = 需要全新的工程范式

5. **bizModel（商业模式）**：获利逻辑的独特性
   - 0.0 = 传统定价/销售模型
   - 0.5 = 改良的商业模式
   - 1.0 = 颠覆行业获利规则的全新模式

# 输出格式

严格按以下 JSON 格式输出，不要有任何其他内容：
{
  "summary": "一句话概括该创新点在五维创新空间中的定位，如：技术原理较高创新(0.7)、应用场景为跨领域迁移(0.5)...",
  "dimensions": [
    { "key": "techPrinciple", "value": 0.0, "reasoning": "分析理由..." },
    { "key": "appScenario", "value": 0.0, "reasoning": "分析理由..." },
    { "key": "targetUser", "value": 0.0, "reasoning": "分析理由..." },
    { "key": "implPath", "value": 0.0, "reasoning": "分析理由..." },
    { "key": "bizModel", "value": 0.0, "reasoning": "分析理由..." }
  ]
}

⚠️ 要求：
- value 必须是 0.0 到 1.0 之间的浮点数，精确到小数点后 1 位
- 5 个维度的分数应有合理差异，不要全部趋同
- reasoning 至少 15 字
- summary 必须聚焦于描述该创意在五维创新空间（技术原理/应用场景/目标用户/实现路径/商业模式）中的定位特征，禁止出现蛋白质、基因组学、DNA序列等生物学术语
`;

    try {
        const { text } = await callAIRaw(prompt, modelProvider, 30000, 10000, undefined, undefined, 8192, 0.7, 'low');
        const parsed = parseAgentJSON<{
            summary: string;
            dimensions: Array<{ key: string; value: number; reasoning: string }>;
        }>(text);

        // 标准化和校验
        const dimensions: DNADimensionResult[] = DNA_DIMENSION_KEYS.map(key => {
            const found = parsed.dimensions?.find(d => d.key === key);
            const rawValue = found?.value ?? 0.5;
            return {
                key,
                value: Math.round(Math.max(0, Math.min(1, rawValue)) * 10) / 10,
                reasoning: found?.reasoning || '未提供理由',
            };
        });

        const vector: DNAVector = dimensions.map(d => d.value) as DNAVector;

        return {
            vector,
            dimensions,
            summary: parsed.summary || '基因分析完成',
        };
    } catch (err: any) {
        console.error('[InnovationDNA] AI 提取失败:', err.message);
        // 降级：返回中性向量
        return {
            vector: [0.5, 0.5, 0.5, 0.5, 0.5],
            dimensions: DNA_DIMENSION_KEYS.map(key => ({
                key,
                value: 0.5,
                reasoning: 'AI 分析失败，使用默认中性值',
            })),
            summary: 'AI 分析失败，使用默认基因指纹',
        };
    }
}

/**
 * 计算两个 DNA 向量之间的欧几里得距离（归一化到 0-1 范围）
 * 最大理论距离 = sqrt(5) ≈ 2.236
 */
export function calculateGeneticDistance(vecA: DNAVector, vecB: DNAVector): number {
    let sumSq = 0;
    for (let i = 0; i < 5; i++) {
        sumSq += (vecA[i] - vecB[i]) ** 2;
    }
    return Math.sqrt(sumSq);
}

/**
 * 距离标签化
 */
export function distanceToSimilarity(distance: number): 'high' | 'medium' | 'low' {
    if (distance < 0.3) return 'high';
    if (distance < 0.7) return 'medium';
    return 'low';
}

/**
 * 从 Supabase innovation_dna 表查询最近邻
 */
export async function findNearestNeighbors(
    vector: DNAVector,
    currentQueryHash?: string,
    limit: number = 8
): Promise<DNANeighbor[]> {
    try {
        const { data, error } = await supabaseAdmin
            .from('innovation_dna')
            .select('id, query, query_hash, tech_principle, app_scenario, target_user, impl_path, biz_model')
            .limit(100);  // 取前 100 条做内存排序（小规模基因库）

        if (error || !data || data.length === 0) {
            console.warn('[InnovationDNA] 基因库为空或查询失败:', error?.message);
            return [];
        }

        // 计算距离并排序
        const neighbors = data
            .filter(row => row.query_hash !== currentQueryHash)  // 排除自身
            .map(row => {
                const rowVec: DNAVector = [
                    row.tech_principle,
                    row.app_scenario,
                    row.target_user,
                    row.impl_path,
                    row.biz_model,
                ];
                const distance = calculateGeneticDistance(vector, rowVec);
                return {
                    id: row.id,
                    query: row.query,
                    vector: rowVec,
                    distance: Math.round(distance * 100) / 100,
                    similarity: distanceToSimilarity(distance),
                };
            })
            .sort((a, b) => a.distance - b.distance)
            .slice(0, limit);

        return neighbors;
    } catch (err: any) {
        console.error('[InnovationDNA] 查询最近邻失败:', err.message);
        return [];
    }
}

/**
 * 发现创新空间中的空白地带
 * 采样 5 维空间的特征位置，找到远离所有已知创新的区域
 */
export async function findBlankZones(
    vector: DNAVector,
    limit: number = 3
): Promise<DNABlankZone[]> {
    try {
        // 获取所有已知向量
        const { data, error } = await supabaseAdmin
            .from('innovation_dna')
            .select('tech_principle, app_scenario, target_user, impl_path, biz_model')
            .limit(200);

        if (error || !data || data.length < 2) {
            // 基因库太小，无法有意义地发现空白地带
            return [];
        }

        const existingVectors: DNAVector[] = data.map(row => [
            row.tech_principle,
            row.app_scenario,
            row.target_user,
            row.impl_path,
            row.biz_model,
        ]);

        // 在 5 维空间中均匀采样候选点
        const candidates: DNAVector[] = [];
        const steps = [0.1, 0.3, 0.5, 0.7, 0.9];
        // 智能采样：基于当前向量的互补位置 + 一些随机位置
        for (let i = 0; i < 5; i++) {
            // 每个维度的对立点
            const complementary = [...vector] as DNAVector;
            complementary[i] = vector[i] > 0.5 ? 0.1 : 0.9;
            candidates.push(complementary);
        }
        // 再加一些极端组合
        for (const a of [0.1, 0.9]) {
            for (const b of [0.1, 0.9]) {
                candidates.push([a, b, 0.9, 0.9, 0.5]);
                candidates.push([0.5, a, b, 0.1, 0.9]);
                candidates.push([0.9, 0.5, a, b, 0.1]);
            }
        }

        // 对每个候选点计算它到所有已知向量的最小距离
        const scored = candidates.map(candidateVec => {
            let minDist = Infinity;
            for (const existing of existingVectors) {
                const dist = calculateGeneticDistance(candidateVec, existing);
                if (dist < minDist) minDist = dist;
            }
            return { vector: candidateVec, minDistToExisting: Math.round(minDist * 100) / 100 };
        });

        // 按距离降序，取最远的（即最空白的区域）
        scored.sort((a, b) => b.minDistToExisting - a.minDistToExisting);

        const topZones = scored.slice(0, limit);

        // 为每个空白地带生成描述
        return topZones.map(zone => {
            const descs: string[] = [];
            zone.vector.forEach((v, i) => {
                const key = DNA_DIMENSION_KEYS[i];
                const label = DNA_DIMENSION_LABELS[key].zh;
                if (v >= 0.8) descs.push(`高${label}`);
                else if (v <= 0.2) descs.push(`低${label}`);
            });
            return {
                vector: zone.vector,
                minDistToExisting: zone.minDistToExisting,
                description: descs.length > 0
                    ? `${descs.join(' + ')} 的组合方向尚待探索`
                    : '该区域组合尚无已知创新',
            };
        });
    } catch (err: any) {
        console.error('[InnovationDNA] 空白地带分析失败:', err.message);
        return [];
    }
}

/**
 * 将 DNA 向量存入 Supabase
 */
export async function storeDNAVector(
    query: string,
    extraction: DNAExtractionResult,
    innovationId?: number
): Promise<void> {
    try {
        const queryHash = await generateQueryHash(query);
        const domain = classifyDomain(query);
        const { error } = await supabaseAdmin
            .from('innovation_dna')
            .upsert({
                innovation_id: innovationId || null,
                query,
                query_hash: queryHash,
                tech_principle: extraction.vector[0],
                app_scenario: extraction.vector[1],
                target_user: extraction.vector[2],
                impl_path: extraction.vector[3],
                biz_model: extraction.vector[4],
                reasoning: {
                    summary: extraction.summary,
                    dimensions: extraction.dimensions,
                    domain,
                    source: 'user_scan',
                },
            }, { onConflict: 'query_hash' });

        if (error) {
            console.warn('[InnovationDNA] 存储失败:', error.message);
        } else {
            console.log(`[InnovationDNA] ✅ DNA 向量已存储: "${query.slice(0, 30)}..."`);
        }
    } catch (err: any) {
        console.error('[InnovationDNA] 存储异常:', err.message);
    }
}

// ==================== 变异建议语义映射 ====================

/** 每个维度在不同段位的语义描述 */
const DIMENSION_SEMANTICS: Record<DNADimensionKey, {
    low: string;   // 0 - 0.3
    mid: string;   // 0.3 - 0.7
    high: string;  // 0.7 - 1.0
    /** 从高段位降到低段位的蓝海策略 */
    highToLow: string;
    /** 从低段位升到高段位的蓝海策略 */
    lowToHigh: string;
    /** 微调升（中→高 或 低→中） */
    nudgeUp: string;
    /** 微调降（高→中 或 中→低） */
    nudgeDown: string;
}> = {
    techPrinciple: {
        low: '成熟技术方案',
        mid: '改良型技术',
        high: '前沿/颠覆性技术',
        highToLow: '退回成熟技术栈，用低研发成本和高确定性占领被忽视的传统场景，避开技术前沿的激烈竞争',
        lowToHigh: '大胆押注前沿技术（如新型AI架构、量子计算等），在技术壁垒维度拉开与竞品的距离',
        nudgeUp: '适度提升技术创新度，用差异化技术特性构建护城河',
        nudgeDown: '简化技术方案，降低研发风险，聚焦快速落地和市场验证',
    },
    appScenario: {
        low: '已有成熟场景',
        mid: '跨领域迁移场景',
        high: '全新应用领域',
        highToLow: '回归成熟场景做深度优化，在已验证的需求中寻找被低估的细分切口',
        lowToHigh: '大胆切入全新应用领域，开辟尚无竞品的蓝海市场，定义新品类',
        nudgeUp: '尝试跨领域应用迁移，将已有技术嫁接到相邻行业中寻找增量',
        nudgeDown: '收缩场景聚焦度，深耕核心场景做到极致体验',
    },
    targetUser: {
        low: '大众已有用户群',
        mid: '被忽视的细分市场',
        high: '全新用户群体',
        highToLow: '转向服务大众成熟用户群，以规模效应降低获客成本，在红海中找差异化切入点',
        lowToHigh: '精准定位全新细分用户群体（如银发族、Z世代创作者等），成为该群体的首选方案',
        nudgeUp: '挖掘被主流产品忽视的细分人群需求，做精准垂直服务',
        nudgeDown: '扩大目标用户范围，用更通用的方案触达更广泛的受众',
    },
    implPath: {
        low: '现成方案/技术栈',
        mid: '定制化开发',
        high: '全新工程范式',
        highToLow: '采用成熟开源方案和标准化工具链，以更快的迭代速度抢占市场先机',
        lowToHigh: '构建全新工程范式和专有技术架构，形成难以复制的技术壁垒',
        nudgeUp: '在关键环节引入定制化开发，平衡开发效率与差异化',
        nudgeDown: '简化实现路径，优先采用已验证的方案降低交付风险',
    },
    bizModel: {
        low: '传统商业模式',
        mid: '改良型商业模式',
        high: '颠覆性获利模式',
        highToLow: '回归经典商业模式（如订阅制、按量计费），用可预测的收入模型降低商业风险',
        lowToHigh: '探索颠覆性获利模式（如按效果付费、社区驱动、数据飞轮），在商业创新维度建立独特优势',
        nudgeUp: '引入差异化定价或增值服务策略，提升客单价和用户粘性',
        nudgeDown: '简化收费模型，降低用户决策门槛，用更透明的定价策略提升转化率',
    },
};

/** 获取值所在段位 */
function getValueTier(v: number): 'low' | 'mid' | 'high' {
    if (v <= 0.3) return 'low';
    if (v >= 0.7) return 'high';
    return 'mid';
}

/** 根据维度、当前值、目标值生成差异化的蓝海策略描述 */
function describeMutationOpportunity(
    key: DNADimensionKey,
    current: number,
    target: number,
): string {
    const sem = DIMENSION_SEMANTICS[key];
    const currentTier = getValueTier(current);
    const targetTier = getValueTier(target);
    const direction = target > current ? 'up' : 'down';

    // 大跨度变异：高→低 或 低→高
    if (currentTier === 'high' && targetTier === 'low') return sem.highToLow;
    if (currentTier === 'low' && targetTier === 'high') return sem.lowToHigh;

    // 中等跨度或微调
    if (direction === 'up') return sem.nudgeUp;
    return sem.nudgeDown;
}

/**
 * 生成基因变异建议
 * 分析每个维度的变异方向，找到能最大化独特性的调整策略
 */
export async function generateMutationSuggestions(
    vector: DNAVector,
    neighbors: DNANeighbor[],
    blankZones: DNABlankZone[],
    modelProvider: ModelProvider = 'minimax'
): Promise<MutationSuggestion[]> {
    const suggestions: MutationSuggestion[] = [];

    // 计算当前到最近邻的距离（基线）
    const nearestDist = neighbors.length > 0 ? neighbors[0].distance : 1.0;

    // 对每个维度尝试变异
    for (let i = 0; i < 5; i++) {
        const key = DNA_DIMENSION_KEYS[i];
        const current = vector[i];

        // 选择变异方向：向相反的极端移动
        const targets = current > 0.5
            ? [0.1, 0.2, 0.3]
            : [0.7, 0.8, 0.9];

        for (const target of targets) {
            const mutated = [...vector] as DNAVector;
            mutated[i] = target;

            // 计算变异后到所有邻居的最小距离
            let minDistAfter = Infinity;
            for (const n of neighbors) {
                const dist = calculateGeneticDistance(mutated, n.vector);
                if (dist < minDistAfter) minDistAfter = dist;
            }

            const distanceGain = Math.round((minDistAfter - nearestDist) * 100) / 100;

            // 只保留正向收益的变异
            if (distanceGain > 0.05) {
                const currentTierLabel = DIMENSION_SEMANTICS[key][getValueTier(current)];
                const targetTierLabel = DIMENSION_SEMANTICS[key][getValueTier(target)];

                // 找到变异后最近的竞品
                let nearestCompetitor: MutationSuggestion['nearestCompetitor'] = undefined;
                if (neighbors.length > 0) {
                    let bestNeighbor = neighbors[0];
                    let bestAfterDist = calculateGeneticDistance(mutated, bestNeighbor.vector);
                    for (let ni = 1; ni < neighbors.length; ni++) {
                        const d = calculateGeneticDistance(mutated, neighbors[ni].vector);
                        if (d < bestAfterDist) {
                            bestAfterDist = d;
                            bestNeighbor = neighbors[ni];
                        }
                    }
                    nearestCompetitor = {
                        query: bestNeighbor.query,
                        currentDistance: Math.round(calculateGeneticDistance(vector, bestNeighbor.vector) * 100) / 100,
                        afterDistance: Math.round(bestAfterDist * 100) / 100,
                    };
                }

                suggestions.push({
                    fromDimension: key,
                    currentValue: current,
                    suggestedValue: target,
                    targetVector: mutated,
                    distanceGain,
                    reasoning: `${DNA_DIMENSION_LABELS[key].zh}从「${currentTierLabel}」(${current.toFixed(1)}) 调整到「${targetTierLabel}」(${target.toFixed(1)})，独特性距离 +${distanceGain.toFixed(2)}`,
                    opportunity: describeMutationOpportunity(key, current, target),
                    riskLevel: Math.abs(target - current) > 0.5 ? 'high' : Math.abs(target - current) > 0.3 ? 'medium' : 'low',
                    nearestCompetitor,
                });
            }
        }
    }

    // 结合空白地带信息，为 top 变异增加蓝海洞察
    if (blankZones.length > 0 && suggestions.length > 0) {
        const bestBlank = blankZones[0];
        for (const s of suggestions) {
            const dimIdx = DNA_DIMENSION_KEYS.indexOf(s.fromDimension);
            const blankDir = bestBlank.vector[dimIdx];
            // 如果变异方向恰好朝向空白地带
            if (Math.abs(s.suggestedValue - blankDir) < 0.3) {
                s.opportunity = `🎯 变异方向与蓝海空白区域高度吻合！${bestBlank.description}`;
            }
        }
    }

    // 按距离增益降序排序
    suggestions.sort((a, b) => b.distanceGain - a.distanceGain);

    // 按维度去重：每个维度只保留 distanceGain 最大的一条
    const seen = new Set<DNADimensionKey>();
    const deduped: MutationSuggestion[] = [];
    for (const s of suggestions) {
        if (!seen.has(s.fromDimension)) {
            seen.add(s.fromDimension);
            deduped.push(s);
        }
        if (deduped.length >= 5) break;
    }

    return deduped;
}

/**
 * 分析创新空间的密度分布
 * 计算每个维度的区间密度和整体拥挤系数
 */
export async function analyzeDensity(
    vector: DNAVector
): Promise<DensityProfile | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('innovation_dna')
            .select('tech_principle, app_scenario, target_user, impl_path, biz_model')
            .limit(500);

        if (error || !data || data.length < 3) {
            return null; // 数据量太少，无法做有意义的密度分析
        }

        const allVectors: DNAVector[] = data.map(row => [
            row.tech_principle, row.app_scenario, row.target_user, row.impl_path, row.biz_model,
        ]);

        // 对每个维度做 5 个区间的直方图
        const binEdges = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
        const dimensionDensities: DimensionDensity[] = DNA_DIMENSION_KEYS.map((key, dimIdx) => {
            const bins = [];
            for (let b = 0; b < 5; b++) {
                const min = binEdges[b];
                const max = binEdges[b + 1];
                const count = allVectors.filter(v => v[dimIdx] >= min && v[dimIdx] < (b === 4 ? max + 0.01 : max)).length;
                bins.push({ min, max, count });
            }

            const maxBin = bins.reduce((a, b) => a.count > b.count ? a : b);
            const minBin = bins.reduce((a, b) => a.count < b.count ? a : b);
            const crowdedZone = (maxBin.min + maxBin.max) / 2;
            const emptyZone = (minBin.min + minBin.max) / 2;

            // 判断当前创意在该维度的拥挤度
            const currentBin = bins.find(b => vector[dimIdx] >= b.min && vector[dimIdx] < b.max + (vector[dimIdx] === 1 ? 0.01 : 0));
            const avgCount = allVectors.length / 5;
            const currentPosition: 'crowded' | 'moderate' | 'unique' =
                (currentBin?.count ?? 0) > avgCount * 1.5 ? 'crowded'
                    : (currentBin?.count ?? 0) < avgCount * 0.5 ? 'unique'
                        : 'moderate';

            return { key, bins, crowdedZone, emptyZone, currentPosition };
        });

        // 整体拥挤指数：当前向量与所有向量的平均距离（越小越拥挤）
        const avgDist = allVectors.reduce((sum, v) => sum + calculateGeneticDistance(vector, v), 0) / allVectors.length;
        const maxPossibleAvgDist = Math.sqrt(5); // ≈ 2.236
        const overallCrowding = Math.max(0, Math.min(1, 1 - avgDist / maxPossibleAvgDist));

        // 独特性得分 (0-100)：综合距离和维度独特性
        const uniqueDimCount = dimensionDensities.filter(d => d.currentPosition === 'unique').length;
        const uniquenessScore = Math.round(
            (1 - overallCrowding) * 60 + (uniqueDimCount / 5) * 40
        );

        return {
            totalInnovations: allVectors.length,
            overallCrowding: Math.round(overallCrowding * 100) / 100,
            uniquenessScore: Math.max(0, Math.min(100, uniquenessScore)),
            dimensionDensities,
        };
    } catch (err: any) {
        console.error('[InnovationDNA] 密度分析失败:', err.message);
        return null;
    }
}

/**
 * 构建完整的 Innovation Map（v2 升级版 — 性能优化）
 *
 * 优化：3 次 Supabase 查询合并为 1 次共享查询
 * 原架构: findNearestNeighbors(100条) + findBlankZones(200条) + analyzeDensity(500条) = 3 次网络往返
 * 新架构: fetchGenePool(500条) → 内存计算 = 1 次网络往返
 */
export async function buildInnovationMap(
    query: string,
    analysisContext?: string,
    modelProvider: ModelProvider = 'minimax'
): Promise<InnovationDNAMap> {
    console.log(`[InnovationDNA] 开始构建 Innovation Map v2: "${query.slice(0, 40)}..."`);

    // 1. 提取 DNA 向量（AI 调用）
    const extraction = await extractDNAVector(query, analysisContext, modelProvider);
    console.log(`[InnovationDNA] 向量提取完成: [${extraction.vector.join(', ')}]`);

    // 2. 存储 + 查询基因库 并行
    const queryHash = await generateQueryHash(query);
    const [, genePool] = await Promise.all([
        storeDNAVector(query, extraction),
        fetchGenePool(),
    ]);

    // 3. 内存中并行计算（零网络 IO）
    const neighbors = computeNeighbors(extraction.vector, genePool, queryHash, 8);
    const blankZones = computeBlankZones(extraction.vector, genePool);
    const density = computeDensity(extraction.vector, genePool);

    // 4. 基因变异建议（纯数学计算）
    const mutations = await generateMutationSuggestions(
        extraction.vector, neighbors, blankZones, modelProvider
    );

    console.log(`[InnovationDNA] Innovation Map v2 构建完成 — 邻居: ${neighbors.length}, 空白: ${blankZones.length}, 变异: ${mutations.length}, 密度: ${density?.uniquenessScore ?? 'N/A'}`);

    return {
        query,
        vector: extraction.vector,
        dimensions: extraction.dimensions,
        summary: extraction.summary,
        neighbors,
        blankZones,
        mutations,
        density,
    };
}

// ==================== 合并后的基因库查询 ====================

interface GenePoolRow {
    id: number;
    query: string;
    query_hash: string;
    tech_principle: number;
    app_scenario: number;
    target_user: number;
    impl_path: number;
    biz_model: number;
    reasoning: any;  // JSONB，包含 domain 等信息
}

/** 单次查询基因库（取最多 500 条，供所有分析共享） */
async function fetchGenePool(): Promise<GenePoolRow[]> {
    try {
        const { data, error } = await supabaseAdmin
            .from('innovation_dna')
            .select('id, query, query_hash, tech_principle, app_scenario, target_user, impl_path, biz_model, reasoning')
            .limit(500);

        if (error || !data) {
            console.warn('[InnovationDNA] 基因库查询失败:', error?.message);
            return [];
        }
        return data;
    } catch (err: any) {
        console.error('[InnovationDNA] 基因库查询异常:', err.message);
        return [];
    }
}

/** 内存计算最近邻 */
function computeNeighbors(
    vector: DNAVector,
    pool: GenePoolRow[],
    currentQueryHash?: string,
    limit: number = 8,
): DNANeighbor[] {
    if (pool.length === 0) return [];

    return pool
        .filter(row => row.query_hash !== currentQueryHash)
        .map(row => {
            const rowVec: DNAVector = [
                row.tech_principle, row.app_scenario,
                row.target_user, row.impl_path, row.biz_model,
            ];
            const distance = calculateGeneticDistance(vector, rowVec);
            // 从 reasoning JSONB 中提取领域信息，若无则实时分类
            const domain = row.reasoning?.domain || classifyDomain(row.query);
            return {
                id: row.id,
                query: row.query,
                vector: rowVec,
                distance: Math.round(distance * 100) / 100,
                similarity: distanceToSimilarity(distance),
                domain,
            };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
}

/** 内存计算空白地带 */
function computeBlankZones(
    vector: DNAVector,
    pool: GenePoolRow[],
    limit: number = 3,
): DNABlankZone[] {
    if (pool.length < 2) return [];

    const existingVectors: DNAVector[] = pool.map(row => [
        row.tech_principle, row.app_scenario,
        row.target_user, row.impl_path, row.biz_model,
    ]);

    // 采样候选点
    const candidates: DNAVector[] = [];
    for (let i = 0; i < 5; i++) {
        const complementary = [...vector] as DNAVector;
        complementary[i] = vector[i] > 0.5 ? 0.1 : 0.9;
        candidates.push(complementary);
    }
    for (const a of [0.1, 0.9]) {
        for (const b of [0.1, 0.9]) {
            candidates.push([a, b, 0.9, 0.9, 0.5]);
            candidates.push([0.5, a, b, 0.1, 0.9]);
            candidates.push([0.9, 0.5, a, b, 0.1]);
        }
    }

    const scored = candidates.map(candidateVec => {
        let minDist = Infinity;
        for (const existing of existingVectors) {
            const dist = calculateGeneticDistance(candidateVec, existing);
            if (dist < minDist) minDist = dist;
        }
        return { vector: candidateVec, minDistToExisting: Math.round(minDist * 100) / 100 };
    });

    scored.sort((a, b) => b.minDistToExisting - a.minDistToExisting);

    return scored.slice(0, limit).map(zone => {
        const descs: string[] = [];
        zone.vector.forEach((v, i) => {
            const key = DNA_DIMENSION_KEYS[i];
            const label = DNA_DIMENSION_LABELS[key].zh;
            if (v >= 0.8) descs.push(`高${label}`);
            else if (v <= 0.2) descs.push(`低${label}`);
        });
        return {
            vector: zone.vector,
            minDistToExisting: zone.minDistToExisting,
            description: descs.length > 0 ? `${descs.join(' + ')} 的组合方向尚待探索` : '该区域组合尚无已知创新',
        };
    });
}

/** 内存计算密度分析 */
function computeDensity(
    vector: DNAVector,
    pool: GenePoolRow[],
): DensityProfile | null {
    if (pool.length < 3) return null;

    const allVectors: DNAVector[] = pool.map(row => [
        row.tech_principle, row.app_scenario, row.target_user, row.impl_path, row.biz_model,
    ]);

    const binEdges = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
    const dimensionDensities: DimensionDensity[] = DNA_DIMENSION_KEYS.map((key, dimIdx) => {
        const bins = [];
        for (let b = 0; b < 5; b++) {
            const min = binEdges[b];
            const max = binEdges[b + 1];
            const count = allVectors.filter(v => v[dimIdx] >= min && v[dimIdx] < (b === 4 ? max + 0.01 : max)).length;
            bins.push({ min, max, count });
        }

        const maxBin = bins.reduce((a, b) => a.count > b.count ? a : b);
        const minBin = bins.reduce((a, b) => a.count < b.count ? a : b);
        const crowdedZone = (maxBin.min + maxBin.max) / 2;
        const emptyZone = (minBin.min + minBin.max) / 2;

        const currentBin = bins.find(b => vector[dimIdx] >= b.min && vector[dimIdx] < b.max + (vector[dimIdx] === 1 ? 0.01 : 0));
        const avgCount = allVectors.length / 5;
        const currentPosition: 'crowded' | 'moderate' | 'unique' =
            (currentBin?.count ?? 0) > avgCount * 1.5 ? 'crowded'
                : (currentBin?.count ?? 0) < avgCount * 0.5 ? 'unique'
                    : 'moderate';

        return { key, bins, crowdedZone, emptyZone, currentPosition };
    });

    const avgDist = allVectors.reduce((sum, v) => sum + calculateGeneticDistance(vector, v), 0) / allVectors.length;
    const maxPossibleAvgDist = Math.sqrt(5);
    const overallCrowding = Math.max(0, Math.min(1, 1 - avgDist / maxPossibleAvgDist));

    const uniqueDimCount = dimensionDensities.filter(d => d.currentPosition === 'unique').length;
    const uniquenessScore = Math.round((1 - overallCrowding) * 60 + (uniqueDimCount / 5) * 40);

    return {
        totalInnovations: allVectors.length,
        overallCrowding: Math.round(overallCrowding * 100) / 100,
        uniquenessScore: Math.max(0, Math.min(100, uniquenessScore)),
        dimensionDensities,
    };
}
