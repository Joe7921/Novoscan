"""
结构化输出兼容层

问题：MiniMax 等 OpenAI-compatible 模型不完全支持 function_calling，
返回的 JSON 被 markdown 代码块包裹（```json ... ```），导致 Pydantic 解析失败。
另外，模型可能使用 camelCase 或自创字段名。

策略（三级降级）：
  1. with_structured_output() — 原生结构化（OpenAI/Gemini 等完全兼容的模型）
  2. 带 Schema 示例的 Prompt → 原始文本 → 剥离 markdown → 字段名修正 → Pydantic 验证
  3. 全部失败 → 返回 None，由调用方处理降级
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional, Type, TypeVar

from langchain_core.messages import BaseMessage, HumanMessage
from pydantic import BaseModel

logger = logging.getLogger("novoscan.compat")

T = TypeVar("T", bound=BaseModel)

# camelCase / 常见别名 → snake_case 映射
_FIELD_ALIASES = {
    # ArbitrationResult
    "finalScore": "overall_score",
    "final_score": "overall_score",
    "overallScore": "overall_score",
    "totalScore": "overall_score",
    "total_score": "overall_score",
    "recommendationLevel": "recommendation",
    "recommendation_level": "recommendation",
    "weightedBreakdown": "weighted_breakdown",
    "consensusLevel": "consensus_level",
    "conflictsResolved": "conflicts_resolved",
    "nextSteps": "next_steps",
    "isPartial": "is_partial",
    # AgentOutput
    "agentName": "agent_name",
    "agent_id": "agent_name",
    "agentId": "agent_name",
    "confidenceReasoning": "confidence_reasoning",
    "dimensionScores": "dimension_scores",
    "keyFindings": "key_findings",
    "redFlags": "red_flags",
    "isFallback": "is_fallback",
    # DimensionScore 子对象
    "dimension": "name",  # MiniMax 用 dimension 代替 name
    "dimension_name": "name",
}


def extract_json_from_text(text: str) -> Optional[str]:
    """
    从可能被 markdown 包裹的文本中提取 JSON 字符串。

    处理格式：
      - ```json { ... } ```
      - ``` { ... } ```
      - 纯 JSON { ... }
    """
    if not text:
        return None

    # 尝试 1：直接解析（理想情况）
    stripped = text.strip()
    if stripped.startswith("{"):
        try:
            json.loads(stripped)
            return stripped
        except json.JSONDecodeError:
            pass

    # 尝试 2：提取 markdown 代码块中的 JSON
    pattern = r"```(?:json)?\s*\n?(.*?)\n?```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        candidate = match.group(1).strip()
        try:
            json.loads(candidate)
            return candidate
        except json.JSONDecodeError:
            pass

    # 尝试 3：提取第一个 { ... } 块（贪心匹配最外层大括号）
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        candidate = brace_match.group(0)
        try:
            json.loads(candidate)
            return candidate
        except json.JSONDecodeError:
            pass

    return None


def _normalize_keys(data: dict) -> dict:
    """
    递归修正字段名：camelCase / 常见别名 → snake_case。
    """
    result = {}
    for key, value in data.items():
        normalized_key = _FIELD_ALIASES.get(key, key)
        if isinstance(value, dict):
            result[normalized_key] = _normalize_keys(value)
        elif isinstance(value, list):
            result[normalized_key] = [
                _normalize_keys(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[normalized_key] = value
    return result


# 需要被拆分为列表的字段名集合
_LIST_FIELDS = {
    "key_findings", "red_flags", "dissent", "conflicts_resolved",
    "next_steps", "evidence", "dimension_scores",
}


def _split_string_to_list(value: str) -> list[str]:
    """
    将编号字符串拆分为列表：
    "1. xxx\n2. yyy" → ["xxx", "yyy"]
    "- aaa\n- bbb" → ["aaa", "bbb"]
    """
    import re
    # 尝试按编号拆分（1. / 2. / ①② 等）
    items = re.split(r'\n\s*\d+[\.\)、]\s*', "\n" + value)
    items = [item.strip() for item in items if item.strip()]
    if len(items) > 1:
        return items

    # 尝试按 - / • 拆分
    items = re.split(r'\n\s*[-•]\s*', "\n" + value)
    items = [item.strip() for item in items if item.strip()]
    if len(items) > 1:
        return items

    # 尝试按换行拆分
    items = [line.strip() for line in value.split("\n") if line.strip()]
    if len(items) > 1:
        return items

    # 无法拆分，返回单元素列表
    return [value]


def _coerce_types(data: dict, schema: Type[BaseModel]) -> dict:
    """
    根据 Schema 定义修正值的类型：
    - 单字符串 → list[str]（对 list 类型字段）
    - 字符串 evidence → list[dict]（包装成 EvidenceItem）
    - 字符串 → dict（对 dict 类型字段，降级为空 dict）
    """
    fields = schema.model_fields
    result = dict(data)

    for field_name, field_info in fields.items():
        if field_name not in result:
            continue

        value = result[field_name]
        ann_str = str(field_info.annotation).lower()

        # 修正 1: 字符串 → 列表
        if isinstance(value, str) and "list" in ann_str:
            # 修正 1a: 字符串化的 JSON 数组 → 真实列表
            stripped_val = value.strip()
            if stripped_val.startswith("["):
                try:
                    parsed = json.loads(stripped_val)
                    if isinstance(parsed, list):
                        # 递归修正子对象的字段名
                        result[field_name] = [
                            _normalize_keys(item) if isinstance(item, dict) else item
                            for item in parsed
                        ]
                        logger.debug("🔧 [类型修正] %s: JSON字符串 → list (%d 条)", field_name, len(parsed))
                        continue
                except json.JSONDecodeError:
                    pass

            # 修正 1b: evidence 字段特殊处理
            if field_name == "evidence":
                # evidence 需要是 list[EvidenceItem]，字符串包装成简单 dict
                items = _split_string_to_list(value)
                result[field_name] = [
                    {"title": item, "source": "LLM推断", "relevance": "medium", "key_point": ""}
                    for item in items
                ]
                logger.debug("🔧 [类型修正] %s: str → list[EvidenceItem] (%d 条)", field_name, len(items))
            else:
                result[field_name] = _split_string_to_list(value)
                logger.debug("🔧 [类型修正] %s: str → list[str] (%d 条)", field_name, len(result[field_name]))

        # 修正 2: 字符串列表中的 evidence（每项是字符串而非 dict）
        elif isinstance(value, list) and field_name == "evidence":
            fixed = []
            for item in value:
                if isinstance(item, str):
                    fixed.append({"title": item, "source": "LLM推断", "relevance": "medium", "key_point": ""})
                else:
                    fixed.append(item)
            result[field_name] = fixed

        # 修正 3: 字符串 → dict（如 weighted_breakdown）
        elif isinstance(value, str) and "dict" in ann_str:
            result[field_name] = {"raw_text": value}
            logger.debug("🔧 [类型修正] %s: str → dict (包装)", field_name)

    return result


def _build_schema_hint(schema: Type[BaseModel]) -> str:
    """
    从 Pydantic 模型生成人类可读的 JSON Schema 提示，
    嵌入到 Prompt 末尾让模型严格遵循字段名。
    """
    fields = schema.model_fields
    example = {}
    for name, field_info in fields.items():
        annotation = field_info.annotation
        desc = field_info.description or ""
        # 生成示例值
        if annotation is int or (hasattr(annotation, '__origin__') and 'int' in str(annotation)):
            example[name] = f"<int: {desc}>"
        elif annotation is str or (hasattr(annotation, '__origin__') and 'str' in str(annotation)):
            example[name] = f"<string: {desc}>"
        elif annotation is bool:
            example[name] = f"<bool: {desc}>"
        elif annotation is list or (hasattr(annotation, '__origin__') and 'list' in str(annotation).lower()):
            example[name] = f"[<{desc}>]"
        elif annotation is dict or (hasattr(annotation, '__origin__') and 'dict' in str(annotation).lower()):
            example[name] = f"{{<{desc}>}}"
        else:
            example[name] = f"<{desc}>"

    return json.dumps(example, indent=2, ensure_ascii=False)


async def invoke_with_fallback(
    model: Any,
    schema: Type[T],
    messages: list[BaseMessage],
    node_name: str = "unknown",
) -> Optional[T]:
    """
    智能降级调用：根据模型能力自动选择最优策略。

    - 支持 structured_output 的模型（GPT-4, Gemini）→ L1 直接成功
    - 不支持的模型（MiniMax, DeepSeek）→ 跳过 L1，直接 L2 Prompt 内嵌 Schema

    参数：
      model: LangChain ChatModel 实例
      schema: Pydantic 模型类（如 AgentOutput、ArbitrationResult）
      messages: 消息列表
      node_name: 用于日志标识

    返回：
      解析成功的 Pydantic 对象，或 None（需要调用方自行降级）
    """
    from app.config import settings

    # ── 根据配置决定是否尝试 L1 ──
    if settings.llm_supports_structured_output:
        # Level 1: 原生结构化输出（GPT-4, Gemini 等）
        try:
            structured_model = model.with_structured_output(schema)
            result = await structured_model.ainvoke(messages)
            logger.info("✅ [%s] L1 结构化输出成功", node_name)
            return result
        except Exception as e:
            logger.info(
                "ℹ️ [%s] L1 结构化输出失败 (%s), 降级到 L2...",
                node_name, type(e).__name__,
            )
    else:
        logger.debug(
            "⏭️ [%s] 模型不支持 structured_output，跳过 L1 直接 L2",
            node_name,
        )

    # ── Level 2: Prompt 内嵌 Schema + 字段名修正 ──
    try:
        schema_hint = _build_schema_hint(schema)
        enhanced_messages = list(messages) + [
            HumanMessage(content=(
                "⚠️ 重要：请严格按照以下 JSON 结构返回结果，"
                "只返回纯 JSON，不要用 markdown 代码块包裹，"
                "字段名必须完全一致（snake_case）：\n\n"
                f"{schema_hint}"
            ))
        ]

        raw_response = await model.ainvoke(enhanced_messages)
        raw_text = (
            raw_response.content
            if hasattr(raw_response, "content")
            else str(raw_response)
        )

        json_str = extract_json_from_text(raw_text)
        if json_str:
            # L2a: 直接解析
            try:
                result = schema.model_validate_json(json_str)
                logger.info("✅ [%s] L2 直接解析成功", node_name)
                return result
            except Exception:
                pass

            # L2b: 字段名修正后重试
            raw_dict = json.loads(json_str)
            normalized = _normalize_keys(raw_dict)
            try:
                result = schema.model_validate(normalized)
                logger.info("✅ [%s] L2b 字段名修正后解析成功", node_name)
                return result
            except Exception:
                pass

            # L2c: 类型修正（字符串→列表等）
            coerced = _coerce_types(normalized, schema)
            try:
                result = schema.model_validate(coerced)
                logger.info("✅ [%s] L2c 类型修正后解析成功", node_name)
                return result
            except Exception as e3:
                logger.warning(
                    "⚠️ [%s] L2c 类型修正后仍失败: %s", node_name, e3,
                )
        else:
            logger.warning("⚠️ [%s] L2 未能从文本中提取 JSON", node_name)
            logger.debug("原始文本前300字符: %s", raw_text[:300])
    except Exception as e:
        logger.warning("⚠️ [%s] L2 调用失败: %s", node_name, e)

    # ── Level 3: 备用模型降级 ──
    from app.models import get_fallback_model
    fallback = get_fallback_model()
    if fallback is not None:
        logger.info("🔄 [%s] 主模型失败，尝试备用模型...", node_name)
        try:
            schema_hint = _build_schema_hint(schema)
            fb_messages = list(messages) + [
                HumanMessage(content=(
                    "⚠️ 重要：请严格按照以下 JSON 结构返回结果，"
                    "只返回纯 JSON，不要用 markdown 代码块包裹，"
                    "字段名必须完全一致（snake_case）：\n\n"
                    f"{schema_hint}"
                ))
            ]
            raw_response = await fallback.ainvoke(fb_messages)
            raw_text = (
                raw_response.content
                if hasattr(raw_response, "content")
                else str(raw_response)
            )
            json_str = extract_json_from_text(raw_text)
            if json_str:
                raw_dict = json.loads(json_str)
                normalized = _normalize_keys(raw_dict)
                coerced = _coerce_types(normalized, schema)
                try:
                    result = schema.model_validate(coerced)
                    logger.info("✅ [%s] L3 备用模型解析成功", node_name)
                    return result
                except Exception as e_fb:
                    logger.warning("⚠️ [%s] L3 备用模型解析失败: %s", node_name, e_fb)
            else:
                logger.warning("⚠️ [%s] L3 备用模型未返回有效 JSON", node_name)
        except Exception as e:
            logger.warning("⚠️ [%s] L3 备用模型调用失败: %s", node_name, e)

    # Level 4: 彻底失败
    logger.warning("❌ [%s] 所有策略均失败，返回 None", node_name)
    return None
