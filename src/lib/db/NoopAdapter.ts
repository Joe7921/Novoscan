/**
 * NoopAdapter — 空操作数据库适配器
 *
 * 当 DATABASE_PROVIDER 未配置或设为 'noop' 时使用。
 * 所有读操作返回空数据，所有写操作静默成功。
 * 适用于：
 *   - 开源版默认部署（无需数据库即可运行核心分析功能）
 *   - 开发测试环境
 */

import type { IDatabase, IQueryBuilder, DbResult, DbSingleResult, DbError } from './IDatabase';

let _hasWarned = false;

class NoopQueryBuilder<T = any> implements IQueryBuilder<T> {
  select(_columns?: string, _options?: { count?: 'exact'; head?: boolean }): IQueryBuilder<T> { return this; }

  // ---- 过滤操作（全部为链式空操作） ----
  eq(_column: string, _value: unknown): IQueryBuilder<T> { return this; }
  neq(_column: string, _value: unknown): IQueryBuilder<T> { return this; }
  gt(_column: string, _value: unknown): IQueryBuilder<T> { return this; }
  gte(_column: string, _value: unknown): IQueryBuilder<T> { return this; }
  lt(_column: string, _value: unknown): IQueryBuilder<T> { return this; }
  lte(_column: string, _value: unknown): IQueryBuilder<T> { return this; }
  ilike(_column: string, _pattern: string): IQueryBuilder<T> { return this; }
  contains(_column: string, _value: unknown): IQueryBuilder<T> { return this; }
  textSearch(_column: string, _query: string, _options?: { type?: string }): IQueryBuilder<T> { return this; }
  or(_filters: string): IQueryBuilder<T> { return this; }
  in(_column: string, _values: unknown[]): IQueryBuilder<T> { return this; }
  match(_query: Record<string, unknown>): IQueryBuilder<T> { return this; }

  // ---- 排序与分页 ----
  order(_column: string, _options?: { ascending?: boolean }): IQueryBuilder<T> { return this; }
  limit(_count: number): IQueryBuilder<T> { return this; }

  // ---- 写入操作 ----
  insert(_data: Record<string, any> | Record<string, any>[]): IQueryBuilder<T> { return this; }
  update(_data: Record<string, any>): IQueryBuilder<T> { return this; }
  upsert(_data: Record<string, any> | Record<string, any>[], _options?: { onConflict?: string }): IQueryBuilder<T> { return this; }
  delete(): IQueryBuilder<T> { return this; }

  // ---- 终结操作 ----
  async maybeSingle(): Promise<DbSingleResult<T>> {
    return { data: null, error: null };
  }

  async single(): Promise<DbSingleResult<T>> {
    return { data: null, error: null };
  }

  then<TResult1 = DbResult<T>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const result: DbResult<T> = { data: [] as T[], error: null, count: 0 };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

/**
 * 空操作数据库适配器
 *
 * 所有操作返回空结果，不连接任何数据库。
 * 首次调用时输出一次提示日志。
 */
export class NoopAdapter implements IDatabase {
  from<T = any>(_table: string): IQueryBuilder<T> {
    if (!_hasWarned) {
      _hasWarned = true;
      console.info('[DB] 数据库未配置（DATABASE_PROVIDER=noop），数据读写已静默跳过。如需启用数据持久化，请参阅文档配置数据库。');
    }
    return new NoopQueryBuilder<T>();
  }

  async rpc(_functionName: string, _params?: Record<string, unknown>): Promise<{ data: unknown; error: DbError | null }> {
    return { data: null, error: null };
  }
}
