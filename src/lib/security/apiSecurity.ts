import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkFeatureAccess } from '@/lib/stubs';

// ======================== 配置常量 ========================

/** 速率限制默认窗口（毫秒） */
const DEFAULT_WINDOW_MS = 60_000;
/** 速率限制默认最大请求数 */
const DEFAULT_MAX_REQUESTS = 10;

// ======================== Admin 鉴权（数据库驱动） ========================

/**
 * Admin API 路由鉴权守卫
 * 校验当前登录用户是否拥有 'admin' 功能权限（feature_access 表）。
 * 通过 getCurrentUser() 自动适配 NextAuth / Supabase 认证模式。
 *
 * @returns null 表示鉴权通过；非 null 表示拦截响应
 */
export async function requireAdminAuth(): Promise<NextResponse | null> {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { error: '请先登录' },
                { status: 401 }
            );
        }

        const hasAccess = await checkFeatureAccess(user.id, 'admin');
        if (!hasAccess) {
            return NextResponse.json(
                { error: '未授权访问' },
                { status: 403 }
            );
        }

        return null; // 鉴权通过
    } catch {
        return NextResponse.json(
            { error: '鉴权异常' },
            { status: 403 }
        );
    }
}

// ======================== 速率限制 ========================

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Upstash Redis 速率限制器（生产环境推荐）
 * 当环境变量 UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN 存在时自动启用。
 * 否则回退到内存滑动窗口（开发环境 / 未配置 Upstash 时）。
 */
let upstashLimiters: Map<string, Ratelimit> | null = null;

function getUpstashLimiter(routeKey: string, maxRequests: number, windowSec: number): Ratelimit | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;

    if (!upstashLimiters) upstashLimiters = new Map();

    const cacheKey = `${routeKey}:${maxRequests}:${windowSec}`;
    if (upstashLimiters.has(cacheKey)) return upstashLimiters.get(cacheKey)!;

    const limiter = new Ratelimit({
        redis: new Redis({ url, token }),
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowSec} s`),
        prefix: `novoscan:rl:${routeKey}`,
    });
    upstashLimiters.set(cacheKey, limiter);
    return limiter;
}

// ---- 内存回退 ----
const rateLimitStore = new Map<string, number[]>();

/** 定期清理过期条目（每 5 分钟） */
setInterval(() => {
    const now = Date.now();
    Array.from(rateLimitStore.entries()).forEach(([key, timestamps]) => {
        const valid = timestamps.filter((t: number) => now - t < DEFAULT_WINDOW_MS * 2);
        if (valid.length === 0) {
            rateLimitStore.delete(key);
        } else {
            rateLimitStore.set(key, valid);
        }
    });
}, 5 * 60 * 1000);

/**
 * 从请求中提取客户端 IP
 */
export function getClientIP(request: Request): string {
    const headers = new Headers(request.headers);
    return headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || headers.get('x-real-ip')
        || '127.0.0.1';
}

/**
 * 速率限制检查（异步，支持 Upstash Redis 或内存回退）
 *
 * @param request   - HTTP 请求
 * @param routeKey  - 路由标识符（如 'analyze', 'bizscan'）
 * @param maxRequests - 窗口内最大请求数（默认 10）
 * @param windowMs  - 窗口时长毫秒（默认 60000）
 * @returns null 表示放行；非 null 表示 429 响应
 */
export async function checkRateLimit(
    request: Request,
    routeKey: string,
    maxRequests: number = DEFAULT_MAX_REQUESTS,
    windowMs: number = DEFAULT_WINDOW_MS
): Promise<NextResponse | null> {
    const ip = getClientIP(request);

    // ---- 优先使用 Upstash Redis ----
    const windowSec = Math.ceil(windowMs / 1000);
    const upstash = getUpstashLimiter(routeKey, maxRequests, windowSec);
    if (upstash) {
        try {
            const { success, reset } = await upstash.limit(`${routeKey}:${ip}`);
            if (!success) {
                const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
                return NextResponse.json(
                    { error: '请求过于频繁，请稍后再试', retryAfterSeconds: retryAfterSec },
                    { status: 429, headers: { 'Retry-After': retryAfterSec.toString() } }
                );
            }
            return null; // 放行
        } catch (e) {
            // Upstash 异常时回退到内存限流，不中断服务
            console.warn('[RateLimit] Upstash 异常，回退到内存限流:', e);
        }
    }

    // ---- 内存回退 ----
    const key = `${routeKey}:${ip}`;
    const now = Date.now();

    const timestamps = rateLimitStore.get(key) || [];
    const validTimestamps = timestamps.filter(t => now - t < windowMs);

    if (validTimestamps.length >= maxRequests) {
        const retryAfterMs = windowMs - (now - validTimestamps[0]);
        return NextResponse.json(
            { error: '请求过于频繁，请稍后再试', retryAfterSeconds: Math.ceil(retryAfterMs / 1000) },
            {
                status: 429,
                headers: { 'Retry-After': Math.ceil(retryAfterMs / 1000).toString() },
            }
        );
    }

    validTimestamps.push(now);
    rateLimitStore.set(key, validTimestamps);
    return null; // 放行
}

// ======================== 输入清洗 ========================

/** Prompt 注入关键词（中英文，覆盖常见变体） */
const PROMPT_INJECTION_PATTERNS = [
    // 英文：忽略/覆盖指令
    /ignore\s+(all\s+)?(previous|above|prior|earlier)\s+(instructions?|prompts?|rules?|context)/i,
    /disregard\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/i,
    /forget\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/i,
    /override\s+(all\s+)?(previous|system)\s+(instructions?|prompts?)/i,
    // 英文：获取系统 prompt
    /system\s*prompt/i,
    /reveal\s+(your|the|system)\s+(instructions?|prompt|rules?)/i,
    /show\s+(me\s+)?(your|the|system)\s+(prompt|instructions?)/i,
    /what\s+(are|is)\s+your\s+(instructions?|prompt|rules?)/i,
    /print\s+(your|system)\s+(prompt|instructions?)/i,
    // 英文：角色扮演攻击
    /\bDAN\b.*mode/i,
    /jailbreak/i,
    /act\s+as\s+(if\s+)?(you\s+)?(have\s+)?(no|without)\s+(restrictions?|limitations?|rules?)/i,
    /you\s+are\s+now\s+(free|unrestricted|unfiltered)/i,
    /pretend\s+(you\s+)?(are|can)\s+(not|no longer)\s+(bound|restricted)/i,
    // 英文：分隔符注入
    /---+\s*(system|new\s+instructions?|override)/i,
    /\[SYSTEM\]/i,
    /\[INST\]/i,
    /<<\s*SYS\s*>>/i,
    // 中文变体
    /忽略(以上|之前|所有|全部)(的)?(指令|提示|规则|约束)/,
    /输出(系统|你的)(提示词|prompt|指令)/,
    /显示(系统|你的)(提示词|prompt|指令)/,
    /你(现在|已经)(是|变成)(自由|不受限)/,
    /扮演(一个)?(没有|不受)(限制|约束)/,
    /请(无视|忽视|跳过)(之前|以上|所有)(的)?(指令|规则)/,
];

/** 零宽字符和特殊 Unicode 字符清洗 */
const ZERO_WIDTH_REGEX = /[\u200B\u200C\u200D\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064]/g;

/**
 * 输入清洗
 *
 * @param input     - 原始用户输入
 * @param maxLength - 最大字符长度（超出则截断）
 * @returns 清洗后的字符串
 */
export function sanitizeInput(input: string, maxLength: number = 2000): string {
    if (typeof input !== 'string') return '';
    // 清除零宽字符（防 Unicode 绕过）
    let sanitized = input.replace(ZERO_WIDTH_REGEX, '');
    // 截断
    sanitized = sanitized.trim().slice(0, maxLength);
    // 移除 Prompt 注入模式（替换为标记而非拒绝，避免误杀）
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
        sanitized = sanitized.replace(pattern, '[已过滤]');
    }
    return sanitized;
}

/**
 * 检查输入是否可能包含 Prompt 注入
 */
export function hasPotentialInjection(input: string): boolean {
    if (typeof input !== 'string') return false;
    return PROMPT_INJECTION_PATTERNS.some(p => p.test(input));
}

// ======================== 安全错误响应 ========================

/**
 * 安全错误响应
 * 生产环境隐藏内部错误细节，开发环境保留调试信息。
 *
 * @param error           - 原始错误
 * @param userMessage     - 面向用户的安全消息
 * @param status          - HTTP 状态码
 * @param logPrefix       - 日志前缀
 */
export function safeErrorResponse(
    error: any,
    userMessage: string = '请求处理失败，请稍后再试',
    status: number = 500,
    logPrefix: string = '[API]'
): NextResponse {
    // 始终在服务端日志输出完整错误
    console.error(`${logPrefix} 错误:`, error?.message || error);

    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
        {
            success: false,
            error: isDev ? (error?.message || userMessage) : userMessage,
        },
        { status }
    );
}

// ======================== 模型白名单验证 ========================

const VALID_MODEL_PROVIDERS = new Set(['minimax', 'deepseek', 'moonshot']);

/**
 * 校验 modelProvider 是否在白名单中
 */
export function isValidModelProvider(provider: string): boolean {
    return VALID_MODEL_PROVIDERS.has(provider);
}
