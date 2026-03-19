/**
 * AI 模型降级链（铁轨切换器 🚂）
 *
 * 检测提供商可用性 + 构建优先级模型链
 *
 * @module lib/ai/fallback-chain
 */

import type { ModelProvider, ModelOption } from '@/types';
import { MODEL_OPTIONS } from '@/types';
import { PROVIDER_REGISTRY } from './registry';

// ==================== 提供商可用性检测 ====================

let _ollamaHealthCache: { ok: boolean; ts: number } | null = null;
const OLLAMA_HEALTH_CACHE_TTL = 30_000; // 30 秒缓存

/**
 * 检测提供商是否可用
 * 云端提供商：检查 API Key 是否配置
 * Ollama：轻量级 HTTP 健康探测（GET /api/tags），带 30 秒结果缓存防止频繁请求
 */
export async function isProviderAvailable(id: ModelProvider): Promise<boolean> {
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

// ==================== 模型降级链 ====================

/**
 * 构建模型降级链
 * 固定优先级：MiniMax → DeepSeek → Kimi → Ollama（本地兜底）
 * 首选模型排第一，其余按优先级追加
 */
export async function buildModelChain(preferred: ModelProvider): Promise<ModelOption[]> {
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
