/**
 * AI 提供商注册表 — 类型定义与所有提供商配置
 *
 * 新增提供商只需在此文件中添加一个配置对象（~25 行）
 *
 * @module lib/ai/registry
 */

import type { ModelProvider } from '@/types';
import type { CostProvider } from '@/lib/stubs';

// ==================== 类型定义 ====================

/** 流式 chunk 解析结果 */
export interface StreamChunkResult {
    content: string;
    reasoning?: string;
    finishReason?: string;
}

/** 提供商调用选项 */
export interface CallOpts {
    temperature: number;
    maxOutputTokens: number;
    stream: boolean;
}

/** 提供商配置——每个 AI 厂商的差异点全部集中在此 */
export interface ProviderConfig {
    id: ModelProvider;
    /** 环境变量名：API Key */
    envApiKey: string;
    /** 环境变量名：备用 API Key（可选，容灾切换用） */
    envApiKeyBackup?: string;
    /** 环境变量名：Base URL */
    envBaseUrl: string;
    /** 环境变量名：模型覆盖（可选） */
    envModel?: string;
    /** 默认 Base URL */
    defaultBaseUrl: string;
    /** 成本限制器 ID */
    costProvider: CostProvider;
    /** 构建完整请求 URL */
    buildUrl: (baseUrl: string, model: string, isStreaming: boolean) => string;
    /** 构建请求头 */
    buildHeaders: (apiKey: string) => Record<string, string>;
    /** 构建请求体 */
    buildBody: (prompt: string, model: string, opts: CallOpts) => object;
    /** 解析非流式响应 */
    parseResponse: (data: any) => string;
    /** 解析流式 SSE chunk */
    parseStreamChunk: (parsed: any) => StreamChunkResult;
}

// ==================== 工具函数 ====================

/**
 * 智能构建 OpenAI 兼容 URL
 * 防止路径被重复拼接（如 baseUrl 已包含 /v1 或完整路径）
 */
function buildOpenAICompatibleUrl(baseUrl: string): string {
    const trimmed = baseUrl.replace(/\/+$/, '');
    // 如果已经包含完整路径 /chat/completions，直接返回
    if (trimmed.endsWith('/chat/completions')) return trimmed;
    // 如果已经包含 /v1，只需拼接 /chat/completions
    if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
    // 通用兜底：直接拼接 /chat/completions
    return `${trimmed}/chat/completions`;
}

// ==================== 提供商注册表 ====================

/** 所有已注册的 AI 提供商配置 */
export const PROVIDER_REGISTRY: Partial<Record<ModelProvider, ProviderConfig>> & Record<'deepseek' | 'minimax' | 'moonshot' | 'ollama', ProviderConfig> = {

    // ─── DeepSeek（OpenAI 兼容 + reasoning_content 特性） ───
    deepseek: {
        id: 'deepseek',
        envApiKey: 'DEEPSEEK_API_KEY',
        envBaseUrl: 'DEEPSEEK_BASE_URL',
        envModel: 'DEEPSEEK_MODEL',
        defaultBaseUrl: 'https://api.deepseek.com',
        costProvider: 'deepseek',
        buildUrl: (baseUrl, _model, _isStreaming) => buildOpenAICompatibleUrl(baseUrl),
        buildHeaders: (apiKey) => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        }),
        buildBody: (prompt, model, opts) => ({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: opts.temperature,
            max_tokens: opts.maxOutputTokens,
            stream: opts.stream,
        }),
        parseResponse: (data) =>
            data.choices?.[0]?.message?.content || '',
        parseStreamChunk: (parsed) => {
            const choice = parsed.choices?.[0];
            return {
                content: choice?.delta?.content || '',
                reasoning: choice?.delta?.reasoning_content || '',
                finishReason: choice?.finish_reason || undefined,
            };
        },
    },

    // ─── Minimax（OpenAI 兼容） ───
    minimax: {
        id: 'minimax',
        envApiKey: 'MINIMAX_API_KEY',
        envBaseUrl: 'MINIMAX_BASE_URL',
        envModel: 'MINIMAX_MODEL',
        defaultBaseUrl: 'https://api.minimaxi.com/v1',
        costProvider: 'minimax',
        buildUrl: (baseUrl, _model, _isStreaming) => buildOpenAICompatibleUrl(baseUrl),
        buildHeaders: (apiKey) => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        }),
        buildBody: (prompt, model, opts) => ({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: opts.temperature,
            max_tokens: opts.maxOutputTokens,
            stream: opts.stream,
        }),
        parseResponse: (data) =>
            data.choices?.[0]?.message?.content || '',
        parseStreamChunk: (parsed) => {
            const choice = parsed.choices?.[0];
            return {
                content: choice?.delta?.content || '',
                finishReason: choice?.finish_reason || undefined,
            };
        },
    },

    // ─── Moonshot Kimi（OpenAI 兼容，国内 CN 节点） ───
    moonshot: {
        id: 'moonshot',
        envApiKey: 'MOONSHOT_API_KEY',
        envBaseUrl: 'MOONSHOT_BASE_URL',
        envModel: 'MOONSHOT_MODEL',
        defaultBaseUrl: 'https://api.moonshot.cn/v1',
        costProvider: 'moonshot',
        buildUrl: (baseUrl, _model, _isStreaming) => buildOpenAICompatibleUrl(baseUrl),
        buildHeaders: (apiKey) => ({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        }),
        buildBody: (prompt, model, opts) => ({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: opts.temperature,
            max_tokens: opts.maxOutputTokens,
            stream: opts.stream,
        }),
        parseResponse: (data) =>
            data.choices?.[0]?.message?.content || '',
        parseStreamChunk: (parsed) => {
            const choice = parsed.choices?.[0];
            return {
                content: choice?.delta?.content || '',
                finishReason: choice?.finish_reason || undefined,
            };
        },
    },

    // ─── Ollama 本地 AI（零 API Key 成本，OpenAI 兼容） ───
    ollama: {
        id: 'ollama',
        envApiKey: 'OLLAMA_API_KEY',      // 可以为空，Ollama 默认无需鉴权
        envBaseUrl: 'OLLAMA_BASE_URL',
        envModel: 'OLLAMA_MODEL',
        defaultBaseUrl: 'http://localhost:11434/v1',
        costProvider: 'ollama',
        buildUrl: (baseUrl, _model, _isStreaming) => buildOpenAICompatibleUrl(baseUrl),
        buildHeaders: (apiKey) => ({
            'Content-Type': 'application/json',
            ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        }),
        buildBody: (prompt, model, opts) => ({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: opts.temperature,
            max_tokens: opts.maxOutputTokens,
            stream: opts.stream,
        }),
        parseResponse: (data) =>
            data.choices?.[0]?.message?.content || '',
        parseStreamChunk: (parsed) => {
            const choice = parsed.choices?.[0];
            return {
                content: choice?.delta?.content || '',
                reasoning: choice?.delta?.reasoning_content || '',
                finishReason: choice?.finish_reason || undefined,
            };
        },
    },
};
