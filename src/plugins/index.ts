/**
 * Novoscan 插件系统 — 统一入口
 *
 * 导出所有插件公共 API，外部使用时只需：
 * ```typescript
 * import { defineAgent, registerAgent, autoDiscoverPlugins } from '@/plugins'
 * ```
 */

// 类型定义 & 辅助函数 & 运行时校验
export type { INovoAgent, ISearchProvider, SearchResult } from './types'
export { defineAgent, defineSearchProvider } from './types'
export { validateAgent, validateSearchProvider, PluginValidationError } from './types'

// 注册中心
export { PluginRegistry } from './registry'
export {
  registerAgent,
  getAgent,
  getAllAgents,
  registerSearchProvider,
  getSearchProvider,
  getAllSearchProviders,
} from './registry'

// 自动发现
export type { DiscoveryResult, DiscoverySummary } from './discovery'
export { autoDiscoverPlugins, registerPluginModule } from './discovery'

// SDK 版本
export { SDK_VERSION } from './sdk'

// 插件桥接（PluginRegistry → AgentRegistry 自动同步）
export { bridgePluginsToAgentRegistry, resetBridge } from './plugin-bridge'
export type { BridgeResult } from './plugin-bridge'
