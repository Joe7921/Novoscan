/**
 * 追问问题生成器
 *
 * 基于初次检索结果和仲裁报告，使用 AI 生成 3-5 条精准的追问问题，
 * 帮助用户在第二轮检索中细化和聚焦分析方向。
 */
import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { ModelProvider } from '@/types';

/** 追问问题分类 */
export type FollowUpCategory = 'tech' | 'scenario' | 'compare' | 'exclude' | 'challenge';

/** 单条追问问题 */
export interface FollowUpQuestion {
    id: string;
    question: string;
    category: FollowUpCategory;
    hint: string;       // 提示用户为什么要沿此方向追问
    icon: string;       // Emoji 图标
}

/** 分类元信息 */
const CATEGORY_META: Record<FollowUpCategory, { labelZh: string; labelEn: string; icon: string }> = {
    tech: { labelZh: '技术路线', labelEn: 'Tech Route', icon: '🔬' },
    scenario: { labelZh: '场景深挖', labelEn: 'Scenario', icon: '🎯' },
    compare: { labelZh: '竞品对比', labelEn: 'Comparison', icon: '⚖️' },
    exclude: { labelZh: '排除干扰', labelEn: 'Exclusion', icon: '🚫' },
    challenge: { labelZh: '灵幻拷问', labelEn: 'Challenge', icon: '👻' },
};

export { CATEGORY_META };

/**
 * 根据首次搜索结果生成追问问题建议
 */
export async function generateFollowUpQuestions(
    query: string,
    arbitrationSummary: string,
    keyFindings: string[],
    redFlags: string[],
    language: 'zh' | 'en',
    modelProvider: ModelProvider
): Promise<FollowUpQuestion[]> {
    const isZh = language === 'zh';

    const prompt = `
# 系统角色

你是一位专精于创新性评估的研究顾问，擅长引导和精化检索方向。

# 任务

根据用户首次检索的分析结果，生成追问问题列表帮助用户进一步细化和聚焦分析方向。

## 用户原始查询
**"${query}"**

## 仲裁员摘要
${arbitrationSummary}

## 关键发现
${keyFindings.slice(0, 5).map((f, i) => `${i + 1}. ${f}`).join('\n')}

## 风险信号
${redFlags.slice(0, 3).map((f, i) => `${i + 1}. ${f}`).join('\n') || '无'}

# 追问类型说明

1. **tech**：技术路线追问，帮助用户深入特定技术细节或算法选择
2. **scenario**：场景深挖追问，帮助用户聚焦不同应用场景和行业领域
3. **compare**：竞品对比追问，帮助用户比较竞品和类似方案差异
4. **exclude**：排除干扰追问，帮助用户排除不相关领域减少噪音
5. **challenge**：灵幻拷问，从用户/市场角度发出灵魂拷问——“凭什么用你？”，审视方案的不可替代性、护城河、用户迁移成本与真实价值主张

# 撰写规范

- 生成 5 条追问建议，覆盖至少 4 种不同分类，其中必须包含至少 1 条 challenge 类型
- challenge 类型的追问应尖锐、直击痛点，用“灵魂拷问”的口吻逼迫用户正视方案的真正竞争力和不可替代性
- hint 需简短解释沿此方向追问的理由
- icon 使用对应分类的 Emoji：${isZh ? '🔬技术、🎯场景、⚖️对比、🚫排除、👻灵幻拷问' : '🔬 tech、🎯 scenario、⚖️ compare、🚫 exclude、👻 challenge'}

# 输出格式

严格按以下 JSON 格式输出，不要有多余内容：
[
  {
    "question": "追问问题文本",
    "category": "tech",
    "hint": "提示说明",
    "icon": "🔬"
  }
]
`;

    try {
        const { text } = await callAIRaw(prompt, modelProvider, 15000, 30000);
        const parsed = parseAgentJSON<Array<{ question: string; category: string; hint: string; icon: string }>>(text);

        if (!Array.isArray(parsed) || parsed.length === 0) {
            console.warn('[追问生成器] AI 返回结果解析为空，使用兜底问题');
            return generateFallbackQuestions(query, isZh);
        }

        return parsed.slice(0, 5).map((item, idx) => ({
            id: `fq_${Date.now()}_${idx}`,
            question: item.question || '',
            category: (['tech', 'scenario', 'compare', 'exclude', 'challenge'].includes(item.category)
                ? item.category
                : 'tech') as FollowUpCategory,
            hint: item.hint || '',
            icon: CATEGORY_META[item.category as FollowUpCategory]?.icon || '🔍',
        }));
    } catch (err: any) {
        console.error('[追问生成器] AI 调用失败，使用兜底追问:', err.message);
        return generateFallbackQuestions(query, isZh);
    }
}

/**
 * 生成兜底追问问题（AI 调用失败时使用）
 */
function generateFallbackQuestions(query: string, isZh: boolean): FollowUpQuestion[] {
    const now = Date.now();
    if (isZh) {
        return [
            {
                id: `fq_${now}_0`,
                question: `"${query}" 具体采用了什么技术路线或算法？`,
                category: 'tech',
                hint: '明确技术细节有助于更精准的学术匹配',
                icon: '🔬',
            },
            {
                id: `fq_${now}_1`,
                question: `该创新主要面向哪个行业或应用场景？`,
                category: 'scenario',
                hint: '不同领域有不同的创新标准',
                icon: '🎯',
            },
            {
                id: `fq_${now}_2`,
                question: `与现有最接近的解决方案相比，核心区别是什么？`,
                category: 'compare',
                hint: '精确竞品对标可发现差异化优势',
                icon: '⚖️',
            },
            {
                id: `fq_${now}_3`,
                question: `用户凭什么要抛弃现有方案来选择你？你的不可替代性在哪里？`,
                category: 'challenge',
                hint: '灵魂拷问：直面你的护城河与真实竞争力',
                icon: '👻',
            },
        ];
    }
    return [
        {
            id: `fq_${now}_0`,
            question: `What specific technical approach or algorithm does "${query}" use?`,
            category: 'tech',
            hint: 'Clarifying technical details helps with precise academic matching',
            icon: '🔬',
        },
        {
            id: `fq_${now}_1`,
            question: `Which industry or application scenario is this innovation primarily for?`,
            category: 'scenario',
            hint: 'Different domains have different innovation standards',
            icon: '🎯',
        },
        {
            id: `fq_${now}_2`,
            question: `What is the core difference compared to the closest existing solution?`,
            category: 'compare',
            hint: 'Pinpoint your differentiation advantage',
            icon: '⚖️',
        },
        {
            id: `fq_${now}_3`,
            question: `Why should users abandon existing solutions for yours? What makes you irreplaceable?`,
            category: 'challenge',
            hint: 'Soul challenge: face your real moat and competitive edge',
            icon: '👻',
        },
    ];
}