# 架构设计与数据流 (Architecture & Data Flow)

本文档详细描述 Novoscan-Next 的多智能体协作架构、核心技术栈以及数据流向。

## 1. 核心技术栈
- **前端框架**: Next.js 14, React 18, Tailwind CSS, Framer Motion
- **AI基座**: Google Gemini API (`@google/genai`) / DeepSeek V3 / DeepSeek R1
- **外部数据源**: 
  - **学术四源**: OpenAlex / arXiv / CrossRef / CORE
  - **产业三源**: Brave Search / SerpAPI / GitHub API
- **本地存储**: Dexie.js (IndexedDB) 用于持久化 Agent 执行记录与分析历史报告
- **云端存储**: Supabase PostgreSQL 用于创新点、API 日志、用户认证、NovoMind 评测结果
- **定时任务**: Vercel Cron（Tracker 扫描 / DNA 收割 / CaseVault）+ Webhook 通知

## 2. 核心架构图
系统采用四层分层架构设计，确保表现层 UI、Agent 调度逻辑以及底层计算源的完全解耦。

```mermaid
graph TD
    classDef ui fill:#f9f,stroke:#333,stroke-width:2px;
    classDef orchestrator fill:#bbf,stroke:#333,stroke-width:2px;
    classDef agent fill:#dfd,stroke:#333,stroke-width:2px;
    classDef data fill:#fdd,stroke:#333,stroke-width:2px;
    classDef infra fill:#fec,stroke:#333,stroke-width:2px;

    subgraph "1. 表示层 (Presentation Layer)"
        UI[页面组件 - AnalysisView]:::ui
        TI[思考指示器 - ThinkingIndicator]:::ui
        Charts[多维可视化图表 - RadarChart]:::ui
        DNA[NovoDNA 创新基因图谱 - 折叠式]:::ui
        Mind[NovoMind 人格评测 - 对话式]:::ui
    end

    subgraph "2. 调度层 (Orchestration Layer)"
        Orchestrator["Orchestrator 调度中心<br/>(错开启动 + 双层信号量)"]:::orchestrator
        Arbitrator[Arbitrator 仲裁器]:::orchestrator
        QG[Quality Guard 质量守卫]:::orchestrator
    end

    subgraph "3. 智能体层 (Agent Layer)"
        IA[Industry Analyst<br>行业分析师]:::agent
        AR[Academic Reviewer<br>学术研究员]:::agent
        CD[Competitor Detective<br>竞品侦探]:::agent
        IE[Innovation Evaluator<br>创新评估师]:::agent
    end

    subgraph "4. 数据与计算层 (Data/Compute Layer)"
        LLM["AI 模型推理<br/>(Gemini / DeepSeek V3 / R1)"]:::data
        Search["双轨检索<br/>(学术四源 + 产业三源)"]:::data
        DB[(Supabase PostgreSQL)]:::data
        LocalDB[(Dexie.js 本地数据库)]:::data
    end

    subgraph "5. 基建层 (Infrastructure)"
        Cron["Vercel Cron 定时任务"]:::infra
        Webhook["Webhook 通知<br/>(飞书/Slack/企微)"]:::infra
        Health["健康检查端点"]:::infra
        Harvester["DNA Harvester 收割器"]:::infra
    end

    UI -->|用户发起检索指令| Orchestrator
    Orchestrator -->|任务并行分解| IA & AR & CD
    IA & AR & CD <-->|请求外部知识与推理响应| LLM & Search
    IA & AR & CD -->|返回多维度特征数据| Arbitrator
    Arbitrator -->|消除维度冲突| IE
    IE -->|最终评估信息合成| QG
    QG -->|报告最终输出/存储| DB
    QG -->|聚合返回结构化数据| UI

    Mind -->|DeepSeek R1 对话| LLM
    Mind -->|评测结果| DB
    DNA -->|基因向量查询| DB

    Cron -->|定时触发| Harvester
    Harvester -->|高引论文入库| DB
    Cron -->|执行结果| Webhook
    Cron -->|健康状态| Health
```

## 3. Agent 协作时序图

以下时序图展示了一个完整的深度分析任务从用户发起到前端渲染的闭环完整周期：

```mermaid
sequenceDiagram
    actor User as 用户
    participant UI as 前端组件 (UI)
    participant Orch as Orchestrator调度器
    participant Agents as 领域 Agents<br/>(错开启动)
    participant Arb as Arbitrator仲裁器
    participant QG as Quality Guard
    participant API as 双轨检索引擎

    User->>UI: 输入分析关键词 (如 "固态电池")
    UI->>Orch: 发送任务请求 `analyze(topic)`
    activate Orch
    
    Orch->>UI: 返回初始状态流 (任务准备中)
    
    par 并行任务执行（错开 500ms 启动）
        Orch->>Agents: 分发任务 (学术 0ms / 产业 +500ms / 竞品 +1000ms / 跨域 +1500ms)
        activate Agents
        Agents->>API: 检索实时外围数据
        API-->>Agents: 返回 JSON 数据 (新闻/论文资料)
        Agents->>Agents: AI 调用执行推理深度分析（双层信号量控制并发）
        Agents-->>Orch: 返回带有置信度(confidence)与数据链的结果
        deactivate Agents
    end
    
    Orch->>Arb: 提交各 Agent 独立的前期结果
    activate Arb
    Arb->>Arb: 检测观点冲突，融合不同视角边界，撰写结论性 Summary
    Arb-->>Orch: 返回仲裁与去重后的统一观点
    deactivate Arb
    
    Orch->>QG: 提交至 Quality Guard 执行最终校验
    activate QG
    QG-->>Orch: 校验通过，生成最终系统报告模型
    deactivate QG
    
    Orch-->>UI: 返回完整分析对象 (涵盖 MultiDimensionalScore 等)
    deactivate Orch
    
    UI->>User: 动态渲染雷达图与各项指标面板
```

## 4. AI 并发控制架构

```
┌──────────────────────────────────────────────────┐
│                  AI 调用入口 (callAIRaw)          │
│                                                    │
│   priority='high'          priority='low'          │
│        ↓                        ↓                  │
│  ┌────────────┐          ┌────────────┐            │
│  │ 主信号量    │          │ 低优先级    │            │
│  │ max = 3    │          │ 信号量      │            │
│  │            │          │ max = 1    │            │
│  │ Agent 专用  │          │ NovoDNA    │            │
│  └────────────┘          └────────────┘            │
│        ↓                        ↓                  │
│  ┌─────────────────────────────────────────────┐   │
│  │     AbortSignal 深度集成                      │   │
│  │  - 被取消的 Agent 自动从等待队列移除            │   │
│  │  - 429/503 → 解析 Retry-After → 等待后重试    │   │
│  │  - 模型降级链：Gemini → DeepSeek → 重试       │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
## 5. NovoMind 三代理架构

NovoMind 采用三个独立代理协作完成人格评测：

```
┌────────────────────────────────────────────────────────────────────┐
│                     NovoMind 三代理架构                            │
│                                                                    │
│  ┌──────────────┐                                                  │
│  │  访谈代理     │◄──── DeepSeek R1 (reasoning_content 内心独白)   │
│  │  Interviewer  │                                                  │
│  │  • V4 灵活版  │  ────► 对话消息 (5-15轮)                        │
│  │  • 动态深度   │                                                  │
│  │  • 五维覆盖   │                                                  │
│  └──────┬───────┘                                                  │
│         │                                                          │
│         │ [ASSESSMENT_READY] 或用户点击生成报告                     │
│         │                                                          │
│         ▼                                                          │
│  ┌──────────────┐     ┌──────────────┐                             │
│  │  BARS 评估    │     │  IDEA 评估    │  ◄── 并行执行              │
│  │  代理         │     │  代理         │                             │
│  │              │     │              │                             │
│  │  五维量化评分 │     │  四维人格画像 │                             │
│  │  1.0 - 5.0   │     │  0 - 100     │                             │
│  └──────┬───────┘     └──────┬───────┘                             │
│         │                    │                                     │
│         ▼                    ▼                                     │
│  ┌──────────────┐     ┌──────────────┐                             │
│  │ novomind_    │     │ user_idea_   │                             │
│  │ assessments  │     │ profile      │                             │
│  │ (BARS结果)   │     │ (IDEA画像)   │                             │
│  └──────────────┘     └──────┬───────┘                             │
│                              │                                     │
│                    行为信号持续收集                                  │
│                              │                                     │
│                              ▼                                     │
│                       ┌──────────────┐                             │
│                       │ 偏差洞察引擎 │ ◄── 20个数据点后解锁        │
│                       │ Divergence   │                             │
│                       │ 对话 vs 行为 │                             │
│                       └──────────────┘                             │
└────────────────────────────────────────────────────────────────────┘
```

### 画像进化流程

```mermaid
flowchart LR
    A["对话评测\n(stated_*)"] --> C["综合画像\n(final_*)"]
    B["行为收集\n(behavioral_*)"] --> C
    C --> D{"数据点 ≥ 20?"}
    D -- 否 --> E["进度条显示\nx/20"]
    D -- 是 --> F["解锁偏差洞察\n对话 vs 行为"]

    style A fill:#c4b5fd,stroke:#8b5cf6
    style B fill:#fbbf24,stroke:#f59e0b
    style C fill:#60a5fa,stroke:#3b82f6
    style F fill:#34d399,stroke:#10b981
```

### BARS 五维评估维度

| 维度 | Key | 评估内容 | 分数范围 |
|------|-----|---------|---------|
| 认知开放度 | `cognitive_openness` | 兴趣广度、对新事物的态度 | 1.0 - 5.0 |
| 破局重构力 | `paradigm_breaking` | 挑战现状、重新定义规则 | 1.0 - 5.0 |
| 模糊容忍度 | `ambiguity_tolerance` | 不确定性下的决策能力 | 1.0 - 5.0 |
| 创新内驱力 | `intrinsic_motivation` | 内在驱动力强度 | 1.0 - 5.0 |
| 落地执行力 | `execution_capability` | 想法到落地的能力 | 1.0 - 5.0 |

### 综合分数融合策略

IDEA 画像的综合分数（`final_*`）采用加权融合：

```
behaviorWeight = min(0.5, dataPoints × 0.025)   // 每个行为点+2.5%, 上限50%
statedWeight   = 1 - behaviorWeight

final_score = statedWeight × stated_score + behaviorWeight × behavioral_score
```

### 数据库表结构

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `novomind_assessments` | BARS 五维评测结果 | `user_id`, `dimensions`, `overall_innovation_index` |
| `user_idea_profile` | IDEA 四维画像 | `stated_*`, `behavioral_*`, `final_*`, `divergence_unlocked`, `divergence_report` |

## 6. 关键数据流与异常处理

1. **状态流转与透明化**：前端 UI 通过接收 Orchestrator 传递的节点状态流（如：`working`, `completed`, `error`），交由 `ThinkingIndicator` 组件呈现 Agent 当下的工作状态，确保分析过程的用户心智透明化。各 Agent 完成后即时展示摘要预览（评分 + 核心发现）。
2. **持久化存储记录**：分析流完毕后，系统通过 Dexie.js 将最终报告结构体写入 IndexedDB 的 `execution_history` 存储中，保证页面刷新不丢失分析历史。NovoMind 评测结果持久化至 Supabase `novomind_assessments` 表。
3. **容错与全面超时机制**：为防止单点阻塞，Agent 执行层具备超时容错的 `runWithTimeout` 控制。全局分析默认在设定时间内熔断。超时后，系统将依据当下阶段自动截取已完成节点内容，并返回 `isPartial: true` 的标志性数据，确保系统在高压或网络阻塞下不发生"白屏死亡"，而是展现出平稳的降级处理结果。
4. **错开启动与限流保护**：Layer1 的 4 个 Agent 以 500ms 间隔错开启动，避免瞬时并发触发 AI API 限流。配合 429/503 智能退避机制，显著提升大负载下的成功率。
5. **Cron 健康监控**：`/api/tracker/health` 端点实时报告 Cron 执行状态（`healthy` / `degraded` / `critical`），检测过期和错过 48h+ 的监控任务，为运维提供可观测性。Cron 执行后通过 Webhook 自动推送结果。
