"""
Phase 8a: SSE 端点测试
"""

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.fixture
def client():
    """同步 TestClient"""
    from fastapi.testclient import TestClient
    return TestClient(app)


class TestSSEEndpoints:
    """SSE 端点可用性测试"""

    def test_stream_endpoint_exists(self, client):
        """SSE stream 端点已注册"""
        routes = [r.path for r in app.routes]
        assert "/api/v1/analyze/stream" in routes

    def test_resume_stream_endpoint_exists(self, client):
        """HITL resume stream 端点已注册"""
        routes = [r.path for r in app.routes]
        assert "/api/v1/thread/{thread_id}/resume/stream" in routes

    def test_agentic_stream_endpoint_exists(self, client):
        """Agentic stream 端点已注册"""
        routes = [r.path for r in app.routes]
        assert "/api/v1/analyze/agentic/stream" in routes

    def test_sse_format_function(self):
        """SSE 格式化函数正确输出"""
        from app.main import _sse_format
        result = _sse_format("test_event", {"key": "value"})
        assert result.startswith("event: test_event\n")
        assert "data:" in result
        assert result.endswith("\n\n")

    def test_stream_returns_correct_response(self, client):
        """SSE 端点返回正确响应（200 SSE 或 503 未初始化）"""
        resp = client.post(
            "/api/v1/analyze/stream",
            json={"user_raw_input": "test", "detection_type": "auto"},
        )
        # 引擎未初始化时返回 503，已初始化时返回 200 SSE
        assert resp.status_code in (200, 503)
        if resp.status_code == 200:
            assert "text/event-stream" in resp.headers.get("content-type", "")
