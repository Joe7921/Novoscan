# Novoscan-Open-Core 工程上下文

## 项目定位
- 全新的 LangGraph 创新性检测引擎
- 提供接口，不提供服务（开源哲学）

## 已完成
- **Phase 0-7a+**: 全部完成，93/93 测试通过
- **P8 前端重设计**: 进行中

## P8 已完成子任务
- Phase P: 导航重命名 + Playground 改造 + StudioBottomDrawer + DesignAssistant UI
- Phase Q: 模型服务管理（对标 CherryStudio）

## Phase S: Studio 管线调试深度重构（对标 Dify） 全部完成
### S1 后端 API（已完成）
- POST /api/v1/debug/node  单节点独立执行
- GET /api/v1/debug/nodes  列出可调试节点
- GET /api/v1/debug/history  运行历史列表
- SSE 
ode_done 增强  携带 inputs/outputs/duration_ms + node_cache
- 运行历史自动写入（内存存储，_MAX_HISTORY=50）

### S2 前端调试状态（已完成）
- debugStore.ts  Zustand 全局调试状态管理
- VariableInspector.tsx  变量检查器面板
- StudioRunner + StudioBottomDrawer SSE  debugStore 联动

### S3 节点调试交互（已完成）
- NodeConfigDrawer 升级  4 Tab（配置/输入/输出/日志）+ 运行按钮 + Last Run 摘要卡
- 自动注入上游节点输出作为当前节点输入
- StudioToolbar Step-by-Step 逐步执行控制按钮
- StudioNode Last Run 调试状态角标（done/error/stale + 耗时）

### S4 Last Run + 运行历史（已完成）
- StudioNode 角标显示 debug 状态和耗时
- HistoryTab 运行历史列表 + 加载到 Inspector
- StudioToolbar 缓存清除按钮

### S5 Agentic 调优（已完成）
- AgenticDebugPanel.tsx  三子Tab面板
  - 决策轨迹: 按时间线展示 Agent 思考/工具调用/输出步骤
  - 工具诊断: 每个节点的输入/输出/耗时可展开查看
  - 对比面板: 当前运行 vs 历史运行的变量差异高亮
- 集成到 StudioBottomDrawer 新 Tab

### S6 StudioBottomDrawer 重构（已完成）
- 6 Tab: 分析 | 进度&结果 | 变量检查器 | Agentic 调试 | 运行器 | 运行历史

### S7 DesignAssistant 接真实 LLM（已完成）
- 后端 POST /api/v1/assistant/chat  SSE 流式对话端点
  - System Prompt 含画布上下文（节点/边列表）
  - 对话历史保留最近 10 轮
  - 支持 Standard/Agentic 模式区分
- 前端 SSE 流式接收 + 逐 token 渲染
- 自动降级: LLM 不可用时回退到内置 placeholder 回复
- 状态指示: "AI 对话已连接" / "未配置模型"

## 架构决策
- 模型配置: 前端 localStorage 持久化，通过 syncBackend 同步到后端
- 积木: YAML 驱动，双重接口（Node + Tool）
- 兼容层: pp/compat.py L1/L2/L2b/L2c 四级降级
- 运行端口: 8001（生产），需设置 NO_PROXY=127.0.0.1,localhost
- Debug API: 节点函数延迟初始化，通过 _NODE_FUNCTIONS 注册表映射
- 调试缓存: 前端 Zustand（内存），后端运行历史（内存，50条上限）
- Assistant Chat: LLM 失败自动降级到本地 placeholder

## 新增/修改文件清单（Phase S）
- pp/main.py  debug API + assistant chat 端点
- rontend/web/src/lib/debugStore.ts  调试 Zustand store
- rontend/web/src/lib/api.ts  debug + assistant API 函数
- rontend/web/src/components/studio/VariableInspector.tsx  变量检查器
- rontend/web/src/components/studio/AgenticDebugPanel.tsx  Agentic 调试面板
- rontend/web/src/components/studio/NodeConfigDrawer.tsx  4-Tab 升级
- rontend/web/src/components/studio/StudioNode.tsx  debug 角标
- rontend/web/src/components/studio/StudioToolbar.tsx  逐步执行控制
- rontend/web/src/components/studio/StudioBottomDrawer.tsx  Tab 扩展
- rontend/web/src/components/studio/StudioRunner.tsx  SSEdebugStore
- rontend/web/src/components/studio/DesignAssistant.tsx  LLM 对话
- rontend/web/src/components/studio/index.ts  导出注册

## 当前任务边界（2026-04-14）

- 本轮 Agentic 报告套件适配 的所有代码与文档修改，严格仅限 Novoscan-Open-Core/ 项目。
- 允许改动范围：app/、frontend/web/、docs/、tests/、Novoscan-Open-Core/.agent/。
- 禁止改动范围：仓库根目录 src/、根目录 .agent/、以及 Novoscan-Open-Core/ 之外的其他项目。
- 若后续需要同步主仓上下文，必须先得到用户明确确认。
- 当前目标：让 Agentic 模式输出适配 OpenCore 内既有官方报告套件消费合同，避免硬编码直连。

## Agentic 报告适配进展（2026-04-14）

- 已完成 backend-first 稳定化：pp/core/orchestrator.py 中评分工具与仲裁工具不再返回带前缀、截断的字符串，而是输出可解析 JSON。
- 评分工具接入 invoke_with_fallback + AgentOutput；仲裁工具接入 invoke_with_fallback + ArbitrationResult；模型或解析失败时也会返回结构化降级 JSON。
- pp/nodes/report_compiler.py 新增确定性编译路径：优先从 ToolMessage 中抽取结构化结果直接组装 FinalReport，只有在结构化数据缺失时才回退到 LLM 结构化抽取与正则降级。
- 已复核前端入口：useAnalysis.ts 与 ResultView.tsx 现有 
eport_json 消费链路可直接承接本次稳定合同，且仍保留 inalOutput 文本回退，因此本轮无需改动前端渲染入口。
- 新增 	ests/test_phase7_report_compiler.py，覆盖确定性编译成功和无结构化载荷返回 None 的最小行为。
- 已完成语法级验证：python -m py_compile app\core\orchestrator.py app\nodes\report_compiler.py tests\test_phase7_report_compiler.py。

## Agentic Debug Panel 可观测性增强（2026-04-16）

- 本轮范围继续严格限制在 Novoscan-Open-Core/，未再触碰仓库根目录 src/ 与根目录 .agent/。
- 已更新 frontend/web/src/components/studio/StudioBottomDrawer.tsx：向 AgenticDebugPanel 传入当前 analysisState。
- 已增强 frontend/web/src/components/studio/AgenticDebugPanel.tsx：
  - 新增 Runtime 子视图与顶部 runtime 概览。
  - 可展示 thread_id、status、pause_target、pause_phase、waiting_for、updated_at、resume_actions 与 runtime events。
  - 新增手动刷新 runtime 与清空 trace 能力。
  - 补齐 running / awaiting_confirmation / error 三类状态下的展示优先级，避免旧 runtime 快照误导面板。
- 已更新 frontend/web/src/hooks/useAnalysis.ts：
  - resume_start 事件开始消费 runtime_state。
  - error 事件会保留 runtimeState、pauseTarget、pausePhase、waitingFor。
- 已更新 app/main.py：
  - analyze_agentic_stream 的 error 事件补齐 runtime_state。
  - resume_agentic_stream 的 resume_start 与 error 事件补齐 runtime_state。
- 已完成验证：
  - frontend/web：npx tsc --noEmit -p tsconfig.json
  - frontend/web：npm run build
  - backend：python -c "import ast, pathlib; ast.parse(pathlib.Path('app/main.py').read_text(encoding='utf-8')); print('ok')"
- 当前结论：OpenCore Studio 已具备最小可用的 Agentic runtime 调试面板，能够直接观察线程级运行真相与暂停/错误态上下文.


## 下一阶段计划：runtime events 筛选搜索（2026-04-16）

- 用户已选择优先推进 AgenticDebugPanel 中 runtime events 的筛选与搜索能力，而不是事件联动跳转或自动刷新。
- 本阶段目标：在不改整体 UI 风格的前提下，为 Runtime 子视图中的事件列表补齐最小可用的检索能力。
- 计划细则：
  - 增加事件类型聚合与类型筛选，仅展示匹配的 runtime events。
  - 增加关键词搜索，匹配 event type 与 event data 的字符串化结果。
  - 增加筛选结果计数，明确展示当前命中条数与总条数。
  - 保持现有 Runtime 面板结构、样式变量与紧凑布局，不做全局外观改造。
  - 完成后执行 frontend/web 的 TypeScript 校验，并把结果同步回 OpenCore .agent/task.md.
