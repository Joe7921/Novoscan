"""
Phase 5 仲裁裁决测试

覆盖：
  1. 仲裁节点正常执行
  2. 异常降级
  3. ArbitrationResult schema 验证
  4. 完整管线拓扑（scoring → debate(条件) → arbitration → END）
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

from app.schemas.agent_output import ArbitrationResult


class TestArbitrationNode:
    """仲裁节点测试"""

    @patch("app.config.settings")
    @patch("app.nodes.arbitration.get_model")
    def test_arbitration_produces_final_score(self, mock_model, mock_settings):
        """仲裁应产出 final_score 和 final_judgment"""
        mock_settings.llm_supports_structured_output = True

        mock_result = ArbitrationResult(
            summary="推荐——创新空间明显",
            overall_score=72,
            recommendation="推荐",
            consensus_level="moderate",
        )
        mock_structured = AsyncMock()
        mock_structured.ainvoke.return_value = mock_result
        mock_model_instance = MagicMock()
        mock_model_instance.with_structured_output.return_value = mock_structured
        mock_model.return_value = mock_model_instance

        from app.nodes.arbitration import arbitration_node
        result = asyncio.run(arbitration_node({
            "user_raw_input": "区块链宠物医疗",
            "evaluation_results": [
                {"agent_name": "学术审查员", "score": 85, "confidence": "high",
                 "analysis": "学术空白大", "key_findings": ["空白"], "red_flags": []},
                {"agent_name": "产业分析员", "score": 60, "confidence": "medium",
                 "analysis": "市场未验证", "key_findings": ["早期"], "red_flags": ["风险"]},
            ],
            "debate_history": ["维持原评分"],
        }))

        assert result["final_score"] == 72.0
        assert "推荐" in result["final_judgment"]
        assert result["current_phase"] == "arbitration"

    @patch("app.nodes.arbitration.get_model")
    def test_arbitration_handles_exception(self, mock_model):
        """仲裁异常时应降级"""
        mock_structured = AsyncMock()
        mock_structured.ainvoke.side_effect = Exception("API 超时")
        mock_model_instance = MagicMock()
        mock_model_instance.with_structured_output.return_value = mock_structured
        mock_model.return_value = mock_model_instance

        from app.nodes.arbitration import arbitration_node
        result = asyncio.run(arbitration_node({
            "user_raw_input": "test",
            "evaluation_results": [],
            "debate_history": [],
        }))

        assert result["final_score"] == 50.0
        assert result["current_phase"] == "arbitration_failed"

    @patch("app.config.settings")
    @patch("app.nodes.arbitration.get_model")
    def test_arbitration_without_debate(self, mock_model, mock_settings):
        """无辩论记录时仲裁也应正常工作"""
        mock_settings.llm_supports_structured_output = True

        mock_result = ArbitrationResult(
            summary="谨慎考虑——数据不足",
            overall_score=55,
            recommendation="谨慎考虑",
        )
        mock_structured = AsyncMock()
        mock_structured.ainvoke.return_value = mock_result
        mock_model_instance = MagicMock()
        mock_model_instance.with_structured_output.return_value = mock_structured
        mock_model.return_value = mock_model_instance

        from app.nodes.arbitration import arbitration_node
        result = asyncio.run(arbitration_node({
            "user_raw_input": "test",
            "evaluation_results": [
                {"agent_name": "A", "score": 55, "analysis": "x",
                 "key_findings": [], "red_flags": [], "confidence": "low"},
            ],
            "debate_history": [],
        }))

        assert result["final_score"] == 55.0
        assert result["current_phase"] == "arbitration"


class TestArbitrationSchema:
    """ArbitrationResult Schema 测试"""

    def test_valid_result(self):
        """正常 ArbitrationResult"""
        result = ArbitrationResult(
            summary="强烈推荐——蓝海市场",
            overall_score=88,
            recommendation="强烈推荐",
            consensus_level="strong",
            dissent=["产业分析员认为时机偏早"],
            next_steps=["申请专利", "寻找种子轮"],
        )
        assert result.overall_score == 88
        assert len(result.dissent) == 1

    def test_partial_result(self):
        """降级结果"""
        result = ArbitrationResult(
            summary="数据不足",
            overall_score=50,
            recommendation="谨慎考虑",
            is_partial=True,
        )
        assert result.is_partial is True


class TestGraphTopology:
    """完整图拓扑测试"""

    def test_graph_compiles(self):
        """Phase 5 完整管线应能编译"""
        from app.graph import build_standard_graph
        graph = build_standard_graph()
        assert graph is not None

    def test_graph_has_all_nodes(self):
        """图应包含全部 6 个节点"""
        from app.graph import build_standard_graph
        graph = build_standard_graph()
        # LangGraph compiled graph 的 nodes 属性是 dict
        node_names = set(graph.nodes.keys()) if hasattr(graph, 'nodes') else set()
        expected = {"intent_analyzer", "human_check", "retrieval", "scoring", "debate", "arbitration"}
        assert expected.issubset(node_names), f"缺少节点: {expected - node_names}"
