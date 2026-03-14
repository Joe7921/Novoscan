/**
 * AI 智能引擎选择器
 *
 * 在所有搜索分析链前运行，基于关键词语言、领域特征，
 * 由 AI 推荐最优的 SerpAPI 搜索引擎组合。
 *
 * 设计原则：
 *   - 共享 SerpAPI 250 次/月配额，智能分配而非全量调用
 *   - AI 调用极简（~150 tokens, 3s 超时），失败自动 fallback 到规则引擎
 *   - 透明日志：打印选择理由，方便调试和配额追踪
 */

import { containsChinese } from './dual-track-utils';

// ==================== 类型 ====================

/** SerpAPI 支持的网页搜索引擎 */
export type SerpEngine = 'google' | 'bing' | 'baidu' | 'duckduckgo';

/** AI 引擎选择结果 */
export interface EngineSelection {
    /** 推荐的网页搜索引擎列表（产业轨道） */
    serpEngines: SerpEngine[];
    /** 是否启用 Google Scholar（学术轨道补充） */
    useScholar: boolean;
    /** 是否启用 Google Trends（热度趋势分析） */
    useTrends: boolean;
    /** 选择理由（AI 生成或 fallback 规则说明） */
    reasoning: string;
    /** 选择方式：ai 或 fallback */
    method: 'ai' | 'fallback';
}

// ==================== AI 智能选择 ====================

/**
 * AI 智能引擎选择器
 *
 * 使用 DeepSeek 极简调用，分析关键词语言和领域特征，
 * 推荐最优搜索引擎组合。
 *
 * @param keywords - 搜索关键词数组
 * @returns EngineSelection
 */
export async function selectSearchEngines(keywords: string[]): Promise<EngineSelection> {
    const query = keywords.join(' ');
    console.log(`[EngineSelector] 🧠 分析关键词: "${query}"`);

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

    if (!apiKey) {
        console.warn('[EngineSelector] DEEPSEEK_API_KEY 未配置，使用规则引擎 fallback');
        return fallbackEngineSelection(keywords);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s 硬超时

    try {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{
                    role: 'user',
                    content: `你是搜索引擎调度专家。分析以下搜索关键词，推荐最优搜索引擎组合。

可选引擎（最多选2个网页搜索引擎，节省配额）：
- google: 全球英文网页搜索（默认首选）
- baidu: 中文内容搜索（中文关键词时强烈推荐）
- bing: 微软生态、技术文档搜索
- duckduckgo: 隐私搜索、去个性化结果

额外数据源（按需开启）：
- scholar: Google Scholar 学术论文搜索（学术/科研/论文类关键词时开启）
- trends: Google Trends 搜索趋势（需要了解技术热度/市场趋势时开启）

关键词: "${query}"

仅返回JSON格式（不要markdown代码块），示例：
{"engines":["google","baidu"],"scholar":true,"trends":false,"reason":"中文技术关键词，百度补充中文源"}`
                }],
                temperature: 0.1,
                max_tokens: 150,
                stream: false,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`[EngineSelector] AI 调用失败 (${response.status})，使用 fallback`);
            return fallbackEngineSelection(keywords);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();

        if (!content) {
            console.warn('[EngineSelector] AI 返回空内容，使用 fallback');
            return fallbackEngineSelection(keywords);
        }

        // 解析 JSON（兼容 AI 可能包裹的 markdown 代码块）
        const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        // 校验 & 提取
        const validEngines: SerpEngine[] = ['google', 'bing', 'baidu', 'duckduckgo'];
        const engines = (parsed.engines || ['google'])
            .filter((e: string) => validEngines.includes(e as SerpEngine))
            .slice(0, 2) as SerpEngine[]; // 最多 2 个网页引擎

        if (engines.length === 0) engines.push('google');

        const selection: EngineSelection = {
            serpEngines: engines,
            useScholar: !!parsed.scholar,
            useTrends: !!parsed.trends,
            reasoning: parsed.reason || 'AI 推荐',
            method: 'ai',
        };

        console.log(`[EngineSelector] 🤖 AI 推荐: 引擎=${selection.serpEngines.join('+')} | Scholar=${selection.useScholar} | Trends=${selection.useTrends} | 理由: ${selection.reasoning}`);
        return selection;

    } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            console.warn('[EngineSelector] AI 调用超时(3s)，使用 fallback');
        } else if (err instanceof SyntaxError) {
            console.warn('[EngineSelector] AI 返回非 JSON 格式，使用 fallback');
        } else {
            console.warn('[EngineSelector] AI 调用异常，使用 fallback:', err.message);
        }
        return fallbackEngineSelection(keywords);
    }
}

// ==================== 规则引擎 Fallback ====================

/**
 * 规则引擎 fallback（AI 失败时的兜底策略）
 *
 * 基于简单规则选择引擎：
 * - 中文关键词 → 百度 + Google
 * - 英文关键词 → Google
 * - 含学术术语 → 启用 Scholar
 * - 默认启用 Trends（低成本高价值）
 */
export function fallbackEngineSelection(keywords: string[]): EngineSelection {
    const query = keywords.join(' ');
    const isChinese = containsChinese(query);

    // 中文关键词：百度 + Google 双引擎
    const serpEngines: SerpEngine[] = isChinese
        ? ['baidu', 'google']
        : ['google'];

    // 学术关键词检测（简单规则）
    const academicTerms = [
        'research', 'paper', 'study', 'algorithm', 'model', 'framework',
        'neural', 'learning', 'optimization', 'analysis',
        '研究', '论文', '算法', '模型', '学术', '优化', '分析', '框架',
        '蛋白质', '基因', '分子', '量子', '纳米', '半导体',
    ];
    const useScholar = academicTerms.some(term =>
        query.toLowerCase().includes(term.toLowerCase())
    );

    // 默认启用 Trends（1次配额，价值高）
    const useTrends = true;

    const reasoning = isChinese
        ? '中文关键词 → 百度+Google 双引擎覆盖'
        : '英文关键词 → Google 搜索';

    console.log(`[EngineSelector] 📋 规则 fallback: 引擎=${serpEngines.join('+')} | Scholar=${useScholar} | Trends=${useTrends}`);

    return {
        serpEngines,
        useScholar,
        useTrends,
        reasoning,
        method: 'fallback',
    };
}
