"""
Novoscan-Open-Core 环境配置

通过 pydantic-settings 从 .env 文件或环境变量加载。
所有模型参数使用通用命名（LLM_*），严禁硬编码具体模型信息。
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """全局配置 — .env 文件或环境变量注入"""

    # ── 主模型（通用 OpenAI-Compatible 接口） ──
    model_provider: str = "deepseek"          # 仅用于日志标识
    llm_api_key: str = ""                     # API Key
    llm_base_url: str = ""                    # OpenAI-Compatible Base URL
    llm_model_name: str = ""                  # 模型名称
    llm_temperature: float = 0.3
    llm_max_retries: int = 2
    llm_timeout: int = 120
    llm_supports_structured_output: bool = False  # 模型是否支持 function_calling 的 structured_output（GPT-4/Gemini=True, MiniMax/DeepSeek=False）

    # ── 备用模型（可选，降级时切换） ──
    fallback_api_key: Optional[str] = None
    fallback_base_url: Optional[str] = None
    fallback_model_name: Optional[str] = None

    # ── 检索工具 ──
    brave_api_key: Optional[str] = None
    github_token: Optional[str] = None
    openalex_email: Optional[str] = None
    crossref_email: Optional[str] = None

    # ── 服务 ──
    engine_host: str = "0.0.0.0"
    engine_port: int = 8001
    log_level: str = "info"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


# 全局单例
settings = Settings()
