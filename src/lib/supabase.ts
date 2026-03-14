import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 构建时环境变量可能缺失。使用本地回退地址 —— createClient 在创建时不会发起网络请求，
// 因此 "http://localhost:0" 在构建阶段完全安全；运行时 Vercel 会注入真实环境变量。
const FALLBACK_URL = 'http://localhost:0';
const FALLBACK_KEY = 'fallback-key-for-build-only';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] 环境变量缺失，请检查 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// 供客户端使用的匿名全量权限实例 (受 RLS 限制)
export const supabase = createClient(
    supabaseUrl || FALLBACK_URL,
    supabaseAnonKey || FALLBACK_KEY
);

// 供服务端使用的管理员权限实例 (绕过 RLS 限制，必须仅在 Server API 中使用)
export const supabaseAdmin = createClient(
    supabaseUrl || FALLBACK_URL,
    supabaseServiceKey || supabaseAnonKey || FALLBACK_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// =============== TypeScript 类型定义 ===============

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

/** 搜索日志（本地 Dexie 也会用到这个结构） */
export interface SearchLog {
    id?: number;
    query_text: string;
    model_used: string;
    novelty_score?: number;
    result_summary?: string;
    searched_at: string;
}

/** 用户画像主表 */
export interface UserProfile {
    id: string;                    // UUID, 关联 auth.users.id
    display_name?: string;
    avatar_url?: string;
    preferred_language?: string;
    preferred_model?: string;
    top_domain_id?: string;
    top_sub_domain_id?: string;
    search_count?: number;
    points?: number;               // 用户点数余额
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
    amount: number;                // 正数=收入，负数=支出
    type: 'earn' | 'spend' | 'admin' | 'redeem';
    description?: string;
    created_at?: string;
}

// =============== CaseVault 案例库类型 ===============

/** 案例库主表 */
export interface CaseLibraryEntry {
    id?: number;
    title: string;                 // 案例标题
    summary: string;               // AI 润色后的摘要
    original_content: string;      // 原始采集内容
    source_url: string | null;     // 来源 URL
    source_type: 'wechat' | 'web' | 'github' | 'clawhub' | 'user_idea';
    industry: string;              // 行业分类
    tags: string[];                // 标签数组
    capabilities: string[];        // 核心能力点
    technology_stack: string[];    // 技术栈
    deployment_scale?: string;     // 部署规模
    maturity: 'concept' | 'poc' | 'production' | 'scale';
    quality_score: number;         // AI 评分 0-100
    content_hash: string;          // 内容哈希（去重用）
    author?: string;               // 作者/来源
    publish_date?: string;         // 发布日期
    harvested_at: string;          // 采集时间
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

