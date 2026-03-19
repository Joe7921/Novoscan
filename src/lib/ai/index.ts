/**
 * AI 模块统一导出入口
 *
 * @module lib/ai
 */

// === 核心类型（从 registry 导出） ===
export type { ProviderConfig, StreamChunkResult, CallOpts } from './registry';
export { PROVIDER_REGISTRY } from './registry';

// === 统一调用引擎 ===
export { callProvider } from './engine';

// === DeepSeek R1 ===
export { callDeepSeekR1 } from './r1';

// === 模型降级链 ===
export { buildModelChain, isProviderAvailable } from './fallback-chain';

// === JSON 解析器 ===
export { parseAgentJSON, extractJSON } from './json-parser';

// === AIAnalysisResult 类型（原 ai-client.ts 导出，保持兼容） ===
export interface AIAnalysisResult {
    noveltyScore: number;
    internetNoveltyScore: number;
    similarPapers: Array<{
        title: string;
        year: string | number;
        similarityScore: number;
        keyDifference: string;
        citation: string;
        authors?: string;
        url?: string;
        description?: string;
        citationCount?: number;
        venue?: string;
    }>;
    internetSources: Array<{
        title: string;
        url: string;
        summary: string;
        type: 'Github' | 'News' | 'Blog' | 'Product' | 'Forum' | 'Other';
    }>;
    sections: {
        academic: {
            title: string;
            subsections: Array<{
                title: string;
                content: string;
                keyHighlight?: string;
            }>;
        };
        internet: {
            title: string;
            subsections: Array<{
                title: string;
                content: string;
                keyHighlight?: string;
            }>;
        };
    };
    keyPoints: string[];
    keyDifferentiators?: string;
    improvementSuggestions?: string;
    isPartial?: boolean;
    academicReview?: any;
    industryAnalysis?: any;
    innovationEvaluation?: any;
    competitorAnalysis?: any;
    arbitration?: any;
    qualityCheck?: any;
    executionRecord?: any;
}

// === callAIRaw — 通用 AI 调用（返回原始文本） ===
import type { ModelProvider } from '@/types';
import { callProvider } from './engine';
import { PROVIDER_REGISTRY } from './registry';
import { buildModelChain } from './fallback-chain';

/** Prompt 最大长度（字符数），超过时自动截断以避免 token 超限 */
const DEFAULT_MAX_PROMPT_LENGTH = 100000;

export async function callAIRaw(
    prompt: string,
    preferredModel: ModelProvider = 'minimax',
    timeoutMs: number = 30000,
    maxPromptLength: number = DEFAULT_MAX_PROMPT_LENGTH,
    onStream?: (chunk: string, isReasoning: boolean) => void,
    abortSignal?: AbortSignal,
    maxOutputTokens: number = 8192,
    temperature: number = 0.7,
    priority: 'high' | 'low' = 'high'
): Promise<{ text: string, usedModel: string }> {
    // 自动截断超长 prompt
    let safePrompt = prompt;
    if (prompt.length > maxPromptLength) {
        console.warn(`[AI Client Raw] ⚠️ Prompt 过长 (${prompt.length} chars)，截断至 ${maxPromptLength} chars`);
        safePrompt = prompt.slice(0, maxPromptLength) + '\n\n[... 内容已截断以适应模型上下文窗口 ...]';
    }

    const modelChain = await buildModelChain(preferredModel);
    const MAX_RETRIES = 1;
    let lastError: Error | null = null;

    for (const option of modelChain) {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (abortSignal?.aborted) {
                    const abortErr = new Error('External abort: 编排器已超时取消此 Agent');
                    abortErr.name = 'AbortError';
                    throw abortErr;
                }
                const tag = attempt > 0 ? ` (retry ${attempt})` : '';
                console.log(`[AI Client Raw] Trying model: ${option.name}${tag}`);
                const providerConfig = PROVIDER_REGISTRY[option.id];
                const rawResult = await callProvider(providerConfig, safePrompt, option.model, timeoutMs, onStream, abortSignal, maxOutputTokens, temperature);
                console.log(`[AI Client Raw] Successfully got response from ${option.name}`);
                return { text: rawResult, usedModel: option.name };
            } catch (err: any) {
                console.warn(`[AI Client Raw] Model ${option.name} attempt ${attempt + 1} failed:`, err.message);
                lastError = err;
                if (err.name === 'AbortError' || err.message?.includes('External abort')) {
                    throw err;
                }
                if (attempt < MAX_RETRIES) {
                    if (abortSignal?.aborted) {
                        const abortErr2 = new Error('External abort: 编排器已超时取消此 Agent (重试前检测)');
                        abortErr2.name = 'AbortError';
                        throw abortErr2;
                    }
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        }
    }
    throw new Error(`All AI models failed (raw). Last error: ${lastError?.message}`);
}

// === callAIWithFallback — 调用并解析 JSON ===
export async function callAIWithFallback(prompt: string, preferredModel: ModelProvider = 'minimax'): Promise<{ analysis: AIAnalysisResult, usedModel: string }> {
    const modelChain = await buildModelChain(preferredModel);

    let lastError: Error | null = null;
    for (const option of modelChain) {
        try {
            console.log(`[AI Client] Trying model: ${option.name} (${option.model})`);
            const providerConfig = PROVIDER_REGISTRY[option.id];
            const rawResult = await callProvider(providerConfig, prompt, option.model);

            const { extractJSON: extract } = await import('./json-parser');
            const analysis = extract(rawResult);
            console.log(`[AI Client] Successfully got response from ${option.name}`);
            return { analysis, usedModel: option.name };
        } catch (err: any) {
            console.warn(`[AI Client] Model ${option.name} failed:`, err.message);
            lastError = err;
        }
    }

    throw new Error(`All AI models failed. Last error: ${lastError?.message}`);
}
