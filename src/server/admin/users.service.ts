/**
 * users.service — 用户管理服务
 *
 * 管理 feature_access 表的用户权限。
 */

import { adminDb } from '@/lib/db/factory';

/** 用户权限记录 */
export interface UserAccessEntry {
    userId: string;
    featureName: string;
    isActive: boolean;
    grantedAt: string | null;
    grantedBy: string | null;
}

export interface UserListResult {
    users: UserAccessEntry[];
    total: number;
}

/**
 * 列出有权限记录的用户
 */
export async function listUsers(limit = 100): Promise<UserListResult> {
    const { data, error } = await adminDb.from('feature_access')
        .select('user_id, feature_name, granted_at, granted_by, is_active')
        .order('granted_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`查询失败: ${error.message}`);

    const users: UserAccessEntry[] = (data || []).map(row => ({
        userId: row.user_id,
        featureName: row.feature_name,
        isActive: row.is_active,
        grantedAt: row.granted_at || null,
        grantedBy: row.granted_by || null,
    }));

    return { users, total: users.length };
}

/**
 * 授予用户 admin 权限
 */
export async function grantAdmin(userId: string): Promise<{ success: boolean; message: string }> {
    if (!userId) return { success: false, message: '请提供 user-id' };

    const { error } = await adminDb.from('feature_access').upsert({
        user_id: userId,
        feature_name: 'admin',
        is_active: true,
        granted_at: new Date().toISOString(),
        granted_by: 'admin-api',
    }, { onConflict: 'user_id,feature_name' });

    if (error) return { success: false, message: `操作失败: ${error.message}` };
    return { success: true, message: `已授予 ${userId} admin 权限` };
}

/**
 * 吊销用户 admin 权限
 */
export async function revokeAdmin(userId: string): Promise<{ success: boolean; message: string }> {
    if (!userId) return { success: false, message: '请提供 user-id' };

    const { error } = await adminDb.from('feature_access')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('feature_name', 'admin');

    if (error) return { success: false, message: `操作失败: ${error.message}` };
    return { success: true, message: `已吊销 ${userId} 的 admin 权限` };
}
