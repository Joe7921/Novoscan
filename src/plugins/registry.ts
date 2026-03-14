/**
 * Novoscan 插件系统 — 注册中心（单例）
 *
 * 提供 Agent 和 SearchProvider 的注册、查询、注销能力。
 * 全局唯一实例，通过 `PluginRegistry.getInstance()` 获取。
 *
 * 增强特性：
 * - 注册时自动执行运行时格式校验（validateAgent / validateSearchProvider）
 * - 注册时自动调用 onInit() 生命周期钩子
 * - 注销时自动调用 onDestroy() 生命周期钩子
 */

import type { INovoAgent, ISearchProvider } from './types'
import { validateAgent, validateSearchProvider, PluginValidationError } from './types'

/**
 * 插件注册中心（单例模式）
 *
 * @example
 * ```typescript
 * import { PluginRegistry } from '@/plugins/registry'
 * import patentScout from '@/plugins/agents/patent-scout'
 *
 * const registry = PluginRegistry.getInstance()
 * await registry.registerAgent(patentScout)
 *
 * const agent = registry.getAgent('patent-scout')
 * const allAgents = registry.getAllAgents()
 * ```
 */
export class PluginRegistry {
  /** 单例实例 */
  private static instance: PluginRegistry | null = null

  /** Agent 插件存储（id → INovoAgent） */
  private agents: Map<string, INovoAgent> = new Map()

  /** 搜索数据源存储（id → ISearchProvider） */
  private searchProviders: Map<string, ISearchProvider> = new Map()

  /** 私有构造函数，禁止外部 new */
  private constructor() {}

  /**
   * 获取注册中心单例
   */
  static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry()
    }
    return PluginRegistry.instance
  }

  // ==================== Agent 管理 ====================

  /**
   * 注册一个 Agent 插件
   *
   * 注册流程：
   * 1. 运行时格式校验（id 格式、版本号、必填字段、方法类型等）
   * 2. ID 重复检查
   * 3. 调用 onInit() 生命周期钩子（如有）
   * 4. 存入注册表
   *
   * @param agent - 实现 INovoAgent 接口的插件实例
   * @throws {PluginValidationError} 格式校验失败时抛出
   * @throws {Error} id 已被注册时抛出
   */
  async registerAgent(agent: INovoAgent): Promise<void> {
    // 1. 运行时严格校验
    validateAgent(agent)

    // 2. ID 重复检查
    if (this.agents.has(agent.id)) {
      throw new Error(
        `[PluginRegistry] Agent "${agent.id}" 已注册，不允许重复注册。` +
        `若需替换，请先调用 unregisterAgent("${agent.id}")`
      )
    }

    // 3. 生命周期钩子：onInit
    if (agent.onInit) {
      try {
        await agent.onInit()
        console.log(`[PluginRegistry] 🔄 Agent "${agent.id}" onInit() 执行成功`)
      } catch (err) {
        throw new PluginValidationError(agent.id, [
          `onInit() 执行失败: ${err instanceof Error ? err.message : String(err)}`
        ])
      }
    }

    // 4. 存入注册表
    this.agents.set(agent.id, agent)
    console.log(`[PluginRegistry] ✅ Agent 已注册: ${agent.name} (${agent.id}) v${agent.version}`)
  }

  /**
   * 根据 ID 获取已注册的 Agent
   *
   * @param id - Agent 唯一标识
   * @returns Agent 实例，未找到返回 undefined
   */
  getAgent(id: string): INovoAgent | undefined {
    return this.agents.get(id)
  }

  /**
   * 获取所有已注册的 Agent
   *
   * @returns Agent 数组（按注册顺序）
   */
  getAllAgents(): INovoAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * 注销一个 Agent 插件
   *
   * 注销流程：
   * 1. 查找并移除
   * 2. 调用 onDestroy() 生命周期钩子（如有，异常不阻塞注销）
   *
   * @param id - Agent 唯一标识
   * @returns 是否成功注销（false 表示该 id 不存在）
   */
  async unregisterAgent(id: string): Promise<boolean> {
    const agent = this.agents.get(id)
    if (!agent) return false

    // 先从注册表移除
    this.agents.delete(id)

    // 生命周期钩子：onDestroy（异常仅警告，不阻塞注销）
    if (agent.onDestroy) {
      try {
        await agent.onDestroy()
        console.log(`[PluginRegistry] 🔄 Agent "${id}" onDestroy() 执行成功`)
      } catch (err) {
        console.warn(
          `[PluginRegistry] ⚠️ Agent "${id}" onDestroy() 执行失败（已忽略）:`,
          err instanceof Error ? err.message : err
        )
      }
    }

    console.log(`[PluginRegistry] 🗑️ Agent 已注销: ${id}`)
    return true
  }

  // ==================== SearchProvider 管理 ====================

  /**
   * 注册一个搜索数据源
   *
   * 注册流程：
   * 1. 运行时格式校验
   * 2. ID 重复检查
   * 3. 存入注册表
   *
   * @param provider - 实现 ISearchProvider 接口的数据源实例
   * @throws {PluginValidationError} 格式校验失败时抛出
   * @throws {Error} id 已被注册时抛出
   */
  registerSearchProvider(provider: ISearchProvider): void {
    // 1. 运行时严格校验
    validateSearchProvider(provider)

    // 2. ID 重复检查
    if (this.searchProviders.has(provider.id)) {
      throw new Error(
        `[PluginRegistry] SearchProvider "${provider.id}" 已注册，不允许重复注册。`
      )
    }

    // 3. 存入注册表
    this.searchProviders.set(provider.id, provider)
    console.log(`[PluginRegistry] ✅ SearchProvider 已注册: ${provider.name} (${provider.id})`)
  }

  /**
   * 根据 ID 获取已注册的搜索数据源
   *
   * @param id - 数据源唯一标识
   * @returns 数据源实例，未找到返回 undefined
   */
  getSearchProvider(id: string): ISearchProvider | undefined {
    return this.searchProviders.get(id)
  }

  /**
   * 获取所有已注册的搜索数据源（按优先级排序）
   *
   * @returns 数据源数组（priority 越小越靠前）
   */
  getAllSearchProviders(): ISearchProvider[] {
    return Array.from(this.searchProviders.values())
      .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
  }

  // ==================== 工具方法 ====================

  /**
   * 获取注册中心摘要信息（用于调试/管理面板）
   */
  getSummary(): { agents: number; searchProviders: number; details: { agents: string[]; searchProviders: string[] } } {
    return {
      agents: this.agents.size,
      searchProviders: this.searchProviders.size,
      details: {
        agents: this.getAllAgents().map(a => `${a.icon || '🤖'} ${a.name} (${a.id}) v${a.version}`),
        searchProviders: this.getAllSearchProviders().map(p => `${p.name} (${p.id})`),
      }
    }
  }

  /**
   * 注销所有插件（调用所有 onDestroy 钩子）
   * 适用于应用关闭时的清理
   */
  async destroyAll(): Promise<void> {
    const agentIds = [...this.agents.keys()]
    for (const id of agentIds) {
      await this.unregisterAgent(id)
    }
    this.searchProviders.clear()
    console.log('[PluginRegistry] 🧹 所有插件已注销并清理')
  }

  /**
   * 重置注册中心（仅用于测试，不调用 onDestroy）
   * @internal
   */
  _reset(): void {
    this.agents.clear()
    this.searchProviders.clear()
    PluginRegistry.instance = null
  }
}

// ==================== 便捷函数（顶级导出，简化调用链） ====================

/** 注册一个 Agent 插件（含格式校验 + onInit 钩子） */
export async function registerAgent(agent: INovoAgent): Promise<void> {
  await PluginRegistry.getInstance().registerAgent(agent)
}

/** 根据 ID 获取已注册的 Agent */
export function getAgent(id: string): INovoAgent | undefined {
  return PluginRegistry.getInstance().getAgent(id)
}

/** 获取所有已注册的 Agent */
export function getAllAgents(): INovoAgent[] {
  return PluginRegistry.getInstance().getAllAgents()
}

/** 注册一个搜索数据源（含格式校验） */
export function registerSearchProvider(provider: ISearchProvider): void {
  PluginRegistry.getInstance().registerSearchProvider(provider)
}

/** 根据 ID 获取已注册的搜索数据源 */
export function getSearchProvider(id: string): ISearchProvider | undefined {
  return PluginRegistry.getInstance().getSearchProvider(id)
}

/** 获取所有已注册的搜索数据源 */
export function getAllSearchProviders(): ISearchProvider[] {
  return PluginRegistry.getInstance().getAllSearchProviders()
}
