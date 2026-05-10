"""
Phase 0.5 积木协议层测试

覆盖：
  - BlockMeta 从 YAML 解析
  - AgentBlock 基类双重接口
  - InteractionMeta 角色解析
  - ReportMeta 章节解析
  - BlockRegistry 扫描注册
  - PipelineCompiler 最简编译
"""

from pathlib import Path

import pytest

from app.core.base import (
    BlockMeta,
    ConfigField,
    InteractionMeta,
    ReportMeta,
    ReportSection,
)
from app.core.registry import BlockRegistry
from app.core.compiler import PipelineCompiler


# ── 测试路径 ──
APP_DIR = Path(__file__).parent.parent / "app"
AGENTS_DIR = APP_DIR / "agents" / "_builtin"
INTERACTIONS_DIR = APP_DIR / "interactions" / "_builtin"
REPORTS_DIR = APP_DIR / "reports" / "_builtin"


class TestBlockMeta:
    """BlockMeta YAML 解析测试"""

    def test_parse_academic_reviewer(self):
        """学术审查员 YAML 应正确解析"""
        yaml_path = AGENTS_DIR / "academic_reviewer.yaml"
        meta = BlockMeta.from_yaml(yaml_path)

        assert meta.id == "academic_reviewer"
        assert meta.name == "学术审查员"
        assert meta.category == "scoring"
        assert "retrieved_context" in meta.inputs
        assert "analyzed_intent" in meta.inputs
        assert "evaluation_result" in meta.outputs

    def test_config_schema_parsed(self):
        """配置参数应正确解析"""
        yaml_path = AGENTS_DIR / "academic_reviewer.yaml"
        meta = BlockMeta.from_yaml(yaml_path)

        assert "temperature" in meta.config_schema
        assert meta.config_schema["temperature"].default == 0.3


class TestInteractionMeta:
    """InteractionMeta 解析测试"""

    def test_parse_adversarial_debate(self):
        """辩论交互模式 YAML 应正确解析角色"""
        yaml_path = INTERACTIONS_DIR / "adversarial_debate.yaml"
        meta = InteractionMeta.from_yaml(yaml_path)

        assert meta.id == "adversarial_debate"
        assert meta.name == "对抗辩论"
        assert len(meta.roles) == 2

        role_names = {r.name for r in meta.roles}
        assert "moderator" in role_names
        assert "debaters" in role_names

    def test_debate_config(self):
        """辩论配置参数应正确解析"""
        yaml_path = INTERACTIONS_DIR / "adversarial_debate.yaml"
        meta = InteractionMeta.from_yaml(yaml_path)

        assert "trigger_threshold" in meta.config_schema
        assert meta.config_schema["trigger_threshold"].default == 20
        assert meta.config_schema["max_rounds"].default == 3
        assert meta.config_schema["ko_enabled"].default is True


class TestReportMeta:
    """ReportMeta 解析测试"""

    def test_parse_innovation_radar(self):
        """创新雷达报告 YAML 应正确解析"""
        yaml_path = REPORTS_DIR / "innovation_radar.yaml"
        meta = ReportMeta.from_yaml(yaml_path)

        assert meta.id == "innovation_radar"
        assert "academic_scorer" in meta.requires
        assert len(meta.sections) == 5

    def test_sections_have_types(self):
        """每个报告章节应有可视化组件类型"""
        yaml_path = REPORTS_DIR / "innovation_radar.yaml"
        meta = ReportMeta.from_yaml(yaml_path)

        section_types = {s.id: s.type for s in meta.sections}
        assert section_types["executive_summary"] == "llm_generated"
        assert section_types["radar_chart"] == "radar"
        assert section_types["score_comparison"] == "bar_chart"
        assert section_types["risk_flags"] == "table"
        assert section_types["detailed_analysis"] == "markdown_card"

    def test_sections_have_layout(self):
        """报告章节应包含前端布局参数"""
        yaml_path = REPORTS_DIR / "innovation_radar.yaml"
        meta = ReportMeta.from_yaml(yaml_path)

        radar = next(s for s in meta.sections if s.id == "radar_chart")
        assert radar.layout["width"] == "full"
        assert radar.layout["height"] == 400


class TestBlockRegistry:
    """积木注册表测试"""

    def test_scan_finds_builtin_agents(self):
        """Registry 应扫描到内置 Agent"""
        registry = BlockRegistry()
        registry.scan(APP_DIR)

        agents = registry.list_agents()
        assert len(agents) >= 1

        ids = {a.id for a in agents}
        assert "academic_reviewer" in ids

    def test_scan_finds_interactions(self):
        """Registry 应扫描到内置交互模式"""
        registry = BlockRegistry()
        registry.scan(APP_DIR)

        interactions = registry.list_interactions()
        assert len(interactions) >= 1
        assert any(i.id == "adversarial_debate" for i in interactions)

    def test_scan_finds_reports(self):
        """Registry 应扫描到内置报告插件"""
        registry = BlockRegistry()
        registry.scan(APP_DIR)

        reports = registry.list_reports()
        assert len(reports) >= 1
        assert any(r.id == "innovation_radar" for r in reports)

    def test_get_agent_meta(self):
        """按 ID 应能获取 Agent 元数据"""
        registry = BlockRegistry()
        registry.scan(APP_DIR)

        meta = registry.get_agent_meta("academic_reviewer")
        assert meta is not None
        assert meta.name == "学术审查员"

    def test_get_nonexistent_returns_none(self):
        """查询不存在的 ID 应返回 None"""
        registry = BlockRegistry()
        registry.scan(APP_DIR)

        assert registry.get_agent_meta("nonexistent") is None

    def test_list_all_overview(self):
        """列出全部积木概览"""
        registry = BlockRegistry()
        registry.scan(APP_DIR)

        overview = registry.list_all_overview()
        assert "agents" in overview
        assert "interactions" in overview
        assert "reports" in overview


class TestPipelineCompiler:
    """编译器测试"""

    def test_compile_two_node_pipeline(self):
        """两节点管线应能正确编译"""

        async def node_a(state):
            return {"current_phase": "node_a_done"}

        async def node_b(state):
            return {"current_phase": "node_b_done"}

        compiler = PipelineCompiler(
            node_functions={"step1": node_a, "step2": node_b}
        )

        pipeline_def = {
            "name": "测试管线",
            "nodes": [
                {"id": "step1", "type": "agent"},
                {"id": "step2", "type": "agent"},
            ],
            "edges": [
                {"from": "START", "to": "step1"},
                {"from": "step1", "to": "step2"},
                {"from": "step2", "to": "END"},
            ],
        }

        graph = compiler.compile(pipeline_def)
        assert graph is not None

    def test_compile_missing_function_raises(self):
        """缺少执行函数时应抛出 ValueError"""
        compiler = PipelineCompiler(node_functions={})

        pipeline_def = {
            "name": "缺函数管线",
            "nodes": [{"id": "step1", "type": "agent"}],
            "edges": [
                {"from": "START", "to": "step1"},
                {"from": "step1", "to": "END"},
            ],
        }

        with pytest.raises(ValueError, match="编译错误"):
            compiler.compile(pipeline_def)
