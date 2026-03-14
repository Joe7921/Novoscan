/**
 * NextAuth.js — Node.js Only 配置
 *
 * 包含需要 Node.js 运行时的 Provider（CredentialsProvider + bcrypt）
 * 和数据库操作（通过 IDatabase 的 auth_users 表）。
 *
 * 此文件仅在 auth.ts 中被导入（Node.js 环境），
 * 不会被 middleware（Edge Runtime）引用。
 */

import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { findUserByEmail, createCredentialsUser } from './auth-users';
import type { Provider } from 'next-auth/providers';

/**
 * Node.js 专属 Providers（含 CredentialsProvider）
 *
 * 在 auth.ts 中与 auth.config.ts 的 providers 合并，
 * 确保 Edge Runtime 不会加载此文件。
 */
export const nodeProviders: Provider[] = [
    Credentials({
        name: 'credentials',
        credentials: {
            email: { label: '邮箱', type: 'email' },
            password: { label: '密码', type: 'password' },
            action: { label: '操作', type: 'text' }, // 'login' 或 'register'
        },
        async authorize(credentials) {
            const email = credentials?.email as string;
            const password = credentials?.password as string;
            const action = (credentials?.action as string) || 'login';

            if (!email || !password) return null;

            if (action === 'register') {
                // 注册流程
                const existing = await findUserByEmail(email);
                if (existing) {
                    throw new Error('该邮箱已被注册');
                }
                const passwordHash = await bcrypt.hash(password, 12);
                const newUser = await createCredentialsUser(email, passwordHash);
                if (!newUser) {
                    throw new Error('注册失败，请稍后重试');
                }
                return {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name,
                    image: newUser.image,
                };
            }

            // 登录流程
            const user = await findUserByEmail(email);
            if (!user || !user.password_hash) return null;

            const isValid = await bcrypt.compare(password, user.password_hash);
            if (!isValid) return null;

            return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
            };
        },
    }),
];
