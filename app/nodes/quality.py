"""
质量门节点 — Phase 5.2

7 点纯逻辑检查，无 LLM 调用。
从仲裁结果和评分结果中检测数据一致性和完整性问题。

检查项：
  1. 评分范围合法性（0-100）
  2. 置信度字段合规性
  3. 分差与辩论触发一致性
  4. 仲裁评分与 Agent 均分偏差
  5. 关键字段非空检查
  6. 降级 Agent 占比预警
  7. 红旗数量异常检测
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("novoscan.nodes.quality")

# 质量门阈值
_SCORE_DEVIATION_THRESHOLD = 25  # 仲裁评分与均分最大偏差
_FALLBACK_RATIO_THRESHOLD = 0.5  # 降级 Agent 占比预警阈值
_RED_FLAG_WARNING_THRESHOLD = 10  # 红旗数量预警


def _check_score_range(results: list[dict]) -> list[str]:
    """检查 1：评分范围合法性"""
    issues = []
    for r in results:
        score = r.get("score", 0)
        name = r.get("agent_name", "未知")
        if not (0 <= score <= 100):
            issues.append(f"QG-1: {name} 评分 {score} 超出 0-100 范围")
    return issues


def _check_confidence_valid(results: list[dict]) -> list[str]:
    """检查 2：置信度字段合规性"""
    valid_levels = {"high", "medium", "low"}
    issues = []
    for r in results:
        conf = r.get("confidence", "")
        name = r.get("agent_name", "未知")
        if conf not in valid_levels:
            issues.append(f"QG-2: {name} 置信度 '{conf}' 不在 {{high, medium, low}} 中")
    return issues


def _check_debate_consistency(score_gap: float, debate_history: list) -> list[str]:
    """检查 3：分差与辩论触发一致性"""
    issues = []
    debate_threshold = 20.0
    if score_gap > debate_threshold and not debate_history:
        issues.append(
            f"QG-3: 分差 {score_gap:.0f} > {debate_threshold}，但辩论未触发"
        )
    return issues


def _check_arbitration_deviation(
    final_score: float | None, results: list[dict]
) -> list[str]:
    """检查 4：仲裁评分与 Agent 均分偏差"""
    issues = []
    if final_score is None or not results:
        return issues
    scores = [r.get("score", 0) for r in results]
    avg = sum(scores) / len(scores)
    dev = abs(final_score - avg)
    if dev > _SCORE_DEVIATION_THRESHOLD:
        issues.append(
            f"QG-4: 仲裁评分 {final_score:.0f} 与均分 {avg:.1f} "
            f"偏差 {dev:.1f} > {_SCORE_DEVIATION_THRESHOLD}"
        )
    return issues


def _check_required_fields(state: dict) -> list[str]:
    """检查 5：关键字段非空检查"""
    issues = []
    required = [
        ("user_raw_input", "用户输入"),
        ("analyzed_intent", "意图分析"),
        ("evaluation_results", "评分结果"),
        ("final_score", "仲裁评分"),
        ("final_judgment", "仲裁判决"),
    ]
    for field, label in required:
        val = state.get(field)
        if val is None or val == "" or val == []:
            issues.append(f"QG-5: 关键字段 '{label}' ({field}) 为空")
    return issues


def _check_fallback_ratio(results: list[dict]) -> list[str]:
    """检查 6：降级 Agent 占比预警"""
    issues = []
    if not results:
        return issues
    fallback_count = sum(1 for r in results if r.get("is_fallback", False))
    ratio = fallback_count / len(results)
    if ratio >= _FALLBACK_RATIO_THRESHOLD:
        issues.append(
            f"QG-6: 降级 Agent 占比 {ratio:.0%} "
            f"({fallback_count}/{len(results)}) ≥ {_FALLBACK_RATIO_THRESHOLD:.0%}，"
            f"评分可靠性降低"
        )
    return issues


def _check_red_flag_volume(results: list[dict]) -> list[str]:
    """检查 7：红旗数量异常检测"""
    issues = []
    total_flags = sum(len(r.get("red_flags", [])) for r in results)
    if total_flags > _RED_FLAG_WARNING_THRESHOLD:
        issues.append(
            f"QG-7: 红旗总数 {total_flags} > {_RED_FLAG_WARNING_THRESHOLD}，"
            f"需要人工复核风险项"
        )
    return issues


async def quality_gate_node(state: dict) -> dict:
    """
    质量门节点 — 7 点纯逻辑检查。

    输出：
      - quality_issues: 检测到的问题列表
      - quality_passed: 是否通过质量门（无致命问题则通过）
    """
    results = state.get("evaluation_results", [])
    final_score = state.get("final_score")
    score_gap = state.get("score_gap", 0.0)
    debate_history = state.get("debate_history", [])

    all_issues: list[str] = []

    # 逐项检查
    all_issues.extend(_check_score_range(results))
    all_issues.extend(_check_confidence_valid(results))
    all_issues.extend(_check_debate_consistency(score_gap, debate_history))
    all_issues.extend(_check_arbitration_deviation(final_score, results))
    all_issues.extend(_check_required_fields(state))
    all_issues.extend(_check_fallback_ratio(results))
    all_issues.extend(_check_red_flag_volume(results))

    passed = len(all_issues) == 0

    if passed:
        logger.info("✅ 质量门通过: 7 项检查全部合规")
    else:
        logger.warning(
            "⚠️ 质量门发现 %d 个问题:\n  %s",
            len(all_issues),
            "\n  ".join(all_issues),
        )

    logs = [f"[质量门] {'通过' if passed else f'发现 {len(all_issues)} 个问题'}"]
    logs.extend(f"[质量门] {issue}" for issue in all_issues)

    return {
        "execution_logs": logs,
        "current_phase": "quality_gate",
    }
