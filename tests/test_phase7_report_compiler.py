import json

from langchain_core.messages import AIMessage, ToolMessage

from app.nodes.report_compiler import _try_deterministic_compile


def test_deterministic_compile_from_structured_tool_messages() -> None:
    academic_payload = {
        "agent_name": "学术审查员",
        "score": 78,
        "confidence": "high",
        "confidence_reasoning": "证据较充分",
        "analysis": "学术路径具有明确新颖性。",
        "dimension_scores": [
            {"name": "新颖性", "score": 80, "reasoning": "与现有方法存在明显差异"}
        ],
        "key_findings": ["存在明确方法创新"],
        "evidence": [
            {
                "title": "Paper A",
                "source": "OpenAlex",
                "source_type": "学术论文",
                "url": "https://example.com/paper-a",
                "year": 2024,
                "relevance": "high",
                "relevance_score": 0.91,
                "relevance_reasoning": "直接验证核心机制",
                "key_point": "验证创新点",
                "key_excerpt": "paper excerpt",
                "dimension": "学术",
                "stance": "支持",
                "citation_info": {"author": "A"},
                "related_evidence_ids": [],
                "metrics": {"citations": 12}
            }
        ],
        "red_flags": ["临床验证样本不足"],
        "reasoning": "",
        "is_fallback": False
    }

    industry_payload = {
        "agent_name": "产业分析员",
        "score": 66,
        "confidence": "medium",
        "confidence_reasoning": "市场验证仍需补充",
        "analysis": "产业落地路径可行，但需要更多商务验证。",
        "dimension_scores": [
            {"name": "市场需求", "score": 68, "reasoning": "需求存在但竞争较强"}
        ],
        "key_findings": ["初期切入场景明确"],
        "evidence": [
            {
                "title": "Industry Report B",
                "source": "Brave",
                "source_type": "行业报告",
                "url": "https://example.com/report-b",
                "year": 2025,
                "relevance": "medium",
                "relevance_score": 0.73,
                "relevance_reasoning": "支持 TAM 判断",
                "key_point": "市场规模增长",
                "key_excerpt": "report excerpt",
                "dimension": "产业",
                "stance": "支持",
                "citation_info": None,
                "related_evidence_ids": [],
                "metrics": {"market_size": "1B"}
            }
        ],
        "red_flags": ["渠道建设周期较长"],
        "reasoning": "",
        "is_fallback": False
    }

    arbitration_payload = {
        "summary": "综合来看具备较强潜力，但需要继续验证商业化闭环。",
        "overall_score": 72,
        "recommendation": "推荐",
        "weighted_breakdown": {"academic": 0.5, "industry": 0.5},
        "consensus_level": "moderate",
        "dissent": [],
        "conflicts_resolved": [],
        "next_steps": ["补充真实用户验证"],
        "is_partial": False
    }

    messages = [
        AIMessage(content="开始分析"),
        ToolMessage(content=json.dumps(academic_payload, ensure_ascii=False), tool_call_id="tool-1"),
        ToolMessage(content=json.dumps(industry_payload, ensure_ascii=False), tool_call_id="tool-2"),
        ToolMessage(content=json.dumps(arbitration_payload, ensure_ascii=False), tool_call_id="tool-3"),
        AIMessage(content="最终总结"),
    ]

    report = _try_deterministic_compile(messages)

    assert report is not None
    assert report.template == "Agentic 智能体报告"
    assert report.report.meta.overall_score == 72
    assert report.report.meta.agent_count == 2
    assert report.report.meta.score_gap == 12.0
    assert report.report.meta.quality_passed is True
    assert report.report.arbitration.summary == arbitration_payload["summary"]
    assert len(report.report.agent_scores) == 2
    assert len(report.report.risk_flags) == 2
    assert len(report.report.evidence_items) == 2
    assert report.report.evidence_items[0].title == "Paper A"


def test_deterministic_compile_returns_none_without_structured_payloads() -> None:
    messages = [
        AIMessage(content="只有自然语言总结，没有工具 JSON"),
        ToolMessage(content="普通文本，不是 JSON", tool_call_id="tool-1"),
    ]

    report = _try_deterministic_compile(messages)

    assert report is None
