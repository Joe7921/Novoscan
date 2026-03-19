/**
 * 搜索服务工厂
 *
 * 根据环境配置返回对应的检索服务实现。
 * API 路由和编排器通过此工厂获取服务，不再直接 import 具体模块。
 *
 * 使用方式：
 * ```ts
 * const services = createSearchServices();
 * const academic = await services.getAcademic().search(keywords);
 * const industry = await services.getIndustry().search(keywords);
 * ```
 *
 * @module server/factory
 */

import type {
  ISearchServiceFactory,
  IAcademicSearchService,
  IIndustrySearchService,
  AcademicSearchOptions,
  AcademicSearchResult,
  IndustrySearchResult,
} from './interfaces';
import type { EngineSelection } from '@/server/search/engine-selector';

// ==================== 学术检索默认实现 ====================

/**
 * 四源学术检索服务（OpenAlex + arXiv + CrossRef + CORE）
 *
 * 包装现有的 `searchAcademic` 函数为接口实现
 */
class QuadSourceAcademicService implements IAcademicSearchService {
  readonly name = 'QuadSourceAcademic';

  async search(keywords: string[], options?: AcademicSearchOptions): Promise<AcademicSearchResult> {
    const { searchAcademic } = await import('@/server/search/academic');
    return searchAcademic(keywords, options?.domain);
  }
}

// ==================== 产业检索默认实现 ====================

/**
 * 多源产业检索服务（Brave + SerpAPI + GitHub + 微信 + Scholar）
 *
 * 包装现有的 `searchIndustry` 函数为接口实现
 */
class MultiSourceIndustryService implements IIndustrySearchService {
  readonly name = 'MultiSourceIndustry';

  async search(keywords: string[], engineSelection?: EngineSelection): Promise<IndustrySearchResult> {
    const { searchIndustry } = await import('@/server/search/industry');
    return searchIndustry(keywords, engineSelection);
  }
}

// ==================== 工厂函数 ====================

/** 默认工厂单例缓存 */
let defaultFactory: ISearchServiceFactory | null = null;

/**
 * 创建搜索服务工厂
 *
 * 返回基于当前环境配置的检索服务实现。
 * 社区贡献者可以创建自定义工厂来替换数据源，无需修改核心逻辑。
 *
 * @returns 搜索服务工厂实例
 */
export function createSearchServices(): ISearchServiceFactory {
  if (defaultFactory) return defaultFactory;

  defaultFactory = {
    getAcademic: () => new QuadSourceAcademicService(),
    getIndustry: () => new MultiSourceIndustryService(),
  };

  return defaultFactory;
}

/**
 * 重置工厂（用于测试时注入 Mock 实现）
 */
export function resetSearchServices(): void {
  defaultFactory = null;
}

/**
 * 注入自定义工厂（用于测试或自定义数据源）
 */
export function setSearchServiceFactory(factory: ISearchServiceFactory): void {
  defaultFactory = factory;
}
