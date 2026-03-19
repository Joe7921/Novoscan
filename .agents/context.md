# Novoscan 开源版（Novoscan-Open）开发上下文

> **最后更新**：2026-03-19 12:43
> 本文件供 AI Agent 在每次对话开始时读取，以便快速理解项目背景、定位工作区。

---

## 🎯 项目别名速查（Vibe Coding 快捷定位）

| 你说的关键字 | 对应项目 | 本地路径 | 远程地址 |
|------------|---------|---------|---------|
| **开源版** / open / 社区版 / self-hosted / 自部署 | Novoscan-Open | `D:\Antigravity projects\Novoscan-Open` | github.com/Joe7921/Novoscan |
| **云端版** / cloud / 商业版 / novoscan.cn / next | novoscan-next | `D:\Antigravity projects\novoscan-next` | novoscan.cn (Vercel) |

⚠️ **当用户提到"云端版"相关任务时，请切换到 `novoscan-next` 工作区操作。**
⚠️ **当前文件所在工作区是 Novoscan-Open（开源版）。**

---

## 🧠 新功能 / 新想法归属决策框架（Agent 必读）

**当用户提出任何新功能想法或优化建议时，你必须先按以下决策树判断功能归属，然后主动告知用户影响范围：**

```
用户提出新想法
  │
  ├─ 涉及支付/积分/钱包/签到/推荐/广告/NovoMind/SEO/用户访问控制？
  │   └→ 🔴 云端独有。告知用户："这是云端增值功能，开源版不包含。建议在 novoscan-next 实现，并用 FEATURES.xxx 包裹。"
  │
  ├─ 涉及 Docker/Admin CLI/MockAI/本地部署/Ollama？
  │   └→ 🟢 开源独有。直接在 Novoscan-Open 实现。
  │
  ├─ 涉及 Agent 逻辑/Orchestrator/检索引擎/AI Client/类型系统/评分系统？
  │   └→ 🔵 两端共享核心代码。告知用户："这是共享核心代码，需要在 novoscan-next 先改，测试通过后同步到开源版。"
  │
  ├─ 涉及 UI 组件/新页面/新 API 路由？
  │   └→ ⚠️ 需要判断。问自己：
  │       ├─ 这个功能开源用户需要吗？
  │       │   ├─ 是 → 两端都做，但可能有差异化实现
  │       │   └─ 否 → 云端独有，用 Feature Flag 隔离
  │       └→ 主动询问用户："这个功能是否需要在开源版也提供？如果是，两端实现方式可能有差异。"
  │
  └─ 不确定归属？
      └→ 主动询问用户，并给出你的判断建议
```

**示例思考链路：**
- 用户说"加一个报告导出 PDF 功能" → 🔵 两端共享，需双端同步
- 用户说"加一个会员订阅系统" → 🔴 云端独有，开源版不包含
- 用户说"优化 Docker 启动速度" → 🟢 开源独有
- 用户说"加一个数据可视化大屏" → ⚠️ 需判断，主动询问用户

---

## 项目背景

Novoscan 是一个多智能体驱动的创新评估引擎，分为两个版本：
- **云端商业版**：`D:\Antigravity projects\novoscan-next`（已部署 Vercel，域名 novoscan.cn）
- **开源版**：`D:\Antigravity projects\Novoscan-Open`（GitHub: https://github.com/Joe7921/Novoscan.git）

两个版本共享核心代码（Agent / Orchestrator / 检索引擎 / AI Client / 类型系统），
通过 Feature Flag (`src/config/edition.ts`) 区分功能。开源版默认 `NEXT_PUBLIC_EDITION=open`。

---

## 已完成的工作

### 核心基建
1. ✅ Dockerfile（三阶段 standalone）+ docker-compose.yml（PG16 + Redis7 + healthcheck）
2. ✅ Mock AI 三模式（mock-ai.ts：回放/录制/正常 + 延迟 + 错误率）
3. ✅ 数据库迁移体系（migrations/ 11 个有序 SQL，含 auth_users）
4. ✅ 多模态上传 API（/api/upload：PDF/DOCX/TXT/MD/PNG/JPG/WEBP）
5. ✅ FileAttachment.tsx（点击 + 拖拽 + 预览）
6. ✅ Admin CLI + 管理 API
7. ✅ CI 流水线（.github/workflows/ci.yml：ESLint + 单元测试 + Build + SQL 语法检查 + Rust WASM 构建）
8. ✅ 代码质量工具链（.husky + commitlint + lint-staged）
9. ✅ Vitest 配置 + 4 个测试套件（parseAgentJSON / qualityGuard / debater / orchestrator）

### 数据库抽象层
10. ✅ IDatabase 接口（src/lib/db/IDatabase.ts）
11. ✅ PostgresAdapter 实现（src/lib/db/PostgresAdapter.ts）— select/eq/insert/upsert 参数化查询
12. ✅ NoopAdapter 实现（src/lib/db/NoopAdapter.ts）— 无数据库时空操作适配器
13. ✅ 数据库工厂重构（src/lib/db/factory.ts）— Provider-agnostic，自动检测环境选择适配器
14. ✅ 去 Supabase 直调 — 所有 Supabase client 直接调用替换为 `adminDb`/`db` 抽象实例

### Auth 解耦 & 登录移除
15. ✅ auth.config.ts（Edge-safe 配置）+ auth.node.ts（Node.js 专用）
16. ✅ auth-users.ts（独立用户表 CRUD，脱离 Supabase Auth）
17. ✅ migrations/010_auth_users.sql
18. ✅ 登录代码全面移除 — 删除登录 UI 组件、移除 Context/Layout 认证逻辑、API 路由不再强制登录
19. ✅ 注册弹窗移除 — "Unlock More Analysis Power" 弹窗已删除

### 插件生态系统
15. ✅ 插件协议层（src/plugins/types.ts + registry.ts + discovery.ts）
16. ✅ 3 个内置插件 Agent（patent-scout / arxiv-scanner / github-trends，各含 plugin-manifest.json）
17. ✅ 插件市场前端（src/app/marketplace/ + marketplaceService.ts + marketplace-types.ts）
18. ✅ CLI 发布工具（scripts/publish-agent.ts）
19. ✅ **插件 SDK 统一化**（与云端版双向同步，2026-03-17）
    - `src/plugins/sdk/types.ts`：从 types.ts 提取的纯接口层（INovoAgent / ISearchProvider / 校验）
    - `src/plugins/sdk/manifest-schema.ts`：PluginManifest 类型 + `NOVOSCAN_PLUGIN_SDK_VERSION` 常量
    - `src/plugins/sdk/index.ts`：统一导出 SDK 全部 API + SDK_VERSION
    - 原有 `types.ts` 和 `marketplace-types.ts` 改为 re-export（零破坏）
    - ❗ **这个 sdk/ 目录是与云端版 `src/lib/plugins/sdk/` 双向同步的，修改后必须保持一致**

> [!IMPORTANT]
> **云端版已在插件 SDK 基础上新增了 3 个扩展点（开源版无需关心）：**
> - Hook 1：插件 Agent 注入（pluginAgentRegistry）
> - Hook 2：评分系统插件化（scoringRegistry + 5 个行业预设 + UI 选择器）
> - Hook 3：数据源适配器（dataSourceRegistry）
> 这些是云端增值能力，不会同步到开源版。开源版插件通过 `agentAdapter.ts` 适配层自动在云端版运行。

### AI 能力
20. ✅ Ollama 本地 AI 支持（PROVIDER_REGISTRY 已注册，健康探测 + 缓存 + 降级链兜底）
21. ✅ 模型降级链：MiniMax → DeepSeek → Kimi → Ollama
22. ✅ **AI Client 模块化拆分**（src/lib/ai/）— 原单文件拆分为 6 个领域子模块：
    - `registry.ts`：Provider 注册表（PROVIDER_REGISTRY）
    - `engine.ts`：核心调用引擎（callProvider / callAIRaw / callAIWithFallback）
    - `fallback-chain.ts`：模型降级链（buildModelChain / isProviderAvailable）
    - `json-parser.ts`：JSON 解析器（parseAgentJSON / extractJSON）
    - `r1.ts`：DeepSeek R1 专用调用
    - `index.ts`：统一导出入口
    - 原 `ai-client.ts` 改为 re-export 兼容层

### 测试框架
21. ✅ Playwright E2E 测试（playwright.config.ts + tests/ 下 4 个 spec 文件）

### Rust WASM 核心引擎
22. ✅ Rust crate `novoscan-core`（rust/novoscan-core/：score_engine.rs + json_healer.rs，8/8 原生测试通过）
23. ✅ WASM npm 包（pkg/novoscan-core/ Node.js 150KB + pkg/novoscan-core-web/ 浏览器 150KB）
24. ✅ WASM 桥接层（src/lib/wasmBridge.ts：自动检测环境 + TS fallback 降级）
25. ✅ CI rust-wasm job（Rust stable + cargo test + wasm-pack build 双 target + Cargo 缓存）
26. ✅ next.config.js asyncWebAssembly webpack 配置

### 前端组件
23. ✅ ShareButton 报告分享组件
24. ✅ ExportReportButton 报告导出
25. ✅ SelfHostCTA 自部署引导组件
26. ✅ DataSourceCoverage 数据源覆盖可视化

### HomeClient 重构 & 首页优化
27. ✅ **HomeClient 钩子提取** — 核心逻辑拆分为 3 个自定义 Hook：
    - `useAnalysis.ts`：分析流程控制（启动/流式回调/报告构建）
    - `useRetry.ts`：重试逻辑管理
    - `useFollowUp.ts`：追问功能处理
    - 工具函数 `buildReportFromResult` / `createStreamCallback` 分离
28. ✅ **首页 Playground 重设计** — 替换原有首页为极简 PlaygroundHome 组件（快速分析入口 + 工作流快捷访问）

### Studio 优化
29. ✅ Studio 导航修复 — Logo 可点击返回首页
30. ✅ Studio 侧边栏增加「设置」入口（链接到 Profile 页面）
31. ✅ Studio 引导式 Onboarding — 新用户入门引导流程

### 代码架构优化
32. ✅ **类型系统模块化**（src/types/）— 原单文件拆分为 11 个领域文件：
    - `agent.ts` / `bizscan.ts` / `clawscan.ts` / `common.ts` / `cross-domain.ts`
    - `data-source.ts` / `model.ts` / `orchestration.ts` / `report.ts` / `search.ts`
    - `index.ts` 统一导出
33. ✅ **导入路径迁移** — 8 个 Agent 模块 + AI Client 从 re-export 兼容层迁移到直接导入新模块路径
34. ✅ **桩模块统一**（src/lib/stubs/index.ts）— checkCostLimit / recordSerpEngineCall / checkFeatureAccess 桩实现集中管理
35. ✅ **Hydration 错误修复** — 修复 framer-motion SSR 行为导致的 React Hydration 错误（motion.button / motion.div HTML 嵌套不匹配）
36. ✅ **构建错误修复** — 解决 3 个 npm run build 编译错误

### 工作流可视化引擎（Step 7-13 + 引擎连接 + 性能分析 + 回环边）

#### 三层架构

```
┌─ UI 层 ──────────────────────────────────────────────────────────┐
│  WorkflowClient.tsx        工作流管理页（预设列表/自定义/导入导出/分享/版本）   │
│  WorkflowEditor.tsx        React Flow 画布（拖拽调色板/连线/配置面板/状态灯） │
│  CommunityClient.tsx       社区市场页（/community，模板浏览/分享码导入）      │
│  PromptABPanel.tsx         Prompt A/B 对比面板                           │
│  useWorkflowRunner.ts      运行 Hook（模拟 startRun + 真实 startRealRun） │
│  useWorkflowVersions.ts    版本快照 Hook（localStorage CRUD, 最多 20 版本） │
└──────────────────────────────────────────────────────────────────┘
        ↕ fetch SSE (NDJSON)
┌─ API 层 ─────────────────────────────────────────────────────────┐
│  /api/workflow/run/route.ts    SSE 端点：POST {workflow, query}       │
│     → searchDualTrack() 双轨检索                                    │
│     → executeWorkflow(definition, agentInput) 引擎执行               │
│     → onProgress 回调 → NDJSON 流推送 node_start/node_done/done      │
└──────────────────────────────────────────────────────────────────┘
        ↕ import
┌─ 核心引擎层（src/workflow/）─────────────────────────────────────────┐
│  types.ts       WorkflowDefinition / WorkflowNode 联合类型           │
│                 (agent/parallel/condition/debate/quality/retry)      │
│                 WorkflowMeta (sharedBy/sharedAt/downloads/tags)      │
│  engine.ts      executeWorkflow() — DAG 拓扑排序 → 按层执行节点         │
│                 executeAgentNode / executeDebateNode / executeRetryNode│
│                 onProgress('log'|'agent_state'|'progress', data)     │
│  validator.ts   validateWorkflow() + detectCycle()                    │
│                 区分非法环 vs 合法重试环（retryBackEdges 排除）           │
│  index.ts       统一导出入口                                         │
└──────────────────────────────────────────────────────────────────┘
```

#### 关键数据流

**编辑 → 保存**：
`画布节点/边 → flowToWorkflow() → WorkflowDefinition JSON → onSave → localStorage`
`↳ useWorkflowVersions.createVersion() 自动创建版本快照`

**真实运行**：
`用户输入查询 → startRealRun(workflow, query, nodeIds)`
`→ POST /api/workflow/run → 双轨检索(学术+产业) → executeWorkflow()`
`→ onProgress 回调 → SSE NDJSON 流 → useWorkflowRunner 解析`
`→ agent_state 事件 → updateNodeStatus() → 画布节点状态灯变色`
`→ done 事件 → RunSummary {overallScore, resultSummary}`

**社区分享**：
`📤 handleShare → JSON + WorkflowMeta → btoa() → 分享码 → 剪贴板`
`📥 粘贴分享码 → atob() → validateWorkflow() → 导入到本地 localStorage`

#### 关键设计模式

| 模式 | 说明 |
|------|------|
| **DAG 引擎** | `engine.ts` 用入度表拓扑排序，逐层并行执行同层节点，`parallel` 节点组内 `Promise.all` |
| **SSE 推送** | API 路由用 `ReadableStream` + NDJSON（`{type,data}\n`），客户端 `fetch` + `reader.read()` 逐行解析 |
| **合法重试环** | `validator.ts` 的 `detectCycle` 收集 retry 节点的 `targetNodeId` 为 `retryBackEdges`，从拓扑排序中排除这些边 |
| **状态灯映射** | `useWorkflowRunner` 监听 `agent_state` 事件，映射 `status: running→🟡 / completed→🟢 / failed→🔴 / timeout→🟠` |
| **自定义边** | `RetryEdge` 注册到 `edgeTypes`，`workflowToFlow` 和 `onConnect` 自动检测 retry 源节点标记 `type:'retryEdge'` |
| **版本管理** | `useWorkflowVersions` — localStorage key `novoscan_wf_versions_{id}`，JSON 深拷贝快照，FIFO 淘汰最旧版本 |

#### 扩展指南

- **新增节点类型**：① `types.ts` 加 interface + 联合类型 → ② `engine.ts` 加 `executeXxxNode` + switch case → ③ `validator.ts` 加校验规则 → ④ `WorkflowEditor.tsx` 加 `PALETTE_ITEMS` + `flowToWorkflow` + 配置面板
- **新增 SSE 事件**：① `engine.ts` 的 `emitLog/onProgress` 发送 → ② `route.ts` 透传 → ③ `useWorkflowRunner.ts` 的 switch 解析
- **新增社区模板**：`CommunityClient.tsx` 的 `FEATURED_TEMPLATES` 数组追加

### 云端代码清理
26. ✅ walletService 已删除
27. ✅ chargeForFeature / featureCosts 已全部清除
28. ✅ anonymous_usage 逻辑已清除
29. ✅ /api/skill-check API 路由已删除

### GitHub 运营
30. ✅ Issue 模板（bug_report.yml + feature_request.yml + config.yml）
31. ✅ PR 模板（pull_request_template.md）
32. ✅ FUNDING.yml
33. ✅ Good First Issues 文档（docs/good-first-issues.md）

### 云端版同步基建（在 novoscan-next 完成）
34. ✅ Feature Flag 系统（src/config/edition.ts）— 已在云端版创建
35. ✅ 同步脚本（scripts/sync-to-open.ps1）— 已在云端版创建

---

## 已知 Bug / 技术债

| 优先级 | 描述 | 状态 |
|--------|------|------|
| 🟡 | AI Client 不支持图像多模态 — buildBody 未传 attachments，图像 base64 无法传入 AI API | ❌ 未修复 |
| ✅ | `src/components/skill-check/` 前端组件残留 — API 已删但组件仍在 | ✅ 已清理 |
| ✅ | Vitest 测试文件缺失 — 已补充 4 个测试套件 | ✅ 已修复 |
| ✅ | Supabase 直接调用残留 — 已全部替换为数据库抽象层 | ✅ 已修复 |
| ✅ | Hydration 错误 — framer-motion SSR 不匹配 | ✅ 已修复 |

---

## 待做任务（按优先级）

### P0 — 必做
1. ✅ ~~在开源版创建 `src/config/edition.ts`~~ — 已完成
2. 创建 `src/config/cloud-sync.ts`（可选连接云端总库）

### P1 — 短期
3. 补充 Vitest 单元测试文件（扩充覆盖率）
4. ✅ ~~清理 skill-check 前端组件残留~~ — 已完成
5. AI Client 图像多模态支持（attachments 参数透传）

### P2 — 中期
6. README 英文化完善 + Hero GIF
7. Agent 思考气泡 UI 增强
8. 社群运营（贡献者墙 + PR 欢迎 Bot）

### P3 — 远期
9. ✅ 🦀 Rust WASM Phase 1 已完成（评分引擎 + JSON 解析器 WASM 化，双端同步）
10. 🦀 Rust Phase 2（搜索引擎 Rust 微服务）— 待启动

---

## 开源版排除的功能（绝不包含）

支付 / 积分 / 钱包 / 签到 / 推荐 / 广告 / NovoMind / SEO / 百度验证 / 用户访问控制

---

## 技术栈

Next.js 14 / React 18 / TypeScript / Tailwind CSS /
Dexie.js / framer-motion / Recharts / Zod / mammoth / pdf-parse /
AI: DeepSeek + MiniMax + Moonshot + Ollama（OpenAI 兼容）
**Rust WASM**: novoscan-core（评分引擎 + JSON 解析器）/ wasm-bindgen / serde_json
**工作流编辑器**: @xyflow/react (React Flow) / getBezierPath / EdgeLabelRenderer
**插件 SDK**: `src/plugins/sdk/` — INovoAgent / ISearchProvider / defineAgent / SDK_VERSION（与云端版双向同步）

---

## 🎨 UI 设计准则（强制遵守，任何对话/分身禁止违反）

> [!CAUTION]
> 以下设计体系是项目的核心视觉标识，**任何对话、任何分身都必须严格遵守**。
> 禁止在未经用户明确授权的情况下修改任何颜色值或设计模式。
> ⚠️ **亮色模式和暗色模式是两套完全独立的设计体系，严禁混用！**

### 核心原则

1. **默认亮色**：项目默认呈现亮色模式，暗色通过 `html.dark` + Tailwind `dark:` 前缀启用
2. **双模式独立**：亮色方案和暗色方案是两套完全不同的视觉语言，每个 UI 元素必须同时定义亮色值和 `dark:` 暗色值
3. **禁止硬编码深色**：禁止在不带 `dark:` 前缀的情况下使用任何深色背景（如 `bg-[#0a0a0f]`、`bg-[#111118]`）
4. **统一品牌色**：Novo 四色为品牌基础色，两种模式共享但亮度可微调

---

### ☀️ 亮色模式 — Novo 四色 + 白色基底 + 毛玻璃体系

> **设计语言**：干净、明亮、毛玻璃质感、柔和阴影

```css
--background: #ffffff;      /* 纯白页面背景 */
--foreground: #111111;      /* 近黑前景文字 */
```

| 元素类型 | Tailwind 类 | 说明 |
|---------|------------|------|
| 页面背景 | `bg-white` | 纯白 `#ffffff` |
| 卡片背景 | `bg-white/95` | 毛玻璃质感 |
| 容器/输入框底 | `bg-gray-50` / `bg-gray-100` | 浅灰层次 |
| 毛玻璃效果 | `bg-white/95 border-white/40 shadow-sm` | 半透明 + 柔和阴影 |
| 主文字 | `text-gray-900` | 近黑 |
| 次要文字 | `text-gray-500` | 中灰 |
| 静默文字 | `text-gray-400` | 浅灰 |
| 默认边框 | `border-gray-100` / `border-gray-200` | 极淡分割线 |
| 强调边框 | `border-gray-300` | hover 时加深 |
| 品牌强调 | `text-novo-blue`（`#4285F4`） | Novo 蓝 |
| 选中/激活态 | `bg-novo-blue/10 text-novo-blue border-novo-blue/20` | 蓝色轻底 |
| hover 效果 | `hover:border-gray-300 hover:shadow-md` | 边框加深 + 阴影 |
| 背景光晕 | 不显示 | 亮色模式不需要光晕 |

---

### 🌙 暗色模式 — 深海蓝三层表面系统

> **设计语言**：深海蓝层次、slate 色系文字、微光边框
> **三层表面**：Base `#0B1120` → Surface `#131B2E` → Elevated `#1A2540`

```css
--background: #0B1120;      /* Base：页面背景 */
--foreground: #F1F5F9;      /* 主文字 */
--card-bg: #131B2E;         /* Surface：卡片/容器 */
--card-border: #1E293B;     /* 卡片边框 */
--elevated-bg: #1A2540;     /* Elevated：悬浮/弹窗 */
--elevated-border: #334155; /* 悬浮边框 */
--text-secondary: #94A3B8;  /* 次要文字 */
--text-muted: #64748B;      /* 静默文字 */
```

| 元素类型 | Tailwind `dark:` 类 | 说明 |
|---------|------------|------|
| 页面背景 | `dark:bg-dark-base` | `#0B1120` |
| 卡片背景 | `dark:bg-dark-surface/60` | `#131B2E` 60% |
| 容器/输入框底 | `dark:bg-dark-surface` | `#131B2E` |
| 悬浮/弹窗 | `dark:bg-dark-elevated` | `#1A2540` |
| 主文字 | `dark:text-slate-100` | `#F1F5F9` |
| 次要文字 | `dark:text-slate-400` | `#94A3B8` |
| 静默文字 | `dark:text-slate-500` | `#64748B` |
| 默认边框 | `dark:border-slate-700` / `dark:border-slate-800` | 深海蓝边框 |
| 强调边框 | `dark:border-slate-600` | hover 时微亮 |
| 品牌强调 | `dark:text-blue-400` | 亮蓝（暗色适配） |
| 选中/激活态 | `dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30` | 蓝光底 |
| hover 效果 | `dark:hover:bg-dark-elevated dark:hover:border-slate-600` | 层级提升 |
| 背景光晕 | `dark:block hidden` — 仅暗色显示蓝色光晕 | 氛围感 |

---

### Novo 四色方案（亮暗通用基础值）
```css
--novo-blue: #4285F4;
--novo-red: #EA4335;
--novo-yellow: #FBBC05;
--novo-green: #34A853;
```

### 渐变品牌色
- 品牌渐变：`linear-gradient(to right, #2563eb, #7c3aed)` (blue-600 → violet-600)

### 代码编写规范

```tsx
// ✅ 正确：每个元素同时定义亮色和 dark: 暗色
<div className="bg-white dark:bg-dark-base text-gray-900 dark:text-slate-100">
<div className="bg-white/95 dark:bg-dark-surface/60 border-gray-100 dark:border-slate-800">

// ❌ 错误：硬编码深色值，不带 dark: 前缀
<div className="bg-[#0a0a0f] text-gray-100">
<div className="bg-[#111118] border-gray-800">

// ❌ 错误：只写一种模式
<div className="bg-white">  // 缺少 dark: 适配
<div className="dark:bg-dark-base">  // 缺少亮色值
```

### 禁止事项
1. ❌ 不得修改上述任何颜色值
2. ❌ 不得将 `--foreground` 从 `#111111` 改为其他值（如 `#111827`）
3. ❌ 不得更换暗色模式的三层表面系统色值
4. ❌ 不得更换四色方案
5. ❌ **不得在无 `dark:` 前缀的情况下使用深色背景（如 `#0a0a0f`、`#111118`、`#131B2E`）**
6. ❌ **不得只写一种模式的样式，必须亮色 + `dark:` 暗色成对出现**
7. ✅ 可以新增 `--novo-*` Design Token 变量作为扩展，但旧变量必须保持不变
8. ✅ 可以通过 ThemeContext 在运行时覆盖 `--novo-*` 变量，但 `--background` / `--foreground` 等旧变量不得被覆盖

---

## 我的规则

1. 必须使用简体中文回复和注释
2. 不要擅自修改项目外观/CSS/UI 风格
3. 严格限制在当前任务范围内，不要动无关代码
4. 可能影响全局架构的操作，先问我同意才执行
5. 完成后给我至少三条优化建议
