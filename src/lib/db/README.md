# Novoscan 数据库 SDK — 开发者指南

## 架构总览

```
src/lib/db/
├── IDatabase.ts          # 核心接口定义
├── NoopAdapter.ts        # 空操作适配器（默认）
├── MemoryAdapter.ts      # 内存缓存适配器（进程级持久化）
├── SqliteAdapter.ts      # SQLite 适配器（单机部署）
├── PostgresAdapter.ts    # PostgreSQL 原生适配器
├── SupabaseAdapter.ts    # Supabase 适配器
└── factory.ts            # 工厂 + 注册制
```

## 快速开始

### 选择数据库后端

在 `.env` 中设置 `DATABASE_PROVIDER`：

| 值 | 说明 | 依赖 |
|---|---|---|
| `noop` | 默认，不使用数据库 | 无 |
| `memory` | 内存存储，进程重启即清空 | 无 |
| `sqlite` | SQLite 本地文件数据库 | `npm install better-sqlite3` |
| `postgres` | PostgreSQL 原生 | `npm install pg` |
| `supabase` | Supabase 托管 | `@supabase/supabase-js` |

### 在代码中使用

```typescript
import { db, adminDb } from '@/lib/db/factory';

// 查询
const { data, error } = await db
  .from('innovations')
  .select('keyword, novelty_score')
  .gte('novelty_score', 80)
  .order('novelty_score', { ascending: false })
  .limit(10);

// 写入（管理员权限）
const { error: insertErr } = await adminDb
  .from('innovations')
  .insert({ keyword: 'AI Agent', novelty_score: 95, category: 'AI' });

// 更新
await adminDb
  .from('innovations')
  .update({ search_count: 42 })
  .eq('id', 1);

// 删除
await adminDb.from('innovations').delete().eq('id', 1);
```

---

## 实现自定义适配器

### 步骤 1：实现 IDatabase 接口

```typescript
// src/lib/db/MySQLAdapter.ts
import type { IDatabase, IQueryBuilder, DbResult, DbSingleResult } from './IDatabase';

class MySQLQueryBuilder<T = any> implements IQueryBuilder<T> {
  private table: string;
  private connection: any;
  
  // 收集链式调用的查询条件
  private _columns = '*';
  private _wheres: Array<{ column: string; op: string; value: unknown }> = [];
  private _orderBy: Array<{ column: string; ascending: boolean }> = [];
  private _limitCount: number | null = null;

  constructor(table: string, connection: any) {
    this.table = table;
    this.connection = connection;
  }

  select(columns?: string): IQueryBuilder<T> {
    this._columns = columns || '*';
    return this;
  }

  eq(column: string, value: unknown): IQueryBuilder<T> {
    this._wheres.push({ column, op: '=', value });
    return this;
  }

  // ... 实现其余过滤/排序/写入方法 ...

  async then<TResult1 = DbResult<T>>(
    onfulfilled?: ((value: DbResult<T>) => TResult1) | null,
    onrejected?: ((reason: any) => any) | null
  ): Promise<TResult1> {
    // 在这里构建 SQL 并执行
    const sql = this.buildSQL();
    try {
      const [rows] = await this.connection.execute(sql.text, sql.params);
      const result: DbResult<T> = { data: rows, error: null };
      return onfulfilled ? onfulfilled(result) : result as any;
    } catch (err: any) {
      const result: DbResult<T> = { data: null, error: { message: err.message } };
      return onfulfilled ? onfulfilled(result) : result as any;
    }
  }

  private buildSQL() { /* ... */ }
}

export class MySQLAdapter implements IDatabase {
  private connection: any;

  constructor(connectionUrl: string) {
    // 初始化 MySQL 连接
    const mysql = require('mysql2/promise');
    this.connection = mysql.createPool(connectionUrl);
  }

  from<T = any>(table: string): IQueryBuilder<T> {
    return new MySQLQueryBuilder<T>(table, this.connection);
  }
}
```

### 步骤 2：注册适配器

```typescript
// src/lib/db/custom-init.ts
import { registerDatabaseAdapter } from '@/lib/db/factory';
import { MySQLAdapter } from './MySQLAdapter';

registerDatabaseAdapter('mysql', () => new MySQLAdapter(process.env.MYSQL_URL!));
```

### 步骤 3：配置环境变量

```env
DATABASE_PROVIDER=mysql
MYSQL_URL=mysql://user:password@localhost:3306/novoscan
```

---

## IQueryBuilder 方法参考

### 过滤操作

| 方法 | 说明 | 示例 |
|------|------|------|
| `eq(col, val)` | 精确等于 | `.eq('id', 1)` |
| `neq(col, val)` | 不等于 | `.neq('status', 'deleted')` |
| `gt(col, val)` | 大于 | `.gt('score', 80)` |
| `gte(col, val)` | 大于等于 | `.gte('score', 80)` |
| `lt(col, val)` | 小于 | `.lt('score', 20)` |
| `lte(col, val)` | 小于等于 | `.lte('score', 20)` |
| `ilike(col, pattern)` | 模糊匹配 | `.ilike('name', '%AI%')` |
| `in(col, values)` | IN 查询 | `.in('id', [1, 2, 3])` |
| `match(query)` | 多字段精确匹配 | `.match({ status: 'active', type: 'A' })` |
| `contains(col, val)` | 数组包含 | `.contains('tags', ['AI'])` |
| `textSearch(col, q)` | 全文检索 | `.textSearch('content', 'machine learning')` |
| `or(filters)` | OR 组合 | `.or('status.eq.active,status.eq.pending')` |

### 排序与分页

| 方法 | 说明 |
|------|------|
| `order(col, { ascending })` | 排序 |
| `limit(count)` | 限制返回条数 |

### 写入操作

| 方法 | 说明 |
|------|------|
| `insert(data)` | 插入 |
| `update(data)` | 更新（需配合 filter） |
| `upsert(data, { onConflict })` | 有则更新、无则插入 |
| `delete()` | 删除（需配合 filter） |

### 终结操作

| 方法 | 说明 |
|------|------|
| `await builder` | 返回 `{ data: T[], error }` |
| `.single()` | 返回 `{ data: T, error }`（必须有且仅有一条） |
| `.maybeSingle()` | 返回 `{ data: T \| null, error }`（零或一条） |

---

## 注意事项

- `then()` 方法使 QueryBuilder 成为 PromiseLike，支持直接 `await`
- 所有写入操作必须通过 `adminDb`，`db` 在 Supabase 模式下受 RLS 限制
- 自定义适配器不需要实现 `rpc()` 方法（标记为可选）
- 内存适配器的数据在进程重启后清空，适合开发测试
