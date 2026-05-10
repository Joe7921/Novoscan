"""
Novoscan-Open-Core 积木注册表

自动扫描 agents/_builtin/ + _custom/ 目录，注册所有 YAML 积木。
支持三种积木类型：Agent / Interaction / Report。
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from app.core.base import (
    AgentBlock,
    BlockMeta,
    InteractionBlock,
    InteractionMeta,
    ReportBlock,
    ReportMeta,
)

logger = logging.getLogger("novoscan.registry")


class BlockRegistry:
    """
    积木注册表。

    负责：
      1. 扫描指定目录下的所有 YAML 文件
      2. 解析为对应的 Meta 对象
      3. 提供按 ID 查找、按类型列出的接口

    用法：
        registry = BlockRegistry()
        registry.scan(Path("app/agents"))
        agent_meta = registry.get_agent_meta("academic_scorer")
    """

    def __init__(self):
        self._agents: dict[str, BlockMeta] = {}
        self._interactions: dict[str, InteractionMeta] = {}
        self._reports: dict[str, ReportMeta] = {}
        self._yaml_paths: dict[str, Path] = {}  # id → YAML 文件路径

    def scan(self, base_dir: Path) -> None:
        """
        扫描目录结构，自动注册所有 YAML 积木。

        期望的目录结构：
          base_dir/
            agents/_builtin/*.yaml
            agents/_custom/*.yaml
            interactions/_builtin/*.yaml
            interactions/_custom/*.yaml
            reports/_builtin/*.yaml
            reports/_custom/*.yaml
        """
        self._scan_agents(base_dir / "agents")
        self._scan_interactions(base_dir / "interactions")
        self._scan_reports(base_dir / "reports")

        total = len(self._agents) + len(self._interactions) + len(self._reports)
        logger.info(
            "📦 积木注册完成: %d 个 Agent, %d 个交互模式, %d 个报告插件 (共 %d)",
            len(self._agents), len(self._interactions), len(self._reports), total,
        )

    def _scan_agents(self, agents_dir: Path) -> None:
        """扫描 Agent YAML 文件"""
        for sub in ["_builtin", "_custom"]:
            d = agents_dir / sub
            if not d.exists():
                continue
            for yaml_file in d.glob("*.yaml"):
                try:
                    meta = BlockMeta.from_yaml(yaml_file)
                    self._agents[meta.id] = meta
                    self._yaml_paths[meta.id] = yaml_file
                    logger.debug("  ✅ Agent: %s (%s)", meta.id, meta.name)
                except Exception as e:
                    logger.warning("  ⚠️ 跳过 Agent YAML %s: %s", yaml_file, e)

    def _scan_interactions(self, interactions_dir: Path) -> None:
        """扫描交互模式 YAML 文件"""
        for sub in ["_builtin", "_custom"]:
            d = interactions_dir / sub
            if not d.exists():
                continue
            for yaml_file in d.glob("*.yaml"):
                try:
                    meta = InteractionMeta.from_yaml(yaml_file)
                    self._interactions[meta.id] = meta
                    self._yaml_paths[meta.id] = yaml_file
                    logger.debug("  ✅ 交互模式: %s (%s)", meta.id, meta.name)
                except Exception as e:
                    logger.warning("  ⚠️ 跳过交互模式 YAML %s: %s", yaml_file, e)

    def _scan_reports(self, reports_dir: Path) -> None:
        """扫描报告插件 YAML 文件"""
        for sub in ["_builtin", "_custom"]:
            d = reports_dir / sub
            if not d.exists():
                continue
            for yaml_file in d.glob("*.yaml"):
                try:
                    meta = ReportMeta.from_yaml(yaml_file)
                    self._reports[meta.id] = meta
                    self._yaml_paths[meta.id] = yaml_file
                    logger.debug("  ✅ 报告插件: %s (%s)", meta.id, meta.name)
                except Exception as e:
                    logger.warning("  ⚠️ 跳过报告 YAML %s: %s", yaml_file, e)

    # ── 查询接口 ──

    def get_agent_meta(self, agent_id: str) -> Optional[BlockMeta]:
        """按 ID 获取 Agent 元数据"""
        return self._agents.get(agent_id)

    def get_interaction_meta(self, interaction_id: str) -> Optional[InteractionMeta]:
        """按 ID 获取交互模式元数据"""
        return self._interactions.get(interaction_id)

    def get_report_meta(self, report_id: str) -> Optional[ReportMeta]:
        """按 ID 获取报告插件元数据"""
        return self._reports.get(report_id)

    def get_yaml_path(self, block_id: str) -> Optional[Path]:
        """获取积木的 YAML 文件路径"""
        return self._yaml_paths.get(block_id)

    def list_agents(self) -> list[BlockMeta]:
        """列出所有已注册的 Agent"""
        return list(self._agents.values())

    def list_interactions(self) -> list[InteractionMeta]:
        """列出所有已注册的交互模式"""
        return list(self._interactions.values())

    def list_reports(self) -> list[ReportMeta]:
        """列出所有已注册的报告插件"""
        return list(self._reports.values())

    def list_all(self) -> list[dict]:
        """列出全部积木（Agent + Interaction + Report）"""
        all_blocks = []
        for m in self._agents.values():
            d = m.model_dump()
            d["block_type"] = "agent"
            all_blocks.append(d)
        for m in self._interactions.values():
            d = m.model_dump()
            d["block_type"] = "interaction"
            all_blocks.append(d)
        for m in self._reports.values():
            d = m.model_dump()
            d["block_type"] = "report"
            all_blocks.append(d)
        return all_blocks

    def list_all_overview(self) -> dict:
        """列出全部积木概览（三层结构）"""
        return {
            "agents": [m.model_dump() for m in self._agents.values()],
            "interactions": [m.model_dump() for m in self._interactions.values()],
            "reports": [m.model_dump() for m in self._reports.values()],
        }


# ── 全局单例 ──
_registry: Optional[BlockRegistry] = None


def get_registry(app_dir: Path | None = None) -> BlockRegistry:
    """获取全局积木注册表（首次调用时自动扫描）"""
    global _registry
    if _registry is None:
        _registry = BlockRegistry()
        scan_dir = app_dir or Path(__file__).parent.parent
        _registry.scan(scan_dir)
    return _registry


# 别名 — scoring_node 使用此名称
get_block_registry = get_registry
