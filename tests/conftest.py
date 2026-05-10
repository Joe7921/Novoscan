"""测试公共 fixtures"""

import pytest


@pytest.fixture
def sample_user_input() -> str:
    """示例用户输入"""
    return "我想做一个用区块链做的宠物社交"


@pytest.fixture
def sample_state() -> dict:
    """示例初始状态"""
    return {
        "user_raw_input": "我想做一个用区块链做的宠物社交",
        "detection_type": "auto",
        "analyzed_intent": None,
        "user_feedback": None,
        "is_confirmed": False,
        "messages": [],
        "search_history": [],
        "retrieved_context": None,
        "evaluation_results": [],
        "score_gap": 0.0,
        "debate_history": [],
        "debate_round": 0,
        "final_score": None,
        "final_judgment": None,
        "execution_logs": [],
        "current_phase": "init",
    }
