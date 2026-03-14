// ==================== 通用数据源接口 ====================
// 所有数据源（学术 / 产业）均实现此接口族，支持即插即用

/** 通用搜索选项 */
export interface SearchOptions {
  /** 返回结果数量上限 */
  limit?: number;
  /** 语言 / 区域偏好 */
  lang?: string;
  /** 超时（ms） */
  timeoutMs?: number;
}

// ==================== 学术数据源 ====================

/** 学术搜索结果（论文） */
export interface AcademicResult {
  id: string;
  title: string;
  authors: string[];
  year: number | string;
  abstract?: string;
  url?: string;
  pdfUrl?: string;
  citationCount?: number;
  venue?: string;
  doi?: string;
  source: string;    // 来源数据源 ID
}

/** 学术数据源适配器接口 */
export interface AcademicDataSource {
  /** 唯一标识符 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 此数据源需要的环境变量列表（为空 = 无需密钥） */
  requiredEnvVars: string[];
  /** 检测是否可用（env 已配置） */
  isAvailable(): boolean;
  /** 搜索论文 */
  searchPapers(query: string, opts?: SearchOptions): Promise<AcademicResult[]>;
}

// ==================== 产业数据源 ====================

/** 产业搜索结果 */
export interface IndustryResult {
  title: string;
  url: string;
  snippet: string;
  source: string;    // 来源数据源 ID
  type?: 'web' | 'news' | 'github' | 'patent' | 'social' | 'other';
  date?: string;
  /** 额外元数据（各数据源自行扩展） */
  metadata?: Record<string, unknown>;
}

/** 产业数据源适配器接口 */
export interface IndustryDataSource {
  id: string;
  name: string;
  requiredEnvVars: string[];
  isAvailable(): boolean;
  search(query: string, opts?: SearchOptions): Promise<IndustryResult[]>;
}

// ==================== 存储适配器 ====================

/** 搜索历史条目 */
export interface SearchHistoryItem {
  id?: string;
  query: string;
  mode: string;
  timestamp: string;
  resultSummary?: string;
}

/** 存储适配器接口（Supabase / 本地文件 均实现此接口） */
export interface StorageAdapter {
  /** 保存搜索历史 */
  saveHistory(userId: string, data: SearchHistoryItem): Promise<void>;
  /** 获取搜索历史 */
  getHistory(userId: string, limit?: number): Promise<SearchHistoryItem[]>;
  /** 删除搜索历史 */
  deleteHistory(userId: string, id: string): Promise<void>;
}
