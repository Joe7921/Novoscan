"""
Phase 2 ReAct 检索集成测试

测试场景：
  1. ToolRegistry 扫描到 5 个内置工具
  2. detection_type=academic → 3 个工具
  3. detection_type=industrial → 2 个工具
  4. detection_type=auto → 5 个工具
  5. ReAct 节点执行后返回 retrieved_context + search_history
  6. 检索节点可作为 Tool 调用
"""

from pathlib import Path

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.core.tool_registry import ToolRegistry, ToolDescriptor


APP_DIR = Path(__file__).parent.parent / "app"
TOOLS_DIR = APP_DIR / "tools"


class TestToolDescriptor:
    """ToolDescriptor YAML 解析测试"""

    def test_parse_openalex(self):
        """OpenAlex YAML 应正确解析"""
        desc = ToolDescriptor.from_yaml(TOOLS_DIR / "_builtin" / "openalex.yaml")
        assert desc.id == "search_openalex"
        assert desc.type == "local"
        assert "academic" in desc.detection_types
        assert "auto" in desc.detection_types
        assert desc.entry == "app.tools.search:search_openalex"

    def test_parse_brave(self):
        """Brave YAML 应正确解析"""
        desc = ToolDescriptor.from_yaml(TOOLS_DIR / "_builtin" / "brave.yaml")
        assert desc.id == "search_brave"
        assert "industrial" in desc.detection_types
        assert "skill" in desc.detection_types
        assert "academic" not in desc.detection_types


class TestToolRegistry:
    """ToolRegistry 测试"""

    def test_scan_finds_all_builtin_tools(self):
        """应扫描到 5 个内置工具"""
        registry = ToolRegistry()
        registry.scan(TOOLS_DIR)

        descs = registry.list_descriptors()
        assert len(descs) == 5

        ids = {d.id for d in descs}
        assert ids == {"search_openalex", "search_arxiv", "search_crossref", "search_brave", "search_github"}

    def test_filter_academic(self):
        """academic 类型应过滤出 3 个学术工具"""
        registry = ToolRegistry()
        registry.scan(TOOLS_DIR)

        tools = registry.get_tools(detection_type="academic")
        names = {t.name for t in tools}
        assert len(tools) == 3
        assert "search_openalex" in names
        assert "search_arxiv" in names
        assert "search_crossref" in names

    def test_filter_industrial(self):
        """industrial 类型应过滤出 2 个产业工具"""
        registry = ToolRegistry()
        registry.scan(TOOLS_DIR)

        tools = registry.get_tools(detection_type="industrial")
        names = {t.name for t in tools}
        assert len(tools) == 2
        assert "search_brave" in names
        assert "search_github" in names

    def test_filter_auto(self):
        """auto 类型应返回全部 5 个工具"""
        registry = ToolRegistry()
        registry.scan(TOOLS_DIR)

        tools = registry.get_tools(detection_type="auto")
        assert len(tools) == 5

    def test_filter_skill(self):
        """skill 类型应返回 brave + github"""
        registry = ToolRegistry()
        registry.scan(TOOLS_DIR)

        tools = registry.get_tools(detection_type="skill")
        names = {t.name for t in tools}
        assert len(tools) == 2
        assert "search_brave" in names
        assert "search_github" in names

    def test_nonexistent_type_returns_empty(self):
        """不存在的 detection_type 应返回空列表"""
        registry = ToolRegistry()
        registry.scan(TOOLS_DIR)

        tools = registry.get_tools(detection_type="nonexistent")
        assert len(tools) == 0


class TestRetrievalBlockAsTool:
    """检索积木作为 Tool 的测试"""

    def test_retrieval_block_has_as_tool(self):
        """ReActRetrieverBlock 应有 as_tool 方法"""
        from app.nodes.retrieval import get_retrieval_block

        block = get_retrieval_block()
        tool = block.as_tool()
        assert tool is not None
        assert tool.name == "react_retriever"
