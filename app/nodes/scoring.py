"""
评分节点 — Phase 3 并行 Map-Reduce

改进点（vs 旧引擎）：
  1. 三个 Agent 不再硬编码——通过 YAML 注册的 scoring 类积木动态发现
  2. 使用 invoke_with_fallback 三级降级确保兼容所有模型
  3. 并行执行 + 异常降级
  4. 每个 Agent 是独立 AgentBlock，可单独调用、可热插拔

架构：scoring_node 是一个"编排器"，不是"执行器"。
"""

from __future__ import annotations

import asyncio
import importlib
import logging
from typing import Any

from langchain_core.messages import SystemMessage, HumanMessage

from langchain_core.callbacks import adispatch_custom_event

from app.core.registry import get_block_registry
from app.models import get_model
from app.schemas.agent_output import AgentOutput
from app.compat import invoke_with_fallback

logger = logging.getLogger("novoscan.nodes.scoring")


# ==============================================================================
# 评分 Agent 通用执行器
# ==============================================================================

async def _run_scoring_agent(
    agent_meta: dict,
    query: str,
    context: str,
    domain: str,
) -> dict:
    """
    执行单个评分 Agent。

    流程：
      1. 从 YAML config 中读取 Prompt 构建器路径
      2. 动态加载 system_prompt 和 prompt_builder
      3. 使用 with_structured_output(AgentOutput) 调用 LLM
      4. 返回序列化的 AgentOutput dict
    """
    config = agent_meta.get("config_schema") or {}

    def _cfg(key: str, fallback=None):
        """从 config_schema 提取值（兼容 ConfigField / dict / raw value）"""
        val = config.get(key)
        if val is None:
            return fallback
        # ConfigField 对象
        if hasattr(val, "default"):
            return val.default if val.default is not None else fallback
        # dict 格式 {"default": ...}
        if isinstance(val, dict):
            return val.get("default", fallback)
        return val

    # 动态加载 system prompt
    system_prompt_ref = _cfg("system_prompt", "")
    system_prompt = _resolve_ref(system_prompt_ref)

    # 动态加载 prompt builder
    builder_ref = _cfg("prompt_builder", "")
    builder_fn = _resolve_ref(builder_ref)

    # 构建 prompt
    if callable(builder_fn):
        user_prompt = builder_fn(query, context, domain)
    else:
        user_prompt = f"请评估：{query}\n\n检索上下文：{context}"

    # 获取模型
    temp = _cfg("temperature", 0.3)
    model = get_model(temperature=float(temp))

    try:
        messages = [
            SystemMessage(content=str(system_prompt)),
            HumanMessage(content=user_prompt),
        ]
        result = await invoke_with_fallback(
            model, AgentOutput, messages, node_name=agent_meta["name"],
        )
        if result is None:
            raise ValueError("L1+L2 均失败，无法解析模型输出")
        result.agent_name = agent_meta["name"]
        logger.info(
            "✅ %s 完成: score=%d, confidence=%s",
            agent_meta["name"], result.score, result.confidence,
        )
        # 向 SSE 流推送单个 Agent 完成事件
        try:
            await adispatch_custom_event("agent_scored", {
                "agent_name": result.agent_name,
                "score": result.score,
                "confidence": result.confidence,
                "is_fallback": result.is_fallback,
            })
        except Exception:
            pass  # 非流式调用时无 callback context，静默跳过
        return result.model_dump()
    except Exception as e:
        logger.warning("⚠️ %s 执行失败: %s", agent_meta["name"], e)
        return AgentOutput(
            agent_name=agent_meta["name"],
            score=50,
            confidence="low",
            confidence_reasoning=f"Agent 执行异常，使用降级评分: {str(e)}",
            analysis=f"由于技术原因，{agent_meta['name']}未能完成深度分析。",
            is_fallback=True,
        ).model_dump()


def _resolve_ref(ref: str):
    """解析 Python 模块引用（'module.path:symbol'）"""
    if not ref or ":" not in ref:
        return ref
    try:
        module_path, symbol = ref.rsplit(":", 1)
        mod = importlib.import_module(module_path)
        return getattr(mod, symbol)
    except Exception as e:
        logger.warning("⚠️ 解析引用 '%s' 失败: %s", ref, e)
        return ref


# ==============================================================================
# 评分编排节点
# ==============================================================================

async def scoring_node(state: dict) -> dict:
    """
    评分编排器 — 并行启动所有 scoring 类积木。

    改进：
      - 不硬编码三个 Agent，而是从 BlockRegistry 动态发现所有 category=scoring 的积木
      - 并行执行（asyncio.gather）
      - 自动计算 score_gap
    """
    query = state.get("user_raw_input", "")
    context = state.get("retrieved_context", "暂无检索数据")
    domain = state.get("analyzed_intent", {}).get("domain", "")

    # 从 BlockRegistry 获取所有评分类积木
    registry = get_block_registry()
    scoring_blocks = [
        meta for meta in registry.list_all()
        if meta["category"] == "scoring"
    ]

    if not scoring_blocks:
        logger.warning("⚠️ 未注册任何 scoring 类积木")
        return {
            "evaluation_results": [],
            "score_gap": 0.0,
            "execution_logs": ["未找到评分积木"],
            "current_phase": "scoring",
        }

    logger.info(
        "🎯 评分编排器启动: %d 个 Agent [%s]",
        len(scoring_blocks),
        ", ".join(b["name"] for b in scoring_blocks),
    )

    # Map: 并行执行所有评分 Agent
    tasks = [
        _run_scoring_agent(meta, query, context, domain)
        for meta in scoring_blocks
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # 处理结果
    evaluation_results = []
    logs = []
    for i, result in enumerate(results):
        agent_name = scoring_blocks[i]["name"]
        if isinstance(result, Exception):
            fallback = AgentOutput(
                agent_name=agent_name,
                score=50,
                confidence="low",
                analysis=f"Agent 执行失败: {str(result)}",
                is_fallback=True,
            ).model_dump()
            evaluation_results.append(fallback)
            logs.append(f"[评分] {agent_name} 执行失败，使用降级评分")
            try:
                await adispatch_custom_event("agent_scored", {
                    "agent_name": agent_name,
                    "score": 50,
                    "confidence": "low",
                    "is_fallback": True,
                })
            except Exception:
                pass
        else:
            evaluation_results.append(result)
            logs.append(
                f"[评分] {result['agent_name']} 完成: "
                f"{result['score']}/100 (置信度: {result['confidence']})"
            )

    # 计算分差
    scores = [r["score"] for r in evaluation_results]
    score_gap = max(scores) - min(scores) if scores else 0

    logger.info(
        "📊 评分汇总: scores=%s, gap=%d",
        scores, score_gap,
    )

    return {
        "evaluation_results": evaluation_results,
        "score_gap": float(score_gap),
        "execution_logs": logs,
        "current_phase": "scoring",
    }
