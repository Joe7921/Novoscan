/**
 * MemoryAdapter — 内存缓存数据库适配器
 *
 * 在进程生命周期内将数据存储在内存 Map 中。
 * 支持基本的 CRUD 操作、过滤、排序和分页。
 *
 * 适用场景：
 *   - 开发测试（无需安装数据库）
 *   - 演示部署（数据在进程重启后清空）
 *   - 单元测试 Mock
 *
 * 设置 DATABASE_PROVIDER=memory 启用。
 */

import type { IDatabase, IQueryBuilder, DbResult, DbSingleResult, DbError } from './IDatabase';

/** 全局内存存储：table -> rows[] */
const memoryStore = new Map<string, Record<string, any>[]>();
let _autoId = 1;

/** 获取或创建表 */
function getTable(name: string): Record<string, any>[] {
  if (!memoryStore.has(name)) {
    memoryStore.set(name, []);
  }
  return memoryStore.get(name)!;
}

// ==================== 查询构建器 ====================

class MemoryQueryBuilder<T = any> implements IQueryBuilder<T> {
  private _table: string;
  private _mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private _columns: string = '*';
  private _filters: Array<(row: Record<string, any>) => boolean> = [];
  private _orderBy: Array<{ column: string; ascending: boolean }> = [];
  private _limitCount: number | null = null;
  private _insertData: Record<string, any> | Record<string, any>[] | null = null;
  private _updateData: Record<string, any> | null = null;
  private _upsertConflict: string | null = null;

  constructor(table: string) {
    this._table = table;
  }

  select(columns?: string, _options?: { count?: 'exact'; head?: boolean }): IQueryBuilder<T> {
    this._columns = columns || '*';
    return this;
  }

  // ---- 过滤操作 ----
  eq(column: string, value: unknown): IQueryBuilder<T> {
    this._filters.push(row => row[column] === value);
    return this;
  }
  neq(column: string, value: unknown): IQueryBuilder<T> {
    this._filters.push(row => row[column] !== value);
    return this;
  }
  gt(column: string, value: unknown): IQueryBuilder<T> {
    this._filters.push(row => row[column] > (value as number));
    return this;
  }
  gte(column: string, value: unknown): IQueryBuilder<T> {
    this._filters.push(row => row[column] >= (value as number));
    return this;
  }
  lt(column: string, value: unknown): IQueryBuilder<T> {
    this._filters.push(row => row[column] < (value as number));
    return this;
  }
  lte(column: string, value: unknown): IQueryBuilder<T> {
    this._filters.push(row => row[column] <= (value as number));
    return this;
  }
  ilike(column: string, pattern: string): IQueryBuilder<T> {
    const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i');
    this._filters.push(row => regex.test(String(row[column] ?? '')));
    return this;
  }
  contains(column: string, value: unknown): IQueryBuilder<T> {
    this._filters.push(row => {
      const arr = row[column];
      if (!Array.isArray(arr) || !Array.isArray(value)) return false;
      return (value as unknown[]).every(v => arr.includes(v));
    });
    return this;
  }
  textSearch(column: string, query: string, _options?: { type?: string }): IQueryBuilder<T> {
    const words = query.toLowerCase().split(/\s+/);
    this._filters.push(row => {
      const text = String(row[column] ?? '').toLowerCase();
      return words.every(w => text.includes(w));
    });
    return this;
  }
  or(filters: string): IQueryBuilder<T> {
    // 解析简单格式: 'col1.eq.val1,col2.eq.val2'
    const parts = filters.split(',');
    const orFns: Array<(row: Record<string, any>) => boolean> = [];
    for (const part of parts) {
      const [col, op, ...valParts] = part.trim().split('.');
      const val = valParts.join('.');
      if (op === 'eq') orFns.push(row => String(row[col]) === val);
      else if (op === 'neq') orFns.push(row => String(row[col]) !== val);
      else if (op === 'gt') orFns.push(row => row[col] > Number(val));
      else if (op === 'gte') orFns.push(row => row[col] >= Number(val));
      else if (op === 'lt') orFns.push(row => row[col] < Number(val));
      else if (op === 'lte') orFns.push(row => row[col] <= Number(val));
      else if (op === 'ilike') {
        const regex = new RegExp(val.replace(/%/g, '.*'), 'i');
        orFns.push(row => regex.test(String(row[col] ?? '')));
      }
    }
    if (orFns.length > 0) {
      this._filters.push(row => orFns.some(fn => fn(row)));
    }
    return this;
  }
  in(column: string, values: unknown[]): IQueryBuilder<T> {
    this._filters.push(row => values.includes(row[column]));
    return this;
  }
  match(query: Record<string, unknown>): IQueryBuilder<T> {
    for (const [col, val] of Object.entries(query)) {
      this._filters.push(row => row[col] === val);
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

  // ---- 终结操作 ----
  private execute(): DbResult<T> {
    const table = getTable(this._table);

    switch (this._mode) {
      case 'insert': {
        const rows = Array.isArray(this._insertData) ? this._insertData : [this._insertData!];
        const inserted: Record<string, any>[] = [];
        for (const row of rows) {
          const newRow = { id: _autoId++, created_at: new Date().toISOString(), ...row };
          table.push(newRow);
          inserted.push(newRow);
        }
        return { data: inserted as T[], error: null };
      }
      case 'update': {
        const updated: Record<string, any>[] = [];
        for (const row of table) {
          if (this._filters.every(fn => fn(row))) {
            Object.assign(row, this._updateData, { updated_at: new Date().toISOString() });
            updated.push(row);
          }
        }
        return { data: updated as T[], error: null };
      }
      case 'upsert': {
        const rows = Array.isArray(this._insertData) ? this._insertData : [this._insertData!];
        const result: Record<string, any>[] = [];
        const conflictKey = this._upsertConflict || 'id';
        for (const row of rows) {
          const existing = table.find(r => r[conflictKey] === row[conflictKey]);
          if (existing) {
            Object.assign(existing, row, { updated_at: new Date().toISOString() });
            result.push(existing);
          } else {
            const newRow = { id: _autoId++, created_at: new Date().toISOString(), ...row };
            table.push(newRow);
            result.push(newRow);
          }
        }
        return { data: result as T[], error: null };
      }
      case 'delete': {
        const toRemove: number[] = [];
        for (let i = table.length - 1; i >= 0; i--) {
          if (this._filters.every(fn => fn(table[i]))) {
            toRemove.push(i);
          }
        }
        const deleted: Record<string, any>[] = [];
        for (const idx of toRemove) {
          deleted.push(...table.splice(idx, 1));
        }
        return { data: deleted as T[], error: null };
      }
      case 'select':
      default: {
        let results = table.filter(row => this._filters.every(fn => fn(row)));

        // 排序
        for (const { column, ascending } of [...this._orderBy].reverse()) {
          results.sort((a, b) => {
            const va = a[column], vb = b[column];
            if (va < vb) return ascending ? -1 : 1;
            if (va > vb) return ascending ? 1 : -1;
            return 0;
          });
        }

        // 分页
        if (this._limitCount !== null) {
          results = results.slice(0, this._limitCount);
        }

        // 列选择
        if (this._columns !== '*') {
          const cols = this._columns.split(',').map(c => c.trim());
          results = results.map(row => {
            const picked: Record<string, any> = {};
            for (const col of cols) picked[col] = row[col];
            return picked;
          });
        }

        return { data: results as T[], error: null, count: results.length };
      }
    }
  }

  async maybeSingle(): Promise<DbSingleResult<T>> {
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
 * 内存数据库适配器
 *
 * 将数据存储在进程内存中，支持完整的 CRUD + 过滤 + 排序。
 * 数据在进程重启后清空。适合开发测试和演示。
 */
export class MemoryAdapter implements IDatabase {
  private _logged = false;

  from<T = any>(table: string): IQueryBuilder<T> {
    if (!this._logged) {
      this._logged = true;
      console.info('[DB] 使用内存数据库（DATABASE_PROVIDER=memory），数据在进程重启后清空。');
    }
    return new MemoryQueryBuilder<T>(table);
  }

  async rpc(_functionName: string, _params?: Record<string, unknown>): Promise<{ data: unknown; error: DbError | null }> {
    return { data: null, error: { message: '内存适配器不支持 rpc 调用' } };
  }

  /** 清空所有表数据（用于测试） */
  static clear(): void {
    memoryStore.clear();
    _autoId = 1;
  }

  /** 获取内存中的表数据（用于调试） */
  static dump(): Record<string, Record<string, any>[]> {
    const result: Record<string, Record<string, any>[]> = {};
    memoryStore.forEach((rows, table) => { result[table] = [...rows]; });
    return result;
  }
}
