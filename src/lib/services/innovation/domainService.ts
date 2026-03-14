import { supabase, supabaseAdmin } from '@/lib/supabase';
import { matchSubDomainFromStatic, mapCategoryToDomainId } from '@/lib/constants/domains';

export interface AssignedDomain {
    domainId: string;
    subDomainId?: string;
}

/**
 * 将用户提供的类别名或 AI 提取的主题名，解析成符合规范的 domainId 和 subDomainId。
 * 会先尝试读内存静态字典(应对常见关键词如 ML、AI 等)，再查询 Supabase 库获取动态扩张词汇。
 */
export async function assignDomain(keyword: string, oldCategory?: string): Promise<AssignedDomain> {
    // 1. 尝试静态匹配 (最快，命中预置短词组如 ML、NLP)
    const staticMatch = matchSubDomainFromStatic(keyword);
    if (staticMatch) {
        return staticMatch;
    }

    // 2. 尝试数据库动态匹配 (由于 aliases 使用 GIN 索引，可高效查找)
    try {
        const normalized = keyword.toLowerCase().trim();
        const { data: dbMatch } = await supabase
            .from('sub_domains')
            .select('id, domain_id')
            .eq('is_active', true)
            .contains('aliases', [normalized])
            .limit(1)
            .maybeSingle();

        if (dbMatch) {
            return {
                domainId: dbMatch.domain_id,
                subDomainId: dbMatch.id
            };
        }
    } catch (err) {
        console.warn('[DomainService] 查询数据库同义词失败:', err);
    }

    // 3. Fallback 到旧的 category 映射机制
    // 如果没有 sub domain 匹配上，至少基于 category 给定一级大类
    if (oldCategory) {
        return {
            domainId: mapCategoryToDomainId(oldCategory),
            subDomainId: undefined
        };
    }

    // 4. 最兜底情况
    return {
        domainId: 'INTER', // 交叉学科
        subDomainId: undefined
    };
}

/**
 * 获取所有的顶级领域列表
 */
export async function getAllDomains() {
    try {
        const { data } = await supabase
            .from('domains')
            .select('*')
            .order('sort_order', { ascending: true });
        return data || [];
    } catch (error) {
        console.error('[DomainService] 获取 domains 失败', error);
        return [];
    }
}
