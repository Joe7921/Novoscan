/**
 * CaseVault — AI 案例润色器
 *
 * 使用 Gemini Flash（成本最低）对采集到的原始案例进行：
 *   1. 结构化提取（行业、技术栈、能力点、成熟度）
 *   2. 语言润色（统一摘要格式）
 *   3. 质量评分（自动过滤低质量内容）
 *
 * 成本控制：
 *   - 批量处理：多条案例合并为 1 次 AI 调用
 *   - 单次最多润色 8 条（避免 prompt 过长）
 *   - 使用 Gemini Flash（最便宜的模型）
 *   - 质量 < 20 的自动丢弃，不存库
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';

import type { HarvestedCase } from './harvester';

// ==================== 润色结果类型 ====================

export interface PolishedCase {
    title: string;                 // 润色后的标题
    summary: string;               // 200字内的结构化摘要
    original_content: string;      // 原始采集内容
    source_url: string;            // 来源 URL
    source_type: 'wechat' | 'web' | 'github' | 'user_idea';
    industry: string;              // 行业分类
    tags: string[];                // 标签数组
    capabilities: string[];        // 核心能力点
    technology_stack: string[];    // 技术栈
    deployment_scale?: string;     // 部署规模
    maturity: 'concept' | 'poc' | 'production' | 'scale';
    quality_score: number;         // 0-100 质量评分
    author?: string;
    publish_date?: string;
}

// ==================== 内部 AI 输出格式 ====================

interface AIPolishOutput {
    cases: Array<{
        index: number;
        title: string;
        summary: string;
        industry: string;
        tags: string[];
        capabilities: string[];
        technology_stack: string[];
        maturity: 'concept' | 'poc' | 'production' | 'scale';
        quality_score: number;
        deployment_scale?: string;
    }>;
}

// ==================== 配置 ====================

/** 单批次最多润色的案例数量 */
const MAX_BATCH_SIZE = 8;

/** 质量评分低于此阈值的案例将被丢弃 */
const QUALITY_THRESHOLD = 20;

/** AI 调用超时（毫秒）— 后台任务不着急，给充裕时间 */
const POLISH_TIMEOUT_MS = 60000;

// ==================== 润色入口 ====================

/**
 * 批量润色采集到的案例
 *
 * 将最多 8 条案例合并为 1 次 AI 调用，极大节省成本。
 * 返回润色后通过质量门槛的案例。
 */
export async function polishCases(
    rawCases: HarvestedCase[],
    isUserIdea: boolean = false,
): Promise<PolishedCase[]> {
    if (rawCases.length === 0) return [];

    // 截取最多 MAX_BATCH_SIZE 条
    const batch = rawCases.slice(0, MAX_BATCH_SIZE);
    console.log(`[CaseVault/Polisher] 🪄 开始润色 ${batch.length} 条案例 (isUserIdea=${isUserIdea})`);

    // 构建 prompt
    const casesText = batch.map((c, i) => {
        let text = `[案例-${i}]\n标题: ${c.title}\n内容: ${c.snippet.slice(0, 300)}`;
        if (c.source_type === 'github') {
            text += `\n来源: GitHub | 星标: ${c.stars ?? '?'} | 语言: ${c.language ?? '?'}`;
        }
        if (c.author) text += `\n作者/来源: ${c.author}`;
        return text;
    }).join('\n\n');

    const prompt = `你是 CaseVault 案例结构化引擎。请对以下 ${batch.length} 条原始案例进行结构化提取和质量评估。

## 原始案例
${casesText}

## 任务
对每条案例提取以下信息并返回 JSON：

\`\`\`json
{
  "cases": [
    {
      "index": 0,
      "title": "润色后的简洁标题（20字内）",
      "summary": "200字内的结构化中文摘要，说明这个案例做了什么、解决了什么问题",
      "industry": "行业分类（如：软件开发/金融/教育/医疗/零售/制造/通用）",
      "tags": ["标签1", "标签2", "标签3"],
      "capabilities": ["核心能力1", "核心能力2"],
      "technology_stack": ["技术1", "技术2"],
      "maturity": "concept|poc|production|scale",
      "quality_score": 60,
      "deployment_scale": "个人/团队/企业/（空）"
    }
  ]
}
\`\`\`

## 评分规则（请宽松一些！只要和 AI/编程/自动化相关就给分）
- quality_score 0-100:
  - 90+: 有详细技术方案+实际部署数据的高质量案例
  - 70-89: 有明确技术实现的落地案例或教程
  - 50-69: 与 AI/MCP/Agent/编程自动化相关的有参考价值内容
  - 30-49: 信息有限但涉及相关技术领域的内容
  - 0-29: 纯广告/完全无关内容/信息完全缺失
- maturity 判断:
  - concept: 仅有想法/概念
  - poc: 有原型/Demo/教程
  - production: 已在生产环境使用
  - scale: 大规模部署

## 规则
1. 所有输出必须是中文
2. 只要内容涉及 AI、LLM、Agent、MCP、编程自动化、开发工具中任一话题，就至少给 30 分
3. 只有纯广告或完全不相关的内容才给 0 分
4. tags 最多 5 个，要具体有意义
5. capabilities 描述该案例展示的核心 AI 能力
6. technology_stack 列出涉及的技术栈`;

    try {
        // 使用 minimax 作为首选（响应快+便宜），自动降级到其他可用模型
        const { text, usedModel } = await callAIRaw(
            prompt,
            'minimax',
            POLISH_TIMEOUT_MS,
        );
        console.log(`[CaseVault/Polisher] 🤖 使用模型: ${usedModel}`);

        console.log(`[CaseVault/Polisher] 📝 AI 返回文本长度: ${text.length} chars`);
        console.log(`[CaseVault/Polisher] 📝 AI 返回前 500 字符: ${text.slice(0, 500)}`);

        let parsed: AIPolishOutput;
        try {
            parsed = parseAgentJSON<AIPolishOutput>(text);
        } catch (parseErr: unknown) {
            const parseMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
            console.error(`[CaseVault/Polisher] ❌ JSON 解析失败: ${parseMsg}`);
            console.error(`[CaseVault/Polisher] 📝 原始文本: ${text.slice(0, 1000)}`);
            return [];
        }

        if (!parsed?.cases || !Array.isArray(parsed.cases)) {
            console.warn('[CaseVault/Polisher] AI 返回格式不正确, parsed:', JSON.stringify(parsed).slice(0, 300));
            return [];
        }

        console.log(`[CaseVault/Polisher] 📊 AI 返回 ${parsed.cases.length} 条案例评分:`);
        for (const c of parsed.cases) {
            console.log(`  [${c.index}] "${c.title}" → score=${c.quality_score}, maturity=${c.maturity}`);
        }

        // 将 AI 输出与原始数据合并，并过滤低质量
        const polished: PolishedCase[] = [];

        for (const aiCase of parsed.cases) {
            const idx = aiCase.index;
            if (idx < 0 || idx >= batch.length) {
                console.log(`[CaseVault/Polisher] ⚠️ 跳过无效索引: ${idx}`);
                continue;
            }

            // 质量门槛
            if (aiCase.quality_score < QUALITY_THRESHOLD) {
                console.log(`[CaseVault/Polisher] 🗑️ 丢弃低质量案例: "${aiCase.title}" (score=${aiCase.quality_score})`);
                continue;
            }

            const raw = batch[idx];
            polished.push({
                title: aiCase.title || raw.title,
                summary: aiCase.summary || raw.snippet.slice(0, 200),
                original_content: raw.snippet,
                source_url: raw.url,
                source_type: isUserIdea ? 'user_idea' : raw.source_type as PolishedCase['source_type'],
                industry: aiCase.industry || '通用',
                tags: (aiCase.tags || []).slice(0, 5),
                capabilities: aiCase.capabilities || [],
                technology_stack: aiCase.technology_stack || [],
                deployment_scale: aiCase.deployment_scale,
                maturity: aiCase.maturity || 'concept',
                quality_score: Math.min(100, Math.max(0, Math.round(aiCase.quality_score))),
                author: raw.author,
                publish_date: raw.publishDate,
            });
        }

        console.log(`[CaseVault/Polisher] ✅ 润色完成: ${polished.length}/${batch.length} 通过质量门槛 (阈值=${QUALITY_THRESHOLD})`);
        return polished;
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[CaseVault/Polisher] ❌ AI 润色失败: ${msg}`);
        return [];
    }
}
