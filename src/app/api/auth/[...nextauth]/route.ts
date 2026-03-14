/**
 * NextAuth.js API 路由处理器
 *
 * 处理 /api/auth/* 下的所有 NextAuth 请求（登录、登出、回调等）。
 * 仅在 AUTH_PROVIDER=nextauth 时实际使用。
 */

import { handlers } from '@/lib/auth/auth';

export const { GET, POST } = handlers;
