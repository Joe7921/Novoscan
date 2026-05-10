"""
Phase 4 辩论引擎测试（完整重构版）

覆盖：
  1. 条件路由：score_gap > 20 触发辩论 / ≤ 20 跳过
  2. StateGraph 子图多轮辩论执行 + K.O. 提前终止
  3. 每轮每个 Agent 独立 LLM 调用（检查调用次数）
  4. 轮次达到 3 轮强制裁决
  5. 异常降级
  6. 辩论 Schema 完整性
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock

from app.schemas.agent_output import DebateSession, DebateExchange, DebateRecord
from app.graph import check_debate_needed, DEBATE_THRESHOLD
from app.nodes.debate import (
    _check_continue,
    _parse_round_judgment,
    _parse_verdict,
    KO_CONSECUTIVE_WINS,
    DEFAULT_MAX_ROUNDS,
)


# ── 辅助：构建 mock LLM 响应序列 ──

def _mock_response(content: str):
    """创建一个模拟的 LLM 响应对象"""
    resp = MagicMock()
    resp.content = content
    return resp


def _build_ko_responses():
    """
    构建 K.O. 场景的 LLM 响应序列（2 轮 + K.O.）。

    子图每轮调用顺序：announce → pro_speak → con_speak → round_judge
    K.O. 在第 2 轮触发后：moderator_verdict
    共 9 次 LLM 调用。
    """
    return [
        # ── Round 1 ──
        _mock_response("辩论开始！正方与反方围绕创新方案展开交锋。"),
        _mock_response("该方案在学术层面有巨大空白，发表论文不足 10 篇，创新空间极大。"),
        _mock_response("虽然学术空白大，但市场未验证，缺乏商业化路径。"),
        _mock_response('{"outcome": "challenger_wins", "outcome_reasoning": "正方证据更充分"}'),
        # ── Round 2 ──
        _mock_response("进入第二轮辩论。"),
        _mock_response("多项最新研究支持该方向的可行性，Nature 2024 有相关综述。"),
        _mock_response("实际应用场景有限，投资回报不确定。"),
        _mock_response('{"outcome": "challenger_wins", "outcome_reasoning": "正方连续提供有力证据"}'),
        # ── Verdict (K.O.) ──
        _mock_response('{"verdict": "正方连续获胜，创新价值获认可", "pro_delta": -5, "con_delta": 5, "key_insights": ["学术空白显著", "需补充商业验证"]}'),
    ]


def _build_full_3round_responses():
    """
    构建完整 3 轮（无 K.O.）的 LLM 响应序列。

    每轮：announce + pro + con + judge = 4 次
    3 轮 + verdict = 13 次 LLM 调用。
    """
    return [
        # ── Round 1 ──
        _mock_response("辩论开始。"),
        _mock_response("学术空白明显。"),
        _mock_response("市场未验证。"),
        _mock_response('{"outcome": "challenger_wins", "outcome_reasoning": "正方论据有力"}'),
        # ── Round 2 ──
        _mock_response("第二轮。"),
        _mock_response("多项研究支持。"),
        _mock_response("成本过高。"),
        _mock_response('{"outcome": "defender_wins", "outcome_reasoning": "反方指出成本问题"}'),
        # ── Round 3 ──
        _mock_response("最后一轮。"),
        _mock_response("长期价值显著。"),
        _mock_response("短期风险不可忽视。"),
        _mock_response('{"outcome": "draw", "outcome_reasoning": "双方旗鼓相当"}'),
        # ── Verdict ──
        _mock_response('{"verdict": "维持原评分，双方各有道理", "pro_delta": 0, "con_delta": 0, "key_insights": ["需要更多数据"]}'),
    ]


# ══════════════════════════════════════════════════════════════
# 条件路由
# ══════════════════════════════════════════════════════════════

class TestDebateRouting:
    """辩论条件路由测试"""

    def test_trigger_debate_when_gap_exceeds_threshold(self):
        """score_gap > 20 应触发辩论"""
        result = check_debate_needed({"score_gap": 35.0})
        assert result == "debate"

    def test_skip_debate_when_gap_within_threshold(self):
        """score_gap <= 20 应跳过辩论"""
        result = check_debate_needed({"score_gap": 15.0})
        assert result == "skip"

    def test_skip_debate_when_gap_equals_threshold(self):
        """score_gap == 20 应跳过（不含边界）"""
        result = check_debate_needed({"score_gap": 20.0})
        assert result == "skip"

    def test_skip_debate_when_gap_is_zero(self):
        """score_gap 为 0 应跳过"""
        result = check_debate_needed({"score_gap": 0})
        assert result == "skip"


# ══════════════════════════════════════════════════════════════
# StateGraph 子图辩论执行
# ══════════════════════════════════════════════════════════════

class TestDebateNode:
    """辩论节点执行测试（StateGraph 子图）"""

    _EVAL_RESULTS = [
        {"agent_name": "学术审查员", "score": 85, "analysis": "学术空白大", "key_findings": ["发现1"]},
        {"agent_name": "产业分析员", "score": 55, "analysis": "市场未验证", "key_findings": ["发现2"]},
    ]

    @patch("app.nodes.debate.get_model")
    def test_debate_ko_at_round2(self, mock_get_model):
        """连续 2 轮同方获胜 → K.O. 提前终止（测试 4.4 K.O. 机制）"""
        mock_model = AsyncMock()
        mock_model.ainvoke = AsyncMock(side_effect=_build_ko_responses())
        mock_get_model.return_value = mock_model

        from app.nodes.debate import debate_node
        result = asyncio.run(debate_node({
            "user_raw_input": "区块链宠物医疗",
            "evaluation_results": self._EVAL_RESULTS,
            "score_gap": 30.0,
        }))

        assert result["current_phase"] == "debate"
        assert result["debate_round"] == 2
        assert len(result["debate_history"]) > 0
        # 2 轮 × 3 条记录（正方/反方/主持人）= 6 条
        assert len(result["debate_history"]) == 6

    @patch("app.nodes.debate.get_model")
    def test_debate_full_3_rounds(self, mock_get_model):
        """轮次达到 3 轮强制裁决（测试 4.6.5）"""
        mock_model = AsyncMock()
        mock_model.ainvoke = AsyncMock(side_effect=_build_full_3round_responses())
        mock_get_model.return_value = mock_model

        from app.nodes.debate import debate_node
        result = asyncio.run(debate_node({
            "user_raw_input": "区块链宠物医疗",
            "evaluation_results": self._EVAL_RESULTS,
            "score_gap": 30.0,
        }))

        assert result["current_phase"] == "debate"
        assert result["debate_round"] == 3
        # 3 轮 × 3 条记录 = 9 条
        assert len(result["debate_history"]) == 9

    @patch("app.nodes.debate.get_model")
    def test_each_agent_independent_llm_call(self, mock_get_model):
        """每轮每个 Agent 独立 LLM 调用（测试 4.6.3 调用次数）"""
        mock_model = AsyncMock()
        mock_model.ainvoke = AsyncMock(side_effect=_build_ko_responses())
        mock_get_model.return_value = mock_model

        from app.nodes.debate import debate_node
        asyncio.run(debate_node({
            "user_raw_input": "test",
            "evaluation_results": self._EVAL_RESULTS,
            "score_gap": 30.0,
        }))

        # K.O. 场景：2 轮 × 4 (announce+pro+con+judge) + 1 (verdict) = 9 次
        assert mock_model.ainvoke.call_count == 9

    def test_debate_skips_with_insufficient_results(self):
        """评分结果不足两个时应跳过"""
        from app.nodes.debate import debate_node
        result = asyncio.run(debate_node({
            "user_raw_input": "test",
            "evaluation_results": [{"agent_name": "A", "score": 50}],
            "score_gap": 30.0,
        }))

        assert result["current_phase"] == "debate_skipped"
        assert result["debate_round"] == 0

    @patch("app.nodes.debate.get_model")
    def test_debate_handles_exception(self, mock_get_model):
        """LLM 调用异常时应优雅降级"""
        mock_model = AsyncMock()
        mock_model.ainvoke = AsyncMock(side_effect=Exception("API 超时"))
        mock_get_model.return_value = mock_model

        from app.nodes.debate import debate_node
        result = asyncio.run(debate_node({
            "user_raw_input": "test",
            "evaluation_results": [
                {"agent_name": "A", "score": 85, "analysis": "x", "key_findings": []},
                {"agent_name": "B", "score": 50, "analysis": "y", "key_findings": []},
            ],
            "score_gap": 35.0,
        }))

        assert result["current_phase"] == "debate_failed"


# ══════════════════════════════════════════════════════════════
# 子图内部逻辑单元测试
# ══════════════════════════════════════════════════════════════

class TestDebateSubgraphLogic:
    """子图内部逻辑测试"""

    def test_check_continue_ko(self):
        """K.O. 触发 → verdict"""
        state = {"ko_triggered": True, "round": 1, "max_rounds": 3}
        assert _check_continue(state) == "verdict"

    def test_check_continue_max_rounds(self):
        """轮次达上限 → verdict"""
        state = {"ko_triggered": False, "round": 3, "max_rounds": 3}
        assert _check_continue(state) == "verdict"

    def test_check_continue_next_round(self):
        """未达终止条件 → next_round"""
        state = {"ko_triggered": False, "round": 1, "max_rounds": 3}
        assert _check_continue(state) == "next_round"

    def test_parse_round_judgment_valid(self):
        """合法 JSON → 正确解析"""
        outcome, reasoning = _parse_round_judgment(
            '{"outcome": "challenger_wins", "outcome_reasoning": "证据充分"}'
        )
        assert outcome == "challenger_wins"
        assert reasoning == "证据充分"

    def test_parse_round_judgment_markdown(self):
        """markdown 代码块包裹 → 正确解析"""
        outcome, reasoning = _parse_round_judgment(
            '```json\n{"outcome": "defender_wins", "outcome_reasoning": "反驳有力"}\n```'
        )
        assert outcome == "defender_wins"

    def test_parse_round_judgment_invalid(self):
        """无法解析 → 默认 draw"""
        outcome, _ = _parse_round_judgment("这不是 JSON")
        assert outcome == "draw"

    def test_parse_verdict_clamps_delta(self):
        """评分修正幅度限制在 ±15"""
        data = _parse_verdict(
            '{"verdict": "ok", "pro_delta": 20, "con_delta": -30, "key_insights": []}'
        )
        assert data["pro_delta"] == 15
        assert data["con_delta"] == -15


# ══════════════════════════════════════════════════════════════
# Schema 完整性
# ══════════════════════════════════════════════════════════════

class TestDebateSchema:
    """辩论 Schema 测试"""

    def test_debate_session_creation(self):
        """DebateSession 应正确创建"""
        session = DebateSession(
            session_id="d001",
            pro_agent="学术审查员",
            con_agent="竞品侦探",
            topic="创新空间评估",
            score_divergence=30,
            exchanges=[
                DebateExchange(round=1, outcome="challenger_wins"),
                DebateExchange(round=2, outcome="defender_wins"),
            ],
            verdict="维持原评分",
        )
        assert len(session.exchanges) == 2
        assert session.score_divergence == 30

    def test_debate_record(self):
        """DebateRecord 应正确封装"""
        record = DebateRecord(
            triggered=True,
            reason="分差 30 > 20",
            sessions=[],
        )
        assert record.triggered is True
        assert record.reason == "分差 30 > 20"
