"""
Novoscan-Open-Core 工具协议层

ToolDescriptor — 统一的工具自描述元数据（从 YAML 声明）
ToolRegistry   — 扫描目录，自动注册工具，按 detection_type 过滤

支持三种工具类型：
  - local:  本地 Python 函数（@tool 装饰器）
  - http:   HTTP API 调用（自动生成 Tool 包装器）
  - mcp:    MCP 远程工具（预留接口，Phase 7+ 实装）
"""

from __future__ import annotations

import importlib
import logging
from pathlib import Path
from typing import Any, Optional

import yaml
from pydantic import BaseModel, Field
from langchain_core.tools import BaseTool

logger = logging.getLogger("novoscan.tool_registry")


# ==============================================================================
# ToolDescriptor — 工具自描述元数据
# ==============================================================================

class ToolDescriptor(BaseModel):
    """工具的 YAML 声明结构"""
    id: str                                     # 唯一标识
    name: str                                   # 展示名
    description: str = ""                       # 一句话说明（给 LLM 看的）
    type: str = "local"                         # local | http | mcp
    tags: list[str] = Field(default_factory=list)       # 分类标签
    detection_types: list[str] = Field(default_factory=list)  # 适用的检测类型

    # ── local 类型专用 ──
    entry: Optional[str] = None                 # Python 函数路径 "module:function"

    # ── http 类型专用 ──
    endpoint: Optional[str] = None
    method: str = "GET"
    headers: dict[str, str] = Field(default_factory=dict)

    # ── mcp 类型专用 ──
    server: Optional[str] = None                # MCP server 名称
    tool_name: Optional[str] = None             # MCP tool 名称

    # ── 通用配置 ──
    config: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_yaml(cls, path: Path) -> "ToolDescriptor":
        """从 YAML 文件解析工具描述"""
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return cls(**data)


# ==============================================================================
# ToolRegistry — 工具注册表
# ==============================================================================

class ToolRegistry:
    """
    工具注册表 — 统一管理所有搜索/检索工具。

    - 扫描 tools/_builtin/ 和 tools/_custom/ 下的 YAML
    - 解析 ToolDescriptor
    - 加载对应的 Python 函数 / HTTP 包装 / MCP 适配
    - 按 detection_type 过滤返回 BaseTool 列表
    """

    def __init__(self):
        self._descriptors: dict[str, ToolDescriptor] = {}
        self._tools: dict[str, BaseTool] = {}
        self._yaml_paths: dict[str, Path] = {}

    def scan(self, tools_dir: Path) -> None:
        """扫描 tools/ 目录下所有 YAML 文件"""
        for sub in ["_builtin", "_custom"]:
            d = tools_dir / sub
            if not d.exists():
                continue
            for yaml_file in d.glob("*.yaml"):
                try:
                    desc = ToolDescriptor.from_yaml(yaml_file)
                    self._descriptors[desc.id] = desc
                    self._yaml_paths[desc.id] = yaml_file

                    # 加载工具实例
                    tool_instance = self._load_tool(desc)
                    if tool_instance:
                        self._tools[desc.id] = tool_instance
                        logger.debug("  ✅ 工具: %s (%s) [%s]", desc.id, desc.name, desc.type)
                    else:
                        logger.warning("  ⚠️ 工具 %s 加载失败", desc.id)

                except Exception as e:
                    logger.warning("  ⚠️ 跳过工具 YAML %s: %s", yaml_file, e)

        logger.info("🔧 工具注册完成: %d 个工具", len(self._tools))

    def _load_tool(self, desc: ToolDescriptor) -> BaseTool | None:
        """根据工具类型加载对应的 BaseTool 实例"""
        if desc.type == "local":
            return self._load_local_tool(desc)
        elif desc.type == "http":
            return self._load_http_tool(desc)
        elif desc.type == "mcp":
            logger.info("  ℹ️ MCP 工具 %s 将在 MCP 适配层实装后启用", desc.id)
            return None
        else:
            logger.warning("  ⚠️ 未知工具类型: %s", desc.type)
            return None

    def _load_local_tool(self, desc: ToolDescriptor) -> BaseTool | None:
        """加载本地 Python 函数工具"""
        if not desc.entry:
            logger.warning("  ⚠️ local 工具 %s 缺少 entry 字段", desc.id)
            return None

        try:
            module_path, func_name = desc.entry.rsplit(":", 1)
            module = importlib.import_module(module_path)
            func = getattr(module, func_name)
            return func  # @tool 装饰的函数已经是 BaseTool
        except Exception as e:
            logger.warning("  ⚠️ 加载 local 工具 %s 失败: %s", desc.id, e)
            return None

    def _load_http_tool(self, desc: ToolDescriptor) -> BaseTool | None:
        """为 HTTP API 自动生成 Tool 包装器"""
        if not desc.endpoint:
            logger.warning("  ⚠️ http 工具 %s 缺少 endpoint 字段", desc.id)
            return None

        from langchain_core.tools import StructuredTool
        import httpx

        endpoint = desc.endpoint
        method = desc.method.upper()
        headers = desc.headers
        tool_desc = desc.description

        async def _http_call(query: str) -> str:
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    if method == "GET":
                        resp = await client.get(endpoint, params={"q": query}, headers=headers)
                    else:
                        resp = await client.post(endpoint, json={"query": query}, headers=headers)
                    resp.raise_for_status()
                    return resp.text[:2000]
            except Exception as e:
                return f"HTTP 工具 {desc.id} 调用失败: {e}"

        return StructuredTool.from_function(
            coroutine=_http_call,
            name=desc.id,
            description=tool_desc or f"HTTP 工具: {desc.name}",
        )

    # ── 查询接口 ──

    def get_tools(self, detection_type: str = "auto") -> list[BaseTool]:
        """
        按 detection_type 过滤并返回工具列表。

        过滤逻辑：
          - 工具的 detection_types 列表中包含该 type → 选中
          - "auto" 只匹配声明了 "auto" 的工具
          - 空列表 → 不选（需要显式声明）
        """
        matched = []
        for tool_id, desc in self._descriptors.items():
            if detection_type in desc.detection_types:
                tool_instance = self._tools.get(tool_id)
                if tool_instance:
                    matched.append(tool_instance)

        logger.info(
            "🔍 工具过滤: type='%s' → %d 个工具 [%s]",
            detection_type,
            len(matched),
            ", ".join(t.name for t in matched),
        )
        return matched

    def get_all_tools(self) -> list[BaseTool]:
        """返回全部已注册的工具"""
        return list(self._tools.values())

    def get_descriptor(self, tool_id: str) -> ToolDescriptor | None:
        """按 ID 获取工具描述"""
        return self._descriptors.get(tool_id)

    def list_descriptors(self) -> list[ToolDescriptor]:
        """列出所有已注册的工具描述"""
        return list(self._descriptors.values())


# ── 全局单例 ──
_tool_registry: ToolRegistry | None = None


def get_tool_registry(app_dir: Path | None = None) -> ToolRegistry:
    """获取全局工具注册表（首次调用时自动扫描）"""
    global _tool_registry
    if _tool_registry is None:
        _tool_registry = ToolRegistry()
        scan_dir = app_dir or Path(__file__).parent.parent / "tools"
        _tool_registry.scan(scan_dir)
    return _tool_registry
