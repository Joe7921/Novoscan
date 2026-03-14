/**
 * NextAuth.js (Auth.js v5) — Edge-safe 配置
 *
 * 此文件仅包含 Edge Runtime 兼容的配置（Provider 声明、callbacks、pages 等）。
 * 不导入 bcryptjs、数据库工厂等 Node.js 专属模块。
 *
 * CredentialsProvider 的 authorize 逻辑拆分到 auth.node.ts 中，
 * 在 auth.ts 中通过 spread 合并。
 */

import type { NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

/**
 * Edge-safe 配置（可在 middleware Edge Runtime 中使用）
 *
 * 注意：此配置不包含 CredentialsProvider，
 * 完整配置由 auth.ts 中合并 auth.node.ts 的 providers 生成。
 */
export const authConfig: NextAuthConfig = {
    providers: [
        // OAuth Providers（Edge-safe，不涉及 Node.js API）
        GitHub({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
        }),
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
    ],

    // 使用 JWT 策略（Credentials Provider 仅支持 JWT）
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 天
    },

    pages: {
        // 不使用 NextAuth 内置页面，使用自定义 LoginModal
        signIn: '/',
        error: '/auth/auth-code-error',
    },

    callbacks: {
        // 将用户信息写入 JWT token
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.email = user.email;
                token.name = user.name;
                token.picture = user.image;
            }
            return token;
        },

        // 将 token 信息映射到 session
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.email = token.email as string;
                session.user.name = token.name as string;
                session.user.image = token.picture as string;
            }
            return session;
        },

        // 路由保护不在此处实现，由 middleware 统一处理
        authorized({ auth }) {
            return true;
        },
    },

    // 信任代理 host（Vercel / Docker 部署需要）
    trustHost: true,
};
