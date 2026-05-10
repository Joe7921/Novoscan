"""
Report Compiler — Agentic 智能体工作流报告编译器 (Phase 8)

从 Agentic 智能体的完整对话历史中提取结构化报告数据。
使用 LLM with_structured_output() 强制输出 FinalReport Schema。

参考: Report Compiler Pattern (LangGraph 社区)
https://dev.to/irubtsov/three-langgraph-agent-patterns-that-replaced-hundreds-of-lines-of-glue-code-3a21

策略:
  1. 主路径: with_structured_output(FinalReport) 从消息历史提取
  2. 降级路径: 正则提取分数 + 原始文本填充摘要
"""

from __future__ import annotations

import hashlib
import logging
import re
from typing import Optional

from langchain_core.messages import (
    BaseMessage,
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

from app.compat import extract_json_from_text
from app.models import get_model, get_fallback_model
from app.schemas.agent_output import AgentOutput, ArbitrationResult
from app.schemas.final_report import (
    FinalReport,
    ReportBody,
    ReportMeta,
    ArbitrationSummary,
    AgentScoreDetail,
    RadarScore,
    RiskFlag,
    KeyFinding,
    ReportEvidenceItem,
)

logger = logging.getLogger("novoscan.report_compiler")

# ══════════════════════════════════════════════════════════════
# 编译器系统提示词
# ══════════════════════════════════════════════════════════════

COMPILER_SYSTEM_PROMPT = """你是 Novoscan 报告编译器。你的唯一任务是从以下对话历史中提取结构化的创新分析报告数据。

## 提取规则

1. **executive_summary**: 从仲裁结果或 Agent 最终总结中提炼 200-500 字高管摘要
2. **agent_scores**: 从每个评分 Agent（学术审查员/产业分析员/竞品侦探等）的工具调用结果中提取：
   - name: Agent 名称
   - score: 0-100 整数评分
   - confidence: "high" / "medium" / "low"
   - analysis: 分析摘要（100-300 字）
3. **arbitration.summary**: 从仲裁工具输出中提取结论
4. **arbitration.radar_scores**: 为每个评分 Agent 生成雷达图维度（key=agent_id, label=Agent名, score=评分）
5. **risk_flags**: 从分析中提取风险项（risk=描述, severity=high/medium/low, source_agent=来源Agent, suggestion=建议）
6. **key_findings**: 提取关键发现（title=标题, description=详情, source=来源Agent）
7. **meta.overall_score**: 最终综合评分（0-100 浮点数）
8. **meta.novelty_level**: 创新等级 — score>=75 → "High"，>=50 → "Medium"，<50 → "Low"
9. **meta.avg_agent_score**: 所有 Agent 评分的平均值
10. **meta.agent_count**: 参与评分的 Agent 数量
11. **meta.score_gap**: 最高分与最低分的差值

## 重要约束

- **只提取对话中明确存在的信息，不要编造**
- 如果某个字段找不到数据，使用默认值（空字符串、空列表、0）
- score 必须是 0-100 的整数
- confidence/severity 只能是 "high"、"medium"、"low" 之一
- evidence_items 可以留空（Agentic 智能体工作流通常不产生结构化证据）
- template 固定填 "Agentic 智能体报告"
- version 固定填 "1.0"
"""


# ══════════════════════════════════════════════════════════════
# 公开接口
# ══════════════════════════════════════════════════════════════

async def compile_report_from_messages(
    messages: list[BaseMessage],
) -> Optional[FinalReport]:
    """
    从 Agentic 智能体的完整对话历史中编译结构化报告。

    Args:
        messages: Agentic 智能体执行过程中的完整消息列表

    Returns:
        FinalReport 实例，失败返回 None
    """
    if not messages:
        logger.warning("⚠️ [ReportCompiler] 无消息可编译")
        return None

    report = _try_deterministic_compile(messages)
    if report:
        return report

    # 压缩消息历史：保留关键内容，避免超出 token 限制
    compressed = _compress_messages(messages)

    logger.info(
        "📋 [ReportCompiler] 开始编译: %d 条原始消息 → %d 条压缩消息",
        len(messages),
        len(compressed),
    )

    # ── 尝试主模型 ──
    report = await _try_structured_extraction(compressed, primary=True)
    if report:
        return report

    # ── 尝试备用模型 ──
    report = await _try_structured_extraction(compressed, primary=False)
    if report:
        return report

    # ── 最终降级：正则提取 ──
    logger.warning("⚠️ [ReportCompiler] 结构化提取均失败，降级为正则提取")
    return _fallback_extract(messages)


# ══════════════════════════════════════════════════════════════
# 内部实现
# ══════════════════════════════════════════════════════════════

_RADAR_LABEL_MAP = {
    "学术审查员": "学术创新",
    "产业分析员": "市场验证",
    "竞品侦探": "竞争态势",
}

def _try_deterministic_compile(messages: list[BaseMessage]) -> Optional[FinalReport]:
    """优先从 ToolMessage 中的结构化 JSON 直接组装 FinalReport。"""
    agent_outputs: dict[str, AgentOutput] = {}
    arbitration: Optional[ArbitrationResult] = None
    final_text = ""

    for msg in messages:
        content = str(msg.content)
        if isinstance(msg, AIMessage) and content.strip():
            final_text = content

        json_str = extract_json_from_text(content)
        if not json_str:
            continue

        try:
            agent = AgentOutput.model_validate_json(json_str)
            if agent.agent_name:
                agent_outputs[agent.agent_name] = agent
                continue
        except Exception:
            pass

        try:
            arb = ArbitrationResult.model_validate_json(json_str)
            if arb.summary or arb.overall_score is not None:
                arbitration = arb
        except Exception:
            pass

    if not agent_outputs and arbitration is None:
        logger.info("ℹ️ [ReportCompiler] 未发现可确定性编译的结构化工具结果")
        return None

    agents = list(agent_outputs.values())
    scores = [agent.score for agent in agents]
    overall_score = float(arbitration.overall_score) if arbitration is not None else None
    if overall_score is None and scores:
        overall_score = round(sum(scores) / len(scores), 1)

    quality_issues = [f"{agent.agent_name} 使用降级结果" for agent in agents if agent.is_fallback]
    if not agents:
        quality_issues.append("未提取到结构化评分 Agent 输出")

    summary = ""
    if arbitration and arbitration.summary:
        summary = arbitration.summary
    elif final_text.strip():
        summary = final_text[:2000]
    elif agents:
        summary = "\n".join(
            f"{agent.agent_name}: {agent.analysis}" for agent in agents if agent.analysis
        )[:2000]

    evidence_items = _build_evidence_items(agents)
    report = FinalReport(
        template="Agentic 智能体报告",
        version="1.0",
        report=ReportBody(
            executive_summary=summary,
            arbitration=ArbitrationSummary(
                summary=summary,
                radar_scores=_build_radar_scores(agents),
            ),
            agent_scores=_build_agent_scores(agents),
            risk_flags=_build_risk_flags(agents),
            key_findings=_build_key_findings(agents),
            evidence_items=evidence_items,
            meta=ReportMeta(
                overall_score=overall_score,
                novelty_level=_score_to_novelty(overall_score),
                avg_agent_score=round(sum(scores) / len(scores), 1) if scores else 0.0,
                agent_count=len(agents),
                score_gap=float(max(scores) - min(scores)) if len(scores) > 1 else 0.0,
                quality_passed=len(quality_issues) == 0,
                quality_issues=quality_issues,
            ),
        ),
    )

    logger.info(
        "✅ [ReportCompiler] 确定性编译成功: score=%s, agents=%d, evidence=%d",
        report.report.meta.overall_score,
        len(report.report.agent_scores),
        len(report.report.evidence_items),
    )
    return report


def _build_radar_scores(agent_outputs: list[AgentOutput]) -> list[RadarScore]:
    return [
        RadarScore(
            key=agent.agent_name,
            label=_RADAR_LABEL_MAP.get(agent.agent_name, agent.agent_name),
            score=agent.score,
        )
        for agent in agent_outputs
    ]


def _build_agent_scores(agent_outputs: list[AgentOutput]) -> list[AgentScoreDetail]:
    return [
        AgentScoreDetail(
            name=agent.agent_name,
            score=agent.score,
            confidence=agent.confidence,
            analysis=agent.analysis,
            dimension_scores=[dim.model_dump() for dim in agent.dimension_scores],
            is_fallback=agent.is_fallback,
        )
        for agent in agent_outputs
    ]


def _build_risk_flags(agent_outputs: list[AgentOutput]) -> list[RiskFlag]:
    risk_flags: list[RiskFlag] = []
    for agent in agent_outputs:
        for flag in agent.red_flags:
            severity = "medium"
            if any(keyword in flag for keyword in ["致命", "严重", "根本性", "不可行"]):
                severity = "high"
            elif any(keyword in flag for keyword in ["轻微", "建议", "可选"]):
                severity = "low"
            risk_flags.append(
                RiskFlag(
                    risk=flag,
                    severity=severity,
                    source_agent=agent.agent_name,
                )
            )
    return risk_flags


def _build_key_findings(agent_outputs: list[AgentOutput]) -> list[KeyFinding]:
    findings: list[KeyFinding] = []
    for agent in agent_outputs:
        for finding in agent.key_findings[:2]:
            findings.append(
                KeyFinding(
                    title=finding,
                    description="",
                    source=agent.agent_name,
                )
            )
    return findings[:8]


def _build_evidence_items(agent_outputs: list[AgentOutput]) -> list[ReportEvidenceItem]:
    items: list[ReportEvidenceItem] = []
    seen_titles: set[str] = set()

    for agent in agent_outputs:
        for evidence in agent.evidence:
            title = evidence.title.strip()
            if not title or title in seen_titles:
                continue
            seen_titles.add(title)
            evidence_id = hashlib.md5(f"{agent.agent_name}:{title}".encode("utf-8")).hexdigest()[:8]
            items.append(
                ReportEvidenceItem(
                    id=evidence_id,
                    title=title,
                    source=evidence.source,
                    source_type=evidence.source_type,
                    url=evidence.url,
                    year=evidence.year,
                    relevance_score=evidence.relevance_score,
                    relevance_reasoning=evidence.relevance_reasoning or evidence.key_point,
                    key_excerpt=evidence.key_excerpt,
                    dimension=evidence.dimension,
                    stance=evidence.stance,
                    agent_name=agent.agent_name,
                    citation_info=evidence.citation_info,
                    related_evidence_ids=evidence.related_evidence_ids,
                    metrics=evidence.metrics,
                )
            )

    items.sort(key=lambda item: item.relevance_score, reverse=True)
    return items


def _score_to_novelty(score: Optional[float]) -> str:
    if score is None:
        return "Low"
    if score >= 75:
        return "High"
    if score >= 50:
        return "Medium"
    return "Low"


async def _try_structured_extraction(
    compressed: list[BaseMessage],
    primary: bool = True,
) -> Optional[FinalReport]:
    """使用 with_structured_output 尝试提取 FinalReport。"""
    label = "主模型" if primary else "备用模型"
    try:
        if primary:
            model = get_model(temperature=0.1)
        else:
            model = get_fallback_model()
            if model is None:
                return None

        structured_model = model.with_structured_output(FinalReport)

        compile_messages = [
            SystemMessage(content=COMPILER_SYSTEM_PROMPT),
            *compressed,
            HumanMessage(content="请从以上对话历史中提取结构化报告数据。严格按 FinalReport Schema 输出。"),
        ]

        result = await structured_model.ainvoke(compile_messages)

        # with_structured_output 可能返回 FinalReport 实例或 dict
        if isinstance(result, FinalReport):
            logger.info(
                "✅ [ReportCompiler] %s编译成功: score=%s, agents=%d",
                label,
                result.report.meta.overall_score,
                len(result.report.agent_scores),
            )
            return result

        if isinstance(result, dict):
            report = FinalReport.model_validate(result)
            logger.info("✅ [ReportCompiler] %s编译成功（dict→model）", label)
            return report

    except Exception as e:
        logger.warning("⚠️ [ReportCompiler] %s编译失败: %s", label, e)

    return None


def _compress_messages(
    messages: list[BaseMessage],
    max_total_chars: int = 30000,
    max_single_chars: int = 3000,
) -> list[BaseMessage]:
    """
    压缩消息历史，保留工具调用结果和关键内容。

    策略：
      1. 保留首条 HumanMessage（用户原始输入）
      2. 保留所有 ToolMessage（核心数据来源），单条截断
      3. 保留含 tool_calls 的 AIMessage（工具调用指令）
      4. 保留最后一条 AIMessage（最终总结）
      5. 总字符数超限时，从中间开始丢弃
    """
    if not messages:
        return []

    result: list[BaseMessage] = []
    first_human_added = False
    last_ai: Optional[AIMessage] = None

    for msg in messages:
        if isinstance(msg, HumanMessage) and not first_human_added:
            result.append(_truncate_msg(msg, max_single_chars))
            first_human_added = True
        elif isinstance(msg, ToolMessage):
            result.append(_truncate_msg(msg, max_single_chars))
        elif isinstance(msg, AIMessage):
            last_ai = msg
            if hasattr(msg, "tool_calls") and msg.tool_calls:
                result.append(_truncate_msg(msg, max_single_chars))

    # 确保最后一条 AI 消息被保留
    if last_ai and last_ai not in result:
        result.append(_truncate_msg(last_ai, max_single_chars))

    # 总字符数限制：从中间开始移除
    total = sum(len(str(m.content)) for m in result)
    while total > max_total_chars and len(result) > 3:
        mid = len(result) // 2
        removed = result.pop(mid)
        total -= len(str(removed.content))

    return result


def _truncate_msg(msg: BaseMessage, max_chars: int) -> BaseMessage:
    """截断单条消息内容，保留开头和结尾。"""
    content = str(msg.content)
    if len(content) <= max_chars:
        return msg

    # 保留开头 70% + 结尾 30%
    head = int(max_chars * 0.7)
    tail = max_chars - head - 20  # 20 字符给省略标记
    truncated = content[:head] + "\n...[已截断]...\n" + content[-tail:]

    # 创建同类型的新消息
    if isinstance(msg, ToolMessage):
        return ToolMessage(
            content=truncated,
            tool_call_id=getattr(msg, "tool_call_id", ""),
        )
    elif isinstance(msg, AIMessage):
        new_msg = AIMessage(content=truncated)
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            new_msg.tool_calls = msg.tool_calls
        return new_msg
    elif isinstance(msg, HumanMessage):
        return HumanMessage(content=truncated)
    else:
        return msg


def _fallback_extract(messages: list[BaseMessage]) -> Optional[FinalReport]:
    """
    降级提取：从最终文本中尝试提取基本信息。
    在 LLM 结构化输出失败时作为兜底。
    """
    if not messages:
        return None

    final_text = str(messages[-1].content) if messages else ""
    if not final_text.strip():
        return None

    # 尝试提取分数
    score_patterns = [
        r'(?:最终评分|综合评分|总评分|overall\s*score)[：:\s]*(\d{1,3})',
        r'(\d{1,3})\s*[/／]\s*100',
        r'评分[：:\s]*(\d{1,3})',
    ]
    score: Optional[float] = None
    for pattern in score_patterns:
        match = re.search(pattern, final_text, re.IGNORECASE)
        if match:
            val = int(match.group(1))
            if 0 <= val <= 100:
                score = float(val)
                break

    novelty = "High" if (score or 0) >= 75 else ("Medium" if (score or 0) >= 50 else "Low")

    logger.info(
        "📋 [ReportCompiler] 降级提取: score=%s, text_len=%d",
        score,
        len(final_text),
    )

    return FinalReport(
        template="Agentic 智能体报告（降级提取）",
        version="1.0",
        report=ReportBody(
            executive_summary=final_text[:2000],
            arbitration=ArbitrationSummary(summary=final_text[:1000]),
            meta=ReportMeta(
                overall_score=score,
                novelty_level=novelty,
            ),
        ),
    )
