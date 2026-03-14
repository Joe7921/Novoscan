/**
 * Novoscan 插件系统 — 自动发现与批量注册
 *
 * 类似 Next.js 文件路由的约定式插件发现机制：
 * 自动扫描 `src/plugins/agents/` 下所有子目录的 `index.ts`，
 * 批量加载并注册到 PluginRegistry。
 *
 * 目录约定：
 * ```
 * src/plugins/agents/
 * ├── patent-scout/
 * │   └── index.ts       ← export default defineAgent({...})
 * ├── market-radar/
 * │   └── index.ts       ← export default defineAgent({...})
 * └── ...
 * ```
 *
 * 使用方式：
 * ```typescript
 * import { autoDiscoverPlugins } from '@/plugins/discovery'
 * const results = await autoDiscoverPlugins()
 * ```
 */

import { PluginRegistry } from './registry'
import type { INovoAgent } from './types'

/** 插件发现结果（单个） */
export interface DiscoveryResult {
  /** 插件目录名（如 'patent-scout'） */
  dirName: string
  /** 是否成功加载并注册 */
  success: boolean
  /** 注册成功的 Agent（成功时有值） */
  agent?: INovoAgent
  /** 失败时的错误信息 */
  error?: string
}

/** 批量发现结果汇总 */
export interface DiscoverySummary {
  /** 总共发现的插件目录数 */
  total: number
  /** 成功注册数 */
  succeeded: number
  /** 失败数 */
  failed: number
  /** 各插件的详细结果 */
  results: DiscoveryResult[]
}

/**
 * 已知内置插件模块映射表
 *
 * 由于 Next.js / Webpack 环境不支持运行时动态 fs 扫描目录，
 * 我们采用「静态注册表 + 动态加载」的方式实现约定式发现：
 *
 * 1. 新增插件时，只需在 agents/ 下创建目录和 index.ts
 * 2. 然后在此映射表中添加一行即可
 *
 * 这是 Next.js 生态中的标准做法（类似 next.config.js 的 rewrites），
 * 在保持约定大于配置的同时兼容打包器的静态分析需求。
 */
const PLUGIN_MODULES: Record<string, () => Promise<{ default: INovoAgent }>> = {
  'patent-scout': () => import('./agents/patent-scout/index'),
}

/**
 * 手动注册一个插件模块到发现映射表
 *
 * 用于在运行时动态扩展可发现的插件（无需修改本文件源码）。
 *
 * @param dirName - 插件目录名（如 'market-radar'）
 * @param loader - 动态导入函数，返回包含 default 导出的模块
 *
 * @example
 * ```typescript
 * registerPluginModule('market-radar', () => import('./agents/market-radar/index'))
 * ```
 */
export function registerPluginModule(
  dirName: string,
  loader: () => Promise<{ default: INovoAgent }>
): void {
  PLUGIN_MODULES[dirName] = loader
  console.log(`[PluginDiscovery] 📋 已注册插件模块: ${dirName}`)
}

/**
 * 自动发现并批量注册所有已映射的插件
 *
 * 遍历 PLUGIN_MODULES 映射表，逐个动态加载并注册到 PluginRegistry。
 * 单个插件的加载/注册失败不会影响其他插件。
 *
 * @returns 批量发现结果汇总
 *
 * @example
 * ```typescript
 * // 在应用启动时调用
 * const summary = await autoDiscoverPlugins()
 * console.log(`成功加载 ${summary.succeeded}/${summary.total} 个插件`)
 * ```
 */
export async function autoDiscoverPlugins(): Promise<DiscoverySummary> {
  const registry = PluginRegistry.getInstance()
  const dirNames = Object.keys(PLUGIN_MODULES)
  const results: DiscoveryResult[] = []

  console.log(`[PluginDiscovery] 🔍 开始自动发现插件，共 ${dirNames.length} 个模块...`)

  for (const dirName of dirNames) {
    try {
      // 1. 动态加载模块
      const loader = PLUGIN_MODULES[dirName]
      const module = await loader()

      // 2. 检查 default 导出
      const agent = module.default
      if (!agent) {
        results.push({
          dirName,
          success: false,
          error: `模块 "${dirName}" 没有 default 导出，请使用 export default defineAgent({...})`,
        })
        continue
      }

      // 3. 检查是否已注册（跳过重复）
      if (registry.getAgent(agent.id)) {
        console.log(`[PluginDiscovery] ⏭️ Agent "${agent.id}" 已注册，跳过`)
        results.push({
          dirName,
          success: true,
          agent,
        })
        continue
      }

      // 4. 注册（内部自动校验 + onInit）
      await registry.registerAgent(agent)
      results.push({
        dirName,
        success: true,
        agent,
      })

      console.log(`[PluginDiscovery] ✅ 已加载: ${agent.icon || '🤖'} ${agent.name} (${agent.id}) v${agent.version}`)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error(`[PluginDiscovery] ❌ 加载 "${dirName}" 失败: ${errorMsg}`)
      results.push({
        dirName,
        success: false,
        error: errorMsg,
      })
    }
  }

  const succeeded = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const summary: DiscoverySummary = {
    total: dirNames.length,
    succeeded,
    failed,
    results,
  }

  console.log(
    `[PluginDiscovery] 📊 发现完成: ${succeeded} 成功, ${failed} 失败, 共 ${dirNames.length} 个`
  )

  return summary
}
