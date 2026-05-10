from __future__ import annotations

import copy
import time
from typing import Any

_AGENTIC_RUNS: dict[str, dict[str, Any]] = {}
_MAX_EVENTS = 200


def _now_ts() -> float:
    return time.time()


def create_agentic_run(
    thread_id: str,
    request_payload: dict[str, Any],
    runtime_definition: dict[str, Any],
) -> dict[str, Any]:
    run_state = {
        "thread_id": thread_id,
        "mode": "agentic",
        "status": "created",
        "request": copy.deepcopy(request_payload),
        "runtime_definition": copy.deepcopy(runtime_definition),
        "pause_target": None,
        "pause_phase": None,
        "resume_actions": runtime_definition.get("dsl", {}).get("resume_actions", []),
        "final_payload": None,
        "error": None,
        "events": [
            {
                "type": "created",
                "timestamp": _now_ts(),
                "data": {"allowed_tools": runtime_definition.get("tool_policy", {}).get("allowed_tools", [])},
            }
        ],
        "created_at": _now_ts(),
        "updated_at": _now_ts(),
    }
    _AGENTIC_RUNS[thread_id] = run_state
    return copy.deepcopy(run_state)


def get_agentic_run(thread_id: str) -> dict[str, Any] | None:
    run_state = _AGENTIC_RUNS.get(thread_id)
    if run_state is None:
        return None
    return copy.deepcopy(run_state)


def update_agentic_run(thread_id: str, **patch: Any) -> dict[str, Any] | None:
    run_state = _AGENTIC_RUNS.get(thread_id)
    if run_state is None:
        return None
    run_state.update(copy.deepcopy(patch))
    run_state["updated_at"] = _now_ts()
    return copy.deepcopy(run_state)


def append_agentic_run_event(thread_id: str, event_type: str, data: dict[str, Any] | None = None) -> dict[str, Any] | None:
    run_state = _AGENTIC_RUNS.get(thread_id)
    if run_state is None:
        return None
    events = run_state.setdefault("events", [])
    events.append({
        "type": event_type,
        "timestamp": _now_ts(),
        "data": copy.deepcopy(data or {}),
    })
    if len(events) > _MAX_EVENTS:
        del events[:-_MAX_EVENTS]
    run_state["updated_at"] = _now_ts()
    return copy.deepcopy(run_state)


def pause_agentic_run(
    thread_id: str,
    pause_target: str,
    pause_phase: str,
    final_payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    run_state = _AGENTIC_RUNS.get(thread_id)
    if run_state is None:
        return None
    run_state["status"] = "paused"
    run_state["pause_target"] = pause_target
    run_state["pause_phase"] = pause_phase
    if final_payload is not None:
        run_state["final_payload"] = copy.deepcopy(final_payload)
    append_agentic_run_event(
        thread_id,
        "paused",
        {"pause_target": pause_target, "pause_phase": pause_phase},
    )
    return copy.deepcopy(run_state)


def complete_agentic_run(thread_id: str, final_payload: dict[str, Any]) -> dict[str, Any] | None:
    run_state = _AGENTIC_RUNS.get(thread_id)
    if run_state is None:
        return None
    run_state["status"] = "completed"
    run_state["pause_target"] = None
    run_state["pause_phase"] = None
    run_state["final_payload"] = copy.deepcopy(final_payload)
    append_agentic_run_event(thread_id, "completed", {"status": "completed"})
    return copy.deepcopy(run_state)


def abort_agentic_run(thread_id: str, reason: str = "") -> dict[str, Any] | None:
    run_state = _AGENTIC_RUNS.get(thread_id)
    if run_state is None:
        return None
    run_state["status"] = "aborted"
    run_state["error"] = reason or None
    run_state["pause_target"] = None
    run_state["pause_phase"] = None
    append_agentic_run_event(thread_id, "aborted", {"reason": reason})
    return copy.deepcopy(run_state)


def mark_agentic_run_error(thread_id: str, message: str) -> dict[str, Any] | None:
    run_state = _AGENTIC_RUNS.get(thread_id)
    if run_state is None:
        return None
    run_state["status"] = "error"
    run_state["error"] = message
    append_agentic_run_event(thread_id, "error", {"message": message})
    return copy.deepcopy(run_state)
