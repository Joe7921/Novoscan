/**
 * PostgreSQL 原生适配器 — IDatabase 的 PostgreSQL 实现
 *
 * 基于 `pg` 包的原生 PostgreSQL 实现。
 * 所有 SQL 使用参数化查询（$1, $2...）防止注入攻击。
 *
 * 如需启用，请安装 pg 包：npm install pg @types/pg
 * 并在 .env 中设置：
 *   DATABASE_PROVIDER=postgres
 *   DATABASE_URL=postgresql://user:pass@localhost:5432/novoscan
 */

import type { IDatabase, IQueryBuilder, DbResult, DbSingleResult, DbError } from './IDatabase';

// ==================== 辅助类型 ====================

/** WHERE 子句条件 */
interface WhereClause {
  /** SQL 片段，如 "column" = $N 或 "column" ILIKE $N */
  sql: string;
  /** 参数值 */
  value: unknown;
}

/** 操作模式 */
type OperationMode = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

// ==================== 辅助函数 ====================

/**
 * 给标识符加双引号转义（防止与 SQL 保留字冲突）
 * 例如 "order" → "\"order\""
 */
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * 将 Supabase 风格的 select 列字符串解析为 SQL 列列表
 * 例如 'id, name, created_at' → '"id", "name", "created_at"'
 * 特殊情况 '*' → '*'
 */
function parseColumns(columns: string): string {
  if (columns.trim() === '*') return '*';
  return columns
    .split(',')
    .map(col => quoteIdent(col.trim()))
    .join(', ');
}

/**
 * 解析 Supabase 风格的 OR 过滤字符串
 * 例如 'domain_id.eq.CS,domain_id.is.null' → 两个条件
 *
 * 支持的操作符：eq, neq, gt, gte, lt, lte, is, ilike, like
 */
function parseOrFilters(orStr: string, paramOffset: number): { sql: string; values: unknown[] } {
  const parts = orStr.split(',');
  const conditions: string[] = [];
  const values: unknown[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    // 格式: column.operator.value
    const dotIdx1 = trimmed.indexOf('.');
    if (dotIdx1 === -1) continue;
    const column = trimmed.slice(0, dotIdx1);
    const rest = trimmed.slice(dotIdx1 + 1);
    const dotIdx2 = rest.indexOf('.');
    if (dotIdx2 === -1) continue;
    const operator = rest.slice(0, dotIdx2);
    const value = rest.slice(dotIdx2 + 1);

    const quotedCol = quoteIdent(column);
    const paramIdx = paramOffset + values.length + 1;

    switch (operator) {
      case 'eq':
        conditions.push(`${quotedCol} = $${paramIdx}`);
        values.push(value);
        break;
      case 'neq':
        conditions.push(`${quotedCol} != $${paramIdx}`);
        values.push(value);
        break;
      case 'gt':
        conditions.push(`${quotedCol} > $${paramIdx}`);
        values.push(value);
        break;
      case 'gte':
        conditions.push(`${quotedCol} >= $${paramIdx}`);
        values.push(value);
        break;
      case 'lt':
        conditions.push(`${quotedCol} < $${paramIdx}`);
        values.push(value);
        break;
      case 'lte':
        conditions.push(`${quotedCol} <= $${paramIdx}`);
        values.push(value);
        break;
      case 'is':
        // is.null → IS NULL（无参数）
        if (value === 'null') {
          conditions.push(`${quotedCol} IS NULL`);
        } else {
          conditions.push(`${quotedCol} IS $${paramIdx}`);
          values.push(value);
        }
        break;
      case 'ilike':
        conditions.push(`${quotedCol} ILIKE $${paramIdx}`);
        values.push(value);
        break;
      case 'like':
        conditions.push(`${quotedCol} LIKE $${paramIdx}`);
        values.push(value);
        break;
      default:
        // 未知操作符，跳过
        console.warn(`[PostgresAdapter] OR 过滤器中未知的操作符: ${operator}`);
        break;
    }
  }

  return {
    sql: conditions.length > 0 ? `(${conditions.join(' OR ')})` : 'TRUE',
    values,
  };
}

// ==================== 查询构建器实现 ====================

/**
 * PostgreSQL 查询构建器
 *
 * 在链式调用过程中收集所有条件，在终结操作（then/single/maybeSingle）
 * 时构建参数化 SQL 并通过 pg Pool 执行。
 */
class PostgresQueryBuilder<T = any> implements IQueryBuilder<T> {
  private _table: string;
  private _poolPromise: Promise<any>;

  // ---- 查询状态收集 ----
  private _mode: OperationMode = 'select';
  private _columns: string = '*';
  private _countMode: boolean = false;
  private _headOnly: boolean = false;
  private _wheres: WhereClause[] = [];
  private _orClauses: { sql: string; values: unknown[] }[] = [];
  private _orderBy: { column: string; ascending: boolean }[] = [];
  private _limitCount: number | null = null;
  private _insertData: Record<string, any> | null = null;
  private _updateData: Record<string, any> | null = null;
  private _upsertConflict: string | null = null;

  constructor(table: string, poolPromise: Promise<any>) {
    this._table = table;
    this._poolPromise = poolPromise;
  }

  // ---- 查询配置 ----

  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): IQueryBuilder<T> {
    this._mode = 'select';
    this._columns = columns || '*';
    if (options?.count === 'exact') this._countMode = true;
    if (options?.head) this._headOnly = true;
    return this;
  }

  // ---- 过滤条件（WHERE 子句） ----

  eq(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} = $%IDX%`, value });
    return this;
  }

  neq(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} != $%IDX%`, value });
    return this;
  }

  gt(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} > $%IDX%`, value });
    return this;
  }

  gte(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} >= $%IDX%`, value });
    return this;
  }

  lt(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} < $%IDX%`, value });
    return this;
  }

  lte(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} <= $%IDX%`, value });
    return this;
  }

  ilike(column: string, pattern: string): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} ILIKE $%IDX%`, value: pattern });
    return this;
  }

  contains(column: string, value: unknown): IQueryBuilder<T> {
    // PostgreSQL @> 操作符，支持 JSONB 和 Array 类型
    this._wheres.push({
      sql: `${quoteIdent(column)} @> $%IDX%`,
      value: JSON.stringify(value),
    });
    return this;
  }

  textSearch(column: string, query: string, options?: { type?: string }): IQueryBuilder<T> {
    const searchType = options?.type || 'plain';
    let tsFunc = 'plainto_tsquery';
    if (searchType === 'phrase') tsFunc = 'phraseto_tsquery';
    else if (searchType === 'websearch') tsFunc = 'websearch_to_tsquery';

    this._wheres.push({
      sql: `${quoteIdent(column)} @@ ${tsFunc}('simple', $%IDX%)`,
      value: query,
    });
    return this;
  }

  or(filters: string): IQueryBuilder<T> {
    // 参数起始偏移在构建 SQL 时计算
    this._orClauses.push({ sql: filters, values: [] });
    return this;
  }

  in(column: string, values: unknown[]): IQueryBuilder<T> {
    if (values.length === 0) {
      // 空数组 → 永假条件（无匹配）
      this._wheres.push({ sql: 'FALSE', value: null });
    } else {
      // 生成 "column" IN ($1, $2, ...) — 使用特殊占位符标记
      this._wheres.push({
        sql: `__IN__${column}__${values.length}__`,
        value: values,
      });
    }
    return this;
  }

  match(query: Record<string, unknown>): IQueryBuilder<T> {
    for (const [column, value] of Object.entries(query)) {
      this._wheres.push({ sql: `${quoteIdent(column)} = $%IDX%`, value });
    }
    return this;
  }

  // ---- 排序与分页 ----

  order(column: string, options?: { ascending?: boolean }): IQueryBuilder<T> {
    this._orderBy.push({
      column,
      ascending: options?.ascending ?? true,
    });
    return this;
  }

  limit(count: number): IQueryBuilder<T> {
    this._limitCount = count;
    return this;
  }

  // ---- 写入操作 ----

  insert(data: Record<string, any> | Record<string, any>[]): IQueryBuilder<T> {
    this._mode = 'insert';
    this._insertData = Array.isArray(data) ? data[0] : data; // 简化：取第一条
    return this;
  }

  update(data: Record<string, any>): IQueryBuilder<T> {
    this._mode = 'update';
    this._updateData = data;
    return this;
  }

  upsert(data: Record<string, any> | Record<string, any>[], options?: { onConflict?: string }): IQueryBuilder<T> {
    this._mode = 'upsert';
    this._insertData = Array.isArray(data) ? data[0] : data;
    this._upsertConflict = options?.onConflict || null;
    return this;
  }

  delete(): IQueryBuilder<T> {
    this._mode = 'delete';
    return this;
  }

  // ==================== SQL 构建核心 ====================

  /**
   * 根据收集的状态构建参数化 SQL 和对应参数数组
   */
  private buildSQL(): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    let paramIdx = 1;
    const table = quoteIdent(this._table);

    // 构建 WHERE 子句
    const buildWhere = (): string => {
      const conditions: string[] = [];

      for (const w of this._wheres) {
        // 处理 FALSE 占位（空 IN 查询）
        if (w.sql === 'FALSE') {
          conditions.push('FALSE');
          continue;
        }
        // 处理 IN 查询标记: __IN__column__count__
        const inMatch = w.sql.match(/^__IN__(.+)__(\d+)__$/);
        if (inMatch) {
          const col = quoteIdent(inMatch[1]);
          const count = parseInt(inMatch[2], 10);
          const values = w.value as unknown[];
          const placeholders = values.map(() => `$${paramIdx++}`).join(', ');
          conditions.push(`${col} IN (${placeholders})`);
          params.push(...values);
          continue;
        }
        // 常规条件
        conditions.push(w.sql.replace('$%IDX%', `$${paramIdx}`));
        params.push(w.value);
        paramIdx++;
      }

      // 处理 OR 子句
      for (const orDef of this._orClauses) {
        const parsed = parseOrFilters(orDef.sql, paramIdx - 1);
        if (parsed.sql !== 'TRUE') {
          conditions.push(parsed.sql);
          params.push(...parsed.values);
          paramIdx += parsed.values.length;
        }
      }

      return conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    };

    // 构建 ORDER BY
    const buildOrderBy = (): string => {
      if (this._orderBy.length === 0) return '';
      const parts = this._orderBy.map(
        o => `${quoteIdent(o.column)} ${o.ascending ? 'ASC' : 'DESC'}`
      );
      return ` ORDER BY ${parts.join(', ')}`;
    };

    // 构建 LIMIT
    const buildLimit = (): string => {
      if (this._limitCount === null) return '';
      return ` LIMIT ${Math.max(0, Math.floor(this._limitCount))}`;
    };

    switch (this._mode) {
      // ---- SELECT ----
      case 'select': {
        const cols = this._countMode && this._headOnly
          ? 'COUNT(*) AS "count"'
          : parseColumns(this._columns);

        const sql = `SELECT ${cols} FROM ${table}${buildWhere()}${buildOrderBy()}${buildLimit()}`;
        return { sql, params };
      }

      // ---- INSERT ----
      case 'insert': {
        if (!this._insertData || Object.keys(this._insertData).length === 0) {
          return { sql: `INSERT INTO ${table} DEFAULT VALUES RETURNING *`, params: [] };
        }
        const keys = Object.keys(this._insertData);
        const cols = keys.map(quoteIdent).join(', ');
        const placeholders = keys.map(() => `$${paramIdx++}`).join(', ');
        const values = keys.map(k => serialzeValue(this._insertData![k]));
        params.push(...values);

        // 如果链式调用了 .select()，使用 RETURNING 指定列
        const returning = this._columns !== '*'
          ? ` RETURNING ${parseColumns(this._columns)}`
          : ' RETURNING *';

        return { sql: `INSERT INTO ${table} (${cols}) VALUES (${placeholders})${returning}`, params };
      }

      // ---- UPDATE ----
      case 'update': {
        if (!this._updateData || Object.keys(this._updateData).length === 0) {
          return { sql: `SELECT 1 WHERE FALSE`, params: [] };
        }
        const setClauses = Object.entries(this._updateData).map(([key, val]) => {
          const placeholder = `$${paramIdx++}`;
          params.push(serialzeValue(val));
          return `${quoteIdent(key)} = ${placeholder}`;
        });
        const setSQL = setClauses.join(', ');

        const where = buildWhere();
        return { sql: `UPDATE ${table} SET ${setSQL}${where}`, params };
      }

      // ---- UPSERT (INSERT ... ON CONFLICT DO UPDATE) ----
      case 'upsert': {
        if (!this._insertData || Object.keys(this._insertData).length === 0) {
          return { sql: `INSERT INTO ${table} DEFAULT VALUES RETURNING *`, params: [] };
        }
        const keys = Object.keys(this._insertData);
        const cols = keys.map(quoteIdent).join(', ');
        const placeholders = keys.map(() => `$${paramIdx++}`).join(', ');
        const values = keys.map(k => serialzeValue(this._insertData![k]));
        params.push(...values);

        // ON CONFLICT 子句
        const conflictCol = this._upsertConflict
          ? `(${quoteIdent(this._upsertConflict)})`
          : '(id)';

        // DO UPDATE SET — 更新所有非冲突列
        const conflictKey = this._upsertConflict || 'id';
        const updateCols = keys.filter(k => k !== conflictKey);
        const updateSet = updateCols.length > 0
          ? updateCols.map(k => `${quoteIdent(k)} = EXCLUDED.${quoteIdent(k)}`).join(', ')
          : `${quoteIdent(keys[0])} = EXCLUDED.${quoteIdent(keys[0])}`;

        return {
          sql: `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT ${conflictCol} DO UPDATE SET ${updateSet} RETURNING *`,
          params,
        };
      }

      // ---- DELETE ----
      case 'delete': {
        const where = buildWhere();
        return { sql: `DELETE FROM ${table}${where}`, params };
      }

      default:
        return { sql: `SELECT 1 WHERE FALSE`, params: [] };
    }
  }

  // ==================== 终结操作（执行 SQL） ====================

  /**
   * 执行构建好的 SQL 并返回结果
   */
  private async execute(): Promise<DbResult<T>> {
    try {
      const pool = await this._poolPromise;
      const { sql, params } = this.buildSQL();

      // 调试日志（生产环境可注释）
      if (process.env.NODE_ENV === 'development') {
        console.log(`[PostgresAdapter] SQL: ${sql}`);
        console.log(`[PostgresAdapter] Params: ${JSON.stringify(params)}`);
      }

      const result = await pool.query(sql, params);

      // COUNT 模式
      if (this._countMode && this._headOnly) {
        const count = parseInt(result.rows[0]?.count ?? '0', 10);
        return { data: null, error: null, count };
      }

      return { data: result.rows as T[], error: null, count: result.rowCount };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errCode = err instanceof Error ? (err as unknown as Record<string, unknown>).code as string : undefined;
      const errDetail = err instanceof Error ? (err as unknown as Record<string, unknown>).detail as string : undefined;
      console.error(`[PostgresAdapter] SQL 执行失败:`, errMsg);
      return {
        data: null,
        error: { message: errMsg, code: errCode, details: errDetail },
      };
    }
  }

  async maybeSingle(): Promise<DbSingleResult<T>> {
    // maybeSingle 限制最多 1 条
    this._limitCount = this._limitCount ?? 1;
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    const row = result.data && result.data.length > 0 ? result.data[0] : null;
    return { data: row as T | null, error: null };
  }

  async single(): Promise<DbSingleResult<T>> {
    this._limitCount = this._limitCount ?? 1;
    const result = await this.execute();
    if (result.error) return { data: null as any, error: result.error };
    if (!result.data || result.data.length === 0) {
      return {
        data: null as T | null,
        error: { message: `在 ${this._table} 中未找到记录`, code: 'PGRST116' },
      };
    }
    return { data: result.data[0] as T, error: null };
  }

  then<TResult1 = DbResult<T>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

// ==================== 值序列化 ====================

/**
 * 将 JS 值序列化为 PostgreSQL 兼容格式
 * - 对象/数组 → JSON 字符串（PostgreSQL JSONB 列接受文本输入）
 * - null/undefined → null
 * - 其他 → 原值
 */
function serialzeValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'object' && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
}

// ==================== 适配器实现 ====================

/**
 * PostgreSQL 原生数据库适配器
 *
 * 使用方式与 SupabaseAdapter 完全一致：
 * ```typescript
 * const db = new PostgresAdapter('postgresql://user:pass@localhost:5432/novoscan');
 * const { data } = await db.from('innovations').select('*').eq('id', 1);
 * await db.from('innovations').insert({ keyword: 'test' }).select('id').single();
 * await db.from('innovation_dna').upsert({ ... }, { onConflict: 'query_hash' });
 * ```
 */
export class PostgresAdapter implements IDatabase {
  private connectionString: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg 包无导出 Pool 类型
  private pool: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg Pool Promise 类型
  private poolPromise: Promise<any> | null = null;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  /**
   * 延迟初始化连接池（单例 Promise）
   * 避免在模块加载时就建立连接，同时保证并发安全
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pg Pool 类型无法静态推断
  private getPool(): Promise<any> {
    if (!this.poolPromise) {
      this.poolPromise = (async () => {
        if (!this.pool) {
          try {
            // 使用 eval 动态加载 pg 包，完全绕过 webpack 静态分析
            // eslint-disable-next-line no-eval
            const pgModule = eval("require('pg')");
            this.pool = new pgModule.Pool({
              connectionString: this.connectionString,
              max: 10,             // 最大连接数
              idleTimeoutMillis: 30000,  // 空闲连接超时
              connectionTimeoutMillis: 5000,  // 连接超时
            });
            console.log('[PostgresAdapter] ✅ 连接池已初始化');
          } catch {
            console.error('[PostgresAdapter] 请安装 pg 包: npm install pg @types/pg');
            throw new Error('pg 包未安装，无法使用 PostgreSQL 原生适配器');
          }
        }
        return this.pool;
      })();
    }
    return this.poolPromise;
  }

  from<T = any>(table: string): IQueryBuilder<T> {
    return new PostgresQueryBuilder<T>(table, this.getPool());
  }

  async rpc(functionName: string, params?: Record<string, unknown>): Promise<{ data: unknown; error: DbError | null }> {
    try {
      const pool = await this.getPool();
      // 构建 SELECT * FROM function_name($1, $2, ...)
      const keys = params ? Object.keys(params) : [];
      const values = keys.map(k => params![k]);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const sql = keys.length > 0
        ? `SELECT * FROM ${quoteIdent(functionName)}(${placeholders})`
        : `SELECT * FROM ${quoteIdent(functionName)}()`;

      const result = await pool.query(sql, values);
      return { data: result.rows, error: null };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errCode = err instanceof Error ? (err as unknown as Record<string, unknown>).code as string : undefined;
      return {
        data: null,
        error: { message: errMsg, code: errCode },
      };
    }
  }
}
