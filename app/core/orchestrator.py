"""
Novoscan-Open-Core — Agentic Mode Orchestrator (Phase 7)

超级 ReAct Agent，将全部积木暴露为 Tool：

Tools:
  1. analyze_intent     — 意图分析
  2. search_*           — 5 个搜索工具（OpenAlex/arXiv/Brave/GitHub/CrossRef）
  3. score_*            — 各评分 Agent（从 BlockRegistry 动态发现）
  4. run_debate          — 触发辩论
  5. run_arbitration     — 触发仲裁
  6. generate_report     — 生成报告

与 Standard 管线的区别：
  - Standard: 固定拓扑，节点顺序预定义
  - Agentic:  LLM 自主决定调用顺序和次数

安全设计：
  - max_iterations 限制防止死循环
  - 每步记录 execution_logs
  - 超时保护
"""

from __future__ import annotations

import json as _json
import logging
from pathlib import Path
from typing import Any

from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import BaseTool, StructuredTool, tool
from langgraph.prebuilt import create_react_agent

from app.models import get_model
from app.models import get_fallback_model
from app.compat import invoke_with_fallback
from app.schemas.agent_output import AgentOutput, ArbitrationResult
from app.schemas.agentic_dsl import AgenticWorkflowDSL, build_default_agentic_dsl

logger = logging.getLogger("novoscan.orchestrator")

# ══════════════════════════════════════════════════════════════
# T1.2: Agentic 配置 JSON 持久化
# ══════════════════════════════════════════════════════════════

_AGENTIC_CONFIG_PATH = Path(__file__).resolve().parent.parent / "pipelines" / "agentic_default.json"
_AGENTIC_DSL_PATH = Path(__file__).resolve().parent.parent / "pipelines" / "agentic_workflow.json"


def load_agentic_config() -> dict:
    """从 JSON 文件加载 Agentic 配置"""
    if _AGENTIC_CONFIG_PATH.is_file():
        return _json.loads(_AGENTIC_CONFIG_PATH.read_text(encoding="utf-8"))
    return {}


def save_agentic_config(config: dict) -> None:
    """将 Agentic 配置保存到 JSON 文件"""
    _AGENTIC_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    _AGENTIC_CONFIG_PATH.write_text(
        _json.dumps(config, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _merge_agentic_config(runtime_config: dict | None = None) -> dict:
    """合并文件配置与运行时覆盖。"""
    merged = dict(load_agentic_config())
    if not runtime_config:
        return merged

    for key, value in runtime_config.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = {**merged.get(key, {}), **value}
        else:
            merged[key] = value
    return merged


def _resolve_agentic_dsl(
    dsl: dict | AgenticWorkflowDSL | None = None,
    config: dict | None = None,
) -> AgenticWorkflowDSL:
    """解析显式 DSL；若无 DSL 文件则从旧配置归一化生成。"""
    if isinstance(dsl, AgenticWorkflowDSL):
        return dsl
    if isinstance(dsl, dict):
        return AgenticWorkflowDSL.model_validate(dsl)
    if _AGENTIC_DSL_PATH.is_file():
        raw = _json.loads(_AGENTIC_DSL_PATH.read_text(encoding="utf-8"))
        return AgenticWorkflowDSL.model_validate(raw)
    return build_default_agentic_dsl(config or load_agentic_config())


def load_agentic_dsl() -> dict:
    """读取 Agentic DSL；若尚未落盘则返回基于旧配置的归一化结果。"""
    dsl_model = _resolve_agentic_dsl(config=load_agentic_config())
    return dsl_model.model_dump(by_alias=True, exclude_none=True)


def save_agentic_dsl(dsl: dict | AgenticWorkflowDSL) -> dict:
    """校验并保存 Agentic DSL。"""
    dsl_model = _resolve_agentic_dsl(dsl=dsl, config=load_agentic_config())
    _AGENTIC_DSL_PATH.parent.mkdir(parents=True, exist_ok=True)
    _AGENTIC_DSL_PATH.write_text(
        _json.dumps(dsl_model.model_dump(by_alias=True, exclude_none=True), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return dsl_model.model_dump(by_alias=True, exclude_none=True)

# 最大迭代次数（防止死循环）
MAX_ITERATIONS = 25

# ══════════════════════════════════════════════════════════════
# 将现有节点包装为 Tool
# ══════════════════════════════════════════════════════════════


def _build_intent_tool() -> BaseTool:
    """意图分析 Tool"""
    from app.nodes.intent import intent_analysis_node

    @tool
    async def analyze_intent(user_input: str) -> str:
        """
        分析用户的创新想法，提取核心创新点、关键词和领域。
        输入：用户的原始想法描述。
        输出：结构化的意图分析结果。
        必须在流程最开始调用。
        """
        state = {
            "user_raw_input": user_input,
            "detection_type": "auto",
            "messages": [],
        }
        result = await intent_analysis_node(state)
        intent = result.get("analyzed_intent", {})
        return (
            f"核心创新点: {intent.get('core_idea', '未提取')}\n"
            f"关键词: {', '.join(intent.get('keywords', []))}\n"
            f"领域: {intent.get('domain', '未识别')}"
        )

    return analyze_intent


def _build_scoring_tools() -> list[BaseTool]:
    """构建评分 Agent Tools（从 Prompt 模块直接构建）"""
    from app.prompts.scoring import (
        ACADEMIC_SYSTEM_PROMPT,
        build_academic_prompt,
        INDUSTRY_SYSTEM_PROMPT,
        build_industry_prompt,
        COMPETITOR_SYSTEM_PROMPT,
        build_competitor_prompt,
    )

    # 评分 Agent 定义
    agent_defs = [
        {
            "id": "academic_scorer",
            "name": "学术审查员",
            "system_prompt": ACADEMIC_SYSTEM_PROMPT,
            "builder": build_academic_prompt,
        },
        {
            "id": "industry_analyst",
            "name": "产业分析员",
            "system_prompt": INDUSTRY_SYSTEM_PROMPT,
            "builder": build_industry_prompt,
        },
        {
            "id": "competitor_detective",
            "name": "竞品侦探",
            "system_prompt": COMPETITOR_SYSTEM_PROMPT,
            "builder": build_competitor_prompt,
        },
    ]

    tools = []
    for agent_def in agent_defs:
        _id = agent_def["id"]
        _name = agent_def["name"]
        _sys = agent_def["system_prompt"]
        _builder = agent_def["builder"]

        def _make_tool(aid, aname, asys, builder):
            @tool
            async def score_agent(
                core_idea: str,
                context: str = "",
            ) -> str:
                """对创新想法进行评分（0-100分），提供置信度、分析和关键发现。"""
                model = get_model()
                user_msg = builder(core_idea, context, "") if callable(builder) else (
                    f"# 任务：评估创新想法\n\n"
                    f"**核心创新点**：{core_idea}\n\n"
                    f"**检索上下文**：\n{context or '暂无检索数据'}"
                )
                try:
                    result = await invoke_with_fallback(
                        model,
                        AgentOutput,
                        [SystemMessage(content=asys), HumanMessage(content=user_msg)],
                        node_name=aname,
                    )
                    if result is None:
                        raise ValueError("评分结果解析失败")
                    result.agent_name = aname
                except Exception:
                    fallback = get_fallback_model()
                    if fallback:
                        result = await invoke_with_fallback(
                            fallback,
                            AgentOutput,
                            [SystemMessage(content=asys), HumanMessage(content=user_msg)],
                            node_name=f"{aname}-fallback",
                        )
                        if result is not None:
                            result.agent_name = aname
                    else:
                        result = None
                if result is None:
                    fallback_result = AgentOutput(
                        agent_name=aname,
                        score=50,
                        confidence="low",
                        confidence_reasoning="Agentic 工具调用失败，使用降级结构化结果",
                        analysis=f"由于模型调用或解析异常，{aname} 未能返回完整结构化评分。",
                        is_fallback=True,
                    )
                    return _json.dumps(fallback_result.model_dump(), ensure_ascii=False)
                return _json.dumps(result.model_dump(), ensure_ascii=False)

            score_agent.__name__ = f"score_{aid}"
            score_agent.__doc__ = f"使用{aname}对创新想法进行评分（0-100分），提供置信度、分析和关键发现。"
            score_agent.name = f"score_{aid}"
            return score_agent

        tools.append(_make_tool(_id, _name, _sys, _builder))

    return tools


def _build_search_tools() -> list[BaseTool]:
    """获取所有搜索工具"""
    from app.tools.search import (
        search_openalex,
        search_arxiv,
        search_brave,
        search_github,
        search_crossref,
    )
    return [search_openalex, search_arxiv, search_brave, search_github, search_crossref]


def _build_debate_tool() -> BaseTool:
    """辩论 Tool"""
    @tool
    async def run_debate(
        topic: str,
        agent_scores: str,
    ) -> str:
        """
        发起多 Agent 辩论。当评分分差超过 20 时应该调用此工具。
        输入：辩论主题和各 Agent 的评分结果。
        输出：辩论记录和共识结论。
        """
        import json as _json
        from app.nodes.debate import debate_node

        # 尝试从 agent_scores 中解析 evaluation_results
        eval_results: list[dict] = []
        try:
            parsed = _json.loads(agent_scores)
            if isinstance(parsed, list):
                eval_results = parsed
        except Exception:
            pass

        state = {
            "user_raw_input": topic,
            "analyzed_intent": {"core_idea": topic},
            "evaluation_results": eval_results,
            "score_gap": 30,
            "retrieved_context": agent_scores,
            "messages": [],
        }
        result = await debate_node(state)
        history = result.get("debate_history", [])

        # 返回结构化 JSON 以便前端解析为 DebateSession
        return _json.dumps({
            "debate_history": history,
            "debate_round": result.get("debate_round", 0),
            "current_phase": result.get("current_phase", "debate"),
        }, ensure_ascii=False)

    return run_debate


def _build_arbitration_tool() -> BaseTool:
    """仲裁 Tool"""
    @tool
    async def run_arbitration(
        topic: str,
        agent_results_summary: str,
    ) -> str:
        """
        执行最终仲裁裁决。综合所有 Agent 评分和辩论结果，给出最终评分和建议。
        应在所有评分完成后调用。
        输入：主题和各 Agent 结果摘要。
        输出：最终评分和判决。
        """
        model = get_model()
        prompt = (
            f"你是创新评估仲裁官。请综合以下分析结果，给出最终评分(0-100)和判决。\n\n"
            f"# 主题\n{topic}\n\n"
            f"# 各 Agent 分析结果\n{agent_results_summary}\n\n"
            f"请输出：\n1. 最终评分 (0-100)\n2. 判决（推荐/谨慎考虑/不推荐）\n3. 核心理由\n4. 关键建议"
        )
        try:
            result = await invoke_with_fallback(
                model,
                ArbitrationResult,
                [HumanMessage(content=prompt)],
                node_name="agentic-arbitration",
            )
            if result is None:
                raise ValueError("仲裁结果解析失败")
        except Exception:
            fallback = get_fallback_model()
            if fallback:
                result = await invoke_with_fallback(
                    fallback,
                    ArbitrationResult,
                    [HumanMessage(content=prompt)],
                    node_name="agentic-arbitration-fallback",
                )
            else:
                result = None
        if result is None:
            fallback_result = ArbitrationResult(
                summary="谨慎考虑——Agentic 仲裁执行失败，使用降级结果",
                overall_score=50,
                recommendation="谨慎考虑",
                is_partial=True,
            )
            return _json.dumps(fallback_result.model_dump(), ensure_ascii=False)
        return _json.dumps(result.model_dump(), ensure_ascii=False)

    return run_arbitration


def _build_all_tools_map() -> dict[str, BaseTool]:
    """构建全量 Tool 注册表。"""
    all_tools_map: dict[str, BaseTool] = {}
    all_tools_map["analyze_intent"] = _build_intent_tool()
    for current_tool in _build_search_tools():
        all_tools_map[current_tool.name] = current_tool
    for current_tool in _build_scoring_tools():
        all_tools_map[current_tool.name] = current_tool
    all_tools_map["run_debate"] = _build_debate_tool()
    all_tools_map["run_arbitration"] = _build_arbitration_tool()
    return all_tools_map


def _resolve_enabled_tool_ids(
    available_tool_ids: set[str],
    config: dict,
    dsl_model: AgenticWorkflowDSL,
    runtime_enabled_tools: list[str] | None = None,
) -> set[str]:
    """根据配置 + DSL + 运行时覆盖解析真实可用工具集合。"""
    configured_tools = [t for t in config.get("tools", []) if t.get("id")]
    configured_tool_ids = {t["id"] for t in configured_tools}
    configured_enabled_ids = {t["id"] for t in configured_tools if t.get("enabled", True)}

    base_tool_ids = available_tool_ids & (configured_tool_ids or available_tool_ids)
    if configured_tools:
        base_tool_ids &= configured_enabled_ids

    tool_policy = dsl_model.tool_policy
    if tool_policy.mode == "all":
        resolved_tool_ids = set(base_tool_ids)
    elif tool_policy.mode == "denylist":
        resolved_tool_ids = set(base_tool_ids) - set(tool_policy.denied_tools)
    else:
        allowlist_ids = set(tool_policy.tools) if tool_policy.tools else set(base_tool_ids)
        resolved_tool_ids = set(base_tool_ids) & allowlist_ids

    if runtime_enabled_tools is not None:
        resolved_tool_ids &= set(runtime_enabled_tools)

    return resolved_tool_ids


def get_agentic_runtime_definition(
    config: dict | None = None,
    dsl: dict | AgenticWorkflowDSL | None = None,
    runtime_enabled_tools: list[str] | None = None,
) -> dict[str, Any]:
    """返回当前 Agentic 运行真相：DSL 快照 + 真实工具策略。"""
    merged_config = _merge_agentic_config(config)
    dsl_model = _resolve_agentic_dsl(dsl=dsl, config=merged_config)
    all_tools_map = _build_all_tools_map()
    allowed_tool_ids = sorted(
        _resolve_enabled_tool_ids(
            available_tool_ids=set(all_tools_map.keys()),
            config=merged_config,
            dsl_model=dsl_model,
            runtime_enabled_tools=runtime_enabled_tools,
        )
    )
    tool_budgets = {
        item.tool: item.max_calls
        for item in dsl_model.tool_policy.budgets
        if item.tool in allowed_tool_ids
    }

    return {
        "dsl": dsl_model.model_dump(by_alias=True, exclude_none=True),
        "tool_policy": {
            "mode": dsl_model.tool_policy.mode,
            "allowed_tools": allowed_tool_ids,
            "denied_tools": sorted(set(dsl_model.tool_policy.denied_tools)),
            "budgets": tool_budgets,
        },
        "temperature": merged_config.get("model", {}).get("temperature", 0.3),
        "system_prompt": merged_config.get("system_prompt", ORCHESTRATOR_SYSTEM_PROMPT),
    }


# ══════════════════════════════════════════════════════════════
# 系统 Prompt
# ══════════════════════════════════════════════════════════════

ORCHESTRATOR_SYSTEM_PROMPT = """你是 Novoscan 创新分析编排器。你的任务是使用提供的工具对用户的创新想法进行全面分析。

## 标准分析流程

1. **意图分析**: 首先调用 analyze_intent 理解用户的创新想法
2. **信息检索**: 使用搜索工具（search_openalex, search_arxiv, search_brave, search_github）收集数据
3. **多维评分**: 使用评分工具（score_academic_scorer, score_industry_analyst, score_competitor_detective）从不同维度评估
4. **仲裁裁决**: 调用 run_arbitration 综合所有结果给出最终判决

## 重要规则

- 你必须至少使用 2 个搜索工具收集数据
- 你必须调用至少 2 个评分 Agent
- 如果评分差异很大（>20分），考虑调用 run_debate 进行辩论
- 最后必须调用 run_arbitration 给出最终裁决
- 每次工具调用前，先解释你要做什么以及为什么
- 最终回复必须包含：最终评分、推荐等级、核心理由、关键建议"""


# ══════════════════════════════════════════════════════════════
# Orchestrator 构建
# ══════════════════════════════════════════════════════════════

def build_agentic_graph(
    checkpointer=None,
    config: dict | None = None,
    dsl: dict | AgenticWorkflowDSL | None = None,
    runtime_enabled_tools: list[str] | None = None,
    extra_prompt: str = "",
):
    """
    构建 Agentic Mode ReAct Agent。

    返回一个可以直接 ainvoke 的 LangGraph CompiledGraph。
    config 参数可覆盖 JSON 文件中的默认配置。
    """
    merged_config = _merge_agentic_config(config)
    runtime_definition = get_agentic_runtime_definition(
        config=merged_config,
        dsl=dsl,
        runtime_enabled_tools=runtime_enabled_tools,
    )
    enabled_tool_ids = set(runtime_definition["tool_policy"]["allowed_tools"])
    system_prompt = runtime_definition["system_prompt"]
    if extra_prompt:
        system_prompt = f"{system_prompt}\n\n## Runtime Instructions\n{extra_prompt}"
    temperature = runtime_definition["temperature"]

    all_tools_map = _build_all_tools_map()
    tools = [tool_item for tool_name, tool_item in all_tools_map.items() if tool_name in enabled_tool_ids]

    if not tools:
        raise ValueError("Agentic tool_policy 解析后没有可用工具，无法构建运行图")

    logger.info(
        "🤖 Agentic Orchestrator 构建完成: %d/%d 个工具启用 [%s] | interrupt_before=%d | interrupt_after=%d",
        len(tools),
        len(all_tools_map),
        ", ".join(t.name for t in tools),
        len(runtime_definition["dsl"].get("interrupt_before", [])),
        len(runtime_definition["dsl"].get("interrupt_after", [])),
    )

    # 构建 ReAct Agent
    model = get_model(temperature=temperature)
    agent = create_react_agent(
        model=model,
        tools=tools,
        prompt=system_prompt,
        checkpointer=checkpointer,
    )

    return agent
