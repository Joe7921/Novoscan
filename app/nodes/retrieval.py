"""
ReAct 智能检索节点 — Phase 2

对齐技术方案 §2：
  - 根据 detection_type 从 ToolRegistry 过滤工具
  - 使用 LangGraph create_react_agent 创建检索子图
  - Agent 自主决定搜什么、用哪个工具、信息是否够用
  - 输出 retrieved_context + search_history

实现 AgentBlock 双重接口（Node + Tool）。
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent

from app.core.base import AgentBlock, BlockMeta
from app.core.tool_registry import get_tool_registry
from app.models import get_model

logger = logging.getLogger("novoscan.nodes.retrieval")

# ReAct Agent 的系统 Prompt
RETRIEVAL_SYSTEM_PROMPT = """你是一个专业的多源信息检索专家。你的任务是为创新性评估收集充分的背景信息。

你拥有多个搜索工具，请根据需要自主选择使用。

检索策略：
1. 先用最相关的工具搜索核心关键词
2. 根据初步结果决定是否需要补充搜索（不同角度或更细化的关键词）
3. 每个工具至少使用一次（如果适用）
4. 确保收集到足够的信息来支撑后续的多维度评估

停止条件：
- 已经从多个维度收集了足够的信息
- 或者所有工具都已使用过且没有发现新的有价值信息

输出要求：
- 当你认为信息已经足够时，直接用自然语言总结你收集到的全部信息
- 总结时要保留关键数据点（论文标题、引用数、项目Star数等）"""


class ReActRetrieverBlock(AgentBlock):
    """ReAct 智能检索积木"""

    async def _execute(self, inputs: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
        """
        执行 ReAct 检索循环。

        1. 从 ToolRegistry 获取按 detection_type 过滤后的工具
        2. 创建 ReAct Agent
        3. 执行检索
        4. 提取 search_history 和 retrieved_context
        """
        analyzed_intent = inputs.get("analyzed_intent") or {}
        detection_type = inputs.get("detection_type", "auto")

        # 从注册表获取工具（YAML 声明的 detection_types 自动过滤）
        tool_registry = get_tool_registry()
        tools = tool_registry.get_tools(detection_type=detection_type)

        if not tools:
            logger.warning("⚠️ detection_type='%s' 未匹配到任何工具", detection_type)
            return {
                "retrieved_context": "未找到可用的搜索工具。请检查 detection_type 设置和工具 YAML 配置。",
                "search_history": [],
                "current_phase": "retrieval",
            }

        # 构造检索指令
        keywords = analyzed_intent.get("keywords", [])
        core_idea = analyzed_intent.get("core_idea", "")
        search_directions = analyzed_intent.get("search_directions", [])

        retrieval_prompt = f"""请为以下创新想法进行全面的信息检索：

核心想法：{core_idea}
关键词：{', '.join(keywords)}
建议检索方向：{', '.join(search_directions)}

请使用你的工具进行多角度检索，收集足够的信息来支撑后续的评估。"""

        # 创建 ReAct Agent
        temperature = config.get("temperature", 0.1)
        max_iterations = config.get("max_iterations", 10)
        model = get_model(temperature=temperature)

        react_agent = create_react_agent(
            model=model,
            tools=tools,
            prompt=RETRIEVAL_SYSTEM_PROMPT,
        )

        logger.info(
            "🔍 ReAct 检索开始: type='%s', tools=%d, keywords=%s",
            detection_type, len(tools), keywords[:3],
        )

        # 执行 ReAct
        result = await react_agent.ainvoke(
            {"messages": [HumanMessage(content=retrieval_prompt)]},
            config={"recursion_limit": max_iterations * 2 + 5},
        )

        # 提取 search_history（从 messages 中解析 tool calls）
        messages = result.get("messages", [])
        search_history = []
        retrieved_context = ""

        for msg in messages:
            msg_type = type(msg).__name__

            if msg_type == "AIMessage":
                # AI 的思考/工具调用
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for tc in msg.tool_calls:
                        search_history.append({
                            "type": "action",
                            "tool": tc.get("name", "unknown"),
                            "input": tc.get("args", {}),
                        })
                elif msg.content:
                    # AI 的最终总结
                    retrieved_context = msg.content

            elif msg_type == "ToolMessage":
                # 工具返回结果
                search_history.append({
                    "type": "observation",
                    "tool": getattr(msg, "name", "unknown"),
                    "output_preview": (msg.content or "")[:300],
                })

        # 如果最后一条 AI 消息没有内容，把倒数的非工具消息作为 context
        if not retrieved_context:
            for msg in reversed(messages):
                if type(msg).__name__ == "AIMessage" and msg.content:
                    retrieved_context = msg.content
                    break

        if not retrieved_context:
            retrieved_context = "检索完成但未生成总结。请查看 search_history 中的原始工具输出。"

        logger.info(
            "✅ ReAct 检索完成: %d 步, context_length=%d",
            len(search_history), len(retrieved_context),
        )

        return {
            "retrieved_context": retrieved_context,
            "search_history": search_history,
            "current_phase": "retrieval",
        }


# ── 全局实例 ──

_retrieval_block: ReActRetrieverBlock | None = None


def get_retrieval_block() -> ReActRetrieverBlock:
    """获取检索积木实例"""
    global _retrieval_block
    if _retrieval_block is None:
        from pathlib import Path
        yaml_path = Path(__file__).parent.parent / "agents" / "_builtin" / "react_retriever.yaml"
        if yaml_path.exists():
            meta = BlockMeta.from_yaml(yaml_path)
        else:
            meta = BlockMeta(
                id="react_retriever",
                name="ReAct 智能检索",
                category="retrieval",
                inputs=["analyzed_intent", "detection_type"],
                outputs=["retrieved_context", "search_history"],
            )
        _retrieval_block = ReActRetrieverBlock(meta=meta)
    return _retrieval_block


async def retrieval_node(state: dict) -> dict:
    """LangGraph 图节点入口函数"""
    block = get_retrieval_block()
    return await block.run_as_node(state)
