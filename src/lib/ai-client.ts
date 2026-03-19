/**
 * AI Client 兼容层 — 原 src/lib/ai-client.ts
 *
 * 所有实现已迁移至 src/lib/ai/ 目录的子模块。
 * 本文件仅做 re-export，确保所有 `import { ... } from '@/lib/ai-client'` 继续正常工作。
 *
 * 未来可以直接删除此文件，将 import 改为 `from '@/lib/ai'`。
 */

// 全量 re-export 新的 AI 模块
export {
    // 类型
    type AIAnalysisResult,
    type ProviderConfig,
    type StreamChunkResult,
    type CallOpts,
    // 注册表
    PROVIDER_REGISTRY,
    // 引擎
    callProvider,
    // R1
    callDeepSeekR1,
    // 降级链
    buildModelChain,
    isProviderAvailable,
    // JSON 解析
    parseAgentJSON,
    extractJSON,
    // 高级调用
    callAIRaw,
    callAIWithFallback,
} from './ai/index';
