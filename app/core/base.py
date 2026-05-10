"""
Novoscan-Open-Core 积木协议层 — 基类定义

三层积木体系：
  Layer 1: AgentBlock      — AI 角色（可自定义 Prompt/工具/输出）
  Layer 2: InteractionBlock — 交互模式（辩论/头脑风暴/投票等）
  Layer 3: ReportBlock      — 报告插件（可自定义输出结构+可视化组件）

设计原则：
  1. 所有积木通过 YAML 声明，零 Python 即可扩展
  2. 每个 AgentBlock 同时是 Graph Node 和 Tool（双重接口）
  3. BlockMeta 是积木的自描述元数据，从 YAML 自动解析
"""

from __future__ import annotations

import abc
import yaml
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool, StructuredTool


# ==============================================================================
# BlockMeta — 积木元数据（从 YAML 解析）
# ==============================================================================

class ConfigField(BaseModel):
    """积木可配置参数的单个字段定义"""
    type: str = "text"                # text | float | integer | boolean | select
    default: Any = None               # 默认值
    description: str = ""             # 参数说明
    min: Optional[float] = None       # 数值型最小值
    max: Optional[float] = None       # 数值型最大值
    options: Optional[list[str]] = None  # select 类型的可选值


class BlockMeta(BaseModel):
    """积木自描述元数据 — 从 YAML 文件头解析"""
    id: str                            # 唯一标识，如 "academic_scorer"
    name: str                          # 展示名，如 "学术审查员"
    description: str = ""              # 一句话说明
    version: str = "1.0"               # 版本号
    category: str = ""                 # 分类：scoring | retrieval | debate | report
    role_type: str = ""                  # 六层十类角色：orchestrator | monitor | planner | executor | evaluator | critic | synthesizer | gatekeeper | reporter | custom
    inputs: list[str] = Field(default_factory=list)   # 需要的 State 字段
    outputs: list[str] = Field(default_factory=list)  # 产出的 State 字段
    config_schema: dict[str, ConfigField] = Field(default_factory=dict)

    @classmethod
    def from_yaml(cls, path: Path) -> "BlockMeta":
        """从 YAML 文件解析 BlockMeta"""
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        # 解析 config_schema 中的字段为 ConfigField
        raw_config = data.get("config_schema", {})
        config_schema = {}
        for key, val in raw_config.items():
            if isinstance(val, dict):
                config_schema[key] = ConfigField(**val)
            else:
                config_schema[key] = ConfigField(default=val)

        return cls(
            id=data["id"],
            name=data["name"],
            description=data.get("description", ""),
            version=data.get("version", "1.0"),
            category=data.get("category", ""),
            role_type=data.get("role_type", ""),
            inputs=data.get("inputs", []),
            outputs=data.get("outputs", []),
            config_schema=config_schema,
        )


# ==============================================================================
# AgentBlock — Layer 1 Agent 积木基类
# ==============================================================================

class AgentBlock(abc.ABC):
    """
    Agent 积木基类。

    每个 Agent 积木同时提供两种接口：
      1. run_as_node() — 作为 LangGraph 图节点执行
      2. as_tool()     — 包装为 LangChain Tool，供 Orchestrator 调用

    子类需要实现 _execute() 方法，两种接口共用同一执行逻辑。
    """

    def __init__(self, meta: BlockMeta, raw_yaml: dict | None = None):
        self.meta = meta
        self.raw_yaml = raw_yaml or {}  # 保留完整 YAML 内容

    @classmethod
    def from_yaml(cls, path: Path) -> "AgentBlock":
        """从 YAML 文件创建 AgentBlock 实例"""
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        meta = BlockMeta.from_yaml(path)
        return cls(meta=meta, raw_yaml=raw)

    @abc.abstractmethod
    async def _execute(self, inputs: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
        """
        核心执行逻辑（子类实现）。

        Args:
            inputs: 从 GraphState 中提取的输入字段
            config: 运行时配置（合并 YAML 默认值 + 用户覆盖）

        Returns:
            输出字段字典，将 merge 回 GraphState
        """
        ...

    async def run_as_node(self, state: dict, config: dict | None = None) -> dict:
        """作为 LangGraph Graph Node 执行"""
        # 从 state 中提取本积木声明的 inputs
        inputs = {k: state.get(k) for k in self.meta.inputs}

        # 合并配置：YAML 默认值 + 运行时覆盖
        merged_config = self._merge_config(config or {})

        return await self._execute(inputs, merged_config)

    def as_tool(self) -> BaseTool:
        """包装为 LangChain Tool，供 Orchestrator Agent 调用"""
        import asyncio

        meta = self.meta

        def _sync_wrapper(**kwargs) -> dict:
            # Tool 调用时，kwargs 即为 inputs
            config = kwargs.pop("__config__", {})
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    result = pool.submit(
                        asyncio.run, self._execute(kwargs, self._merge_config(config))
                    ).result()
                return result
            return asyncio.run(self._execute(kwargs, self._merge_config(config)))

        return StructuredTool.from_function(
            func=_sync_wrapper,
            name=meta.id,
            description=f"{meta.name}: {meta.description}",
        )

    def _merge_config(self, overrides: dict) -> dict:
        """合并 YAML 默认配置 + 运行时覆盖"""
        defaults = {
            k: v.default
            for k, v in self.meta.config_schema.items()
            if v.default is not None
        }
        defaults.update(overrides)
        return defaults


# ==============================================================================
# InteractionBlock — Layer 2 交互模式基类
# ==============================================================================

class RoleSpec(BaseModel):
    """交互模式中的角色声明"""
    name: str               # 角色名：moderator, debater, thinker
    count: str = "1"        # 数量："1" 或 "2..n"


class InteractionMeta(BlockMeta):
    """交互模式专用元数据，扩展 BlockMeta"""
    roles: list[RoleSpec] = Field(default_factory=list)

    @classmethod
    def from_yaml(cls, path: Path) -> "InteractionMeta":
        """从 YAML 解析交互模式元数据"""
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        raw_config = data.get("config_schema", data.get("config", {}))
        config_schema = {}
        for key, val in raw_config.items():
            if isinstance(val, dict):
                config_schema[key] = ConfigField(**val)
            else:
                config_schema[key] = ConfigField(default=val)

        roles = []
        raw_roles = data.get("roles", {})
        for rname, rcount in raw_roles.items():
            roles.append(RoleSpec(name=rname, count=str(rcount)))

        return cls(
            id=data["id"],
            name=data["name"],
            description=data.get("description", ""),
            version=data.get("version", "1.0"),
            category="interaction",
            inputs=data.get("inputs", []),
            outputs=data.get("outputs", []),
            config_schema=config_schema,
            roles=roles,
        )


class InteractionBlock(abc.ABC):
    """
    交互模式基类。

    定义多个 Agent 之间如何协作/对抗。
    内置模式：并行评估、对抗辩论。
    开发者可扩展：头脑风暴、轮流投票等。
    """

    def __init__(self, meta: InteractionMeta, raw_yaml: dict | None = None):
        self.meta = meta
        self.raw_yaml = raw_yaml or {}

    @classmethod
    def from_yaml(cls, path: Path) -> "InteractionBlock":
        """从 YAML 文件创建 InteractionBlock 实例"""
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        meta = InteractionMeta.from_yaml(path)
        return cls(meta=meta, raw_yaml=raw)

    @abc.abstractmethod
    async def run(
        self,
        agents: list[AgentBlock],
        state: dict[str, Any],
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """
        执行交互逻辑。

        Args:
            agents: 参与交互的 Agent 积木列表
            state: 当前 GraphState
            config: 运行时配置

        Returns:
            输出字段字典
        """
        ...

    def as_tool(self) -> BaseTool:
        """包装为 Tool（供 Orchestrator 调用辩论/头脑风暴等）"""
        meta = self.meta

        def _wrapper(agent_ids: list[str], topic: str = "") -> str:
            return f"交互模式 {meta.name} 需要在图中执行，请使用 run_interaction 工具"

        return StructuredTool.from_function(
            func=_wrapper,
            name=f"interaction_{meta.id}",
            description=f"交互模式: {meta.name} — {meta.description}",
        )


# ==============================================================================
# ReportBlock — Layer 3 报告插件基类
# ==============================================================================

class ReportSection(BaseModel):
    """报告中的一个章节定义"""
    id: str                            # 章节标识
    type: str                          # 可视化组件类型：radar | bar_chart | table | markdown_card | llm_generated
    layout: dict[str, Any] = Field(default_factory=dict)  # 前端布局参数
    source: Optional[str] = None       # 数据来源表达式
    prompt: Optional[str] = None       # LLM 生成型章节的 Prompt
    columns: Optional[list[str]] = None  # 表格列定义
    dimensions: Optional[list[dict]] = None  # 雷达图维度
    style: Optional[dict] = None       # 样式参数


class ReportMeta(BlockMeta):
    """报告插件专用元数据"""
    requires: list[str] = Field(default_factory=list)  # 需要哪些 Agent 的输出
    sections: list[ReportSection] = Field(default_factory=list)

    @classmethod
    def from_yaml(cls, path: Path) -> "ReportMeta":
        """从 YAML 解析报告插件元数据"""
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        raw_config = data.get("config_schema", data.get("config", {}))
        config_schema = {}
        for key, val in raw_config.items():
            if isinstance(val, dict):
                config_schema[key] = ConfigField(**val)
            else:
                config_schema[key] = ConfigField(default=val)

        sections = []
        for sec in data.get("sections", []):
            sections.append(ReportSection(**sec))

        return cls(
            id=data["id"],
            name=data["name"],
            description=data.get("description", ""),
            version=data.get("version", "1.0"),
            category="report",
            inputs=data.get("inputs", []),
            outputs=data.get("outputs", ["final_report"]),
            config_schema=config_schema,
            requires=data.get("requires", []),
            sections=sections,
        )


class ReportBlock(abc.ABC):
    """
    报告插件基类。

    从多个 Agent 的输出中组装最终报告。
    开发者通过 YAML 定义报告结构和可视化组件。
    """

    def __init__(self, meta: ReportMeta, raw_yaml: dict | None = None):
        self.meta = meta
        self.raw_yaml = raw_yaml or {}

    @classmethod
    def from_yaml(cls, path: Path) -> "ReportBlock":
        """从 YAML 文件创建 ReportBlock 实例"""
        with open(path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
        meta = ReportMeta.from_yaml(path)
        return cls(meta=meta, raw_yaml=raw)

    @abc.abstractmethod
    async def generate(
        self,
        agent_outputs: dict[str, Any],
        state: dict[str, Any],
        config: dict[str, Any],
    ) -> dict[str, Any]:
        """
        生成报告。

        Args:
            agent_outputs: 各 Agent 的输出 {agent_id: output_dict}
            state: 完整 GraphState
            config: 运行时配置

        Returns:
            报告数据字典
        """
        ...
