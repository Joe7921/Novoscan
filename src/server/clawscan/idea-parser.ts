/**
 * Clawscan 想法解析引擎
 *
 * 职责：
 * 1. PII 脱敏（复用 Bizscan 模式）
 * 2. AI 结构化解析用户的 OpenClaw 应用构想
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { ModelProvider } from '@/types';
import type { ParsedClawIdea } from '@/types/clawscan';

// ============================================================
//  PII 脱敏
// ============================================================

function anonymizeText(text: string): { cleanText: string; removedCount: number } {
    let cleaned = text;
    let count = 0;

    // 邮箱
    cleaned = cleaned.replace(/[\w.-]+@[\w.-]+\.\w{2,}/g, () => { count++; return '[EMAIL]'; });
    // 手机号
    cleaned = cleaned.replace(/1[3-9]\d{9}/g, () => { count++; return '[PHONE]'; });
    cleaned = cleaned.replace(/\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, () => { count++; return '[PHONE]'; });
    // URL（保留域名用于分析）
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, (url) => { count++; return `[URL:${new URL(url).hostname}]`; });
    // 身份证号
    cleaned = cleaned.replace(/\d{17}[\dxX]/g, () => { count++; return '[ID]'; });

    return { cleanText: cleaned, removedCount: count };
}

// ============================================================
//  AI 结构化解析
// ============================================================

export async function parseClawIdea(
    ideaDescription: string,
    modelProvider: ModelProvider = 'minimax',
): Promise<ParsedClawIdea> {
    console.log(`[Clawscan/Parser] 开始解析想法 (${ideaDescription.length} 字符)`);

    const { cleanText, removedCount } = anonymizeText(ideaDescription);
    if (removedCount > 0) {
        console.log(`[Clawscan/Parser] PII 脱敏: 移除 ${removedCount} 项敏感信息`);
    }

    const prompt = `你是一个 OpenClaw 创新应用分析引擎。请分析以下用户描述的 OpenClaw 应用构想，提取结构化要素。

用户描述：
"${cleanText}"

请严格返回以下 JSON（不要包含任何其他文字）：
\`\`\`json
{
  "coreCapabilities": ["核心能力点1", "核心能力点2", "核心能力点3"],
  "searchKeywords": ["搜索关键词1", "搜索关键词2", "搜索关键词3"],
  "synonyms": ["同义词/英文对照1", "同义词/英文对照2"],
  "platform": "CLI/Web/App/API/Bot/其他",
  "category": "工具/服务/框架/插件/其他",
  "problemStatement": "用户想解决的核心问题（一句话）",
  "targetUser": "目标用户画像（一句话）"
}
\`\`\`

规则：
1. coreCapabilities：3-8 个核心功能/能力点，简洁短语
2. searchKeywords：5-8 个适合网络搜索的关键词，覆盖中英文表达
3. synonyms：每个核心能力的 1-2 个同义表达或英文对照
4. 关键词要包含 "openclaw" "claw" "skill" 等生态专用词
5. 所有中文内容`;

    try {
        const { text } = await callAIRaw(prompt, modelProvider, 20000);
        const parsed = parseAgentJSON<ParsedClawIdea>(text);

        if (parsed && Array.isArray(parsed.coreCapabilities) && Array.isArray(parsed.searchKeywords)) {
            console.log(`[Clawscan/Parser] 解析成功: ${parsed.coreCapabilities.length} 个能力点, ${parsed.searchKeywords.length} 个关键词`);
            return parsed;
        }
        throw new Error('解析结果不完整');
    } catch (err: any) {
        console.warn(`[Clawscan/Parser] AI 解析失败，使用降级策略: ${err.message}`);
        return createFallbackParsedIdea(cleanText);
    }
}

// ============================================================
//  降级策略
// ============================================================

function extractFallbackKeywords(text: string): string[] {
    const cleaned = text
        .replace(/[，。！？、；：""''（）《》【】\[\]{}(),.!?;:"'<>]/g, ' ')
        .toLowerCase();
    const stopWords = new Set(['的', '了', '在', '是', '我', '有', '和', '就', '不', '一', '个', '做', '想', '能', '可以',
        'the', 'a', 'an', 'is', 'are', 'to', 'for', 'with', 'and', 'or', 'i', 'we', 'you']);
    const words = cleaned.split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(w));
    return Array.from(new Set(words)).slice(0, 8);
}

function createFallbackParsedIdea(text: string): ParsedClawIdea {
    const keywords = extractFallbackKeywords(text);
    return {
        coreCapabilities: keywords.slice(0, 5),
        searchKeywords: [...keywords.slice(0, 4), 'openclaw', 'claw skill'],
        synonyms: [],
        platform: '其他',
        category: '工具',
        problemStatement: text.slice(0, 100),
        targetUser: 'OpenClaw 开发者',
    };
}
