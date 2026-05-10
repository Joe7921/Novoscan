"""
Novoscan-Open-Core — Agentic 执行日志记录器 (Phase P10a-S7)

对标 AgentOps Session Replay + LangSmith Trace，
每次 Agentic 执行完成后将工具调用链、耗时、Token 消耗写入本地文件，
供 Studio Agent 的 get_agentic_run_logs Tool 读取。

存储路径: app/pipelines/.agentic_runs/
文件结构:
  latest.json       — 最近一次执行日志
  history/{ts}.json — 历史执行日志（最多保留 20 条）
"""

from __future__ import annotations

import json as _json
import logging
import time as _time
from pathlib import Path
from typing import Any

logger = logging.getLogger("novoscan.agentic_logger")

_RUNS_DIR = Path(__file__).resolve().parent.parent / "pipelines" / ".agentic_runs"
_LATEST_PATH = _RUNS_DIR / "latest.json"
_HISTORY_DIR = _RUNS_DIR / "history"
_MAX_HISTORY = 20


def _ensure_dirs() -> None:
    _RUNS_DIR.mkdir(parents=True, exist_ok=True)
    _HISTORY_DIR.mkdir(parents=True, exist_ok=True)


def save_run_log(
    run_id: str,
    user_input: str,
    tool_calls: list[dict[str, Any]],
    total_duration_ms: int,
    total_tokens: int = 0,
    final_score: float | None = None,
    status: str = "completed",
) -> None:
    """
    保存一次 Agentic 执行日志。

    Args:
        run_id: 执行唯一标识
        user_input: 用户原始输入（截断到 200 字）
        tool_calls: 工具调用列表 [{tool_name, args_summary, duration_ms, token_count, status, result_summary}]
        total_duration_ms: 总耗时（毫秒）
        total_tokens: 总 Token 消耗估算
        final_score: 最终评分（如有）
        status: completed / error / interrupted
    """
    _ensure_dirs()

    log_entry = {
        "run_id": run_id,
        "timestamp": _time.strftime("%Y-%m-%dT%H:%M:%SZ", _time.gmtime()),
        "user_input": user_input[:200],
        "tool_calls": tool_calls,
        "total_duration_ms": total_duration_ms,
        "total_tokens": total_tokens,
        "final_score": final_score,
        "status": status,
        "tool_count": len(tool_calls),
        "enabled_tools_count": sum(1 for t in tool_calls if t.get("status") != "skipped"),
    }

    # 写入 latest.json
    _LATEST_PATH.write_text(
        _json.dumps(log_entry, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # 写入 history/{timestamp}.json
    ts = log_entry["timestamp"].replace(":", "-").replace("T", "_").rstrip("Z")
    history_path = _HISTORY_DIR / f"{ts}_{run_id[:8]}.json"
    history_path.write_text(
        _json.dumps(log_entry, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # 清理旧历史（保留最近 _MAX_HISTORY 条）
    history_files = sorted(_HISTORY_DIR.glob("*.json"), reverse=True)
    for old_file in history_files[_MAX_HISTORY:]:
        try:
            old_file.unlink()
        except OSError:
            pass

    logger.info(
        "📋 Agentic 执行日志已保存: run_id=%s, tools=%d, duration=%dms",
        run_id,
        len(tool_calls),
        total_duration_ms,
    )


def get_latest_run_log() -> dict[str, Any] | None:
    """读取最近一次执行日志，不存在则返回 None。"""
    if not _LATEST_PATH.is_file():
        return None
    try:
        return _json.loads(_LATEST_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None


def get_run_log_summary() -> str:
    """
    获取最近执行日志的友好摘要文本，供 Studio Agent Tool 返回。
    无日志时返回提示信息。
    """
    log = get_latest_run_log()
    if not log:
        return _json.dumps({
            "has_log": False,
            "message": "暂无执行记录。请先运行一次 Agentic 分析。",
        }, ensure_ascii=False)

    # 构建友好摘要
    tool_lines = []
    for tc in log.get("tool_calls", []):
        name = tc.get("tool_name", "?")
        dur = tc.get("duration_ms", 0)
        status = tc.get("status", "?")
        summary = tc.get("result_summary", "")
        tool_lines.append(f"  {name} ({dur}ms) [{status}] — {summary[:60]}")

    summary = {
        "has_log": True,
        "run_id": log.get("run_id", ""),
        "timestamp": log.get("timestamp", ""),
        "status": log.get("status", ""),
        "user_input_preview": log.get("user_input", "")[:80],
        "tool_count": log.get("tool_count", 0),
        "total_duration_ms": log.get("total_duration_ms", 0),
        "total_tokens": log.get("total_tokens", 0),
        "final_score": log.get("final_score"),
        "tool_calls_detail": tool_lines,
    }
    return _json.dumps(summary, ensure_ascii=False)


def get_history_summaries(limit: int = 5) -> str:
    """获取最近 N 次执行日志的摘要列表。"""
    _ensure_dirs()
    history_files = sorted(_HISTORY_DIR.glob("*.json"), reverse=True)[:limit]

    if not history_files:
        return _json.dumps({"count": 0, "message": "暂无历史执行记录"}, ensure_ascii=False)

    summaries = []
    for f in history_files:
        try:
            entry = _json.loads(f.read_text(encoding="utf-8"))
            summaries.append({
                "run_id": entry.get("run_id", ""),
                "timestamp": entry.get("timestamp", ""),
                "status": entry.get("status", ""),
                "tool_count": entry.get("tool_count", 0),
                "total_duration_ms": entry.get("total_duration_ms", 0),
                "final_score": entry.get("final_score"),
            })
        except Exception:
            pass

    return _json.dumps({"count": len(summaries), "runs": summaries}, ensure_ascii=False)
