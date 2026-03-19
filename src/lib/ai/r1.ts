/**
 * DeepSeek R1 推理模型独立调用
 *
 * R1 特点：返回 reasoning_content（思维链）+ content（最终答案），忽略 temperature 等
 * 保持独立函数：R1 的双返回值格式与统一引擎的 string 返回值不兼容
 *
 * @module lib/ai/r1
 */

import { checkCostLimit } from '@/lib/stubs';
import { PROVIDER_REGISTRY } from './registry';

/**
 * 调用 DeepSeek R1 推理模型（deepseek-reasoner）
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
