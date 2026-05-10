"""
Novoscan-Open-Core 标准管线图拓扑

Phase 5 拓扑：
  START → intent_analyzer → human_check(interrupt)
                                ↓ 确认 → retrieval → scoring
                                ↓ 修正 → intent_analyzer（循环）
  scoring → [score_gap > 20?]
              ↓ 是 → debate → arbitration → END
              ↓ 否 → arbitration → END

使用 LangGraph interrupt_before 实现 HITL：
  1. 图执行到 human_check 节点前中断
  2. 前端展示 analyzed_intent，用户选择确认/修正
  3. 调用 resume 恢复执行
"""

from __future__ import annotations

import logging

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.state import GraphState
from app.nodes.intent import intent_analysis_node
from app.nodes.retrieval import retrieval_node
from app.nodes.scoring import scoring_node
from app.nodes.debate import debate_node
from app.nodes.arbitration import arbitration_node
from app.nodes.report import report_assembly_node
from app.nodes.quality import quality_gate_node

logger = logging.getLogger("novoscan.graph")

# 辩论触发阈值
DEBATE_THRESHOLD = 20


def human_check_node(state: dict) -> dict:
    """人工审核透传节点。中断由 interrupt_before 控制。"""
    return {}


def check_confirmation(state: dict) -> str:
    """条件路由：检查用户是否确认意图。"""
    if state.get("is_confirmed"):
        logger.info("✅ 意图已确认，进入下阶段")
        return "proceed"
    else:
        feedback = state.get("user_feedback", "")
        logger.info("🔄 用户要求修正: '%s'", feedback[:50] if feedback else "无反馈")
        return "revise"


def check_debate_needed(state: dict) -> str:
    """条件路由：评分后是否需要辩论。"""
    score_gap = state.get("score_gap", 0)
    if score_gap > DEBATE_THRESHOLD:
        logger.info("⚔️ 评分分差 %.0f > %d，触发辩论", score_gap, DEBATE_THRESHOLD)
        return "debate"
    else:
        logger.info("✅ 评分分差 %.0f ≤ %d，跳过辩论", score_gap, DEBATE_THRESHOLD)
        return "skip"


def build_standard_graph(checkpointer=None):
    """
    构建标准管线图。

    Phase 5 拓扑：intent + HITL + retrieval + scoring + debate(条件) + arbitration。
    """
    if checkpointer is None:
        checkpointer = MemorySaver()

    graph = StateGraph(GraphState)

    # ── 注册节点 ──
    graph.add_node("intent_analyzer", intent_analysis_node)
    graph.add_node("human_check", human_check_node)
    graph.add_node("retrieval", retrieval_node)
    graph.add_node("scoring", scoring_node)
    graph.add_node("debate", debate_node)
    graph.add_node("arbitration", arbitration_node)
    graph.add_node("report_assembly", report_assembly_node)
    graph.add_node("quality_gate", quality_gate_node)

    # ── 注册边 ──
    graph.add_edge(START, "intent_analyzer")
    graph.add_edge("intent_analyzer", "human_check")

    graph.add_conditional_edges(
        "human_check",
        check_confirmation,
        {
            "proceed": "retrieval",
            "revise": "intent_analyzer",
        },
    )

    graph.add_edge("retrieval", "scoring")

    # scoring 后条件路由
    graph.add_conditional_edges(
        "scoring",
        check_debate_needed,
        {
            "debate": "debate",
            "skip": "arbitration",  # 跳过辩论直接仲裁
        },
    )

    graph.add_edge("debate", "arbitration")
    graph.add_edge("arbitration", "quality_gate")
    graph.add_edge("quality_gate", "report_assembly")
    graph.add_edge("report_assembly", END)

    # ── 编译 ──
    compiled = graph.compile(
        checkpointer=checkpointer,
        interrupt_before=["human_check"],
    )

    logger.info("🔧 标准管线编译完成 (Phase 5: 完整管线)")
    return compiled
