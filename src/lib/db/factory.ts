/**
 * 数据库工厂 — 根据环境变量创建对应的数据库适配器
 *
 * 通过 DATABASE_PROVIDER 环境变量选择数据库后端：
 *   - 'supabase'（默认）：使用 Supabase JS SDK
 *   - 'postgres'：使用原生 PostgreSQL（需安装 pg 包）
 *
 * 使用方式：
 * ```typescript
 * import { db, adminDb } from '@/lib/db/factory';
 *
 * // 匿名查询（受 RLS 限制）
 * const { data } = await db.from('innovations').select('*');
 *
 * // 管理员操作（绕过 RLS）
 * const { error } = await adminDb.from('innovations').insert({ ... });
 * ```
 */

import type { IDatabase, IQueryBuilder } from './IDatabase';
import { SupabaseAdapter } from './SupabaseAdapter';
import { supabase, supabaseAdmin } from '@/lib/supabase';

/** 支持的数据库提供者类型 */
export type DatabaseProvider = 'supabase' | 'postgres';

/** 获取当前配置的提供者 */
function getProvider(): DatabaseProvider {
  return (process.env.DATABASE_PROVIDER || 'supabase') as DatabaseProvider;
}

/**
 * PostgreSQL 延迟代理
 *
 * 完全避免静态导入 PostgresAdapter 模块，
 * 仅在实际调用 from() 时才通过 eval + require 加载，
 * 防止 webpack 在编译时追踪和解析 pg 模块依赖。
 */
function createLazyPostgresProxy(): IDatabase {
  let adapter: IDatabase | null = null;

  const loadAdapter = (): IDatabase => {
    if (adapter) return adapter;

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('[DB Factory] DATABASE_PROVIDER=postgres 但 DATABASE_URL 未设置');
    }

    // 使用 eval 动态加载，完全绕过 webpack 静态分析
    // 此路径仅在 DATABASE_PROVIDER=postgres 时执行
    try {
      // eslint-disable-next-line no-eval
      const mod = eval("require('./PostgresAdapter')");
      adapter = new mod.PostgresAdapter(connectionString);
      return adapter!;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `[DB Factory] 无法加载 PostgresAdapter: ${errMsg}。` +
        '请确保已安装 pg 包：npm install pg'
      );
    }
  };

  return {
    from<T = any>(table: string): IQueryBuilder<T> {
      return loadAdapter().from<T>(table);
    },
  };
}

/**
 * 创建匿名权限数据库实例（受 RLS 限制）
 * 适用于客户端安全的只读查询
 */
export function createDatabase(): IDatabase {
  const provider = getProvider();

  if (provider === 'postgres') {
    return createLazyPostgresProxy();
  }

  // 默认使用 Supabase
  return new SupabaseAdapter(supabase);
}

/**
 * 创建管理员权限数据库实例（绕过 RLS）
 * 仅限服务端 API 使用，切勿暴露给客户端
 */
export function createAdminDatabase(): IDatabase {
  const provider = getProvider();

  if (provider === 'postgres') {
    return createLazyPostgresProxy();
  }

  return new SupabaseAdapter(supabaseAdmin);
}

// ==================== 单例导出 ====================

/**
 * 全局匿名数据库实例
 * 受 RLS 限制，适合公开数据查询
 */
export const db: IDatabase = createDatabase();

/**
 * 全局管理员数据库实例
 * 绕过 RLS，仅限服务端使用
 */
export const adminDb: IDatabase = createAdminDatabase();
