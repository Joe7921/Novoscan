export const dynamic = 'force-dynamic';

/**
 * API 健康诊断端点
 * 
 * 逐一测试所有搜索 API 和 AI 服务的连通性，
 * 用于排查 Vercel 生产环境中 API 调用失败的根因。
 * 
 * GET /api/health/api-test?query=test
 */

import { NextResponse } from 'next/server';

interface TestResult {
  name: string;
  status: 'ok' | 'error' | 'skipped';
  statusCode?: number;
  resultCount?: number;
  error?: string;
  durationMs: number;
  detail?: string;
}

async function testWithTimeout<T>(
  name: string,
  fn: () => Promise<T>,
  timeoutMs = 8000
): Promise<{ result?: T; error?: string; durationMs: number }> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${name} 超时(${timeoutMs}ms)`)), timeoutMs)
      ),
    ]);
    return { result, durationMs: Date.now() - start };
  } catch (e: any) {
    return { error: e.message || String(e), durationMs: Date.now() - start };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || 'machine learning';

  const results: TestResult[] = [];

  // ===== 1. Brave Search =====
  {
    const apiKey = process.env.BRAVE_API_KEY || '';
    if (!apiKey) {
      results.push({ name: 'Brave Search', status: 'skipped', error: 'BRAVE_API_KEY 未配置', durationMs: 0 });
    } else {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`;
      const { result, error, durationMs } = await testWithTimeout('Brave', async () => {
        const r = await fetch(url, {
          headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey },
        });
        const data = await r.json();
        return { status: r.status, count: data.web?.results?.length || 0, data };
      });
      results.push({
        name: 'Brave Search',
        status: result ? (result.status === 200 ? 'ok' : 'error') : 'error',
        statusCode: result?.status,
        resultCount: result?.count,
        error: error || (result && result.status !== 200 ? `HTTP ${result.status}` : undefined),
        durationMs,
        detail: result?.count === 0 ? '返回0条结果 — API正常但无匹配内容' : undefined,
      });
    }
  }

  // ===== 2. SerpAPI =====
  {
    const apiKey = process.env.SERPAPI_KEY || '';
    if (!apiKey) {
      results.push({ name: 'SerpAPI', status: 'skipped', error: 'SERPAPI_KEY 未配置', durationMs: 0 });
    } else {
      const url = `https://serpapi.com/search?api_key=${apiKey}&engine=google&q=${encodeURIComponent(query)}&num=3&hl=zh-CN`;
      const { result, error, durationMs } = await testWithTimeout('SerpAPI', async () => {
        const r = await fetch(url);
        const data = await r.json();
        return {
          status: r.status,
          count: data.organic_results?.length || 0,
          accountInfo: data.search_metadata?.status,
          remainingSearches: data.search_information?.total_results,
        };
      });
      results.push({
        name: 'SerpAPI (Google)',
        status: result ? (result.status === 200 ? 'ok' : 'error') : 'error',
        statusCode: result?.status,
        resultCount: result?.count,
        error: error || (result && result.status !== 200 ? `HTTP ${result.status}` : undefined),
        durationMs,
        detail: result?.count === 0 ? `返回0条结果 (meta: ${result?.accountInfo || 'unknown'})` : undefined,
      });
    }
  }

  // ===== 3. GitHub =====
  {
    const token = process.env.GITHUB_TOKEN || '';
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Novoscan-Diag/1.0',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&per_page=3`;
    const { result, error, durationMs } = await testWithTimeout('GitHub', async () => {
      const r = await fetch(url, { headers });
      const data = await r.json();
      return {
        status: r.status,
        totalCount: data.total_count,
        itemCount: data.items?.length || 0,
        rateRemaining: r.headers.get('X-RateLimit-Remaining'),
        rateLimit: r.headers.get('X-RateLimit-Limit'),
        message: data.message,
      };
    });
    results.push({
      name: `GitHub${token ? ' (Token)' : ' (匿名)'}`,
      status: result ? (result.status === 200 ? 'ok' : 'error') : 'error',
      statusCode: result?.status,
      resultCount: result?.itemCount,
      error: error || result?.message || (result && result.status !== 200 ? `HTTP ${result.status}` : undefined),
      durationMs,
      detail: result ? `总计${result.totalCount || 0}个仓库 | 速率: ${result.rateRemaining}/${result.rateLimit}` : undefined,
    });
  }

  // ===== 4. OpenAlex =====
  {
    const email = process.env.OPENALEX_EMAIL || '';
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=publication_year:>2022&per-page=3&mailto=${encodeURIComponent(email)}`;
    const { result, error, durationMs } = await testWithTimeout('OpenAlex', async () => {
      const r = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': `Novoscan/1.0 (mailto:${email})` },
      });
      const data = await r.json();
      return { status: r.status, count: data.results?.length || 0, totalCount: data.meta?.count || 0 };
    });
    results.push({
      name: 'OpenAlex',
      status: result ? (result.status === 200 ? 'ok' : 'error') : 'error',
      statusCode: result?.status,
      resultCount: result?.count,
      error,
      durationMs,
      detail: result ? `总计 ${result.totalCount} 篇匹配论文` : undefined,
    });
  }

  // ===== 5. CrossRef =====
  {
    const email = process.env.CROSSREF_EMAIL || '';
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=3&mailto=${encodeURIComponent(email)}`;
    const { result, error, durationMs } = await testWithTimeout('CrossRef', async () => {
      const r = await fetch(url, {
        headers: { 'User-Agent': `Novoscan/1.0 (mailto:${email})` },
      });
      const data = await r.json();
      return { status: r.status, count: data.message?.items?.length || 0, totalCount: data.message?.['total-results'] || 0 };
    });
    results.push({
      name: 'CrossRef',
      status: result ? (result.status === 200 ? 'ok' : 'error') : 'error',
      statusCode: result?.status,
      resultCount: result?.count,
      error,
      durationMs,
      detail: result ? `总计 ${result.totalCount} 篇匹配` : undefined,
    });
  }

  // ===== 6. DeepSeek AI =====
  {
    const apiKey = process.env.DEEPSEEK_API_KEY || '';
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    if (!apiKey) {
      results.push({ name: 'DeepSeek AI', status: 'skipped', error: 'DEEPSEEK_API_KEY 未配置', durationMs: 0 });
    } else {
      const { result, error, durationMs } = await testWithTimeout('DeepSeek', async () => {
        const r = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'reply OK' }], max_tokens: 5 }),
        });
        const data = await r.json();
        return { status: r.status, content: data.choices?.[0]?.message?.content || '', model: data.model };
      });
      results.push({
        name: 'DeepSeek AI',
        status: result ? (result.status === 200 ? 'ok' : 'error') : 'error',
        statusCode: result?.status,
        error,
        durationMs,
        detail: result ? `模型: ${result.model} | 回复: "${result.content}"` : undefined,
      });
    }
  }

  // ===== 7. MiniMax AI =====
  {
    const apiKey = process.env.MINIMAX_API_KEY || '';
    const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/v1';
    const model = process.env.MINIMAX_MODEL || 'minimax-text-01';
    if (!apiKey) {
      results.push({ name: 'MiniMax AI', status: 'skipped', error: 'MINIMAX_API_KEY 未配置', durationMs: 0 });
    } else {
      // 使用与 ai-client.ts 相同的 URL 拼接逻辑
      const trimmed = baseUrl.replace(/\/+$/, '');
      let url: string;
      if (trimmed.endsWith('/chat/completions')) url = trimmed;
      else if (trimmed.endsWith('/v1')) url = `${trimmed}/chat/completions`;
      else url = `${trimmed}/v1/chat/completions`;

      const { result, error, durationMs } = await testWithTimeout('MiniMax', async () => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: 'reply OK' }], max_tokens: 5 }),
        });
        const data = await r.json();
        return { status: r.status, content: data.choices?.[0]?.message?.content || '', resolvedUrl: url, model: data.model };
      });
      results.push({
        name: 'MiniMax AI',
        status: result ? (result.status === 200 ? 'ok' : 'error') : 'error',
        statusCode: result?.status,
        error,
        durationMs,
        detail: result ? `URL: ${result.resolvedUrl} | 模型: ${result.model} | 回复: "${result.content}"` : `URL: ${url}`,
      });
    }
  }

  // ===== 8. Moonshot Kimi AI =====
  {
    const apiKey = process.env.MOONSHOT_API_KEY || '';
    const baseUrl = process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1';
    if (!apiKey) {
      results.push({ name: 'Moonshot Kimi', status: 'skipped', error: 'MOONSHOT_API_KEY 未配置', durationMs: 0 });
    } else {
      const trimmed = baseUrl.replace(/\/+$/, '');
      let url: string;
      if (trimmed.endsWith('/chat/completions')) url = trimmed;
      else if (trimmed.endsWith('/v1')) url = `${trimmed}/chat/completions`;
      else url = `${trimmed}/v1/chat/completions`;

      const { result, error, durationMs } = await testWithTimeout('Moonshot', async () => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ model: 'kimi-k2.5', messages: [{ role: 'user', content: 'reply OK' }], max_tokens: 5 }),
        });
        const data = await r.json();
        return { status: r.status, content: data.choices?.[0]?.message?.content || '', model: data.model };
      });
      results.push({
        name: 'Moonshot Kimi',
        status: result ? (result.status === 200 ? 'ok' : 'error') : 'error',
        statusCode: result?.status,
        error,
        durationMs,
        detail: result ? `模型: ${result.model} | 回复: "${result.content}"` : undefined,
      });
    }
  }

  // ===== 汇总 =====
  const okCount = results.filter(r => r.status === 'ok').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;

  // 环境变量逐一对比（本地 .env.local 预期字符数 vs Vercel 实际值）
  const envExpected: Record<string, number> = {
    'NEXT_PUBLIC_SUPABASE_URL': 43,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': 217,
    'SUPABASE_SERVICE_ROLE_KEY': 219,
    'BRAVE_API_KEY': 31,
    'SERPAPI_KEY': 64,
    'CORE_API_KEY': 32,
    'GITHUB_TOKEN': 93,
    'DEEPSEEK_API_KEY': 35,
    'DEEPSEEK_BASE_URL': 24,  // https://api.deepseek.com
    'MINIMAX_API_KEY': 121,
    'MINIMAX_BASE_URL': 24,   // https://api.minimax.chat
    'MINIMAX_MODEL': 15,      // minimax-text-01
    'MOONSHOT_API_KEY': 48,
    'OPENALEX_EMAIL': 24,
    'CROSSREF_EMAIL': 24,
    'MCP_API_KEYS': 39,
    'RESEND_API_KEY': 37,
    'CRON_SECRET': 25,
    'NEXT_PUBLIC_SITE_URL': 20,
    'NEXT_PUBLIC_ADSENSE_CLIENT': 24,
    'NEXT_PUBLIC_ADSENSE_REWARD_SLOT': 10,
    'NEXT_PUBLIC_ADSENSE_REPORT_SLOT': 10,
    'NEXT_PUBLIC_ADSENSE_TRENDS_SLOT': 10,
  };
  const envCheck: Record<string, { status: string; vercelLen: number | null; localLen: number; match: boolean; value?: string }> = {};
  for (const [key, expectedLen] of Object.entries(envExpected)) {
    const val = process.env[key];
    if (!val) {
      envCheck[key] = { status: '❌ 未配置', vercelLen: null, localLen: expectedLen, match: false };
    } else {
      const lenMatch = val.length === expectedLen;
      envCheck[key] = {
        status: lenMatch ? '✅ 匹配' : `⚠️ 长度不同`,
        vercelLen: val.length,
        localLen: expectedLen,
        match: lenMatch,
        value: val.length <= 30 ? val : `${val.substring(0, 8)}...${val.substring(val.length - 4)}`,
      };
    }
  }
  const mismatchCount = Object.values(envCheck).filter(v => !v.match).length;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    query,
    summary: { total: results.length, ok: okCount, error: errorCount, skipped: skippedCount },
    results,
    envMismatchCount: mismatchCount,
    envCheck,
  }, { status: 200 });
}
