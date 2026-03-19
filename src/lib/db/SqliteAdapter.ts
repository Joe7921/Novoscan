/**
 * SqliteAdapter — SQLite 数据库适配器
 *
 * 使用 better-sqlite3 实现 IDatabase 接口。
 * SQLite 是嵌入式数据库，无需额外服务器进程。
 *
 * 适用场景：
 *   - 单机部署（数据存储在本地文件）
 *   - 边缘计算 / IoT 场景
 *   - 快速原型开发
 *
 * 依赖安装：npm install better-sqlite3
 * 设置 DATABASE_PROVIDER=sqlite 和 SQLITE_PATH=./data/novoscan.db
 */

import type { IDatabase, IQueryBuilder, DbResult, DbSingleResult, DbError } from './IDatabase';

// better-sqlite3 类型（延迟加载，避免未安装时编译失败）
type BetterSqlite3Database = any;

/** 辅助：将标识符用双引号包裹防止 SQL 注入 */
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// ==================== 查询构建器 ====================

type OperationMode = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

interface WhereClause {
  sql: string;
  values: unknown[];
}

class SqliteQueryBuilder<T = any> implements IQueryBuilder<T> {
  private _db: BetterSqlite3Database;
  private _table: string;
  private _mode: OperationMode = 'select';
  private _columns: string = '*';
  private _countMode: boolean = false;
  private _wheres: WhereClause[] = [];
  private _orderBy: Array<{ column: string; ascending: boolean }> = [];
  private _limitCount: number | null = null;
  private _insertData: Record<string, any> | Record<string, any>[] | null = null;
  private _updateData: Record<string, any> | null = null;
  private _upsertConflict: string | null = null;

  constructor(db: BetterSqlite3Database, table: string) {
    this._db = db;
    this._table = table;
  }

  select(columns?: string, options?: { count?: 'exact'; head?: boolean }): IQueryBuilder<T> {
    this._columns = columns || '*';
    if (options?.count === 'exact') this._countMode = true;
    return this;
  }

  // ---- 过滤 ----
  eq(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} = ?`, values: [value] });
    return this;
  }
  neq(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} != ?`, values: [value] });
    return this;
  }
  gt(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} > ?`, values: [value] });
    return this;
  }
  gte(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} >= ?`, values: [value] });
    return this;
  }
  lt(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} < ?`, values: [value] });
    return this;
  }
  lte(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ sql: `${quoteIdent(column)} <= ?`, values: [value] });
    return this;
  }
  ilike(column: string, pattern: string): IQueryBuilder<T> {
    // SQLite 的 LIKE 本身不区分大小写（对 ASCII 字符）
    this._wheres.push({ sql: `${quoteIdent(column)} LIKE ?`, values: [pattern] });
    return this;
  }
  contains(column: string, value: unknown): IQueryBuilder<T> {
    // SQLite 没有原生数组类型，使用 JSON 函数
    if (Array.isArray(value)) {
      for (const v of value) {
        this._wheres.push({
          sql: `EXISTS (SELECT 1 FROM json_each(${quoteIdent(column)}) WHERE json_each.value = ?)`,
          values: [v],
        });
      }
    }
    return this;
  }
  textSearch(column: string, query: string, _options?: { type?: string }): IQueryBuilder<T> {
    // 简单全文搜索：用 LIKE 模拟
    const words = query.split(/\s+/).filter(Boolean);
    for (const word of words) {
      this._wheres.push({ sql: `${quoteIdent(column)} LIKE ?`, values: [`%${word}%`] });
    }
    return this;
  }
  or(filters: string): IQueryBuilder<T> {
    // 解析 'col1.eq.val1,col2.eq.val2' 格式
    const parts = filters.split(',');
    const conditions: string[] = [];
    const values: unknown[] = [];
    for (const part of parts) {
      const [col, op, ...valParts] = part.trim().split('.');
      const val = valParts.join('.');
      switch (op) {
        case 'eq': conditions.push(`${quoteIdent(col)} = ?`); values.push(val); break;
        case 'neq': conditions.push(`${quoteIdent(col)} != ?`); values.push(val); break;
        case 'gt': conditions.push(`${quoteIdent(col)} > ?`); values.push(Number(val)); break;
        case 'gte': conditions.push(`${quoteIdent(col)} >= ?`); values.push(Number(val)); break;
        case 'lt': conditions.push(`${quoteIdent(col)} < ?`); values.push(Number(val)); break;
        case 'lte': conditions.push(`${quoteIdent(col)} <= ?`); values.push(Number(val)); break;
        case 'ilike': conditions.push(`${quoteIdent(col)} LIKE ?`); values.push(val); break;
      }
    }
    if (conditions.length > 0) {
      this._wheres.push({ sql: `(${conditions.join(' OR ')})`, values });
    }
    return this;
  }
  in(column: string, values: unknown[]): IQueryBuilder<T> {
    if (values.length === 0) {
      this._wheres.push({ sql: '0', values: [] }); // 永假
    } else {
      const placeholders = values.map(() => '?').join(', ');
      this._wheres.push({ sql: `${quoteIdent(column)} IN (${placeholders})`, values });
    }
    return this;
  }
  match(query: Record<string, unknown>): IQueryBuilder<T> {
    for (const [col, val] of Object.entries(query)) {
      this._wheres.push({ sql: `${quoteIdent(col)} = ?`, values: [val] });
    }
    return this;
  }

  // ---- 排序与分页 ----
  order(column: string, options?: { ascending?: boolean }): IQueryBuilder<T> {
    this._orderBy.push({ column, ascending: options?.ascending ?? true });
    return this;
  }
  limit(count: number): IQueryBuilder<T> {
    this._limitCount = count;
    return this;
  }

  // ---- 写入操作 ----
  insert(data: Record<string, any> | Record<string, any>[]): IQueryBuilder<T> {
    this._mode = 'insert';
    this._insertData = data;
    return this;
  }
  update(data: Record<string, any>): IQueryBuilder<T> {
    this._mode = 'update';
    this._updateData = data;
    return this;
  }
  upsert(data: Record<string, any> | Record<string, any>[], options?: { onConflict?: string }): IQueryBuilder<T> {
    this._mode = 'upsert';
    this._insertData = data;
    this._upsertConflict = options?.onConflict || 'id';
    return this;
  }
  delete(): IQueryBuilder<T> {
    this._mode = 'delete';
    return this;
  }

  // ---- 构建 SQL ----
  private buildWhere(): { sql: string; params: unknown[] } {
    if (this._wheres.length === 0) return { sql: '', params: [] };
    const conditions = this._wheres.map(w => w.sql);
    const params = this._wheres.flatMap(w => w.values);
    return { sql: ` WHERE ${conditions.join(' AND ')}`, params };
  }

  private execute(): DbResult<T> {
    const table = quoteIdent(this._table);
    const where = this.buildWhere();

    try {
      switch (this._mode) {
        case 'insert': {
          const rows = Array.isArray(this._insertData) ? this._insertData : [this._insertData!];
          const inserted: Record<string, any>[] = [];
          for (const row of rows) {
            // 数组和对象类型序列化为 JSON
            const processed: Record<string, any> = {};
            for (const [k, v] of Object.entries(row)) {
              processed[k] = (Array.isArray(v) || (typeof v === 'object' && v !== null)) ? JSON.stringify(v) : v;
            }
            const cols = Object.keys(processed);
            const placeholders = cols.map(() => '?').join(', ');
            const sql = `INSERT INTO ${table} (${cols.map(quoteIdent).join(', ')}) VALUES (${placeholders})`;
            const stmt = this._db.prepare(sql);
            const info = stmt.run(...Object.values(processed));
            inserted.push({ ...row, id: info.lastInsertRowid });
          }
          return { data: inserted as T[], error: null };
        }
        case 'update': {
          const sets = Object.entries(this._updateData!).map(([k]) => `${quoteIdent(k)} = ?`);
          const setValues = Object.values(this._updateData!).map(v =>
            (Array.isArray(v) || (typeof v === 'object' && v !== null)) ? JSON.stringify(v) : v
          );
          const sql = `UPDATE ${table} SET ${sets.join(', ')}${where.sql}`;
          this._db.prepare(sql).run(...setValues, ...where.params);
          return { data: null, error: null };
        }
        case 'upsert': {
          const rows = Array.isArray(this._insertData) ? this._insertData : [this._insertData!];
          for (const row of rows) {
            const processed: Record<string, any> = {};
            for (const [k, v] of Object.entries(row)) {
              processed[k] = (Array.isArray(v) || (typeof v === 'object' && v !== null)) ? JSON.stringify(v) : v;
            }
            const cols = Object.keys(processed);
            const placeholders = cols.map(() => '?').join(', ');
            const updates = cols.filter(c => c !== this._upsertConflict).map(c => `${quoteIdent(c)} = excluded.${quoteIdent(c)}`);
            const sql = `INSERT INTO ${table} (${cols.map(quoteIdent).join(', ')}) VALUES (${placeholders})` +
              (updates.length > 0 ? ` ON CONFLICT(${quoteIdent(this._upsertConflict!)}) DO UPDATE SET ${updates.join(', ')}` : '');
            this._db.prepare(sql).run(...Object.values(processed));
          }
          return { data: null, error: null };
        }
        case 'delete': {
          const sql = `DELETE FROM ${table}${where.sql}`;
          this._db.prepare(sql).run(...where.params);
          return { data: null, error: null };
        }
        case 'select':
        default: {
          let sql = `SELECT ${this._columns} FROM ${table}${where.sql}`;
          if (this._orderBy.length > 0) {
            const orderClauses = this._orderBy.map(o => `${quoteIdent(o.column)} ${o.ascending ? 'ASC' : 'DESC'}`);
            sql += ` ORDER BY ${orderClauses.join(', ')}`;
          }
          if (this._limitCount !== null) sql += ` LIMIT ${this._limitCount}`;

          const rows = this._db.prepare(sql).all(...where.params);

          // 反序列化 JSON 字段
          const parsed = rows.map((row: Record<string, any>) => {
            const result: Record<string, any> = {};
            for (const [k, v] of Object.entries(row)) {
              if (typeof v === 'string' && (v.startsWith('[') || v.startsWith('{'))) {
                try { result[k] = JSON.parse(v); } catch { result[k] = v; }
              } else {
                result[k] = v;
              }
            }
            return result;
          });

          let count: number | undefined;
          if (this._countMode) {
            const countSql = `SELECT COUNT(*) as cnt FROM ${table}${where.sql}`;
            const countRow = this._db.prepare(countSql).get(...where.params) as { cnt: number };
            count = countRow?.cnt ?? 0;
          }

          return { data: parsed as T[], error: null, count };
        }
      }
    } catch (err: any) {
      return { data: null, error: { message: err.message, code: err.code } };
    }
  }

  // ---- 终结操作 ----
  async maybeSingle(): Promise<DbSingleResult<T>> {
    this._limitCount = 1;
    const result = this.execute();
    const first = result.data && result.data.length > 0 ? result.data[0] : null;
    return { data: first, error: result.error };
  }

  async single(): Promise<DbSingleResult<T>> {
    const result = this.execute();
    if (!result.data || result.data.length === 0) {
      return { data: null, error: { message: 'Row not found' } };
    }
    if (result.data.length > 1) {
      return { data: null, error: { message: 'Multiple rows found, expected single' } };
    }
    return { data: result.data[0], error: null };
  }

  then<TResult1 = DbResult<T>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const result = this.execute();
      return Promise.resolve(result).then(onfulfilled, onrejected);
    } catch (err) {
      return Promise.reject(err).then(null, onrejected) as Promise<TResult2>;
    }
  }
}

// ==================== 适配器 ====================

/**
 * SQLite 数据库适配器
 *
 * 使用 better-sqlite3（同步 API，性能优异）。
 * 数据存储在本地文件中，支持 WAL 模式提升并发性能。
 */
export class SqliteAdapter implements IDatabase {
  private _db: BetterSqlite3Database;

  constructor(dbPath: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    this._db = new Database(dbPath);
    // 开启 WAL 模式提升并发性能
    this._db.pragma('journal_mode = WAL');
    console.info(`[DB] SQLite 已连接: ${dbPath}`);
  }

  from<T = any>(table: string): IQueryBuilder<T> {
    return new SqliteQueryBuilder<T>(this._db, table);
  }

  async rpc(_functionName: string, _params?: Record<string, unknown>): Promise<{ data: unknown; error: DbError | null }> {
    return { data: null, error: { message: 'SQLite 不支持 rpc 调用' } };
  }

  /** 执行原始 SQL（用于建表等场景） */
  exec(sql: string): void {
    this._db.exec(sql);
  }

  /** 关闭数据库连接 */
  close(): void {
    this._db.close();
  }
}
