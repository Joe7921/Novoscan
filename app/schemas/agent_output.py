"""
Novoscan-Open-Core — 结构化输出 Schema

定义评分 Agent、仲裁员、辩论等的输出格式。
所有 Schema 使用 Pydantic BaseModel，用于 with_structured_output() 强制 JSON 输出。

相比旧引擎的改进：
  - DimensionScore 保持通用——每个 Agent 自行定义维度名称
  - AgentOutput 去掉了 similarPapers（学术专用字段），改为通用 evidence 结构
  - 新增 EvidenceItem 统一引证格式，三类 Agent 都能用
"""

from pydantic import BaseModel, Field
from typing import Optional


class DimensionScore(BaseModel):
    """单个评分维度"""
    name: str = Field(description="维度名称")
    score: int = Field(ge=0, le=100, description="该维度评分 0-100")
    reasoning: str = Field(description="评分推理依据（必须引用具体数据）")


class EvidenceItem(BaseModel):
    """引证条目 — 通用证据结构（P8h 扩展版）"""
    title: str = Field(description="论文标题 / 项目名称 / 产品名称")
    source: str = Field(default="", description="来源平台（如：OpenAlex / GitHub / Brave）")
    source_type: str = Field(default="其他", description="来源类型: 学术论文/行业报告/开源项目/新闻/专利/其他")
    url: str = Field(default="", description="原始链接")
    year: Optional[int] = Field(default=None, description="发表/发布年份")
    relevance: str = Field(default="high", description="相关程度: high / medium / low")
    relevance_score: float = Field(default=0.7, ge=0.0, le=1.0, description="相关性量化评分 0-1")
    relevance_reasoning: str = Field(default="", description="为什么与用户创新点相关的推理过程")
    key_point: str = Field(default="", description="与用户创新点的关键关系（简述）")
    key_excerpt: str = Field(default="", description="AI 提炼的核心论点或原文片段引用")
    dimension: str = Field(default="综合", description="所属评分维度（学术/产业/竞品/综合）")
    stance: str = Field(default="中性", description="对用户创新点的立场: 支持/反对/中性")
    citation_info: Optional[dict] = Field(default=None, description="引用信息（author/year/journal/doi）")
    related_evidence_ids: list[str] = Field(default_factory=list, description="关联证据 ID 列表（证据间关系网）")
    metrics: dict = Field(default_factory=dict, description="量化指标（引用数/Star数等）")


class AgentOutput(BaseModel):
    """评分 Agent 统一输出格式 — 所有评分积木的标准接口"""
    agent_name: str = Field(description="Agent 角色名")
    score: int = Field(ge=0, le=100, description="综合评分 0-100")
    confidence: str = Field(description="置信度: high / medium / low")
    confidence_reasoning: str = Field(default="", description="置信度判断理由")
    analysis: str = Field(description="分析结论（2-4 段，核心洞察）")
    dimension_scores: list[DimensionScore] = Field(default_factory=list, description="多维度评分明细")
    key_findings: list[str] = Field(default_factory=list, description="核心发现（3-5 条）")
    evidence: list[EvidenceItem] = Field(default_factory=list, description="引证列表")
    red_flags: list[str] = Field(default_factory=list, description="风险提示")
    reasoning: str = Field(default="", description="完整思维链推理过程")
    is_fallback: bool = Field(default=False, description="是否为降级结果")


class ArbitrationResult(BaseModel):
    """仲裁员输出"""
    summary: str = Field(description="决策性结论摘要")
    overall_score: int = Field(ge=0, le=100, description="最终综合评分")
    recommendation: str = Field(description="推荐等级：强烈推荐/推荐/谨慎考虑/不推荐")
    weighted_breakdown: Optional[dict] = Field(default=None, description="加权评分明细")
    consensus_level: str = Field(default="moderate", description="共识度: strong/moderate/weak")
    dissent: list[str] = Field(default_factory=list, description="少数派意见")
    conflicts_resolved: list[str] = Field(default_factory=list, description="已解决冲突")
    next_steps: list[str] = Field(default_factory=list, description="建议的下一步行动")
    is_partial: bool = Field(default=False, description="是否为降级/不完整结果")


class DebateExchange(BaseModel):
    """辩论单轮交锋"""
    round: int
    pro_argument: str = ""
    con_argument: str = ""
    outcome: str = Field(default="draw", description="challenger_wins/defender_wins/draw")
    outcome_reasoning: str = ""


class DebateSession(BaseModel):
    """辩论场次"""
    session_id: str
    pro_agent: str
    con_agent: str
    topic: str
    score_divergence: int = 0
    exchanges: list[DebateExchange] = Field(default_factory=list)
    verdict: str = ""
    key_insights: list[str] = Field(default_factory=list)
    score_adjustment: dict = Field(default_factory=lambda: {"pro_delta": 0, "con_delta": 0})


class DebateRecord(BaseModel):
    """辩论记录"""
    triggered: bool = False
    reason: str = ""
    sessions: list[DebateSession] = Field(default_factory=list)
    dissent_report: list[dict] = Field(default_factory=list)
