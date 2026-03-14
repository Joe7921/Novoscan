export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * /api/health — 端到端 API 健康检查
 *
 * 用 Vercel 运行时真实环境变量测试各 AI 模型可达性。
 *
 * 安全策略：
 *   1. 需要 CRON_SECRET 密钥（header 或 query）
 *   2. 不暴露任何 API Key 内容
 *   3. 每个模型只发最小请求（max_tokens: 5）
 *
 * 调用方式：
 *   GET /api/health?key=<CRON_SECRET>
 *   或 Header: x-cron-secret: <CRON_SECRET>
 */

// ==================== 模型配置 ====================

interface ModelCheck {
    name: string;
    getUrl: () => string;
    getHeaders: () => Record<string, string>;
    getBody: () => object;
}

/**
 * 与 ai-client.ts 的 buildOpenAICompatibleUrl 保持一致
 * 防止路径被重复拼接
 */
function buildOpenAIUrl(baseUrl: string): string {
    const trimmed = baseUrl.replace(/\/+$/, '');
    if (trimmed.endsWith('/chat/completions')) return trimmed;
    if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
    if (trimmed.includes('api.deepseek.com')) return `${trimmed}/chat/completions`;
    return `${trimmed}/v1/chat/completions`;
}

/** 创建一个 OpenAI 兼容格式的检查项 */
function makeOpenAICheck(name: string, envKey: string, envBase: string, defaultBase: string, envModel: string, defaultModel: string): ModelCheck | null {
    const apiKey = process.env[envKey];
    if (!apiKey) return null;
    const baseUrl = process.env[envBase] || defaultBase;
    const model = process.env[envModel] || defaultModel;
    const url = buildOpenAIUrl(baseUrl);
    return {
        name,
        getUrl: () => url,
        getHeaders: () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }),
        getBody: () => ({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
    };
}

function buildChecks(): ModelCheck[] {
    const checks: ModelCheck[] = [];

    // DeepSeek（官方直连或代理）
    const ds = makeOpenAICheck('deepseek', 'DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'https://api.deepseek.com', 'DEEPSEEK_MODEL', 'deepseek-chat');
    if (ds) checks.push(ds);

    // Minimax（CodingPlan 走 api.minimax.chat，普通走 api.minimaxi.com）
    const mm = makeOpenAICheck('minimax', 'MINIMAX_API_KEY', 'MINIMAX_BASE_URL', 'https://api.minimaxi.com/v1', 'MINIMAX_MODEL', 'MiniMax-M2.5');
    if (mm) checks.push(mm);

    // Moonshot Kimi（国产模型，OpenAI 兼容）
    const ms = makeOpenAICheck('moonshot', 'MOONSHOT_API_KEY', 'MOONSHOT_BASE_URL', 'https://api.moonshot.cn/v1', 'MOONSHOT_MODEL', 'kimi-k2.5');
    if (ms) checks.push(ms);

    // Gemini（代理平台 sk- key → OpenAI 兼容；原生 key → Google API）
    const geminiBaseUrl = (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    // 主 Key
    if (process.env.GEMINI_API_KEY) {
        const isProxy = process.env.GEMINI_API_KEY.startsWith('sk-');
        if (isProxy) {
            const url = buildOpenAIUrl(geminiBaseUrl);
            checks.push({
                name: 'gemini(proxy)',
                getUrl: () => url,
                getHeaders: () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GEMINI_API_KEY}` }),
                getBody: () => ({ model: geminiModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
            });
        } else {
            checks.push({
                name: 'gemini',
                getUrl: () => `${geminiBaseUrl}/v1beta/models/${geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`,
                getHeaders: () => ({ 'Content-Type': 'application/json' }),
                getBody: () => ({ contents: [{ parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 5 } }),
            });
        }
    }

    // 备用 Key
    if (process.env.GEMINI_API_KEY_BACKUP) {
        const isProxyBackup = process.env.GEMINI_API_KEY_BACKUP.startsWith('sk-');
        if (isProxyBackup) {
            const url = buildOpenAIUrl(geminiBaseUrl);
            checks.push({
                name: 'gemini(proxy-backup)',
                getUrl: () => url,
                getHeaders: () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GEMINI_API_KEY_BACKUP}` }),
                getBody: () => ({ model: geminiModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
            });
        } else {
            checks.push({
                name: 'gemini(backup)',
                getUrl: () => `${geminiBaseUrl}/v1beta/models/${geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY_BACKUP}`,
                getHeaders: () => ({ 'Content-Type': 'application/json' }),
                getBody: () => ({ contents: [{ parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 5 } }),
            });
        }
    }

    return checks;
}

// ==================== 模型测试 ====================

interface ModelResult {
    name: string;
    status: 'healthy' | 'error' | 'unreachable' | 'not_configured';
    httpCode?: number;
    responseMs: number;
    error?: string;
}

async function testModel(check: ModelCheck): Promise<ModelResult> {
    const start = Date.now();
    try {
        const res = await fetch(check.getUrl(), {
            method: 'POST',
            headers: check.getHeaders(),
            body: JSON.stringify(check.getBody()),
            signal: AbortSignal.timeout(15000),
        });
        const ms = Date.now() - start;
        const ok = res.status >= 200 && res.status < 300;
        let errMsg: string | undefined;
        if (!ok) {
            try { const j = await res.json(); errMsg = j.error?.message || res.statusText; }
            catch { errMsg = res.statusText; }
        }
        return { name: check.name, status: ok ? 'healthy' : 'error', httpCode: res.status, responseMs: ms, error: errMsg };
    } catch (e: any) {
        return { name: check.name, status: 'unreachable', responseMs: Date.now() - start, error: e.message };
    }
}

// ==================== 路由处理 ====================

export async function GET(request: Request) {
    // 🔒 密钥验证
    const secret = process.env.CRON_SECRET;
    if (secret) {
        const url = new URL(request.url);
        const provided = url.searchParams.get('key') || request.headers.get('x-cron-secret');
        if (provided !== secret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    const checks = buildChecks();

    if (checks.length === 0) {
        return NextResponse.json({
            status: 'error',
            error: 'No AI API keys configured',
            ts: new Date().toISOString(),
        }, { status: 500 });
    }

    const results = await Promise.all(checks.map(testModel));
    const allHealthy = results.every(r => r.status === 'healthy');

    return NextResponse.json({
        status: allHealthy ? 'ok' : 'degraded',
        ts: new Date().toISOString(),
        models: results,
        summary: results.map(r => `${r.name}:${r.status}(${r.responseMs}ms)`).join(' | '),
    }, {
        status: allHealthy ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
    });
}
