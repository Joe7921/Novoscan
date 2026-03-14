/**
 * Novoscan 七源 API 真实调用健康度测试
 * 
 * 使用 .env.local 中的 Key 做实际数据请求
 * 用法: node scripts/api_real_test.mjs
 */

import { readFileSync } from 'fs';
import { writeFileSync } from 'fs';

// ===== 加载 .env.local =====
const envContent = readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
        env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
    }
});

const TEST_QUERY = '自动驾驶激光雷达点云优化';
const results = [];
const logs = [];

function log(msg) { console.log(msg); logs.push(msg); }

async function test(name, fn) {
    const t0 = Date.now();
    try {
        const detail = await fn();
        const ms = Date.now() - t0;
        results.push({ name, ok: true, ms, detail });
        log(`  ✅ ${name.padEnd(22)} OK  (${ms}ms) ${detail}`);
    } catch (e) {
        const ms = Date.now() - t0;
        const msg = e.message || String(e);
        results.push({ name, ok: false, ms, detail: msg });
        log(`  ❌ ${name.padEnd(22)} FAIL (${ms}ms) ${msg}`);
    }
}

// ==================== 1. OpenAlex ====================
async function testOpenAlex() {
    const email = env.OPENALEX_EMAIL || '';
    const q = encodeURIComponent(TEST_QUERY);
    let url = `https://api.openalex.org/works?search=${q}&filter=publication_year:>2022&per-page=5&select=id,display_name,publication_year,cited_by_count`;
    if (email) url += `&mailto=${encodeURIComponent(email)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const count = data.results?.length || 0;
    const total = data.meta?.count || 0;
    if (count === 0) throw new Error('返回 0 篇论文');
    return `${count} 篇 (总库: ${total}) | 首篇: "${data.results[0]?.display_name?.slice(0,40)}..."`;
}

// ==================== 2. arXiv ====================
async function testArxiv() {
    const q = encodeURIComponent('lidar point cloud deep learning');
    const url = `http://export.arxiv.org/api/query?search_query=all:${q}&start=0&max_results=5`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const count = (text.match(/<entry>/g) || []).length;
    if (count === 0) throw new Error('返回 0 篇论文');
    const titleMatch = text.match(/<title>([^<]+)<\/title>/g);
    const firstTitle = titleMatch?.[1]?.replace(/<\/?title>/g, '').trim().slice(0, 40) || '?';
    return `${count} 篇 | 首篇: "${firstTitle}..."`;
}

// ==================== 3. CrossRef ====================
async function testCrossRef() {
    const email = env.CROSSREF_EMAIL || '';
    const q = encodeURIComponent(TEST_QUERY);
    let url = `https://api.crossref.org/works?query=${q}&rows=5`;
    if (email) url += `&mailto=${encodeURIComponent(email)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = data.message?.items || [];
    if (items.length === 0) throw new Error('返回 0 项');
    return `${items.length} 项 | 首项: "${(items[0].title?.[0] || '?').slice(0,40)}..."`;
}

// ==================== 4. CORE ====================
async function testCore() {
    const key = env.CORE_API_KEY;
    if (!key) throw new Error('CORE_API_KEY 未配置');
    const q = encodeURIComponent('autonomous driving lidar');
    const url = `https://api.core.ac.uk/v3/search/works?q=${q}&limit=3&scroll=false`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000)
    });
    if (res.status === 401) throw new Error('API Key 无效 (401)');
    if (res.status === 403) throw new Error('API Key 已过期 (403)');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const count = data.results?.length || 0;
    if (count === 0) throw new Error('返回 0 篇论文');
    return `${count} 篇 | 总计 ${data.totalHits || '?'} 命中`;
}

// ==================== 5. Brave Search ====================
async function testBrave() {
    const key = env.BRAVE_API_KEY;
    if (!key) throw new Error('BRAVE_API_KEY 未配置');
    const q = encodeURIComponent(TEST_QUERY);
    const url = `https://api.search.brave.com/res/v1/web/search?q=${q}&count=5`;
    const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': key },
        signal: AbortSignal.timeout(10000)
    });
    if (res.status === 401) throw new Error('API Key 无效 (401)');
    if (res.status === 429) throw new Error('月度配额已用完 (429)');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const count = data.web?.results?.length || 0;
    if (count === 0) throw new Error('返回 0 条结果');
    return `${count} 条 | 首条: "${(data.web.results[0]?.title || '?').slice(0,40)}..."`;
}

// ==================== 6. SerpAPI ====================
async function testSerpAPI() {
    const key = env.SERPAPI_KEY;
    if (!key) throw new Error('SERPAPI_KEY 未配置');
    const q = encodeURIComponent(TEST_QUERY);
    const url = `https://serpapi.com/search?engine=google&q=${q}&num=5&hl=zh-CN&gl=cn&api_key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (res.status === 401) throw new Error('API Key 无效 (401)');
    if (res.status === 429) throw new Error('月度配额已用完 (429)');
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const data = await res.json();
    
    // 检查配额信息
    const accountInfo = data.search_metadata?.total_time_taken;
    const organicCount = data.organic_results?.length || 0;
    if (organicCount === 0) throw new Error('返回 0 条 organic_results');
    
    // 检查错误
    if (data.error) throw new Error(`SerpAPI Error: ${data.error}`);
    
    return `${organicCount} 条 | 用时 ${accountInfo || '?'}s | 首条: "${(data.organic_results[0]?.title || '?').slice(0,35)}..."`;
}

// ==================== 7. GitHub ====================
async function testGitHub() {
    const token = env.GITHUB_TOKEN;
    const q = encodeURIComponent('lidar point cloud');
    const url = `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=5`;
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Novoscan-HealthCheck/1.0',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    if (res.status === 403) {
        const remaining = res.headers.get('X-RateLimit-Remaining');
        throw new Error(`API 限额已满 (403), 剩余: ${remaining}`);
    }
    if (res.status === 401) throw new Error('Token 无效 (401)');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    const remaining = res.headers.get('X-RateLimit-Remaining');
    const limit = res.headers.get('X-RateLimit-Limit');
    const count = data.items?.length || 0;
    const topRepo = data.items?.[0];
    
    return `${count} 个 | 速率: ${remaining}/${limit} | Top: ${topRepo?.full_name} (⭐${topRepo?.stargazers_count})`;
}

// ==================== 附加: DeepSeek AI 健康 ====================
async function testDeepSeek() {
    const key = env.DEEPSEEK_API_KEY;
    const base = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    if (!key) throw new Error('DEEPSEEK_API_KEY 未配置');
    
    const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: '回复"ok"即可' }],
            max_tokens: 5,
            stream: false,
        }),
        signal: AbortSignal.timeout(15000)
    });
    if (res.status === 401) throw new Error('API Key 无效 (401)');
    if (res.status === 402) throw new Error('余额不足 (402)');
    if (res.status === 429) throw new Error('请求频率超限 (429)');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '?';
    const model = data.model || '?';
    return `模型: ${model} | 回复: "${reply}"`;
}

// ==================== 附加: MiniMax AI 健康 ====================
async function testMiniMax() {
    const key = env.MINIMAX_API_KEY;
    const base = env.MINIMAX_BASE_URL || 'https://api.minimax.chat';
    const model = env.MINIMAX_MODEL || 'MiniMax-Text-01';
    if (!key) throw new Error('MINIMAX_API_KEY 未配置');
    
    const res = await fetch(`${base}/v1/text/chatcompletion_v2`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: '回复"ok"即可' }],
            max_tokens: 5,
            stream: false,
        }),
        signal: AbortSignal.timeout(15000)
    });
    if (res.status === 401) throw new Error('API Key 无效 (401)');
    if (res.status === 402) throw new Error('余额不足 (402)');
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${body.slice(0,100)}`);
    }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '?';
    return `模型: ${model} | 回复: "${reply}"`;
}

// ==================== 附加: Gemini (via Proxy) ====================
async function testGemini() {
    const key = env.GEMINI_API_KEY;
    const base = env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
    if (!key) throw new Error('GEMINI_API_KEY 未配置');
    
    // 通过代理的 OpenAI 兼容模式
    const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'gemini-2.0-flash',
            messages: [{ role: 'user', content: '回复"ok"即可' }],
            max_tokens: 5,
            stream: false,
        }),
        signal: AbortSignal.timeout(15000)
    });
    if (res.status === 401) throw new Error('API Key 无效 (401)');
    if (res.status === 402) throw new Error('余额不足 (402)');
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${body.slice(0,150)}`);
    }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '?';
    const model = data.model || '?';
    return `模型: ${model} | 回复: "${reply}"`;
}

// ==================== Main ====================
async function main() {
    log('');
    log('╔══════════════════════════════════════════════════════╗');
    log('║   Novoscan 七源 + AI 真实调用健康度测试              ║');
    log('╚══════════════════════════════════════════════════════╝');
    log(`  时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
    log(`  测试查询: "${TEST_QUERY}"`);
    log('');

    log('── 📚 学术轨道（4源） ──');
    await test('1. OpenAlex', testOpenAlex);
    await test('2. arXiv', testArxiv);
    await test('3. CrossRef', testCrossRef);
    await test('4. CORE', testCore);

    log('');
    log('── 🏭 产业轨道（3源） ──');
    await test('5. Brave Search', testBrave);
    await test('6. SerpAPI (Google)', testSerpAPI);
    await test('7. GitHub', testGitHub);

    log('');
    log('── 🤖 AI 提供商（3家） ──');
    await test('8. DeepSeek', testDeepSeek);
    await test('9. MiniMax', testMiniMax);
    await test('10. Gemini (代理)', testGemini);

    log('');
    log('═══════════════════════ 汇总 ═══════════════════════');
    const pass = results.filter(r => r.ok).length;
    const fail = results.filter(r => !r.ok).length;
    log(`  总计: ${results.length} | ✅ 通过: ${pass} | ❌ 失败: ${fail}`);
    log(`  总耗时: ${results.reduce((s, r) => s + r.ms, 0)}ms`);

    if (fail > 0) {
        log('');
        log('  ⚠️ 失败项目:');
        results.filter(r => !r.ok).forEach(r => {
            log(`    ❌ ${r.name}: ${r.detail}`);
        });
    }

    // Key 配置摘要
    log('');
    log('── 🔑 Key 配置摘要 ──');
    const keys = [
        ['BRAVE_API_KEY', env.BRAVE_API_KEY],
        ['SERPAPI_KEY', env.SERPAPI_KEY],
        ['CORE_API_KEY', env.CORE_API_KEY],
        ['GITHUB_TOKEN', env.GITHUB_TOKEN],
        ['DEEPSEEK_API_KEY', env.DEEPSEEK_API_KEY],
        ['GEMINI_API_KEY', env.GEMINI_API_KEY],
        ['MINIMAX_API_KEY', env.MINIMAX_API_KEY],
    ];
    keys.forEach(([name, val]) => {
        const status = val ? `✅ 已配(${val.slice(0,8)}...${val.slice(-4)})` : '❌ 缺失';
        log(`  ${name.padEnd(22)} ${status}`);
    });

    log('');

    writeFileSync('scripts/health_real_report.txt', logs.join('\n'), 'utf-8');
    console.log('📄 报告已保存: scripts/health_real_report.txt');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
