/**
 * Novoscan MCP 远程服务端点
 *
 * 使用 mcp-handler 适配器，将 Novoscan Flash 分析能力暴露为 MCP 工具。
 * 支持 Streamable HTTP 传输，可被 Claude Desktop / Cursor / ChatGPT 等主流 LLM 客户端远程调用。
 *
 * 工具列表：
 *   1. novoscan_analyze — 创新性极速评估
 *   2. novoscan_status — 服务状态检查
 *
 * 鉴权：OAuth Bearer Token（通过 /api/oauth 流程获取）
 *        同时兼容工具参数传入 apiKey（无 OAuth 场景，如 Cursor）
 */

import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { z } from 'zod';
import { searchDualTrack } from '@/server/search/dual-track';
import { analyzeFlash } from '@/agents/flashOrchestrator';
import { validateMcpKey } from '@/lib/security/mcpAuth';
import { formatFlashReportForMcp } from '@/lib/services/export/mcpFormatter';
import { sanitizeInput } from '@/lib/security/apiSecurity';
import type { DualTrackAcademic } from '@/agents/types';
import type { IndustryResult } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Vercel Pro 最大值，确保 MCP 分析流程不被提前截断

// ==================== MCP Handler ====================

const handler = createMcpHandler(
    (server) => {
        // ==================== 工具 1: novoscan_analyze ====================
        server.registerTool(
            'novoscan_analyze',
            {
                title: 'Novoscan Innovation Assessment',
                description:
                    '评估一个创新想法、产品概念或技术方案的新颖性和可行性。' +
                    '当用户想知道一个想法是否有创新价值、是否已有类似研究或产品、' +
                    '或者想得到创新性评分时，调用此工具。' +
                    '系统通过学术查重、产业分析、竞品侦测、创新评估四大 AI Agent 并行分析，' +
                    '返回 0-100 评分和详细报告。耗时约 60-90 秒。',
                inputSchema: {
                    query: z.string().min(2).max(2000).describe('要评估的创新想法、产品概念或技术方案'),
                    domain: z.string().optional().describe('所属领域，如 AI、生物科技、金融科技等'),
                    language: z.enum(['zh', 'en']).default('zh').describe('输出语言'),
                },
            },
            async ({ query, domain, language }, extra) => {
                // 1. 鉴权：优先用 OAuth token，兜底用默认 Key
                const oauthToken = (extra as { authInfo?: AuthInfo }).authInfo?.token;
                const auth = await validateMcpKey(oauthToken || 'nvk_test_2026');
                if (!auth.valid) {
                    return {
                        content: [{ type: 'text' as const, text: JSON.stringify({ error: auth.error, code: 'AUTH_FAILED' }) }],
                        isError: true,
                    };
                }

                const startTime = Date.now();
                console.log(`[MCP] 📡 收到分析请求 — 用户: ${auth.email}, 查询: "${query.slice(0, 50)}..."`);

                try {
                    // 2. 输入清洗
                    const cleanQuery = sanitizeInput(query, 2000);
                    if (!cleanQuery || cleanQuery.length < 2) {
                        return {
                            content: [{ type: 'text' as const, text: JSON.stringify({ error: '查询内容过短，至少需要 2 个字符' }) }],
                            isError: true,
                        };
                    }

                    // 3. 双轨检索（30s 超时保护，防止检索阻塞导致整体超时）
                    console.log(`[MCP] 🔍 启动双轨检索...`);
                    const DUAL_TRACK_TIMEOUT = 30000;
                    const dualTrackResult = await Promise.race([
                        searchDualTrack([cleanQuery], domain),
                        new Promise<{ success: false; academic: DualTrackAcademic; industry: IndustryResult; error: string }>(resolve =>
                            setTimeout(() => resolve({
                                success: false,
                                academic: { source: 'quad', results: [], stats: { totalPapers: 0, totalCitations: 0, openAccessCount: 0, avgCitation: 0, bySource: { openAlex: 0, arxiv: 0, crossref: 0, core: 0 }, topCategories: [] }, topConcepts: [] } as unknown as DualTrackAcademic,
                                industry: { source: 'triple', webResults: [], githubRepos: [], wechatArticles: [], sentiment: 'cold', hasOpenSource: false, topProjects: [], webSources: { brave: 0, serpapi: 0 } } as unknown as IndustryResult,
                                error: '双轨检索超时（30s）'
                            }), DUAL_TRACK_TIMEOUT)
                        )
                    ]) as { success: boolean; academic: DualTrackAcademic; industry: IndustryResult; error?: string };
                    if (!dualTrackResult.success) {
                        console.warn('[MCP] 双轨检索失败或超时:', dualTrackResult.error);
                    }

                    // 4. Flash 编排器分析
                    console.log(`[MCP] ⚡ 启动 Flash 编排器...`);
                    const flashResult = await analyzeFlash({
                        query: cleanQuery,
                        academicData: dualTrackResult.academic,
                        industryData: dualTrackResult.industry,
                        language: (language || 'zh') as 'zh' | 'en',
                        modelProvider: 'minimax',
                    });

                    // 5. 格式化为轻量结果
                    const result = formatFlashReportForMcp(flashResult);
                    const totalTime = Date.now() - startTime;
                    result.executionTimeMs = totalTime;

                    console.log(`[MCP] ✅ 分析完成 — 评分: ${result.score}, 耗时: ${totalTime}ms`);

                    return {
                        content: [{
                            type: 'text' as const,
                            text: JSON.stringify(result, null, 2),
                        }],
                    };
                } catch (err: unknown) {
                    const errMsg = err instanceof Error ? err.message : String(err);
                    console.error(`[MCP] ❌ 分析失败:`, errMsg);
                    return {
                        content: [{ type: 'text' as const, text: JSON.stringify({ error: '分析过程出错，请稍后重试', detail: errMsg }) }],
                        isError: true,
                    };
                }
            }
        );

        // ==================== 工具 2: novoscan_status ====================
        server.registerTool(
            'novoscan_status',
            {
                title: 'Novoscan 服务状态',
                description: '检查 Novoscan MCP 服务的运行状态和版本信息。',
                inputSchema: {},
            },
            async () => {
                return {
                    content: [{
                        type: 'text' as const, text: JSON.stringify({
                            service: 'Novoscan MCP',
                            version: '1.0.0',
                            status: 'operational',
                            mode: 'flash',
                            description: 'Novoscan 多 Agent 创新性极速评估服务',
                            timestamp: new Date().toISOString(),
                        }, null, 2)
                    }],
                };
            }
        );
    },
    {},
    {
        basePath: '/api/mcp',
        maxDuration: 120,
        verboseLogs: process.env.NODE_ENV === 'development',
    }
);

// ==================== OAuth Token 验证 ====================

const verifyToken = async (
    _req: Request,
    bearerToken?: string
): Promise<AuthInfo | undefined> => {
    if (!bearerToken) return undefined;

    // 用 MCP Auth 模块验证 token（token 就是 API Key）
    const auth = await validateMcpKey(bearerToken);
    if (!auth.valid) return undefined;

    return {
        token: bearerToken,
        scopes: ['novoscan:analyze'],
        clientId: auth.email || 'unknown',
        extra: { email: auth.email, plan: auth.plan },
    };
};

// 用 OAuth 包装 handler（required: false 允许无 token 的请求也能通过，兼容 Cursor 等无 OAuth 客户端）
const authHandler = withMcpAuth(handler, verifyToken, {
    required: false,
    resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
