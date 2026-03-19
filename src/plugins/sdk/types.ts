/**
 * Novoscan 插件 SDK — 核心类型定义
 *
 * 本文件定义了插件化框架的核心接口：
 * - INovoAgent：自定义 Agent 插件接口（含生命周期钩子）
 * - ISearchProvider：自定义数据源接口
 * - SearchResult：搜索结果统一结构
 * - defineAgent / defineSearchProvider：辅助定义函数
 * - validateAgent / validateSearchProvider：运行时格式校验
 * - PluginValidationError：校验失败错误类
 */

import type { AgentInput, AgentOutput } from '@/agents/types'
import type { PluginManifest } from './manifest-schema'

// ==================== 自定义 Agent 插件接口 ====================

/**
 * INovoAgent — 自定义 Agent 插件接口
 *
 * 所有社区 Agent 都必须实现此接口。
 * 核心方法 `analyze()` 接收标准 `AgentInput`，返回标准 `AgentOutput`，
 * 确保与现有编排器的输出格式完全兼容。
 *
 * @example
 * ```typescript
 * import { defineAgent } from '@/plugins/sdk/types'
 *
 * export default defineAgent({
 *   id: 'my-agent',
 *   name: '我的 Agent',
 *   nameEn: 'My Agent',
 *   description: '一句话描述',
 *   version: '1.0.0',
 *   category: 'community',
 *   icon: '🤖',
 *   async analyze(input) {
 *     // 你的分析逻辑
 *     return { agentName: '我的 Agent', ... }
 *   }
 * })
 * ```
 */
export interface INovoAgent {
  /** 唯一标识，使用 kebab-case，如 'patent-scout' */
  id: string
  /** 显示名（中文），如 '专利侦察兵' */
  name: string
  /** 英文名，如 'Patent Scout' */
  nameEn: string
  /** 一句话描述（中文） */
  description: string
  /** 语义化版本号，如 '1.0.0' */
  version: string
  /** 作者（可选） */
  author?: string
  /** 插件分类 */
  category: 'academic' | 'industry' | 'specialized' | 'community'
  /** emoji 图标（可选），如 '🔍' */
  icon?: string
  /**
   * 核心分析方法
   *
   * 接收标准 AgentInput（包含用户创意、学术数据、产业数据等），
   * 返回标准 AgentOutput（包含评分、分析文本、关键发现等）。
   *
   * @param input - 标准化的 Agent 输入
   * @returns 标准化的 Agent 输出
   */
  analyze(input: AgentInput): Promise<AgentOutput>

  // ---- 生命周期钩子（可选） ----

  /**
   * 初始化钩子 — 在插件注册时自动调用
   *
   * 适用于：建立数据库连接、初始化 API 客户端、加载配置等。
   * 如果 onInit 抛出异常，注册将被中止并抛出 PluginValidationError。
   */
  onInit?(): Promise<void> | void

  /**
   * 销毁钩子 — 在插件注销时自动调用
   *
   * 适用于：关闭数据库连接、释放资源、清理缓存等。
   * 即使 onDestroy 抛出异常，注销操作仍会完成（异常仅打印警告）。
   */
  onDestroy?(): Promise<void> | void

  /**
   * 插件市场元数据清单（可选）
   *
   * 关联该 Agent 的市场 manifest 信息，用于插件市场展示。
   * 通常由插件目录下的 plugin-manifest.json 自动填充。
   */
  manifest?: PluginManifest
}

// ==================== 自定义数据源接口 ====================

/**
 * 搜索结果统一结构
 *
 * 所有 ISearchProvider 的 search() 方法都应返回此结构的数组，
 * 保证下游消费者可以统一处理不同数据源的结果。
 */
export interface SearchResult {
  /** 结果标题 */
  title: string
  /** 结果链接（可选） */
  url?: string
  /** 摘要/片段（可选） */
  snippet?: string
  /** 数据来源标识，如 'google-patents' */
  source: string
  /** 自定义扩展元数据（可选） */
  metadata?: Record<string, unknown>
}

/**
 * ISearchProvider — 自定义数据源接口
 *
 * 允许社区贡献自定义搜索数据源（如专利库、行业数据库等）。
 * 插件通过 `registerSearchProvider()` 注册后，可被 Agent 按需调用。
 *
 * @example
 * ```typescript
 * import { defineSearchProvider } from '@/plugins/sdk/types'
 *
 * export default defineSearchProvider({
 *   id: 'google-patents',
 *   name: 'Google Patents',
 *   priority: 50,
 *   async search(queries, domain) {
 *     // 你的搜索逻辑
 *     return [{ title: '...', url: '...', snippet: '...', source: 'google-patents' }]
 *   }
 * })
 * ```
 */
export interface ISearchProvider {
  /** 唯一标识，使用 kebab-case，如 'google-patents' */
  id: string
  /** 显示名，如 'Google Patents' */
  name: string
  /** 优先级（越小越优先，默认 100） */
  priority?: number
  /**
   * 核心搜索方法
   *
   * @param queries - 搜索关键词数组
   * @param domain - 可选的领域限制
   * @returns 统一结构的搜索结果数组
   */
  search(queries: string[], domain?: string): Promise<SearchResult[]>
}

// ==================== 辅助定义函数 ====================

/**
 * 辅助定义函数 — 创建 Agent 插件
 *
 * 提供完整的类型推断和 IDE 自动补全支持，
 * 是创建 Agent 插件的推荐方式。
 *
 * @param config - Agent 配置对象
 * @returns 原样返回传入的配置（类型安全）
 */
export function defineAgent(config: INovoAgent): INovoAgent {
  return config
}

/**
 * 辅助定义函数 — 创建搜索数据源插件
 *
 * @param config - 搜索数据源配置对象
 * @returns 原样返回传入的配置（类型安全）
 */
export function defineSearchProvider(config: ISearchProvider): ISearchProvider {
  return config
}

// ==================== 运行时格式校验 ====================

/** Agent 插件分类的合法值集合 */
const VALID_CATEGORIES = new Set(['academic', 'industry', 'specialized', 'community'])

/** kebab-case 正则：仅允许小写字母、数字和连字符 */
const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/** 语义化版本号正则（简化版，支持 major.minor.patch[-prerelease]） */
const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/

/**
 * 插件校验失败错误
 *
 * 在 registerAgent / registerSearchProvider 注册时，
 * 如果插件格式不合法，会抛出此错误并附带详细的校验问题列表。
 */
export class PluginValidationError extends Error {
  /** 校验失败的具体问题列表 */
  public readonly issues: string[]
  /** 引发错误的插件 ID（如果能提取到） */
  public readonly pluginId: string | undefined

  constructor(pluginId: string | undefined, issues: string[]) {
    super(
      `[PluginValidation] 插件 "${pluginId ?? '(unknown)'}" 格式校验失败:\n` +
      issues.map((issue, i) => `  ${i + 1}. ${issue}`).join('\n')
    )
    this.name = 'PluginValidationError'
    this.pluginId = pluginId
    this.issues = issues
  }
}

/**
 * 运行时严格校验 Agent 插件格式
 *
 * 校验规则：
 * - id 必须为非空 kebab-case 字符串
 * - name / nameEn / description 必须为非空字符串
 * - version 必须符合语义化版本号（semver）
 * - category 必须为合法枚举值
 * - analyze 必须为函数
 * - onInit / onDestroy 如果存在，必须为函数
 *
 * @param agent - 待校验的 Agent 对象
 * @throws {PluginValidationError} 校验失败时抛出
 */
export function validateAgent(agent: unknown): asserts agent is INovoAgent {
  const issues: string[] = []
  const obj = agent as Record<string, unknown>

  // 基本类型检查
  if (!agent || typeof agent !== 'object') {
    throw new PluginValidationError(undefined, ['Agent 必须是一个非 null 对象'])
  }

  // id: 必须为 kebab-case
  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    issues.push('id 必须为非空字符串')
  } else if (!KEBAB_CASE_RE.test(obj.id)) {
    issues.push(`id "${obj.id}" 必须为 kebab-case 格式（如 'patent-scout'，仅允许小写字母/数字/连字符）`)
  }

  // name: 非空字符串
  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    issues.push('name（显示名）必须为非空字符串')
  }

  // nameEn: 非空字符串
  if (typeof obj.nameEn !== 'string' || !obj.nameEn.trim()) {
    issues.push('nameEn（英文名）必须为非空字符串')
  }

  // description: 非空字符串
  if (typeof obj.description !== 'string' || !obj.description.trim()) {
    issues.push('description（描述）必须为非空字符串')
  }

  // version: 语义化版本号
  if (typeof obj.version !== 'string' || !obj.version.trim()) {
    issues.push('version 必须为非空字符串')
  } else if (!SEMVER_RE.test(obj.version)) {
    issues.push(`version "${obj.version}" 不符合语义化版本号格式（如 '1.0.0' 或 '2.1.0-beta.1'）`)
  }

  // category: 合法枚举值
  if (typeof obj.category !== 'string' || !VALID_CATEGORIES.has(obj.category)) {
    issues.push(`category 必须为以下之一: ${[...VALID_CATEGORIES].join(' | ')}，实际值: "${String(obj.category)}"`)
  }

  // analyze: 必须为函数
  if (typeof obj.analyze !== 'function') {
    issues.push('analyze 必须为函数（async function 或返回 Promise 的函数）')
  }

  // onInit: 如果存在，必须为函数
  if (obj.onInit !== undefined && typeof obj.onInit !== 'function') {
    issues.push('onInit 如果提供，必须为函数')
  }

  // onDestroy: 如果存在，必须为函数
  if (obj.onDestroy !== undefined && typeof obj.onDestroy !== 'function') {
    issues.push('onDestroy 如果提供，必须为函数')
  }

  // icon: 如果存在，必须为字符串
  if (obj.icon !== undefined && typeof obj.icon !== 'string') {
    issues.push('icon 如果提供，必须为字符串（emoji）')
  }

  // author: 如果存在，必须为字符串
  if (obj.author !== undefined && typeof obj.author !== 'string') {
    issues.push('author 如果提供，必须为字符串')
  }

  if (issues.length > 0) {
    throw new PluginValidationError(
      typeof obj.id === 'string' ? obj.id : undefined,
      issues
    )
  }
}

/**
 * 运行时严格校验 SearchProvider 格式
 *
 * @param provider - 待校验的 SearchProvider 对象
 * @throws {PluginValidationError} 校验失败时抛出
 */
export function validateSearchProvider(provider: unknown): asserts provider is ISearchProvider {
  const issues: string[] = []
  const obj = provider as Record<string, unknown>

  if (!provider || typeof provider !== 'object') {
    throw new PluginValidationError(undefined, ['SearchProvider 必须是一个非 null 对象'])
  }

  // id: 必须为 kebab-case
  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    issues.push('id 必须为非空字符串')
  } else if (!KEBAB_CASE_RE.test(obj.id)) {
    issues.push(`id "${obj.id}" 必须为 kebab-case 格式`)
  }

  // name: 非空字符串
  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    issues.push('name 必须为非空字符串')
  }

  // priority: 如果存在，必须为非负数
  if (obj.priority !== undefined) {
    if (typeof obj.priority !== 'number' || obj.priority < 0 || !Number.isFinite(obj.priority)) {
      issues.push('priority 如果提供，必须为非负有限数字')
    }
  }

  // search: 必须为函数
  if (typeof obj.search !== 'function') {
    issues.push('search 必须为函数')
  }

  if (issues.length > 0) {
    throw new PluginValidationError(
      typeof obj.id === 'string' ? obj.id : undefined,
      issues
    )
  }
}
