/**
 * Novoscan 插件市场 — 共享协议层类型定义
 *
 * 本文件定义插件市场生态所需的全部类型：
 * - PluginManifest：插件元数据清单（每个插件必须提供的 plugin-manifest.json 结构）
 * - MarketplacePlugin：市场展示用的完整插件信息（包含统计和审核状态）
 * - MarketplaceListResponse：分页列表响应结构
 * - MarketplaceCategory：分类统计信息
 * - PluginInstallGuide：安装指引（开源 / 云端两种模式）
 */

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

// ==================== 市场展示结构 ====================

/**
 * 插件审核/验证状态
 */
export type PluginVerificationStatus =
  | 'unverified'   // 未审核
  | 'verified'     // 已通过官方审核
  | 'featured'     // 已通过审核且被推荐

/**
 * MarketplacePlugin — 市场中展示的完整插件信息
 *
 * 在 PluginManifest 基础上扩展了统计数据和审核状态，
 * 用于插件市场列表页和详情页的渲染。
 */
export interface MarketplacePlugin extends PluginManifest {
  /** 安装/使用次数 */
  installs: number
  /** 平均评分（0-5） */
  rating: number
  /** 评分人数 */
  ratingCount: number
  /** 最后更新时间（ISO 8601 格式） */
  lastUpdated: string
  /** 审核/验证状态 */
  verification: PluginVerificationStatus
}

// ==================== 分页列表响应 ====================

/**
 * MarketplaceListResponse — 插件市场分页列表响应
 *
 * 用于市场 API 的标准化分页响应结构。
 */
export interface MarketplaceListResponse {
  /** 当前页的插件列表 */
  plugins: MarketplacePlugin[]
  /** 符合筛选条件的总数 */
  total: number
  /** 当前页码（从 1 开始） */
  page: number
  /** 每页数量 */
  pageSize: number
  /** 是否还有更多数据 */
  hasMore: boolean
}

// ==================== 分类统计 ====================

/**
 * MarketplaceCategory — 市场分类统计信息
 *
 * 用于市场侧边栏或筛选器中展示各分类的插件数量。
 */
export interface MarketplaceCategory {
  /** 分类标识 */
  id: PluginCategory
  /** 分类名称（中文） */
  name: string
  /** 分类名称（英文） */
  nameEn: string
  /** 分类图标（emoji） */
  icon: string
  /** 该分类下的插件数量 */
  count: number
}

// ==================== 安装指引 ====================

/**
 * 开源自部署安装步骤
 */
export interface OpenSourceInstallGuide {
  /** 安装步骤列表（有序） */
  steps: string[]
  /** 源代码仓库地址 */
  repositoryUrl: string
}

/**
 * 云端一键安装信息
 */
export interface CloudInstallGuide {
  /** 一键安装 URL */
  oneClickUrl: string
  /** 预计安装耗时（如 '< 1 分钟'） */
  estimatedTime: string
}

/**
 * PluginInstallGuide — 插件安装指引
 *
 * 同时支持开源自部署和云端一键安装两种模式。
 * 市场 UI 根据当前部署环境自动选择合适的安装指引。
 */
export interface PluginInstallGuide {
  /** 插件 ID */
  pluginId: string
  /** 开源自部署安装指引（可选） */
  openSource?: OpenSourceInstallGuide
  /** 云端一键安装指引（可选） */
  cloud?: CloudInstallGuide
}
