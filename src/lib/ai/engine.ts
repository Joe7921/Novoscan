/**
 * AI 统一调用引擎 — callProvider
 *
 * 所有提供商共享同一套：超时控制 / 流式读取 / 429 重试 / abort 处理 / 备用 Key 容灾
 *
 * @module lib/ai/engine
 */

import { checkCostLimit } from '@/lib/stubs';
import type { ProviderConfig } from './registry';

/**
 * 统一 AI 调用引擎
 */
export async function callProvider(
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
                import('@/lib/stubs').then(() =>
                    import('@/lib/db/factory').then(async ({ adminDb }) => {
                        await adminDb.from('api_call_logs').insert({
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
