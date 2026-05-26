"""
Novoscan-Open-Core — FastAPI 入口

职责：
  1. 健康检查端点
  2. Standard 传统工作流分析端点（/api/v1/analyze）
  3. HITL 恢复端点（/api/v1/thread/{thread_id}/resume）
  4. NDJSON 流式事件推送（后续 Phase 追加）
"""

import asyncio
import json
import logging
import time as _time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from langgraph.checkpoint.memory import MemorySaver

from datetime import datetime

from app.config import settings
from app.models import get_model, get_fallback_model
from app.graph import build_standard_graph

logger = logging.getLogger("novoscan")

# ── 全局变量 ──
standard_graph = None
agentic_graph = None
checkpointer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    global standard_graph, agentic_graph, checkpointer

    # ── 启动 ──
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    # 检测模型配置
    try:
        model = get_model()
        logger.info(
            "✅ 主模型就绪: provider=%s, base_url=%s, model=%s",
            settings.model_provider,
            settings.llm_base_url,
            settings.llm_model_name,
        )
    except ValueError as e:
        logger.warning("⚠️ 主模型未配置: %s", e)

    fallback = get_fallback_model()
    if fallback:
        logger.info("✅ 备用模型已配置")
    else:
        logger.info("ℹ️ 未配置备用模型（可选）")

    # 初始化 Standard 传统工作流管线
    checkpointer = MemorySaver()
    standard_graph = build_standard_graph(checkpointer=checkpointer)
    logger.info("🔧 Standard 传统工作流管线已编译")

    # 初始化 Agentic 智能体工作流管线（P7）
    try:
        from app.core.orchestrator import build_agentic_graph
        agentic_graph = build_agentic_graph(checkpointer=MemorySaver())
        logger.info("🤖 Agentic 智能体工作流管线已编译")
    except Exception as e:
        logger.warning("⚠️ Agentic 智能体工作流管线初始化失败: %s", e)
        agentic_graph = None

    logger.info(
        "🚀 Novoscan-Open-Core 引擎启动 @ %s:%d",
        settings.engine_host,
        settings.engine_port,
    )

    yield

    # ── 关闭 ──
    logger.info("🛑 引擎关闭")


app = FastAPI(
    title="Novoscan-Open-Core",
    description="创新性检测引擎 — 传统工作流 + 智能体工作流",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — 开发期全开放
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 请求/响应模型 ──

class AnalyzeRequest(BaseModel):
    """分析请求"""
    user_raw_input: str = Field(..., description="用户的创新想法描述")
    detection_type: str = Field(default="auto", description="检测类型: academic | industrial | skill | auto")
    enabled_tools: list[str] | None = Field(default=None, description="启用的工具名列表（None=全部启用）")
    extra_instructions: str = Field(default="", description="追加给 Agent 的额外指令")
    pipeline: str | None = Field(default=None, description="自定义管线文件名（Custom 模式）")


class ResumeRequest(BaseModel):
    """HITL 恢复请求"""
    action: str = Field(..., description="操作类型: confirm | revise")
    feedback: str = Field(default="", description="修正意见（action=revise 时必填）")


class AgenticResumeRequest(BaseModel):
    """Agentic 最小恢复请求"""
    action: str = Field(..., description="操作类型: approve_and_continue | revise_inputs | abort")
    feedback: str = Field(default="", description="补充反馈")
    revised_user_input: str = Field(default="", description="修正后的用户输入")
    enabled_tools: list[str] | None = Field(default=None, description="恢复时覆盖工具白名单")


# ── 健康检查 ──

@app.get("/health")
async def health():
    """服务健康检查"""
    model_ready = bool(settings.llm_api_key and settings.llm_base_url)
    return {
        "status": "ok",
        "engine": "novoscan-open-core",
        "version": "0.1.0",
        "model_provider": settings.model_provider,
        "model_ready": model_ready,
    }


# ── 模型配置 API（运行时热切换） ──


class ModelConfigPayload(BaseModel):
    """模型配置请求体"""
    model_provider: str | None = None
    llm_api_key: str | None = None
    llm_base_url: str | None = None
    llm_model_name: str | None = None
    llm_temperature: float | None = None
    llm_supports_structured_output: bool | None = None
    fallback_api_key: str | None = None
    fallback_base_url: str | None = None
    fallback_model_name: str | None = None

    # 检索工具
    brave_api_key: str | None = None
    github_token: str | None = None
    openalex_email: str | None = None
    crossref_email: str | None = None


@app.get("/api/v1/config/model")
async def get_model_config():
    """读取当前模型配置（API Key 脱敏）"""
    def mask(key: str | None) -> str:
        if not key:
            return ""
        return key[:8] + "***" + key[-4:] if len(key) > 12 else "***"

    return {
        "primary": {
            "provider": settings.model_provider,
            "api_key": mask(settings.llm_api_key),
            "base_url": settings.llm_base_url,
            "model_name": settings.llm_model_name,
            "temperature": settings.llm_temperature,
            "supports_structured_output": settings.llm_supports_structured_output,
        },
        "fallback": {
            "api_key": mask(settings.fallback_api_key),
            "base_url": settings.fallback_base_url or "",
            "model_name": settings.fallback_model_name or "",
        },
        "has_fallback": bool(settings.fallback_api_key and settings.fallback_base_url),
        "tools": {
            "brave_api_key": mask(settings.brave_api_key),
            "github_token": mask(settings.github_token),
            "openalex_email": settings.openalex_email,
            "crossref_email": settings.crossref_email,
        }
    }


@app.put("/api/v1/config/model")
async def update_model_config(payload: ModelConfigPayload):
    """运行时热切换模型配置（不重启服务）并持久化到 .env"""
    from app.env_utils import update_env_file
    updated = []
    env_updates = {}
    if payload.model_provider is not None:
        settings.model_provider = payload.model_provider
        env_updates["MODEL_PROVIDER"] = payload.model_provider
        updated.append("model_provider")
    if payload.llm_api_key is not None:
        settings.llm_api_key = payload.llm_api_key
        env_updates["LLM_API_KEY"] = payload.llm_api_key
        updated.append("llm_api_key")
    if payload.llm_base_url is not None:
        settings.llm_base_url = payload.llm_base_url
        env_updates["LLM_BASE_URL"] = payload.llm_base_url
        updated.append("llm_base_url")
    if payload.llm_model_name is not None:
        settings.llm_model_name = payload.llm_model_name
        env_updates["LLM_MODEL_NAME"] = payload.llm_model_name
        updated.append("llm_model_name")
    if payload.llm_temperature is not None:
        settings.llm_temperature = payload.llm_temperature
        env_updates["LLM_TEMPERATURE"] = str(payload.llm_temperature)
        updated.append("llm_temperature")
    if payload.llm_supports_structured_output is not None:
        settings.llm_supports_structured_output = payload.llm_supports_structured_output
        env_updates["LLM_SUPPORTS_STRUCTURED_OUTPUT"] = str(payload.llm_supports_structured_output).lower()
        updated.append("llm_supports_structured_output")
    if payload.fallback_api_key is not None:
        settings.fallback_api_key = payload.fallback_api_key
        env_updates["FALLBACK_API_KEY"] = payload.fallback_api_key
        updated.append("fallback_api_key")
    if payload.fallback_base_url is not None:
        settings.fallback_base_url = payload.fallback_base_url
        env_updates["FALLBACK_BASE_URL"] = payload.fallback_base_url
        updated.append("fallback_base_url")
    if payload.fallback_model_name is not None:
        settings.fallback_model_name = payload.fallback_model_name
        env_updates["FALLBACK_MODEL_NAME"] = payload.fallback_model_name
        updated.append("fallback_model_name")

    # 工具配置更新
    if payload.brave_api_key is not None:
        settings.brave_api_key = payload.brave_api_key
        env_updates["BRAVE_API_KEY"] = payload.brave_api_key
        updated.append("brave_api_key")
    if payload.github_token is not None:
        settings.github_token = payload.github_token
        env_updates["GITHUB_TOKEN"] = payload.github_token
        updated.append("github_token")
    if payload.openalex_email is not None:
        settings.openalex_email = payload.openalex_email
        env_updates["OPENALEX_EMAIL"] = payload.openalex_email
        updated.append("openalex_email")
    if payload.crossref_email is not None:
        settings.crossref_email = payload.crossref_email
        env_updates["CROSSREF_EMAIL"] = payload.crossref_email
        updated.append("crossref_email")

    if env_updates:
        try:
            update_env_file(env_updates)
        except Exception as e:
            logger.error(f"Failed to write to .env file: {e}")

    # 验证主模型可用性
    primary_ok = False
    try:
        model = get_model()
        primary_ok = True
    except ValueError:
        pass

    fallback_ok = get_fallback_model() is not None

    logger.info("🔧 模型配置已更新: %s", ", ".join(updated) if updated else "无变更")

    return {
        "status": "ok",
        "updated_fields": updated,
        "primary_ok": primary_ok,
        "fallback_ok": fallback_ok,
    }


# ── 积木浏览器（P6.7） ──

@app.get("/api/v1/blocks")
async def list_blocks():
    """
    列出所有已注册的积木（Agent / 交互模式 / 报告插件）。
    返回每个积木的 YAML 定义元数据。
    """
    from app.core.registry import get_registry

    registry = get_registry()
    blocks = registry.list_all()

    # 格式化输出
    result = {
        "agents": [],
        "interactions": [],
        "reports": [],
    }

    for block in blocks:
        block_type = block.get("block_type", "agent")
        # A5: 返回完整三级元数据（不再只取 6 个字段）
        entry = dict(block)  # 保留 model_dump() 的全部字段
        entry["source"] = entry.pop("_source", "builtin") if "_source" in entry else "builtin"

        if block_type == "agent":
            result["agents"].append(entry)
        elif block_type == "interaction":
            result["interactions"].append(entry)
        elif block_type == "report":
            result["reports"].append(entry)
        else:
            result["agents"].append(entry)

    return {
        "total": len(blocks),
        "agents": result["agents"],
        "interactions": result["interactions"],
        "reports": result["reports"],
    }


# ── Pipeline CRUD（P8 Phase A1-A4） ──

_PIPELINES_DIR = Path(__file__).resolve().parent / "pipelines"


class PipelineSaveRequest(BaseModel):
    """管线保存请求"""
    pipeline: dict = Field(..., description="完整的 Pipeline JSON 定义")


@app.get("/api/v1/pipelines")
async def list_pipelines():
    """A1: 列出所有管线（扫描 app/pipelines/*.json）"""
    results = []
    if _PIPELINES_DIR.is_dir():
        for f in sorted(_PIPELINES_DIR.glob("*.json")):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                results.append({
                    "filename": f.name,
                    "name": data.get("name", f.stem),
                    "description": data.get("description", ""),
                    "version": data.get("version", "1.0"),
                    "is_builtin": f.name == "standard.json",
                    "node_count": len(data.get("nodes", [])),
                    "edge_count": len(data.get("edges", [])),
                })
            except Exception as e:
                logger.warning("⚠️ 跳过管线文件 %s: %s", f.name, e)
    return {"pipelines": results, "total": len(results)}


@app.get("/api/v1/pipelines/{filename}")
async def get_pipeline(filename: str):
    """A2: 获取完整 Pipeline JSON"""
    filepath = _PIPELINES_DIR / filename
    if not filepath.is_file() or not filepath.suffix == ".json":
        raise HTTPException(status_code=404, detail=f"管线 '{filename}' 不存在")
    try:
        data = json.loads(filepath.read_text(encoding="utf-8"))
        data["_filename"] = filename
        data["_is_builtin"] = filename == "standard.json"
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取管线失败: {e}")


@app.put("/api/v1/pipelines/{filename}")
async def save_pipeline(filename: str, request: PipelineSaveRequest):
    """A3: 保存/更新自定义管线（禁止覆盖 standard.json）"""
    if filename == "standard.json":
        raise HTTPException(status_code=403, detail="禁止覆盖内置管线 standard.json")
    if not filename.endswith(".json"):
        filename += ".json"
    filepath = _PIPELINES_DIR / filename
    _PIPELINES_DIR.mkdir(parents=True, exist_ok=True)
    filepath.write_text(
        json.dumps(request.pipeline, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    logger.info("💾 管线已保存: %s", filename)
    return {"status": "saved", "filename": filename}


@app.delete("/api/v1/pipelines/{filename}")
async def delete_pipeline(filename: str):
    """A4: 删除自定义管线（禁止删除内置）"""
    if filename == "standard.json":
        raise HTTPException(status_code=403, detail="禁止删除内置管线")
    filepath = _PIPELINES_DIR / filename
    if not filepath.is_file():
        raise HTTPException(status_code=404, detail=f"管线 '{filename}' 不存在")
    filepath.unlink()
    logger.info("🗑️ 管线已删除: %s", filename)
    return {"status": "deleted", "filename": filename}


@app.get("/api/v1/blocks/{block_id}")
async def get_block_yaml(block_id: str):
    """获取指定积木的完整 YAML 定义"""
    from app.core.registry import get_registry

    registry = get_registry()

    # 在三类积木中查找
    meta = registry.get_agent_meta(block_id)
    if meta is None:
        meta = registry.get_interaction_meta(block_id)
    if meta is None:
        meta = registry.get_report_meta(block_id)

    if meta is None:
        raise HTTPException(status_code=404, detail=f"积木 '{block_id}' 不存在")

    return meta.model_dump()


# ── Tools API（P8 Phase A6） ──

@app.get("/api/v1/tools")
async def list_tools():
    """A6: 列出所有已注册工具的 ToolDescriptor"""
    from app.core.tool_registry import get_tool_registry

    registry = get_tool_registry()
    descriptors = registry.list_descriptors()
    return {
        "tools": [d.model_dump() for d in descriptors],
        "total": len(descriptors),
    }


# ── Tool CRUD（Settings Enhancement） ──

_APP_DIR = Path(__file__).resolve().parent
_TOOLS_DIR = _APP_DIR / "tools"


class ToolSaveRequest(BaseModel):
    """工具创建/更新请求"""
    yaml_content: str = Field(..., description="完整的工具 YAML 内容")


@app.get("/api/v1/tools/{tool_id}")
async def get_tool(tool_id: str):
    """获取指定工具的描述"""
    from app.core.tool_registry import get_tool_registry
    registry = get_tool_registry()
    desc = registry.get_descriptor(tool_id)
    if desc is None:
        raise HTTPException(status_code=404, detail=f"工具 '{tool_id}' 不存在")
    return desc.model_dump()


@app.post("/api/v1/tools")
async def create_tool(request: ToolSaveRequest):
    """创建新工具 YAML → 写入 _custom/ → 热加载"""
    import yaml as _yaml
    try:
        data = _yaml.safe_load(request.yaml_content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"YAML 解析失败: {e}")

    tool_id = data.get("id")
    if not tool_id:
        raise HTTPException(status_code=400, detail="YAML 中缺少 'id' 字段")

    custom_dir = _TOOLS_DIR / "_custom"
    custom_dir.mkdir(parents=True, exist_ok=True)
    filepath = custom_dir / f"{tool_id}.yaml"
    if filepath.exists():
        raise HTTPException(status_code=409, detail=f"工具 '{tool_id}' 已存在")

    filepath.write_text(request.yaml_content, encoding="utf-8")

    from app.core.tool_registry import get_tool_registry
    registry = get_tool_registry()
    registry.scan(_TOOLS_DIR)

    logger.info("🔧 工具已创建: %s", tool_id)
    return {"status": "created", "id": tool_id}


@app.put("/api/v1/tools/{tool_id}")
async def update_tool(tool_id: str, request: ToolSaveRequest):
    """更新工具 YAML（仅 _custom 目录）"""
    builtin_path = _TOOLS_DIR / "_builtin" / f"{tool_id}.yaml"
    if builtin_path.exists():
        raise HTTPException(status_code=403, detail="禁止修改内置工具")

    custom_path = _TOOLS_DIR / "_custom" / f"{tool_id}.yaml"
    if not custom_path.exists():
        raise HTTPException(status_code=404, detail=f"自定义工具 '{tool_id}' 不存在")

    import yaml as _yaml
    try:
        _yaml.safe_load(request.yaml_content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"YAML 解析失败: {e}")

    custom_path.write_text(request.yaml_content, encoding="utf-8")

    from app.core.tool_registry import get_tool_registry
    registry = get_tool_registry()
    registry.scan(_TOOLS_DIR)

    logger.info("🔧 工具已更新: %s", tool_id)
    return {"status": "updated", "id": tool_id}


@app.delete("/api/v1/tools/{tool_id}")
async def delete_tool(tool_id: str):
    """删除自定义工具（禁删内置）"""
    builtin_path = _TOOLS_DIR / "_builtin" / f"{tool_id}.yaml"
    if builtin_path.exists():
        raise HTTPException(status_code=403, detail="禁止删除内置工具")

    custom_path = _TOOLS_DIR / "_custom" / f"{tool_id}.yaml"
    if not custom_path.exists():
        raise HTTPException(status_code=404, detail=f"自定义工具 '{tool_id}' 不存在")

    custom_path.unlink()

    from app.core.tool_registry import get_tool_registry
    registry = get_tool_registry()
    registry.scan(_TOOLS_DIR)

    logger.info("🔧 工具已删除: %s", tool_id)
    return {"status": "deleted", "id": tool_id}


@app.get("/api/v1/tools/{tool_id}/export")
async def export_tool(tool_id: str):
    """导出工具 YAML 文件下载"""
    for sub in ["_custom", "_builtin"]:
        filepath = _TOOLS_DIR / sub / f"{tool_id}.yaml"
        if filepath.exists():
            return FileResponse(
                path=str(filepath),
                filename=f"{tool_id}.yaml",
                media_type="application/x-yaml",
            )
    raise HTTPException(status_code=404, detail=f"工具 '{tool_id}' 不存在")


@app.post("/api/v1/tools/import")
async def import_tool(file: UploadFile = File(...)):
    """导入 YAML 文件 → 校验 → 写入 _custom/ → 热加载"""
    content = await file.read()
    yaml_str = content.decode("utf-8")

    import yaml as _yaml
    try:
        data = _yaml.safe_load(yaml_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"YAML 解析失败: {e}")

    tool_id = data.get("id")
    if not tool_id:
        raise HTTPException(status_code=400, detail="YAML 中缺少 'id' 字段")

    custom_dir = _TOOLS_DIR / "_custom"
    custom_dir.mkdir(parents=True, exist_ok=True)
    filepath = custom_dir / f"{tool_id}.yaml"
    filepath.write_text(yaml_str, encoding="utf-8")

    from app.core.tool_registry import get_tool_registry
    registry = get_tool_registry()
    registry.scan(_TOOLS_DIR)

    logger.info("📥 工具已导入: %s (from %s)", tool_id, file.filename)
    return {"status": "imported", "id": tool_id, "name": data.get("name")}


# ── Block CRUD（P8 Phase G1 + G10b） ──


class BlockSaveRequest(BaseModel):
    """积木创建/更新请求"""
    yaml_content: str = Field(..., description="完整的 YAML 内容")


@app.post("/api/v1/blocks/{block_type}")
async def create_block(block_type: str, request: BlockSaveRequest):
    """G1: 创建新积木 YAML → 写入 _custom/ → 热加载到 Registry"""
    if block_type not in ("agents", "interactions", "reports"):
        raise HTTPException(status_code=400, detail=f"不支持的积木类型: {block_type}")

    import yaml as _yaml
    try:
        data = _yaml.safe_load(request.yaml_content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"YAML 解析失败: {e}")

    block_id = data.get("id")
    if not block_id:
        raise HTTPException(status_code=400, detail="YAML 缺少 id 字段")

    custom_dir = _APP_DIR / block_type / "_custom"
    custom_dir.mkdir(parents=True, exist_ok=True)
    filepath = custom_dir / f"{block_id}.yaml"
    if filepath.exists():
        raise HTTPException(status_code=409, detail=f"积木 '{block_id}' 已存在，请用 PUT 更新")

    filepath.write_text(request.yaml_content, encoding="utf-8")

    # 热加载到 Registry
    from app.core.registry import get_registry
    registry = get_registry()
    registry.scan(_APP_DIR)

    logger.info("✅ 积木已创建: %s/%s", block_type, block_id)
    return {"status": "created", "block_type": block_type, "id": block_id}


@app.put("/api/v1/blocks/{block_type}/{block_id}")
async def update_block(block_type: str, block_id: str, request: BlockSaveRequest):
    """G1: 更新积木 YAML（仅 _custom 目录）"""
    if block_type not in ("agents", "interactions", "reports"):
        raise HTTPException(status_code=400, detail=f"不支持的积木类型: {block_type}")

    # 检查是否在 _builtin 目录
    builtin_path = _APP_DIR / block_type / "_builtin" / f"{block_id}.yaml"
    if builtin_path.exists():
        raise HTTPException(status_code=403, detail="禁止修改内置积木")

    custom_dir = _APP_DIR / block_type / "_custom"
    custom_dir.mkdir(parents=True, exist_ok=True)
    filepath = custom_dir / f"{block_id}.yaml"
    filepath.write_text(request.yaml_content, encoding="utf-8")

    # 热加载
    from app.core.registry import get_registry
    registry = get_registry()
    registry.scan(_APP_DIR)

    logger.info("✅ 积木已更新: %s/%s", block_type, block_id)
    return {"status": "updated", "block_type": block_type, "id": block_id}


@app.delete("/api/v1/blocks/{block_type}/{block_id}")
async def delete_block(block_type: str, block_id: str):
    """G1: 删除自定义积木（禁删 _builtin）"""
    if block_type not in ("agents", "interactions", "reports"):
        raise HTTPException(status_code=400, detail=f"不支持的积木类型: {block_type}")

    builtin_path = _APP_DIR / block_type / "_builtin" / f"{block_id}.yaml"
    if builtin_path.exists():
        raise HTTPException(status_code=403, detail="禁止删除内置积木")

    custom_path = _APP_DIR / block_type / "_custom" / f"{block_id}.yaml"
    if not custom_path.exists():
        raise HTTPException(status_code=404, detail=f"积木 '{block_id}' 不存在")

    custom_path.unlink()

    # 热加载
    from app.core.registry import get_registry
    registry = get_registry()
    registry.scan(_APP_DIR)

    logger.info("🗑️ 积木已删除: %s/%s", block_type, block_id)
    return {"status": "deleted", "block_type": block_type, "id": block_id}


@app.get("/api/v1/blocks/{block_type}/{block_id}/export")
async def export_block(block_type: str, block_id: str):
    """G10b: 导出积木 YAML 文件下载"""
    if block_type not in ("agents", "interactions", "reports"):
        raise HTTPException(status_code=400, detail=f"不支持的积木类型: {block_type}")

    # 先查 _custom，再查 _builtin
    for sub in ["_custom", "_builtin"]:
        filepath = _APP_DIR / block_type / sub / f"{block_id}.yaml"
        if filepath.is_file():
            return FileResponse(
                str(filepath),
                media_type="application/x-yaml",
                filename=f"{block_id}.yaml",
            )

    raise HTTPException(status_code=404, detail=f"积木 '{block_id}' 不存在")


@app.post("/api/v1/blocks/{block_type}/import")
async def import_block(block_type: str, file: UploadFile = File(...)):
    """G10b: 导入 YAML 文件 → 校验 → 写入 _custom/ → 热加载"""
    if block_type not in ("agents", "interactions", "reports"):
        raise HTTPException(status_code=400, detail=f"不支持的积木类型: {block_type}")

    content = await file.read()
    yaml_str = content.decode("utf-8")

    import yaml as _yaml
    try:
        data = _yaml.safe_load(yaml_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"YAML 解析失败: {e}")

    block_id = data.get("id")
    if not block_id:
        raise HTTPException(status_code=400, detail="YAML 缺少 id 字段")
    if not data.get("name"):
        raise HTTPException(status_code=400, detail="YAML 缺少 name 字段")

    custom_dir = _APP_DIR / block_type / "_custom"
    custom_dir.mkdir(parents=True, exist_ok=True)
    filepath = custom_dir / f"{block_id}.yaml"
    filepath.write_text(yaml_str, encoding="utf-8")

    # 热加载
    from app.core.registry import get_registry
    registry = get_registry()
    registry.scan(_APP_DIR)

    logger.info("📥 积木已导入: %s/%s (from %s)", block_type, block_id, file.filename)
    return {"status": "imported", "block_type": block_type, "id": block_id, "name": data.get("name")}


# ── Standard 传统工作流分析 ──

@app.post("/api/v1/analyze")
async def analyze(request: AnalyzeRequest):
    """
    启动 Standard 传统工作流分析。

    流程：
      1. 创建新的 thread_id
      2. 初始化 GraphState
      3. 执行图直到 interrupt（human_check 前）
      4. 返回 thread_id + analyzed_intent
    """
    if standard_graph is None:
        raise HTTPException(status_code=503, detail="引擎未初始化")

    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    # 初始状态（对齐 GraphState 的全部字段）
    initial_state = {
        "user_raw_input": request.user_raw_input,
        "detection_type": request.detection_type,
        "analyzed_intent": None,
        "user_feedback": None,
        "is_confirmed": False,
        "messages": [],
        "search_history": [],
        "retrieved_context": None,
        "evaluation_results": [],
        "score_gap": 0.0,
        "debate_history": [],
        "debate_round": 0,
        "final_score": None,
        "final_judgment": None,
        "report_json": None,
        "execution_logs": [],
        "current_phase": "init",
    }

    # 执行图（会在 human_check 前中断）
    result = await standard_graph.ainvoke(initial_state, config)

    return {
        "thread_id": thread_id,
        "status": "awaiting_confirmation",
        "analyzed_intent": result.get("analyzed_intent"),
        "current_phase": result.get("current_phase", "intent_analysis"),
    }


# ── HITL 恢复 ──

@app.post("/api/v1/thread/{thread_id}/resume")
async def resume_thread(thread_id: str, request: ResumeRequest):
    """
    恢复中断的分析流程。

    支持两种操作：
      - confirm: 用户确认意图 → 图继续执行
      - revise:  用户提供修正意见 → 回到意图分析重新解析
    """
    if standard_graph is None:
        raise HTTPException(status_code=503, detail="引擎未初始化")

    config = {"configurable": {"thread_id": thread_id}}

    # 获取当前状态快照
    state_snapshot = standard_graph.get_state(config)
    if state_snapshot is None or not state_snapshot.values:
        raise HTTPException(status_code=404, detail=f"Thread {thread_id} 不存在或已完成")

    # 根据 action 更新状态
    if request.action == "confirm":
        # 用户确认 → 更新 is_confirmed
        standard_graph.update_state(
            config,
            {"is_confirmed": True},
        )
        logger.info("✅ Thread %s: 用户已确认意图", thread_id[:8])

    elif request.action == "revise":
        if not request.feedback:
            raise HTTPException(status_code=400, detail="修正操作需要提供 feedback")
        # 用户修正 → 注入 user_feedback
        standard_graph.update_state(
            config,
            {"user_feedback": request.feedback, "is_confirmed": False},
        )
        logger.info("🔄 Thread %s: 用户修正意见='%s'", thread_id[:8], request.feedback[:50])

    else:
        raise HTTPException(status_code=400, detail=f"不支持的操作: {request.action}")

    # 恢复执行（None 表示从中断点继续）
    result = await standard_graph.ainvoke(None, config)

    # 判断图是否完成
    next_state = standard_graph.get_state(config)
    is_complete = not next_state.next  # next 为空表示图已到 END

    if is_complete:
        return {
            "thread_id": thread_id,
            "status": "completed",
            "analyzed_intent": result.get("analyzed_intent"),
            "current_phase": result.get("current_phase"),
            # 评分结果
            "evaluation_results": result.get("evaluation_results", []),
            "score_gap": result.get("score_gap"),
            # 仲裁结果
            "final_score": result.get("final_score"),
            "final_judgment": result.get("final_judgment"),
            # 结构化报告
            "report_json": result.get("report_json"),
            # 执行日志
            "execution_logs": result.get("execution_logs", []),
        }
    else:
        return {
            "thread_id": thread_id,
            "status": "awaiting_confirmation",
            "analyzed_intent": result.get("analyzed_intent"),
            "current_phase": result.get("current_phase"),
        }


# ══════════════════════════════════════════════════════════════
# Phase T1: Agentic 配置 API
# ══════════════════════════════════════════════════════════════


@app.get("/api/v1/agentic/config")
async def get_agentic_config():
    """T1: 获取 Agentic Orchestrator 当前配置"""
    from app.core.orchestrator import load_agentic_config
    config = load_agentic_config()
    if not config:
        return {"error": "配置文件不存在", "config": None}
    # 返回完整 system_prompt + 摘要信息
    prompt = config.get("system_prompt", "")
    config["system_prompt_preview"] = prompt[:100] + "..." if len(prompt) > 100 else prompt
    config["system_prompt_length"] = len(prompt)
    return config


class AgenticConfigUpdate(BaseModel):
    """Agentic 配置更新请求"""
    system_prompt: str | None = None
    model: dict | None = None      # {"temperature": 0.5, "max_iterations": 30}
    tools: list[dict] | None = None  # [{"id": "...", "enabled": true/false}, ...]


@app.put("/api/v1/agentic/config")
async def update_agentic_config(payload: AgenticConfigUpdate):
    """T1: 更新 Agentic 配置并热重载 Orchestrator"""
    from app.core.orchestrator import load_agentic_config, save_agentic_config, build_agentic_graph
    global agentic_graph

    config = load_agentic_config()
    updated_fields = []

    if payload.system_prompt is not None:
        # 保存 prompt 版本历史
        old_prompt = config.get("system_prompt", "")
        if old_prompt != payload.system_prompt:
            history = config.get("prompt_history", [])
            history.append({
                "timestamp": datetime.utcnow().isoformat(),
                "content": old_prompt,
                "length": len(old_prompt),
            })
            config["prompt_history"] = history[-20:]  # 最多保留 20 个版本
        config["system_prompt"] = payload.system_prompt
        updated_fields.append("system_prompt")

    if payload.model is not None:
        config["model"] = {**config.get("model", {}), **payload.model}
        updated_fields.append("model")

    if payload.tools is not None:
        # 合并：只更新 enabled 字段
        tool_map = {t["id"]: t for t in config.get("tools", [])}
        for t in payload.tools:
            if t["id"] in tool_map:
                tool_map[t["id"]]["enabled"] = t.get("enabled", True)
        config["tools"] = list(tool_map.values())
        updated_fields.append("tools")

    save_agentic_config(config)

    # 热重载 Orchestrator
    try:
        agentic_graph = build_agentic_graph(checkpointer=MemorySaver())
        reload_ok = True
    except Exception as e:
        logger.error("❌ Agentic 热重载失败: %s", e)
        reload_ok = False

    logger.info("🔧 Agentic 配置已更新: %s (reload=%s)", ", ".join(updated_fields) if updated_fields else "无变更", reload_ok)

    return {
        "status": "ok",
        "updated_fields": updated_fields,
        "reload_ok": reload_ok,
        "enabled_tools_count": len([t for t in config.get("tools", []) if t.get("enabled")]),
    }


@app.get("/api/v1/agentic/tools")
async def list_agentic_tools():
    """T1: 列出 Orchestrator 所有可用 Tool（含描述和分组）"""
    from app.core.orchestrator import load_agentic_config
    config = load_agentic_config()
    tools = config.get("tools", [])
    return {"tools": tools, "total": len(tools)}


@app.get("/api/v1/agentic/dsl")
async def get_agentic_dsl():
    from app.core.orchestrator import load_agentic_dsl

    return load_agentic_dsl()


@app.put("/api/v1/agentic/dsl")
async def update_agentic_dsl(payload: dict):
    from app.core.orchestrator import save_agentic_dsl, build_agentic_graph

    global agentic_graph

    saved_dsl = save_agentic_dsl(payload)
    try:
        agentic_graph = build_agentic_graph(checkpointer=MemorySaver(), dsl=saved_dsl)
        reload_ok = True
    except Exception as e:
        logger.error("❌ Agentic DSL 热重载失败: %s", e, exc_info=True)
        reload_ok = False

    return {
        "status": "ok",
        "reload_ok": reload_ok,
        "dsl": saved_dsl,
    }


_AGENTIC_INTERRUPT_BEFORE_TARGETS = {"workflow.entry", "agentic.orchestrator"}
_AGENTIC_INTERRUPT_AFTER_TARGETS = {"workflow.complete", "agentic.orchestrator"}


def _agentic_runtime_view(run_state: dict[str, Any] | None) -> dict[str, Any] | None:
    if run_state is None:
        return None
    runtime_definition = run_state.get("runtime_definition", {})
    return {
        "thread_id": run_state.get("thread_id"),
        "status": run_state.get("status"),
        "pause_target": run_state.get("pause_target"),
        "pause_phase": run_state.get("pause_phase"),
        "resume_actions": run_state.get("resume_actions", []),
        "tool_policy": runtime_definition.get("tool_policy", {}),
        "dsl": runtime_definition.get("dsl", {}),
        "events": run_state.get("events", []),
        "created_at": run_state.get("created_at"),
        "updated_at": run_state.get("updated_at"),
        "error": run_state.get("error"),
    }


def _build_agentic_user_content(request_payload: dict[str, Any]) -> str:
    user_content = request_payload.get("user_raw_input", "")
    extra_instructions = request_payload.get("extra_instructions", "")
    if extra_instructions:
        user_content += f"\n\n## 用户额外指令\n{extra_instructions}"
    return user_content


def _find_agentic_interrupt_target(points: list[dict[str, Any]], supported_targets: set[str]) -> str | None:
    for point in points:
        target = point.get("target")
        if target in supported_targets:
            return target
    return None


def _extract_agentic_tool_calls(messages: list[Any]) -> list[dict[str, Any]]:
    tool_calls: list[dict[str, Any]] = []
    for msg in messages:
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tool_call in msg.tool_calls:
                tool_calls.append({
                    "tool": tool_call.get("name", "unknown"),
                    "args_preview": str(tool_call.get("args", {}))[:200],
                    "status": "completed",
                })
    return tool_calls


async def _compile_agentic_report(messages: list[Any]) -> tuple[dict[str, Any] | None, float | None]:
    try:
        from app.nodes.report_compiler import compile_report_from_messages

        compiled = await compile_report_from_messages(messages)
        if compiled is None:
            return None, None
        return compiled.model_dump(by_alias=True), compiled.report.meta.overall_score
    except Exception as compile_err:
        logger.warning("⚠️ [Agentic] Report Compiler 异常（降级为纯文本）: %s", compile_err)
        return None, None


def _save_agentic_run_snapshot(
    thread_id: str,
    user_input: str,
    tool_calls: list[dict[str, Any]],
    total_duration_ms: int,
    final_score: float | None,
    status: str,
) -> None:
    if not tool_calls:
        return
    try:
        from app.core.agentic_logger import save_run_log

        save_run_log(
            run_id=thread_id,
            user_input=user_input,
            tool_calls=[
                {
                    "tool_name": tool_call.get("tool", "unknown"),
                    "args_summary": tool_call.get("args_preview", ""),
                    "duration_ms": int(tool_call.get("duration_ms", 0)),
                    "status": tool_call.get("status", status),
                    "result_summary": tool_call.get("result_preview", "")[:200],
                }
                for tool_call in tool_calls
            ],
            total_duration_ms=total_duration_ms,
            final_score=final_score,
            status=status,
        )
    except Exception as log_err:
        logger.debug("Agentic 运行快照写入失败（非关键）: %s", log_err)


async def _execute_agentic_once(
    thread_id: str,
    request_payload: dict[str, Any],
    runtime_definition: dict[str, Any],
) -> dict[str, Any]:
    from langchain_core.messages import HumanMessage

    from app.core.orchestrator import build_agentic_graph

    graph = build_agentic_graph(
        checkpointer=MemorySaver(),
        dsl=runtime_definition.get("dsl"),
        runtime_enabled_tools=runtime_definition.get("tool_policy", {}).get("allowed_tools"),
    )
    config = {"configurable": {"thread_id": thread_id}}
    user_content = _build_agentic_user_content(request_payload)
    started_at = _time.perf_counter()

    result = await graph.ainvoke(
        {"messages": [HumanMessage(content=user_content)]},
        config=config,
    )

    total_duration_ms = round((_time.perf_counter() - started_at) * 1000)
    messages = result.get("messages", [])
    final_message = messages[-1].content if messages else "无输出"
    tool_calls = _extract_agentic_tool_calls(messages)
    report_json, final_score = await _compile_agentic_report(messages)

    payload = {
        "thread_id": thread_id,
        "mode": "agentic",
        "status": "completed",
        "final_output": final_message,
        "tool_calls_count": len(tool_calls),
        "tool_calls": tool_calls,
        "message_count": len(messages),
        "report_json": report_json,
        "final_score": final_score,
        "total_duration_ms": total_duration_ms,
    }

    _save_agentic_run_snapshot(
        thread_id=thread_id,
        user_input=request_payload.get("user_raw_input", ""),
        tool_calls=tool_calls,
        total_duration_ms=total_duration_ms,
        final_score=final_score,
        status="completed",
    )
    return payload


@app.get("/api/v1/agentic/thread/{thread_id}")
async def get_agentic_thread_runtime(thread_id: str):
    from app.core.agentic_runtime import get_agentic_run

    run_state = get_agentic_run(thread_id)
    if run_state is None:
        raise HTTPException(status_code=404, detail=f"Agentic thread {thread_id} 不存在")
    return _agentic_runtime_view(run_state)


# ── Agentic Mode（P7） ──

@app.post("/api/v1/analyze/agentic")
async def analyze_agentic(request: AnalyzeRequest):
    """
    Agentic 模式分析 — 超级 ReAct Agent 自主决策。

    与 Standard 模式的区别：
      - Standard: 固定管线拓扑，节点预定义
      - Agentic:  LLM 自主决定工具调用顺序和次数

    最小落地版：支持显式 DSL、真实 tool_policy 约束，以及 entry / complete 两类 pause-resume。
    """
    from app.core.agentic_runtime import (
        append_agentic_run_event,
        complete_agentic_run,
        create_agentic_run,
        get_agentic_run,
        mark_agentic_run_error,
        pause_agentic_run,
        update_agentic_run,
    )
    from app.core.orchestrator import get_agentic_runtime_definition

    thread_id = str(uuid.uuid4())
    request_payload = request.model_dump()
    runtime_definition = get_agentic_runtime_definition(runtime_enabled_tools=request.enabled_tools)
    create_agentic_run(thread_id, request_payload, runtime_definition)

    logger.info("🤖 [Agentic] 开始分析: thread=%s, input='%s'", thread_id, request.user_raw_input[:50])

    try:
        interrupt_before = runtime_definition.get("dsl", {}).get("interrupt_before", [])
        pause_target = _find_agentic_interrupt_target(interrupt_before, _AGENTIC_INTERRUPT_BEFORE_TARGETS)
        if pause_target:
            pause_agentic_run(thread_id, pause_target, "before_execution")
            return {
                "thread_id": thread_id,
                "mode": "agentic",
                "status": "paused",
                "waiting_for": "resume",
                "pause_target": pause_target,
                "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
            }

        update_agentic_run(thread_id, status="running")
        append_agentic_run_event(thread_id, "resumed", {"reason": "initial_run"})
        final_payload = await _execute_agentic_once(thread_id, request_payload, runtime_definition)

        interrupt_after = runtime_definition.get("dsl", {}).get("interrupt_after", [])
        pause_target = _find_agentic_interrupt_target(interrupt_after, _AGENTIC_INTERRUPT_AFTER_TARGETS)
        if pause_target:
            pause_agentic_run(thread_id, pause_target, "after_execution", final_payload)
            final_payload["status"] = "paused"
            final_payload["waiting_for"] = "resume"
            final_payload["pause_target"] = pause_target
            final_payload["runtime_state"] = _agentic_runtime_view(get_agentic_run(thread_id))
            return final_payload

        complete_agentic_run(thread_id, final_payload)
        final_payload["runtime_state"] = _agentic_runtime_view(get_agentic_run(thread_id))
        return final_payload

    except Exception as e:
        mark_agentic_run_error(thread_id, str(e))
        logger.error("❌ [Agentic] 执行失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Agentic 执行失败: {str(e)}")


@app.post("/api/v1/agentic/thread/{thread_id}/resume")
async def resume_agentic_thread(thread_id: str, request: AgenticResumeRequest):
    from app.core.agentic_runtime import (
        abort_agentic_run,
        append_agentic_run_event,
        complete_agentic_run,
        get_agentic_run,
        mark_agentic_run_error,
        pause_agentic_run,
        update_agentic_run,
    )
    from app.core.orchestrator import get_agentic_runtime_definition

    run_state = get_agentic_run(thread_id)
    if run_state is None:
        raise HTTPException(status_code=404, detail=f"Agentic thread {thread_id} 不存在")
    if run_state.get("status") != "paused":
        raise HTTPException(status_code=400, detail=f"Agentic thread {thread_id} 当前不可恢复")

    if request.action == "abort":
        abort_agentic_run(thread_id, request.feedback)
        return {
            "thread_id": thread_id,
            "mode": "agentic",
            "status": "aborted",
            "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
        }

    request_payload = run_state.get("request", {})
    if request.action == "revise_inputs":
        revised_user_input = request.revised_user_input.strip()
        if revised_user_input:
            request_payload["user_raw_input"] = revised_user_input
        if request.feedback:
            request_payload["extra_instructions"] = request.feedback
    elif request.action != "approve_and_continue":
        raise HTTPException(status_code=400, detail=f"不支持的恢复动作: {request.action}")

    runtime_definition = get_agentic_runtime_definition(runtime_enabled_tools=request.enabled_tools)
    update_agentic_run(
        thread_id,
        status="running",
        request=request_payload,
        runtime_definition=runtime_definition,
        pause_target=None,
        pause_phase=None,
    )
    append_agentic_run_event(thread_id, "resumed", {"action": request.action})

    try:
        final_payload = await _execute_agentic_once(thread_id, request_payload, runtime_definition)
        interrupt_after = runtime_definition.get("dsl", {}).get("interrupt_after", [])
        pause_target = _find_agentic_interrupt_target(interrupt_after, _AGENTIC_INTERRUPT_AFTER_TARGETS)
        if pause_target and run_state.get("pause_phase") != "after_execution":
            pause_agentic_run(thread_id, pause_target, "after_execution", final_payload)
            final_payload["status"] = "paused"
            final_payload["waiting_for"] = "resume"
            final_payload["pause_target"] = pause_target
            final_payload["runtime_state"] = _agentic_runtime_view(get_agentic_run(thread_id))
            return final_payload

        complete_agentic_run(thread_id, final_payload)
        final_payload["runtime_state"] = _agentic_runtime_view(get_agentic_run(thread_id))
        return final_payload
    except Exception as e:
        mark_agentic_run_error(thread_id, str(e))
        logger.error("❌ [Agentic] 恢复执行失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Agentic 恢复执行失败: {str(e)}")


# ══════════════════════════════════════════════════════════════
# Phase 8a: SSE 推送端点
# ══════════════════════════════════════════════════════════════

def _sse_format(event: str, data: dict) -> str:
    """格式化为 SSE 消息"""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# 管线中的已知顶层节点名称
_PIPELINE_NODES = {
    "intent_analyzer", "retrieval", "scoring",
    "debate", "arbitration", "quality_gate", "report_assembly",
}


# ── Agentic 阶段定义 (P4) ──

_AGENTIC_STAGES = [
    {"id": "intent", "label": "意图分析", "tools": ["analyze_intent"]},
    {"id": "retrieval", "label": "多源检索", "tools": ["search_openalex", "search_arxiv", "search_brave", "search_github", "search_crossref", "search_patents"]},
    {"id": "evaluation", "label": "多智能体评分", "tools": ["score_academic_scorer", "score_industry_analyst", "score_competitor_detective"]},
    {"id": "resolution", "label": "辩论与仲裁", "tools": ["run_debate", "run_arbitration"]},
    {"id": "output", "label": "报告输出", "tools": ["compile_report"]},
]

_TOOL_TO_STAGE: dict[str, str] = {}
for _stage in _AGENTIC_STAGES:
    for _tool in _stage["tools"]:
        _TOOL_TO_STAGE[_tool] = _stage["id"]


# ── Standard 模式 SSE 流 ──

@app.post("/api/v1/analyze/stream")
async def analyze_stream(request: AnalyzeRequest):
    """
    Standard 模式 SSE 流 — 推送每个节点的开始/完成事件。

    流程：
      1. 启动分析 → 推送 intent_start/intent_done
      2. 返回 thread_id → 前端调用 resume stream 继续
    """
    if standard_graph is None:
        raise HTTPException(status_code=503, detail="引擎未初始化")

    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "user_raw_input": request.user_raw_input,
        "detection_type": request.detection_type,
        "analyzed_intent": None,
        "user_feedback": None,
        "is_confirmed": False,
        "messages": [],
        "search_history": [],
        "retrieved_context": None,
        "evaluation_results": [],
        "score_gap": 0.0,
        "debate_history": [],
        "debate_round": 0,
        "final_score": None,
        "final_judgment": None,
        "report_json": None,
        "execution_logs": [],
        "current_phase": "init",
    }

    # S1.2: 节点级计时器 + 缓存
    _node_timers: dict[str, float] = {}
    _node_inputs: dict[str, dict] = {}
    _node_cache: dict[str, dict] = {}  # node_id → {inputs, outputs, duration_ms}
    _run_t0 = _time.perf_counter()

    async def event_generator() -> AsyncGenerator[str, None]:
        yield _sse_format("stream_start", {
            "thread_id": thread_id,
            "mode": "standard",
        })

        try:
            async for event in standard_graph.astream_events(
                initial_state, config=config, version="v2"
            ):
                kind = event.get("event", "")
                name = event.get("name", "")
                meta = event.get("metadata", {})
                parent_node = meta.get("langgraph_node", "")

                # ── 顶层节点 start/done ──
                if kind == "on_chain_start" and name in _PIPELINE_NODES:
                    _node_timers[name] = _time.perf_counter()
                    # 捕获输入快照
                    node_input = event.get("data", {}).get("input", {})
                    _node_inputs[name] = _safe_serialize(node_input) if isinstance(node_input, dict) else {}
                    yield _sse_format("node_start", {
                        "node": name,
                        "thread_id": thread_id,
                    })

                elif kind == "on_chain_end" and name in _PIPELINE_NODES:
                    output = event.get("data", {}).get("output", {})
                    duration_ms = round((_time.perf_counter() - _node_timers.get(name, _run_t0)) * 1000, 1)

                    summary = {}
                    if name == "intent_analyzer":
                        intent = output.get("analyzed_intent")
                        if intent:
                            summary = {
                                "core_idea": intent.get("core_idea", ""),
                                "detection_type": intent.get("detection_type", ""),
                            }
                    elif name == "scoring":
                        evals = output.get("evaluation_results", [])
                        summary = {
                            "agent_count": len(evals),
                            "score_gap": output.get("score_gap", 0),
                        }
                    elif name == "arbitration":
                        summary = {
                            "final_score": output.get("final_score"),
                            "final_judgment": output.get("final_judgment"),
                        }

                    safe_output = _safe_serialize(output) if isinstance(output, dict) else {}

                    # 缓存节点数据
                    _node_cache[name] = {
                        "inputs": _node_inputs.get(name, {}),
                        "outputs": safe_output,
                        "duration_ms": duration_ms,
                    }

                    yield _sse_format("node_done", {
                        "node": name,
                        "thread_id": thread_id,
                        "summary": summary,
                        "duration_ms": duration_ms,
                        "inputs": _node_inputs.get(name, {}),
                        "outputs": safe_output,
                    })

                # ── 节点内部工具调用（检索 ReAct 工具链等）──
                elif kind == "on_tool_start" and parent_node in _PIPELINE_NODES:
                    tool_input = event.get("data", {}).get("input", {})
                    yield _sse_format("tool_call_start", {
                        "node": parent_node,
                        "tool": name,
                        "thread_id": thread_id,
                        "args_preview": str(tool_input)[:200],
                    })

                elif kind == "on_tool_end" and parent_node in _PIPELINE_NODES:
                    output_str = str(event.get("data", {}).get("output", ""))[:300]
                    yield _sse_format("tool_call_done", {
                        "node": parent_node,
                        "tool": name,
                        "thread_id": thread_id,
                        "result_preview": output_str,
                    })

                # ── LLM token 流（各节点内 LLM 逐 token 推送）──
                elif kind == "on_chat_model_stream" and parent_node in _PIPELINE_NODES:
                    chunk = event.get("data", {}).get("chunk", None)
                    token = getattr(chunk, "content", "") if chunk else ""
                    if token:
                        yield _sse_format("llm_token", {
                            "thread_id": thread_id,
                            "node": parent_node,
                            "token": token,
                        })

                # ── 自定义事件：评分 Agent 进度 / 辩论轮次 ──
                elif kind == "on_custom_event":
                    if name == "agent_scored":
                        yield _sse_format("agent_progress", {
                            "thread_id": thread_id,
                            **event.get("data", {}),
                        })
                    elif name == "debate_round_done":
                        yield _sse_format("debate_exchange", {
                            "thread_id": thread_id,
                            **event.get("data", {}),
                        })

            # 检查是否在 HITL 处中断
            state = standard_graph.get_state(config)
            if state.next:
                yield _sse_format("hitl_interrupt", {
                    "thread_id": thread_id,
                    "analyzed_intent": state.values.get("analyzed_intent"),
                    "waiting_for": "user_confirmation",
                })
            else:
                total_ms = round((_time.perf_counter() - _run_t0) * 1000, 1)
                yield _sse_format("stream_complete", {
                    "thread_id": thread_id,
                    "status": "completed",
                    "final_score": state.values.get("final_score"),
                    "final_judgment": state.values.get("final_judgment"),
                    "report_json": state.values.get("report_json"),
                    "evaluation_results": state.values.get("evaluation_results", []),
                    "debate_history": state.values.get("debate_history", []),
                    "debate_round": state.values.get("debate_round", 0),
                    "total_duration_ms": total_ms,
                    "node_cache": _node_cache,
                })

                # S1.3: 写入运行历史
                import datetime
                run_record = {
                    "run_id": thread_id,
                    "pipeline": request.pipeline or "standard.json",
                    "user_input": request.user_raw_input[:200],
                    "mode": "standard",
                    "status": "completed",
                    "total_duration_ms": total_ms,
                    "node_count": len(_node_cache),
                    "node_cache": _node_cache,
                    "timestamp": datetime.datetime.now().isoformat(),
                }
                _debug_run_history.append(run_record)
                if len(_debug_run_history) > _MAX_HISTORY:
                    _debug_run_history.pop(0)

        except Exception as e:
            yield _sse_format("error", {
                "thread_id": thread_id,
                "message": str(e),
            })

        yield _sse_format("stream_end", {"thread_id": thread_id})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── HITL 恢复 SSE 流 ──

@app.post("/api/v1/thread/{thread_id}/resume/stream")
async def resume_stream(thread_id: str, request: ResumeRequest):
    """
    恢复 HITL 中断后的 SSE 流 — 继续推送后续节点事件。
    """
    if standard_graph is None:
        raise HTTPException(status_code=503, detail="引擎未初始化")

    config = {"configurable": {"thread_id": thread_id}}

    state_snapshot = standard_graph.get_state(config)
    if state_snapshot is None or not state_snapshot.values:
        raise HTTPException(status_code=404, detail=f"Thread {thread_id} 不存在")

    # 更新状态
    if request.action == "confirm":
        standard_graph.update_state(config, {"is_confirmed": True})
    elif request.action == "revise":
        if not request.feedback:
            raise HTTPException(status_code=400, detail="修正需要 feedback")
        standard_graph.update_state(
            config, {"user_feedback": request.feedback, "is_confirmed": False}
        )
    else:
        raise HTTPException(status_code=400, detail=f"不支持: {request.action}")

    async def event_generator() -> AsyncGenerator[str, None]:
        yield _sse_format("resume_start", {
            "thread_id": thread_id,
            "action": request.action,
        })

        try:
            async for event in standard_graph.astream_events(
                None, config=config, version="v2"
            ):
                kind = event.get("event", "")
                name = event.get("name", "")
                meta = event.get("metadata", {})
                parent_node = meta.get("langgraph_node", "")

                # ── 顶层节点 start/done ──
                if kind == "on_chain_start" and name in _PIPELINE_NODES:
                    yield _sse_format("node_start", {"node": name, "thread_id": thread_id})

                elif kind == "on_chain_end" and name in _PIPELINE_NODES:
                    output = event.get("data", {}).get("output", {})
                    summary = {}
                    if name == "scoring":
                        evals = output.get("evaluation_results", [])
                        summary = {
                            "agent_count": len(evals),
                            "score_gap": output.get("score_gap", 0),
                        }
                    elif name == "arbitration":
                        summary = {
                            "final_score": output.get("final_score"),
                            "final_judgment": output.get("final_judgment"),
                        }
                    yield _sse_format("node_done", {
                        "node": name, "thread_id": thread_id, "summary": summary,
                    })

                # ── 节点内部工具调用 ──
                elif kind == "on_tool_start" and parent_node in _PIPELINE_NODES:
                    tool_input = event.get("data", {}).get("input", {})
                    yield _sse_format("tool_call_start", {
                        "node": parent_node,
                        "tool": name,
                        "thread_id": thread_id,
                        "args_preview": str(tool_input)[:200],
                    })

                elif kind == "on_tool_end" and parent_node in _PIPELINE_NODES:
                    output_str = str(event.get("data", {}).get("output", ""))[:300]
                    yield _sse_format("tool_call_done", {
                        "node": parent_node,
                        "tool": name,
                        "thread_id": thread_id,
                        "result_preview": output_str,
                    })

                # ── LLM token 流 ──
                elif kind == "on_chat_model_stream" and parent_node in _PIPELINE_NODES:
                    chunk = event.get("data", {}).get("chunk", None)
                    token = getattr(chunk, "content", "") if chunk else ""
                    if token:
                        yield _sse_format("llm_token", {
                            "thread_id": thread_id,
                            "node": parent_node,
                            "token": token,
                        })

                # ── 自定义事件 ──
                elif kind == "on_custom_event":
                    if name == "agent_scored":
                        yield _sse_format("agent_progress", {
                            "thread_id": thread_id,
                            **event.get("data", {}),
                        })
                    elif name == "debate_round_done":
                        yield _sse_format("debate_exchange", {
                            "thread_id": thread_id,
                            **event.get("data", {}),
                        })

            # 最终状态
            final_state = standard_graph.get_state(config)
            if not final_state.next:
                yield _sse_format("stream_complete", {
                    "thread_id": thread_id,
                    "status": "completed",
                    "final_score": final_state.values.get("final_score"),
                    "final_judgment": final_state.values.get("final_judgment"),
                    "report_json": final_state.values.get("report_json"),
                    "evaluation_results": final_state.values.get("evaluation_results", []),
                    "debate_history": final_state.values.get("debate_history", []),
                    "debate_round": final_state.values.get("debate_round", 0),
                })
            else:
                yield _sse_format("hitl_interrupt", {
                    "thread_id": thread_id,
                    "analyzed_intent": final_state.values.get("analyzed_intent"),
                })

        except Exception as e:
            yield _sse_format("error", {"thread_id": thread_id, "message": str(e)})

        yield _sse_format("stream_end", {"thread_id": thread_id})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Agentic 模式 SSE 流 ──

@app.post("/api/v1/analyze/agentic/stream")
async def analyze_agentic_stream(request: AnalyzeRequest):
    """
    Agentic 模式 SSE 流 — 推送每个工具调用的实时事件。

    事件类型：
      - tool_call_start: Agent 开始调用工具
      - tool_call_done:  工具调用完成，含结果摘要
      - agent_thinking:  Agent 中间思考过程
      - stream_complete: 最终输出
    """
    from app.core.agentic_runtime import (
        append_agentic_run_event,
        complete_agentic_run,
        create_agentic_run,
        get_agentic_run,
        mark_agentic_run_error,
        pause_agentic_run,
        update_agentic_run,
    )
    from app.core.orchestrator import build_agentic_graph, get_agentic_runtime_definition
    from langchain_core.messages import HumanMessage

    thread_id = str(uuid.uuid4())
    request_payload = request.model_dump()
    runtime_definition = get_agentic_runtime_definition(runtime_enabled_tools=request.enabled_tools)
    create_agentic_run(thread_id, request_payload, runtime_definition)
    config = {"configurable": {"thread_id": thread_id}}
    user_content = _build_agentic_user_content(request_payload)

    async def event_generator() -> AsyncGenerator[str, None]:
        yield _sse_format("stream_start", {
            "thread_id": thread_id,
            "mode": "agentic",
            "enabled_tools": request.enabled_tools,
            "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
        })

        interrupt_before = runtime_definition.get("dsl", {}).get("interrupt_before", [])
        pause_target = _find_agentic_interrupt_target(interrupt_before, _AGENTIC_INTERRUPT_BEFORE_TARGETS)
        if pause_target:
            pause_agentic_run(thread_id, pause_target, "before_execution")
            yield _sse_format("hitl_interrupt", {
                "thread_id": thread_id,
                "waiting_for": "resume",
                "pause_target": pause_target,
                "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
            })
            yield _sse_format("stream_end", {"thread_id": thread_id})
            return

        graph = build_agentic_graph(
            checkpointer=MemorySaver(),
            dsl=runtime_definition.get("dsl"),
            runtime_enabled_tools=runtime_definition.get("tool_policy", {}).get("allowed_tools"),
        )
        tool_calls: list[dict[str, Any]] = []
        tool_start_times: dict[str, float] = {}
        run_started_at = _time.perf_counter()

        try:
            update_agentic_run(thread_id, status="running")
            append_agentic_run_event(thread_id, "resumed", {"reason": "initial_stream"})

            # P4: 阶段跟踪
            current_stage: str | None = None
            stage_start_times: dict[str, float] = {}
            execution_path: list[dict] = []

            async for event in graph.astream_events(
                {"messages": [HumanMessage(content=user_content)]},
                config=config,
                version="v2",
            ):
                kind = event.get("event", "")
                name = event.get("name", "")

                # 工具调用开始
                if kind == "on_tool_start":
                    tool_input = event.get("data", {}).get("input", {})
                    tool_start_times[name] = _time.perf_counter()

                    # P4: 阶段跟踪与路径更新
                    tool_stage = _TOOL_TO_STAGE.get(name)
                    if tool_stage and tool_stage != current_stage:
                        # 结束上一阶段
                        if current_stage and current_stage in stage_start_times:
                            stage_duration = round((_time.perf_counter() - stage_start_times[current_stage]) * 1000, 1)
                            yield _sse_format("stage_done", {
                                "thread_id": thread_id,
                                "stage": current_stage,
                                "duration_ms": stage_duration,
                            })
                        # 开始新阶段
                        current_stage = tool_stage
                        stage_start_times[current_stage] = _time.perf_counter()
                        yield _sse_format("stage_start", {
                            "thread_id": thread_id,
                            "stage": current_stage,
                            "stage_label": next((s["label"] for s in _AGENTIC_STAGES if s["id"] == current_stage), current_stage),
                            "tool": name,
                        })
                        # 更新执行路径
                        execution_path.append({
                            "stage": current_stage,
                            "tool": name,
                            "step": len(tool_calls) + 1,
                        })
                        yield _sse_format("path_update", {
                            "thread_id": thread_id,
                            "path": execution_path,
                            "current_stage": current_stage,
                        })

                    append_agentic_run_event(thread_id, "tool_call_start", {
                        "tool": name,
                        "args_preview": str(tool_input)[:200],
                    })
                    yield _sse_format("tool_call_start", {
                        "tool": name,
                        "thread_id": thread_id,
                        "args_preview": str(tool_input)[:200],
                        "stage": current_stage,
                    })

                # 工具调用完成
                elif kind == "on_tool_end":
                    output = event.get("data", {}).get("output", "")
                    output_str = str(output) if output else ""
                    # 辩论工具保留完整 JSON，其他工具截断
                    is_debate = name == "run_debate"
                    preview = output_str if is_debate else output_str[:800]
                    duration_ms = round((_time.perf_counter() - tool_start_times.pop(name, run_started_at)) * 1000, 1)
                    tool_calls.append({
                        "tool": name,
                        "result": output_str if is_debate else None,
                        "result_preview": preview,
                        "duration_ms": duration_ms,
                        "status": "completed",
                    })
                    append_agentic_run_event(thread_id, "tool_call_done", {
                        "tool": name,
                        "duration_ms": duration_ms,
                        "result_preview": preview[:200],
                    })
                    yield _sse_format("tool_call_done", {
                        "tool": name,
                        "thread_id": thread_id,
                        "result_preview": preview,
                        "duration_ms": duration_ms,
                        "total_calls": len(tool_calls),
                    })

                # LLM Token 流（逐 token 推送 Agent 思考过程）
                elif kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk", None)
                    token = getattr(chunk, "content", "") if chunk else ""
                    if token:
                        yield _sse_format("llm_token", {
                            "thread_id": thread_id,
                            "token": token,
                        })

                # LLM 开始生成（Agent 思考）
                elif kind == "on_chat_model_start":
                    yield _sse_format("agent_thinking", {
                        "thread_id": thread_id,
                        "step": len(tool_calls) + 1,
                    })

            # 获取最终输出
            final_state = graph.get_state(config)
            messages = final_state.values.get("messages", [])
            final_output = messages[-1].content if messages else "无输出"

            # 从 tool_calls 中提取辩论数据
            debate_history = []
            debate_round = 0
            for tc in tool_calls:
                if tc["tool"] == "run_debate" and tc.get("result"):
                    try:
                        import json as _json
                        debate_data = _json.loads(tc["result"])
                        debate_history = debate_data.get("debate_history", [])
                        debate_round = debate_data.get("debate_round", 0)
                    except Exception:
                        pass

            # ── Report Compiler: 从对话历史提取结构化报告 ──
            yield _sse_format("report_compiling", {
                "thread_id": thread_id,
                "message_count": len(messages),
            })
            report_json, final_score = await _compile_agentic_report(messages)
            total_duration_ms = round((_time.perf_counter() - run_started_at) * 1000, 1)
            final_payload = {
                "thread_id": thread_id,
                "status": "completed",
                "mode": "agentic",
                "final_output": final_output,
                "report_json": report_json,
                "final_score": final_score,
                "tool_calls_count": len(tool_calls),
                "tool_calls": [{k: v for k, v in tc.items() if k != "result"} for tc in tool_calls],
                "message_count": len(messages),
                "debate_history": debate_history,
                "debate_round": debate_round,
                "total_duration_ms": total_duration_ms,
            }

            interrupt_after = runtime_definition.get("dsl", {}).get("interrupt_after", [])
            pause_target = _find_agentic_interrupt_target(interrupt_after, _AGENTIC_INTERRUPT_AFTER_TARGETS)
            if pause_target:
                pause_agentic_run(thread_id, pause_target, "after_execution", final_payload)
                _save_agentic_run_snapshot(
                    thread_id=thread_id,
                    user_input=request.user_raw_input,
                    tool_calls=tool_calls,
                    total_duration_ms=int(total_duration_ms),
                    final_score=final_score,
                    status="interrupted",
                )
                yield _sse_format("hitl_interrupt", {
                    "thread_id": thread_id,
                    "waiting_for": "resume",
                    "pause_target": pause_target,
                    "pending_result": {
                        "final_score": final_score,
                        "tool_calls_count": len(tool_calls),
                    },
                    "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
                })
            else:
                # P4: 结束当前阶段
                if current_stage and current_stage in stage_start_times:
                    stage_duration = round((_time.perf_counter() - stage_start_times[current_stage]) * 1000, 1)
                    yield _sse_format("stage_done", {
                        "thread_id": thread_id,
                        "stage": current_stage,
                        "duration_ms": stage_duration,
                    })

                complete_agentic_run(thread_id, final_payload)
                _save_agentic_run_snapshot(
                    thread_id=thread_id,
                    user_input=request.user_raw_input,
                    tool_calls=tool_calls,
                    total_duration_ms=int(total_duration_ms),
                    final_score=final_score,
                    status="completed",
                )

                # P4: 运行摘要
                stage_durations = {}
                for stage_id, start_time in stage_start_times.items():
                    stage_durations[stage_id] = round((_time.perf_counter() - start_time) * 1000, 1)

                yield _sse_format("run_summary", {
                    "thread_id": thread_id,
                    "status": "completed",
                    "total_duration_ms": total_duration_ms,
                    "tool_calls_count": len(tool_calls),
                    "execution_path": execution_path,
                    "stage_durations": stage_durations,
                    "final_score": final_score,
                })

                yield _sse_format("stream_complete", {
                    **final_payload,
                    "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
                })

        except Exception as e:
            mark_agentic_run_error(thread_id, str(e))
            yield _sse_format("error", {
                "thread_id": thread_id,
                "message": str(e),
                "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
            })

        yield _sse_format("stream_end", {"thread_id": thread_id})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/v1/agentic/thread/{thread_id}/resume/stream")
async def resume_agentic_stream(thread_id: str, request: AgenticResumeRequest):
    from app.core.agentic_runtime import (
        abort_agentic_run,
        append_agentic_run_event,
        complete_agentic_run,
        get_agentic_run,
        mark_agentic_run_error,
        pause_agentic_run,
        update_agentic_run,
    )
    from app.core.orchestrator import get_agentic_runtime_definition

    run_state = get_agentic_run(thread_id)
    if run_state is None:
        raise HTTPException(status_code=404, detail=f"Agentic thread {thread_id} 不存在")
    if run_state.get("status") != "paused":
        raise HTTPException(status_code=400, detail=f"Agentic thread {thread_id} 当前不可恢复")

    async def event_generator() -> AsyncGenerator[str, None]:
        yield _sse_format("resume_start", {
            "thread_id": thread_id,
            "action": request.action,
            "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
        })

        if request.action == "abort":
            abort_agentic_run(thread_id, request.feedback)
            yield _sse_format("stream_complete", {
                "thread_id": thread_id,
                "mode": "agentic",
                "status": "aborted",
                "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
            })
            yield _sse_format("stream_end", {"thread_id": thread_id})
            return

        request_payload = dict(run_state.get("request", {}))
        if request.action == "revise_inputs":
            revised_user_input = request.revised_user_input.strip()
            if revised_user_input:
                request_payload["user_raw_input"] = revised_user_input
            if request.feedback:
                request_payload["extra_instructions"] = request.feedback
        elif request.action != "approve_and_continue":
            yield _sse_format("error", {
                "thread_id": thread_id,
                "message": f"不支持的恢复动作: {request.action}",
                "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
            })
            yield _sse_format("stream_end", {"thread_id": thread_id})
            return

        if run_state.get("pause_phase") == "after_execution" and request.action == "approve_and_continue":
            final_payload = run_state.get("final_payload") or {
                "thread_id": thread_id,
                "mode": "agentic",
                "status": "completed",
            }
            complete_agentic_run(thread_id, final_payload)
            yield _sse_format("stream_complete", {
                **final_payload,
                "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
            })
            yield _sse_format("stream_end", {"thread_id": thread_id})
            return

        runtime_definition = get_agentic_runtime_definition(runtime_enabled_tools=request.enabled_tools)
        update_agentic_run(
            thread_id,
            status="running",
            request=request_payload,
            runtime_definition=runtime_definition,
            pause_target=None,
            pause_phase=None,
        )
        append_agentic_run_event(thread_id, "resumed", {"action": request.action, "mode": "stream"})

        try:
            final_payload = await _execute_agentic_once(thread_id, request_payload, runtime_definition)
            interrupt_after = runtime_definition.get("dsl", {}).get("interrupt_after", [])
            pause_target = _find_agentic_interrupt_target(interrupt_after, _AGENTIC_INTERRUPT_AFTER_TARGETS)
            if pause_target and run_state.get("pause_phase") != "after_execution":
                pause_agentic_run(thread_id, pause_target, "after_execution", final_payload)
                yield _sse_format("hitl_interrupt", {
                    "thread_id": thread_id,
                    "waiting_for": "resume",
                    "pause_target": pause_target,
                    "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
                })
            else:
                complete_agentic_run(thread_id, final_payload)
                yield _sse_format("stream_complete", {
                    **final_payload,
                    "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
                })
        except Exception as e:
            mark_agentic_run_error(thread_id, str(e))
            yield _sse_format("error", {
                "thread_id": thread_id,
                "message": str(e),
                "runtime_state": _agentic_runtime_view(get_agentic_run(thread_id)),
            })

        yield _sse_format("stream_end", {"thread_id": thread_id})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ══════════════════════════════════════════════════════════════
# Phase S1: Studio 调试 API（对标 Dify）
# ══════════════════════════════════════════════════════════════

# 节点函数注册表：node_id → async callable(state) -> dict
_NODE_FUNCTIONS: dict[str, Any] = {}


def _ensure_node_functions():
    """延迟初始化节点函数注册表"""
    if _NODE_FUNCTIONS:
        return
    from app.nodes.intent import intent_analysis_node
    from app.nodes.retrieval import retrieval_node
    from app.nodes.scoring import scoring_node
    from app.nodes.debate import debate_node
    from app.nodes.arbitration import arbitration_node
    from app.nodes.quality import quality_gate_node
    from app.nodes.report import report_assembly_node
    from app.graph import human_check_node

    _NODE_FUNCTIONS.update({
        "intent_analyzer": intent_analysis_node,
        "human_check": human_check_node,
        "retrieval": retrieval_node,
        "scoring": scoring_node,
        "debate": debate_node,
        "arbitration": arbitration_node,
        "quality_gate": quality_gate_node,
        "report_assembly": report_assembly_node,
    })


# 运行历史存储（内存，重启后清空）
_debug_run_history: list[dict] = []
_MAX_HISTORY = 50


class DebugNodeRequest(BaseModel):
    """单节点调试请求"""
    node_id: str = Field(..., description="要执行的节点 ID，如 intent_analyzer")
    inputs: dict = Field(default_factory=dict, description="注入的 State 字段（覆盖默认空值）")
    config: dict = Field(default_factory=dict, description="节点运行时配置覆盖")


@app.post("/api/v1/debug/node")
async def debug_node(request: DebugNodeRequest):
    """
    S1.1: 单节点独立执行 — 对标 Dify Step Run。

    传入 node_id + inputs（模拟 State），只执行该节点，返回 outputs + 耗时 + 日志。
    """
    _ensure_node_functions()

    func = _NODE_FUNCTIONS.get(request.node_id)
    if func is None:
        raise HTTPException(
            status_code=404,
            detail=f"未知节点: '{request.node_id}'。可用节点: {list(_NODE_FUNCTIONS.keys())}",
        )

    # 构建最小 State（用默认空值填充所有 GraphState 字段）
    from app.state import GraphState
    import typing

    # 提取 GraphState 的所有字段及默认值
    state: dict[str, Any] = {
        "user_raw_input": "",
        "detection_type": "auto",
        "analyzed_intent": None,
        "user_feedback": None,
        "is_confirmed": False,
        "messages": [],
        "search_history": [],
        "retrieved_context": None,
        "evaluation_results": [],
        "score_gap": 0.0,
        "debate_history": [],
        "debate_round": 0,
        "final_score": None,
        "final_judgment": None,
        "report_json": None,
        "execution_logs": [],
        "current_phase": "debug",
    }

    # 用用户提供的 inputs 覆盖
    state.update(request.inputs)

    t0 = _time.perf_counter()
    logs: list[str] = []

    try:
        result = await func(state)
        duration_ms = round((_time.perf_counter() - t0) * 1000, 1)
        logs.append(f"✅ 节点 {request.node_id} 执行完成 ({duration_ms}ms)")

        # 序列化安全检查
        safe_result = _safe_serialize(result)
        safe_inputs = _safe_serialize(request.inputs)

        return {
            "status": "ok",
            "node_id": request.node_id,
            "outputs": safe_result,
            "inputs_echo": safe_inputs,
            "duration_ms": duration_ms,
            "logs": logs,
        }

    except Exception as e:
        duration_ms = round((_time.perf_counter() - t0) * 1000, 1)
        logger.error("❌ [Debug] 节点 %s 执行失败: %s", request.node_id, e, exc_info=True)
        return {
            "status": "error",
            "node_id": request.node_id,
            "error": str(e),
            "duration_ms": duration_ms,
            "logs": [f"❌ {e}"],
        }


def _safe_serialize(obj: Any) -> Any:
    """递归安全序列化（处理不可 JSON 序列化的对象）"""
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, dict):
        return {k: _safe_serialize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_safe_serialize(i) for i in obj]
    # BaseMessage 等 LangChain 对象
    if hasattr(obj, "content"):
        return {"type": type(obj).__name__, "content": str(obj.content)[:500]}
    return str(obj)[:500]


@app.get("/api/v1/debug/history")
async def debug_history(limit: int = 20):
    """S1.3: 获取最近的管线调试运行记录"""
    items = _debug_run_history[-limit:]
    items.reverse()  # 最新在前
    return {"runs": items, "total": len(_debug_run_history)}


@app.get("/api/v1/debug/history/{run_id}")
async def debug_history_detail(run_id: str):
    """S1.3: 获取某次运行的完整节点缓存数据"""
    for run in _debug_run_history:
        if run.get("run_id") == run_id:
            return run
    raise HTTPException(status_code=404, detail=f"运行记录 '{run_id}' 不存在")


@app.get("/api/v1/debug/nodes")
async def list_debug_nodes():
    """列出所有可独立调试的节点及其输入/输出声明"""
    _ensure_node_functions()
    from app.core.registry import get_block_registry
    registry = get_block_registry()

    nodes = []
    for node_id in _NODE_FUNCTIONS:
        info: dict[str, Any] = {"id": node_id, "inputs": [], "outputs": []}
        # 尝试从 Registry 获取元数据
        meta = registry.get_agent_meta(node_id)
        if meta:
            info["name"] = meta.name
            info["inputs"] = meta.inputs
            info["outputs"] = meta.outputs
            info["category"] = meta.category
        else:
            info["name"] = node_id
        nodes.append(info)
    return {"nodes": nodes}


# ══════════════════════════════════════════════════════════════
# 论文引用段落生成
# ══════════════════════════════════════════════════════════════

class CitationRequest(BaseModel):
    evidence_items: list[dict] = Field(description="选中的证据条目列表")
    topic: str = Field(default="", description="研究主题（可选）")


@app.post("/api/v1/citation/generate")
async def generate_citation(request: CitationRequest):
    """一键生成论文引用段落 — SSE 流式返回"""
    from typing import AsyncGenerator
    from app.prompts.citation import CITATION_SYSTEM_PROMPT, build_citation_prompt
    from langchain_core.messages import SystemMessage, HumanMessage

    if not request.evidence_items:
        raise HTTPException(status_code=400, detail="至少需要一条证据")

    model = get_model(temperature=0.3)
    prompt = build_citation_prompt(request.evidence_items, request.topic)

    async def event_generator() -> AsyncGenerator[str, None]:
        yield _sse_format("citation_start", {
            "evidence_count": len(request.evidence_items),
        })

        try:
            full_text = ""
            async for chunk in model.astream([
                SystemMessage(content=CITATION_SYSTEM_PROMPT),
                HumanMessage(content=prompt),
            ]):
                token = chunk.content if hasattr(chunk, "content") else str(chunk)
                if token:
                    full_text += token
                    yield _sse_format("citation_token", {"token": token})

            yield _sse_format("citation_complete", {
                "text": full_text,
            })
        except Exception as e:
            yield _sse_format("error", {"message": str(e)})

        yield _sse_format("stream_end", {})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ══════════════════════════════════════════════════════════════
# S7: DesignAssistant — 对话式设计助手 LLM 端点
# ══════════════════════════════════════════════════════════════

class AssistantChatRequest(BaseModel):
    message: str
    context: dict | None = None      # 画布上下文（节点列表、边等）
    mode: str = "standard"           # standard | agentic
    history: list[dict] | None = None  # 对话历史 [{role, content}]

_ASSISTANT_SYSTEM_PROMPT = """你是 Novoscan Studio 的 AI 设计助手。你帮助用户设计和优化创新性检测管线。

你的能力包括：
- 解释管线中各节点的作用和配置
- 建议管线拓扑优化方案
- 帮助创建新的 Agent 积木配置（YAML 格式）
- 诊断工具调用链路问题
- 预估 Token 消耗
- 生成 Prompt 模板

当前模式: {mode}
{context_info}

请用简洁专业的中文回复，必要时使用 Markdown 格式和代码块。"""


# ── Studio Agent Tool 友好名映射 ──
_TOOL_LABELS: dict[str, str] = {
    "create_agent": "创建 Agent",
    "create_interaction": "创建交互模式",
    "create_report": "创建报告插件",
    "modify_block": "修改积木",
    "create_pipeline": "创建管线",
    "list_blocks": "查看积木列表",
    "validate_yaml": "校验 YAML",
    "dry_run_pipeline": "试运行管线",
    # P10a-S6: Agentic 调优 Tool
    "read_agentic_config": "读取 Agentic 配置",
    "update_agentic_config": "修改 Agentic 配置",
    "diagnose_agentic": "诊断 Agentic 配置",
    "dry_run_agentic": "试运行 Agentic",
    "get_agentic_run_logs": "获取执行日志",
}


def _extract_result_summary(tool_name: str, raw_output: str) -> str:
    """从 Tool 输出中提取一句话友好摘要。"""
    try:
        parsed = json.loads(raw_output)
        if isinstance(parsed, dict):
            status = parsed.get("status", "")
            block_id = parsed.get("id", parsed.get("filename", ""))
            if status == "created":
                return f"已创建 {block_id}" if block_id else "创建成功"
            if status == "updated":
                return f"已更新 {block_id}" if block_id else "更新成功"
            if status == "validation_error":
                return f"校验失败: {parsed.get('message', '')[:80]}"
            if status == "error":
                return f"错误: {parsed.get('message', '')[:80]}"
            # validate_yaml
            if "valid" in parsed:
                return "校验通过 ✅" if parsed["valid"] else f"校验失败: {', '.join(parsed.get('errors', [])[:2])}"
            # dry_run
            if "topology" in parsed:
                topo = parsed["topology"]
                return f"拓扑: {topo.get('total_nodes', '?')} 节点, {topo.get('total_edges', '?')} 边"
            # ── Agentic Tool 摘要 ──
            if status == "no_change":
                return "无配置变更"
            if "changes" in parsed and isinstance(parsed["changes"], list):
                changes = parsed["changes"]
                reload = "✅" if parsed.get("reload_ok") else "❌"
                return f"已修改: {', '.join(changes[:4])} {reload}"
            if status == "diagnosed":
                w = len(parsed.get("warnings", []))
                s = len(parsed.get("suggestions", []))
                return f"诊断完成: {w} 警告, {s} 建议"
            if status == "dry_run_ok":
                steps = parsed.get("total_steps", 0)
                tokens = parsed.get("estimated_total_tokens", 0)
                return f"模拟成功: {steps} 步, ~{tokens:,} tokens"
            if parsed.get("has_log") is False:
                return "暂无执行记录"
            if parsed.get("has_log") is True:
                tc = parsed.get("tool_count", 0)
                dur = parsed.get("total_duration_ms", 0)
                return f"最近执行: {tc} 工具, {dur}ms"
    except (json.JSONDecodeError, TypeError, AttributeError):
        pass
    # list_blocks 等纯文本输出
    first_line = raw_output.split("\n")[0][:80]
    return first_line


def _format_args_summary(tool_input: dict | str) -> str:
    """将 Tool 输入格式化为简洁的参数摘要。"""
    if isinstance(tool_input, str):
        try:
            tool_input = json.loads(tool_input)
        except (json.JSONDecodeError, TypeError):
            return str(tool_input)[:120]
    if isinstance(tool_input, dict):
        parts = []
        for k, v in list(tool_input.items())[:4]:
            sv = str(v)
            if len(sv) > 30:
                sv = sv[:27] + "..."
            parts.append(f"{k}: {sv}")
        return ", ".join(parts)
    return str(tool_input)[:120]


@app.post("/api/v1/assistant/chat")
async def assistant_chat_stream(request: AssistantChatRequest):
    """
    DesignAssistant LLM 对话 — SSE 流式返回。

    事件类型：
      - token:        逐 token 推送（LLM 文本）
      - tool_call:    Agent 调用工具（工具名 + 参数摘要）
      - tool_done:    工具返回结果（成功/失败 + 摘要）
      - yaml_preview: 生成的 YAML/JSON 预览（供前端渲染卡片）
      - done:         生成完成
      - error:        错误
      - stream_end:   流结束
    """
    from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

    # ── 1. 尝试构建 Studio ReAct Agent ──
    studio_agent = None
    try:
        from app.core.studio_agent import build_studio_agent
        studio_agent = build_studio_agent(canvas_context=request.context, mode=request.mode)
    except Exception as e:
        logger.warning("Studio Agent 构建失败，降级到裸 LLM: %s", e)

    # ── 2. Agent 模式：ReAct Agent 流式执行 ──
    if studio_agent is not None:
        messages = []
        if request.history:
            for h in request.history[-10:]:
                if h.get("role") == "user":
                    messages.append(HumanMessage(content=h["content"]))
                elif h.get("role") == "assistant":
                    messages.append(AIMessage(content=h["content"]))
        messages.append(HumanMessage(content=request.message))

        async def agent_event_generator():
            import time as _time
            full_content = ""
            thinking_started = False
            thinking_start_ts = 0.0
            tool_start_times: dict[str, float] = {}
            agentic_tool_log: list[dict] = []  # S7: Agentic 执行日志收集
            try:
                async for event in studio_agent.astream_events(
                    {"messages": messages},
                    version="v2",
                ):
                    kind = event.get("event", "")

                    # ── Thinking 阶段跟踪 ──
                    if kind == "on_chat_model_start" and not thinking_started:
                        thinking_started = True
                        thinking_start_ts = _time.monotonic()
                        yield _sse_format("thinking", {"status": "start"})

                    if kind == "on_chat_model_stream":
                        chunk = event.get("data", {}).get("chunk")
                        token = getattr(chunk, "content", "") if chunk else ""
                        if token:
                            # Thinking 结束（首个实质 token）
                            if thinking_started:
                                dur = int((_time.monotonic() - thinking_start_ts) * 1000)
                                yield _sse_format("thinking", {"status": "end", "duration_ms": dur})
                                thinking_started = False
                            full_content += token
                            yield _sse_format("token", {"token": token})

                    elif kind == "on_tool_start":
                        # Thinking 在 tool_call 前也要结束
                        if thinking_started:
                            dur = int((_time.monotonic() - thinking_start_ts) * 1000)
                            yield _sse_format("thinking", {"status": "end", "duration_ms": dur})
                            thinking_started = False

                        tool_name = event.get("name", "")
                        tool_input = event.get("data", {}).get("input", {})
                        tool_start_times[tool_name] = _time.monotonic()
                        yield _sse_format("tool_call", {
                            "tool_name": tool_name,
                            "tool_label": _TOOL_LABELS.get(tool_name, tool_name),
                            "args_summary": _format_args_summary(tool_input),
                            "args": tool_input if isinstance(tool_input, dict) else {},
                        })

                    elif kind == "on_tool_end":
                        tool_name = event.get("name", "")
                        raw_output = str(event.get("data", {}).get("output", ""))
                        # 计算耗时
                        duration_ms = 0
                        if tool_name in tool_start_times:
                            duration_ms = int((_time.monotonic() - tool_start_times.pop(tool_name)) * 1000)

                        result_summary = _extract_result_summary(tool_name, raw_output)
                        has_preview = False

                        # 检查输出中是否含 yaml_preview/json_preview
                        try:
                            parsed = json.loads(raw_output)
                            if isinstance(parsed, dict):
                                preview_content = parsed.get("yaml_preview") or parsed.get("json_preview")
                                if preview_content:
                                    has_preview = True
                                    yield _sse_format("yaml_preview", {
                                        "block_type": parsed.get("block_type", "agent"),
                                        "block_id": parsed.get("id", parsed.get("filename", "")),
                                        "content": preview_content,
                                        "tool_name": tool_name,
                                    })
                                # ── config_preview: Agentic 配置变更预览 ──
                                if tool_name == "update_agentic_config" and parsed.get("config_preview"):
                                    has_preview = True
                                    yield _sse_format("config_preview", {
                                        "changes": parsed.get("changes", []),
                                        "warnings": parsed.get("warnings", []),
                                        "reload_ok": parsed.get("reload_ok", False),
                                        "config_snapshot": parsed.get("config_preview", {}),
                                    })
                        except (json.JSONDecodeError, TypeError):
                            pass

                        yield _sse_format("tool_done", {
                            "tool_name": tool_name,
                            "tool_label": _TOOL_LABELS.get(tool_name, tool_name),
                            "success": True,
                            "result_summary": result_summary,
                            "duration_ms": duration_ms,
                            "has_preview": has_preview,
                            "result_detail": raw_output[:2000],
                        })

                        # S7: 收集 Agentic 工具调用日志
                        if request.mode == "agentic":
                            agentic_tool_log.append({
                                "tool_name": tool_name,
                                "duration_ms": duration_ms,
                                "status": "completed",
                                "result_summary": result_summary[:200],
                            })

                        # 下一轮 thinking 重置
                        thinking_started = False
                        thinking_start_ts = _time.monotonic()

                yield _sse_format("done", {"content": full_content})

                # ── Agentic 执行日志记录（S7） ──
                if request.mode == "agentic" and agentic_tool_log:
                    try:
                        from app.core.agentic_logger import save_run_log
                        import uuid
                        total_dur = sum(t.get("duration_ms", 0) for t in agentic_tool_log)
                        save_run_log(
                            run_id=str(uuid.uuid4())[:12],
                            user_input=request.message,
                            tool_calls=agentic_tool_log,
                            total_duration_ms=total_dur,
                            status="completed",
                        )
                    except Exception as log_err:
                        logger.debug("Agentic 日志记录失败（非关键）: %s", log_err)
            except Exception as e:
                logger.error("Studio Agent 执行异常: %s", e, exc_info=True)
                yield _sse_format("error", {"message": str(e)})
            yield _sse_format("stream_end", {})

        return StreamingResponse(
            agent_event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # ── 3. 降级模式：裸 LLM 流式对话（与 P8 兼容） ──
    try:
        model = get_model(temperature=0.7)
    except Exception as e:
        return StreamingResponse(
            iter([_sse_format("error", {"message": f"模型未配置: {str(e)}"}),
                  _sse_format("stream_end", {})]),
            media_type="text/event-stream",
        )

    context_info = ""
    if request.context:
        nodes = request.context.get("nodes", [])
        edges = request.context.get("edges", [])
        if nodes:
            context_info = f"\n当前画布有 {len(nodes)} 个节点、{len(edges)} 条边。"
            node_names = [n.get("label", n.get("id", "?")) for n in nodes[:20]]
            context_info += f"\n节点列表: {', '.join(node_names)}"

    system_prompt = _ASSISTANT_SYSTEM_PROMPT.format(
        mode=request.mode,
        context_info=context_info,
    )

    messages = [SystemMessage(content=system_prompt)]
    if request.history:
        for h in request.history[-10:]:
            if h.get("role") == "user":
                messages.append(HumanMessage(content=h["content"]))
            elif h.get("role") == "assistant":
                messages.append(AIMessage(content=h["content"]))
    messages.append(HumanMessage(content=request.message))

    async def event_generator():
        full_content = ""
        try:
            async for chunk in model.astream(messages):
                token = chunk.content if hasattr(chunk, "content") else ""
                if token:
                    full_content += token
                    yield _sse_format("token", {"token": token})

            yield _sse_format("done", {"content": full_content})
        except Exception as e:
            yield _sse_format("error", {"message": str(e)})
        yield _sse_format("stream_end", {})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ══════════════════════════════════════════════════════════════
# 生产模式：服务前端静态文件
# ══════════════════════════════════════════════════════════════

_FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "web" / "dist"

if _FRONTEND_DIST.is_dir():
    _ASSETS_DIR = _FRONTEND_DIST / "assets"
    if _ASSETS_DIR.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_ASSETS_DIR)), name="frontend-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """SPA 路由回退 — 让 React Router 处理前端路由"""
        file_path = _FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(_FRONTEND_DIST / "index.html"))
