import { ModelProvider, MODEL_OPTIONS, ModelOption } from '../types';
import { checkCostLimit, CostProvider } from './services/costLimiter';

// ==================== AI 统一适配器 ====================
// 架构：ProviderConfig 注册表 + callProvider 统一引擎
// 新增提供商只需在 PROVIDER_REGISTRY 中添加一个配置对象（~25 行）
// 并发控制由编排器 (orchestrator.ts) 在调度层显式控制

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
    // ===== 透传给前端 UI 展示的原始报告数据 =====
    academicReview?: any;
    industryAnalysis?: any;
    innovationEvaluation?: any;
    competitorAnalysis?: any;
    arbitration?: any;
    qualityCheck?: any;
    executionRecord?: any;
}

// ==================== 统一适配器：类型定义 ====================

/** 流式 chunk 解析结果 */
interface StreamChunkResult {
    content: string;
    reasoning?: string;
    finishReason?: string;
}

/** 提供商调用选项 */
interface CallOpts {
    temperature: number;
    maxOutputTokens: number;
    stream: boolean;
}

/** 提供商配置——每个 AI 厂商的差异点全部集中在此 */
interface ProviderConfig {
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

// ==================== 提供商注册表 ====================

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
    // 适用于 DeepSeek、Ollama (http://localhost:11434) 等无需 /v1 前缀的提供商
    // 如果代理平台需要 /v1 前缀，请在 BASE_URL 中自行包含
    return `${trimmed}/chat/completions`;
}

/** 所有已注册的 AI 提供商配置（Gemini 已下线） */
const PROVIDER_REGISTRY: Partial<Record<ModelProvider, ProviderConfig>> & Record<'deepseek' | 'minimax' | 'moonshot' | 'ollama', ProviderConfig> = {

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

    // ─── Minimax（OpenAI 兼容，CodingPlan 使用 api.minimaxi.com） ───
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

// ==================== 统一引擎：callProvider ====================

/**
 * 统一 AI 调用引擎
 * 所有提供商共享同一套：超时控制 / 流式读取 / 429 重试 / abort 处理
 */
async function callProvider(
    config: ProviderConfig,
    prompt: string,
    model: string,
    timeoutMs: number = 30000,
    onStream?: (chunk: string, isReasoning: boolean) => void,
    externalSignal?: AbortSignal,
    maxOutputTokens: number = 8192,
    temperature: number = 0.7
): Promise<string> {
    // 1. 读取环境变量
    const apiKey = process.env[config.envApiKey] || '';
    const baseUrl = process.env[config.envBaseUrl] || config.defaultBaseUrl;
    const actualModel = config.envModel ? (process.env[config.envModel] || model) : model;

    // Ollama 本地部署无需 API Key，其余提供商必须配置
    if (!apiKey && config.id !== 'ollama') throw new Error(`${config.envApiKey} not set`);

    // 2. 成本限制检查（Ollama 本地运行零成本，跳过计量）
    if (config.id !== 'ollama') {
        const limitCheck = await checkCostLimit(config.costProvider, 'other');
        if (!limitCheck.allowed) throw new Error(limitCheck.reason || 'Cost limit exceeded');
    }

    // 3. 构建请求
    const isStreaming = !!onStream;
    const url = config.buildUrl(baseUrl, actualModel, isStreaming);
    const headers = config.buildHeaders(apiKey);
    const body = config.buildBody(prompt, actualModel, { temperature, maxOutputTokens, stream: isStreaming });

    const startTime = Date.now();
    console.log(`[AI Client] ${config.id} 调用开始 (${actualModel}), URL: ${url}`);

    // 4. 超时 / abort 控制（与编排器协作）
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;
    if (externalSignal) {
        if (externalSignal.aborted) throw new Error('External abort');
        externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    } else {
        timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    }

    try {
        // 5. 发起请求
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        // 5.5 HTML 响应检测（Vercel 环境中偶发 CDN/代理拦截导致返回 HTML 而非 JSON）
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html') && !contentType.includes('json')) {
            clearTimeout(timeoutId);
            const htmlSnippet = (await response.text()).slice(0, 200);
            console.error(`[AI Client] 🚨 ${config.id} 返回了 HTML 而非 JSON！URL=${url}, status=${response.status}, 前200字: ${htmlSnippet}`);
            throw new Error(`${config.id} 返回 HTML (非 JSON)，疑似 URL 配置错误或被 CDN/代理拦截。请检查 ${config.envBaseUrl} 环境变量。URL: ${url}`);
        }

        // 6. 错误处理：429/503 限流自动退避
        if (!response.ok) {
            clearTimeout(timeoutId);
            if (response.status === 429 || response.status === 503) {
                const retryAfter = parseInt(response.headers.get('retry-after') || '3', 10);
                const waitMs = Math.min(retryAfter * 1000, 10000);
                console.error(`[AI Client] 🚨 ${config.id} ${response.status} 配额耗尽/限流，等待 ${waitMs}ms 后重试。如持续出现请检查 API 配额余量。`);
                await new Promise(r => setTimeout(r, waitMs));
                throw new Error(`${config.id} API 配额耗尽或限流 (${response.status})。请在提供商控制台检查剩余配额。`);
            }
            const errText = await response.text();
            throw new Error(`${config.id} API error: ${response.status} ${errText}`);
        }

        // 7. 流式模式
        if (isStreaming && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullText = '';
            let buffer = '';
            let lastFinishReason = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        const dataStr = trimmedLine.slice(6);
                        if (dataStr === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(dataStr);
                            const chunk = config.parseStreamChunk(parsed);
                            // DeepSeek 特有：推理内容透传
                            if (chunk.reasoning) {
                                onStream!(chunk.reasoning, true);
                            }
                            if (chunk.content) {
                                onStream!(chunk.content, false);
                                fullText += chunk.content;
                            }
                            if (chunk.finishReason) {
                                lastFinishReason = chunk.finishReason;
                            }
                        } catch (_e) {
                            // 忽略不完整的 JSON chunk
                        }
                    }
                }
            }
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            if (lastFinishReason === 'length') {
                console.warn(`[AI Client] ⚠️ ${config.id} 输出因 maxOutputTokens 被截断 (finish_reason=length), fullText 长度: ${fullText.length} 字符`);
            }
            console.log(`[AI Client] ${config.id} 流式完成 (${actualModel}), 耗时 ${duration}ms, 输出 ${fullText.length} 字符, finish: ${lastFinishReason || 'unknown'}`);
            return fullText;
        }

        // 8. 非流式模式
        clearTimeout(timeoutId);
        const data = await response.json();
        const duration = Date.now() - startTime;
        console.log(`[AI Client] ${config.id} 完成 (${actualModel}), 耗时 ${duration}ms`);
        return config.parseResponse(data);

    } catch (err: any) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        console.error(`[AI Client] ${config.id} 失败 (${duration}ms): ${err.name === 'AbortError' ? 'Timeout' : err.message}`);

        // ── 容灾切换：如果有备用 Key，用备用 Key 重试一次 ──
        const backupKey = config.envApiKeyBackup ? process.env[config.envApiKeyBackup] : undefined;
        if (backupKey && err.name !== 'AbortError') {
            console.warn(`[AI Client Failover] ${config.id} 主 Key 失败，切换备用 Key 重试...`);
            const retryHeaders = config.buildHeaders(backupKey);
            const retryController = new AbortController();
            const retryTimeoutId = externalSignal ? undefined : setTimeout(() => retryController.abort(), timeoutMs);
            if (externalSignal) {
                if (externalSignal.aborted) throw err;
                externalSignal.addEventListener('abort', () => retryController.abort(), { once: true });
            }
            try {
                const retryResponse = await fetch(url, {
                    method: 'POST',
                    headers: retryHeaders,
                    body: JSON.stringify(body),
                    signal: retryController.signal,
                });
                if (retryTimeoutId) clearTimeout(retryTimeoutId);
                if (!retryResponse.ok) {
                    const retryErr = await retryResponse.text();
                    throw new Error(`${config.id} backup API error: ${retryResponse.status} ${retryErr}`);
                }
                // 备用 Key 非流式响应
                const retryData = await retryResponse.json();
                const retryDuration = Date.now() - startTime;
                console.log(`[AI Client Failover] ${config.id} 备用 Key 成功 (${retryDuration}ms)`);
                // 异步记录 failover 事件，供巡检脚本检测
                import('./services/costLimiter').then(() =>
                    import('../lib/supabase').then(async ({ supabaseAdmin }) => {
                        await supabaseAdmin.from('api_call_logs').insert({
                            provider: `${config.id}-failover`, is_success: true,
                            call_type: 'agent', error_message: `主Key失败: ${err.message}`,
                            response_time_ms: retryDuration,
                            called_at: new Date().toISOString(),
                        });
                    }).catch(() => {})
                ).catch(() => {});
                return config.parseResponse(retryData);
            } catch (retryErr: any) {
                if (retryTimeoutId) clearTimeout(retryTimeoutId);
                console.error(`[AI Client Failover] ${config.id} 备用 Key 也失败: ${retryErr.message}`);
                throw retryErr;
            }
        }

        throw err;
    }
}

// ==================== DeepSeek R1（独立保留，返回格式特殊） ====================

/**
 * 调用 DeepSeek R1 推理模型（deepseek-reasoner）
 * R1 特点：返回 reasoning_content（思维链）+ content（最终答案），忽略 temperature 等
 * 保持独立函数：R1 的双返回值格式与统一引擎的 string 返回值不兼容
 */
export async function callDeepSeekR1(prompt: string, timeoutMs: number = 60000): Promise<{ text: string, reasoningContent: string }> {
    const config = PROVIDER_REGISTRY.deepseek;
    const apiKey = process.env[config.envApiKey];
    const baseUrl = process.env[config.envBaseUrl] || config.defaultBaseUrl;

    if (!apiKey) throw new Error(`${config.envApiKey} not set`);

    const limitCheck = await checkCostLimit('deepseek-r1', 'other');
    if (!limitCheck.allowed) throw new Error(limitCheck.reason || 'Cost limit exceeded');

    const url = config.buildUrl(baseUrl, 'deepseek-reasoner', false);
    const startTime = Date.now();
    console.log(`[AI Client] DeepSeek R1 调用开始, prompt 长度: ${prompt.length}, URL: ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: config.buildHeaders(apiKey),
            body: JSON.stringify({
                model: 'deepseek-reasoner',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 8192,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`DeepSeek R1 API error: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        const text = choice?.message?.content || '';
        const reasoningContent = choice?.message?.reasoning_content || '';
        const duration = Date.now() - startTime;
        console.log(`[AI Client] DeepSeek R1 完成, 耗时 ${duration}ms, 思维链长度: ${reasoningContent.length}`);
        return { text, reasoningContent };
    } catch (err: any) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        console.error(`[AI Client] DeepSeek R1 失败 (${duration}ms): ${err.name === 'AbortError' ? 'Timeout' : err.message}`);
        throw err;
    }
}

/**
 * 检测提供商是否可用
 * 云端提供商：检查 API Key 是否配置
 * Ollama：轻量级 HTTP 健康探测（GET /api/tags），带 30 秒结果缓存防止频繁请求
 */
let _ollamaHealthCache: { ok: boolean; ts: number } | null = null;
const OLLAMA_HEALTH_CACHE_TTL = 30_000; // 30 秒缓存

async function isProviderAvailable(id: ModelProvider): Promise<boolean> {
    const config = PROVIDER_REGISTRY[id];
    if (!config) return false;

    // Ollama 特殊处理：健康探测 + 缓存
    if (id === 'ollama') {
        const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
        if (!ollamaBaseUrl) return false;

        // 命中缓存则直接返回
        if (_ollamaHealthCache && Date.now() - _ollamaHealthCache.ts < OLLAMA_HEALTH_CACHE_TTL) {
            return _ollamaHealthCache.ok;
        }

        try {
            // 探测 Ollama 原生端点（/v1 前缀之前的根路径）
            const probeUrl = ollamaBaseUrl.replace(/\/v1\/?$/, '') + '/api/tags';
            const resp = await fetch(probeUrl, { method: 'GET', signal: AbortSignal.timeout(3000) });
            const ok = resp.ok;
            _ollamaHealthCache = { ok, ts: Date.now() };
            if (!ok) console.warn(`[AI Client] Ollama 健康探测失败: HTTP ${resp.status}`);
            return ok;
        } catch (err: any) {
            console.warn(`[AI Client] Ollama 健康探测异常: ${err.message}`);
            _ollamaHealthCache = { ok: false, ts: Date.now() };
            return false;
        }
    }

    return !!process.env[config.envApiKey];
}

/**
 * 构建模型降级链（铁轨切换器 🚂）
 * 固定优先级：MiniMax → DeepSeek → Kimi → Ollama（本地兜底）
 * 首选模型排第一，其余按优先级追加
 */
async function buildModelChain(preferred: ModelProvider): Promise<ModelOption[]> {
    const deepseek = MODEL_OPTIONS.find(m => m.id === 'deepseek')!;
    const minimax = MODEL_OPTIONS.find(m => m.id === 'minimax');
    const moonshot = MODEL_OPTIONS.find(m => m.id === 'moonshot');
    const ollama = MODEL_OPTIONS.find(m => m.id === 'ollama');

    const minimaxAvailable = await isProviderAvailable('minimax');
    const moonshotAvailable = await isProviderAvailable('moonshot');
    const ollamaAvailable = await isProviderAvailable('ollama');

    // 根据首选构建优先链条
    let chain: ModelOption[] = [];
    if (preferred === 'ollama' && ollamaAvailable && ollama) {
        chain.push(ollama);
    } else if (preferred === 'moonshot' && moonshotAvailable && moonshot) {
        chain.push(moonshot);
    } else if (preferred === 'minimax' && minimaxAvailable && minimax) {
        chain.push(minimax);
    } else {
        chain.push(deepseek);
    }

    // fallback：按 MiniMax → DeepSeek → Kimi → Ollama 优先级追加
    if (preferred !== 'minimax' && minimaxAvailable && minimax) chain.push(minimax);
    if (preferred !== 'deepseek') chain.push(deepseek);
    if (preferred !== 'moonshot' && moonshotAvailable && moonshot) chain.push(moonshot);
    // Ollama 作为末尾兜底：当所有云端 API 均不可用时自动降级到本地模型
    if (preferred !== 'ollama' && ollamaAvailable && ollama) chain.push(ollama);

    return Array.from(new Set(chain)).filter(Boolean) as ModelOption[];
}

function extractJSON(text: string): AIAnalysisResult {
    // Try to find markdown JSON block
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    let jsonStr = jsonMatch ? jsonMatch[1] : text;

    // Sometimes the model outputs just the JSON directly
    try {
        const parsed = JSON.parse(jsonStr);
        return parsed as AIAnalysisResult;
    } catch (e) {
        console.error("Failed to parse JSON directly:", e);
        // Desperate extraction if needed
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            try {
                return JSON.parse(text.substring(firstBrace, lastBrace + 1)) as AIAnalysisResult;
            } catch (err) {
                throw new Error("Unable to extract valid JSON from model response.");
            }
        }
        throw e;
    }
}

/** Prompt 最大长度（字符数），超过时自动截断以避免 token 超限 */
const DEFAULT_MAX_PROMPT_LENGTH = 100000;

/**
 * 通用 AI 调用——返回原始文本，供各 Agent 自行解析。
 * 与 callAIWithFallback 共享同一套模型降级链。
 * 每个模型失败后会重试 1 次（间隔 1 秒），再失败才切换下一个模型。
 *
 * @param prompt - 提示词
 * @param preferredModel - 首选模型
 * @param timeoutMs - 单次调用超时（毫秒），默认 30000
 * @param maxPromptLength - prompt 最大字符数，默认 100000
 */
export async function callAIRaw(
    prompt: string,
    preferredModel: ModelProvider = 'minimax',
    timeoutMs: number = 30000,
    maxPromptLength: number = DEFAULT_MAX_PROMPT_LENGTH,
    onStream?: (chunk: string, isReasoning: boolean) => void,
    abortSignal?: AbortSignal,
    maxOutputTokens: number = 8192,
    temperature: number = 0.7,
    /** AI 调用优先级：'high' 使用主信号量（Agent 专用），'low' 使用低优先级信号量（NovoDNA 等） */
    priority: 'high' | 'low' = 'high'
): Promise<{ text: string, usedModel: string }> {
    // 自动截断超长 prompt，避免 DeepSeek 131K token 限制
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
                // 如果外部已取消，立即停止（在每轮+每次重试前都检查）
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
                // 如果是外部中断（AbortError），不重试，直接向上抛出
                if (err.name === 'AbortError' || err.message?.includes('External abort')) {
                    throw err;
                }
                if (attempt < MAX_RETRIES) {
                    // 重试前再次检查 abort 状态，避免白白等待
                    if (abortSignal?.aborted) {
                        const abortErr2 = new Error('External abort: 编排器已超时取消此 Agent (重试前检测)');
                        abortErr2.name = 'AbortError';
                        throw abortErr2;
                    }
                    await new Promise(r => setTimeout(r, 1000)); // 重试前等待 1 秒
                }
            }
        }
    }
    throw new Error(`All AI models failed (raw). Last error: ${lastError?.message}`);
}

/**
 * 从 AI 原始文本中提取 JSON 并做类型安全解析。
 * 
 * 核心策略（按优先级）：
 * 1. 用贪婪正则匹配最外层 ```json ... ``` 代码块（避免 content 中嵌套代码块导致截断）
 * 2. 直接 JSON.parse 全文
 * 3. 花括号平衡匹配提取最外层 JSON 对象
 */
export function parseAgentJSON<T>(text: string): T {
    // 策略 1：匹配 ```json ... ``` 代码块
    // 使用贪婪匹配 ([\s\S]*) 以适应 content 字段中可能包含的嵌套代码块
    // 然后从后往前找最后一个 ``` 作为代码块结束位
    const codeBlockStart = text.match(/```json\s*\r?\n/);
    if (codeBlockStart && codeBlockStart.index !== undefined) {
        const contentStart = codeBlockStart.index + codeBlockStart[0].length;
        // 从内容起始处往后找最后一个独立的 ``` （行首或前面是换行的）
        const remaining = text.substring(contentStart);
        // 找到所有 ``` 的位置，取最后一个作为结束标记
        const closingMatches = Array.from(remaining.matchAll(/\n```/g));
        if (closingMatches.length > 0) {
            const lastClose = closingMatches[closingMatches.length - 1];
            const jsonStr = remaining.substring(0, lastClose.index!).trim();
            try {
                return JSON.parse(jsonStr) as T;
            } catch (e) {
                console.warn('[parseAgentJSON] 代码块提取的 JSON 解析失败，尝试其他策略:', (e as Error).message?.slice(0, 100));
            }
        }
    }

    // 策略 2：直接 JSON.parse 全文
    try {
        return JSON.parse(text.trim()) as T;
    } catch {
        // 继续下一策略
    }

    // 策略 3：花括号平衡匹配 — 找到最外层完整的 JSON 对象
    const firstBrace = text.indexOf('{');
    if (firstBrace !== -1) {
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = firstBrace; i < text.length; i++) {
            const ch = text[i];
            if (escape) { escape = false; continue; }
            if (ch === '\\' && inString) { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    const jsonStr = text.substring(firstBrace, i + 1);
                    try {
                        return JSON.parse(jsonStr) as T;
                    } catch (e) {
                        console.warn('[parseAgentJSON] 花括号平衡匹配的 JSON 解析失败:', (e as Error).message?.slice(0, 100));
                        break;
                    }
                }
            }
        }
    }

    // 策略 3.5：截断 JSON 自愈 — 当 AI 因 maxOutputTokens 在 JSON 中段被截断时
    // 症状：花括号不平衡（depth > 0），说明 JSON 被截在中间
    // 方案：保留所有已生成内容，补全缺失的闭合符号
    if (firstBrace !== -1) {
        let jsonCandidate = text.substring(firstBrace);
        
        // 检测是否在字符串中间被截断
        let inStr = false;
        let esc = false;
        for (let i = 0; i < jsonCandidate.length; i++) {
            const ch = jsonCandidate[i];
            if (esc) { esc = false; continue; }
            if (ch === '\\' && inStr) { esc = true; continue; }
            if (ch === '"') { inStr = !inStr; }
        }
        
        // 如果在字符串中间被截断，保留所有内容并追加闭合引号
        if (inStr) {
            // 移除尾部的不完整转义序列（如末尾是单个 \）
            jsonCandidate = jsonCandidate.replace(/\\+$/, '');
            jsonCandidate += '"';
        }
        
        // 重新计算缺失的闭合括号
        let openBraces = 0, openBrackets = 0;
        inStr = false; esc = false;
        for (let i = 0; i < jsonCandidate.length; i++) {
            const ch = jsonCandidate[i];
            if (esc) { esc = false; continue; }
            if (ch === '\\' && inStr) { esc = true; continue; }
            if (ch === '"') { inStr = !inStr; continue; }
            if (inStr) continue;
            if (ch === '{') openBraces++;
            else if (ch === '}') openBraces--;
            else if (ch === '[') openBrackets++;
            else if (ch === ']') openBrackets--;
        }
        
        if (openBraces > 0 || openBrackets > 0) {
            // 去掉尾部不完整的 key-value（可能在逗号、冒号后截断）
            let trimmed = jsonCandidate.replace(/[,:\s]+$/, '');
            // 如果尾部是一个未赋值的 key（如 "score":），去掉它
            trimmed = trimmed.replace(/,\s*"[^"]*"\s*:\s*$/, '');
            // 补全闭合括号
            const closing = ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
            trimmed += closing;
            try {
                const result = JSON.parse(trimmed) as T;
                console.warn(`[parseAgentJSON] ⚠️ 截断 JSON 自愈成功：补全了 ${openBraces} 个 } 和 ${openBrackets} 个 ]`);
                return result;
            } catch (e) {
                console.warn('[parseAgentJSON] 截断 JSON 自愈失败:', (e as Error).message?.slice(0, 100));
            }
        }
    }

    // 最终兜底：firstBrace + lastBrace
    const fb = text.indexOf('{');
    const lb = text.lastIndexOf('}');
    if (fb !== -1 && lb > fb) {
        try {
            return JSON.parse(text.substring(fb, lb + 1)) as T;
        } catch (e) {
            console.error('[parseAgentJSON] 所有策略均失败。原始文本前 200 字符:', text.slice(0, 200));
            throw new Error(`Unable to extract valid JSON from AI response: ${(e as Error).message}`);
        }
    }

    throw new Error('Unable to extract valid JSON from AI response: no JSON object found');
}

export async function callAIWithFallback(prompt: string, preferredModel: ModelProvider = 'minimax'): Promise<{ analysis: AIAnalysisResult, usedModel: string }> {
    const modelChain = await buildModelChain(preferredModel);

    let lastError: Error | null = null;
    for (const option of modelChain) {
        try {
            console.log(`[AI Client] Trying model: ${option.name} (${option.model})`);
            const providerConfig = PROVIDER_REGISTRY[option.id];
            const rawResult = await callProvider(providerConfig, prompt, option.model);

            const analysis = extractJSON(rawResult);
            console.log(`[AI Client] Successfully got response from ${option.name}`);
            return { analysis, usedModel: option.name };
        } catch (err: any) {
            console.warn(`[AI Client] Model ${option.name} failed:`, err.message);
            lastError = err;
        }
    }

    throw new Error(`All AI models failed. Last error: ${lastError?.message}`);
}
