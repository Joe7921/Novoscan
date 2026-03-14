export const dynamic = 'force-dynamic';

/**
 * OAuth 授权页面 — ChatGPT MCP 连接专用
 *
 * 流程：
 *   1. ChatGPT 引导用户到此页面（带 redirect_uri, state 参数）
 *   2. 用户输入 API Key
 *   3. 验证通过后，重定向回 ChatGPT（带 code 参数）
 *   4. ChatGPT 用 code 调用 /api/oauth/token 换取 access_token
 */

import { NextResponse } from 'next/server';

// ==================== 安全：转义 HTML/JS 特殊字符 ====================
function escapeForJsString(str: string): string {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'") 
        .replace(/"/g, '\\"')
        .replace(/</g, '\\x3c')
        .replace(/>/g, '\\x3e')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

// ==================== GET: 展示授权页面 ====================

export async function GET(request: Request) {
    const url = new URL(request.url);
    const redirectUri = url.searchParams.get('redirect_uri') || '';
    const state = url.searchParams.get('state') || '';
    const clientId = url.searchParams.get('client_id') || '';

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Novoscan MCP — 授权</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e2e8f0;
        }
        .card {
            background: rgba(30, 41, 59, 0.8);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(100, 116, 139, 0.3);
            border-radius: 20px;
            padding: 48px 40px;
            max-width: 440px;
            width: 90%;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        }
        .logo { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
        .logo span { background: linear-gradient(135deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .subtitle { font-size: 14px; color: #94a3b8; margin-bottom: 32px; }
        label { display: block; font-size: 13px; font-weight: 600; color: #cbd5e1; margin-bottom: 8px; }
        input[type="text"] {
            width: 100%;
            padding: 14px 16px;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid rgba(100, 116, 139, 0.4);
            border-radius: 12px;
            color: #f1f5f9;
            font-size: 15px;
            outline: none;
            transition: border-color 0.2s;
        }
        input[type="text"]:focus { border-color: #60a5fa; }
        input[type="text"]::placeholder { color: #475569; }
        button {
            width: 100%;
            padding: 14px;
            margin-top: 24px;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            border: none;
            border-radius: 12px;
            color: white;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: opacity 0.2s, transform 0.1s;
        }
        button:hover { opacity: 0.9; }
        button:active { transform: scale(0.98); }
        .hint { font-size: 12px; color: #64748b; margin-top: 16px; text-align: center; }
        .error { color: #f87171; font-size: 13px; margin-top: 12px; display: none; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo"><span>Novoscan MCP</span></div>
        <div class="subtitle">连接你的 AI 助手到 Novoscan 创新评估引擎</div>
        <form id="authForm">
            <label for="apiKey">API Key</label>
            <input type="text" id="apiKey" name="apiKey" placeholder="输入你的 API Key" required autocomplete="off" />
            <div class="error" id="errorMsg"></div>
            <button type="submit">授权连接</button>
        </form>
        <div class="hint">授权后，你的 AI 助手将能调用 Novoscan 分析服务</div>
    </div>
    <script>
        document.getElementById('authForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const apiKey = document.getElementById('apiKey').value.trim();
            const errorEl = document.getElementById('errorMsg');
            const btn = e.target.querySelector('button');
            if (!apiKey) { errorEl.textContent = '请输入 API Key'; errorEl.style.display = 'block'; return; }
            btn.textContent = '验证中...';
            btn.disabled = true;
            try {
                const res = await fetch('/api/oauth/authorize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apiKey,
                        redirect_uri: '${escapeForJsString(redirectUri)}',
                        state: '${escapeForJsString(state)}',
                        client_id: '${escapeForJsString(clientId)}'
                    })
                });
                const data = await res.json();
                if (data.redirect) {
                    window.location.href = data.redirect;
                } else {
                    errorEl.textContent = data.error || '验证失败';
                    errorEl.style.display = 'block';
                    btn.textContent = '授权连接';
                    btn.disabled = false;
                }
            } catch {
                errorEl.textContent = '网络错误，请重试';
                errorEl.style.display = 'block';
                btn.textContent = '授权连接';
                btn.disabled = false;
            }
        });
    </script>
</body>
</html>`;

    return new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}

// ==================== POST: 验证 API Key 并发 code ====================

import { codeStore } from '@/app/api/oauth/store';

export async function POST(request: Request) {
    try {
        const { apiKey, redirect_uri, state } = await request.json();

        if (!apiKey) {
            return NextResponse.json({ error: '请输入 API Key' }, { status: 400 });
        }

        // 验证 API Key（复用 mcpAuth 的环境变量逻辑，轻量验证）
        const { validateMcpKey } = await import('@/lib/security/mcpAuth');
        const auth = (await validateMcpKey(apiKey)) as unknown;

        if (!auth.valid) {
            return NextResponse.json({ error: auth.error || 'API Key 无效' }, { status: 401 });
        }

        // 生成授权 code（随机字符串，5 分钟有效）
        const code = `nvcode_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
        await codeStore.set(code, { apiKey, expiresAt: Date.now() + 5 * 60 * 1000 });

        // 构造重定向 URL
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('code', code);
        if (state) redirectUrl.searchParams.set('state', state);

        return NextResponse.json({ redirect: redirectUrl.toString() });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// 导出 codeStore 供 token 端点使用 (提取为共享文件时再做导出)
// export { codeStore };
