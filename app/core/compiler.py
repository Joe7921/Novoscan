"""
Novoscan-Open-Core Pipeline 编译器（增强版）

将 Pipeline JSON/YAML 定义编译为可执行的 LangGraph StateGraph。

增强特性（vs 基础版）：
  - 支持 conditional_edges（通过条件函数注册表）
  - 支持 interrupt_before（HITL 中断点）
  - 从 standard.json 编译出完整可用的图

编译流程：
  1. 解析 Pipeline JSON → 提取节点列表和边定义
  2. 从 node_functions 获取每个节点的执行函数
  3. 构建 StateGraph，注册节点、普通边和条件边
  4. 应用 interrupt_before 配置
  5. 返回可执行的 CompiledGraph
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Callable

from langgraph.graph import StateGraph, START, END

from app.state import GraphState

logger = logging.getLogger("novoscan.compiler")


class PipelineCompiler:
    """
    Pipeline JSON → LangGraph StateGraph 编译器。

    Pipeline JSON 格式（增强版）：
    {
        "name": "标准管线",
        "nodes": [
            {"id": "step1", "type": "agent", "agent_id": "..."},
        ],
        "edges": [
            {"from": "START", "to": "step1"},
            {"from": "step1", "to": "step2", "condition": "score_gap > 20"},
            {"from": "step1", "to": "step3", "condition": "score_gap <= 20"},
        ],
        "interrupt_before": ["human_check"]
    }
    """

    def __init__(
        self,
        node_functions: dict[str, Any] | None = None,
        condition_functions: dict[str, Callable] | None = None,
    ):
        """
        Args:
            node_functions: 节点 ID → 可调用执行函数的映射。
            condition_functions: 条件名 → 路由函数的映射。
                路由函数签名: (state: dict) -> str
                返回值对应 edge 中的 condition 值。
        """
        self._node_functions = node_functions or {}
        self._condition_functions = condition_functions or {}

    def compile(self, pipeline_def: dict, checkpointer=None) -> Any:
        """
        将 Pipeline 定义编译为 LangGraph CompiledGraph。

        Args:
            pipeline_def: Pipeline JSON 字典
            checkpointer: LangGraph checkpointer 实例

        Returns:
            LangGraph CompiledGraph 实例
        """
        name = pipeline_def.get("name", "unnamed")
        nodes = pipeline_def.get("nodes", [])
        edges = pipeline_def.get("edges", [])
        interrupt_before = pipeline_def.get("interrupt_before", [])

        logger.info(
            "🔧 编译管线: %s (%d 节点, %d 边, %d 中断点)",
            name, len(nodes), len(edges), len(interrupt_before),
        )

        graph = StateGraph(GraphState)

        # ── 注册节点 ──
        for node_def in nodes:
            node_id = node_def["id"]
            func = self._node_functions.get(node_id)
            if func is None:
                raise ValueError(
                    f"编译错误: 节点 '{node_id}' 没有对应的执行函数。\n"
                    f"已注册函数: {list(self._node_functions.keys())}"
                )
            graph.add_node(node_id, func)
            logger.debug("  + 节点: %s", node_id)

        # ── 分析条件边 ──
        # 将有相同 from 的条件边聚合
        conditional_groups: dict[str, list[dict]] = {}
        simple_edges: list[dict] = []

        for edge_def in edges:
            if "condition" in edge_def:
                src = edge_def["from"]
                if src not in conditional_groups:
                    conditional_groups[src] = []
                conditional_groups[src].append(edge_def)
            else:
                simple_edges.append(edge_def)

        # ── 注册简单边 ──
        for edge_def in simple_edges:
            src = edge_def["from"]
            dst = edge_def["to"]
            src_node = START if src == "START" else src
            dst_node = END if dst == "END" else dst
            graph.add_edge(src_node, dst_node)
            logger.debug("  → 边: %s → %s", src, dst)

        # ── 注册条件边 ──
        for src, cond_edges in conditional_groups.items():
            src_node = START if src == "START" else src

            # 查找该源节点对应的路由函数
            route_func = self._condition_functions.get(src)
            if route_func is None:
                raise ValueError(
                    f"编译错误: 节点 '{src}' 有条件边但没有注册路由函数。\n"
                    f"已注册路由: {list(self._condition_functions.keys())}"
                )

            # 构建 condition → target 映射
            route_map: dict[str, str | Any] = {}
            for edge_def in cond_edges:
                condition = edge_def["condition"]
                dst = edge_def["to"]
                dst_node = END if dst == "END" else dst
                route_map[condition] = dst_node

            graph.add_conditional_edges(src_node, route_func, route_map)
            logger.debug(
                "  ⇢ 条件边: %s → %s",
                src, {k: v for k, v in route_map.items()},
            )

        # ── 编译 ──
        compile_kwargs: dict[str, Any] = {}
        if checkpointer is not None:
            compile_kwargs["checkpointer"] = checkpointer
        if interrupt_before:
            compile_kwargs["interrupt_before"] = interrupt_before

        compiled = graph.compile(**compile_kwargs)
        logger.info("✅ 管线编译完成: %s", name)
        return compiled

    @staticmethod
    def load_pipeline(path: Path) -> dict:
        """从 JSON 文件加载 Pipeline 定义"""
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
