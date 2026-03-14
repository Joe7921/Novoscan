/**
 * Bizscan 商业想法创新度查重 — 想法解析引擎
 *
 * 职责：
 * 1. PII 脱敏管道 — 在发送给 AI 之前清洗敏感信息
 * 2. AI 结构化解析 — 从自然语言商业描述中提取结构化要素
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type { ModelProvider } from '@/types';
import type { ParsedBusinessIdea } from '@/types/bizscan';

// ============================================================
//  PII 脱敏管道（基于正则的轻量级实现）
// ============================================================

/** 脱敏计数器（用于生成递增的假名） */
interface AnonymizationContext {
    companyIndex: number;
    personIndex: number;
    locationIndex: number;
}

/**
 * 对商业想法描述进行 PII 脱敏处理
 *
 * 替换规则：
 * - 邮箱 → [EMAIL_N]
 * - 手机号（中国/国际） → [PHONE_N]
 * - 具体金额数字 → 保留（对评估有价值）
 * - URL → [URL_N]
 * - 身份证号/社保号 → [ID_N]
 */
export function anonymizeText(text: string): { cleanText: string; removedCount: number } {
    let cleanText = text;
    let removedCount = 0;

    // 1. 邮箱地址
    cleanText = cleanText.replace(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        () => { removedCount++; return '[EMAIL]'; }
    );

    // 2. 中国大陆手机号
    cleanText = cleanText.replace(
        /(?<!\d)1[3-9]\d{9}(?!\d)/g,
        () => { removedCount++; return '[PHONE]'; }
    );

    // 3. 国际电话号码格式
    cleanText = cleanText.replace(
        /\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
        () => { removedCount++; return '[PHONE]'; }
    );

    // 4. 完整 URL（保留域名的通用描述）
    cleanText = cleanText.replace(
        /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi,
        () => { removedCount++; return '[URL]'; }
    );

    // 5. 中国大陆身份证号（18位）
    cleanText = cleanText.replace(
        /(?<!\d)\d{17}[\dXx](?!\d)/g,
        () => { removedCount++; return '[ID]'; }
    );

    // 6. 银行卡号（16-19位连续数字）
    cleanText = cleanText.replace(
        /(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{0,3}(?!\d)/g,
        (match) => {
            // 排除年份等短数字序列
            const digits = match.replace(/[\s-]/g, '');
            if (digits.length >= 16 && digits.length <= 19) {
                removedCount++;
                return '[CARD]';
            }
            return match;
        }
    );

    if (removedCount > 0) {
        console.log(`[Bizscan/IdeaParser] PII 脱敏: 替换了 ${removedCount} 处敏感信息`);
    }

    return { cleanText, removedCount };
}

// ============================================================
//  AI 结构化解析
// ============================================================

/**
 * 使用 AI 解析商业想法，提取结构化商业要素
 *
 * 单次 AI 调用完成全部提取，减少延迟和成本
 */
export async function parseBusinessIdea(
    ideaDescription: string,
    targetMarket?: string,
    businessModel?: string,
    industryVertical?: string,
    modelProvider: ModelProvider = 'minimax',
): Promise<ParsedBusinessIdea> {
    // 1. PII 脱敏
    const { cleanText } = anonymizeText(ideaDescription);

    // 2. 构建 Prompt
    const contextParts: string[] = [];
    if (targetMarket) contextParts.push(`目标市场：${targetMarket}`);
    if (businessModel) contextParts.push(`商业模式：${businessModel}`);
    if (industryVertical) contextParts.push(`行业领域：${industryVertical}`);
    const contextStr = contextParts.length > 0
        ? `\n\n补充信息：\n${contextParts.join('\n')}`
        : '';

    const prompt = `你是一个商业分析专家引擎。请仔细分析以下商业想法，提取结构化的核心要素。

## 商业想法描述
"${cleanText}"${contextStr}

## 任务
从上述描述中提取以下要素，严格返回 JSON 格式（不要包含任何其他文字）：

\`\`\`json
{
  "problemStatement": "这个想法试图解决什么具体问题（1-2句话）",
  "proposedSolution": "提出了什么解决方案（1-2句话）",
  "targetCustomer": "目标客户画像（谁会为此付费）",
  "valueProposition": "核心价值主张（为什么客户要选择这个方案）",
  "revenueModel": "盈利模式（如何赚钱：订阅/交易佣金/广告等）",
  "keyDifferentiators": ["差异化亮点1", "差异化亮点2", "差异化亮点3"],
  "industryTags": ["行业标签1", "行业标签2"],
  "technologyStack": ["涉及的关键技术1", "关键技术2"],
  "searchKeywords": ["英文关键词1", "英文关键词2", "英文关键词3", "中文行业术语1", "中文行业术语2", "中文行业术语3"]
}
\`\`\`

规则：
1. problemStatement 和 proposedSolution 必须简洁明了
2. searchKeywords 必须包含 **6-10 个**适合搜索竞品的关键词，且**必须同时包含英文关键词和中文行业术语**：
   - 英文关键词：用于搜索海外竞品（如 "AI quality inspection SaaS"、"visual defect detection"）
   - 中文行业术语：用于搜索国内竞品（如 "AI质检"、"机器视觉质检"、"工业缺陷检测"）
3. industryTags 使用标准行业分类术语
4. 如果信息不足以推断某个字段，用合理的推测填充，不要留空
5. keyDifferentiators 提取 2-5 个
6. 全部字段必须有值`;

    console.log(`[Bizscan/IdeaParser] 开始 AI 解析 (${modelProvider})`);

    try {
        const { text } = await callAIRaw(prompt, modelProvider, 25000);
        const parsed = parseAgentJSON<ParsedBusinessIdea>(text);

        if (parsed && parsed.problemStatement && parsed.searchKeywords) {
            // 确保 searchKeywords 为数组且有内容
            if (!Array.isArray(parsed.searchKeywords) || parsed.searchKeywords.length === 0) {
                parsed.searchKeywords = extractFallbackKeywords(cleanText);
            }
            // 确保其他数组字段存在
            parsed.keyDifferentiators = parsed.keyDifferentiators || [];
            parsed.industryTags = parsed.industryTags || [];
            parsed.technologyStack = parsed.technologyStack || [];

            console.log(`[Bizscan/IdeaParser] 解析成功: ${parsed.searchKeywords.length} 个关键词`);
            return parsed;
        }

        throw new Error('AI 返回的解析结果不完整');
    } catch (error: any) {
        console.warn(`[Bizscan/IdeaParser] AI 解析失败，使用降级策略: ${error.message}`);
        return createFallbackParsedIdea(cleanText, targetMarket, businessModel, industryVertical);
    }
}

// ============================================================
//  降级策略
// ============================================================

/**
 * 从文本中提取基础关键词（降级用）
 */
function extractFallbackKeywords(text: string): string[] {
    // 中英文停用词
    const stopWords = new Set([
        '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一个',
        '可以', '能', '想', '做', '通过', '使用', '进行', '提供', '基于', '实现',
        'the', 'a', 'an', 'is', 'are', 'to', 'for', 'and', 'of', 'in', 'on',
        'with', 'that', 'this', 'by', 'from', 'or', 'as', 'at', 'be', 'it',
    ]);

    const words = text
        .replace(/[，。！？、；：""''（）《》【】\[\]{}(),.!?;:"'<>]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 2 && !stopWords.has(w.toLowerCase()));

    // 去重并取前 8 个
    return Array.from(new Set(words)).slice(0, 8);
}

/**
 * AI 失败时的降级解析结果
 */
function createFallbackParsedIdea(
    text: string,
    targetMarket?: string,
    businessModel?: string,
    industryVertical?: string,
): ParsedBusinessIdea {
    const keywords = extractFallbackKeywords(text);
    const summary = text.slice(0, 200);

    return {
        problemStatement: `用户描述了一个商业想法: ${summary}...`,
        proposedSolution: summary,
        targetCustomer: targetMarket || '待确认',
        valueProposition: '待 AI 深度分析',
        revenueModel: businessModel || '待确认',
        keyDifferentiators: [],
        industryTags: industryVertical ? [industryVertical] : ['综合'],
        technologyStack: [],
        searchKeywords: keywords,
    };
}
