/**
 * 数据库类型定义
 *
 * 定义项目中使用的所有数据表的 TypeScript 类型。
 * 这些类型与具体的数据库后端无关，适用于所有 IDatabase 适配器。
 *
 * ⚠️ 本文件仅包含类型定义，不包含任何数据库客户端实例。
 * 数据库访问请通过 '@/lib/db/factory' 的 db / adminDb 单例。
 */

// =============== 创新点知识库 ===============

/** 创新点知识库 - 主表 */
export interface Innovation {
    id?: number;
    keyword: string;
    category: string;
    novelty_score: number;
    search_count?: number;
    source_type?: string;
    related_fields?: string[];
    domain_id?: string;
    sub_domain_id?: string;
    created_at?: string;
    updated_at?: string;
}

/** 创新点关联关系 */
export interface InnovationRelation {
    id?: number;
    source_id: number;
    target_id: number;
    relation_type: string;
    strength?: number;
    created_at?: string;
}

/** 每日热词趋势 */
export interface DailyTrend {
    id?: number;
    keyword: string;
    category: string;
    search_count: number;
    avg_novelty_score: number;
    trend_date: string;
    created_at?: string;
}

// =============== 搜索 ===============

/** 搜索缓存（云端） */
export interface SearchCache {
    id?: number;
    query_hash: string;
    query: string;
    result_json: Record<string, any>;
    novelty_score?: number;
    use_count?: number;
    expires_at: string;
    created_at?: string;
}

/** 搜索日志 */
export interface SearchLog {
    id?: number;
    query_text: string;
    model_used: string;
    novelty_score?: number;
    result_summary?: string;
    searched_at: string;
}

// =============== 用户 ===============

/** 用户画像主表 */
export interface UserProfile {
    id: string;
    display_name?: string;
    avatar_url?: string;
    preferred_language?: string;
    preferred_model?: string;
    top_domain_id?: string;
    top_sub_domain_id?: string;
    search_count?: number;
    points?: number;
    last_search_at?: string;
    created_at?: string;
    updated_at?: string;
}

/** 用户学科兴趣权重 */
export interface UserDomainInterest {
    id?: number;
    user_id: string;
    domain_id: string;
    sub_domain_id?: string;
    weight: number;
    last_hit_at?: string;
    created_at?: string;
}

/** 用户搜索事件 */
export interface UserSearchEvent {
    id?: number;
    user_id?: string;
    anonymous_id?: string;
    query: string;
    domain_id?: string;
    sub_domain_id?: string;
    model_used?: string;
    novelty_score?: number;
    practical_score?: number;
    searched_at?: string;
}

/** 点数交易流水 */
export interface PointTransaction {
    id?: number;
    user_id: string;
    amount: number;
    type: 'earn' | 'spend' | 'admin' | 'redeem';
    description?: string;
    created_at?: string;
}

// =============== CaseVault 案例库 ===============

/** 案例库主表 */
export interface CaseLibraryEntry {
    id?: number;
    title: string;
    summary: string;
    original_content: string;
    source_url: string | null;
    source_type: 'wechat' | 'web' | 'github' | 'clawhub' | 'user_idea';
    industry: string;
    tags: string[];
    capabilities: string[];
    technology_stack: string[];
    deployment_scale?: string;
    maturity: 'concept' | 'poc' | 'production' | 'scale';
    quality_score: number;
    content_hash: string;
    author?: string;
    publish_date?: string;
    harvested_at: string;
    created_at?: string;
    updated_at?: string;
}

/** 行业应用图谱节点 */
export interface IndustryGraphNode {
    id?: number;
    node_type: 'industry' | 'capability' | 'technology' | 'case';
    label: string;
    parent_id?: number;
    case_count: number;
    metadata?: Record<string, unknown>;
    created_at?: string;
}
