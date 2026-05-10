"""
Novoscan-Open-Core GraphState 定义

技术方案对齐：
  - §1.3 用户交互状态（user_raw_input, analyzed_intent, user_feedback, is_confirmed）
  - §2.3 检索状态（detection_type, search_history, retrieved_context）
  - §3.1 评分状态（evaluation_results, score_gap）
  - §3.1 辩论状态（debate_history, debate_round, final_score, final_judgment）

设计原则：
  1. 核心字段为必填（user_raw_input），保证任何图都能启动
  2. 使用 LangGraph 标准的 add_messages reducer
  3. 字段命名对齐技术方案原文
"""

from typing import TypedDict, Optional, Any, Annotated
from langgraph.graph import add_messages
from langchain_core.messages import BaseMessage


class GraphState(TypedDict):
    """LangGraph 标准管线状态"""

    # ── 原始输入 ──
    user_raw_input: str                              # 用户最初的一段话
    detection_type: str                              # 检测类型: 'academic' | 'industrial' | 'skill' | 'auto'

    # ── 意图分析（§1 HITL 循环） ──
    analyzed_intent: Optional[dict[str, Any]]        # LLM 结构化解析结果
    # 结构: {"core_idea": "...", "keywords": [...], "domain": "..."}
    user_feedback: Optional[str]                     # 用户的修正意见
    is_confirmed: bool                               # 用户是否已最终确认

    # ── LangGraph 消息流 ──
    messages: Annotated[list[BaseMessage], add_messages]

    # ── 检索状态（§2 ReAct 循环） ──
    search_history: list[dict[str, Any]]             # ReAct 过程记录
    # 结构: [{"thought": "...", "action": "...", "observation": "..."}]
    retrieved_context: Optional[str]                  # LLM 总结后的有效检索内容

    # ── 评分状态（§3 并行评分） ──
    evaluation_results: list[dict[str, Any]]         # 三个 Agent 的结构化评分
    score_gap: float                                 # max - min 分差

    # ── 辩论状态（§4 群聊辩论） ──
    debate_history: list[str]                        # 辩论记录（逐条发言）
    debate_round: int                                # 当前辩论轮次
    final_score: Optional[float]                     # 最终确定的分数
    final_judgment: Optional[str]                    # 最终的判决书

    # ── 报告（§6 报告组装） ──
    report_json: Optional[dict[str, Any]]            # 组装后的结构化报告

    # ── 执行记录 ──
    execution_logs: list[str]                        # 运行日志（SSE 推送）
    current_phase: str                               # 当前执行阶段
