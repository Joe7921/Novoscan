/**
 * IDEA 行为信号收集器
 *
 * 每当用户使用 Novoscan（搜索、追问、推荐点击）时，
 * 从行为中提取 IDEA 四维信号并增量更新 user_idea_profile。
 *
 * 信号映射逻辑：
 *   搜索行为 →
 *     - 查询跨度广（跨域关键词多）→ V（远见）↑
 *     - 查询聚焦垂直领域 → O（洞察）↑
 *     - 高频搜索，快速迭代 → P（探索）↑
 *     - 低频搜索，深度追问 → B（构建）↑
 *
 *   追问行为 →
 *     - 发散式追问（选择多个方向）→ D（发散）↑
 *     - 收敛式追问（聚焦一个方向 + 详细输入）→ C（收敛）↑
 *
 *   推荐点击 →
 *     - 跨产品探索（点击不同产品推荐）→ S（连接）↑
 *     - 忽略推荐 → I（独行）↑
 */

import { supabaseAdmin } from '@/lib/supabase';

// ==================== 行为信号类型 ====================

export type BehaviorType = 'search' | 'followup' | 'recommendation_click';

export interface BehaviorSignal {
    userId: string;
    type: BehaviorType;
    // 搜索相关
    query?: string;
    domainId?: string;
    noveltyScore?: number;
    // 追问相关
    selectedQuestionsCount?: number;
    hasUserInput?: boolean;
    followupRound?: number;
    // 推荐点击
    productId?: string;
    source?: string;
}

// ==================== 四维增量系数 ====================

interface DimensionDelta {
    v: number;  // Input: 远见 vs 洞察
    d: number;  // Direction: 发散 vs 收敛
    p: number;  // Execution: 探索 vs 构建
    s: number;  // Alliance: 连接 vs 独行
}

// ==================== 信号 → 四维增量映射 ====================

function computeDelta(signal: BehaviorSignal): DimensionDelta {
    const delta: DimensionDelta = { v: 0, d: 0, p: 0, s: 0 };

    switch (signal.type) {
        case 'search': {
            // 搜索行为：反映信息摄取方式和执行风格
            const query = signal.query || '';
            const wordCount = query.split(/\s+/).filter(Boolean).length;

            // V/O 维度：长查询 + 跨域关键词 → 远见（V↑）
            // 短查询 + 聚焦 → 洞察（O, 即 V↓）
            if (wordCount >= 8 || query.includes('+') || query.includes('vs')) {
                delta.v = 3; // 跨域/对比式搜索 → V↑
            } else if (wordCount <= 3) {
                delta.v = -2; // 精确搜索 → O↑ (V↓)
            }

            // P/B 维度：每次搜索本身就是一次探索行为
            delta.p = 2; // 搜索=探索 → P↑

            // 高新颖性得分 → 用户在探索前沿 → V↑, D↑
            if (signal.noveltyScore && signal.noveltyScore > 70) {
                delta.v += 2;
                delta.d += 1;
            }

            break;
        }

        case 'followup': {
            // 追问行为：反映思维定向（发散/收敛）和执行风格
            const qCount = signal.selectedQuestionsCount || 0;

            // D/C 维度：选多个追问方向 → D↑；只选一个且附加详细输入 → C↑
            if (qCount >= 3) {
                delta.d = 4; // 多方向发散 → D↑
            } else if (qCount === 1 && signal.hasUserInput) {
                delta.d = -3; // 单方向深入 → C↑ (D↓)
            } else if (qCount <= 2) {
                delta.d = -1; // 温和收敛
            }

            // P/B 维度：多轮追问 → 构建者（B↑）倾向
            if (signal.followupRound && signal.followupRound >= 2) {
                delta.p = -2; // 反复精化 → B↑ (P↓)
            }

            break;
        }

        case 'recommendation_click': {
            // 推荐点击行为：反映协作生态倾向
            delta.s = 3; // 跨产品探索 → S↑（连接者）

            // 如果点击来源是追问面板，说明用户在主动发现连接
            if (signal.source === 'followup_panel') {
                delta.s += 1;
                delta.v += 1; // 也表现出一定的远见性
            }

            break;
        }
    }

    return delta;
}

// ==================== 核心：记录行为并增量更新画像 ====================

export async function recordBehaviorSignal(signal: BehaviorSignal): Promise<void> {
    if (!signal.userId) return;

    try {
        const delta = computeDelta(signal);

        // 如果所有增量都是0，跳过
        if (delta.v === 0 && delta.d === 0 && delta.p === 0 && delta.s === 0) return;

        // 读取当前画像
        const { data: profile, error: readError } = await supabaseAdmin
            .from('user_idea_profile')
            .select('behavioral_v, behavioral_d, behavioral_p, behavioral_s, behavior_data_points, final_v, final_d, final_p, final_s, stated_v, stated_d, stated_p, stated_s, confidence')
            .eq('user_id', signal.userId)
            .single();

        if (readError || !profile) {
            // 用户尚未做过 IDEA 对话评估，跳过
            console.log(`[IDEA Behavior] 用户 ${signal.userId.slice(0, 8)} 无 IDEA 画像，跳过行为记录`);
            return;
        }

        // 增量更新行为维度分数
        const dataPoints = (profile.behavior_data_points || 0) + 1;
        const bv = clamp(0, 100, (profile.behavioral_v || 50) + delta.v);
        const bd = clamp(0, 100, (profile.behavioral_d || 50) + delta.d);
        const bp = clamp(0, 100, (profile.behavioral_p || 50) + delta.p);
        const bs = clamp(0, 100, (profile.behavioral_s || 50) + delta.s);

        // 重新计算综合分数（加权融合：自述 × 权重 + 行为 × 权重）
        // 随行为数据点增多，行为权重递增（最高50%）
        const behaviorWeight = Math.min(0.5, dataPoints * 0.025); // 每个数据点+2.5%，20个点=50%
        const statedWeight = 1 - behaviorWeight;

        const fv = Math.round(statedWeight * (profile.stated_v || 50) + behaviorWeight * bv);
        const fd = Math.round(statedWeight * (profile.stated_d || 50) + behaviorWeight * bd);
        const fp = Math.round(statedWeight * (profile.stated_p || 50) + behaviorWeight * bp);
        const fs = Math.round(statedWeight * (profile.stated_s || 50) + behaviorWeight * bs);

        // 推导综合原型代码
        const finalArchetype = `${fv > 50 ? 'V' : 'O'}${fd > 50 ? 'D' : 'C'}${fp > 50 ? 'P' : 'B'}${fs > 50 ? 'S' : 'I'}`;

        // 原型名称映射
        const archetypeNames: Record<string, string> = {
            'VDPS': '布道师', 'VDPI': '发明家', 'VDBS': '造梦师', 'VDBI': '哲学家',
            'VCPS': '指挥官', 'VCPI': '先锋', 'VCBS': '元帅', 'VCBI': '建筑师',
            'ODPS': '炼金师', 'ODPI': '侦探', 'ODBS': '大使', 'ODBI': '猎手',
            'OCPS': '操盘手', 'OCPI': '工匠', 'OCBS': '总管', 'OCBI': '督察',
        };

        // 综合置信度
        const confidence = Math.min(0.95, 0.5 + behaviorWeight);

        // 是否解锁偏差洞察（≥20 个行为数据点）
        const divergenceUnlocked = dataPoints >= 20;

        // 更新数据库
        const { error: updateError } = await supabaseAdmin
            .from('user_idea_profile')
            .update({
                behavioral_v: bv,
                behavioral_d: bd,
                behavioral_p: bp,
                behavioral_s: bs,
                behavior_data_points: dataPoints,
                final_v: fv,
                final_d: fd,
                final_p: fp,
                final_s: fs,
                final_archetype: finalArchetype,
                final_archetype_name: archetypeNames[finalArchetype] || finalArchetype,
                confidence,
                divergence_unlocked: divergenceUnlocked,
                updated_at: new Date().toISOString(),
            })
            .eq('user_id', signal.userId);

        if (updateError) {
            console.warn('[IDEA Behavior] 更新画像失败:', updateError.message);
        } else {
            console.log(`[IDEA Behavior] 用户 ${signal.userId.slice(0, 8)} 画像更新: ${signal.type} → Δ(v=${delta.v}, d=${delta.d}, p=${delta.p}, s=${delta.s}), 数据点=${dataPoints}, 类型=${finalArchetype}`);
        }
    } catch (error: unknown) {
        // 行为收集绝不影响主流程
        console.warn('[IDEA Behavior] 行为记录异常:', (error instanceof Error ? error.message : String(error)));
    }
}

// ==================== 工具函数 ====================

function clamp(min: number, max: number, value: number): number {
    return Math.max(min, Math.min(max, value));
}
