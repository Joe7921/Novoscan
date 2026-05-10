"""
Novoscan-Open-Core 通用模型抽象层

核心原则：
  1. 严禁硬编码任何具体模型名、URL 或 API Key
  2. 所有 Provider 统一走 ChatOpenAI 的 OpenAI-Compatible 协议
  3. 配置全部来自 .env，代码中只有通用接口调用

用法：
    from app.models import get_model
    model = get_model()  # 自动从 .env 读取配置
    result = await model.ainvoke([...])
"""

from langchain_openai import ChatOpenAI
from langchain_core.language_models import BaseChatModel
from app.config import settings


def get_model(**overrides) -> BaseChatModel:
    """
    获取通用 LLM 实例。

    所有参数从 .env 读取，也可通过 overrides 临时覆盖。
    例: get_model(temperature=0.7) 覆盖默认温度。

    返回:
        BaseChatModel 实例（LangChain 通用接口）

    异常:
        ValueError: 未配置 API Key 或 Base URL 时抛出
    """
    api_key = overrides.get("api_key", settings.llm_api_key)
    base_url = overrides.get("base_url", settings.llm_base_url)
    model_name = overrides.get("model_name", settings.llm_model_name)
    temperature = overrides.get("temperature", settings.llm_temperature)

    if not api_key:
        raise ValueError(
            "未配置 LLM API Key。请在 .env 中设置 LLM_API_KEY。\n"
            "参考 .env.example 获取完整配置说明。"
        )
    if not base_url:
        raise ValueError(
            "未配置 LLM Base URL。请在 .env 中设置 LLM_BASE_URL。\n"
            "例: https://api.deepseek.com/v1"
        )

    return ChatOpenAI(
        api_key=api_key,
        base_url=base_url,
        model=model_name,
        temperature=temperature,
        max_retries=settings.llm_max_retries,
        request_timeout=settings.llm_timeout,
        streaming=True,
    )


def get_fallback_model() -> BaseChatModel | None:
    """
    获取备用模型实例（如果已配置）。

    返回 None 表示未配置备用模型。
    """
    if not settings.fallback_api_key or not settings.fallback_base_url:
        return None

    return ChatOpenAI(
        api_key=settings.fallback_api_key,
        base_url=settings.fallback_base_url,
        model=settings.fallback_model_name or "default",
        temperature=settings.llm_temperature,
        max_retries=settings.llm_max_retries,
        request_timeout=settings.llm_timeout,
    )
