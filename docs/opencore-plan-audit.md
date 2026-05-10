# OpenCore_Plan 全量核对审计报告

> 基于 `OpenCore_Plan` v3（细化到最小步骤）逐项核对代码库实际实现情况。

---

## Phase 0.5: 积木协议层

| Step | 计划 | 实际 | 状态 |
|------|------|------|------|
| 0.5.1 | BlockMeta 数据模型 | `app/core/base.py` — `BlockMeta(BaseModel)` 含 id/name/description/version/category/inputs/outputs/config_schema | ✅ |
| 0.5.2 | AgentBlock 基类 — `run_as_node` + `as_tool` + `from_yaml` | `app/core/base.py` — 三个接口全部实现 | ✅ |
| 0.5.3 | InteractionBlock 基类 — roles + run + as_tool | `app/core/base.py` — `InteractionBlock` + `InteractionMeta` + `RoleSpec` | ✅ |
| 0.5.4 | ReportBlock 基类 — requires + sections + generate | `app/core/base.py` — `ReportBlock` + `ReportMeta` + `ReportSection` | ✅ |
| 0.5.5 | BlockRegistry — scan + get_agent/interaction/report + list_all | `app/core/registry.py` — 完整实现含 _builtin/_custom 扫描 | ✅ |
| 0.5.6 | PipelineCompiler 编译器 | `app/core/compiler.py` — 支持条件边 + interrupt_before + JSON→StateGraph | ✅ |
| 0.5.7 | 验收测试 | `tests/test_phase05_blocks.py` 存在 | ✅ |

---

## Phase 1: HITL 意图循环

| Step | 计划 | 实际 | 状态 |
|------|------|------|------|
| 1.1 | 意图分析 Prompt | `app/prompts/intent.py` — INTENT_SYSTEM_PROMPT + FIRST + REVISION | ✅ |
| 1.2 | intent_analyzer YAML | `app/agents/_builtin/intent_analyzer.yaml` | ✅ |
| 1.3 | Intent 节点 — AgentBlock 双重接口 + structured_output | `app/nodes/intent.py` — IntentAnalyzerBlock + user_feedback 修正逻辑 | ✅ |
| 1.4 | HITL 循环子图 — intent→human_check→[修正/确认] | `app/graph.py` — check_confirmation 条件路由 + interrupt_before | ✅ |
| 1.5 | API 端点 — /analyze + /resume | `app/main.py` — 两个端点均存在 | ✅ |
| 1.6 | 集成测试 | `tests/test_phase1_hitl.py` 存在 | ✅ |

---

## Phase 2: ReAct 智能检索

| Step | 计划 | 实际 | 状态 |
|------|------|------|------|
| 2.1 | 5个搜索工具 + @tool | `app/tools/search.py` — openalex/arxiv/brave/github/crossref 全部搬运 | ✅ |
| 2.2 | 工具路由过滤 get_tools_for_type | `app/core/tool_registry.py` — `get_tools(detection_type)` （位置不同但功能等价） | ✅ |
| 2.3 | react_retriever YAML | `app/agents/_builtin/react_retriever.yaml` | ✅ |
| 2.4 | ReAct 节点 — create_react_agent + search_history | `app/nodes/retrieval.py` — ReActRetrieverBlock + thought/action/observation 提取 | ✅ |
| 2.5 | 图拓扑扩展 | `app/graph.py` — retrieval 节点已注册 | ✅ |
| 2.6 | 集成测试 | `tests/test_phase2_retrieval.py` 存在 | ✅ |

---

## Phase 3: 三 Agent 并行评分

| Step | 计划 | 实际 | 状态 |
|------|------|------|------|
| 3.1 | EvaluationResult Schema | `app/schemas/agent_output.py` — AgentOutput（名称不同但字段完整：score/reasoning/confidence/evidence） | ✅ |
| 3.2 | 三份 Agent YAML | `academic_scorer.yaml` + `industry_analyst.yaml` + `competitor_detective.yaml` | ✅ |
| 3.3 | 通用评分执行器 — Registry动态发现 + asyncio.gather + score_gap | `app/nodes/scoring.py` — 完整实现 | ✅ |
| 3.4 | parallel_eval 交互模式 YAML | `parallel_eval.yaml` 已补建（含 parallel/score_gap_threshold/auto_discover 配置） | ✅ |
| 3.5 | 图拓扑扩展 | `app/graph.py` — scoring 节点已注册 | ✅ |
| 3.6 | 自定义 Agent 验证测试 | `test_phase3_custom_agent.py` 已补建（动态放入/移除/元数据校验） | ✅ |
| 3.7 | 集成测试 | `tests/test_phase3_scoring.py` 存在 | ✅ |

---

## Phase 4: 多 Agent 多轮辩论

| Step | 计划 | 实际 | 状态 |
|------|------|------|------|
| 4.1 | adversarial_debate YAML | `app/interactions/_builtin/adversarial_debate.yaml` | ✅ |
| 4.2 | Moderator Prompt | `app/prompts/moderator.py` — 宣布/每轮判定/最终裁决 三种 Prompt | ✅ |
| 4.3 | 辩论循环子图 | `app/nodes/debate.py` — DebateSubState StateGraph + moderator_announce→pro→con→round_judge→check | ✅ |
| 4.4 | K.O. 机制 | 代码级 K.O. 追踪 — 连续2轮同方获胜提前终止 | ✅ |
| 4.5 | 图拓扑 — score_gap条件路由 | `app/graph.py` — check_debate_needed 条件边 | ✅ |
| 4.6 | 集成测试 | `tests/test_phase4_debate.py` 存在 | ✅ |

---

## Phase 5: 仲裁 + 质量门 + 报告

| Step | 计划 | 实际 | 状态 |
|------|------|------|------|
| 5.1 | 仲裁节点 | `app/nodes/arbitration.py` — 加权终裁 + ArbitrationResult | ✅ |
| 5.2 | 质量门 — 7点纯逻辑检查 | `app/nodes/quality.py` — 7项检查全部实现 | ✅ |
| 5.3 | FinalReport Schema — camelCase by_alias | `app/schemas/final_report.py` — 全字段 serialization_alias + model_dump(by_alias=True) | ✅ |
| 5.4 | innovation_radar YAML | `app/reports/_builtin/innovation_radar.yaml` | ✅ |
| 5.5 | 通用报告生成器 — YAML→数据提取→LLM摘要 | `app/nodes/report.py`（命名不同）— report_assembly_node + LLM生成型section | ✅ |
| 5.6 | standard.json | `app/pipelines/standard.json` | ✅ |
| 5.7 | 图拓扑完成 | `app/graph.py` — intent→human→retrieval→scoring→debate→arbitration→quality→report→END | ✅ |
| 5.8 | 端到端测试 | `tests/test_phase5_arbitration.py` + `test_phase5_supplements.py` + `test_phase6_e2e.py` | ✅ |

---

## Phase 6: Streamlit 调试前端

| Step | 计划 | 实际 | 状态 |
|------|------|------|------|
| 6.1 | 基础页面框架 | `frontend/app.py` — 输入区+步骤追踪+输出区 | ✅ |
| 6.2 | 意图交互页 — 输入+确认/修正 | 确认/修正按钮 + resume API 调用 | ✅ |
| 6.3 | 检索进度可视化 | search_history 逐条展示 + 工具调用计数 | ✅ |
| 6.4 | 评分结果展示 — 柱状图+分差 | bar_chart + dataframe | ✅ |
| 6.5 | 辩论实况显示 — 逐条发言+每轮胜负 | debate_history 展示 + winner 标记 | ✅ |
| 6.6 | 报告输出展示 | report_json 结构化展示 + 雷达图数据 | ✅ |
| 6.7 | 积木浏览器 | 侧边栏 — 列出所有 Agent/Interaction/Report YAML | ✅ |
| 6.8-6.9 | 端到端验收 + Bug修复 | `tests/test_phase6_e2e.py` + `sandbox/test_e2e.py` | ✅ |

---

## Phase 7: Agentic Mode

| Step | 计划 | 实际 | 状态 |
|------|------|------|------|
| 7.1 | 超级 ReAct Agent orchestrator | `app/core/orchestrator.py` — build_agentic_graph + create_react_agent + JSON配置 | ✅ |
| 7.2 | 全部积木 .as_tool() 暴露 | orchestrator 中 _build_*_tools 系列函数 | ✅ |
| 7.3 | /api/v1/analyze/agentic 端点 | `app/main.py` — POST endpoint + SSE stream variant | ✅ |
| 7.4 | Standard vs Agentic 对比验证 | `tests/test_phase7_agentic.py` 存在 | ✅ |

---

## Phase 8: 前端搬运

| Step | 计划 | 实际 | 状态 |
|------|------|------|------|
| 8.1 | React 前端 | `frontend/web/` — Vite + React + TailwindCSS + Zustand 完整实现 | ✅ |
| 8.2 | SSE 流式前端 | `tests/test_phase8a_sse.py` + StudioBottomDrawer SSE 解析 | ✅ |

---

## Phase 9: PyInstaller 打包 ❌

| Step | 计划 | 实际 | 状态 |
|------|------|------|------|
| 9.1 | PyInstaller .spec 文件 | 不存在 | ❌ |
| 9.2 | Inno Setup 安装器 | 不存在 | ❌ |
| 9.3 | config.yaml 用户友好配置 | 不存在（目前用 .env） | ❌ |

---

## Phase 10: Studio Agent ❌

| Step | 计划 | 实际 | 状态 |
|------|------|------|------|
| 10.1 | studio_agent_tools 工具集 | 不存在 | ❌ |
| 10.2 | 自然语言→YAML 生成 | 不存在 | ❌ |
| 10.3 | 自然语言→Pipeline JSON 生成 | 不存在 | ❌ |
| 10.4 | 注册到积木库 + 试运行 | 不存在 | ❌ |

---

## 总结

| 指标 | 数值 |
|------|------|
| 计划 Phase 总数 | 10 (P0.5 - P10) |
| **完全实现** | **P0.5, P1, P2, P4, P5, P6, P7, P8** = 8 个 Phase |
| **完全实现** | **P3** — 偏差已补全 |
| **完全未实现** | **P9（打包）, P10（Studio Agent）** = 2 个 Phase |

### 细节偏差清单（已补全）

1. ~~**P3.4**~~ — 已补建 `parallel_eval.yaml`
2. ~~**P3.6**~~ — 已补建 `test_phase3_custom_agent.py`
3. **P5.5** — 计划要求 `report_generator.py`，实际为 `report.py`（功能完整，命名偏差）
4. **P2.2** — 计划要求在 `tools/__init__.py`，实际在 `core/tool_registry.py`（功能完整，位置偏差）
5. **P3.1** — 计划要求 `EvaluationResult`，实际为 `AgentOutput`（字段完整，命名偏差）

### 未实现的两大设想

| Phase | 内容 | 难度 | 备注 |
|-------|------|------|------|
| **P9** | PyInstaller打包 + Inno Setup安装器 + config.yaml | 中 | 部署发布阶段需求 |
| **P10** | Studio Agent — 自然语言创建Agent/Pipeline/Report YAML | 高 | 计划中标注"画大饼"，是终极形态 |
