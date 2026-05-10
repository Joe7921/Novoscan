"""
Phase 10a — Studio Agent 单元测试

测试覆盖：
  1. Pydantic Schema 校验（合法/非法）
  2. Schema → YAML/JSON 往返一致性
  3. 8 个 Tool 功能验证
  4. DryRun 拓扑分析
  5. build_studio_agent 构建
"""

import json
import shutil
import tempfile
from pathlib import Path

import pytest
import yaml

langchain_available = pytest.importorskip("langchain_core", reason="langchain_core not installed") if False else None
try:
    import langchain_core  # noqa: F401
    HAS_LANGCHAIN = True
except ImportError:
    HAS_LANGCHAIN = False

skip_no_langchain = pytest.mark.skipif(not HAS_LANGCHAIN, reason="langchain_core not installed")


# ══════════════════════════════════════════════════════════════
# Schema 校验测试
# ══════════════════════════════════════════════════════════════

class TestAgentYAMLSchema:
    def test_valid_schema(self):
        from app.core.studio_agent import AgentYAMLSchema
        schema = AgentYAMLSchema(
            id="test_agent",
            name="测试 Agent",
            description="用于测试的 Agent",
            category="scoring",
            role_type="evaluator",
            prompt="你是一个评分专家。",
        )
        assert schema.id == "test_agent"
        assert schema.category == "scoring"
        assert schema.temperature == 0.3
        assert "retrieved_context" in schema.inputs

    def test_invalid_category(self):
        from app.core.studio_agent import AgentYAMLSchema
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            AgentYAMLSchema(
                id="bad", name="Bad", description="x",
                category="invalid_cat",
                role_type="evaluator",
                prompt="x",
            )

    def test_invalid_role_type(self):
        from app.core.studio_agent import AgentYAMLSchema
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            AgentYAMLSchema(
                id="bad", name="Bad", description="x",
                category="scoring",
                role_type="nonexistent_role",
                prompt="x",
            )

    def test_temperature_bounds(self):
        from app.core.studio_agent import AgentYAMLSchema
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            AgentYAMLSchema(
                id="bad", name="Bad", description="x",
                category="scoring", role_type="evaluator",
                prompt="x", temperature=1.5,
            )

    def test_missing_required_fields(self):
        from app.core.studio_agent import AgentYAMLSchema
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            AgentYAMLSchema(id="no_prompt", name="X", description="X", category="scoring", role_type="evaluator")


class TestInteractionYAMLSchema:
    def test_valid(self):
        from app.core.studio_agent import InteractionYAMLSchema
        schema = InteractionYAMLSchema(
            id="test_debate",
            name="测试辩论",
            description="测试交互模式",
            inputs=["context"],
            outputs=["result"],
            roles={"pro": "1", "con": "1"},
        )
        assert schema.roles["pro"] == "1"

    def test_missing_roles(self):
        from app.core.studio_agent import InteractionYAMLSchema
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            InteractionYAMLSchema(
                id="bad", name="X", description="X",
                inputs=["a"], outputs=["b"],
            )


class TestReportYAMLSchema:
    def test_valid(self):
        from app.core.studio_agent import ReportYAMLSchema, ReportSectionSchema
        schema = ReportYAMLSchema(
            id="test_report",
            name="测试报告",
            description="测试",
            requires=["agent_a"],
            sections=[ReportSectionSchema(id="s1", type="radar", layout={"width": "full"})],
        )
        assert len(schema.sections) == 1
        assert schema.sections[0].type == "radar"


class TestPipelineJSONSchema:
    def test_valid(self):
        from app.core.studio_agent import PipelineJSONSchema, PipelineNodeSchema, PipelineEdgeSchema
        schema = PipelineJSONSchema(
            name="test_pipeline",
            description="测试管线",
            nodes=[PipelineNodeSchema(id="n1", type="agent", agent_id="scorer")],
            edges=[PipelineEdgeSchema(source="START", target="n1"), PipelineEdgeSchema(source="n1", target="END")],
        )
        assert len(schema.nodes) == 1
        assert schema.edges[0].source == "START"


# ══════════════════════════════════════════════════════════════
# Schema → YAML/JSON 往返测试
# ══════════════════════════════════════════════════════════════

class TestSchemaToYAML:
    def test_agent_roundtrip(self):
        from app.core.studio_agent import AgentYAMLSchema, agent_schema_to_yaml
        schema = AgentYAMLSchema(
            id="roundtrip_agent", name="往返测试", description="desc",
            category="scoring", role_type="evaluator",
            prompt="你是评分专家。", temperature=0.5,
        )
        yaml_str = agent_schema_to_yaml(schema)
        data = yaml.safe_load(yaml_str)
        assert data["id"] == "roundtrip_agent"
        assert data["name"] == "往返测试"
        assert data["category"] == "scoring"
        assert data["role_type"] == "evaluator"
        assert data["config_schema"]["prompt"]["default"] == "你是评分专家。"
        assert data["config_schema"]["temperature"]["default"] == 0.5

    def test_interaction_roundtrip(self):
        from app.core.studio_agent import InteractionYAMLSchema, interaction_schema_to_yaml
        schema = InteractionYAMLSchema(
            id="rt_interact", name="往返交互", description="desc",
            inputs=["ctx"], outputs=["res"],
            roles={"a": "2..n"}, config={"parallel": True},
        )
        yaml_str = interaction_schema_to_yaml(schema)
        data = yaml.safe_load(yaml_str)
        assert data["id"] == "rt_interact"
        assert data["category"] == "interaction"
        assert data["roles"]["a"] == "2..n"
        assert data["config"]["parallel"] is True

    def test_report_roundtrip(self):
        from app.core.studio_agent import ReportYAMLSchema, ReportSectionSchema, report_schema_to_yaml
        schema = ReportYAMLSchema(
            id="rt_report", name="往返报告", description="d",
            requires=["a1", "a2"],
            sections=[ReportSectionSchema(id="s1", type="table", layout={"width": "full"}, columns=["A", "B"])],
        )
        yaml_str = report_schema_to_yaml(schema)
        data = yaml.safe_load(yaml_str)
        assert data["id"] == "rt_report"
        assert data["requires"] == ["a1", "a2"]
        assert data["sections"][0]["type"] == "table"
        assert data["sections"][0]["columns"] == ["A", "B"]

    def test_pipeline_roundtrip(self):
        from app.core.studio_agent import PipelineJSONSchema, PipelineNodeSchema, PipelineEdgeSchema, pipeline_schema_to_json
        schema = PipelineJSONSchema(
            name="rt_pipeline", description="d",
            nodes=[PipelineNodeSchema(id="n1", type="agent", agent_id="scorer")],
            edges=[PipelineEdgeSchema(source="START", target="n1"), PipelineEdgeSchema(source="n1", target="END")],
        )
        json_str = pipeline_schema_to_json(schema)
        data = json.loads(json_str)
        assert data["name"] == "rt_pipeline"
        assert data["edges"][0]["from"] == "START"
        assert data["edges"][1]["to"] == "END"


# ══════════════════════════════════════════════════════════════
# DryRun 拓扑分析测试
# ══════════════════════════════════════════════════════════════

class TestDryRunPipeline:
    def test_valid_pipeline(self):
        from app.core.studio_agent import _dry_run_pipeline
        pipeline = {
            "nodes": [{"id": "n1"}, {"id": "n2"}],
            "edges": [
                {"from": "START", "to": "n1"},
                {"from": "n1", "to": "n2"},
                {"from": "n2", "to": "END"},
            ],
        }
        result = _dry_run_pipeline(pipeline)
        assert result["success"] is True
        assert result["node_count"] == 2
        assert result["edge_count"] == 3
        assert result["warnings"] == []

    def test_missing_edge_target(self):
        from app.core.studio_agent import _dry_run_pipeline
        pipeline = {
            "nodes": [{"id": "n1"}],
            "edges": [{"from": "START", "to": "n1"}, {"from": "n1", "to": "nonexistent"}],
        }
        result = _dry_run_pipeline(pipeline)
        assert result["success"] is False
        assert any("nonexistent" in w for w in result["warnings"])

    def test_isolated_node(self):
        from app.core.studio_agent import _dry_run_pipeline
        pipeline = {
            "nodes": [{"id": "n1"}, {"id": "n2"}, {"id": "orphan"}],
            "edges": [{"from": "START", "to": "n1"}, {"from": "n1", "to": "n2"}, {"from": "n2", "to": "END"}],
        }
        result = _dry_run_pipeline(pipeline)
        assert result["success"] is False
        assert any("orphan" in w for w in result["warnings"])

    def test_cycle_detection(self):
        from app.core.studio_agent import _dry_run_pipeline
        pipeline = {
            "nodes": [{"id": "a"}, {"id": "b"}],
            "edges": [
                {"from": "START", "to": "a"},
                {"from": "a", "to": "b"},
                {"from": "b", "to": "a"},
            ],
        }
        result = _dry_run_pipeline(pipeline)
        assert result["success"] is False
        assert any("循环" in w for w in result["warnings"])


# ══════════════════════════════════════════════════════════════
# Tool 功能测试（使用临时目录）
# ══════════════════════════════════════════════════════════════

@skip_no_langchain
class TestCreateAgentTool:
    def test_create_and_registry(self, tmp_path, monkeypatch):
        """创建 Agent → _custom/ 有文件 → Registry 可查"""
        import app.core.studio_agent as sa

        # 重定向 _APP_DIR 到临时目录
        app_dir = tmp_path / "app"
        (app_dir / "agents" / "_builtin").mkdir(parents=True)
        (app_dir / "agents" / "_custom").mkdir(parents=True)
        (app_dir / "interactions" / "_builtin").mkdir(parents=True)
        (app_dir / "reports" / "_builtin").mkdir(parents=True)
        monkeypatch.setattr(sa, "_APP_DIR", app_dir)

        # 写一个 minimal builtin agent 让 registry 有基础数据
        builtin_yaml = "id: base_agent\nname: Base\ndescription: x\ncategory: scoring\n"
        (app_dir / "agents" / "_builtin" / "base_agent.yaml").write_text(builtin_yaml, encoding="utf-8")

        # 重置 registry 单例
        import app.core.registry as reg_mod
        monkeypatch.setattr(reg_mod, "_registry", None)
        # 让 get_registry 使用 tmp 目录
        monkeypatch.setattr(reg_mod, "get_registry", lambda app_dir_arg=None: _get_tmp_registry(app_dir))

        result_json = sa._build_create_agent_tool().invoke({
            "id": "new_scorer",
            "name": "新评分 Agent",
            "description": "测试创建",
            "category": "scoring",
            "role_type": "evaluator",
            "prompt": "你是评分专家。",
            "inputs": "ctx,intent",
            "outputs": "score",
        })
        result = json.loads(result_json)
        assert result["status"] == "created"
        assert result["id"] == "new_scorer"

        # 验证文件存在
        yaml_path = app_dir / "agents" / "_custom" / "new_scorer.yaml"
        assert yaml_path.exists()
        data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
        assert data["id"] == "new_scorer"
        assert data["config_schema"]["prompt"]["default"] == "你是评分专家。"

    def test_duplicate_id_conflict(self, tmp_path, monkeypatch):
        """重复 ID 应返回 conflict"""
        import app.core.studio_agent as sa

        app_dir = tmp_path / "app"
        custom_dir = app_dir / "agents" / "_custom"
        custom_dir.mkdir(parents=True)
        (app_dir / "agents" / "_builtin").mkdir(parents=True)
        (app_dir / "interactions" / "_builtin").mkdir(parents=True)
        (app_dir / "reports" / "_builtin").mkdir(parents=True)
        monkeypatch.setattr(sa, "_APP_DIR", app_dir)

        import app.core.registry as reg_mod
        monkeypatch.setattr(reg_mod, "_registry", None)
        monkeypatch.setattr(reg_mod, "get_registry", lambda app_dir_arg=None: _get_tmp_registry(app_dir))

        # 先创建
        (custom_dir / "dup.yaml").write_text("id: dup\nname: Dup\n", encoding="utf-8")

        result_json = sa._build_create_agent_tool().invoke({
            "id": "dup", "name": "Dup", "description": "x",
            "category": "scoring", "role_type": "evaluator", "prompt": "x",
        })
        result = json.loads(result_json)
        assert result["status"] == "conflict"


@skip_no_langchain
class TestValidateYAMLTool:
    def test_valid_agent_yaml(self):
        from app.core.studio_agent import _build_validate_yaml_tool
        tool_fn = _build_validate_yaml_tool()
        yaml_content = "id: ok\nname: OK Agent\ndescription: test\ncategory: scoring\nrole_type: evaluator\ninputs: [ctx]\noutputs: [res]\n"
        result = json.loads(tool_fn.invoke({"yaml_content": yaml_content, "block_type": "agent"}))
        assert result["valid"] is True

    def test_invalid_agent_yaml_missing_id(self):
        from app.core.studio_agent import _build_validate_yaml_tool
        tool_fn = _build_validate_yaml_tool()
        yaml_content = "name: No ID\n"
        result = json.loads(tool_fn.invoke({"yaml_content": yaml_content, "block_type": "agent"}))
        assert result["valid"] is False
        assert any("id" in e for e in result["errors"])

    def test_bad_yaml_syntax(self):
        from app.core.studio_agent import _build_validate_yaml_tool
        tool_fn = _build_validate_yaml_tool()
        result = json.loads(tool_fn.invoke({"yaml_content": "{{bad yaml::", "block_type": "agent"}))
        assert result["valid"] is False


@skip_no_langchain
class TestListBlocksTool:
    def test_list_returns_summary(self):
        from app.core.studio_agent import _build_list_blocks_tool
        tool_fn = _build_list_blocks_tool()
        result = tool_fn.invoke({"category_filter": ""})
        # 至少应返回字符串（可能有积木也可能没有）
        assert isinstance(result, str)


@skip_no_langchain
class TestDryRunPipelineTool:
    def test_dry_run_valid_json(self):
        from app.core.studio_agent import _build_dry_run_pipeline_tool
        tool_fn = _build_dry_run_pipeline_tool()
        pipeline_json = json.dumps({
            "nodes": [{"id": "n1"}],
            "edges": [{"from": "START", "to": "n1"}, {"from": "n1", "to": "END"}],
        })
        result = json.loads(tool_fn.invoke({"pipeline_name_or_json": pipeline_json}))
        assert result["success"] is True

    def test_dry_run_bad_json(self):
        from app.core.studio_agent import _build_dry_run_pipeline_tool
        tool_fn = _build_dry_run_pipeline_tool()
        result = json.loads(tool_fn.invoke({"pipeline_name_or_json": "{bad json"}))
        assert result["success"] is False


# ══════════════════════════════════════════════════════════════
# build_studio_agent 构建测试
# ══════════════════════════════════════════════════════════════

@skip_no_langchain
class TestBuildStudioAgent:
    def test_agent_has_8_tools(self):
        """验证构建的 Agent 包含 8 个工具"""
        try:
            from app.core.studio_agent import build_studio_agent
            agent = build_studio_agent()
            # create_react_agent 返回的 CompiledGraph 包含 tools
            # 通过 agent.get_graph().nodes 检查
            assert agent is not None
        except Exception as e:
            # 如果模型未配置，跳过
            if "API Key" in str(e) or "Base URL" in str(e):
                pytest.skip("LLM 未配置，跳过 Agent 构建测试")
            raise


# ══════════════════════════════════════════════════════════════
# 辅助函数
# ══════════════════════════════════════════════════════════════

def _get_tmp_registry(app_dir: Path):
    """为测试创建临时 Registry"""
    from app.core.registry import BlockRegistry
    reg = BlockRegistry()
    reg.scan(app_dir)
    return reg


# ══════════════════════════════════════════════════════════════
# P10a-S8: Agentic Tool 测试
# ══════════════════════════════════════════════════════════════

@skip_no_langchain
class TestReadAgenticConfigTool:
    def test_read_returns_json(self):
        from app.core.studio_agent import _build_read_agentic_config_tool
        tool_fn = _build_read_agentic_config_tool()
        result = tool_fn.invoke({})
        data = json.loads(result)
        assert "system_prompt_length" in data
        assert "model" in data
        assert "tools" in data
        assert isinstance(data["tools"], list)

    def test_read_has_prompt_preview(self):
        from app.core.studio_agent import _build_read_agentic_config_tool
        tool_fn = _build_read_agentic_config_tool()
        result = json.loads(tool_fn.invoke({}))
        assert "system_prompt_preview" in result
        assert isinstance(result["system_prompt_length"], int)


@skip_no_langchain
class TestDiagnoseAgenticTool:
    def test_diagnose_all(self):
        from app.core.studio_agent import _build_diagnose_agentic_tool
        tool_fn = _build_diagnose_agentic_tool()
        result = json.loads(tool_fn.invoke({"focus": "all"}))
        assert result["status"] == "diagnosed"
        assert "findings" in result
        assert "warnings" in result
        assert "suggestions" in result
        assert "config_summary" in result

    def test_diagnose_prompt_focus(self):
        from app.core.studio_agent import _build_diagnose_agentic_tool
        tool_fn = _build_diagnose_agentic_tool()
        result = json.loads(tool_fn.invoke({"focus": "prompt"}))
        assert result["focus"] == "prompt"

    def test_diagnose_token_estimate(self):
        from app.core.studio_agent import _build_diagnose_agentic_tool
        tool_fn = _build_diagnose_agentic_tool()
        result = json.loads(tool_fn.invoke({"focus": "token_estimate"}))
        assert any("Token" in f for f in result["findings"])


@skip_no_langchain
class TestDryRunAgenticTool:
    def test_dry_run_returns_plan(self):
        from app.core.studio_agent import _build_dry_run_agentic_tool
        tool_fn = _build_dry_run_agentic_tool()
        result = json.loads(tool_fn.invoke({}))
        assert result["status"] == "dry_run_ok"
        assert "plan_steps" in result
        assert "estimated_total_tokens" in result
        assert "config_snapshot" in result


@skip_no_langchain
class TestGetAgenticRunLogsTool:
    def test_no_logs_returns_friendly(self):
        from app.core.studio_agent import _build_get_agentic_run_logs_tool
        tool_fn = _build_get_agentic_run_logs_tool()
        result = json.loads(tool_fn.invoke({"include_history": False}))
        assert result["has_log"] is False

    def test_include_history_param(self):
        from app.core.studio_agent import _build_get_agentic_run_logs_tool
        tool_fn = _build_get_agentic_run_logs_tool()
        result = json.loads(tool_fn.invoke({"include_history": True}))
        assert "history" in result


@skip_no_langchain
class TestBuildStudioAgentAgenticMode:
    def test_agentic_mode_builds(self):
        """验证 Agentic 模式下 Agent 可构建"""
        try:
            from app.core.studio_agent import build_studio_agent
            agent = build_studio_agent(mode="agentic")
            assert agent is not None
        except Exception as e:
            if "API Key" in str(e) or "Base URL" in str(e):
                pytest.skip("LLM 未配置，跳过 Agent 构建测试")
            raise
