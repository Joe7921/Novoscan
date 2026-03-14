/**
 * Novoscan 巡检脚本 — 部署到 OpenClaw 服务器
 * 路径: /root/.openclaw/workspace/novoscan-inspect/inspect.mjs
 *
 * 输出 JSON 报告，供 OpenClaw Agent 分析后推送 Telegram
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// 读取 .env 文件
try {
    const e = readFileSync(new URL("./.env", import.meta.url), "utf-8");
    for (const l of e.split("\n")) {
        const m = l.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim();
    }
} catch {}

const U = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!U || !K) {
    console.log(JSON.stringify({ status: "error", error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }));
    process.exit(1);
}

const sb = createClient(U, K);
const AGENTS = ["academicReviewer", "industryAnalyst", "competitorDetective", "innovationEvaluator", "arbitrator"];
const PRICING = { deepseek: 0.0042, gemini: 0.00625, "deepseek-r1": 0.02, minimax: 0.002 };

async function inspect() {
    const now = Date.now();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const d7 = new Date(now - 7 * 86400000);
    const d14 = new Date(now - 14 * 86400000);
    const r = { status: "ok", ts: new Date().toISOString(), kpi: {}, agents: {}, costs: {}, failover: {}, failures: [], cache: {}, alerts: [] };

    try {
        // KPI
        const [t, td, w1, w0] = await Promise.all([
            sb.from("search_history").select("*", { count: "exact", head: true }),
            sb.from("search_history").select("*", { count: "exact", head: true }).gte("created_at", todayStart.toISOString()),
            sb.from("search_history").select("*", { count: "exact", head: true }).gte("created_at", d7.toISOString()),
            sb.from("search_history").select("*", { count: "exact", head: true }).gte("created_at", d14.toISOString()).lt("created_at", d7.toISOString()),
        ]);
        const total = t.count || 0, today = td.count || 0, week = w1.count || 0, prev = w0.count || 0;
        r.kpi = { total, today, thisWeek: week, lastWeek: prev, weekTrend: prev > 0 ? ((week - prev) / prev * 100).toFixed(1) + "%" : "N/A" };

        // Agent 水位
        const { data: recs } = await sb.from("search_history").select("result").order("created_at", { ascending: false }).limit(100);
        const as = {}; for (const n of AGENTS) as[n] = { runs: 0, ok: 0, to: 0, ms: 0 };
        for (const rc of (recs || [])) {
            const ag = rc.result?.executionRecord?.agents; if (!ag) continue;
            for (const n of AGENTS) { const a = ag[n]; if (!a) continue; as[n].runs++; if (a.status === "completed") as[n].ok++; if (a.status === "timeout") as[n].to++; if (a.executionTimeMs > 0) as[n].ms += a.executionTimeMs; }
        }
        for (const n of AGENTS) { const s = as[n]; r.agents[n] = { completionRate: s.runs > 0 ? Math.round(s.ok / s.runs * 100) + "%" : "N/A", timeoutRate: s.runs > 0 ? Math.round(s.to / s.runs * 100) + "%" : "0%", avgMs: s.runs > 0 ? Math.round(s.ms / s.runs) : 0, runs: s.runs }; }

        // 费用
        try {
            const { data: calls } = await sb.from("api_call_logs").select("*").gte("called_at", todayStart.toISOString()).limit(10000);
            if (calls && calls.length > 0) {
                let cost = 0, tokens = 0, fails = 0; const bp = {};
                for (const c of calls) { const p = c.provider || "unknown"; if (!bp[p]) bp[p] = { calls: 0, tokens: 0, cost: 0 }; bp[p].calls++; const tk = c.estimated_tokens || 0; tokens += tk; bp[p].tokens += tk; const pc = (tk / 1000) * (PRICING[p] || 0.002); cost += pc; bp[p].cost += pc; if (!c.is_success) fails++; }
                r.costs = { todayUSD: "$" + cost.toFixed(4), monthEst: "$" + (cost * 30).toFixed(2), tokens, calls: calls.length, failed: fails, successRate: Math.round((1 - fails / calls.length) * 100) + "%" };
            } else { r.costs = { todayUSD: "$0", note: "今日无API调用" }; }
        } catch { r.costs = { todayUSD: "$0", note: "api_call_logs不可用" }; }

        // 失败记录
        const { data: fr } = await sb.from("search_history").select("query, model_provider, search_time_ms, result, created_at").order("created_at", { ascending: false }).limit(50);
        r.failures = (fr || []).filter(x => !x.result || x.result.success === false || x.result.error).slice(0, 5).map(x => ({ query: (x.query || "").slice(0, 40), error: x.result?.error || x.result?.errorType || "未知", provider: x.model_provider, time: x.created_at, ms: x.search_time_ms }));

        // 缓存
        const { count: c24 } = await sb.from("search_history").select("*", { count: "exact", head: true }).gte("created_at", new Date(now - 86400000).toISOString());
        r.cache = { active24h: c24 || 0, last7d: week, total, staleOver7d: total - week };

        // Failover 检测
        try {
            const { data: foLogs } = await sb.from("api_call_logs").select("provider, error_message, called_at").like("provider", "%failover%").gte("called_at", new Date(now - 86400000).toISOString()).order("called_at", { ascending: false }).limit(100);
            const foCount = foLogs?.length || 0;
            const foLatest = foLogs?.[0]?.called_at || null;
            const foReasons = [...new Set((foLogs || []).map(l => l.error_message).filter(Boolean))].slice(0, 3);
            r.failover = { count24h: foCount, latestAt: foLatest, reasons: foReasons };
            if (foCount >= 10) r.alerts.push({ level: "critical", msg: `Gemini 主Key 24h内 ${foCount} 次failover，主Key可能已失效！原因: ${foReasons[0] || '未知'}` });
            else if (foCount >= 3) r.alerts.push({ level: "warning", msg: `Gemini 主Key 24h内 ${foCount} 次failover，需检查中转平台状态` });
        } catch { r.failover = { count24h: 0, note: "查询失败" }; }

        // 告警
        if (r.failures.length >= 3) r.alerts.push({ level: "critical", msg: "近期" + r.failures.length + "条失败" });
        else if (r.failures.length >= 1) r.alerts.push({ level: "warning", msg: r.failures.length + "条失败记录" });
        for (const n of AGENTS) { const s = as[n]; if (s.runs > 3 && s.to / s.runs > 0.2) r.alerts.push({ level: "warning", msg: n + " 超时率" + Math.round(s.to / s.runs * 100) + "%" }); }
        if (prev > 0 && week < prev * 0.5) r.alerts.push({ level: "warning", msg: "本周" + week + " vs 上周" + prev + " 降50%+" });
        r.status = r.alerts.some(a => a.level === "critical") ? "critical" : r.alerts.length > 0 ? "warning" : "ok";
    } catch (e) { r.status = "error"; r.error = e.message; }

    console.log(JSON.stringify(r, null, 2));
}

inspect();
