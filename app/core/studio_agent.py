"""
Novoscan-Open-Core — Studio Agent 引擎 (Phase 10a)

自然语言驱动的 Studio 设计助手核心，将 DesignAssistant 从纯 LLM 对话
升级为 ReAct Agent with Tools。

能力：
  1. create_agent        — 从 Pydantic Schema 生成 Agent YAML
  2. create_interaction  — 生成交互模式 YAML
  3. create_report       — 生成报告插件 YAML
  4. modify_block        — 修改已有积木
  5. create_pipeline     — 创建 Pipeline JSON
  6. list_blocks         — 列出已注册积木
  7. validate_yaml       — 校验 YAML 合规性
  8. dry_run_pipeline    — DryRun 管线（仅编译校验）

设计原则：
  - LLM 输出通过 Pydantic Schema 约束（structured output）
  - Tool 内部直接操作文件系统，不走 HTTP self-call
  - DryRun 仅做拓扑校验，不真实执行
"""

from __future__ import annotations

import json as _json
import logging
from pathlib import Path
from typing import Any, Literal, Optional

import yaml
from pydantic import BaseModel, Field

logger = logging.getLogger("novoscan.studio_agent")

_APP_DIR = Path(__file__).resolve().parent.parent  # → app/


# ══════════════════════════════════════════════════════════════
# Part 1: Pydantic Schema — LLM structured output 约束
# ══════════════════════════════════════════════════════════════

class AgentYAMLSchema(BaseModel):
    """Agent 积木的结构化输出 Schema"""
    id: str = Field(..., description="唯一标识，snake_case，如 'market_analyst'")
    name: str = Field(..., description="展示名，如 '市场分析师'")
    description: str = Field(..., description="一句话说明 Agent 的职责")
    version: str = Field(default="1.0")
    category: Literal[
        "scoring", "retrieval", "intent", "orchestration", "transform", "custom"
    ] = Field(..., description="积木分类")
    role_type: Literal[
        "orchestrator", "monitor", "planner", "executor", "evaluator",
        "critic", "synthesizer", "gatekeeper", "reporter", "custom",
        "filter", "retriever", "mediator", "memory_keeper"
    ] = Field(..., description="角色类型")
    notes: str = Field(default="", description="补充说明")
    inputs: list[str] = Field(
        default_factory=lambda: ["retrieved_context", "analyzed_intent"],
        description="需要的 State 字段列表",
    )
    outputs: list[str] = Field(
        default_factory=lambda: ["evaluation_results"],
        description="产出的 State 字段列表",
    )
    prompt: str = Field(..., description="Agent 的系统 Prompt，明确角色、任务和输出要求")
    temperature: float = Field(default=0.3, ge=0, le=1, description="模型温度")


class InteractionYAMLSchema(BaseModel):
    """交互模式的结构化输出 Schema"""
    id: str = Field(..., description="唯一标识，snake_case")
    name: str = Field(..., description="展示名")
    description: str = Field(..., description="一句话说明")
    version: str = Field(default="1.0")
    notes: str = Field(default="")
    inputs: list[str] = Field(..., description="输入字段列表")
    outputs: list[str] = Field(..., description="输出字段列表")
    roles: dict[str, str] = Field(
        ..., description="角色声明，如 {\"evaluators\": \"2..n\", \"moderator\": \"1\"}"
    )
    config: dict[str, Any] = Field(
        default_factory=dict, description="自由配置字段"
    )


class ReportSectionSchema(BaseModel):
    """报告章节定义"""
    id: str
    type: Literal["llm_generated", "radar", "bar_chart", "table", "markdown_card"]
    layout: dict = Field(default_factory=lambda: {"width": "full"})
    prompt: Optional[str] = None
    dimensions: Optional[list[dict]] = None
    columns: Optional[list[str]] = None
    source: Optional[str] = None


class ReportYAMLSchema(BaseModel):
    """报告插件的结构化输出 Schema"""
    id: str = Field(..., description="唯一标识，snake_case")
    name: str = Field(..., description="展示名")
    description: str = Field(..., description="一句话说明")
    version: str = Field(default="1.0")
    notes: str = Field(default="")
    requires: list[str] = Field(..., description="依赖的 Agent ID 列表")
    sections: list[ReportSectionSchema] = Field(..., description="报告章节列表")


class PipelineNodeSchema(BaseModel):
    """Pipeline 节点"""
    id: str
    type: Literal["agent", "interaction", "report", "logic"] = "agent"
    agent_id: Optional[str] = None
    interaction_id: Optional[str] = None
    report_id: Optional[str] = None
    description: str = ""


class PipelineEdgeSchema(BaseModel):
    """Pipeline 边"""
    source: str = Field(..., description="源节点 ID 或 'START'")
    target: str = Field(..., description="目标节点 ID 或 'END'")
    condition: Optional[str] = None


class PipelineJSONSchema(BaseModel):
    """Pipeline 完整定义的结构化输出 Schema"""
    name: str = Field(..., description="管线名称")
    version: str = Field(default="1.0")
    description: str = Field(default="", description="管线说明")
    nodes: list[PipelineNodeSchema] = Field(..., description="节点列表")
    edges: list[PipelineEdgeSchema] = Field(..., description="边列表")
    interrupt_before: list[str] = Field(
        default_factory=list, description="HITL 中断点节点 ID"
    )


# ══════════════════════════════════════════════════════════════
# Part 2: Schema → YAML/JSON 转换
# ══════════════════════════════════════════════════════════════

def agent_schema_to_yaml(schema: AgentYAMLSchema) -> str:
    """将 AgentYAMLSchema 转为符合积木协议的 YAML 字符串"""
    data: dict[str, Any] = {
        "id": schema.id,
        "name": schema.name,
        "description": schema.description,
        "version": schema.version,
        "category": schema.category,
        "role_type": schema.role_type,
    }
    if schema.notes:
        data["notes"] = schema.notes
    data["inputs"] = schema.inputs
    data["outputs"] = schema.outputs
    data["config_schema"] = {
        "prompt": {
            "type": "text",
            "default": schema.prompt,
            "description": f"{schema.name}的系统 Prompt",
        },
        "temperature": {
            "type": "float",
            "default": schema.temperature,
            "min": 0,
            "max": 1,
            "description": "模型温度",
        },
    }
    return yaml.dump(data, allow_unicode=True, default_flow_style=False, sort_keys=False)


def interaction_schema_to_yaml(schema: InteractionYAMLSchema) -> str:
    """将 InteractionYAMLSchema 转为 YAML"""
    data: dict[str, Any] = {
        "id": schema.id,
        "name": schema.name,
        "description": schema.description,
        "version": schema.version,
        "category": "interaction",
    }
    if schema.notes:
        data["notes"] = schema.notes
    data["inputs"] = schema.inputs
    data["outputs"] = schema.outputs
    data["roles"] = schema.roles
    if schema.config:
        data["config"] = schema.config
    return yaml.dump(data, allow_unicode=True, default_flow_style=False, sort_keys=False)


def report_schema_to_yaml(schema: ReportYAMLSchema) -> str:
    """将 ReportYAMLSchema 转为 YAML"""
    data: dict[str, Any] = {
        "id": schema.id,
        "name": schema.name,
        "description": schema.description,
        "version": schema.version,
        "category": "report",
    }
    if schema.notes:
        data["notes"] = schema.notes
    data["requires"] = schema.requires
    data["sections"] = [s.model_dump(exclude_none=True) for s in schema.sections]
    return yaml.dump(data, allow_unicode=True, default_flow_style=False, sort_keys=False)


def pipeline_schema_to_json(schema: PipelineJSONSchema) -> str:
    """将 PipelineJSONSchema 转为符合 PipelineCompiler 格式的 JSON"""
    data = {
        "name": schema.name,
        "version": schema.version,
        "description": schema.description,
        "nodes": [n.model_dump(exclude_none=True) for n in schema.nodes],
        "edges": [
            {
                "from": e.source,
                "to": e.target,
                **({"condition": e.condition} if e.condition else {}),
            }
            for e in schema.edges
        ],
        "interrupt_before": schema.interrupt_before,
    }
    return _json.dumps(data, ensure_ascii=False, indent=2)


# ══════════════════════════════════════════════════════════════
# Part 3: 内部工具函数
# ══════════════════════════════════════════════════════════════

def _write_block_yaml(block_type: str, block_id: str, yaml_content: str) -> dict:
    """写入 YAML 到 _custom/ 目录 + 热加载 Registry"""
    custom_dir = _APP_DIR / block_type / "_custom"
    custom_dir.mkdir(parents=True, exist_ok=True)
    filepath = custom_dir / f"{block_id}.yaml"
    if filepath.exists():
        return {"status": "conflict", "message": f"积木 '{block_id}' 已存在，请更换 id 或使用 modify_block 修改"}
    filepath.write_text(yaml_content, encoding="utf-8")
    from app.core.registry import get_registry
    get_registry().scan(_APP_DIR)
    logger.info("✅ Studio Agent 创建积木: %s/%s", block_type, block_id)
    return {"status": "created", "id": block_id, "path": str(filepath)}


def _read_block_yaml(block_type: str, block_id: str) -> str | None:
    """读取积木 YAML 内容"""
    for sub in ["_custom", "_builtin"]:
        filepath = _APP_DIR / block_type / sub / f"{block_id}.yaml"
        if filepath.exists():
            return filepath.read_text(encoding="utf-8")
    return None


def _dry_run_pipeline(pipeline_def: dict) -> dict:
    """尝试校验 Pipeline 拓扑，返回分析结果（不真实执行）"""
    nodes = pipeline_def.get("nodes", [])
    edges = pipeline_def.get("edges", [])
    warnings: list[str] = []

    # 1. 检查节点引用的积木是否已注册
    try:
        from app.core.registry import get_registry
        registry = get_registry()
        for node in nodes:
            ref_id = node.get("agent_id") or node.get("interaction_id") or node.get("report_id")
            if ref_id and registry.get_yaml_path(ref_id) is None:
                warnings.append(f"节点 '{node['id']}' 引用的积木 '{ref_id}' 未注册")
    except Exception:
        pass  # Registry 不可用时跳过积木存在性检查

    # 2. 检查边连通性
    node_ids = {n["id"] for n in nodes} | {"START", "END"}
    for edge in edges:
        src = edge.get("from", edge.get("source", ""))
        dst = edge.get("to", edge.get("target", ""))
        if src not in node_ids:
            warnings.append(f"边的源 '{src}' 不存在于节点列表中")
        if dst not in node_ids:
            warnings.append(f"边的目标 '{dst}' 不存在于节点列表中")

    # 3. 简单环检测（Kahn 拓扑排序）
    from collections import defaultdict, deque
    adj: dict[str, list[str]] = defaultdict(list)
    in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}
    for edge in edges:
        src = edge.get("from", edge.get("source", ""))
        dst = edge.get("to", edge.get("target", ""))
        if src in in_degree and dst in in_degree:
            adj[src].append(dst)
            in_degree[dst] = in_degree.get(dst, 0) + 1
    queue = deque(nid for nid, deg in in_degree.items() if deg == 0)
    visited = 0
    while queue:
        curr = queue.popleft()
        visited += 1
        for nxt in adj[curr]:
            in_degree[nxt] -= 1
            if in_degree[nxt] == 0:
                queue.append(nxt)
    if visited < len(nodes):
        warnings.append("检测到潜在循环依赖，部分节点无法通过拓扑排序")

    # 4. 检查孤立节点
    connected = set()
    for edge in edges:
        connected.add(edge.get("from", edge.get("source", "")))
        connected.add(edge.get("to", edge.get("target", "")))
    for node in nodes:
        if node["id"] not in connected:
            warnings.append(f"节点 '{node['id']}' 未被任何边连接（孤立节点）")

    return {
        "success": len(warnings) == 0,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "warnings": warnings,
    }


# ══════════════════════════════════════════════════════════════
# Part 4: 8 个 LangChain Tool 定义
# ══════════════════════════════════════════════════════════════

def _build_create_agent_tool():
    """Tool 1: 创建 Agent YAML"""
    from langchain_core.tools import tool

    @tool
    def create_agent(
        id: str,
        name: str,
        description: str,
        category: str,
        role_type: str,
        prompt: str,
        inputs: str = "retrieved_context,analyzed_intent",
        outputs: str = "evaluation_results",
        temperature: float = 0.3,
        notes: str = "",
    ) -> str:
        """创建一个新的 Agent 积木。将自然语言描述转为 YAML 配置并注册到系统中。
        inputs 和 outputs 用逗号分隔多个字段名。"""
        try:
            schema = AgentYAMLSchema(
                id=id, name=name, description=description,
                category=category, role_type=role_type,  # type: ignore[arg-type]
                prompt=prompt, temperature=temperature, notes=notes,
                inputs=[s.strip() for s in inputs.split(",") if s.strip()],
                outputs=[s.strip() for s in outputs.split(",") if s.strip()],
            )
        except Exception as e:
            return _json.dumps({"status": "validation_error", "message": str(e)}, ensure_ascii=False)

        yaml_content = agent_schema_to_yaml(schema)
        result = _write_block_yaml("agents", schema.id, yaml_content)
        result["yaml_preview"] = yaml_content
        result["block_type"] = "agent"
        return _json.dumps(result, ensure_ascii=False)

    return create_agent


def _build_create_interaction_tool():
    """Tool 2: 创建交互模式 YAML"""
    from langchain_core.tools import tool

    @tool
    def create_interaction(
        id: str,
        name: str,
        description: str,
        inputs: str,
        outputs: str,
        roles: str,
        config: str = "{}",
        notes: str = "",
    ) -> str:
        """创建一个新的交互模式积木（如辩论、投票、并行评估）。
        inputs/outputs 用逗号分隔。roles 为 JSON 字符串如 '{"evaluators":"2..n"}'。
        config 为 JSON 字符串。"""
        try:
            schema = InteractionYAMLSchema(
                id=id, name=name, description=description, notes=notes,
                inputs=[s.strip() for s in inputs.split(",") if s.strip()],
                outputs=[s.strip() for s in outputs.split(",") if s.strip()],
                roles=_json.loads(roles),
                config=_json.loads(config),
            )
        except Exception as e:
            return _json.dumps({"status": "validation_error", "message": str(e)}, ensure_ascii=False)

        yaml_content = interaction_schema_to_yaml(schema)
        result = _write_block_yaml("interactions", schema.id, yaml_content)
        result["yaml_preview"] = yaml_content
        result["block_type"] = "interaction"
        return _json.dumps(result, ensure_ascii=False)

    return create_interaction


def _build_create_report_tool():
    """Tool 3: 创建报告插件 YAML"""
    from langchain_core.tools import tool

    @tool
    def create_report(
        id: str,
        name: str,
        description: str,
        requires: str,
        sections: str,
        notes: str = "",
    ) -> str:
        """创建一个新的报告插件积木。
        requires 用逗号分隔依赖的 Agent ID。
        sections 为 JSON 数组字符串，每个元素包含 id/type/layout 等字段。"""
        try:
            section_list = _json.loads(sections)
            schema = ReportYAMLSchema(
                id=id, name=name, description=description, notes=notes,
                requires=[s.strip() for s in requires.split(",") if s.strip()],
                sections=[ReportSectionSchema(**s) for s in section_list],
            )
        except Exception as e:
            return _json.dumps({"status": "validation_error", "message": str(e)}, ensure_ascii=False)

        yaml_content = report_schema_to_yaml(schema)
        result = _write_block_yaml("reports", schema.id, yaml_content)
        result["yaml_preview"] = yaml_content
        result["block_type"] = "report"
        return _json.dumps(result, ensure_ascii=False)

    return create_report


def _build_modify_block_tool():
    """Tool 4: 修改已有积木"""
    from langchain_core.tools import tool

    @tool
    def modify_block(
        block_type: str,
        block_id: str,
        updates_json: str,
    ) -> str:
        """修改已有积木的字段。block_type 为 agents/interactions/reports。
        updates_json 是要更新的字段 JSON，如 '{"name":"新名字","description":"新描述"}'。
        只能修改 _custom 目录的积木。"""
        if block_type not in ("agents", "interactions", "reports"):
            return _json.dumps({"status": "error", "message": f"不支持的积木类型: {block_type}"}, ensure_ascii=False)

        # 检查是否内置
        builtin_path = _APP_DIR / block_type / "_builtin" / f"{block_id}.yaml"
        if builtin_path.exists():
            return _json.dumps({"status": "error", "message": "禁止修改内置积木"}, ensure_ascii=False)

        custom_path = _APP_DIR / block_type / "_custom" / f"{block_id}.yaml"
        if not custom_path.exists():
            return _json.dumps({"status": "error", "message": f"积木 '{block_id}' 不存在于 _custom 目录"}, ensure_ascii=False)

        try:
            existing = yaml.safe_load(custom_path.read_text(encoding="utf-8"))
            updates = _json.loads(updates_json)
            existing.update(updates)
            yaml_content = yaml.dump(existing, allow_unicode=True, default_flow_style=False, sort_keys=False)
            custom_path.write_text(yaml_content, encoding="utf-8")

            from app.core.registry import get_registry
            get_registry().scan(_APP_DIR)

            logger.info("✅ Studio Agent 修改积木: %s/%s", block_type, block_id)
            return _json.dumps({
                "status": "updated", "id": block_id,
                "yaml_preview": yaml_content,
                "block_type": block_type.rstrip("s"),
            }, ensure_ascii=False)
        except Exception as e:
            return _json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False)

    return modify_block


def _build_create_pipeline_tool():
    """Tool 5: 创建/更新 Pipeline JSON"""
    from langchain_core.tools import tool

    @tool
    def create_pipeline(
        name: str,
        description: str,
        nodes: str,
        edges: str,
        interrupt_before: str = "",
    ) -> str:
        """创建一个新的 Pipeline 管线定义。
        nodes 为 JSON 数组，每个元素 {id, type, agent_id/interaction_id/report_id, description}。
        edges 为 JSON 数组，每个元素 {source, target, condition(可选)}。
        interrupt_before 用逗号分隔需要 HITL 中断的节点 ID。"""
        try:
            node_list = _json.loads(nodes)
            edge_list = _json.loads(edges)
            schema = PipelineJSONSchema(
                name=name, description=description,
                nodes=[PipelineNodeSchema(**n) for n in node_list],
                edges=[PipelineEdgeSchema(**e) for e in edge_list],
                interrupt_before=[s.strip() for s in interrupt_before.split(",") if s.strip()],
            )
        except Exception as e:
            return _json.dumps({"status": "validation_error", "message": str(e)}, ensure_ascii=False)

        json_content = pipeline_schema_to_json(schema)
        pipeline_def = _json.loads(json_content)

        # DryRun 校验
        dry_result = _dry_run_pipeline(pipeline_def)

        # 写入文件
        filename = name.lower().replace(" ", "_") + ".json"
        if filename == "standard.json":
            return _json.dumps({"status": "error", "message": "禁止覆盖 standard.json"}, ensure_ascii=False)

        pipelines_dir = _APP_DIR / "pipelines"
        pipelines_dir.mkdir(parents=True, exist_ok=True)
        filepath = pipelines_dir / filename
        filepath.write_text(json_content, encoding="utf-8")

        logger.info("✅ Studio Agent 创建管线: %s", filename)
        return _json.dumps({
            "status": "created",
            "filename": filename,
            "json_preview": json_content,
            "block_type": "pipeline",
            "dry_run": dry_result,
        }, ensure_ascii=False)

    return create_pipeline


def _build_list_blocks_tool():
    """Tool 6: 列出已注册积木"""
    from langchain_core.tools import tool

    @tool
    def list_blocks(category_filter: str = "") -> str:
        """列出系统中所有已注册的积木（Agent / 交互模式 / 报告插件）。
        可选 category_filter 按分类过滤（如 'scoring', 'retrieval'）。"""
        from app.core.registry import get_registry
        registry = get_registry()
        all_blocks = registry.list_all()

        if category_filter:
            all_blocks = [b for b in all_blocks if b.get("category") == category_filter]

        if not all_blocks:
            return "当前没有已注册的积木" + (f"（分类: {category_filter}）" if category_filter else "")

        lines = [f"共 {len(all_blocks)} 个积木：\n"]
        for b in all_blocks:
            bt = b.get("block_type", "agent")
            rid = b.get("role_type", "")
            role_tag = f" [{rid}]" if rid else ""
            lines.append(f"- [{bt}] {b['id']} — {b['name']}{role_tag} ({b.get('category', '')})")

        return "\n".join(lines)

    return list_blocks


def _build_validate_yaml_tool():
    """Tool 7: 校验 YAML 合规性"""
    from langchain_core.tools import tool

    @tool
    def validate_yaml(yaml_content: str, block_type: str = "agent") -> str:
        """校验 YAML 内容是否符合积木协议。
        block_type 为 agent/interaction/report。"""
        try:
            data = yaml.safe_load(yaml_content)
        except Exception as e:
            return _json.dumps({"valid": False, "errors": [f"YAML 语法错误: {e}"]}, ensure_ascii=False)

        errors: list[str] = []

        # 通用字段检查
        if not data.get("id"):
            errors.append("缺少 id 字段")
        if not data.get("name"):
            errors.append("缺少 name 字段")

        # 按类型校验
        if block_type == "agent":
            if not data.get("category"):
                errors.append("Agent 缺少 category 字段")
            try:
                from app.core.base import BlockMeta
                BlockMeta(
                    id=data.get("id", ""),
                    name=data.get("name", ""),
                    description=data.get("description", ""),
                    category=data.get("category", ""),
                    role_type=data.get("role_type", ""),
                    inputs=data.get("inputs", []),
                    outputs=data.get("outputs", []),
                )
            except Exception as e:
                errors.append(f"BlockMeta 校验失败: {e}")

        elif block_type == "interaction":
            if not data.get("roles"):
                errors.append("交互模式缺少 roles 字段")
            try:
                from app.core.base import InteractionMeta, RoleSpec, ConfigField
                raw_config = data.get("config_schema", data.get("config", {}))
                config_schema = {}
                for key, val in raw_config.items():
                    config_schema[key] = ConfigField(**val) if isinstance(val, dict) else ConfigField(default=val)
                roles = [RoleSpec(name=rn, count=str(rc)) for rn, rc in data.get("roles", {}).items()]
                InteractionMeta(
                    id=data.get("id", ""), name=data.get("name", ""),
                    description=data.get("description", ""), category="interaction",
                    inputs=data.get("inputs", []), outputs=data.get("outputs", []),
                    config_schema=config_schema, roles=roles,
                )
            except Exception as e:
                errors.append(f"InteractionMeta 校验失败: {e}")

        elif block_type == "report":
            if not data.get("sections"):
                errors.append("报告缺少 sections 字段")
            try:
                from app.core.base import ReportMeta, ReportSection
                sections = [ReportSection(**s) for s in data.get("sections", [])]
                ReportMeta(
                    id=data.get("id", ""), name=data.get("name", ""),
                    description=data.get("description", ""), category="report",
                    requires=data.get("requires", []), sections=sections,
                )
            except Exception as e:
                errors.append(f"ReportMeta 校验失败: {e}")

        return _json.dumps({"valid": len(errors) == 0, "errors": errors}, ensure_ascii=False)

    return validate_yaml


def _build_dry_run_pipeline_tool():
    """Tool 8: DryRun 管线"""
    from langchain_core.tools import tool

    @tool
    def dry_run_pipeline(pipeline_name_or_json: str) -> str:
        """试运行（DryRun）管线 — 仅做编译校验和拓扑分析，不真实执行。
        输入可以是管线文件名（如 'my_pipeline.json'）或完整的 Pipeline JSON 字符串。"""
        pipeline_def = None

        # 尝试作为文件名加载
        if not pipeline_name_or_json.strip().startswith("{"):
            filepath = _APP_DIR / "pipelines" / pipeline_name_or_json
            if filepath.exists():
                try:
                    pipeline_def = _json.loads(filepath.read_text(encoding="utf-8"))
                except Exception as e:
                    return _json.dumps({"success": False, "warnings": [f"读取文件失败: {e}"]}, ensure_ascii=False)
            else:
                return _json.dumps({"success": False, "warnings": [f"管线文件 '{pipeline_name_or_json}' 不存在"]}, ensure_ascii=False)
        else:
            # 尝试作为 JSON 解析
            try:
                pipeline_def = _json.loads(pipeline_name_or_json)
            except Exception as e:
                return _json.dumps({"success": False, "warnings": [f"JSON 解析失败: {e}"]}, ensure_ascii=False)

        result = _dry_run_pipeline(pipeline_def)
        return _json.dumps(result, ensure_ascii=False)

    return dry_run_pipeline


# ══════════════════════════════════════════════════════════════
# Part 5: System Prompt + Agent 构建
# ══════════════════════════════════════════════════════════════

STUDIO_AGENT_SYSTEM_PROMPT = """你是 Novoscan Studio Agent，帮助用户通过自然语言创建和管理 AI 分析管线组件。

## 你的能力

1. **创建 Agent 积木** — 调用 create_agent 工具生成 YAML 配置
2. **创建交互模式** — 调用 create_interaction 工具（辩论/投票/并行评估等）
3. **创建报告插件** — 调用 create_report 工具定义报告结构
4. **修改积木** — 调用 modify_block 更新已有积木配置
5. **创建管线** — 调用 create_pipeline 定义节点和边
6. **查看积木** — 调用 list_blocks 查看已注册的积木清单
7. **校验 YAML** — 调用 validate_yaml 检查配置合规性
8. **试运行管线** — 调用 dry_run_pipeline 做 DryRun 拓扑校验

## 工作规则

1. 创建积木时，始终使用对应的 create_* 工具，不要只输出文本
2. 先调用 list_blocks 查看已有积木，避免重复创建
3. 创建 Pipeline 前确保所有引用的积木已存在
4. 创建 Pipeline 后自动调用 dry_run_pipeline 做校验
5. 如果工具调用失败，分析错误原因并尝试修正后重试（最多 1 次）
6. 用中文回复，必要时用 Markdown 格式

## Agent 分类参考

- **scoring**: 评分类（evaluator/critic/synthesizer/mediator）
- **retrieval**: 检索类（retriever/executor）
- **intent**: 意图分析类（planner）
- **orchestration**: 编排类（orchestrator/monitor）
- **transform**: 数据转换类（filter）
- **custom**: 自定义类

## 当前系统积木
{blocks_summary}

## 当前画布上下文
{canvas_context}"""


# ══════════════════════════════════════════════════════════════
# Part 6: Agentic 调优 Tool（5 个）— P10a-S1
# ══════════════════════════════════════════════════════════════

# ── 必需工具（不可禁用） ──
_CRITICAL_TOOL_IDS = {"analyze_intent", "run_arbitration"}


def _build_read_agentic_config_tool():
    """读取 Orchestrator 配置"""
    from langchain_core.tools import tool

    @tool
    def read_agentic_config() -> str:
        """读取当前 Agentic Orchestrator 的完整配置，包括 system_prompt 预览、model 参数、工具启用状态和 Prompt 版本历史数量。"""
        from app.core.orchestrator import load_agentic_config
        config = load_agentic_config()
        prompt = config.get("system_prompt", "")
        summary = {
            "system_prompt_length": len(prompt),
            "system_prompt_preview": prompt[:300] + ("..." if len(prompt) > 300 else ""),
            "model": config.get("model", {}),
            "tools": config.get("tools", []),
            "prompt_history_count": len(config.get("prompt_history", [])),
        }
        return _json.dumps(summary, ensure_ascii=False)
    return read_agentic_config


def _build_update_agentic_config_tool():
    """修改 Orchestrator 配置并热重载"""
    from langchain_core.tools import tool

    @tool
    def update_agentic_config(
        system_prompt: str = "",
        temperature: float = -1,
        max_iterations: int = -1,
        enable_tools: str = "",
        disable_tools: str = "",
    ) -> str:
        """修改 Agentic Orchestrator 配置。留空参数表示不修改。修改后自动热重载。
        enable_tools/disable_tools 用逗号分隔 tool ID。
        temperature 范围 0.0-1.0，max_iterations 范围 1-50。
        禁用关键工具（analyze_intent, run_arbitration）时会发出警告。"""
        from datetime import datetime, timezone
        from app.core.orchestrator import load_agentic_config, save_agentic_config, build_agentic_graph
        from langgraph.checkpoint.memory import MemorySaver

        config = load_agentic_config()
        changes: list[str] = []
        warnings: list[str] = []

        if system_prompt:
            old = config.get("system_prompt", "")
            if old != system_prompt:
                history = config.get("prompt_history", [])
                history.append({
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "content": old,
                    "length": len(old),
                })
                config["prompt_history"] = history[-20:]
            config["system_prompt"] = system_prompt
            changes.append("system_prompt")

        if temperature >= 0:
            if temperature > 1.0:
                warnings.append("temperature > 1.0 可能导致输出不稳定")
            config.setdefault("model", {})["temperature"] = round(temperature, 2)
            changes.append(f"temperature={round(temperature, 2)}")

        if max_iterations > 0:
            if max_iterations > 50:
                warnings.append("max_iterations > 50 可能导致长时间运行")
            config.setdefault("model", {})["max_iterations"] = max_iterations
            changes.append(f"max_iterations={max_iterations}")

        # 工具启用/禁用
        tool_map = {t["id"]: t for t in config.get("tools", [])}
        for tid in [s.strip() for s in enable_tools.split(",") if s.strip()]:
            if tid in tool_map:
                tool_map[tid]["enabled"] = True
                changes.append(f"enable:{tid}")
        for tid in [s.strip() for s in disable_tools.split(",") if s.strip()]:
            if tid in tool_map:
                if tid in _CRITICAL_TOOL_IDS:
                    warnings.append(f"⚠️ 禁用关键工具 {tid} 可能导致分析流程不完整")
                tool_map[tid]["enabled"] = False
                changes.append(f"disable:{tid}")

        if not changes:
            return _json.dumps({"status": "no_change", "message": "无变更"}, ensure_ascii=False)

        save_agentic_config(config)

        # 热重载
        reload_ok = False
        try:
            build_agentic_graph(checkpointer=MemorySaver())
            reload_ok = True
        except Exception as e:
            logger.error("❌ Agentic 热重载失败: %s", e)
            warnings.append(f"热重载失败: {str(e)[:100]}")

        return _json.dumps({
            "status": "updated",
            "changes": changes,
            "warnings": warnings,
            "reload_ok": reload_ok,
            "enabled_tools_count": len([t for t in config.get("tools", []) if t.get("enabled")]),
            "config_preview": {
                "temperature": config.get("model", {}).get("temperature"),
                "max_iterations": config.get("model", {}).get("max_iterations"),
                "tools_enabled": [t["id"] for t in config.get("tools", []) if t.get("enabled")],
                "tools_disabled": [t["id"] for t in config.get("tools", []) if not t.get("enabled")],
            },
        }, ensure_ascii=False)
    return update_agentic_config


def _build_diagnose_agentic_tool():
    """诊断 Agentic 配置"""
    from langchain_core.tools import tool

    @tool
    def diagnose_agentic(focus: str = "all") -> str:
        """诊断当前 Agentic 配置，检测问题和优化空间。
        focus 可选: all / prompt / model / tools / token_estimate。
        返回诊断报告，包括：Token 用量预估、工具链路分析、Prompt 质量评估、配置冲突检测。"""
        from app.core.orchestrator import load_agentic_config
        config = load_agentic_config()

        findings: list[str] = []
        warnings: list[str] = []
        suggestions: list[str] = []

        prompt = config.get("system_prompt", "")
        model_cfg = config.get("model", {})
        tools = config.get("tools", [])
        enabled_tools = [t for t in tools if t.get("enabled")]
        disabled_tools = [t for t in tools if not t.get("enabled")]
        temperature = model_cfg.get("temperature", 0.3)
        max_iter = model_cfg.get("max_iterations", 25)

        # ── Prompt 诊断 ──
        if focus in ("all", "prompt"):
            if len(prompt) < 100:
                findings.append("system_prompt 过短（<100字），Agent 可能缺乏足够指导")
                suggestions.append("增加 system_prompt 长度，包含具体的分析流程和规则")
            elif len(prompt) > 3000:
                findings.append(f"system_prompt 过长（{len(prompt)}字），可能增加 Token 消耗")
                suggestions.append("精简 system_prompt，移除冗余描述")
            else:
                findings.append(f"system_prompt 长度适中（{len(prompt)}字）")

            if "重要规则" not in prompt and "规则" not in prompt:
                suggestions.append("在 system_prompt 中添加明确的规则约束")
            if "最终" not in prompt and "总结" not in prompt:
                suggestions.append("在 system_prompt 中指定最终输出的格式要求")

        # ── Model 诊断 ──
        if focus in ("all", "model"):
            if temperature > 0.7:
                warnings.append(f"temperature={temperature} > 0.7，评分结果可能不稳定")
                suggestions.append("评分类任务建议 temperature ≤ 0.3")
            if temperature < 0.1:
                findings.append(f"temperature={temperature} 极低，输出可能过于保守")
            if max_iter < 5:
                warnings.append(f"max_iterations={max_iter} 过低，Agent 可能无法完成完整分析")
                suggestions.append("建议 max_iterations ≥ 10")
            elif max_iter > 40:
                warnings.append(f"max_iterations={max_iter} 过高，可能导致 Token 浪费")
                suggestions.append("建议 max_iterations ≤ 30")

        # ── Tools 诊断 ──
        if focus in ("all", "tools"):
            enabled_ids = {t["id"] for t in enabled_tools}
            for cid in _CRITICAL_TOOL_IDS:
                if cid not in enabled_ids:
                    warnings.append(f"关键工具 {cid} 未启用，分析流程可能不完整")
            # 检查工具组覆盖
            groups = {t.get("group", "") for t in enabled_tools}
            if "search" not in groups:
                suggestions.append("未启用任何搜索工具，Agent 无法获取外部数据")
            if "scoring" not in groups:
                suggestions.append("未启用任何评分工具，Agent 无法进行量化评估")
            if "arbitration" not in groups:
                suggestions.append("未启用仲裁工具，Agent 无法给出最终裁决")
            if disabled_tools:
                findings.append(f"{len(disabled_tools)} 个工具已禁用: {', '.join(t['id'] for t in disabled_tools)}")

        # ── Token 预估 ──
        if focus in ("all", "token_estimate"):
            # 粗略估算：system_prompt + 每个工具调用约 500 token
            base_tokens = len(prompt) // 4  # 中文约 4 字/token
            tool_tokens = len(enabled_tools) * 500
            iteration_tokens = max_iter * (tool_tokens + 200)  # 每轮约 200 token 推理
            total_estimate = base_tokens + iteration_tokens
            findings.append(f"预估单次执行 Token: ~{total_estimate:,}（含 {max_iter} 轮迭代）")
            if total_estimate > 50000:
                suggestions.append("Token 预估较高，考虑减少 max_iterations 或禁用部分工具")

        return _json.dumps({
            "status": "diagnosed",
            "focus": focus,
            "findings": findings,
            "warnings": warnings,
            "suggestions": suggestions,
            "config_summary": {
                "prompt_length": len(prompt),
                "temperature": temperature,
                "max_iterations": max_iter,
                "enabled_tools": len(enabled_tools),
                "disabled_tools": len(disabled_tools),
            },
        }, ensure_ascii=False)
    return diagnose_agentic


def _build_dry_run_agentic_tool():
    """试运行 Agentic（模拟）"""
    from langchain_core.tools import tool

    @tool
    def dry_run_agentic(user_input: str = "") -> str:
        """模拟执行 Agentic 分析，不真实调用搜索/评分 API。
        返回模拟执行计划和预估 Token/耗时，供用户确认后再真实执行。
        user_input 为可选的测试输入，留空则使用默认示例。"""
        from app.core.orchestrator import load_agentic_config
        config = load_agentic_config()

        enabled_tools = [t for t in config.get("tools", []) if t.get("enabled")]
        temperature = config.get("model", {}).get("temperature", 0.3)
        max_iter = config.get("model", {}).get("max_iterations", 25)

        # 构建模拟执行计划
        plan_steps = []
        step_idx = 0
        for t in enabled_tools:
            step_idx += 1
            group = t.get("group", "")
            if group == "intent":
                plan_steps.append({
                    "step": step_idx,
                    "tool": t["id"],
                    "action": "分析用户意图",
                    "estimated_tokens": 300,
                    "estimated_ms": 2000,
                })
            elif group == "search":
                plan_steps.append({
                    "step": step_idx,
                    "tool": t["id"],
                    "action": f"使用 {t.get('description', t['id'])} 检索数据",
                    "estimated_tokens": 500,
                    "estimated_ms": 5000,
                })
            elif group == "scoring":
                plan_steps.append({
                    "step": step_idx,
                    "tool": t["id"],
                    "action": f"使用 {t.get('description', t['id'])} 评分",
                    "estimated_tokens": 600,
                    "estimated_ms": 8000,
                })
            elif group == "arbitration":
                plan_steps.append({
                    "step": step_idx,
                    "tool": t["id"],
                    "action": f"使用 {t.get('description', t['id'])}",
                    "estimated_tokens": 400,
                    "estimated_ms": 6000,
                })

        total_tokens = sum(s["estimated_tokens"] for s in plan_steps)
        total_ms = sum(s["estimated_ms"] for s in plan_steps)

        return _json.dumps({
            "status": "dry_run_ok",
            "message": "模拟执行成功（未真实调用 API）",
            "plan_steps": plan_steps,
            "total_steps": len(plan_steps),
            "estimated_total_tokens": total_tokens,
            "estimated_total_ms": total_ms,
            "estimated_total_seconds": round(total_ms / 1000, 1),
            "config_snapshot": {
                "temperature": temperature,
                "max_iterations": max_iter,
                "enabled_tools_count": len(enabled_tools),
            },
        }, ensure_ascii=False)
    return dry_run_agentic


def _build_get_agentic_run_logs_tool():
    """获取最近执行日志"""
    from langchain_core.tools import tool

    @tool
    def get_agentic_run_logs(include_history: bool = False) -> str:
        """获取最近一次 Agentic 执行的日志，包括工具调用链、耗时和 Token 消耗。
        include_history=True 时额外返回最近 5 次执行摘要。
        无执行记录时返回友好提示。"""
        from app.core.agentic_logger import get_run_log_summary, get_history_summaries

        result = get_run_log_summary()

        if include_history:
            history = get_history_summaries(limit=5)
            combined = _json.loads(result)
            combined["history"] = _json.loads(history)
            return _json.dumps(combined, ensure_ascii=False)

        return result
    return get_agentic_run_logs


# ══════════════════════════════════════════════════════════════
# Part 6b: Agentic System Prompt
# ══════════════════════════════════════════════════════════════

AGENTIC_SYSTEM_PROMPT = """你是 Novoscan Studio Agentic 调优助手，帮助用户通过自然语言优化 Agentic 智能体工作流。

## 你的能力

1. **读取配置** — 调用 read_agentic_config 查看当前 Orchestrator 配置
2. **修改配置** — 调用 update_agentic_config 调整参数并热重载
3. **诊断分析** — 调用 diagnose_agentic 检测配置问题和优化空间
4. **试运行** — 调用 dry_run_agentic 模拟执行，预估 Token 和耗时
5. **执行日志** — 调用 get_agentic_run_logs 查看最近执行结果，辅助调优

## 可调参数

- **system_prompt**: Orchestrator 的系统提示词，决定 Agent 行为策略
- **temperature**: 模型温度（0.0-1.0），低=精确、高=创意
- **max_iterations**: 最大迭代次数（1-50），防止死循环
- **tools 启用/禁用**: 控制哪些工具可用（意图分析/搜索/评分/辩论/仲裁）

## 工作规则

1. 修改配置前先调用 read_agentic_config 了解当前状态
2. 修改后自动调用 diagnose_agentic 验证配置合理性
3. 对 system_prompt 的修改要保守，只调整策略相关部分
4. 禁用关键工具（如 analyze_intent 或 run_arbitration）时要警告用户
5. temperature > 0.7 时提醒可能影响评分稳定性
6. 用中文回复，必要时用 Markdown 格式

## 当前 Agentic 配置
{agentic_config_summary}

## 最近执行摘要
{recent_run_summary}"""


def build_studio_agent(canvas_context: dict | None = None, mode: str = "standard"):
    """
    构建 Studio ReAct Agent。

    Args:
        canvas_context: 画布上下文信息 {{nodes, edges}}
        mode: "standard" | "agentic" — 决定工具集和 System Prompt

    Returns:
        LangGraph CompiledGraph
    """
    from app.models import get_model
    from langgraph.prebuilt import create_react_agent

    if mode == "agentic":
        # ── Agentic 模式：5 个 Agentic Tool + 3 个共享 Tool ──
        tools = [
            _build_read_agentic_config_tool(),
            _build_update_agentic_config_tool(),
            _build_diagnose_agentic_tool(),
            _build_dry_run_agentic_tool(),
            _build_get_agentic_run_logs_tool(),
            _build_list_blocks_tool(),
            _build_validate_yaml_tool(),
            _build_dry_run_pipeline_tool(),
        ]

        # 注入 Agentic 配置摘要
        agentic_config_summary = "未加载"
        try:
            from app.core.orchestrator import load_agentic_config
            cfg = load_agentic_config()
            enabled = [t["id"] for t in cfg.get("tools", []) if t.get("enabled")]
            disabled = [t["id"] for t in cfg.get("tools", []) if not t.get("enabled")]
            agentic_config_summary = (
                f"temperature={cfg.get('model', {}).get('temperature', 0.3)}, "
                f"max_iterations={cfg.get('model', {}).get('max_iterations', 25)}, "
                f"启用工具: {', '.join(enabled)}, "
                f"禁用工具: {', '.join(disabled) if disabled else '无'}"
            )
        except Exception:
            pass

        # 注入最近执行摘要
        recent_run_summary = "暂无执行记录"
        try:
            from app.core.agentic_logger import get_run_log_summary
            log_data = _json.loads(get_run_log_summary())
            if log_data.get("has_log"):
                recent_run_summary = (
                    f"最近执行: {log_data.get('tool_count', 0)} 个工具调用, "
                    f"耗时 {log_data.get('total_duration_ms', 0)}ms, "
                    f"状态: {log_data.get('status', '?')}"
                )
        except Exception:
            pass

        system_prompt = AGENTIC_SYSTEM_PROMPT.format(
            agentic_config_summary=agentic_config_summary,
            recent_run_summary=recent_run_summary,
        )

        model = get_model(temperature=0.3)
        agent = create_react_agent(
            model=model,
            tools=tools,
            prompt=system_prompt,
        )

        logger.info("🎨 Studio Agent (Agentic) 构建完成: %d 个工具", len(tools))
        return agent

    # ── Standard 模式：原有 8 个 Tool ──
    tools = [
        _build_create_agent_tool(),
        _build_create_interaction_tool(),
        _build_create_report_tool(),
        _build_modify_block_tool(),
        _build_create_pipeline_tool(),
        _build_list_blocks_tool(),
        _build_validate_yaml_tool(),
        _build_dry_run_pipeline_tool(),
    ]

    # 注入动态上下文
    from app.core.registry import get_registry
    registry = get_registry()
    all_blocks = registry.list_all()
    blocks_lines = []
    for b in all_blocks:
        bt = b.get("block_type", "agent")
        blocks_lines.append(f"- [{bt}] {b['id']} — {b['name']} ({b.get('category', '')})")
    blocks_summary = "\n".join(blocks_lines) if blocks_lines else "暂无已注册积木"

    canvas_info = "无画布上下文"
    if canvas_context:
        nodes = canvas_context.get("nodes", [])
        edges = canvas_context.get("edges", [])
        if nodes:
            node_names = [n.get("label", n.get("id", "?")) for n in nodes[:20]]
            canvas_info = f"{len(nodes)} 个节点: {', '.join(node_names)}"
            if edges:
                canvas_info += f"\n{len(edges)} 条边"

    system_prompt = STUDIO_AGENT_SYSTEM_PROMPT.format(
        blocks_summary=blocks_summary,
        canvas_context=canvas_info,
    )

    model = get_model(temperature=0.3)
    agent = create_react_agent(
        model=model,
        tools=tools,
        prompt=system_prompt,
    )

    logger.info("🎨 Studio Agent (Standard) 构建完成: %d 个工具", len(tools))
    return agent
