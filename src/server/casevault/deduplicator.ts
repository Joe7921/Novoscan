/**
 * CaseVault — 案例去重器
 *
 * 双重去重策略：
 *   1. URL 精确去重 — 同一来源直接跳过
 *   2. 内容哈希去重 — SHA-256 摘要匹配
 *
 * 零 API 消耗，纯本地计算。
 */

import { adminDb } from '@/lib/db/factory';
import type { PolishedCase } from './polisher';

// ==================== 哈希工具 ====================

/**
 * 生成内容的 SHA-256 哈希值
 * 使用 Web Crypto API（Node.js 内置）
 */
async function sha256(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== 去重入口 ====================

export interface DeduplicationResult {
    inserted: PolishedCase[];       // 成功入库的案例
    duplicates: string[];           // 被跳过的重复案例标题
    errors: string[];               // 入库错误
}

/**
 * 对润色后的案例进行去重并写入 Supabase
 *
 * 去重逻辑：
 * 1. 先查询已有的 source_url & content_hash
 * 2. 跳过已存在的记录
 * 3. 新案例写入 case_library 表
 */
export async function deduplicateAndStore(
    cases: PolishedCase[],
): Promise<DeduplicationResult> {
    const inserted: PolishedCase[] = [];
    const duplicates: string[] = [];
    const errors: string[] = [];

    if (cases.length === 0) return { inserted, duplicates, errors };

    console.log(`[CaseVault/Dedup] 🔍 去重检查 ${cases.length} 条案例...`);

    // 预计算所有内容哈希
    const casesWithHash = await Promise.all(
        cases.map(async (c) => ({
            ...c,
            content_hash: await sha256(`${c.title}|${c.summary}`),
        }))
    );

    // 批量查询已存在的 URL 和 hash
    const urls = casesWithHash.map(c => c.source_url).filter(u => u.length > 0);
    const hashes = casesWithHash.map(c => c.content_hash);

    let existingUrls = new Set<string>();
    let existingHashes = new Set<string>();

    try {
        if (urls.length > 0) {
            const { data: urlMatches } = await adminDb
                .from('case_library')
                .select('source_url')
                .in('source_url', urls);
            existingUrls = new Set((urlMatches || []).map((r: { source_url: string }) => r.source_url));
        }

        const { data: hashMatches } = await adminDb
            .from('case_library')
            .select('content_hash')
            .in('content_hash', hashes);
        existingHashes = new Set((hashMatches || []).map((r: { content_hash: string }) => r.content_hash));
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[CaseVault/Dedup] ⚠️ 查重查询失败: ${msg}`);
        // 查重失败时保守处理：仍然继续尝试插入（依赖 DB 的 unique constraint）
    }

    // 逐条检查并插入
    for (const caseItem of casesWithHash) {
        // URL 去重
        if (caseItem.source_url && existingUrls.has(caseItem.source_url)) {
            duplicates.push(caseItem.title);
            continue;
        }

        // 内容哈希去重
        if (existingHashes.has(caseItem.content_hash)) {
            duplicates.push(caseItem.title);
            continue;
        }

        // 写入 Supabase
        try {
            const { error } = await adminDb
                .from('case_library')
                .insert({
                    title: caseItem.title,
                    summary: caseItem.summary,
                    original_content: caseItem.original_content,
                    source_url: caseItem.source_url || null,
                    source_type: caseItem.source_type,
                    industry: caseItem.industry,
                    tags: caseItem.tags,
                    capabilities: caseItem.capabilities,
                    technology_stack: caseItem.technology_stack,
                    deployment_scale: caseItem.deployment_scale || null,
                    maturity: caseItem.maturity,
                    quality_score: caseItem.quality_score,
                    content_hash: caseItem.content_hash,
                    author: caseItem.author || null,
                    publish_date: caseItem.publish_date || null,
                    harvested_at: new Date().toISOString(),
                });

            if (error) {
                // 唯一约束冲突 = 重复，忽略
                if (error.code === '23505') {
                    duplicates.push(caseItem.title);
                } else {
                    errors.push(`${caseItem.title}: ${error.message}`);
                }
            } else {
                inserted.push(caseItem);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${caseItem.title}: ${msg}`);
        }
    }

    console.log(
        `[CaseVault/Dedup] 📊 结果: ${inserted.length} 入库, ${duplicates.length} 重复跳过, ${errors.length} 错误`
    );

    return { inserted, duplicates, errors };
}
