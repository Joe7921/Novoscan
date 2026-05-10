"""
仲裁裁决节点 — Phase 5

整合所有 Agent 报告（含辩论记录），使用 LLM 做最终裁决。
加权规则、置信度降权和纠偏逻辑均已内置。

改进 vs 旧引擎：
  - 字段统一 snake_case
  - 读取辩论记录从 debate_history（而非嵌套 node_results）
  - 输出直接写入 state 顶层字段
"""

from __future__ import annotations

import logging

from langchain_core.messages import SystemMessage, HumanMessage

from app.models import get_model
from app.schemas.agent_output import ArbitrationResult
from app.compat import invoke_with_fallback

logger = logging.getLogger("novoscan.nodes.arbitration")


ARBITRATION_SYSTEM_PROMPT = """你是一位资深的技术投资委员会主席，拥有 25 年的风险投资决策经验。
你的核心职责是：整合多位专家的报告，识别和解决分歧，做出透明的最终决策。

## 核心原则
1. 透明决策：每个评分和结论都必须可追溯到具体专家的报告
2. 少数意见保护：如果某位专家持明显不同的观点，必须记录其异议
3. 动态权重：低置信度专家的报告自动降权
4. ⚠️ 商业现实纠偏：无 GitHub 开源项目 ≠ 产业应用空白

## 最终建议等级：
| 评分 | 建议 |
|------|------|
| ≥80 | 强烈推荐 |
| 65-79 | 推荐 |
| 45-64 | 谨慎考虑 |
| <45 | 不推荐 |

请返回符合 ArbitrationResult schema 的 JSON。
summary 字段必须以建议等级开头（如\"推荐——...\"），不要逐一转述专家意见。"""


async def arbitration_node(state: dict) -> dict:
    """
    仲裁裁决节点 — 整合所有信息做最终判定。
    """
    results = state.get("evaluation_results", [])
    debate_history = state.get("debate_history", [])
    query = state.get("user_raw_input", "")

    # 格式化专家报告
    expert_reports = []
    for r in results:
        report = f"""## {r.get('agent_name', '未知Agent')}
- 评分：{r.get('score', 'N/A')}/100（置信度：{r.get('confidence', 'N/A')}）
- 核心发现：{', '.join(r.get('key_findings', [])[:3]) or '无'}
- 风险提示：{', '.join(r.get('red_flags', [])[:3]) or '无'}
- 分析摘要：{r.get('analysis', '无')[:500]}"""
        expert_reports.append(report)

    # 辩论信息
    debate_section = ""
    if debate_history:
        debate_section = "\n# 辩论记录\n" + "\n".join(
            f"- {item}" for item in debate_history
        )

    prompt = f"""# 创新点评估综合裁决

**用户创新点**：{query}

# 专家报告

{''.join(expert_reports)}

{debate_section}

请综合以上所有信息，做出你的独立最终裁决。"""

    model = get_model()

    try:
        messages = [
            SystemMessage(content=ARBITRATION_SYSTEM_PROMPT),
            HumanMessage(content=prompt),
        ]
        result = await invoke_with_fallback(
            model, ArbitrationResult, messages, node_name="仲裁",
        )
        if result is None:
            raise ValueError("L1+L2 均失败，无法解析仲裁结果")

        logger.info(
            "⚖️ 仲裁完成: %d/100, 建议=%s",
            result.overall_score, result.recommendation,
        )

        return {
            "final_score": float(result.overall_score),
            "final_judgment": result.summary,
            "execution_logs": [
                f"[仲裁] 最终评分: {result.overall_score}/100",
                f"[仲裁] 建议: {result.recommendation}",
            ],
            "current_phase": "arbitration",
        }
    except Exception as e:
        logger.warning("⚠️ 仲裁执行失败: %s", e)
        return {
            "final_score": 50.0,
            "final_judgment": f"仲裁执行异常，使用默认评分: {str(e)}",
            "execution_logs": [f"[仲裁] 执行失败: {str(e)}"],
            "current_phase": "arbitration_failed",
        }
