/**
 * Supabase 直连层
 *
 * 读取项目根目录的 .env 文件，使用 Service Role Key 直连 Supabase。
 * 仅在管理员本机运行，不经过任何 Web 层。
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 加载项目根目录的 .env
config({ path: resolve(__dirname, '../../.env') });
// 兼容 .env.local（Next.js 默认）
config({ path: resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 缺少环境变量：NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
    console.error('   请确保项目根目录存在 .env 或 .env.local 文件');
    process.exit(1);
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
});

/** 获取所有环境变量键名（用于审计，不暴露值） */
export function getEnvAudit(): Record<string, { configured: boolean; label: string; category: string }> {
    const checks: Record<string, { key: string; label: string; category: string }> = {
        NEXT_PUBLIC_SUPABASE_URL: { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL', category: 'database' },
        SUPABASE_SERVICE_ROLE_KEY: { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', category: 'database' },
        GEMINI_API_KEY: { key: 'GEMINI_API_KEY', label: 'Gemini API Key', category: 'ai' },
        GEMINI_BASE_URL: { key: 'GEMINI_BASE_URL', label: 'Gemini Base URL', category: 'ai' },
        DEEPSEEK_API_KEY: { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek API Key', category: 'ai' },
        DEEPSEEK_BASE_URL: { key: 'DEEPSEEK_BASE_URL', label: 'DeepSeek Base URL', category: 'ai' },
        MINIMAX_API_KEY: { key: 'MINIMAX_API_KEY', label: 'Minimax API Key', category: 'ai' },
        MINIMAX_BASE_URL: { key: 'MINIMAX_BASE_URL', label: 'Minimax Base URL', category: 'ai' },
        BRAVE_API_KEY: { key: 'BRAVE_API_KEY', label: 'Brave Search Key', category: 'search' },
        SERPAPI_KEY: { key: 'SERPAPI_KEY', label: 'SerpAPI Key', category: 'search' },
        GITHUB_TOKEN: { key: 'GITHUB_TOKEN', label: 'GitHub Token', category: 'search' },
        CORE_API_KEY: { key: 'CORE_API_KEY', label: 'CORE API Key', category: 'search' },
    };

    const result: Record<string, { configured: boolean; label: string; category: string }> = {};
    for (const [key, meta] of Object.entries(checks)) {
        result[key] = {
            configured: !!process.env[key],
            label: meta.label,
            category: meta.category,
        };
    }
    return result;
}
