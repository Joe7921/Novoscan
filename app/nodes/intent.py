"""
意图分析节点 — Phase 1 HITL 循环

对齐技术方案 §1.4：
  - 首次调用：从 user_raw_input 解析意图
  - 修正调用：结合 user_feedback 重新解析
  - 输出 analyzed_intent（结构化 JSON）
  - 每次执行后清空 user_feedback，置 is_confirmed=False

实现 AgentBlock 双重接口（Node + Tool）。
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.messages import SystemMessage, HumanMessage

from app.core.base import AgentBlock, BlockMeta
from app.models import get_model
from app.prompts.intent import (
    INTENT_SYSTEM_PROMPT,
    INTENT_FIRST_ANALYSIS,
    INTENT_REVISION_ANALYSIS,
)

logger = logging.getLogger("novoscan.nodes.intent")


class IntentAnalyzerBlock(AgentBlock):
    """意图分析积木 — 支持首次分析和修正循环"""

    async def _execute(self, inputs: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
        """
        执行意图分析。

        逻辑：
          - 有 user_feedback → 修正模式（使用 REVISION prompt）
          - 无 user_feedback → 首次分析模式（使用 FIRST prompt）
        """
        user_raw_input = inputs.get("user_raw_input", "")
        user_feedback = inputs.get("user_feedback")

        # 获取模型
        temperature = config.get("temperature", 0.3)
        model = get_model(temperature=temperature)

        # 构造 Prompt
        system_prompt = config.get("system_prompt") or INTENT_SYSTEM_PROMPT

        if user_feedback:
            # 修正模式
            previous_intent = inputs.get("analyzed_intent") or {}
            human_content = INTENT_REVISION_ANALYSIS.format(
                user_raw_input=user_raw_input,
                previous_intent=json.dumps(previous_intent, ensure_ascii=False, indent=2),
                user_feedback=user_feedback,
            )
            logger.info("🔄 修正模式: 用户反馈='%s'", user_feedback[:50])
        else:
            # 首次分析
            human_content = INTENT_FIRST_ANALYSIS.format(
                user_raw_input=user_raw_input,
            )
            logger.info("🔍 首次分析: 输入='%s'", user_raw_input[:50])

        # 调用 LLM
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_content),
        ]

        response = await model.ainvoke(messages)
        raw_text = response.content.strip()

        # 解析 JSON（容错处理：去掉 markdown 代码块包裹）
        analyzed_intent = self._parse_json_response(raw_text)

        logger.info(
            "✅ 意图分析完成: core_idea='%s', keywords=%s",
            analyzed_intent.get("core_idea", "?")[:30],
            analyzed_intent.get("keywords", [])[:3],
        )

        return {
            "analyzed_intent": analyzed_intent,
            "user_feedback": None,      # 清空反馈（技术方案 §1.4 要求）
            "is_confirmed": False,      # 等待用户确认
            "current_phase": "intent_analysis",
        }

    @staticmethod
    def _parse_json_response(text: str) -> dict:
        """
        从 LLM 的回复中解析 JSON。
        兼容 ```json ... ``` 包裹格式。
        """
        # 去掉可能的 markdown 代码块包裹
        cleaned = text
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1]
        if "```" in cleaned:
            cleaned = cleaned.split("```", 1)[0]
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("⚠️ JSON 解析失败，返回原始文本作为 core_idea")
            return {
                "core_idea": text[:200],
                "keywords": [],
                "domain": "unknown",
                "sub_domains": [],
                "search_directions": [],
                "confidence": 0.0,
                "parse_error": True,
            }


# ── 全局实例（图节点使用） ──

_intent_block: IntentAnalyzerBlock | None = None


def get_intent_block() -> IntentAnalyzerBlock:
    """获取意图分析积木实例（懒加载）"""
    global _intent_block
    if _intent_block is None:
        from pathlib import Path
        yaml_path = Path(__file__).parent.parent / "agents" / "_builtin" / "intent_analyzer.yaml"
        if yaml_path.exists():
            meta = BlockMeta.from_yaml(yaml_path)
        else:
            # 无 YAML 时使用默认元数据
            meta = BlockMeta(
                id="intent_analyzer",
                name="意图分析师",
                category="intent",
                inputs=["user_raw_input", "user_feedback"],
                outputs=["analyzed_intent"],
            )
        _intent_block = IntentAnalyzerBlock(meta=meta)
    return _intent_block


async def intent_analysis_node(state: dict) -> dict:
    """LangGraph 图节点入口函数"""
    block = get_intent_block()
    return await block.run_as_node(state)
