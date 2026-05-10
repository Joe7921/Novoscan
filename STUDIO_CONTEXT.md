# P8 Studio Rework — 实施状态 Context

> 最后更新：Phase Q 完成
>
> 术语规范：Standard = 传统工作流 | Agentic = 智能体工作流 | Custom = 自定义工作流

## 已完成 Phase

### Phase A: 后端 API 补全 ✅
- `app/main.py` 新增：
  - Pipeline CRUD: `GET/PUT/DELETE /api/v1/pipelines/{filename}`
  - 增强 Blocks API: `/api/v1/blocks` 返回完整三级元数据
  - Tools API: `GET /api/v1/tools`
  - Block CRUD: `POST/PUT/DELETE /api/v1/blocks/{type}/{id}`
  - Block 导入导出: `POST import` / `GET export`
  - `AnalyzeRequest` 增加 `pipeline` 字段

### Phase B+B2: 前端依赖 + 积木类型系统 ✅
- 安装: `@xyflow/react`, `zustand`, `dagre`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@types/dagre`
- `src/types/blocks.ts`: 完整四层类型系统
  - L0: ConfigField, ToolDescriptor
  - L1: AgentBlockMeta
  - L2: InteractionBlockMeta (含 RoleSpec)
  - L3: ReportBlockMeta (含 ReportSection)
  - 六层十类 Agent 角色定义 (AGENT_ROLE_DEFINITIONS)
  - Pipeline 类型、API 响应类型

### Phase C: Studio 画布核心 ✅
- `src/lib/studioStore.ts`: Zustand store，管理 React Flow 节点/边、Pipeline 双向转换、Dagre 自动布局
- `src/components/studio/`:
  - StudioNode — 自定义节点组件
  - BlockSidebar — 积木拖拽侧边栏
  - StudioToolbar — 管线选择/保存/布局/导出
  - NodeConfigDrawer — 节点配置抽屉
  - StudioCanvas — React Flow 主画布
  - StudioStatusBar — 底部状态栏

### Phase D: StudioPage 重写 ✅
- `/studio` → 可视化管线设计画布（ReactFlowProvider 包裹）
- 原分析工作台保留为 `/analysis-studio` (AnalysisStudioPage)
- 路由更新：App.tsx

### Phase E: 首页 Custom 模式 ✅
- `InputPanel` 增加 Custom 按钮 + 管线选择器
- `useAnalysis` 和 `api.ts` 的 `AnalyzeRequest` 支持 `pipeline` 参数

### Phase F: 设置页增强 ✅
- `SettingsPage` 新增：工具注册表面板、积木注册表概览面板

### Phase G: Agent 积木设计器 ✅
- `AgentDesigner` 组件：
  - 基础信息面板
  - 六层十类角色选择器
  - config_schema 动态编辑器
  - inputs/outputs 列表编辑
  - YAML 预览 + 导出
  - Agent-as-Tool 双重接口预览
- `/studio/agent-designer` 路由

### Phase G2: Agentic 调优模式 ✅
- `StudioRunner` 组件：在画布底部折叠面板，输入 query 试运行管线，实时标记节点状态

### Phase G3: Studio Agent 对话式设计 ✅
- `DesignAssistant` 组件：浮动对话面板 + 快捷命令，placeholder 回复（预留 LLM 接口）

### Phase H: 积木浏览器增强 ✅
- `BlocksPage` 展开详情增加 inputs/outputs/config_schema 展示
- 添加 YAML 导出按钮 + 跳转设计器

### Phase I: 验证 + context.md 同步 ✅
- TypeScript 零错误
- Vite 构建成功
- 本文件即为 context.md

## 文件清单

### 新增文件
| 路径 | 说明 |
|------|------|
| `frontend/web/src/types/blocks.ts` | 四层类型系统 |
| `frontend/web/src/lib/studioStore.ts` | Studio Zustand Store |
| `frontend/web/src/components/studio/StudioNode.tsx` | 自定义节点 |
| `frontend/web/src/components/studio/BlockSidebar.tsx` | 积木侧边栏 |
| `frontend/web/src/components/studio/StudioToolbar.tsx` | 画布工具栏 |
| `frontend/web/src/components/studio/NodeConfigDrawer.tsx` | 节点配置抽屉 |
| `frontend/web/src/components/studio/StudioCanvas.tsx` | React Flow 画布 |
| `frontend/web/src/components/studio/StudioStatusBar.tsx` | 状态栏 |
| `frontend/web/src/components/studio/AgentDesigner.tsx` | Agent 设计器 |
| `frontend/web/src/components/studio/StudioRunner.tsx` | 调试运行面板 |
| `frontend/web/src/components/studio/DesignAssistant.tsx` | 对话式设计助手 |
| `frontend/web/src/components/studio/index.ts` | Barrel export |
| `frontend/web/src/pages/AnalysisStudioPage.tsx` | 分析工作台(原 StudioPage) |
| `frontend/web/src/pages/AgentDesignerPage.tsx` | Agent 设计器页 |
| `STUDIO_CONTEXT.md` | 本文件 |

### 修改文件
| 路径 | 改动 |
|------|------|
| `app/main.py` | Phase A 全部 API |
| `frontend/web/package.json` | 新增依赖 |
| `frontend/web/src/lib/api.ts` | 新增 15+ API 函数 |
| `frontend/web/src/hooks/useAnalysis.ts` | pipeline 参数 |
| `frontend/web/src/components/analysis/InputPanel.tsx` | Custom 模式 |
| `frontend/web/src/pages/StudioPage.tsx` | 可视化画布重写 |
| `frontend/web/src/pages/BlocksPage.tsx` | 增强详情展示 |
| `frontend/web/src/pages/SettingsPage.tsx` | 工具/积木面板 |
| `frontend/web/src/App.tsx` | 路由新增 |

### Phase J: Agent 分类与分组 ✅
- 后端 6 个 Agent YAML 添加 `role_type` 字段
- `app/core/base.py` BlockMeta 新增 `role_type` 属性 + `from_yaml` 解析
- 前端 `AgentBlockMeta` 新增 `role_type` 可选字段
- `BlockSidebar` Agent 按 category 二级分组 + 角色标签
- `BlocksPage` Agent 按 category 分组渲染 + 角色标签展示

### Phase K: 设置页增强 + Tool CRUD ✅
- **SettingsPage** 重构为左侧分类导航（引擎/数据源/偏好/工具/积木）+ 右侧内容面板
- **后端 Tool CRUD API** (`app/main.py`):
  - `GET /api/v1/tools/{tool_id}` — 查询单个工具
  - `POST /api/v1/tools` — 创建自定义工具
  - `PUT /api/v1/tools/{tool_id}` — 更新自定义工具
  - `DELETE /api/v1/tools/{tool_id}` — 删除自定义工具
  - `GET /api/v1/tools/{tool_id}/export` — 导出 YAML
  - `POST /api/v1/tools/import` — 导入 YAML 文件
- **前端 ToolManager** (`src/components/settings/ToolManager.tsx`): 完整 CRUD + 导入导出 + 模态编辑器
- **前端 API** (`src/lib/api.ts`): createTool/updateTool/deleteTool/importTool/getToolExportUrl

### Phase L: Studio 模式切换 + AI 助手常驻 ✅
- **StudioToolbar** 新增 Standard（传统工作流）/ Agentic（智能体工作流）模式切换（Pill 按钮），状态存入 `studioStore.studioMode`
- **DesignAssistant** 从浮动气泡重构为**常驻右侧边栏**（w-72），随 studioMode 自动切换：
  - Standard 传统工作流模式：设计助手，快捷命令（创建 Agent/搜索/优化/导出）
  - Agentic 智能体工作流模式：调优助手，快捷命令（ReAct 调优/工具链诊断/迭代配置/Token 预估）
- **StudioPage** 布局调整：左侧 BlockSidebar + 中央画布(含 StudioRunner) + 右侧 DesignAssistant 常驻
- **studioStore** 新增 `studioMode` / `setStudioMode` 状态

### Phase M: 过滤器 Agent + 三层积木适配 + Prompt 同步 ✅

#### M1: 过滤器 Agent 角色
- **类型扩展** (`blocks.ts`): `AgentRoleType` 新增 `'filter'`，`AgentRoleLayer` 新增 `'transform'`
- **AGENT_ROLE_DEFINITIONS** 新增过滤器条目：icon 🔄 / color #0D9488 / layer transform
- **后端 YAML**: `report_data_filter.yaml`（通用报告数据过滤器）+ `timeline_filter.yaml`（时间线过滤器）
- **BlockSidebar / BlocksPage**: CATEGORY_LABELS 新增 `transform: '数据转换'`

#### M2: 三层积木画布适配
- **StudioNode**: 过滤器 Agent 专属样式（RefreshCw 图标 + 青色边框 + "转换层"角标），Report 节点显示 sections 数量角标
- **StudioCanvas.onDrop**: 三层积木通过映射表统一处理（agent_id / interaction_id / report_id）
- **studioStore.addNode**: 智能连线 — report 插入 END 前，agent/interaction 插入最后一个非 report 节点后
- **NodeConfigDrawer**: Report 节点新增专属配置区（sections 预览列表 + requires 依赖 Agent 标签）

#### M3: Prompt 同步功能
- **PromptSyncModal** (`PromptSyncModal.tsx`): 模态框列出所有 Agent prompt + 管线报告 sections → 自动生成输出格式后缀 → 一键批量应用
- **StudioToolbar**: 新增「同步 Prompt」按钮（Wand2 图标 / 青色）
- **DesignAssistant**: Standard 新增「同步 Prompt」快捷命令，Agentic 新增「Prompt 格式对齐」快捷命令

### Phase N: Studio UX 优化 P0+P1 ✅

#### N-P0（核心可用性）
- **N1**: `StudioPage` 右侧面板合并 — NodeConfigDrawer 与 DesignAssistant 共用 w-72 槽位，选中节点显示配置，否则显示助手
- **N2**: `StudioRunner` 展开区域添加 `max-h-[200px]` 限制
- **N3**: `StudioCanvas.onDrop` 使用 `screenToFlowPosition` 获取鼠标实际画布坐标 + `studioStore.addNode` 支持可选 position 参数
- **N4**: `AgentDesigner` 头部新增 ← 返回 `/studio` 链接
- **N11**: `StudioPage` 新增 loading spinner + error 提示 + 重试按钮

#### N-P1（效率/体验）
- **N5**: `Sidebar` 新增「分析工作台」独立入口 → `/analysis-studio`，「工作台」改名为「管线设计」
- **N6**: `StudioToolbar` 管线选择器外部点击关闭（useRef + mousedown 监听）
- **N7**: `StudioNode` 拖拽视觉反馈（opacity:0.7 + scale(1.03) + shadow）
- **N8**: `DesignAssistant` 模式切换时自动重置对话历史
- **N9**: `StudioToolbar` 保存按钮点击内置管线时弹出提示气泡（3s 自动消失）
- **N10**: `AgentDesigner` YAML 预览输出 `role_type` 字段

#### N-P2（细节抛光）✅
- **N12**: `BlockSidebar` 搜索框清除按钮（X 图标）+ **N16**: 拖拽半透明反馈
- **N13**: `DesignAssistant` 头部清空对话按钮（Trash2 图标，>1 条消息时显示）
- **N14**: `StudioStatusBar` 新增模式标签（Standard/Agentic）+ 选中节点 ID
- **N15**: `StudioNode` Report 节点 max-w-[280px]，其余 max-w-[220px]
- **N17**: `AgentDesigner` category 从自由文本改为 select 下拉（6 个预设分类）
- **N18**: `StudioPage` 全局键盘快捷键（Delete 删除选中节点、Ctrl+S 保存管线）
- **N19**: `NodeConfigDrawer` 缓冲模式（本地 state 修改 → 点「应用配置」按钮写入 store）
- **N20**: `StudioRunner` 展开状态 localStorage 持久化

### Phase O: 官方内置积木全覆盖 ✅

#### Agent（14 个，覆盖 11 role_type + 6 category）
| ID | role_type | category | 说明 |
|---|---|---|---|
| intent_analyzer | planner | intent | 意图分析师 |
| react_retriever | executor | retrieval | ReAct 智能检索 |
| **context_retriever** | **retriever** | **retrieval** | 上下文检索器（新增） |
| academic_scorer | evaluator | scoring | 学术审查员 |
| academic_reviewer | critic | scoring | 学术审查员（批判） |
| competitor_detective | evaluator | scoring | 竞品侦探 |
| industry_analyst | evaluator | scoring | 产业分析员 |
| **report_synthesizer** | **synthesizer** | **scoring** | 报告综合器（新增） |
| **score_mediator** | **mediator** | **scoring** | 评分仲裁器（新增） |
| **pipeline_orchestrator** | **orchestrator** | **orchestration** | 管线编排器（新增） |
| **system_monitor** | **monitor** | **orchestration** | 系统监控器（新增） |
| report_data_filter | filter | transform | 报告数据过滤器 |
| timeline_filter | filter | transform | 时间线过滤器 |
| **context_memory** | **memory_keeper** | **custom** | 上下文记忆管理器（新增） |

#### Interaction（2 个）
- `adversarial_debate` — 对抗辩论
- **`consensus_voting`** — 共识投票（新增）

#### Report（3 个）
- `evidence_panel` — 证据面板
- `innovation_radar` — 创新雷达报告
- **`comparison_matrix`** — 对比矩阵报告（新增）

### Phase P: 导航重命名 + Studio 一站式合并 ✅

#### P1: 导航重命名
| 原名 | 新名 | 路由 |
|---|---|---|
| 分析 | **Playground** | `/` |
| 分析工作台 | *已删除独立入口* | — |
| 管线设计 | **Studio** | `/studio` |
| 报告 | **历史记录** | `/history` |
| 积木 | **组件仓库** | `/components` |

- `Sidebar.tsx`: 图标更新 (Play / Clock / Package)，删除"分析工作台"项
- `App.tsx`: 路由映射 `/reports` → `/history`, `/blocks` → `/components`, 删除 `/analysis-studio`
- `CommandPalette.tsx`: 命令标签/关键词/路由全部同步

#### P2: Playground 改造
- `InputPanel.tsx`: 标题改为 "Playground"
- `AnalyzePage.tsx`: 结果页新增"在 Studio 中打开"按钮 (Link to `/studio`)

#### P3: StudioBottomDrawer（核心）
- 新增 `StudioBottomDrawer.tsx`: VS Code 风格可拖拉底部抽屉
  - 三态：最小化(36px) / 默认(280px) / 最大化(50vh)
  - 鼠标拖拽分隔线调节高度
  - Tab: 分析 | 进度&结果 | 运行器
  - 分析 Tab: 模式切换 + 输入框 + 检测类型 + 工具链 + 额外指令（从 AnalysisStudioPage 迁移）
  - 进度&结果 Tab: ProgressTracker + IntentConfirm + ResultView
  - 运行器 Tab: 原 StudioRunner 功能
  - 高度/Tab/折叠状态 localStorage 持久化
  - 分析开始时自动切到进度 Tab + 自动展开
- `StudioPage.tsx`: StudioRunner 替换为 StudioBottomDrawer
- `index.ts`: 导出 StudioBottomDrawer

#### P4: DesignAssistant UI 完善
- 头部新增"即将上线：真正的 AI 对话能力"标签 (Sparkles 图标)
- 快捷命令分组（创建组件 / 优化管线 / 导出模板 | 策略调优 / 诊断分析）
- 简易 Markdown 渲染: RenderMarkdown 组件（代码块 + 粗体 + 复制按钮）
- 预留 LLM 对话接口结构

#### P5: 页面标题更新
- `BlocksPage.tsx`: 积木→组件（标题/Tab/空状态/描述）
- `ReportsPage.tsx`: 空状态文案微调

### Phase Q: Agentic Studio Tuning Overhaul ✅

> 对应计划文件: `agentic-studio-tuning-overhaul-a2410b.md`

#### T1: 后端 Agentic 配置 API + JSON 持久化
- **`app/pipelines/agentic_default.json`** (新增): 11 个 Tool + System Prompt + model 参数的完整 JSON 配置
- **`app/core/orchestrator.py`** (修改):
  - `load_agentic_config()` / `save_agentic_config()`: JSON 配置加载/保存
  - `build_agentic_graph(config=...)`: 动态读取 enabled tools、temperature、system_prompt
- **`app/main.py`** (修改):
  - `GET /api/v1/agentic/config`: 获取当前 Agentic 配置
  - `PUT /api/v1/agentic/config`: 更新配置 + 自动热重载 Orchestrator + prompt 版本历史
  - `GET /api/v1/agentic/tools`: 列出全部 Tool（含分组/描述）

#### T2: 前端 API + Zustand Store
- **`frontend/web/src/lib/api.ts`** (修改): `fetchAgenticConfig` / `updateAgenticConfig` / `fetchAgenticTools` + TypeScript 类型
- **`frontend/web/src/lib/agenticConfigStore.ts`** (新增): Zustand store
  - 本地编辑缓冲 (localPrompt / localTemperature / localTools)
  - dirty 标识 + 批量同步后端 `syncToBackend()`
  - Prompt 版本保存/恢复

#### T3: Agentic Canvas — Tool 拓扑画布
- **`frontend/web/src/components/studio/AgenticCanvas.tsx`** (新增): React Flow 星形拓扑
  - Orchestrator 中心节点 + Tool 环绕节点
  - 按 group 着色 (intent/search/scoring/arbitration)
  - 启用=实线动画 / 禁用=虚线灰色
  - 右键 Toggle 工具启用
  - 图例 + ResizeObserver 自适应

#### T4: Agentic Tuning Panel — 调优面板
- **`frontend/web/src/components/studio/AgenticTuningPanel.tsx`** (新增): 右侧 272px 面板
  - **Prompt Tab**: System Prompt 编辑器 + 版本历史下拉 + 字数统计
  - **参数 Tab**: 温度滑块 (0-1) + max_iterations 滑块 (1-50) + 当前模型信息
  - **Tool 矩阵 Tab**: 按分组展示 Tool 列表 + 单个 toggle + 全选/全不选
  - 顶部保存按钮 + dirty 标识 + 同步结果 toast

#### T5: 执行轨迹增强
- **`frontend/web/src/lib/debugStore.ts`** (修改): 新增 `AgenticTraceStep` 类型 + `agenticTrace` 状态 + `addTraceStep` / `clearTrace`
- **`frontend/web/src/components/studio/StudioBottomDrawer.tsx`** (修改): SSE 事件 `tool_call_start` / `tool_call_done` / `agent_thinking` 写入 agenticTrace
- **`frontend/web/src/components/studio/AgenticDebugPanel.tsx`** (修改):
  - 轨迹 Tab 优先使用 agenticTrace 结构化数据
  - 新增 **Tokens** 子 Tab: 工具调用频次柱状图
  - **Compare** 子 Tab 增强: 运行概览对比（模式/步骤数）+ 工具调用路径双列对比（新增/缺失高亮）+ 耗时柱状图并排 + 节点变量 diff

#### T6: 全局集成 + 收尾
- **`frontend/web/src/components/studio/StudioToolbar.tsx`** (修改):
  - Agentic 智能体工作流模式: 「保存配置」+ 「重载」按钮
  - Standard 传统工作流模式专属: 逐步调试 + 同步 Prompt
- **`frontend/web/src/pages/StudioPage.tsx`** (修改):
  - Agentic 智能体工作流模式: AgenticCanvas 替代 StudioCanvas + AgenticTuningPanel 替代 DesignAssistant + 隐藏 BlockSidebar
  - 切换到 Agentic 智能体工作流模式时自动加载配置
- **`frontend/web/src/components/studio/index.ts`** (修改): 导出 AgenticTuningPanel + AgenticCanvas

## Phase 10a: Studio Agent — 已实施 ✅

> 详细计划: `docs/p10-studio-agent-plan.md`
> 实施计划: `.windsurf/plans/p10-studio-agent-implementation-a2410b.md`

### 关键决策
- **架构**: 分两阶段（P10a 增强 DesignAssistant → P10b 完整 Studio Agent）
- **YAML 生成**: Pydantic structured output → 程序化转 YAML
- **试运行**: DryRun 优先（编译校验 + 拓扑验证），用户明确要求时才全量执行

### P10a 已完成的文件清单

#### 10a-S1: 后端 Studio Agent 引擎
- **`app/core/studio_agent.py`** (新增 ~400 行):
  - 6 个 Pydantic Schema (AgentYAMLSchema, InteractionYAMLSchema, ReportSectionSchema, ReportYAMLSchema, PipelineNodeSchema/EdgeSchema/JSONSchema)
  - 4 个 schema→YAML/JSON 转换函数
  - 8 个 LangChain Tool (create_agent, create_interaction, create_report, modify_block, create_pipeline, list_blocks, validate_yaml, dry_run_pipeline)
  - `build_studio_agent()` — 构建 ReAct Agent with 动态上下文注入
  - `_dry_run_pipeline()` — 拓扑校验（节点引用检查 + 边连通性 + Kahn 环检测 + 孤立节点检测）

#### 10a-S1t: 单元测试
- **`tests/test_studio_agent.py`** (新增 ~200 行, 17 passed / 9 skipped):
  - Schema 校验: 合法/非法/边界值
  - Schema→YAML 往返一致性
  - DryRun 拓扑分析: 合法管线/断裂边/孤立节点/循环检测
  - Tool 功能 + Agent 构建 (需 langchain_core)

#### 10a-S2: /assistant/chat 升级
- **`app/main.py`** (修改 ~100 行):
  - 优先尝试构建 Studio ReAct Agent (build_studio_agent)
  - Agent 模式: astream_events → SSE 推送 tool_call/tool_done/yaml_preview
  - 降级模式: Studio Agent 构建失败 → 回退到裸 LLM 流式对话（零回归）

#### 10a-S3: DesignAssistant 前端增强
- **`frontend/web/src/components/studio/DesignAssistant.tsx`** (修改 ~80 行):
  - Message 类型扩展: tool 角色 + toolName/toolStatus/yamlPreview 字段
  - SSE 事件处理: tool_call → ToolStatusBubble, tool_done → 更新状态, yaml_preview → YAMLPreviewCard
  - ToolStatusBubble 内联组件: calling/done/error 三态展示

#### 10a-S4: YAMLPreviewCard 组件
- **`frontend/web/src/components/studio/YAMLPreviewCard.tsx`** (新增 ~150 行):
  - 类型标签 (Agent/Interaction/Report/Pipeline) + 语法高亮预览
  - "应用到画布" 按钮: Agent → studioStore.addNode, Pipeline → studioStore.loadPipeline
  - "复制" 按钮
- **`frontend/web/src/components/studio/index.ts`** (修改 +1 行): 导出 YAMLPreviewCard

### P10a-UX: DesignAssistant 对话体验全面重构（已实施 ✅）

参照 Windsurf Cascade / Cursor Agent 交互范式，将 DesignAssistant 从"原始气泡聊天"重构为结构化步骤流。

#### 后端增强 (`app/main.py`)
- 新增 `thinking` SSE 事件（start/end + duration_ms）
- `tool_call` 事件增加 `tool_label` + 结构化 `args` + 友好 `args_summary`
- `tool_done` 事件增加 `result_summary` + `duration_ms` + `has_preview` + `result_detail`
- 新增 `_TOOL_LABELS` 映射、`_extract_result_summary()`、`_format_args_summary()` 辅助函数

#### 前端消息模型重构 (`DesignAssistant.tsx`)
- `Message[]` → `Turn[]` + `Step[]` 架构
- Step 类型: `thinking` / `tool_call` / `text`
- SSE 回调完全重写，映射到 Turn/Step 模型
- `updateLastAssistantSteps()` + `buildHistory()` 辅助 hooks

#### 新组件
- **`ThinkingIndicator.tsx`**: 脉冲动画 + 实时计时器，结束后折叠为 "思考 Xs"
- **`ToolCallCard.tsx`**: 可折叠卡片（图标+工具名+参数摘要+状态徽章+耗时），展开显示完整参数和结果
- **`StepTimeline.tsx`**: 左侧竖线进度时间线，圆点节点驱动 running/done/error 状态
- **`YAMLPreviewCard.tsx`**: 新增 `compact` prop，支持内嵌到 ToolCallCard 折叠区

#### CSS 动画 (`globals.css`)
- `thinking-pulse`: 图标脉冲
- `thinking-dot-bounce`: 三点跳动
- `timeline-dot-running`: 时间线圆点脉冲

### P10b: 完整 Studio Agent（待实施）
- **10b-S1**: DryRun 可视化（DryRunResultCard 组件）
- **10b-S2**: 全量执行（用户确认后调用 /api/v1/analyze）
- **10b-S3**: 多轮编辑上下文记忆（LangGraph checkpointer）
- **10b-S4**: 画布双向联动（创建积木 → 自动添加画布节点）

### 8 个 Studio Agent 工具
| 工具 | 说明 | 后端依赖 |
|------|------|---------|
| create_agent | 创建 Agent YAML | POST /api/v1/blocks/agents |
| create_interaction | 创建交互模式 YAML | POST /api/v1/blocks/interactions |
| create_report | 创建报告插件 YAML | POST /api/v1/blocks/reports |
| modify_block | 修改已有积木 | PUT /api/v1/blocks/{type}/{id} |
| create_pipeline | 创建 Pipeline JSON | PUT /api/v1/pipelines/{name} |
| list_blocks | 列出已注册积木 | GET /api/v1/blocks |
| validate_yaml | 校验 YAML 合规性 | Pydantic 内部校验 |
| dry_run_pipeline | 试运行管线 | PipelineCompiler.compile() |

---

## 后续建议

1. **管线模板市场** — 支持从社区导入/分享管线 JSON
2. **画布双向同步** — 运行中实时在画布边上显示数据流
3. **过滤器链组合** — 支持串联多个 filter（先清洗再格式化），Studio 画布直接拖拽编排
4. **输出 Schema 校验** — 过滤器 Agent 的 outputs 定义 JSON Schema，报告组件自动校验数据格式
5. **分析结果映射到画布** — Playground 分析完成后，"在 Studio 中打开"可将结果上下文传递到 Studio 底栏

---

## 当前任务范围约束（用户最新确认）

- 当前这条任务线的一切实现、修改、验证与计划维护，**必须严格限制在 `Novoscan-Open-Core` 项目内**。
- 不允许继续把本任务的功能实现落到 `Novoscan-Open` 根项目。
- 若发现已有实现误落在 `Novoscan-Open` 根项目，应视为错误范围，先纠偏，再在 `OpenCore` 内重做。

## 当前纠偏结论

- 用户已明确确认：本任务只看 `OpenCore`，不看 `Open`。
- 此前误落在 `Novoscan-Open/src/app/studio/*` 与相关前端上下文文件上的实现，不作为本任务有效结果。
- 根项目侧已执行最小定点回滚；从当前时点起，后续推进应全部转入：
  - `Novoscan-Open-Core/frontend/web`
  - `Novoscan-Open-Core/app`

## 当前阶段目标

- 在 `OpenCore` 内定位真实前端入口与 pause/resume 挂载点。
- 只在 `OpenCore` 范围内实现最小可见的 Agentic pause/resume 交互入口。
- 保持最小改动，不擅自扩改整体 UI 外观。

## 当前有效实现进展（仅 OpenCore）

- 已确认 `OpenCore` 的真实 Studio 页面为：
  - `frontend/web/src/pages/StudioPage.tsx`
  - 其中真正承载分析与结果的可见入口在 `frontend/web/src/components/studio/StudioBottomDrawer.tsx`
- 已确认 `frontend/web/src/hooks/useAnalysis.ts` 是前端分析状态与 SSE 事件处理的核心状态层。
- 本轮已完成的有效实现：
  - `frontend/web/src/lib/api.ts`
    - 新增 `AgenticResumeRequest`
    - 新增 `AgenticRuntimeState`
    - 新增 `resumeAgenticStream()`
    - 新增 `fetchAgenticRuntime()`
  - `frontend/web/src/hooks/useAnalysis.ts`
    - 新增 Agentic runtime / pause 相关状态字段
    - 支持处理 `hitl_interrupt`、`resume_start`、`stream_complete(status=aborted)`
    - `resume()` 已支持 `approve_and_continue` / `revise_inputs` / `abort`
  - `frontend/web/src/components/studio/StudioBottomDrawer.tsx`
    - 在 `ProgressTab` 中新增最小 `AgenticPauseCard`
    - 可显示 `pause_target` / `pause_phase` / `waiting_for` / `pending_final_score` / `tool_calls_count`
    - 支持 `继续执行` / `修正输入` / `终止运行`
  - `frontend/web/src/pages/ReportsPage.tsx`
    - 已同步补齐 `AnalysisState` 新字段，消除类型不一致
- 当前验证状态：
  - `OpenCore` 前端已完成构建验证：`npm run build` 通过
  - 当前尚未重新执行一轮基于 `OpenCore` 前端入口的真实 pause/resume 联调；若继续验证，下一步应启动 `frontend/web` 的 Vite 开发服务并临时开启 Agentic DSL 中断点

## 当前真实联调结果（仅 OpenCore）

- 已启动：
  - `OpenCore` 后端：`http://127.0.0.1:8001`
  - `OpenCore` 前端：`frontend/web` 的 Vite dev server，端口 `5173`
  - 已确认 `frontend/web/vite.config.ts` 中 `/api` 与 `/health` 会代理到 `8001`
- 本轮真实联调走的是 **`OpenCore` 前端代理链路**，不是根项目代理：
  - 分析入口：`http://127.0.0.1:5173/api/v1/analyze/agentic/stream`
  - 恢复入口：`http://127.0.0.1:5173/api/v1/agentic/thread/{thread_id}/resume/stream`
  - runtime 查询：`http://127.0.0.1:5173/api/v1/agentic/thread/{thread_id}`
- 为验证 pause/resume，已临时把 Agentic DSL 的 `interrupt_before` 切到：
  - `[{"target":"workflow.entry","reason":"temporary opencore studio verification"}]`
- 验证结果：
  - `start -> pause`：成功，线程 `49c6a685-b1ca-42a3-b13d-344eeab6a5dd` 收到 `hitl_interrupt`，`pause_target=workflow.entry`
  - `approve_and_continue`：成功，流式事件为 `resume_start -> stream_complete -> stream_end`，runtime 最终 `status=completed`
  - `revise_inputs`：成功，线程 `f1c28dd1-d4a5-4d54-9926-13a502bb604e`，流式事件为 `resume_start -> stream_complete -> stream_end`，runtime 最终 `status=completed`
  - `abort`：成功，线程 `e7d85513-e705-4559-8680-625854659060`，流式事件为 `resume_start -> stream_complete -> stream_end`，runtime 最终 `status=aborted`
- 结论：
  - `OpenCore` 内本轮新增的最小 Agentic pause/resume 可见入口，其底层前端调用链与恢复动作映射已真实打通
  - 本轮未暴露新的 `OpenCore` 前端映射问题，因此未再追加新的前端修复补丁
- 验证完成后已恢复 DSL 原值：
  - `interrupt_before=[]`
  - `interrupt_after=[]`

## 下一阶段实施进展（2026-04-16）

- 本轮继续严格限制在 `Novoscan-Open-Core` 范围内，未触碰根项目 `Novoscan-Open`。
- 已完成阶段 1：共享 Agentic paused 组件抽离。
  - 新增 `frontend/web/src/components/studio/AgenticPauseCard.tsx`
  - 将原先内联在 `frontend/web/src/components/studio/StudioBottomDrawer.tsx` 中的 Agentic paused 卡片提取为独立组件
  - 保持现有视觉样式与交互文案，不做整体 UI 风格改造
- 已完成阶段 2：第二页面入口复用。
  - `frontend/web/src/pages/AnalysisStudioPage.tsx` 已接入共享 `AgenticPauseCard`
  - `AnalysisStudioPage` 现已在 `awaiting_confirmation` 时区分：
    - `standard` 模式继续走 `IntentConfirm`
    - `agentic` 模式改为复用共享 paused 卡片
  - 当前 `StudioBottomDrawer` 与 `AnalysisStudioPage` 的 Agentic 恢复动作均已统一为：
    - `approve_and_continue`
    - `revise_inputs`
    - `abort`
- 已开始阶段 3：回归验证资产沉淀。
  - 新增 `tests/test_phase10_agentic_pause_resume.py`
  - 覆盖目标为：
    - `interrupt_before -> pause`
    - `approve_and_continue`
    - `revise_inputs`
    - `abort`
    - runtime 查询状态断言
  - 本测试文件按现有项目约定在缺少 `langchain_core` 时自动跳过，避免测试收集直接失败
- 已完成本轮验证：
  - `frontend/web`：`npx tsc --noEmit -p tsconfig.json` 通过
  - `frontend/web`：`npm run build` 通过
  - `tests/test_phase10_agentic_pause_resume.py`：`python -m py_compile` 通过
- 已补充工程收口：
  - `frontend/web/src/hooks/useAnalysis.ts` 新增统一 helper：`isAgenticPaused(state)`
  - `frontend/web/src/components/studio/StudioBottomDrawer.tsx` 与 `frontend/web/src/pages/AnalysisStudioPage.tsx` 已改为复用 `isAgenticPaused(state)`，不再各自复制 paused 条件判断
  - `frontend/web/src/components/studio/index.ts` 已补充 `AgenticPauseCard` 导出
- 已追加验证：
  - `frontend/web`：`npx tsc --noEmit -p tsconfig.json` 再次通过
  - `frontend/web`：`npm run build` 再次通过
- 当前结论：
  - `OpenCore` 侧 Agentic paused 入口已从单点内联实现升级为可复用组件
  - `StudioBottomDrawer` 与 `AnalysisStudioPage` 两处可见入口已对齐相同的 Agentic pause/resume 语义
  - pause/resume 的最小自动化回归测试资产已落地，但在当前缺少 `langchain_core` 的环境下只能完成语法校验，需在完整依赖环境中执行 pytest 断言

## 三建议实施进展（2026-04-17）

- 已完成前端 paused 动作入口的 runtime 化收口：
  - `frontend/web/src/components/studio/AgenticPauseCard.tsx` 现已优先消费 `state.runtimeState?.resume_actions`
  - 已支持按 runtime 下发顺序与 label 渲染 `approve_and_continue`、`revise_inputs`、`abort`
  - runtime 未返回动作时，仍回退到当前三动作默认集
  - 对未知动作 ID 采用禁用展示与提示文案降级，避免前端盲目执行未识别动作
- 已扩展后端 pause/resume 回归测试资产：
  - `tests/test_phase10_agentic_pause_resume.py` 已补 `interrupt_after / workflow.complete / after_execution` 路径
  - 已覆盖：
    - 初次 `interrupt_after` 暂停
    - `after_execution` 下 `approve_and_continue` 直接完成且不重跑执行函数
    - `after_execution` 下 `revise_inputs` 重跑并更新 request / extra_instructions
    - `after_execution` 下 `abort` 终止运行
- 已完成本轮验证：
  - `frontend/web`：`npx tsc --noEmit -p tsconfig.json` 通过
  - `frontend/web`：`npm run build` 通过
  - `tests/test_phase10_agentic_pause_resume.py`：`python -c "import py_compile; py_compile.compile('tests/test_phase10_agentic_pause_resume.py', doraise=True); print('ok')"` 通过
  - `tests/test_phase10_agentic_pause_resume.py`：`python -m pytest .\tests\test_phase10_agentic_pause_resume.py -q` 当前环境结果为 `1 skipped`
- 已确认当前 Python 基线：
  - 系统 Python：`3.14.0`
  - `pytest` 可用
  - 项目内尚无 `.venv`
  - 当前系统环境缺少 `langchain_core`
- 当前结论：
  - OpenCore 前端 paused 卡片现已真正以 runtime truth model 为优先动作来源
  - `interrupt_after` 的关键后端语义已沉淀进 pytest 资产
  - **阶段 1 已完成**（2026-04-21）：
    - 已创建 OpenCore 本地 `.venv`（Python 3.14.0）
    - 已安装项目依赖（langchain-core、langgraph、fastapi、pytest 等）
    - 已修复 `test_phase10_agentic_pause_resume.py` fixture，使用 `importlib.reload` 确保 monkeypatch 生效
    - 已修复 `test_phase7_agentic.py` 中过时的 503 测试，改为验证当前动态构建行为
    - **pytest 全量通过**：`test_phase7_agentic.py` + `test_phase8a_sse.py` + `test_phase10_agentic_pause_resume.py` = **20 passed**
  - 三建议实施全部完成：前端 runtime 动作驱动、interrupt_after 回归覆盖、Python 环境基线
