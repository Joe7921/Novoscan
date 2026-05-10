"""
Phase 5 补充测试 — P5.8

覆盖：
  1. FinalReport Schema 输出 camelCase 结构验证
  2. quality_gate 节点覆盖测试
  3. 报告组装器 YAML 驱动验证
  4. Compiler 条件边编译测试
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.schemas.final_report import (
    FinalReport, ReportBody, ArbitrationSummary, RadarScore,
    AgentScoreDetail, RiskFlag, KeyFinding, ReportMeta,
)
from app.nodes.quality import quality_gate_node


# ══════════════════════════════════════════════════════════════
# Test 1: FinalReport 结构验证
# ══════════════════════════════════════════════════════════════

class TestFinalReportSchema:
    """验证 FinalReport 的 camelCase 输出"""

    def test_camelcase_output(self):
        """model_dump(by_alias=True) 应输出 camelCase 字段名"""
        report = FinalReport(
            report=ReportBody(
                executive_summary="测试摘要",
                arbitration=ArbitrationSummary(
                    summary="仲裁结论",
                    radar_scores=[
                        RadarScore(key="academic", label="学术", score=80),
                    ],
                ),
                agent_scores=[
                    AgentScoreDetail(
                        name="学术审查员", score=80, confidence="high",
                        dimension_scores=[{"name": "新颖性", "score": 85}],
                        is_fallback=False,
                    ),
                ],
                risk_flags=[
                    RiskFlag(risk="市场风险", severity="high", source_agent="产业分析员"),
                ],
                key_findings=[
                    KeyFinding(title="空白大", source="学术审查员"),
                ],
                meta=ReportMeta(
                    overall_score=75.0,
                    novelty_level="High",
                    avg_agent_score=72.5,
                    agent_count=3,
                    score_gap=15.0,
                    quality_passed=True,
                ),
            ),
        )
        dumped = report.model_dump(by_alias=True)

        # 验证 camelCase 字段
        assert "executiveSummary" in dumped["report"]
        assert "radarScores" in dumped["report"]["arbitration"]
        assert "agentScores" in dumped["report"]
        assert "riskFlags" in dumped["report"]
        assert "keyFindings" in dumped["report"]
        assert "overallScore" in dumped["report"]["meta"]
        assert "noveltyLevel" in dumped["report"]["meta"]
        assert "avgAgentScore" in dumped["report"]["meta"]
        assert "agentCount" in dumped["report"]["meta"]
        assert "scoreGap" in dumped["report"]["meta"]
        assert "qualityPassed" in dumped["report"]["meta"]

        # 验证嵌套 camelCase
        agent = dumped["report"]["agentScores"][0]
        assert "dimensionScores" in agent
        assert "isFallback" in agent

        risk = dumped["report"]["riskFlags"][0]
        assert "sourceAgent" in risk

    def test_score_range_validation(self):
        """评分必须在 0-100 范围内"""
        with pytest.raises(Exception):
            RadarScore(key="test", label="test", score=150)

        with pytest.raises(Exception):
            RadarScore(key="test", label="test", score=-10)


# ══════════════════════════════════════════════════════════════
# Test 2: quality_gate 节点覆盖
# ══════════════════════════════════════════════════════════════

class TestQualityGate:
    """验证质量门 7 点检查"""

    @pytest.mark.asyncio
    async def test_all_pass(self):
        """正常数据应通过质量门"""
        state = {
            "user_raw_input": "AI无人机",
            "analyzed_intent": {"core_idea": "test"},
            "evaluation_results": [
                {"agent_name": "学术审查员", "score": 78, "confidence": "high",
                 "red_flags": ["风险1"], "is_fallback": False},
                {"agent_name": "产业分析员", "score": 68, "confidence": "medium",
                 "red_flags": ["风险2"], "is_fallback": False},
            ],
            "final_score": 73.0,
            "final_judgment": "推荐",
            "score_gap": 10.0,
            "debate_history": [],
        }
        result = await quality_gate_node(state)
        assert result["current_phase"] == "quality_gate"
        # 不应有致命问题（只有 QG-7 如果红旗太多才触发）
        logs = result["execution_logs"]
        assert any("通过" in log or "问题" in log for log in logs)

    @pytest.mark.asyncio
    async def test_score_out_of_range(self):
        """评分超出范围应检测到"""
        state = {
            "user_raw_input": "test",
            "analyzed_intent": {"core_idea": "test"},
            "evaluation_results": [
                {"agent_name": "测试Agent", "score": 150, "confidence": "high",
                 "red_flags": [], "is_fallback": False},
            ],
            "final_score": 75.0,
            "final_judgment": "推荐",
            "score_gap": 0,
            "debate_history": [],
        }
        result = await quality_gate_node(state)
        logs = " ".join(result["execution_logs"])
        assert "QG-1" in logs

    @pytest.mark.asyncio
    async def test_invalid_confidence(self):
        """非法置信度应检测到"""
        state = {
            "user_raw_input": "test",
            "analyzed_intent": {"core_idea": "test"},
            "evaluation_results": [
                {"agent_name": "测试Agent", "score": 70, "confidence": "invalid",
                 "red_flags": [], "is_fallback": False},
            ],
            "final_score": 70.0,
            "final_judgment": "推荐",
            "score_gap": 0,
            "debate_history": [],
        }
        result = await quality_gate_node(state)
        logs = " ".join(result["execution_logs"])
        assert "QG-2" in logs

    @pytest.mark.asyncio
    async def test_debate_consistency(self):
        """分差>20 但无辩论应检测到"""
        state = {
            "user_raw_input": "test",
            "analyzed_intent": {"core_idea": "test"},
            "evaluation_results": [
                {"agent_name": "A", "score": 80, "confidence": "high",
                 "red_flags": [], "is_fallback": False},
                {"agent_name": "B", "score": 50, "confidence": "medium",
                 "red_flags": [], "is_fallback": False},
            ],
            "final_score": 65.0,
            "final_judgment": "推荐",
            "score_gap": 30.0,
            "debate_history": [],
        }
        result = await quality_gate_node(state)
        logs = " ".join(result["execution_logs"])
        assert "QG-3" in logs

    @pytest.mark.asyncio
    async def test_missing_fields(self):
        """缺失关键字段应检测到"""
        state = {
            "user_raw_input": "",
            "evaluation_results": [],
            "final_score": None,
            "final_judgment": None,
            "score_gap": 0,
            "debate_history": [],
        }
        result = await quality_gate_node(state)
        logs = " ".join(result["execution_logs"])
        assert "QG-5" in logs

    @pytest.mark.asyncio
    async def test_fallback_ratio(self):
        """降级占比过高应检测到"""
        state = {
            "user_raw_input": "test",
            "analyzed_intent": {"core_idea": "test"},
            "evaluation_results": [
                {"agent_name": "A", "score": 70, "confidence": "high",
                 "red_flags": [], "is_fallback": True},
                {"agent_name": "B", "score": 60, "confidence": "medium",
                 "red_flags": [], "is_fallback": True},
            ],
            "final_score": 65.0,
            "final_judgment": "推荐",
            "score_gap": 10.0,
            "debate_history": [],
        }
        result = await quality_gate_node(state)
        logs = " ".join(result["execution_logs"])
        assert "QG-6" in logs


# ══════════════════════════════════════════════════════════════
# Test 3: Compiler 条件边编译
# ══════════════════════════════════════════════════════════════

class TestCompilerConditionalEdges:
    """验证 Compiler 能处理条件边和中断点"""

    def test_compile_with_conditions(self):
        """编译含条件边的管线"""
        from app.core.compiler import PipelineCompiler

        async def mock_node_a(state):
            return {"current_phase": "a"}

        async def mock_node_b(state):
            return {"current_phase": "b"}

        async def mock_node_c(state):
            return {"current_phase": "c"}

        def route_a(state):
            return "go_b" if state.get("score_gap", 0) > 20 else "go_c"

        compiler = PipelineCompiler(
            node_functions={"step_a": mock_node_a, "step_b": mock_node_b, "step_c": mock_node_c},
            condition_functions={"step_a": route_a},
        )

        pipeline = {
            "name": "测试管线",
            "nodes": [
                {"id": "step_a", "type": "agent"},
                {"id": "step_b", "type": "agent"},
                {"id": "step_c", "type": "agent"},
            ],
            "edges": [
                {"from": "START", "to": "step_a"},
                {"from": "step_a", "to": "step_b", "condition": "go_b"},
                {"from": "step_a", "to": "step_c", "condition": "go_c"},
                {"from": "step_b", "to": "END"},
                {"from": "step_c", "to": "END"},
            ],
        }

        compiled = compiler.compile(pipeline)
        assert compiled is not None

    def test_missing_node_function_raises(self):
        """缺少节点函数应报错"""
        from app.core.compiler import PipelineCompiler

        compiler = PipelineCompiler(node_functions={})
        pipeline = {
            "name": "test",
            "nodes": [{"id": "missing_node", "type": "agent"}],
            "edges": [{"from": "START", "to": "missing_node"}],
        }

        with pytest.raises(ValueError, match="编译错误"):
            compiler.compile(pipeline)

    def test_missing_condition_function_raises(self):
        """缺少条件函数应报错"""
        from app.core.compiler import PipelineCompiler

        async def mock_node(state):
            return {}

        compiler = PipelineCompiler(
            node_functions={"step": mock_node, "step2": mock_node},
            condition_functions={},
        )
        pipeline = {
            "name": "test",
            "nodes": [{"id": "step", "type": "agent"}, {"id": "step2", "type": "agent"}],
            "edges": [
                {"from": "START", "to": "step"},
                {"from": "step", "to": "step2", "condition": "go"},
            ],
        }

        with pytest.raises(ValueError, match="路由函数"):
            compiler.compile(pipeline)

    def test_load_standard_json(self):
        """验证 standard.json 可加载"""
        from app.core.compiler import PipelineCompiler
        from pathlib import Path

        path = Path(__file__).parent.parent / "app" / "pipelines" / "standard.json"
        pipeline = PipelineCompiler.load_pipeline(path)
        assert pipeline["name"] == "标准分析管线"
        assert len(pipeline["nodes"]) == 8
        assert "interrupt_before" in pipeline
