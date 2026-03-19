/**
 * 数据库工厂 — 可扩展的适配器注册与实例化
 *
 * 通过 DATABASE_PROVIDER 环境变量选择数据库后端：
 *   - 'noop'（默认）：不使用数据库，所有操作静默返回空数据
 *   - 'supabase'：使用 Supabase JS SDK
 *   - 'postgres'：使用原生 PostgreSQL（需安装 pg 包）
 *   - 自定义：通过 registerDatabaseAdapter() 注册企业自有适配器
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
 *
 * 企业自定义适配器：
 * ```typescript
 * import { registerDatabaseAdapter } from '@/lib/db/factory';
 * registerDatabaseAdapter('mysql', () => new MySQLAdapter(process.env.MYSQL_URL!));
 * // 然后设 DATABASE_PROVIDER=mysql
 * ```
 */

import type { IDatabase, IQueryBuilder } from './IDatabase';
import { NoopAdapter } from './NoopAdapter';
import { MemoryAdapter } from './MemoryAdapter';

/** 支持的数据库提供者类型（内置 + 自定义） */
export type DatabaseProvider = 'noop' | 'memory' | 'sqlite' | 'supabase' | 'postgres' | string;

// ==================== 适配器注册表 ====================

/** 已注册的自定义适配器工厂 */
const adapterRegistry = new Map<string, () => IDatabase>();

/**
 * 注册自定义数据库适配器
 *
 * 企业用户可实现 IDatabase 接口并注册，然后通过
 * DATABASE_PROVIDER 环境变量切换使用。
 *
 * @example
 * ```typescript
 * import { registerDatabaseAdapter } from '@/lib/db/factory';
 * import { MySQLAdapter } from './MySQLAdapter';
 *
 * registerDatabaseAdapter('mysql', () => new MySQLAdapter(process.env.MYSQL_URL!));
 * ```
 */
export function registerDatabaseAdapter(name: string, factory: () => IDatabase): void {
  adapterRegistry.set(name, factory);
  console.info(`[DB Factory] 已注册自定义适配器: ${name}`);
}

// ==================== 内部工厂 ====================

/** 获取当前配置的提供者 */
function getProvider(): DatabaseProvider {
  return (process.env.DATABASE_PROVIDER || 'noop') as DatabaseProvider;
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
 * Supabase 延迟代理
 *
 * 仅在 DATABASE_PROVIDER=supabase 时才加载 Supabase SDK，
 * 避免 @supabase/supabase-js 成为硬性运行时依赖。
 */
function createLazySupabaseProxy(useAdmin: boolean): IDatabase {
  let adapter: IDatabase | null = null;

  const loadAdapter = (): IDatabase => {
    if (adapter) return adapter;

    try {
      // eslint-disable-next-line no-eval
      const supabaseMod = eval("require('@/lib/supabase')");
      // eslint-disable-next-line no-eval
      const adapterMod = eval("require('./SupabaseAdapter')");
      const client = useAdmin ? supabaseMod.adminDb : supabaseMod.supabase;
      adapter = new adapterMod.SupabaseAdapter(client);
      return adapter!;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `[DB Factory] 无法加载 SupabaseAdapter: ${errMsg}。` +
        '请确保已配置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量'
      );
    }
  };

  return {
    from<T = any>(table: string): IQueryBuilder<T> {
      return loadAdapter().from<T>(table);
    },
  };
}

// ==================== 公开工厂方法 ====================

/**
 * SQLite 延迟代理
 *
 * 仅在 DATABASE_PROVIDER=sqlite 时才加载 SqliteAdapter，
 * 避免 better-sqlite3 成为硬性依赖。
 */
function createLazySqliteProxy(): IDatabase {
  let adapter: IDatabase | null = null;

  const loadAdapter = (): IDatabase => {
    if (adapter) return adapter;

    const dbPath = process.env.SQLITE_PATH || './data/novoscan.db';

    try {
      // eslint-disable-next-line no-eval
      const mod = eval("require('./SqliteAdapter')");
      adapter = new mod.SqliteAdapter(dbPath);
      return adapter!;
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      throw new Error(
        `[DB Factory] 无法加载 SqliteAdapter: ${errMsg}。` +
        '请确保已安装 better-sqlite3：npm install better-sqlite3'
      );
    }
  };

  return {
    from<T = any>(table: string): IQueryBuilder<T> {
      return loadAdapter().from<T>(table);
    },
  };
}

// ==================== 公开工厂方法 ====================

/**
 * 创建匿名权限数据库实例（受 RLS 限制）
 * 适用于客户端安全的只读查询
 */
export function createDatabase(): IDatabase {
  const provider = getProvider();

  // 优先查自定义注册表
  const customFactory = adapterRegistry.get(provider);
  if (customFactory) return customFactory();

  switch (provider) {
    case 'postgres':
      return createLazyPostgresProxy();
    case 'sqlite':
      return createLazySqliteProxy();
    case 'supabase':
      return createLazySupabaseProxy(false);
    case 'memory':
      return new MemoryAdapter();
    case 'noop':
    default:
      return new NoopAdapter();
  }
}

/**
 * 创建管理员权限数据库实例（绕过 RLS）
 * 仅限服务端 API 使用，切勿暴露给客户端
 */
export function createAdminDatabase(): IDatabase {
  const provider = getProvider();

  // 优先查自定义注册表
  const customFactory = adapterRegistry.get(provider);
  if (customFactory) return customFactory();

  switch (provider) {
    case 'postgres':
      return createLazyPostgresProxy();
    case 'sqlite':
      return createLazySqliteProxy();
    case 'supabase':
      return createLazySupabaseProxy(true);
    case 'memory':
      return new MemoryAdapter();
    case 'noop':
    default:
      return new NoopAdapter();
  }
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
