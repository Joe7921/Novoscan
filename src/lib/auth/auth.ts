/**
 * NextAuth.js 实例导出（Node.js 环境）
 *
 * 合并 edge-safe 配置（auth.config.ts）和 Node.js 专属 providers（auth.node.ts），
 * 导出完整的 NextAuth 实例。
 *
 * 此文件仅在 Node.js 环境中使用（API 路由、服务端组件）。
 * Middleware（Edge Runtime）应直接导入 auth.config.ts。
 */

import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { nodeProviders } from './auth.node';

/**
 * 完整的 NextAuth 实例
 * 将 edge-safe 的 OAuth providers + Node.js 的 CredentialsProvider 合并
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        ...authConfig.providers,  // GitHub + Google（edge-safe）
        ...nodeProviders,          // Credentials（Node.js only）
    ],
});
