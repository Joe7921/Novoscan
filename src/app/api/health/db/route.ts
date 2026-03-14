export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { requireAdminAuth } from '@/lib/security/apiSecurity';

export async function GET() {
    // 🔒 Admin 鉴权
    const authError = await requireAdminAuth();
    if (authError) return authError;

    const startTime = Date.now();
    const checks = {
        connection: false,
        readWrite: false,
        tables: {} as Record<string, boolean>,
        latency: 0,
        timestamp: new Date().toISOString(),
    };
    let status: 'healthy' | 'degraded' | 'error' = 'healthy';
    let message = '数据库连接正常';
    let totalRecords = 0;

    try {
        // 1. 检查连接与 search_history 表
        const { error: connError, count } = await supabase
            .from('search_history')
            .select('*', { count: 'exact', head: true });

        if (connError) {
            throw connError;
        }
        checks.connection = true;
        totalRecords = count || 0;

        // 2. 读写测试 (Write Test)
        const testId = `health-check-${Date.now()}`;
        const { error: writeError } = await supabaseAdmin
            .from('search_history')
            .insert({
                query: 'HEALTH_CHECK_TEST',
                model_provider: 'INTERNAL_TEST',
                search_time_ms: 0,
                result: {}
            });

        if (writeError) {
            checks.readWrite = false;
            status = 'degraded';
            message = `写操作失败: ${writeError.message}`;
        } else {
            // 清理测试数据
            await supabaseAdmin
                .from('search_history')
                .delete()
                .match({ query: 'HEALTH_CHECK_TEST' });
            checks.readWrite = true;
        }

        // 3. 检查关键表
        const tables = ['search_history', 'agent_executions'];
        let allTablesExist = true;
        for (const table of tables) {
            const { error } = await supabase.from(table).select('*', { head: true });
            if (!error) {
                checks.tables[table] = true;
            } else {
                checks.tables[table] = false;
                allTablesExist = false;
            }
        }

        if (!allTablesExist) {
            status = 'degraded';
            if (message === '数据库连接正常') {
                message = '存在未找到或缺失的表';
            } else {
                message += ' | 存在缺失的表';
            }
        }

    } catch (error: unknown) {
        status = 'error';
        message = (error instanceof Error ? error.message : String(error)) || '无法连接到数据库';
        checks.connection = false;
    }

    checks.latency = Date.now() - startTime;

    return NextResponse.json({
        status,
        message,
        checks,
        stats: {
            totalRecords,
        },
    });
}
