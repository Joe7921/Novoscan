"""
报告组装节点 — Phase 5.5（重构版）

职责：
  1. 读取 YAML 报告模板定义的 sections 列表
  2. 根据每个 section 的 `type` 动态组装数据
  3. type=llm_generated 的 section 调用模型生成摘要
  4. 其他类型按 source 字段提取数据
  5. 写入 state.report_json（通过 FinalReport Schema camelCase 输出）

设计原则：
  - YAML 驱动：sections 定义决定报告内容和结构
  - 可扩展：新增 section type 只需新增 handler
  - LLM 只在 llm_generated 类型时调用
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml

import hashlib

from app.schemas.final_report import (
    FinalReport, ReportBody, ArbitrationSummary, RadarScore,
    AgentScoreDetail, RiskFlag, KeyFinding, ReportMeta,
    ReportEvidenceItem,
)

logger = logging.getLogger("novoscan.nodes.report")

# 默认报告模板路径
_TEMPLATE_DIR = Path(__file__).parent.parent / "reports" / "_builtin"
_DEFAULT_TEMPLATE = "innovation_radar.yaml"


def _load_template(template_name: str = _DEFAULT_TEMPLATE) -> dict:
    """加载 YAML 报告模板"""
    path = _TEMPLATE_DIR / template_name
    if not path.exists():
        logger.warning("⚠️ 报告模板 %s 不存在，使用空模板", path)
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


# ══════════════════════════════════════════════════════════════
# Section Handlers — 每种 type 对应一个处理函数
# ══════════════════════════════════════════════════════════════

def _handle_llm_generated(
    section: dict, state: dict, evaluation_results: list[dict]
) -> str:
    """
    LLM 生成型 section — 调用模型生成摘要。
    如果模型调用失败，降级使用 final_judgment。
    """
    import asyncio
    from langchain_core.messages import SystemMessage, HumanMessage
    from app.models import get_model

    prompt_template = section.get("prompt", "请根据以下分析结果生成摘要。")
    final_judgment = state.get("final_judgment", "")

    # 构建上下文
    agent_summaries = []
    for r in evaluation_results:
        agent_summaries.append(
            f"- {r.get('agent_name', '?')}: {r.get('score', 0)}分 | {r.get('analysis', '')[:200]}"
        )
    context = "\n".join(agent_summaries)

    try:
        model = get_model()
        messages = [
            SystemMessage(content="你是一位专业的分析报告撰写者。请根据提示生成简洁精炼的摘要。"),
            HumanMessage(content=f"{prompt_template}\n\n# 专家分析结果\n{context}"),
        ]

        # 在已有事件循环中同步调用
        try:
            loop = asyncio.get_running_loop()
            # 如果已在事件循环中，使用 final_judgment 降级
            logger.info("📝 llm_generated section: 使用 final_judgment 降级（已在事件循环中）")
            return final_judgment if final_judgment else "分析报告生成中..."
        except RuntimeError:
            # 没有运行的事件循环，可以直接 run
            result = asyncio.run(model.ainvoke(messages))
            return result.content if hasattr(result, "content") else str(result)
    except Exception as e:
        logger.warning("⚠️ LLM 生成摘要失败: %s，降级使用 final_judgment", e)
        return final_judgment if final_judgment else "报告生成失败"


def _handle_radar(
    section: dict, evaluation_results: list[dict]
) -> list[RadarScore]:
    """雷达图 section — 从 dimensions 定义提取数据"""
    dimensions = section.get("dimensions", [])
    result_map = {r.get("agent_name", ""): r for r in evaluation_results}

    # 构建 Agent 名称到角色 key 的映射
    agent_key_map = {
        "学术审查员": "academic_scorer",
        "产业分析员": "industry_analyst",
        "竞品侦探": "competitor_detective",
    }

    radar_scores = []
    for dim in dimensions:
        key = dim.get("key", "")
        label = dim.get("label", key)
        source = dim.get("source", "")  # e.g., "academic_scorer.score"
        agent_id = source.split(".")[0] if "." in source else ""

        # 查找对应的评分
        score = 0
        for agent_name, agent_key in agent_key_map.items():
            if agent_key == agent_id and agent_name in result_map:
                score = result_map[agent_name].get("score", 0)
                break

        # 如果没有通过 agent_key 找到，尝试直接匹配
        if score == 0:
            for r in evaluation_results:
                name = r.get("agent_name", "")
                if key in name.lower() or label in name:
                    score = r.get("score", 0)
                    break

        radar_scores.append(RadarScore(key=key, label=label, score=score))

    # 如果 YAML 没有定义 dimensions，用所有 Agent 生成
    if not radar_scores:
        label_map = {
            "学术审查员": "学术创新", "产业分析员": "市场验证", "竞品侦探": "竞争态势",
        }
        for r in evaluation_results:
            name = r.get("agent_name", "未知")
            radar_scores.append(RadarScore(
                key=name, label=label_map.get(name, name), score=r.get("score", 0)
            ))

    return radar_scores


def _handle_bar_chart(
    section: dict, evaluation_results: list[dict]
) -> list[AgentScoreDetail]:
    """柱状图 section — Agent 评分明细"""
    return [
        AgentScoreDetail(
            name=r.get("agent_name", ""),
            score=r.get("score", 0),
            confidence=r.get("confidence", "low"),
            analysis=r.get("analysis", ""),
            dimension_scores=r.get("dimension_scores", []),
            is_fallback=r.get("is_fallback", False),
        )
        for r in evaluation_results
    ]


def _handle_table_risks(
    section: dict, evaluation_results: list[dict]
) -> list[RiskFlag]:
    """表格 section（风险表）— 汇总 red_flags"""
    risks = []
    style = section.get("style", {})
    for r in evaluation_results:
        agent_name = r.get("agent_name", "未知")
        for flag in r.get("red_flags", []):
            text = flag if isinstance(flag, str) else str(flag)
            # 根据关键词判定严重度
            severity = "medium"
            if any(kw in text for kw in ["致命", "严重", "根本性", "不可行"]):
                severity = "high"
            elif any(kw in text for kw in ["轻微", "建议", "可选"]):
                severity = "low"
            risks.append(RiskFlag(
                risk=text, severity=severity, source_agent=agent_name,
            ))
    return risks


def _handle_markdown_card(
    section: dict, state: dict
) -> str:
    """Markdown 卡片 section — 从 source 指定的字段提取"""
    source = section.get("source", "")
    if "arbitration" in source:
        return state.get("final_judgment", "")
    elif "summary" in source:
        return state.get("final_judgment", "")
    return ""


def _extract_key_findings(evaluation_results: list[dict]) -> list[KeyFinding]:
    """从各 Agent 的 key_findings 中提取关键洞察"""
    findings = []
    for r in evaluation_results:
        agent_name = r.get("agent_name", "未知")
        for finding in r.get("key_findings", [])[:2]:
            findings.append(KeyFinding(
                title=finding if isinstance(finding, str) else str(finding),
                description="",
                source=agent_name,
            ))
    return findings[:8]


def _extract_evidence(evaluation_results: list[dict]) -> list[ReportEvidenceItem]:
    """从各 Agent 的 evidence 列表中提取、去重、分配 ID"""
    items: list[ReportEvidenceItem] = []
    seen_titles: set[str] = set()

    for r in evaluation_results:
        agent_name = r.get("agent_name", "未知")
        for ev in r.get("evidence", []):
            if not isinstance(ev, dict):
                continue
            title = ev.get("title", "").strip()
            if not title or title in seen_titles:
                continue
            seen_titles.add(title)

            # 生成稳定 ID
            eid = hashlib.md5(f"{agent_name}:{title}".encode()).hexdigest()[:8]

            # relevance → relevance_score 映射
            relevance_score = ev.get("relevance_score", None)
            if relevance_score is None:
                rel_map = {"high": 0.9, "medium": 0.6, "low": 0.3}
                relevance_score = rel_map.get(ev.get("relevance", "medium"), 0.5)

            items.append(ReportEvidenceItem(
                id=eid,
                title=title,
                source=ev.get("source", ""),
                source_type=ev.get("source_type", "其他"),
                url=ev.get("url", ""),
                year=ev.get("year"),
                relevance_score=relevance_score,
                relevance_reasoning=ev.get("relevance_reasoning", ev.get("key_point", "")),
                key_excerpt=ev.get("key_excerpt", ""),
                dimension=ev.get("dimension", "综合"),
                stance=ev.get("stance", "中性"),
                agent_name=agent_name,
                citation_info=ev.get("citation_info"),
                related_evidence_ids=ev.get("related_evidence_ids", []),
                metrics=ev.get("metrics", {}),
            ))

    # 按 relevance_score 降序
    items.sort(key=lambda x: x.relevance_score, reverse=True)
    return items


# ══════════════════════════════════════════════════════════════
# 主组装器
# ══════════════════════════════════════════════════════════════

async def report_assembly_node(state: dict) -> dict:
    """
    报告组装器 — 遍历 YAML 模板 sections 动态组装报告。

    使用 FinalReport Schema，输出 by_alias=True 的 camelCase JSON。
    """
    evaluation_results = state.get("evaluation_results", [])
    final_score = state.get("final_score")
    final_judgment = state.get("final_judgment", "")

    # 加载模板
    template = _load_template()
    template_name = template.get("name", "创新雷达报告")
    sections = template.get("sections", [])

    logger.info("📋 报告组装开始: template=%s, sections=%d", template_name, len(sections))

    # 计算元数据
    scores = [r.get("score", 0) for r in evaluation_results]
    avg_score = sum(scores) / len(scores) if scores else 0
    score_gap = state.get("score_gap", 0)

    if final_score and final_score >= 75:
        novelty_level = "High"
    elif final_score and final_score >= 50:
        novelty_level = "Medium"
    else:
        novelty_level = "Low"

    # ── 遍历 YAML sections 动态组装 ──
    executive_summary = final_judgment
    radar_scores: list[RadarScore] = []
    agent_scores: list[AgentScoreDetail] = []
    risk_flags: list[RiskFlag] = []
    key_findings: list[KeyFinding] = []

    for section in sections:
        section_id = section.get("id", "unknown")
        section_type = section.get("type", "")

        logger.debug("  → section: %s (type=%s)", section_id, section_type)

        if section_type == "llm_generated":
            executive_summary = _handle_llm_generated(section, state, evaluation_results)

        elif section_type == "radar":
            radar_scores = _handle_radar(section, evaluation_results)

        elif section_type == "bar_chart":
            agent_scores = _handle_bar_chart(section, evaluation_results)

        elif section_type == "table":
            risk_flags = _handle_table_risks(section, evaluation_results)

        elif section_type == "markdown_card":
            # markdown_card 的内容追加到 executive_summary 或忽略
            pass

        else:
            logger.warning("⚠️ 未知 section type: %s (id=%s)", section_type, section_id)

    # 如果 YAML 中没有 bar_chart section，兜底生成 agent_scores
    if not agent_scores:
        agent_scores = _handle_bar_chart({}, evaluation_results)

    # 如果 YAML 中没有 radar section，兜底生成 radar_scores
    if not radar_scores:
        radar_scores = _handle_radar({}, evaluation_results)

    # key_findings 始终从 evaluation_results 提取
    key_findings = _extract_key_findings(evaluation_results)

    # evidence_items 从 evaluation_results 提取并合并
    evidence_items = _extract_evidence(evaluation_results)

    # ── 使用 FinalReport Schema 组装 ──
    report = FinalReport(
        template=template_name,
        version=template.get("version", "1.0"),
        report=ReportBody(
            executive_summary=executive_summary,
            arbitration=ArbitrationSummary(
                summary=final_judgment,
                radar_scores=radar_scores,
            ),
            agent_scores=agent_scores,
            risk_flags=risk_flags,
            key_findings=key_findings,
            evidence_items=evidence_items,
            meta=ReportMeta(
                overall_score=final_score,
                novelty_level=novelty_level,
                avg_agent_score=round(avg_score, 1),
                agent_count=len(evaluation_results),
                score_gap=score_gap,
            ),
        ),
    )

    logger.info(
        "📋 报告组装完成: template=%s, sections=%d, agents=%d, score=%s",
        template_name, len(sections), len(evaluation_results), final_score,
    )

    return {
        "report_json": report.model_dump(by_alias=True),
        "current_phase": "report",
        "execution_logs": [f"[报告] 已按 {template_name} 模板组装完成 ({len(sections)} sections)"],
    }
