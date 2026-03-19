/**
 * 产业检索服务接口
 *
 * 定义产业/市场检索的标准接口，支持可插拔的数据源实现。
 * 默认实现：MultiSourceIndustryService（Brave + SerpAPI + GitHub + 微信 + Scholar）
 *
 * @module server/interfaces/industry
 */

import type { EngineSelection } from '@/server/search/engine-selector';

/** 产业检索结果 */
export interface IndustrySearchResult {
  success: boolean;
  sources: {
    brave: number;
    serpapi: number;
    serpEngines?: Record<string, number>;
    github: number;
    wechat: number;
    scholar: number;
    [key: string]: number | Record<string, number> | undefined;
  };
  webResults: Array<{
    title: string;
    url: string;
    snippet?: string;
    description?: string;
  }>;
  githubRepos: Array<{
    name: string;
    stars?: number;
    health?: string;
    language?: string;
    topics?: string[];
    description?: string;
  }>;
  wechatArticles: Array<{
    title: string;
    url?: string;
    source?: string;
    date?: string;
    snippet?: string;
  }>;
  scholarResults: unknown[];
  sentiment: 'hot' | 'warm' | 'cold';
  hasOpenSource: boolean;
}

/** 产业检索服务接口 */
export interface IIndustrySearchService {
  /** 服务名称 */
  readonly name: string;

  /**
   * 执行产业检索
   * @param keywords - 检索关键词列表
   * @param engineSelection - 搜索引擎选择
   * @returns 检索结果
   */
  search(keywords: string[], engineSelection?: EngineSelection): Promise<IndustrySearchResult>;
}
