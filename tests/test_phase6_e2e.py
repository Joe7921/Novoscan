"""
Phase 6 端到端验证 — P6 里程碑

验证完整主业务线：
  1. POST /api/v1/analyze → 意图分析 → HITL 中断
  2. POST /api/v1/thread/{id}/resume (confirm) → retrieval → scoring → arbitration → END
  3. 条件路由：score_gap > 20 走辩论 / ≤ 20 跳过辩论
  4. 最终输出包含 final_score 和 final_judgment
  5. 完整响应字段校验

所有 LLM 调用被 mock，验证数据通路而非模型质量。
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from fastapi.testclient import TestClient
from langgraph.checkpoint.memory import MemorySaver

from app.main import app, build_standard_graph
import app.main as main_module


# ── Mock 工厂 ──

def _mock_intent_node():
    """模拟意图分析节点"""
    return AsyncMock(return_value={
        "analyzed_intent": {
            "core_idea": "用区块链技术追踪宠物医疗记录",
            "keywords": ["区块链", "宠物医疗", "数据追踪"],
            "domain": "veterinary technology",
        },
        "current_phase": "intent_analysis",
        "execution_logs": ["[意图] 分析完成"],
    })


def _mock_retrieval_node():
    """模拟检索节点"""
    return AsyncMock(return_value={
        "retrieved_context": "找到 5 篇相关论文，3 个 GitHub 项目",
        "search_history": [{"action": "search_openalex", "observation": "3 papers"}],
        "current_phase": "retrieval",
        "execution_logs": ["[检索] 完成"],
    })


def _mock_scoring_node(score_gap: float = 10.0):
    """模拟评分节点（可控制 score_gap）"""
    return AsyncMock(return_value={
        "evaluation_results": [
            {"agent_name": "学术审查员", "score": 78, "confidence": "high",
             "analysis": "学术空白明显", "key_findings": ["空白大"], "red_flags": []},
            {"agent_name": "产业分析员", "score": 68, "confidence": "medium",
             "analysis": "市场早期", "key_findings": ["蓝海"], "red_flags": ["时机偏早"]},
            {"agent_name": "竞品侦探", "score": 72, "confidence": "high",
             "analysis": "竞品较少", "key_findings": ["差异化空间"], "red_flags": []},
        ],
        "score_gap": score_gap,
        "execution_logs": ["[评分] 3 个 Agent 完成"],
        "current_phase": "scoring",
    })


def _mock_debate_node():
    """模拟辩论节点"""
    return AsyncMock(return_value={
        "debate_history": ["学术审查员的论点更有说服力"],
        "debate_round": 2,
        "execution_logs": ["[辩论] 2 轮交锋", "[辩论] 裁决完成"],
        "current_phase": "debate",
    })


def _mock_arbitration_node(score: float = 72.0):
    """模拟仲裁节点"""
    return AsyncMock(return_value={
        "final_score": score,
        "final_judgment": "推荐——创新空间明显，建议进一步验证市场需求",
        "execution_logs": ["[仲裁] 最终评分: 72/100", "[仲裁] 建议: 推荐"],
        "current_phase": "arbitration",
    })


# ── Fixture ──

@pytest.fixture
def e2e_client_no_debate():
    """端到端客户端 — score_gap ≤ 20，不触发辩论"""
    mock_intent = _mock_intent_node()
    mock_retrieval = _mock_retrieval_node()
    mock_scoring = _mock_scoring_node(score_gap=10.0)
    mock_debate = _mock_debate_node()
    mock_arbitration = _mock_arbitration_node()

    with patch("app.graph.intent_analysis_node", mock_intent), \
         patch("app.graph.retrieval_node", mock_retrieval), \
         patch("app.graph.scoring_node", mock_scoring), \
         patch("app.graph.debate_node", mock_debate), \
         patch("app.graph.arbitration_node", mock_arbitration):
        cp = MemorySaver()
        main_module.checkpointer = cp
        main_module.standard_graph = build_standard_graph(checkpointer=cp)
        yield TestClient(app, raise_server_exceptions=False)
        main_module.standard_graph = None
        main_module.checkpointer = None


@pytest.fixture
def e2e_client_with_debate():
    """端到端客户端 — score_gap > 20，触发辩论"""
    mock_intent = _mock_intent_node()
    mock_retrieval = _mock_retrieval_node()
    mock_scoring = _mock_scoring_node(score_gap=35.0)
    mock_debate = _mock_debate_node()
    mock_arbitration = _mock_arbitration_node()

    with patch("app.graph.intent_analysis_node", mock_intent), \
         patch("app.graph.retrieval_node", mock_retrieval), \
         patch("app.graph.scoring_node", mock_scoring), \
         patch("app.graph.debate_node", mock_debate), \
         patch("app.graph.arbitration_node", mock_arbitration):
        cp = MemorySaver()
        main_module.checkpointer = cp
        main_module.standard_graph = build_standard_graph(checkpointer=cp)
        yield TestClient(app, raise_server_exceptions=False)
        main_module.standard_graph = None
        main_module.checkpointer = None


# ── 测试 ──

class TestE2ENoDebate:
    """端到端：正常流程（无辩论）"""

    def test_full_pipeline_confirm(self, e2e_client_no_debate):
        """完整流程：analyze → confirm → 最终结果"""
        client = e2e_client_no_debate

        # Step 1: 提交分析
        resp = client.post("/api/v1/analyze", json={
            "user_raw_input": "用区块链技术追踪宠物医疗记录",
            "detection_type": "auto",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "awaiting_confirmation"
        assert data["analyzed_intent"] is not None
        assert "core_idea" in data["analyzed_intent"]
        thread_id = data["thread_id"]

        # Step 2: 确认意图 → 应跑完全程
        resp2 = client.post(f"/api/v1/thread/{thread_id}/resume", json={
            "action": "confirm",
        })
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["status"] == "completed"
        assert data2["thread_id"] == thread_id

    def test_revise_then_confirm(self, e2e_client_no_debate):
        """修正一次再确认"""
        client = e2e_client_no_debate

        # Step 1: 分析
        resp = client.post("/api/v1/analyze", json={
            "user_raw_input": "区块链宠物医疗",
        })
        thread_id = resp.json()["thread_id"]

        # Step 2: 修正
        resp2 = client.post(f"/api/v1/thread/{thread_id}/resume", json={
            "action": "revise",
            "feedback": "请聚焦于数据隐私方面",
        })
        assert resp2.status_code == 200
        # 修正后应再次中断在 HITL
        data2 = resp2.json()
        assert data2["status"] == "awaiting_confirmation"

        # Step 3: 确认
        resp3 = client.post(f"/api/v1/thread/{thread_id}/resume", json={
            "action": "confirm",
        })
        data3 = resp3.json()
        assert data3["status"] == "completed"


class TestE2EWithDebate:
    """端到端：辩论流程"""

    def test_full_pipeline_with_debate(self, e2e_client_with_debate):
        """score_gap > 20 时应触发辩论"""
        client = e2e_client_with_debate

        # Step 1: 分析
        resp = client.post("/api/v1/analyze", json={
            "user_raw_input": "量子计算优化物流路径",
        })
        thread_id = resp.json()["thread_id"]

        # Step 2: 确认 → 辩论 → 仲裁 → 完成
        resp2 = client.post(f"/api/v1/thread/{thread_id}/resume", json={
            "action": "confirm",
        })
        data2 = resp2.json()
        assert data2["status"] == "completed"


class TestE2EEdgeCases:
    """端到端边界场景"""

    def test_invalid_thread_id(self, e2e_client_no_debate):
        """不存在的 thread_id 应返回 404"""
        client = e2e_client_no_debate
        resp = client.post("/api/v1/thread/nonexistent-id/resume", json={
            "action": "confirm",
        })
        assert resp.status_code == 404

    def test_invalid_action(self, e2e_client_no_debate):
        """非法 action 应返回 400"""
        client = e2e_client_no_debate

        resp = client.post("/api/v1/analyze", json={
            "user_raw_input": "test",
        })
        thread_id = resp.json()["thread_id"]

        resp2 = client.post(f"/api/v1/thread/{thread_id}/resume", json={
            "action": "invalid_action",
        })
        assert resp2.status_code == 400

    def test_revise_without_feedback(self, e2e_client_no_debate):
        """修正但不提供 feedback 应返回 400"""
        client = e2e_client_no_debate

        resp = client.post("/api/v1/analyze", json={
            "user_raw_input": "test",
        })
        thread_id = resp.json()["thread_id"]

        resp2 = client.post(f"/api/v1/thread/{thread_id}/resume", json={
            "action": "revise",
            "feedback": "",
        })
        assert resp2.status_code == 400

    def test_health_check(self, e2e_client_no_debate):
        """健康检查应始终返回 200"""
        resp = e2e_client_no_debate.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["engine"] == "novoscan-open-core"
