"""
Phase 1 HITL 意图循环集成测试

测试场景：
  1. 首次调用 /analyze → 返回 awaiting_confirmation + analyzed_intent
  2. resume(revise) → 重新分析，返回新的 analyzed_intent
  3. resume(confirm) → 图完成
  4. intent 节点作为独立 Tool 调用
  5. API 错误处理
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from langgraph.checkpoint.memory import MemorySaver

import app.main as main_module
from app.main import app
from app.graph import build_standard_graph


# ── Mock LLM 响应 ──

MOCK_INTENT_RESPONSE = """{
    "core_idea": "基于区块链的宠物医疗病历管理系统",
    "keywords": ["区块链", "宠物医疗", "病历管理", "blockchain", "pet medical records"],
    "domain": "区块链/医疗",
    "sub_domains": ["宠物行业", "数据存证"],
    "search_directions": ["区块链医疗数据管理技术", "宠物医疗信息化现状", "去中心化电子病历"],
    "confidence": 0.88
}"""

MOCK_REVISED_RESPONSE = """{
    "core_idea": "利用区块链技术实现宠物医疗病历的去中心化存证与共享",
    "keywords": ["区块链存证", "宠物病历", "去中心化", "数据共享", "pet health records"],
    "domain": "区块链/医疗",
    "sub_domains": ["宠物医疗", "数据安全"],
    "search_directions": ["区块链医疗存证技术方案", "宠物医院信息系统互通", "IPFS医疗数据存储"],
    "confidence": 0.92
}"""


def _make_mock_response(content: str):
    """创建 Mock 的 LLM 响应对象"""
    mock = MagicMock()
    mock.content = content
    return mock


@pytest.fixture(autouse=True)
def setup_graph():
    """每个测试前手动初始化标准管线图（绕过 lifespan）。
    Mock retrieval/scoring/debate/arbitration 节点避免真实 LLM 调用。"""
    mock_retrieval = AsyncMock(return_value={
        "retrieved_context": "mock_retrieval_context",
        "search_history": [],
        "current_phase": "retrieval",
    })
    mock_scoring = AsyncMock(return_value={
        "evaluation_results": [{"agent_name": "mock", "score": 75}],
        "score_gap": 0.0,
        "execution_logs": [],
        "current_phase": "scoring",
    })
    mock_debate = AsyncMock(return_value={
        "debate_history": [],
        "execution_logs": [],
        "current_phase": "debate_skipped",
    })
    mock_arbitration = AsyncMock(return_value={
        "final_score": 75.0,
        "final_judgment": "推荐",
        "execution_logs": [],
        "current_phase": "arbitration",
    })
    with patch("app.graph.retrieval_node", mock_retrieval), \
         patch("app.graph.scoring_node", mock_scoring), \
         patch("app.graph.debate_node", mock_debate), \
         patch("app.graph.arbitration_node", mock_arbitration):
        cp = MemorySaver()
        main_module.checkpointer = cp
        main_module.standard_graph = build_standard_graph(checkpointer=cp)
        yield
        main_module.standard_graph = None
        main_module.checkpointer = None


client = TestClient(app, raise_server_exceptions=False)


class TestAnalyzeEndpoint:
    """/api/v1/analyze 端点测试"""

    @patch("app.nodes.intent.get_model")
    def test_analyze_returns_intent(self, mock_get_model):
        """首次分析应返回 analyzed_intent 和 thread_id"""
        mock_model = AsyncMock()
        mock_model.ainvoke.return_value = _make_mock_response(MOCK_INTENT_RESPONSE)
        mock_get_model.return_value = mock_model

        response = client.post("/api/v1/analyze", json={
            "user_raw_input": "我想做一个用区块链做的宠物社交",
            "detection_type": "auto",
        })

        assert response.status_code == 200
        data = response.json()
        assert "thread_id" in data
        assert data["status"] == "awaiting_confirmation"
        assert data["analyzed_intent"] is not None
        assert data["analyzed_intent"]["core_idea"] is not None

    def test_analyze_empty_input_rejected(self):
        """空输入应被拒绝"""
        response = client.post("/api/v1/analyze", json={})
        assert response.status_code == 422


class TestResumeEndpoint:
    """/api/v1/thread/{thread_id}/resume 端点测试"""

    @patch("app.nodes.intent.get_model")
    def test_confirm_completes_graph(self, mock_get_model):
        """确认后图应走完 retrieval 并完成"""
        mock_model = AsyncMock()
        mock_model.ainvoke.return_value = _make_mock_response(MOCK_INTENT_RESPONSE)
        mock_get_model.return_value = mock_model

        # Step 1: 创建分析
        res1 = client.post("/api/v1/analyze", json={
            "user_raw_input": "区块链宠物医疗",
        })
        assert res1.status_code == 200
        thread_id = res1.json()["thread_id"]

        # Step 2: 确认意图（图会走 retrieval → END）
        res2 = client.post(f"/api/v1/thread/{thread_id}/resume", json={
            "action": "confirm",
        })

        assert res2.status_code == 200
        data = res2.json()
        assert data["status"] == "completed"

    @patch("app.nodes.intent.get_model")
    def test_revise_triggers_reanalysis(self, mock_get_model):
        """修正后应重新分析并返回新的 intent"""
        mock_model = AsyncMock()
        mock_model.ainvoke.side_effect = [
            _make_mock_response(MOCK_INTENT_RESPONSE),
            _make_mock_response(MOCK_REVISED_RESPONSE),
        ]
        mock_get_model.return_value = mock_model

        # Step 1: 创建分析
        res1 = client.post("/api/v1/analyze", json={
            "user_raw_input": "我想做一个用区块链做的宠物社交",
        })
        thread_id = res1.json()["thread_id"]

        # Step 2: 修正
        res2 = client.post(f"/api/v1/thread/{thread_id}/resume", json={
            "action": "revise",
            "feedback": "重点在医疗病历存证，不是社交",
        })

        assert res2.status_code == 200
        data = res2.json()
        assert data["status"] == "awaiting_confirmation"
        assert data["analyzed_intent"] is not None

    @patch("app.nodes.intent.get_model")
    def test_revise_then_confirm(self, mock_get_model):
        """修正→确认完整流程"""
        mock_model = AsyncMock()
        mock_model.ainvoke.side_effect = [
            _make_mock_response(MOCK_INTENT_RESPONSE),
            _make_mock_response(MOCK_REVISED_RESPONSE),
        ]
        mock_get_model.return_value = mock_model

        # Step 1: 创建
        res1 = client.post("/api/v1/analyze", json={
            "user_raw_input": "区块链宠物",
        })
        thread_id = res1.json()["thread_id"]

        # Step 2: 修正
        res2 = client.post(f"/api/v1/thread/{thread_id}/resume", json={
            "action": "revise",
            "feedback": "重点在病历",
        })
        assert res2.json()["status"] == "awaiting_confirmation"

        # Step 3: 确认（走 retrieval）
        res3 = client.post(f"/api/v1/thread/{thread_id}/resume", json={
            "action": "confirm",
        })
        assert res3.json()["status"] == "completed"

    def test_invalid_thread_returns_404(self):
        """无效 thread_id 应返回 404"""
        res = client.post("/api/v1/thread/nonexistent-id/resume", json={
            "action": "confirm",
        })
        assert res.status_code == 404

    @patch("app.nodes.intent.get_model")
    def test_revise_without_feedback_rejected(self, mock_get_model):
        """修正操作未提供 feedback 应返回 400"""
        mock_model = AsyncMock()
        mock_model.ainvoke.return_value = _make_mock_response(MOCK_INTENT_RESPONSE)
        mock_get_model.return_value = mock_model

        res1 = client.post("/api/v1/analyze", json={
            "user_raw_input": "测试",
        })
        thread_id = res1.json()["thread_id"]

        res2 = client.post(f"/api/v1/thread/{thread_id}/resume", json={
            "action": "revise",
            "feedback": "",
        })
        assert res2.status_code == 400


class TestIntentBlockAsTool:
    """Intent 积木作为 Tool 的测试"""

    def test_intent_block_has_as_tool(self):
        """IntentAnalyzerBlock 应有 as_tool 方法"""
        from app.nodes.intent import get_intent_block

        block = get_intent_block()
        tool = block.as_tool()
        assert tool is not None
        assert tool.name == "intent_analyzer"

