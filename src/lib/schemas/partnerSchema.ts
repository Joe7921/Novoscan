/**
 * 合作伙伴申请表单 — Zod 验证 Schema
 *
 * 前后端共用，确保数据一致性。
 */

import { z } from 'zod';

/** 合作类型枚举 */
export const COOPERATION_TYPES = [
    'technology',   // 技术合作
    'channel',      // 渠道代理
    'api',          // API 集成
    'academic',     // 学术合作
    'other',        // 其他
] as const;

export type CooperationType = typeof COOPERATION_TYPES[number];

/** 合作类型标签（中英文） */
export const COOPERATION_LABELS: Record<CooperationType, { zh: string; en: string }> = {
    technology: { zh: '技术合作', en: 'Technology Partnership' },
    channel:    { zh: '渠道代理', en: 'Channel Partnership' },
    api:        { zh: 'API 集成', en: 'API Integration' },
    academic:   { zh: '学术合作', en: 'Academic Collaboration' },
    other:      { zh: '其他', en: 'Other' },
};

/** 表单验证 Schema */
export const partnerFormSchema = z.object({
    company_name: z
        .string()
        .min(2, '公司名称至少 2 个字符')
        .max(100, '公司名称不得超过 100 个字符'),
    contact_name: z
        .string()
        .min(2, '联系人姓名至少 2 个字符')
        .max(50, '联系人姓名不得超过 50 个字符'),
    email: z
        .string()
        .email('请输入有效的邮箱地址'),
    cooperation_type: z
        .enum(COOPERATION_TYPES, { errorMap: () => ({ message: '请选择合作类型' }) }),
    message: z
        .string()
        .max(500, '合作描述不得超过 500 个字符')
        .optional()
        .or(z.literal('')),
});

export type PartnerFormData = z.infer<typeof partnerFormSchema>;
