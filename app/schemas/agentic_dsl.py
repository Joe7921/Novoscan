from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AgenticWorkflowBudget(BaseModel):
    max_steps: int = Field(default=25, ge=1)
    max_tool_calls: int = Field(default=25, ge=1)
    max_tokens: int | None = Field(default=None, ge=1)


class AgenticWorkflowNode(BaseModel):
    id: str
    type: Literal["agent", "tool", "human", "condition", "stage", "terminal"] = "agent"
    name: str = ""
    config: dict[str, Any] = Field(default_factory=dict)


class AgenticWorkflowEdge(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source: str = Field(alias="from")
    target: str = Field(alias="to")
    condition: str | None = None


class AgenticWorkflowDefinition(BaseModel):
    id: str = "agentic.default"
    name: str = "Agentic Workflow"
    entry_node: str = "agentic.orchestrator"
    nodes: list[AgenticWorkflowNode] = Field(default_factory=list)
    edges: list[AgenticWorkflowEdge] = Field(default_factory=list)
    budgets: AgenticWorkflowBudget = Field(default_factory=AgenticWorkflowBudget)


class AgenticInterruptPoint(BaseModel):
    target: str
    reason: str = ""


class AgenticResumeAction(BaseModel):
    id: Literal["approve_and_continue", "revise_inputs", "abort"] = "approve_and_continue"
    label: str
    description: str = ""


class AgenticToolBudget(BaseModel):
    tool: str
    max_calls: int = Field(default=1, ge=1)


class AgenticToolPolicy(BaseModel):
    mode: Literal["allowlist", "denylist", "all"] = "allowlist"
    tools: list[str] = Field(default_factory=list)
    denied_tools: list[str] = Field(default_factory=list)
    budgets: list[AgenticToolBudget] = Field(default_factory=list)


class AgenticStateContract(BaseModel):
    required_inputs: list[str] = Field(default_factory=lambda: ["user_raw_input"])
    persisted_outputs: list[str] = Field(default_factory=lambda: ["messages", "final_output", "tool_calls"])
    runtime_fields: list[str] = Field(
        default_factory=lambda: ["thread_id", "status", "pause_target", "resume_actions", "tool_policy"]
    )


class AgenticRuntimeEvents(BaseModel):
    emitted: list[str] = Field(
        default_factory=lambda: [
            "stream_start",
            "tool_call_start",
            "tool_call_done",
            "agent_thinking",
            "hitl_interrupt",
            "stream_complete",
            "stream_end",
        ]
    )
    persisted: list[str] = Field(default_factory=lambda: ["created", "paused", "resumed", "completed", "aborted", "error"])


class AgenticFallbackPolicy(BaseModel):
    on_pause_timeout: Literal["wait", "abort"] = "wait"
    on_resume_abort: Literal["abort", "keep_paused"] = "abort"
    on_tool_policy_violation: Literal["deny", "error"] = "deny"


class AgenticWorkflowDSL(BaseModel):
    version: str = "0.1"
    kind: Literal["agentic_workflow"] = "agentic_workflow"
    workflow: AgenticWorkflowDefinition = Field(default_factory=AgenticWorkflowDefinition)
    interrupt_before: list[AgenticInterruptPoint] = Field(default_factory=list)
    interrupt_after: list[AgenticInterruptPoint] = Field(default_factory=list)
    resume_actions: list[AgenticResumeAction] = Field(
        default_factory=lambda: [
            AgenticResumeAction(
                id="approve_and_continue",
                label="继续执行",
                description="确认当前暂停点并继续执行。",
            ),
            AgenticResumeAction(
                id="revise_inputs",
                label="修正输入后重试",
                description="修改输入或补充说明后重新启动本次运行。",
            ),
            AgenticResumeAction(
                id="abort",
                label="终止运行",
                description="结束本次运行并保留当前快照。",
            ),
        ]
    )
    human_input_schema: dict[str, Any] = Field(
        default_factory=lambda: {
            "fields": [
                {"id": "revised_user_input", "type": "string", "required": False},
                {"id": "feedback", "type": "string", "required": False},
            ]
        }
    )
    state_contracts: AgenticStateContract = Field(default_factory=AgenticStateContract)
    runtime_events: AgenticRuntimeEvents = Field(default_factory=AgenticRuntimeEvents)
    tool_policy: AgenticToolPolicy = Field(default_factory=AgenticToolPolicy)
    fallback_policy: AgenticFallbackPolicy = Field(default_factory=AgenticFallbackPolicy)


def build_default_agentic_dsl(config: dict[str, Any]) -> AgenticWorkflowDSL:
    model_cfg = config.get("model", {})
    enabled_tools = [t.get("id", "") for t in config.get("tools", []) if t.get("enabled") and t.get("id")]
    max_iterations = max(1, int(model_cfg.get("max_iterations", 25)))
    tool_policy_mode: Literal["allowlist", "denylist", "all"] = "allowlist" if enabled_tools else "all"

    return AgenticWorkflowDSL(
        workflow=AgenticWorkflowDefinition(
            nodes=[
                AgenticWorkflowNode(id="workflow.entry", type="stage", name="Workflow Entry"),
                AgenticWorkflowNode(
                    id="agentic.orchestrator",
                    type="agent",
                    name="Agentic Orchestrator",
                    config={"strategy": "react", "prompt_source": "agentic_config.system_prompt"},
                ),
                AgenticWorkflowNode(id="workflow.complete", type="terminal", name="Workflow Complete"),
            ],
            edges=[
                AgenticWorkflowEdge.model_validate({"from": "workflow.entry", "to": "agentic.orchestrator"}),
                AgenticWorkflowEdge.model_validate({"from": "agentic.orchestrator", "to": "workflow.complete"}),
            ],
            budgets=AgenticWorkflowBudget(max_steps=max_iterations, max_tool_calls=max_iterations),
        ),
        tool_policy=AgenticToolPolicy(
            mode=tool_policy_mode,
            tools=enabled_tools,
            budgets=[AgenticToolBudget(tool=tool_id, max_calls=max_iterations) for tool_id in enabled_tools],
        ),
    )
