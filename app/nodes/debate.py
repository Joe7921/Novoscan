"""
辩论引擎 — Phase 4 (完整重构)

真正多轮 StateGraph 子图实现：
  - moderator_announce: 主持人宣布辩题 + 递增轮次
  - pro_speak:          正方独立 LLM 发言
  - con_speak:          反方独立 LLM 发言
  - round_judge:        主持人裁判本轮胜负
  - check_continue:     条件路由（K.O. / 轮次上限 / 继续）
  - moderator_verdict:  最终裁决 + 评分修正建议

K.O. 机制：同一方连续 2 轮获胜 → 提前终止辩论（代码逻辑显式判定）。
每个 Agent 独立 LLM 调用，使用自己的 System Prompt。
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, TypedDict

from langchain_core.messages import HumanMessage
from langchain_core.callbacks import adispatch_custom_event
from langgraph.graph import StateGraph, END

from app.models import get_model
from app.prompts.moderator import (
    ANNOUNCE_PROMPT,
    PRO_SPEAK_PROMPT,
    CON_SPEAK_PROMPT,
    ROUND_JUDGE_PROMPT,
    FINAL_VERDICT_PROMPT,
)

logger = logging.getLogger("novoscan.nodes.debate")

# 默认配置
DEFAULT_MAX_ROUNDS = 3
KO_CONSECUTIVE_WINS = 2


# ══════════════════════════════════════════════════════════════
# 辩论子图状态
# ══════════════════════════════════════════════════════════════

class DebateSubState(TypedDict):
    """辩论子图内部状态"""
    topic: str
    pro_agent_name: str
    con_agent_name: str
    pro_score: int
    con_score: int
    pro_analysis: str
    con_analysis: str
    pro_findings: str
    con_findings: str
    score_gap: float
    round: int
    max_rounds: int
    ko_enabled: bool
    exchanges: list[dict]
    current_pro_argument: str
    current_con_argument: str
    consecutive_pro_wins: int
    consecutive_con_wins: int
    ko_triggered: bool
    ko_winner: str
    verdict: str
    key_insights: list[str]
    score_adjustment: dict
    announcement: str


# ══════════════════════════════════════════════════════════════
# 子图节点
# ══════════════════════════════════════════════════════════════

async def _moderator_announce(state: DebateSubState) -> dict:
    """主持人宣布辩题 + 递增轮次"""
    new_round = state["round"] + 1
    model = get_model()

    prompt = ANNOUNCE_PROMPT.format(
        topic=state["topic"],
        pro_agent=state["pro_agent_name"],
        con_agent=state["con_agent_name"],
        pro_score=state["pro_score"],
        con_score=state["con_score"],
        score_gap=state["score_gap"],
        max_rounds=state["max_rounds"],
    )

    result = await model.ainvoke([HumanMessage(content=prompt)])
    return {"round": new_round, "announcement": result.content}


async def _pro_speak(state: DebateSubState) -> dict:
    """正方独立 LLM 发言"""
    model = get_model()

    prompt = PRO_SPEAK_PROMPT.format(
        agent_name=state["pro_agent_name"],
        score=state["pro_score"],
        topic=state["topic"],
        analysis=state["pro_analysis"],
        key_findings=state["pro_findings"],
        round=state["round"],
        max_rounds=state["max_rounds"],
        previous_arguments=_format_previous_arguments(state["exchanges"]),
    )

    result = await model.ainvoke([HumanMessage(content=prompt)])
    return {"current_pro_argument": result.content}


async def _con_speak(state: DebateSubState) -> dict:
    """反方独立 LLM 发言"""
    model = get_model()

    prompt = CON_SPEAK_PROMPT.format(
        agent_name=state["con_agent_name"],
        score=state["con_score"],
        topic=state["topic"],
        analysis=state["con_analysis"],
        key_findings=state["con_findings"],
        round=state["round"],
        max_rounds=state["max_rounds"],
        previous_arguments=_format_previous_arguments(state["exchanges"]),
    )

    result = await model.ainvoke([HumanMessage(content=prompt)])
    return {"current_con_argument": result.content}


async def _round_judge(state: DebateSubState) -> dict:
    """主持人裁判本轮 + 代码级 K.O. 检测"""
    model = get_model()

    prompt = ROUND_JUDGE_PROMPT.format(
        round=state["round"],
        topic=state["topic"],
        pro_agent=state["pro_agent_name"],
        con_agent=state["con_agent_name"],
        pro_argument=state["current_pro_argument"],
        con_argument=state["current_con_argument"],
    )

    result = await model.ainvoke([HumanMessage(content=prompt)])
    outcome, reasoning = _parse_round_judgment(result.content)

    exchange = {
        "round": state["round"],
        "pro_argument": state["current_pro_argument"],
        "con_argument": state["current_con_argument"],
        "outcome": outcome,
        "outcome_reasoning": reasoning,
    }
    new_exchanges = state["exchanges"] + [exchange]

    # ── 代码级 K.O. 追踪 ──
    c_pro = state["consecutive_pro_wins"]
    c_con = state["consecutive_con_wins"]

    if outcome == "challenger_wins":
        c_pro += 1
        c_con = 0
    elif outcome == "defender_wins":
        c_con += 1
        c_pro = 0
    else:
        c_pro = 0
        c_con = 0

    ko_triggered = False
    ko_winner = ""
    if state["ko_enabled"]:
        if c_pro >= KO_CONSECUTIVE_WINS:
            ko_triggered = True
            ko_winner = state["pro_agent_name"]
            logger.info("🥊 K.O. 触发: %s 连续 %d 轮获胜", ko_winner, c_pro)
        elif c_con >= KO_CONSECUTIVE_WINS:
            ko_triggered = True
            ko_winner = state["con_agent_name"]
            logger.info("🥊 K.O. 触发: %s 连续 %d 轮获胜", ko_winner, c_con)

    # 向 SSE 流推送辩论轮次完成事件
    try:
        await adispatch_custom_event("debate_round_done", {
            "round": state["round"],
            "pro_agent": state["pro_agent_name"],
            "con_agent": state["con_agent_name"],
            "pro_argument_preview": state["current_pro_argument"][:200],
            "con_argument_preview": state["current_con_argument"][:200],
            "outcome": outcome,
            "outcome_reasoning": reasoning[:150],
        })
    except Exception:
        pass

    return {
        "exchanges": new_exchanges,
        "consecutive_pro_wins": c_pro,
        "consecutive_con_wins": c_con,
        "ko_triggered": ko_triggered,
        "ko_winner": ko_winner,
    }


def _check_continue(state: DebateSubState) -> str:
    """条件路由：K.O. 或轮次上限 → 裁决；否则继续"""
    if state["ko_triggered"]:
        return "verdict"
    if state["round"] >= state["max_rounds"]:
        return "verdict"
    return "next_round"


async def _moderator_verdict(state: DebateSubState) -> dict:
    """最终裁决 + 评分修正建议"""
    model = get_model()

    debate_summary = _format_debate_summary(state["exchanges"])
    ko_status = (
        f"K.O. 触发：{state['ko_winner']} 连续 {KO_CONSECUTIVE_WINS} 轮获胜"
        if state["ko_triggered"]
        else "未触发 K.O.，完成全部轮次"
    )

    prompt = FINAL_VERDICT_PROMPT.format(
        topic=state["topic"],
        pro_agent=state["pro_agent_name"],
        con_agent=state["con_agent_name"],
        pro_score=state["pro_score"],
        con_score=state["con_score"],
        score_gap=state["score_gap"],
        debate_summary=debate_summary,
        ko_status=ko_status,
    )

    result = await model.ainvoke([HumanMessage(content=prompt)])
    verdict_data = _parse_verdict(result.content)

    return {
        "verdict": verdict_data.get("verdict", "辩论完成，维持原评分"),
        "key_insights": verdict_data.get("key_insights", []),
        "score_adjustment": {
            "pro_delta": verdict_data.get("pro_delta", 0),
            "con_delta": verdict_data.get("con_delta", 0),
        },
    }


# ══════════════════════════════════════════════════════════════
# 辅助函数
# ══════════════════════════════════════════════════════════════

def _format_previous_arguments(exchanges: list[dict]) -> str:
    """格式化前几轮论点供辩手参考"""
    if not exchanges:
        return "## 前轮记录\n这是第一轮辩论，暂无前轮记录。"

    lines = ["## 前轮记录"]
    for ex in exchanges:
        r = ex.get("round", "?")
        lines.append(f"\n### 第 {r} 轮")
        lines.append(f"正方论点：{ex.get('pro_argument', '—')[:200]}")
        lines.append(f"反方论点：{ex.get('con_argument', '—')[:200]}")
        lines.append(f"裁判结果：{ex.get('outcome', 'draw')}")
    return "\n".join(lines)


def _format_debate_summary(exchanges: list[dict]) -> str:
    """格式化完整辩论记录供最终裁决参考"""
    lines = []
    for ex in exchanges:
        r = ex.get("round", "?")
        lines.append(f"--- 第 {r} 轮 ---")
        lines.append(f"正方：{ex.get('pro_argument', '—')[:300]}")
        lines.append(f"反方：{ex.get('con_argument', '—')[:300]}")
        lines.append(f"裁判：{ex.get('outcome', 'draw')}（{ex.get('outcome_reasoning', '')}）")
    return "\n".join(lines)


def _parse_round_judgment(content: str) -> tuple[str, str]:
    """解析主持人轮次裁判 JSON"""
    try:
        data = _extract_json(content)
        outcome = data.get("outcome", "draw")
        if outcome not in ("challenger_wins", "defender_wins", "draw"):
            outcome = "draw"
        return outcome, data.get("outcome_reasoning", "")
    except Exception:
        logger.warning("裁判结果解析失败，默认 draw: %s", content[:200])
        return "draw", "解析失败，默认平局"


def _parse_verdict(content: str) -> dict:
    """解析最终裁决 JSON"""
    try:
        data = _extract_json(content)
        pro_delta = max(-15, min(15, int(data.get("pro_delta", 0))))
        con_delta = max(-15, min(15, int(data.get("con_delta", 0))))
        return {
            "verdict": data.get("verdict", ""),
            "pro_delta": pro_delta,
            "con_delta": con_delta,
            "key_insights": data.get("key_insights", []),
        }
    except Exception:
        logger.warning("最终裁决解析失败: %s", content[:200])
        return {"verdict": content[:200], "pro_delta": 0, "con_delta": 0, "key_insights": []}


def _extract_json(text: str) -> dict:
    """从可能包含 markdown 代码块的文本中提取 JSON"""
    text = text.strip()
    if text.startswith("{"):
        return json.loads(text)
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        return json.loads(match.group(1).strip())
    match = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"No JSON found in: {text[:100]}")


# ══════════════════════════════════════════════════════════════
# 构建辩论 StateGraph 子图
# ══════════════════════════════════════════════════════════════

def _build_debate_subgraph():
    """
    构建辩论 StateGraph 子图。

    拓扑：
      moderator_announce → pro_speak → con_speak → round_judge
        → [check_continue]
            "next_round" → moderator_announce  (循环)
            "verdict"    → moderator_verdict → END
    """
    graph = StateGraph(DebateSubState)

    graph.add_node("moderator_announce", _moderator_announce)
    graph.add_node("pro_speak", _pro_speak)
    graph.add_node("con_speak", _con_speak)
    graph.add_node("round_judge", _round_judge)
    graph.add_node("moderator_verdict", _moderator_verdict)

    graph.set_entry_point("moderator_announce")

    graph.add_edge("moderator_announce", "pro_speak")
    graph.add_edge("pro_speak", "con_speak")
    graph.add_edge("con_speak", "round_judge")

    graph.add_conditional_edges(
        "round_judge",
        _check_continue,
        {
            "next_round": "moderator_announce",
            "verdict": "moderator_verdict",
        },
    )

    graph.add_edge("moderator_verdict", END)

    return graph.compile()


# ══════════════════════════════════════════════════════════════
# 外部接口 — debate_node（保持与 graph.py 兼容）
# ══════════════════════════════════════════════════════════════

async def debate_node(state: dict) -> dict:
    """
    辩论节点 — 包装 StateGraph 子图，保持与主图接口兼容。

    输入：GraphState 中的 evaluation_results, score_gap, user_raw_input
    输出：debate_history, debate_round, current_phase, execution_logs
    """
    eval_results = state.get("evaluation_results", [])

    if len(eval_results) < 2:
        return {
            "debate_history": [],
            "debate_round": 0,
            "execution_logs": state.get("execution_logs", []) + [
                "[辩论] 评分结果不足两个，跳过辩论"
            ],
            "current_phase": "debate_skipped",
        }

    # 选出分歧最大的两个 Agent（最高分 vs 最低分）
    sorted_results = sorted(eval_results, key=lambda r: r.get("score", 50), reverse=True)
    pro_result = sorted_results[0]
    con_result = sorted_results[-1]

    # 提取辩题
    topic = state.get("user_raw_input", "")
    intent = state.get("analyzed_intent", {})
    if isinstance(intent, dict) and intent.get("core_idea"):
        topic = intent["core_idea"]

    initial_debate_state: DebateSubState = {
        "topic": topic,
        "pro_agent_name": pro_result.get("agent_name", "正方"),
        "con_agent_name": con_result.get("agent_name", "反方"),
        "pro_score": pro_result.get("score", 50),
        "con_score": con_result.get("score", 50),
        "pro_analysis": pro_result.get("analysis", ""),
        "con_analysis": con_result.get("analysis", ""),
        "pro_findings": ", ".join(pro_result.get("key_findings", [])),
        "con_findings": ", ".join(con_result.get("key_findings", [])),
        "score_gap": state.get("score_gap", 0),
        "round": 0,
        "max_rounds": DEFAULT_MAX_ROUNDS,
        "ko_enabled": True,
        "exchanges": [],
        "current_pro_argument": "",
        "current_con_argument": "",
        "consecutive_pro_wins": 0,
        "consecutive_con_wins": 0,
        "ko_triggered": False,
        "ko_winner": "",
        "verdict": "",
        "key_insights": [],
        "score_adjustment": {"pro_delta": 0, "con_delta": 0},
        "announcement": "",
    }

    try:
        subgraph = _build_debate_subgraph()
        result = await subgraph.ainvoke(initial_debate_state)

        # 转换为 debate_history 格式（保留每条发言的结构化信息）
        debate_history = []
        for ex in result.get("exchanges", []):
            debate_history.append({
                "round": ex.get("round"),
                "speaker": result["pro_agent_name"],
                "content": ex.get("pro_argument", ""),
                "role": "pro",
            })
            debate_history.append({
                "round": ex.get("round"),
                "speaker": result["con_agent_name"],
                "content": ex.get("con_argument", ""),
                "role": "con",
            })
            debate_history.append({
                "round": ex.get("round"),
                "speaker": "主持人",
                "content": f"裁判：{ex.get('outcome', 'draw')} — {ex.get('outcome_reasoning', '')}",
                "winner": ex.get("outcome", "draw"),
            })

        total_rounds = result.get("round", 0)
        ko = result.get("ko_triggered", False)
        ko_winner = result.get("ko_winner", "")

        logs = state.get("execution_logs", [])
        logs.append(f"[辩论] 触发: {result['pro_agent_name']} vs {result['con_agent_name']}")
        logs.append(f"[辩论] 完成 {total_rounds} 轮交锋, K.O.={'是 (' + ko_winner + ')' if ko else '否'}")
        logs.append(f"[辩论] 裁决: {result.get('verdict', '无')[:100]}")

        adj = result.get("score_adjustment", {})
        if adj.get("pro_delta") or adj.get("con_delta"):
            logs.append(
                f"[辩论] 评分调整: {result['pro_agent_name']} "
                f"{adj.get('pro_delta', 0):+d}, "
                f"{result['con_agent_name']} {adj.get('con_delta', 0):+d}"
            )

        logger.info(
            "⚔️ 辩论完成: %s vs %s, %d 轮, K.O.=%s, 裁决: %s",
            result["pro_agent_name"], result["con_agent_name"],
            total_rounds, ko, result.get("verdict", "")[:80],
        )

        return {
            "debate_history": debate_history,
            "debate_round": total_rounds,
            "execution_logs": logs,
            "current_phase": "debate",
        }

    except Exception as e:
        logger.error("⚠️ 辩论子图执行失败: %s", e, exc_info=True)
        return {
            "debate_history": [],
            "debate_round": 0,
            "execution_logs": state.get("execution_logs", []) + [
                f"[辩论] 执行失败: {str(e)}"
            ],
            "current_phase": "debate_failed",
        }
