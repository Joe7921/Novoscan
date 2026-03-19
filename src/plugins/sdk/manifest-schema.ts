/**
 * Novoscan 插件 SDK — Manifest 模式定义
 *
 * 定义插件元数据清单（PluginManifest）的结构和相关类型。
 * 每个插件必须提供 `plugin-manifest.json` 文件，其结构须符合本模式。
 */

// ==================== SDK 版本常量 ====================

/** Novoscan 插件 SDK 版本号 */
export const NOVOSCAN_PLUGIN_SDK_VERSION = '1.0.0'

// ==================== 插件元数据清单 ====================

/**
 * 插件权限声明
 *
 * 插件在运行时可能需要的系统权限列表。
 * 市场在展示和安装时会向用户明示这些权限需求。
 */
export type PluginPermission =
  | 'network'        // 网络请求（调用外部 API）
  | 'database'       // 数据库读写
  | 'file-system'    // 文件系统访问
  | 'env-vars'       // 读取环境变量
  | 'user-data'      // 访问用户数据

/**
 * 插件定价模式
 */
export type PluginPricing = 'free' | 'paid' | 'freemium'

/**
 * 插件分类（与 INovoAgent.category 保持一致并扩展）
 */
export type PluginCategory = 'academic' | 'industry' | 'specialized' | 'community'

/**
 * PluginManifest — 插件元数据清单
 *
 * 对应每个插件目录下的 `plugin-manifest.json` 文件。
 * 包含插件在市场展示时所需的全部静态信息。
 *
 * @example
 * ```json
 * {
 *   "id": "patent-scout",
 *   "name": "专利侦察兵",
 *   "nameEn": "Patent Scout",
 *   "version": "1.0.0",
 *   "category": "specialized",
 *   "pricing": "free"
 * }
 * ```
 */
export interface PluginManifest {
  /** 唯一标识，kebab-case 格式，如 'patent-scout' */
  id: string
  /** 插件名称（中文） */
  name: string
  /** 插件名称（英文） */
  nameEn: string
  /** 一句话描述（中文） */
  description: string
  /** 语义化版本号，如 '1.0.0' */
  version: string
  /** 作者名称 */
  author: string
  /** 插件分类 */
  category: PluginCategory
  /** emoji 图标，如 '📜' */
  icon: string
  /** 标签列表，用于搜索和筛选 */
  tags: string[]
  /** 开源许可证，如 'MIT'、'Apache-2.0' */
  license: string
  /** 源代码仓库地址（可选） */
  repository?: string
  /** 最低兼容 Novoscan 版本号（可选） */
  minNovoscanVersion?: string
  /** 入口文件相对路径，默认 'index.ts' */
  entryPoint: string
  /** 插件所需权限列表 */
  permissions: PluginPermission[]
  /** 截图/演示图片 URL 列表（可选） */
  screenshots?: string[]
  /** 定价模式 */
  pricing: PluginPricing
}
