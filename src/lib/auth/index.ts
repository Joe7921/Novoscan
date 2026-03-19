/**
 * Auth 抽象层统一导出模块
 *
 * 根据 AUTH_PROVIDER 环境变量（nextauth | supabase）自动切换认证方案。
 * 所有需要认证功能的文件应从此模块导入。
 */

/** 当前认证提供者 */
export const AUTH_PROVIDER = (process.env.NEXT_PUBLIC_AUTH_PROVIDER || process.env.AUTH_PROVIDER || 'none') as 'nextauth' | 'supabase' | 'none';

/** 是否使用 NextAuth 模式 */
export const isNextAuth = AUTH_PROVIDER === 'nextauth';

/** 是否使用 Supabase Auth 模式 */
export const isSupabaseAuth = AUTH_PROVIDER === 'supabase';

// 导出统一的服务端用户获取函数
export { getCurrentUser } from './get-current-user';
export type { AuthUser } from './get-current-user';
