/**
 * CaseVault — 采集调度器
 *
 * 统筹整个采集流水线：Harvester → Polisher → Deduplicator → Supabase
 *
 * 单次执行成本预算：
 *   - 搜索 API: 最多 2 次（Brave/SerpAPI/GitHub 三选一）
 *   - AI 调用: 最多 1 次 Gemini Flash（润色）
 *   - 总计: ≈ 3 次 API 调用
 *
 * 每月成本预算（假设每天 1 次 Cron）：
 *   - Brave: ~12 次/月（<1% 免费额度）
 *   - SerpAPI: ~8 次/月（<8% 免费额度）
 *   - Gemini: ~30 次/月（<3% 免费额度）
 *   - GitHub: 不计费
 */

import { harvestCases } from './harvester';
import { polishCases } from './polisher';
import { deduplicateAndStore } from './deduplicator';

// ==================== 调度结果 ====================

export interface CaseVaultRunResult {
    success: boolean;
    harvested: number;         // 采集到的原始案例数
    polished: number;          // 润色通过质量门槛的案例数
    stored: number;            // 成功入库（去重后）的案例数
    duplicatesSkipped: number; // 跳过的重复案例数
    source: string;            // 本次使用的采集源
    keywords: string[];        // 本次使用的关键词
    apiCallsUsed: number;      // 消耗的 API 调用次数
    errors: string[];          // 错误列表
    executionTimeMs: number;   // 执行耗时
}

// ==================== 调度入口 ====================

/**
 * 执行一轮完整的案例库更新
 *
 * 流水线: 采集 → 润色 → 去重入库
 */
export async function runCaseVaultPipeline(): Promise<CaseVaultRunResult> {
    const startTime = Date.now();
    const allErrors: string[] = [];

    console.log('[CaseVault/Scheduler] 🚀 开始案例库更新流水线...');

    // ===== Step 1: 采集 =====
    const harvestResult = await harvestCases();
    allErrors.push(...harvestResult.errors);

    if (harvestResult.cases.length === 0) {
        console.log('[CaseVault/Scheduler] 📭 无采集结果，跳过后续步骤');
        return {
            success: true,
            harvested: 0,
            polished: 0,
            stored: 0,
            duplicatesSkipped: 0,
            source: harvestResult.source,
            keywords: harvestResult.keywords,
            apiCallsUsed: harvestResult.apiCallsUsed,
            errors: allErrors,
            executionTimeMs: Date.now() - startTime,
        };
    }

    // ===== Step 2: 润色 =====
    const polishedCases = await polishCases(harvestResult.cases);

    if (polishedCases.length === 0) {
        console.log('[CaseVault/Scheduler] 📭 无案例通过质量门槛');
        return {
            success: true,
            harvested: harvestResult.cases.length,
            polished: 0,
            stored: 0,
            duplicatesSkipped: 0,
            source: harvestResult.source,
            keywords: harvestResult.keywords,
            apiCallsUsed: harvestResult.apiCallsUsed + 1, // AI 调用
            errors: allErrors,
            executionTimeMs: Date.now() - startTime,
        };
    }

    // ===== Step 3: 去重入库 =====
    const dedupResult = await deduplicateAndStore(polishedCases);
    allErrors.push(...dedupResult.errors);

    const executionTimeMs = Date.now() - startTime;

    console.log(
        `[CaseVault/Scheduler] ✅ 流水线完成 | ` +
        `采集=${harvestResult.cases.length} → 润色=${polishedCases.length} → 入库=${dedupResult.inserted.length} | ` +
        `重复跳过=${dedupResult.duplicates.length} | ` +
        `耗时=${executionTimeMs}ms`
    );

    return {
        success: allErrors.length === 0,
        harvested: harvestResult.cases.length,
        polished: polishedCases.length,
        stored: dedupResult.inserted.length,
        duplicatesSkipped: dedupResult.duplicates.length,
        source: harvestResult.source,
        keywords: harvestResult.keywords,
        apiCallsUsed: harvestResult.apiCallsUsed + 1, // +1 for AI polishing
        errors: allErrors,
        executionTimeMs,
    };
}

/**
 * 用户 Idea 入库流水线（由 Clawscan 流程异步触发）
 *
 * 成本：1 次 Gemini Flash 调用
 */
export async function ingestUserIdea(
    ideaDescription: string,
): Promise<{ success: boolean; stored: boolean; error?: string }> {
    console.log(`[CaseVault/Scheduler] 📝 用户 Idea 入库: "${ideaDescription.slice(0, 50)}..."`);

    try {
        // 构造为 HarvestedCase 格式
        const rawCase = {
            title: `[用户构想] ${ideaDescription.slice(0, 60)}`,
            url: '',
            snippet: ideaDescription,
            source_type: 'web' as const,
        };

        // 润色（标记为用户 Idea）
        const polished = await polishCases([rawCase], true);

        if (polished.length === 0) {
            return { success: true, stored: false, error: '内容未通过质量门槛' };
        }

        // 去重入库
        const dedupResult = await deduplicateAndStore(polished);

        return {
            success: true,
            stored: dedupResult.inserted.length > 0,
        };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[CaseVault/Scheduler] ❌ 用户 Idea 入库失败: ${msg}`);
        return { success: false, stored: false, error: msg };
    }
}
