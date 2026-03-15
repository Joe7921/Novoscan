/**
 * Novoscan WASM 桥接层
 *
 * 负责加载 Rust WASM 核心模块，并在加载失败时自动降级到 TypeScript 实现。
 * 对上层调用者完全透明 —— 无需关心底层是 WASM 还是 TS。
 *
 * 使用方式：
 *   import { wasmQualityGuard, wasmParseAgentJSON, isWasmLoaded } from '@/lib/wasmBridge';
 */

// ==================== WASM 模块状态 ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wasmModule: any = null;
let wasmLoadAttempted = false;
let wasmLoadError: string | null = null;

/** 检测当前运行环境 */
const isServer = typeof window === 'undefined';

/**
 * 懒加载 WASM 模块（只加载一次）
 * 自动检测环境：
 * - Node.js → 加载 pkg/novoscan-core（同步 require）
 * - 浏览器 → 加载 pkg/novoscan-core-web（async init + fetch .wasm）
 * 失败时静默降级，不阻塞主流程
 */
async function ensureWasmLoaded(): Promise<boolean> {
    if (wasmLoadAttempted) return wasmModule !== null;
    wasmLoadAttempted = true;

    try {
        if (isServer) {
            // Node.js 环境：使用 nodejs target 包
            wasmModule = await import('../../pkg/novoscan-core/novoscan_core');
        } else {
            // 浏览器环境：使用 web target 包（需要 async init）
            const mod = await import('../../pkg/novoscan-core-web/novoscan_core');
            // web target 需要调用 init() 加载 .wasm 文件
            if (typeof mod.default === 'function') {
                await mod.default();
            }
            wasmModule = mod;
        }
        const ver = wasmModule.version();
        console.log(`[WASM Bridge] ✅ novoscan-core WASM v${ver} 加载成功 (${isServer ? 'Node.js' : '浏览器'})`);
        return true;
    } catch (err: unknown) {
        wasmLoadError = err instanceof Error ? err.message : String(err);
        console.warn(`[WASM Bridge] ⚠️ WASM 加载失败，降级到 TypeScript 实现: ${wasmLoadError}`);
        return false;
    }
}

/** 检查 WASM 是否已成功加载 */
export function isWasmLoaded(): boolean {
    return wasmModule !== null;
}

/** 获取 WASM 加载信息（调试用） */
export function getWasmStatus(): { loaded: boolean; version: string | null; error: string | null } {
    return {
        loaded: wasmModule !== null,
        version: wasmModule ? wasmModule.version() : null,
        error: wasmLoadError,
    };
}

// ==================== 质量守卫评分引擎 ====================

import type { ArbitrationResult, AgentOutput, QualityCheckResult, DebateRecord } from '@/agents/types';
import { qualityGuard as tsQualityGuard } from '@/agents/qualityGuard';

/**
 * 质量守卫评分检查（WASM 加速版，自动降级）
 *
 * 优先使用 Rust WASM 实现（~10x 加速），失败时自动降级到 TypeScript 版本。
 * 行为与 TypeScript 版完全一致（通过同一组 vitest 测试用例验证）。
 */
export async function wasmQualityGuard(
    arbitration: ArbitrationResult,
    agents: AgentOutput[],
    debateRecord?: DebateRecord
): Promise<QualityCheckResult> {
    await ensureWasmLoaded();

    if (wasmModule) {
        try {
            const input = JSON.stringify({
                arbitration,
                agents,
                debateRecord: debateRecord || null,
            });
            const resultJson = wasmModule.qualityGuard(input);
            return JSON.parse(resultJson) as QualityCheckResult;
        } catch (err: unknown) {
            console.warn('[WASM Bridge] qualityGuard WASM 执行失败，降级到 TS:', err instanceof Error ? err.message : err);
        }
    }

    // TS fallback
    return tsQualityGuard(arbitration, agents, debateRecord);
}

// ==================== JSON 自愈解析器 ====================

import { parseAgentJSON as tsParseAgentJSON } from '@/lib/ai-client';

/**
 * JSON 自愈解析器（WASM 加速版，自动降级）
 *
 * 优先使用 Rust WASM 实现（字符级解析 ~20x 加速），失败时自动降级到 TypeScript 版本。
 * 4 层策略与 TypeScript 版完全一致。
 */
export async function wasmParseAgentJSON<T>(text: string): Promise<T> {
    await ensureWasmLoaded();

    if (wasmModule) {
        try {
            const resultJson = wasmModule.parseAgentJSON(text);
            return JSON.parse(resultJson) as T;
        } catch (err: unknown) {
            console.warn('[WASM Bridge] parseAgentJSON WASM 执行失败，降级到 TS:', err instanceof Error ? err.message : err);
        }
    }

    // TS fallback（同步函数，用 Promise 包装保持接口一致）
    return tsParseAgentJSON<T>(text);
}
