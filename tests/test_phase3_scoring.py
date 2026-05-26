"""
Phase 3 评分 Agent 集成测试

测试场景：
  1. 评分编排器从 BlockRegistry 动态发现 scoring 积木
  2. 并行执行 3 个 Agent + 异常降级
  3. score_gap 计算
  4. AgentOutput schema 验证
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

from app.schemas.agent_output import AgentOutput, DimensionScore, EvidenceItem
from app.core.base import BlockMeta


class TestAgentOutputSchema:
    """AgentOutput Schema 测试"""

    def test_valid_output(self):
        """合法的 AgentOutput 应通过验证"""
        output = AgentOutput(
            agent_name="学术审查员",
            score=75,
            confidence="high",
            analysis="测试分析",
            dimension_scores=[
                DimensionScore(name="技术成熟度", score=80, reasoning="论文数量充足"),
                DimensionScore(name="学术空白", score=70, reasoning="存在明显空白"),
            ],
            key_findings=["发现1", "发现2"],
        )
        assert output.score == 75
        assert len(output.dimension_scores) == 2

    def test_score_boundary(self):
        """分数边界值检查"""
        # 正常范围
        output = AgentOutput(agent_name="test", score=0, confidence="low", analysis="test")
        assert output.score == 0

        output = AgentOutput(agent_name="test", score=100, confidence="high", analysis="test")
        assert output.score == 100

        # 超出范围
        with pytest.raises(Exception):
            AgentOutput(agent_name="test", score=101, confidence="high", analysis="test")

    def test_evidence_item(self):
        """EvidenceItem 序列化"""
        evidence = EvidenceItem(
            title="Blockchain for Pet Health",
            source="OpenAlex",
            relevance="high",
            key_point="直接相关",
            metrics={"citations": 42},
        )
        d = evidence.model_dump()
        assert d["title"] == "Blockchain for Pet Health"
        assert d["metrics"]["citations"] == 42

    def test_fallback_output(self):
        """降级输出应有 is_fallback=True"""
        output = AgentOutput(
            agent_name="学术审查员",
            score=50,
            confidence="low",
            analysis="降级结果",
            is_fallback=True,
        )
        assert output.is_fallback is True


class TestScoringOrchestrator:
    """评分编排器测试"""

    @patch("app.nodes.scoring.get_model")
    @patch("app.nodes.scoring.get_block_registry")
    def test_orchestrator_discovers_scoring_blocks(self, mock_registry, mock_model):
        """编排器应从 BlockRegistry 发现所有 scoring 类积木"""
        # 构造 mock registry
        mock_reg = MagicMock()
        mock_reg.list_all.return_value = [
            BlockMeta(id="academic_reviewer", name="学术审查员", category="scoring",
                      config_schema={"temperature": {"default": 0.3}}).model_dump(),
            BlockMeta(id="industry_analyst", name="产业分析员", category="scoring",
                      config_schema={"temperature": {"default": 0.3}}).model_dump(),
            BlockMeta(id="competitor_detective", name="竞品侦探", category="scoring",
                      config_schema={"temperature": {"default": 0.3}}).model_dump(),
        ]
        mock_registry.return_value = mock_reg

        # Mock 模型返回结构化输出
        mock_structured = AsyncMock()
        mock_structured.ainvoke.return_value = AgentOutput(
            agent_name="test",
            score=75,
            confidence="high",
            analysis="test analysis",
        )
        mock_model_instance = MagicMock()
        mock_model_instance.with_structured_output.return_value = mock_structured
        mock_model.return_value = mock_model_instance

        from app.nodes.scoring import scoring_node
        result = asyncio.run(
            scoring_node({
                "user_raw_input": "区块链宠物医疗",
                "retrieved_context": "mock context",
                "analyzed_intent": {"domain": ""},
            })
        )

        assert len(result["evaluation_results"]) == 3
        assert result["current_phase"] == "scoring"
        assert isinstance(result["score_gap"], float)

    @patch("app.nodes.scoring.get_model")
    @patch("app.nodes.scoring.get_block_registry")
    def test_empty_registry_returns_empty(self, mock_registry, mock_model):
        """没有 scoring 积木时应返回空"""
        mock_reg = MagicMock()
        mock_reg.list_all.return_value = []  # 空
        mock_registry.return_value = mock_reg

        from app.nodes.scoring import scoring_node
        result = asyncio.run(
            scoring_node({
                "user_raw_input": "test",
                "retrieved_context": "",
                "analyzed_intent": {},
            })
        )

        assert result["evaluation_results"] == []
        assert result["score_gap"] == 0.0

    @patch("app.config.settings")
    @patch("app.nodes.scoring.get_model")
    @patch("app.nodes.scoring.get_block_registry")
    def test_score_gap_calculation(self, mock_registry, mock_model, mock_settings):
        """score_gap 应为 max - min"""
        mock_settings.llm_supports_structured_output = True

        mock_reg = MagicMock()
        mock_reg.list_all.return_value = [
            BlockMeta(id=f"agent_{i}", name=f"Agent {i}", category="scoring",
                      config_schema={"temperature": {"default": 0.3}}).model_dump()
            for i in range(3)
        ]
        mock_registry.return_value = mock_reg

        # 三个 Agent 返回不同分数 — 每次 get_model() 返回独立 mock 实例
        scores = [80, 50, 65]
        call_count = {"n": 0}

        def make_model(*args, **kwargs):
            idx = call_count["n"]
            call_count["n"] += 1
            s = scores[idx] if idx < len(scores) else 50
            mock_s = AsyncMock()
            mock_s.ainvoke.return_value = AgentOutput(
                agent_name=f"Agent {idx}", score=s, confidence="high", analysis="x"
            )
            m = MagicMock()
            m.with_structured_output.return_value = mock_s
            return m

        mock_model.side_effect = make_model

        from app.nodes.scoring import scoring_node
        result = asyncio.run(
            scoring_node({
                "user_raw_input": "test",
                "retrieved_context": "context",
                "analyzed_intent": {},
            })
        )

        assert result["score_gap"] == 30.0  # 80 - 50
