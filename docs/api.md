# 核心接口文档 (API Reference)

本文档归纳了 Novoscan-Next 内部的核心代码调用接口与流数据状态接口，重点围绕系统调度中心 (Orchestrator) 与专家智能体 (Agent) 的执行标准。

## 1. 核心数据类型定义 (`types.ts`)

所有 Agent 输出与 Orchestrator 的最终聚合报告均遵循严格的 TypeScript 接口校验：

```typescript
// 多维评分结果接口
export interface MultiDimensionalScore {
  technicalReadiness: number; // 技术成熟度雷达轴
  marketPotential: number;    // 市场潜力雷达轴
  academicImpact: number;     // 学术影响力雷达轴
  innovationLevel: number;    // 综合创新评级
}

// 报告聚合核心接口
export interface AnalysisReport {
  id: string;                 // 任务追踪 UUID
  topic: string;              // 目标关键词/标的
  status: 'working' | 'completed' | 'error' | 'partial';
  score: MultiDimensionalScore;
  summary: string;            // 系统执行总结
  sources: Source[];          // 可溯源的参考网页与论文数据记录
}
```

## 2. 调度层核心接口 (Orchestrator Layer)

### `runWorkflow(topic: string, options?: WorkflowOptions): AsyncGenerator<AgentState, AnalysisReport, unknown>`

**说明**: Orchestrator 对外暴露的最核心运行流函数，负责发起全部智算网络链路并返回流式状态更新特征。前端 UI 采用 Async Iterator（异步迭代）模式逐帧渲染 Agent 各阶段思考进度。

- **参数**:
  - `topic`: `string` —— 用户探索的目标概念或专业名词。
  - `options`: 附加配置项，支持超时调整、强制刷新外部搜索引擎缓存等宏观执行参数。
- **返回**: 一个封装的 `AsyncGenerator`，在执行周期内多次 `yield` 出包含进度变更的 `AgentState` 碎片，最终通过 `return` 完整闭合的 `AnalysisReport` 对象实体。

**Layer1 错开启动（Staggered Start）**：为避免 4 个 Agent 同时打到 AI API 触发瞬时限流，Layer1 的 4 个 Agent 以 500ms 间隔依次启动：学术审查员(0ms) → 产业分析员(+500ms) → 竞品侦探(+1000ms) → 跨域侦察兵(+1500ms)。

## 3. 标准智能体抽象基座 (Base Agent Interface)

为确保系统的高拓展空间与插件化开发，架构中全部 Agent 都被要求实现统一的高维抽象逻辑：

```typescript
export interface AgentResponse {
  confidence: number;       // 当前推理结论的系统置信水平
  findings: string[];       // 提炼分条核心发现
  rawContext: any;          // 外围检索留存备份，供用户点击溯源证据链展示
}

export abstract class BaseAgent {
  abstract name: string;
  abstract description: string;

  /**
   * 触发执行核心推理
   * @param topic 查询主体特征
   * @param context 承载上下游参数传递跨域历史记录上下文（主要用于破除维度隔离障碍冷启动）
   */
  abstract analyze(topic: string, context: AgentContext): Promise<AgentResponse>;
}
```

## 4. NovoMind API (`/api/novomind`)

**说明**: 对话式创新人格评测系统的后端 API。采用**三代理架构**：访谈代理（前台对话）、BARS 评估代理（五维量化）、IDEA 评估代理（四维人格原型）。

**请求方法**: `POST`

### 核心请求参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `action` | `string` | 动作类型（见下表） |
| `messages` | `ChatMessage[]` | 对话历史记录（部分 action 需要） |
| `roundNumber` | `number` | 当前轮次（chat 时需要） |

### Action 一览

| Action | 功能 | 依赖参数 |
|--------|------|---------|
| `generate-opener` | 生成动态开场白（万人通用，不预设身份） | 无 |
| `chat` | 调用访谈代理，生成下一轮追问 | `messages`, `roundNumber` |
| `evaluate` | BARS 五维评估（认知开放度/破局重构力/模糊容忍度/创新内驱力/落地执行力） | `messages` |
| `evaluate-idea` | IDEA 四维评估（信息摄取/思维定向/执行动能/协作生态）→ 输出 16 型原型 | `messages` |
| `save` | 持久化 BARS 评测结果到 `novomind_assessments` 表 | `assessment` |
| `save-idea` | 持久化 IDEA 画像到 `user_idea_profile` 表（加权合并策略） | `ideaAssessment` |
| `idea-profile` | 获取当前用户的 IDEA 画像 | 无 |
| `divergence` | 生成偏差洞察报告（对话画像 vs 行为画像） | 无 |
| `history` | 获取 BARS 历史评测记录 | 无 |

### 访谈代理（V4 灵活版）

- **动态深度调节**：AI 根据用户回答的深度匹配问题深度，不预设用户身份
- **五维度覆盖保障**：中期轮次自动检查缺失维度并引导话题补全
- **最少 5 轮对话**：前端 `MIN_ROUNDS_FOR_END = 5`，后端 `MIN_ROUNDS = 5`
- **结束信号**：AI 在回复末尾插入 `[ASSESSMENT_READY]` 表示可生成报告

### IDEA 四维人格模型

IDEA 模型基于四个核心维度，每维度双极化评分（0-100）：

| 维度 | 高分极 | 低分极 | 评估焦点 |
|------|--------|--------|---------|
| Input 信息摄取 | V 远见型（跨域扫描） | O 洞察型（垂直深耕） | 兴趣广度、信息获取方式 |
| Direction 思维定向 | D 发散型（多线程探索） | C 收敛型（聚焦精化） | 面对选择时的思维模式 |
| Execution 执行动能 | P 探索型（快速试错） | B 构建型（体系化打磨） | 从想法到行动的路径 |
| Alliance 协作生态 | S 连接者（跨界协作） | I 独行者（深度自主） | 团队中的角色偏好 |

四维度组合产生 **16 种创新人格原型**，分属 4 个族群：

| 族群 | 成员 | 核心特征 |
|------|------|---------|
| 🔥 点火者 | 布道师/发明家/造梦师/哲学家 | 远见驱动，善于开创 |
| 🏛️ 掌舵者 | 指挥官/先锋/元帅/建筑师 | 战略导向，精准执行 |
| 🔍 发现者 | 炼金师/侦探/大使/猎手 | 洞察驱动，善于发现 |
| ⚙️ 守护者 | 操盘手/工匠/总管/督察 | 稳健务实，确保品质 |

### 行为信号收集（`ideaBehaviorService.ts`）

用户在 Novoscan 的日常行为被自动收集并映射到 IDEA 四维度：

| 行为类型 | 信号映射 |
|---------|---------|
| 搜索（跨域长查询） | V 远见 ↑ |
| 搜索（精确短查询） | O 洞察 ↑ |
| 追问（选多个方向） | D 发散 ↑ |
| 追问（深入一个方向） | C 收敛 ↑ |
| 高频搜索 | P 探索 ↑ |
| 多轮精化追问 | B 构建 ↑ |
| 跨产品推荐点击 | S 连接 ↑ |

每 20 个行为数据点解锁**偏差洞察报告**，展示"对话画像 vs 行为画像"的差异。

### 偏差洞察（`ideaDivergenceService.ts`）

当 `behavior_data_points >= 20` 时自动解锁：
- **偏差计算**：`gap = stated_score - behavioral_score`
- **分类**：`|gap| < 10 → ✅一致` / `gap > +10 → ⚠️高估` / `gap < -10 → 💡低估`
- **AI 洞察**：基于偏差数据生成 3 条个性化洞察文案
- **缓存**：报告结果缓存 24 小时，存入 `divergence_report` JSON 字段

## 5. Tracker 健康检查 API (`/api/tracker/health`)

**说明**: NovoTracker 的健康检查端点，返回 Cron 运行状态和监控概览。

**请求方法**: `GET`

**鉴权**: 需要 `CRON_SECRET`（通过 query 参数 `secret` 或 `Authorization: Bearer` 头部传递）

**响应结构**：

```typescript
{
  success: boolean;
  health: {
    status: 'healthy' | 'degraded' | 'critical';  // 综合健康评分
    checkedAt: string;                              // 检查时间
    lastCron: {                                     // 上次 Cron 执行信息
      runAt: string;
      durationMs: number;
      succeeded: number;
      failed: number;
      skipped: number;
    } | null;
    monitors: {
      total: number;      // 活跃监控数
      overdue: number;    // 过期未扫描
      missed48h: number;  // 错过 48h+ 的任务
    };
    overdueList: Array<{ id, query, nextScanAt, lastScanAt, overdueHours }>;
  }
}
```

## 6. DNA Harvester Cron API (`/api/innovation-dna/cron`)

**说明**: 定期从 OpenAlex 抓取各领域高引论文，提取 5 维创新基因向量并入库。

**触发方式**: Vercel Cron（每周一 03:00 UTC），或手动 GET 请求（需 `CRON_SECRET`）

**执行流程**:
1. 搜索预配置的 10+ 领域关键词（AI / 生物技术 / 量子 / 新能源 etc.）
2. 每个领域取 Top 3 高引论文，去重过滤已入库的记录
3. 对新论文调用 AI 提取 5 维 DNA 向量
4. 使用领域分类器自动打标签后入库

## 7. 关键后端逻辑机制说明

1. **依赖切面注入与防耦合调度**: 
   `orchestrator.ts` 不会在内部杂糅或写死针对特定查询领域的 Agent 推理 prompt。系统在初始化阶段收集并挂载至 `Agent[]` 池内，根据阶段特征启动并发 `Promise.allSettled` 层流调度体系。
2. **强制结构化数据守卫 (Structured JSON Output)**: 
   全系底座利用 Google Gemini API 强大的底层 Schema 特性限制，搭配 `QualityGuard` 环节二次正则阻挡约束。以此确保前端页面接收与反序列化表现的安全与稳定性。
3. **双层信号量隔离 (Dual Semaphore)**:
   `ai-client.ts` 内建两个独立信号量实例：主信号量（并发 3）供 Agent 主流程使用，低优先级信号量（并发 1）供 NovoDNA 等非关键路径使用。信号量支持 `AbortSignal`，被编排器超时取消的 Agent 会自动从等待队列中移除。
4. **429/503 限流智能退避**:
   所有 AI 调用（Gemini / DeepSeek / Minimax）在收到 429 或 503 限流响应时，自动解析 `Retry-After` 头部并等待相应时间（上限 10s）后重试，避免无效重试浪费信号量槽位。
5. **仲裁员结论性 Summary**:
   仲裁员 prompt 新增 Step 6 要求以结论判断开头撰写 Summary（如"**推荐（65分）**——该技术..."），禁止逐一转述各专家观点的流水账写法。
