/**
 * Novoscan 插件 SDK — 统一入口
 *
 * 导出所有 SDK 公共 API，外部使用时只需：
 * ```typescript
 * import { defineAgent, SDK_VERSION } from '@/plugins/sdk'
 * ```
 */

// 核心类型定义、辅助函数、运行时校验
export type { INovoAgent, ISearchProvider, SearchResult } from './types'
export {
  defineAgent,
  defineSearchProvider,
  validateAgent,
  validateSearchProvider,
  PluginValidationError,
} from './types'

// Manifest 模式定义、SDK 版本常量
export type {
  PluginManifest,
  PluginPermission,
  PluginPricing,
  PluginCategory,
} from './manifest-schema'
export { NOVOSCAN_PLUGIN_SDK_VERSION } from './manifest-schema'

// SDK 版本别名（简洁导出）
export { NOVOSCAN_PLUGIN_SDK_VERSION as SDK_VERSION } from './manifest-schema'
