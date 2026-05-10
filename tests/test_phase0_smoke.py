"""Phase 0 冒烟测试 — 验证项目骨架可正常导入和启动"""

from fastapi.testclient import TestClient


def test_imports():
    """核心模块应能正常导入"""
    from app.config import settings
    from app.state import GraphState
    from app.models import get_model

    assert settings is not None
    assert GraphState is not None
    assert callable(get_model)


def test_health_endpoint():
    """健康检查端点应返回 200"""
    from app.main import app

    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["engine"] == "novoscan-open-core"
    assert "model_ready" in data


def test_state_fields():
    """GraphState 应包含技术方案要求的全部字段"""
    from app.state import GraphState

    required_fields = [
        "user_raw_input",
        "detection_type",
        "analyzed_intent",
        "user_feedback",
        "is_confirmed",
        "messages",
        "search_history",
        "retrieved_context",
        "evaluation_results",
        "score_gap",
        "debate_history",
        "debate_round",
        "final_score",
        "final_judgment",
    ]

    annotations = GraphState.__annotations__
    for field in required_fields:
        assert field in annotations, f"GraphState 缺少方案要求的字段: {field}"


def test_config_defaults():
    """配置默认值应可用"""
    from app.config import settings

    assert settings.engine_port == 8001
    assert settings.llm_temperature == 0.3
    assert settings.llm_max_retries == 2
