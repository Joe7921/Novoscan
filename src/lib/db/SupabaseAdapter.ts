/**
 * Supabase 适配器 — IDatabase 的 Supabase 实现
 *
 * 将现有的 Supabase JS SDK 调用包装为 IDatabase 接口。
 * 内部直接代理 Supabase 的 PostgrestFilterBuilder，零性能开销。
 */

import type { IDatabase, IQueryBuilder, DbResult, DbSingleResult } from './IDatabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// ==================== 查询构建器包装 ====================

/**
 * Supabase 查询构建器包装器
 *
 * 直接代理 Supabase 的 PostgrestFilterBuilder/PostgrestQueryBuilder，
 * 所有链式方法调用原封不动转发给底层 Supabase 对象。
 */
class SupabaseQueryBuilder<T = any> implements IQueryBuilder<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private builder: any;

  constructor(builder: any) {
    this.builder = builder;
  }

  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): IQueryBuilder<T> {
    this.builder = this.builder.select(columns ?? '*', options);
    return this;
  }

  eq(column: string, value: unknown): IQueryBuilder<T> {
    this.builder = this.builder.eq(column, value);
    return this;
  }

  neq(column: string, value: unknown): IQueryBuilder<T> {
    this.builder = this.builder.neq(column, value);
    return this;
  }

  gt(column: string, value: unknown): IQueryBuilder<T> {
    this.builder = this.builder.gt(column, value);
    return this;
  }

  gte(column: string, value: unknown): IQueryBuilder<T> {
    this.builder = this.builder.gte(column, value);
    return this;
  }

  lt(column: string, value: unknown): IQueryBuilder<T> {
    this.builder = this.builder.lt(column, value);
    return this;
  }

  lte(column: string, value: unknown): IQueryBuilder<T> {
    this.builder = this.builder.lte(column, value);
    return this;
  }

  ilike(column: string, pattern: string): IQueryBuilder<T> {
    this.builder = this.builder.ilike(column, pattern);
    return this;
  }

  contains(column: string, value: unknown): IQueryBuilder<T> {
    this.builder = this.builder.contains(column, value);
    return this;
  }

  textSearch(column: string, query: string, options?: { type?: string }): IQueryBuilder<T> {
    this.builder = this.builder.textSearch(column, query, options);
    return this;
  }

  or(filters: string): IQueryBuilder<T> {
    this.builder = this.builder.or(filters);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): IQueryBuilder<T> {
    this.builder = this.builder.order(column, options);
    return this;
  }

  limit(count: number): IQueryBuilder<T> {
    this.builder = this.builder.limit(count);
    return this;
  }

  insert(data: Record<string, any> | Record<string, any>[]): IQueryBuilder<T> {
    this.builder = this.builder.insert(data);
    return this;
  }

  update(data: Record<string, any>): IQueryBuilder<T> {
    this.builder = this.builder.update(data);
    return this;
  }

  upsert(data: Record<string, any> | Record<string, any>[], options?: { onConflict?: string }): IQueryBuilder<T> {
    this.builder = this.builder.upsert(data, options);
    return this;
  }

  delete(): IQueryBuilder<T> {
    this.builder = this.builder.delete();
    return this;
  }

  async maybeSingle(): Promise<DbSingleResult<T>> {
    const result = await this.builder.maybeSingle();
    return { data: result.data, error: result.error };
  }

  async single(): Promise<DbSingleResult<T>> {
    const result = await this.builder.single();
    return { data: result.data, error: result.error };
  }

  then<TResult1 = DbResult<T>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.builder.then(
      (result: any) => {
        const dbResult: DbResult<T> = {
          data: result.data,
          error: result.error,
          count: result.count,
        };
        return onfulfilled ? onfulfilled(dbResult) : dbResult as any;
      },
      onrejected
    );
  }
}

// ==================== 适配器实现 ====================

/**
 * Supabase 数据库适配器
 *
 * 包装 SupabaseClient 实例，使其符合 IDatabase 接口。
 * 支持匿名客户端（受 RLS 限制）和管理员客户端（绕过 RLS）。
 */
export class SupabaseAdapter implements IDatabase {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  from<T = any>(table: string): IQueryBuilder<T> {
    return new SupabaseQueryBuilder<T>(this.client.from(table));
  }

  async rpc(functionName: string, params?: Record<string, unknown>): Promise<{ data: unknown; error: any }> {
    return this.client.rpc(functionName, params);
  }
}
