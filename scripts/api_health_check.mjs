/**
 * Novoscan 全链路 API 健康诊断脚本 v2
 * 纯文本输出，结果写文件
 */

import { writeFileSync } from 'fs';

const TEST_QUERY = 'machine learning optimization';
const results = [];
const logs = [];

function log(msg) { console.log(msg); logs.push(msg); }

async function testEndpoint(name, testFn) {
    const start = Date.now();
    try {
        const result = await testFn();
        const ms = Date.now() - start;
        results.push({ name, status: 'OK', ms, detail: result });
        log(`  [OK]   ${name.padEnd(20)} (${ms}ms) ${result}`);
    } catch (err) {
        const ms = Date.now() - start;
        const msg = err.message || String(err);
        results.push({ name, status: 'FAIL', ms, detail: msg });
        log(`  [FAIL] ${name.padEnd(20)} (${ms}ms) ${msg}`);
    }
}

async function testOpenAlex() {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(TEST_QUERY)}&filter=publication_year:>2022&per-page=3&select=id,display_name,publication_year,cited_by_count`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `${data.results?.length || 0} results (total: ${data.meta?.count || 0})`;
}

async function testArxiv() {
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(TEST_QUERY)}&start=0&max_results=3`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return `${(text.match(/<entry>/g) || []).length} entries`;
}

async function testCrossRef() {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(TEST_QUERY)}&rows=3`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `${data.message?.items?.length || 0} items`;
}

async function testCoreAPI() {
    const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(TEST_QUERY)}&limit=1&scroll=false`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (res.status === 401) return 'Reachable (needs API Key)';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'OK';
}

async function testBraveSearch() {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(TEST_QUERY)}&count=1`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': 'test' }, signal: AbortSignal.timeout(10000) });
    if (res.status === 401 || res.status === 422) return 'Reachable (needs valid Key)';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'OK';
}

async function testSerpAPI() {
    const url = `https://serpapi.com/search?engine=google&q=${encodeURIComponent(TEST_QUERY)}&num=1&api_key=test`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.status === 401 || res.status === 403) return 'Reachable (needs valid Key)';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'OK';
}

async function testGitHub() {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(TEST_QUERY)}&sort=stars&per_page=3`;
    const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Novoscan-Diag' }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return `${data.items?.length || 0} repos (rate: ${res.headers.get('X-RateLimit-Remaining')}/${res.headers.get('X-RateLimit-Limit')})`;
}

async function testDeepSeek() {
    const res = await fetch('https://api.deepseek.com/v1/models', { headers: { 'Authorization': 'Bearer test' }, signal: AbortSignal.timeout(10000) });
    if (res.status === 401) return 'Reachable (needs valid Key)';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'OK';
}

async function testMiniMax() {
    // 试真实的 chat completions 端点
    const res = await fetch('https://api.minimaxi.com/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'MiniMax-Text-01', messages: [{ role: 'user', content: 'hi' }] }),
        signal: AbortSignal.timeout(10000)
    });
    if (res.status === 401 || res.status === 403) return 'Reachable (needs valid Key)';
    if (res.status === 400) return 'Reachable (auth required)';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'OK';
}

async function testGemini() {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=test', { signal: AbortSignal.timeout(10000) });
    if (res.status === 400 || res.status === 403) return 'Reachable (needs valid Key)';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'OK';
}

async function main() {
    log('');
    log('=== Novoscan API Health Check ===');
    log(`Time: ${new Date().toISOString()}`);
    log(`Query: "${TEST_QUERY}"`);
    log('');

    log('--- Academic Track (4 sources) ---');
    await testEndpoint('OpenAlex', testOpenAlex);
    await testEndpoint('arXiv', testArxiv);
    await testEndpoint('CrossRef', testCrossRef);
    await testEndpoint('CORE', testCoreAPI);

    log('');
    log('--- Industry Track (3 sources) ---');
    await testEndpoint('Brave Search', testBraveSearch);
    await testEndpoint('SerpAPI', testSerpAPI);
    await testEndpoint('GitHub', testGitHub);

    log('');
    log('--- AI Providers ---');
    await testEndpoint('DeepSeek', testDeepSeek);
    await testEndpoint('MiniMax', testMiniMax);
    await testEndpoint('Gemini', testGemini);

    log('');
    log('=== Summary ===');
    const ok = results.filter(r => r.status === 'OK').length;
    const fail = results.filter(r => r.status === 'FAIL').length;
    log(`Total: ${results.length} | Pass: ${ok} | Fail: ${fail}`);
    if (fail > 0) {
        log('');
        log('Failed APIs:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            log(`  X ${r.name}: ${r.detail}`);
        });
    }
    log('');

    // 写结果到文件
    writeFileSync('scripts/health_report.txt', logs.join('\n'), 'utf-8');
    console.log('Report saved to scripts/health_report.txt');
}

main().catch(console.error);
