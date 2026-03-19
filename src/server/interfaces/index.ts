/**
 * 服务接口统一导出
 *
 * @module server/interfaces
 */

export type {
  IAcademicSearchService,
  AcademicSearchOptions,
  AcademicSearchResult,
} from './academic';

export type {
  IIndustrySearchService,
  IndustrySearchResult,
} from './industry';

/**
 * 搜索服务工厂接口
 *
 * API 路由和编排器通过此工厂获取检索服务实例，
 * 不再直接 import 具体的检索模块。
 */
export interface ISearchServiceFactory {
  /** 获取学术检索服务 */
  getAcademic(): IAcademicSearchService;
  /** 获取产业检索服务 */
  getIndustry(): IIndustrySearchService;
}
