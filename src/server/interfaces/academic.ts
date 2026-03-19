/**
 * 学术检索服务接口
 *
 * 定义学术论文检索的标准接口，支持可插拔的数据源实现。
 * 默认实现：QuadSourceAcademicService（OpenAlex + arXiv + CrossRef + CORE）
 *
 * @module server/interfaces/academic
 */

import type { AcademicPaper } from '@/types/search';

/** 学术检索选项 */
export interface AcademicSearchOptions {
  /** 起始年份过滤（默认 2020） */
  fromYear?: number;
  /** 每源最大结果数（默认 10） */
  perPage?: number;
  /** 学科领域提示 */
  domain?: string;
}

/** 学术检索结果 */
export interface AcademicSearchResult {
  success: boolean;
  sources: {
    openAlex: number;
    crossRef: number;
    core: number;
    arxiv: number;
    [key: string]: number;  // 支持扩展数据源
  };
  total: number;
  results: AcademicPaper[];
}

/** 学术检索服务接口 */
export interface IAcademicSearchService {
  /** 服务名称（用于日志和调试） */
  readonly name: string;

  /**
   * 执行学术检索
   * @param keywords - 检索关键词列表
   * @param options - 检索选项
   * @returns 检索结果
   */
  search(keywords: string[], options?: AcademicSearchOptions): Promise<AcademicSearchResult>;
}
