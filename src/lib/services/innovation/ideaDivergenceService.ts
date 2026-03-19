/**
 * IDEA 偏差分析引擎
 *
 * 当行为数据点 ≥ 20 时自动解锁。
 * 比较用户的对话画像（stated_*）与行为画像（behavioral_*），
 * 生成偏差洞察报告。
 *
 * 偏差分类：
 *   |gap| < 10  →  ✅ 高度一致
 *   gap > +10   →  ⚠️ 正向偏差（自我认知高于行为）
 *   gap < -10   →  💡 负向偏差（实际超过自我认知）
 */

import { adminDb } from '@/lib/db/factory';
import { callAIRaw } from '@/lib/ai-client';

// ==================== 类型定义 ====================

export interface DimensionDivergence {
    dimension: string;           // 维度名
    dimensionKey: string;        // V/D/P/S
    stated: number;              // 对话画像分
    behavioral: number;          // 行为画像分
    gap: number;                 // stated - behavioral
    type: 'consistent' | 'overestimate' | 'underestimate';
    label: string;               // "✅ 一致" / "⚠️ 高估" / "💡 低估"
    statedPole: string;          // 对话时的极性
    behavioralPole: string;      // 行为表现的极性
}

export interface DivergenceInsight {
    title: string;               // 洞察标题
    body: string;                // 洞察正文
    type: 'overestimate' | 'underestimate' | 'discovery';
}

export interface DivergenceReport {
    statedArchetype: string;     // 对话画像原型代码
    statedArchetypeName: string;
    behavioralArchetype: string; // 行为画像原型代码
    behavioralArchetypeName: string;
    finalArchetype: string;      // 综合画像原型代码
    finalArchetypeName: string;
    confidence: number;
    dimensions: DimensionDivergence[];
    insights: DivergenceInsight[];
    generatedAt: string;
}

// ==================== 极性判断 ====================

const POLES: Record<string, { high: string; low: string; highLabel: string; lowLabel: string }> = {
    v: { high: 'V', low: 'O', highLabel: '远见型', lowLabel: '洞察型' },
    d: { high: 'D', low: 'C', highLabel: '发散型', lowLabel: '收敛型' },
    p: { high: 'P', low: 'B', highLabel: '探索型', lowLabel: '构建型' },
    s: { high: 'S', low: 'I', highLabel: '连接者', lowLabel: '独行者' },
};

const DIMENSION_NAMES: Record<string, string> = {
    v: '信息摄取', d: '思维定向', p: '执行动能', s: '协作生态',
};

const ARCHETYPE_NAMES: Record<string, string> = {
    'VDPS': '布道师', 'VDPI': '发明家', 'VDBS': '造梦师', 'VDBI': '哲学家',
    'VCPS': '指挥官', 'VCPI': '先锋', 'VCBS': '元帅', 'VCBI': '建筑师',
    'ODPS': '炼金师', 'ODPI': '侦探', 'ODBS': '大使', 'ODBI': '猎手',
    'OCPS': '操盘手', 'OCPI': '工匠', 'OCBS': '总管', 'OCBI': '督察',
};

function getPole(score: number, key: string): string {
    const pole = POLES[key];
    return score > 50 ? pole.highLabel : pole.lowLabel;
}

function getPoleCode(score: number, key: string): string {
    const pole = POLES[key];
    return score > 50 ? pole.high : pole.low;
}

// ==================== 偏差计算 ====================

function classifyGap(gap: number): { type: DimensionDivergence['type']; label: string } {
    if (Math.abs(gap) < 10) return { type: 'consistent', label: '✅ 一致' };
    if (gap > 0) return { type: 'overestimate', label: '⚠️ 高估' };
    return { type: 'underestimate', label: '💡 低估' };
}

function computeDivergences(
    stated: { v: number; d: number; p: number; s: number },
    behavioral: { v: number; d: number; p: number; s: number },
): DimensionDivergence[] {
    return (['v', 'd', 'p', 's'] as const).map(key => {
        const gap = stated[key] - behavioral[key];
        const { type, label } = classifyGap(gap);
        return {
            dimension: DIMENSION_NAMES[key],
            dimensionKey: key.toUpperCase(),
            stated: stated[key],
            behavioral: behavioral[key],
            gap,
            type,
            label,
            statedPole: getPole(stated[key], key),
            behavioralPole: getPole(behavioral[key], key),
        };
    });
}

// ==================== AI 洞察生成 ====================

async function generateInsights(
    dimensions: DimensionDivergence[],
    statedArchetypeName: string,
    behavioralArchetypeName: string,
): Promise<DivergenceInsight[]> {
    const divergentDims = dimensions.filter(d => d.type !== 'consistent');

    if (divergentDims.length === 0) {
        return [{
            title: '高度一致',
            body: '你的对话画像和行为画像高度一致，说明你对自己的思维方式有非常准确的认知。这是一种难得的自我洞察力。',
            type: 'discovery',
        }];
    }

    const dimSummary = dimensions.map(d =>
        `${d.dimension}(${d.dimensionKey}): 对话=${d.stated}, 行为=${d.behavioral}, 偏差=${d.gap > 0 ? '+' : ''}${d.gap} (${d.label})`
    ).join('\n');

    const prompt = `你是一位创新人格分析专家。基于以下偏差数据，生成3条有冲击力的洞察。

## 偏差数据

对话画像原型：${statedArchetypeName}
行为画像原型：${behavioralArchetypeName}

四维偏差：
${dimSummary}

## 输出要求

输出严格的 JSON 数组，每条洞察包含 title（10字以内标题）、body（50-80字说明）、type（overestimate/underestimate/discovery）。

要求：
- 用第二人称"你"
- 语气像一个智慧的朋友在分享观察，不要说教
- 聚焦偏差最大的维度
- 提供可操作的建议
- 如果有负向偏差（低估自己），要给予鼓励

输出纯 JSON 数组，不要有其他内容：
[{"title": "...", "body": "...", "type": "..."}]`;

    try {
        const { text } = await callAIRaw(prompt, 'minimax', 20000, undefined, undefined, undefined, 1024, 0.7);
        const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
        const insights: DivergenceInsight[] = JSON.parse(cleaned);
        return insights.slice(0, 3);
    } catch (error: unknown) {
        console.warn('[Divergence] AI 洞察生成失败，使用默认:', (error instanceof Error ? error.message : String(error)));
        // 降级：基于规则生成
        return divergentDims.slice(0, 3).map(d => ({
            title: d.type === 'overestimate'
                ? `${d.dimension}偏差`
                : `${d.dimension}发现`,
            body: d.type === 'overestimate'
                ? `你在对话中表现出${d.statedPole}倾向（${d.stated}分），但行为数据显示你更偏${d.behavioralPole}（${d.behavioral}分）。真实的你可能和你以为的有些不一样。`
                : `你对自己的${d.dimension}评价偏低（${d.stated}分），但行为数据显示你的实际表现更好（${d.behavioral}分）。你可能低估了自己在这方面的能力。`,
            type: d.type === 'consistent' ? 'discovery' : d.type,
        }));
    }
}

// ==================== 核心：生成偏差报告 ====================

export async function analyzeDivergence(userId: string): Promise<DivergenceReport | null> {
    try {
        // 读取画像
        const { data: profile, error } = await adminDb
            .from('user_idea_profile')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !profile) {
            console.warn('[Divergence] 无法读取画像:', error?.message);
            return null;
        }

        // 检查是否已解锁
        if (!profile.divergence_unlocked) {
            return null;
        }

        // 如果已有缓存的报告且未过期（24小时内），直接返回
        if (profile.divergence_report) {
            const cached = profile.divergence_report as DivergenceReport;
            const cacheAge = Date.now() - new Date(cached.generatedAt).getTime();
            if (cacheAge < 24 * 60 * 60 * 1000) {
                return cached;
            }
        }

        // 计算偏差
        const stated = {
            v: profile.stated_v || 50,
            d: profile.stated_d || 50,
            p: profile.stated_p || 50,
            s: profile.stated_s || 50,
        };
        const behavioral = {
            v: profile.behavioral_v || 50,
            d: profile.behavioral_d || 50,
            p: profile.behavioral_p || 50,
            s: profile.behavioral_s || 50,
        };

        const dimensions = computeDivergences(stated, behavioral);

        // 原型代码
        const statedArchetype = profile.stated_archetype || 'OCBI';
        const behavioralArchetypeCode = `${behavioral.v > 50 ? 'V' : 'O'}${behavioral.d > 50 ? 'D' : 'C'}${behavioral.p > 50 ? 'P' : 'B'}${behavioral.s > 50 ? 'S' : 'I'}`;

        const statedArchetypeName = ARCHETYPE_NAMES[statedArchetype] || statedArchetype;
        const behavioralArchetypeName = ARCHETYPE_NAMES[behavioralArchetypeCode] || behavioralArchetypeCode;

        // 生成 AI 洞察
        const insights = await generateInsights(dimensions, statedArchetypeName, behavioralArchetypeName);

        const report: DivergenceReport = {
            statedArchetype,
            statedArchetypeName,
            behavioralArchetype: behavioralArchetypeCode,
            behavioralArchetypeName,
            finalArchetype: profile.final_archetype || statedArchetype,
            finalArchetypeName: ARCHETYPE_NAMES[profile.final_archetype] || profile.final_archetype_name || '',
            confidence: profile.confidence || 0.5,
            dimensions,
            insights,
            generatedAt: new Date().toISOString(),
        };

        // 缓存到数据库
        await adminDb
            .from('user_idea_profile')
            .update({
                divergence_report: report as unknown as Record<string, unknown>,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

        console.log(`[Divergence] 偏差报告已生成: ${statedArchetypeName} vs ${behavioralArchetypeName}`);
        return report;
    } catch (error: unknown) {
        console.error('[Divergence] 偏差分析异常:', (error instanceof Error ? error.message : String(error)));
        return null;
    }
}
