/**
 * 插件市场数据服务层
 *
 * 负责与 Registry API 交互、本地缓存和降级处理。
 * - fetchPlugins(params)：分页获取插件列表，带 60s SWR 缓存
 * - fetchPluginDetail(id)：获取单个插件详情
 * - getLocalFallbackPlugins()：API 不可达时返回本地内置插件
 * - formatInstalls(n)：安装量格式化（如 1.2k）
 */

import type {
  MarketplacePlugin,
  MarketplaceListResponse,
  PluginCategory,
  PluginVerificationStatus,
} from '@/plugins/marketplace-types'

// ==================== 常量 ====================

/** Registry API 基地址 */
const API_BASE =
  process.env.NEXT_PUBLIC_MARKETPLACE_API || 'https://novoscan.cn'

/** 缓存过期时间（毫秒） */
const CACHE_TTL = 60_000

// ==================== 简易 SWR 缓存 ====================

interface CacheEntry<T> {
  data: T
  timestamp: number
}

/** 内存缓存池 */
const cache = new Map<string, CacheEntry<unknown>>()

/** 检查缓存是否有效 */
function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

/** 写入缓存 */
function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() })
}

// ==================== 请求参数类型 ====================

export interface FetchPluginsParams {
  /** 搜索关键词 */
  search?: string
  /** 分类筛选 */
  category?: PluginCategory | 'all'
  /** 排序方式 */
  sort?: 'popular' | 'newest' | 'rating'
  /** 页码（从 1 开始） */
  page?: number
  /** 每页数量 */
  pageSize?: number
}

// ==================== 本地降级数据 ====================

/** 内置 3 个本地插件（API 不可达时使用） */
export function getLocalFallbackPlugins(): MarketplacePlugin[] {
  return [
    {
      id: 'patent-scout',
      name: '专利侦察兵',
      nameEn: 'Patent Scout',
      description: '搜索全球专利数据库，评估创新点与已有专利的重叠度',
      version: '1.0.0',
      author: 'Novoscan Team',
      category: 'specialized',
      icon: '📜',
      tags: ['专利', '知识产权', 'FTO', 'patent', 'IP'],
      license: 'MIT',
      repository: 'https://github.com/Joe7921/Novoscan',
      entryPoint: 'index.ts',
      permissions: ['network'],
      pricing: 'free',
      installs: 2400,
      rating: 4.6,
      ratingCount: 38,
      lastUpdated: '2026-03-10T08:00:00Z',
      verification: 'featured' as PluginVerificationStatus,
    },
    {
      id: 'github-trends',
      name: 'GitHub 趋势分析师',
      nameEn: 'GitHub Trends Analyst',
      description: '分析 GitHub 开源生态中的技术趋势和竞争态势',
      version: '1.0.0',
      author: 'Novoscan Team',
      category: 'industry',
      icon: '📈',
      tags: ['GitHub', '开源', '趋势', 'trends'],
      license: 'MIT',
      repository: 'https://github.com/Joe7921/Novoscan',
      entryPoint: 'index.ts',
      permissions: ['network'],
      pricing: 'free',
      installs: 3500,
      rating: 4.8,
      ratingCount: 52,
      lastUpdated: '2026-03-12T10:30:00Z',
      verification: 'featured' as PluginVerificationStatus,
    },
    {
      id: 'arxiv-scanner',
      name: 'arXiv 论文扫描仪',
      nameEn: 'arXiv Scanner',
      description: '扫描 arXiv 前沿论文，评估学术领域热度和创新空间',
      version: '1.0.0',
      author: 'Novoscan Team',
      category: 'academic',
      icon: '🔬',
      tags: ['arXiv', '论文', '学术', 'papers'],
      license: 'MIT',
      repository: 'https://github.com/Joe7921/Novoscan',
      entryPoint: 'index.ts',
      permissions: ['network'],
      pricing: 'free',
      installs: 1800,
      rating: 4.5,
      ratingCount: 27,
      lastUpdated: '2026-03-08T14:00:00Z',
      verification: 'verified' as PluginVerificationStatus,
    },
  ]
}

// ==================== API 调用 ====================

/**
 * 获取插件列表（带缓存和降级）
 */
export async function fetchPlugins(
  params: FetchPluginsParams = {}
): Promise<MarketplaceListResponse> {
  const {
    search = '',
    category = 'all',
    sort = 'popular',
    page = 1,
    pageSize = 12,
  } = params

  // 构建缓存键
  const cacheKey = `plugins:${search}:${category}:${sort}:${page}:${pageSize}`
  const cached = getCached<MarketplaceListResponse>(cacheKey)
  if (cached) return cached

  try {
    const url = new URL(`${API_BASE}/api/marketplace/plugins`)
    if (search) url.searchParams.set('search', search)
    if (category !== 'all') url.searchParams.set('category', category)
    url.searchParams.set('sort', sort)
    url.searchParams.set('page', String(page))
    url.searchParams.set('pageSize', String(pageSize))

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data: MarketplaceListResponse = await res.json()
    setCache(cacheKey, data)
    return data
  } catch {
    // API 不可达 → 使用本地降级数据
    const fallback = getLocalFallbackPlugins()
    let filtered = fallback

    // 本地搜索
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      )
    }

    // 本地分类筛选
    if (category !== 'all') {
      filtered = filtered.filter((p) => p.category === category)
    }

    // 本地排序
    if (sort === 'popular') filtered.sort((a, b) => b.installs - a.installs)
    else if (sort === 'newest')
      filtered.sort(
        (a, b) =>
          new Date(b.lastUpdated).getTime() -
          new Date(a.lastUpdated).getTime()
      )
    else if (sort === 'rating') filtered.sort((a, b) => b.rating - a.rating)

    // 本地分页
    const start = (page - 1) * pageSize
    const paged = filtered.slice(start, start + pageSize)

    return {
      plugins: paged,
      total: filtered.length,
      page,
      pageSize,
      hasMore: start + pageSize < filtered.length,
    }
  }
}

/**
 * 获取单个插件详情
 */
export async function fetchPluginDetail(
  id: string
): Promise<MarketplacePlugin | null> {
  const cacheKey = `plugin:${id}`
  const cached = getCached<MarketplacePlugin>(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(`${API_BASE}/api/marketplace/plugins/${id}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data: MarketplacePlugin = await res.json()
    setCache(cacheKey, data)
    return data
  } catch {
    // 本地降级查找
    const fallback = getLocalFallbackPlugins()
    return fallback.find((p) => p.id === id) || null
  }
}

// ==================== 工具函数 ====================

/**
 * 格式化安装量（如 1200 → '1.2k'）
 */
export function formatInstalls(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
