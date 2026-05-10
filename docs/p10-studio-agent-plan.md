# Phase 10: Studio Agent 实现路径

> 版本: v1.0 | 状态: 待实施
> 最后更新: 2025-07
>
> 用户确认的关键决策:
> - **架构**: 分两阶段（P10a 增强 DesignAssistant → P10b 完整 Studio Agent）
> - **YAML 生成**: Pydantic structured output → 程序化转 YAML（不直接让 LLM 写 YAML）
> - **试运行**: DryRun 优先（编译校验 + 拓扑验证），用户明确要求时才全量执行

---

## 一、行业调研总结

### 1.1 大厂方案对比

| 产品 | 核心思路 | 配置格式 | NL→Config 方式 | 参考价值 |
|------|---------|----------|----------------|---------|
| **OpenAI GPT Builder** | 对话式创建 GPT：LLM 引导用户描述 → 自动填充 Name/Instructions/Tools/Knowledge | JSON (内部) | LLM 直接生成结构化配置，用户在 Configure 面板微调 | 对话引导式创建流程设计 |
| **Coze (ByteDance)** | 自然语言创建 Bot/Workflow：描述需求 → 自动生成工作流节点拓扑 | JSON (内部) | NL → Workflow JSON，支持可视化编辑 | 自然语言到工作流拓扑生成 |
| **CrewAI** | YAML-first 定义 Agent/Task/Crew，Pydantic 校验 | YAML | 开发者手写 YAML，CLI 脚手架生成模板 | YAML Schema 设计、Pydantic 校验模式 |
| **Dify** | 可视化 Workflow 编辑器 + Agent Node，DSL 导出 | YAML/JSON DSL | 可视化拖拽，无 NL 生成 | 工作流 DSL 设计、节点编排 |
| **LangGraph Studio** | Agent IDE：可视化调试 + 状态检查 + 断点 | Python 代码 | 无 NL 生成，代码定义 | 调试/可视化/状态检查 |

### 1.2 关键设计洞察

1. **Structured Output 是生产级方案**
   - OpenAI GPT Builder 和 Coze 都用 LLM 结构化输出（JSON Schema 约束），而非自由文本
   - LangChain `with_structured_output()` + Pydantic 是最成熟的实现路径
   - CrewAI 虽然用 YAML，但内部全部走 Pydantic 校验

2. **对话引导式创建 > 一步到位生成**
   - GPT Builder 通过多轮对话逐步完善配置（先名字→再能力→再调优）
   - 我们的 Studio Agent 也应该支持"渐进式"创建，而非试图一句话生成完美 YAML

3. **DryRun 是标准做法**
   - LangGraph Studio 的核心是 debug/inspect，不是自动执行
   - Dify 支持"测试运行"（sandbox），与生产分离
   - 我们的 DryRun（编译校验 + 拓扑图生成）对应这个理念

4. **Tool Calling 是 Agent 执行的标准范式**
   - 所有方案都基于 Tool/Function Calling 让 Agent 操作外部系统
   - 我们已有 `orchestrator.py` 的 ReAct Agent + Tool 模式，可直接复用

---

## 二、整体架构设计

```
┌─────────────────────────────────────────────────┐
│                 Studio 前端                       │
│  ┌───────────────┐  ┌────────────────────────┐  │
│  │ StudioCanvas   │  │ DesignAssistant (右栏) │  │
│  │ (Pipeline 画布)│  │  - 对话面板 (SSE 流)   │  │
│  │               │  │  - YAML/JSON 预览卡片   │  │
│  │               │  │  - "应用到画布" 按钮    │  │
│  └───────────────┘  └────────────────────────┘  │
└──────────────┬──────────────────┬────────────────┘
               │ REST/SSE         │
┌──────────────▼──────────────────▼────────────────┐
│              后端 API 层                          │
│  POST /api/v1/assistant/chat  (SSE 流式)         │
│  ┌───────────────────────────────────────────┐   │
│  │     Studio ReAct Agent (LangGraph)        │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐    │   │
│  │  │create_  │ │modify_  │ │validate_ │    │   │
│  │  │agent    │ │agent    │ │yaml      │    │   │
│  │  ├─────────┤ ├─────────┤ ├──────────┤    │   │
│  │  │create_  │ │create_  │ │dry_run_  │    │   │
│  │  │interact.│ │pipeline │ │pipeline  │    │   │
│  │  ├─────────┤ ├─────────┤ ├──────────┤    │   │
│  │  │create_  │ │list_    │ │register_ │    │   │
│  │  │report   │ │blocks   │ │block     │    │   │
│  │  └─────────┘ └─────────┘ └──────────┘    │   │
│  └───────────────────────────────────────────┘   │
│           │ 调用                                  │
│  ┌────────▼──────────────────────────────────┐   │
│  │  已有 Backend API (CRUD)                   │   │
│  │  POST /api/v1/blocks/{type}  (创建)       │   │
│  │  PUT  /api/v1/blocks/{type}/{id} (更新)   │   │
│  │  GET  /api/v1/blocks  (列表)              │   │
│  │  PUT  /api/v1/pipelines/{name}  (保存)    │   │
│  │  PipelineCompiler.compile()  (DryRun)     │   │
│  └───────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

---

## 三、Pydantic Schema 定义（YAML 生成核心）

Studio Agent 的 Tool 输出全部通过 Pydantic 约束，确保 100% 合规。

### 3.1 Agent YAML Schema

```python
class AgentYAMLSchema(BaseModel):
    """Agent 积木 YAML 的 Pydantic Schema — LLM structured output 用"""
    id: str = Field(..., description="唯一标识，snake_case，如 'market_analyst'")
    name: str = Field(..., description="展示名，如 '市场分析师'")
    description: str = Field(..., description="一句话说明")
    version: str = Field(default="1.0")
    category: Literal["scoring", "retrieval", "intent", "orchestration", "transform", "custom"]
    role_type: Literal[
        "orchestrator", "monitor", "planner", "executor", "evaluator",
        "critic", "synthesizer", "gatekeeper", "reporter", "custom",
        "filter", "retriever", "mediator", "memory_keeper"
    ]
    notes: str = Field(default="", description="补充说明")
    inputs: list[str] = Field(default_factory=lambda: ["retrieved_context", "analyzed_intent"])
    outputs: list[str] = Field(default_factory=lambda: ["evaluation_results"])
    prompt: str = Field(..., description="Agent 的系统 Prompt，明确角色、任务和输出要求")
    temperature: float = Field(default=0.3, ge=0, le=1)
```

### 3.2 Interaction YAML Schema

```python
class InteractionYAMLSchema(BaseModel):
    """交互模式 YAML 的 Pydantic Schema"""
    id: str
    name: str
    description: str
    version: str = "1.0"
    category: Literal["interaction"]
    notes: str = ""
    inputs: list[str]
    outputs: list[str]
    roles: dict[str, str]  # 如 {"evaluators": "2..n", "moderator": "1"}
    config: dict[str, Any]  # 自由配置字段
```

### 3.3 Report YAML Schema

```python
class ReportYAMLSchema(BaseModel):
    """报告插件 YAML 的 Pydantic Schema"""
    id: str
    name: str
    description: str
    version: str = "1.0"
    category: Literal["report"]
    notes: str = ""
    requires: list[str]  # 依赖的 Agent ID
    sections: list[ReportSectionSchema]

class ReportSectionSchema(BaseModel):
    id: str
    type: Literal["llm_generated", "radar", "bar_chart", "table", "markdown_card"]
    layout: dict  # {width: "full"|"half", height?: int}
    prompt: str | None = None
    dimensions: list[dict] | None = None
    columns: list[str] | None = None
    source: str | None = None
```

### 3.4 Pipeline JSON Schema

```python
class PipelineNodeSchema(BaseModel):
    id: str
    type: Literal["agent", "interaction", "report", "logic"]
    agent_id: str | None = None
    interaction_id: str | None = None
    report_id: str | None = None
    description: str
    config: dict | None = None

class PipelineEdgeSchema(BaseModel):
    from_node: str = Field(alias="from")  # "START" 或 node_id
    to_node: str = Field(alias="to")      # "END" 或 node_id
    condition: str | None = None

class PipelineJSONSchema(BaseModel):
    name: str
    version: str = "1.0"
    description: str
    nodes: list[PipelineNodeSchema]
    edges: list[PipelineEdgeSchema]
    interrupt_before: list[str] = Field(default_factory=list)
```

---

## 四、8 个 Studio Agent 工具定义

| # | 工具名 | 输入 | 输出 | 调用的后端 API |
|---|--------|------|------|---------------|
| 1 | `create_agent` | AgentYAMLSchema (Pydantic) | YAML 文件路径 + 注册结果 | `POST /api/v1/blocks/agents` |
| 2 | `create_interaction` | InteractionYAMLSchema | YAML 文件路径 + 注册结果 | `POST /api/v1/blocks/interactions` |
| 3 | `create_report` | ReportYAMLSchema | YAML 文件路径 + 注册结果 | `POST /api/v1/blocks/reports` |
| 4 | `modify_block` | block_type + block_id + 修改字段 | 更新后的 YAML | `PUT /api/v1/blocks/{type}/{id}` |
| 5 | `create_pipeline` | PipelineJSONSchema | Pipeline JSON 路径 | `PUT /api/v1/pipelines/{name}` |
| 6 | `list_blocks` | 可选 category/type 过滤 | 积木清单 | `GET /api/v1/blocks` |
| 7 | `validate_yaml` | YAML 内容字符串 | 校验结果 (pass/fail + 错误详情) | 内部 Pydantic 校验 |
| 8 | `dry_run_pipeline` | pipeline_name 或 pipeline_json | 编译结果 + 拓扑图 + 潜在问题 | `PipelineCompiler.compile()` |

---

## 五、分阶段实施计划

### Phase 10a: 增强 DesignAssistant（Tool Calling 接入）

> 目标: 将现有 DesignAssistant 从"纯 LLM 对话"升级为"ReAct Agent with Tools"

#### 10a-S1: 后端 — Studio Agent 引擎

**新增文件**: `app/core/studio_agent.py`

```
studio_agent.py 职责:
├── Pydantic Schema 定义 (3.1~3.4)
├── 8 个 Tool 函数实现
│   ├── create_agent_tool()      → 调用已有 create_block API
│   ├── create_interaction_tool()
│   ├── create_report_tool()
│   ├── modify_block_tool()
│   ├── create_pipeline_tool()
│   ├── list_blocks_tool()       → 调用已有 list_blocks API
│   ├── validate_yaml_tool()     → Pydantic 校验
│   └── dry_run_pipeline_tool()  → PipelineCompiler.compile()
├── build_studio_agent()         → create_react_agent(model, tools, prompt)
└── System Prompt (Studio 专用)
```

**关键实现细节**:

1. **Tool 输入使用 Pydantic Schema 约束**:
   - 每个 create_* tool 的 args_schema 就是对应的 Pydantic Schema
   - LLM 通过 `with_structured_output` 直接输出结构化数据
   - Tool 内部用 `yaml.dump(schema.model_dump(), allow_unicode=True)` 转为 YAML 文本

2. **System Prompt 设计**:
   ```
   你是 Novoscan Studio Agent，帮助用户通过自然语言创建和管理 AI 分析管线。
   
   你的能力:
   - 创建 Agent / Interaction / Report 积木（YAML 格式）
   - 创建和修改 Pipeline（JSON 格式）
   - 校验 YAML 配置的正确性
   - 试运行（DryRun）管线检查拓扑
   
   规则:
   1. 创建积木时，始终使用对应的 create_* 工具
   2. 先用 list_blocks 查看已有积木，避免重复创建
   3. 创建 Pipeline 前先创建所有必要的积木
   4. 创建后自动调用 validate_yaml 校验
   5. 用户说"试跑"/"测试"时用 dry_run_pipeline（DryRun 模式）
   6. 用户明确说"真正执行"/"全量跑"时才传 full_run=true
   
   当前已注册积木: {block_list}
   当前画布上下文: {canvas_context}
   ```

3. **Pydantic→YAML 转换函数**:
   ```python
   def schema_to_yaml(schema: BaseModel) -> str:
       """将 Pydantic Schema 转为符合积木协议的 YAML 字符串"""
       data = schema.model_dump(exclude_none=True)
       # 特殊处理: prompt 放入 config_schema
       if "prompt" in data:
           data.setdefault("config_schema", {})
           data["config_schema"]["prompt"] = {
               "type": "text",
               "default": data.pop("prompt"),
               "description": f"{data['name']}的系统 Prompt"
           }
       if "temperature" in data:
           data.setdefault("config_schema", {})
           data["config_schema"]["temperature"] = {
               "type": "float",
               "default": data.pop("temperature"),
               "min": 0, "max": 1,
               "description": "模型温度"
           }
       return yaml.dump(data, allow_unicode=True, default_flow_style=False, sort_keys=False)
   ```

#### 10a-S2: 后端 — /assistant/chat 端点升级

**修改文件**: `app/main.py`

将现有的纯 LLM 流式对话升级为 ReAct Agent 流式执行:

```
改动点:
1. assistant_chat_stream() 内部:
   - 当 LLM 可用时，构建 Studio ReAct Agent（而非裸 LLM）
   - 使用 agent.astream_events() 获取流式事件
   - SSE 事件类型扩展:
     - token:     LLM 生成的文本 token（与现有兼容）
     - tool_call: Agent 调用工具（工具名 + 参数摘要）
     - tool_done: 工具返回结果（成功/失败 + 摘要）
     - yaml_preview: 生成的 YAML/JSON 预览（供前端渲染卡片）
     - done:      完成
     - error:     错误
2. 保留 LLM 不可用时的 placeholder 降级逻辑
```

#### 10a-S3: 前端 — DesignAssistant 增强

**修改文件**: `frontend/web/src/components/studio/DesignAssistant.tsx`

```
改动点:
1. 新增消息类型:
   - tool_call: 显示"正在调用 create_agent..."状态条
   - tool_done: 显示结果摘要（成功/失败）
   - yaml_preview: YAML/JSON 代码预览卡片 + "应用到画布" 按钮

2. SSE 事件处理扩展 (consumeSSE):
   - tool_call  → 追加工具调用状态消息
   - tool_done  → 更新工具调用结果
   - yaml_preview → 渲染代码预览卡片

3. "应用到画布" 按钮:
   - Agent YAML → 调用已有 studioStore.addNode()
   - Pipeline JSON → 调用 studioStore.loadPipeline()

4. 快捷命令更新:
   - "创建评分 Agent" → 实际触发 create_agent tool
   - "管线优化建议" → 实际触发 list_blocks + 分析
```

**新增文件**: `frontend/web/src/components/studio/YAMLPreviewCard.tsx`

```
YAMLPreviewCard 组件:
├── YAML/JSON 代码块（语法高亮）
├── 积木类型标签（Agent/Interaction/Report/Pipeline）
├── "应用到画布" 按钮
├── "复制" 按钮
└── "编辑" 按钮（打开 AgentDesigner / NodeConfigDrawer）
```

#### 10a-S4: 前端 — SSE 协议扩展

**修改文件**: `frontend/web/src/lib/sse.ts`

```
新增事件类型处理:
- tool_call:    { tool_name: string, args_summary: string }
- tool_done:    { tool_name: string, success: boolean, summary: string }
- yaml_preview: { type: "agent"|"interaction"|"report"|"pipeline", content: string, id: string }
```

#### 10a 交付物清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/core/studio_agent.py` | 新增 | Studio Agent 引擎 + 8 个 Tool + Pydantic Schema |
| `app/main.py` | 修改 | /assistant/chat 升级为 ReAct Agent |
| `frontend/.../DesignAssistant.tsx` | 修改 | 新消息类型 + SSE 扩展 |
| `frontend/.../YAMLPreviewCard.tsx` | 新增 | YAML/JSON 预览卡片组件 |
| `frontend/.../sse.ts` | 修改 | 新事件类型 |
| `frontend/.../api.ts` | 修改 | 类型更新 |
| `tests/test_studio_agent.py` | 新增 | Tool 单元测试 |

---

### Phase 10b: 完整 Studio Agent（高级能力）

> 目标: 在 10a 基础上扩展高级功能

#### 10b-S1: DryRun 可视化

```
dry_run_pipeline 工具返回:
├── compilation_success: bool
├── node_count / edge_count: int
├── topology_warnings: list[str]  (循环检测、孤立节点等)
├── missing_blocks: list[str]     (Pipeline 引用但未注册的积木)
└── estimated_steps: int          (预估执行步数)

前端展示:
├── DryRunResultCard 组件
│   ├── 编译状态（✅/❌）
│   ├── 拓扑摘要（节点数、边数）
│   ├── 警告列表
│   └── "在画布中查看" 按钮 → 加载 Pipeline 到画布
```

#### 10b-S2: 全量执行（用户明确确认）

```
当用户说"真正跑一下"时:
1. Studio Agent 调用 dry_run_pipeline(full_run=true)
2. 前端弹出确认对话框: "将消耗 LLM Token，确认执行？"
3. 用户确认后 → 调用已有 /api/v1/analyze 端点
4. 实时进度通过 SSE 回传到 DesignAssistant 面板
```

#### 10b-S3: 多轮编辑 + 上下文记忆

```
增强 Studio Agent 的上下文感知:
1. 对话历史中追踪已创建的积木 ID 列表
2. "修改刚才创建的 Agent" → 自动定位到最近的 block_id
3. "把刚才的 Agent 加到管线里" → 自动引用上下文
4. 使用 LangGraph checkpointer 持久化对话状态
```

#### 10b-S4: 画布双向联动

```
Studio Agent 操作 → 画布实时响应:
1. create_agent 成功 → 自动在画布添加节点
2. create_pipeline 成功 → 自动切换画布显示新管线
3. modify_block 成功 → 画布节点闪烁提示已更新
4. 用户在画布选中节点 → DesignAssistant 自动感知上下文
```

#### 10b 交付物清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/core/studio_agent.py` | 修改 | DryRun 增强 + full_run |
| `frontend/.../DryRunResultCard.tsx` | 新增 | DryRun 结果可视化 |
| `frontend/.../DesignAssistant.tsx` | 修改 | 全量执行确认 + 画布联动 |
| `frontend/.../studioStore.ts` | 修改 | 画布双向联动 API |
| `tests/test_studio_agent_advanced.py` | 新增 | 高级功能测试 |

---

## 六、技术风险与缓解

| 风险 | 影响 | 缓解方案 |
|------|------|---------|
| LLM 生成的 Pydantic 输出偶尔不合规 | 创建失败 | 自动重试（最多 2 次）+ 错误信息回传让 Agent 自我修正 |
| Tool Calling 链路长导致响应慢 | 用户体验差 | SSE 实时推送每步状态，前端显示"正在创建 Agent..." |
| 模型不支持 structured output | 功能不可用 | 降级为 JSON mode + 后处理解析，最差降级到 placeholder |
| Pipeline 拓扑错误（循环/断裂） | DryRun 失败 | validate 工具前置检查，Agent 有修复能力 |
| 并发创建同名积木 | 文件冲突 | Block ID 去重检查在 create_* 工具层实现 |

---

## 七、测试策略

### 7.1 单元测试 (test_studio_agent.py)

```
1. test_agent_yaml_schema — Pydantic 校验边界值
2. test_schema_to_yaml — 转换后 yaml.safe_load 回读一致性
3. test_create_agent_tool — Mock 后端 API，验证工具调用链
4. test_validate_yaml_tool — 合法/非法 YAML 的校验结果
5. test_dry_run_pipeline_tool — Mock Compiler，验证拓扑检查
6. test_list_blocks_tool — 验证过滤逻辑
```

### 7.2 集成测试

```
1. test_assistant_chat_with_tools — 发送"创建一个评分 Agent"→验证 SSE 事件序列
2. test_roundtrip — 创建 Agent → list 确认存在 → 加入 Pipeline → DryRun 通过
3. test_error_recovery — 故意传错参数 → Agent 自动修正 → 最终成功
```

---

## 八、实施排期建议

| 阶段 | 子任务 | 预估工作量 | 依赖 |
|------|--------|-----------|------|
| **10a-S1** | studio_agent.py + Pydantic Schema + 8 Tools | 核心 | 无 |
| **10a-S2** | /assistant/chat 升级为 ReAct Agent | 核心 | S1 |
| **10a-S3** | DesignAssistant 前端增强 | 核心 | S2 |
| **10a-S4** | SSE 协议扩展 + YAMLPreviewCard | 核心 | S2 |
| **10a-T** | 单元测试 + 集成测试 | 测试 | S1~S4 |
| **10b-S1** | DryRun 可视化 | 增强 | 10a |
| **10b-S2** | 全量执行 | 增强 | 10b-S1 |
| **10b-S3** | 多轮编辑上下文 | 增强 | 10a |
| **10b-S4** | 画布双向联动 | 增强 | 10a |

建议先完成 10a 全部 → 验证可用 → 再推进 10b。

---

## 九、与现有代码的映射

| P10 组件 | 复用的现有代码 | 说明 |
|----------|--------------|------|
| Studio Agent ReAct 构建 | `orchestrator.py` `build_agentic_graph()` | 相同的 `create_react_agent` 模式 |
| Tool → 后端 CRUD | `main.py` Block/Pipeline CRUD API | 直接内部调用，不走 HTTP |
| YAML 校验 | `base.py` `BlockMeta.from_yaml()` | 复用已有 Pydantic 校验 |
| SSE 流式推送 | `main.py` `_sse_format()` + `consumeSSE()` | 扩展事件类型 |
| 前端对话面板 | `DesignAssistant.tsx` | 增强而非重写 |
| Pipeline 编译 | `compiler.py` `PipelineCompiler.compile()` | DryRun 复用 |
| 画布操作 | `studioStore.ts` `addNode()` / `loadPipeline()` | 直接调用 |
