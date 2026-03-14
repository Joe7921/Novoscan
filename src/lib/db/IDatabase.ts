/**
 * 数据库抽象层 — 统一接口定义
 *
 * 提供与 Supabase 链式 API 对齐的查询构建器接口，
 * 使不同数据库后端（Supabase、PostgreSQL、SQLite）可以被替换。
 */

// ==================== 查询结果类型 ====================

/** 标准查询结果（与 Supabase PostgrestResponse 对齐） */
export interface DbResult<T> {
  data: T[] | null;
  error: DbError | null;
  count?: number | null;
}

/** 单条记录查询结果 */
export interface DbSingleResult<T> {
  data: T | null;
  error: DbError | null;
}

/** 数据库错误 */
export interface DbError {
  message: string;
  code?: string;
  details?: string;
}

// ==================== 查询构建器接口 ====================

/**
 * 链式查询构建器接口
 *
 * 与 Supabase 的 PostgrestFilterBuilder 对齐，
 * 支持 select → filter → order → limit → execute 的链式调用模式。
 */
export interface IQueryBuilder<T = any> {
  /** 指定要查询的列 */
  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): IQueryBuilder<T>;

  // ---- 过滤操作 ----
  /** 等于 */
  eq(column: string, value: unknown): IQueryBuilder<T>;
  /** 不等于 */
  neq(column: string, value: unknown): IQueryBuilder<T>;
  /** 大于 */
  gt(column: string, value: unknown): IQueryBuilder<T>;
  /** 大于等于 */
  gte(column: string, value: unknown): IQueryBuilder<T>;
  /** 小于 */
  lt(column: string, value: unknown): IQueryBuilder<T>;
  /** 小于等于 */
  lte(column: string, value: unknown): IQueryBuilder<T>;
  /** 模糊匹配（不区分大小写） */
  ilike(column: string, pattern: string): IQueryBuilder<T>;
  /** 数组包含 */
  contains(column: string, value: unknown): IQueryBuilder<T>;
  /** 全文检索 */
  textSearch(column: string, query: string, options?: { type?: string }): IQueryBuilder<T>;
  /** OR 组合过滤 */
  or(filters: string): IQueryBuilder<T>;

  // ---- 排序与分页 ----
  /** 排序 */
  order(column: string, options?: { ascending?: boolean }): IQueryBuilder<T>;
  /** 限制返回条数 */
  limit(count: number): IQueryBuilder<T>;

  // ---- 写入操作 ----
  /** 插入一条或多条记录 */
  insert(data: Record<string, any> | Record<string, any>[]): IQueryBuilder<T>;
  /** 更新记录 */
  update(data: Record<string, any>): IQueryBuilder<T>;
  /** 插入或更新（如存在则更新） */
  upsert(data: Record<string, any> | Record<string, any>[], options?: { onConflict?: string }): IQueryBuilder<T>;
  /** 删除记录 */
  delete(): IQueryBuilder<T>;

  // ---- 终结操作（执行查询） ----
  /** 返回最多一条记录（找不到不报错） */
  maybeSingle(): Promise<DbSingleResult<T>>;
  /** 返回且必须有且仅有一条记录 */
  single(): Promise<DbSingleResult<T>>;

  /** 执行查询并返回结果（实现 PromiseLike 以支持 await） */
  then<TResult1 = DbResult<T>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
}

// ==================== 数据库接口 ====================

/**
 * 数据库抽象接口
 *
 * 所有数据库适配器必须实现此接口。
 * 使用方式：`db.from('table_name').select('*').eq('id', 1)`
 */
export interface IDatabase {
  /** 指定操作的数据表，返回查询构建器 */
  from<T = any>(table: string): IQueryBuilder<T>;

  /** 调用数据库函数/存储过程（可选实现） */
  rpc?(functionName: string, params?: Record<string, unknown>): Promise<{ data: unknown; error: DbError | null }>;
}
