"""
FinalReport Schema — Phase 5.3

最终报告的 Pydantic 模型。
使用 Field(alias=...) 输出 camelCase JSON，对齐前端接口。
model_dump(by_alias=True) 直接生成前端可用的 JSON。
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional, Any


class RadarScore(BaseModel):
    """雷达图维度数据"""
    key: str = Field(description="Agent 标识")
    label: str = Field(description="展示名称", serialization_alias="label")
    score: int = Field(ge=0, le=100, description="维度评分")


class AgentScoreDetail(BaseModel):
    """单个 Agent 评分明细"""
    name: str = Field(description="Agent 名称")
    score: int = Field(ge=0, le=100, description="综合评分")
    confidence: str = Field(description="置信度")
    analysis: str = Field(default="", description="分析摘要")
    dimension_scores: list[dict] = Field(
        default_factory=list,
        serialization_alias="dimensionScores",
        description="多维度评分明细",
    )
    is_fallback: bool = Field(
        default=False,
        serialization_alias="isFallback",
        description="是否为降级结果",
    )


class RiskFlag(BaseModel):
    """风险项"""
    risk: str = Field(description="风险描述")
    severity: str = Field(default="medium", description="严重度: high/medium/low")
    source_agent: str = Field(
        default="",
        serialization_alias="sourceAgent",
        description="来源 Agent",
    )
    suggestion: str = Field(default="", description="建议措施")


class KeyFinding(BaseModel):
    """关键发现"""
    title: str = Field(description="发现标题")
    description: str = Field(default="", description="详细描述")
    source: str = Field(default="", description="来源 Agent")


class ArbitrationSummary(BaseModel):
    """仲裁摘要（含雷达图数据）"""
    summary: str = Field(description="仲裁结论")
    radar_scores: list[RadarScore] = Field(
        default_factory=list,
        serialization_alias="radarScores",
        description="雷达图维度数据",
    )


class ReportMeta(BaseModel):
    """报告元数据"""
    overall_score: Optional[float] = Field(
        default=None,
        serialization_alias="overallScore",
        description="最终评分",
    )
    novelty_level: str = Field(
        default="Medium",
        serialization_alias="noveltyLevel",
        description="创新等级: High/Medium/Low",
    )
    avg_agent_score: float = Field(
        default=0.0,
        serialization_alias="avgAgentScore",
        description="Agent 平均分",
    )
    agent_count: int = Field(
        default=0,
        serialization_alias="agentCount",
        description="参与评分的 Agent 数量",
    )
    score_gap: float = Field(
        default=0.0,
        serialization_alias="scoreGap",
        description="评分最大分差",
    )
    quality_passed: bool = Field(
        default=True,
        serialization_alias="qualityPassed",
        description="质量门是否通过",
    )
    quality_issues: list[str] = Field(
        default_factory=list,
        serialization_alias="qualityIssues",
        description="质量门检测到的问题",
    )


class ReportEvidenceItem(BaseModel):
    """报告中的证据条目（camelCase 输出，对齐前端）"""
    id: str = Field(default="", description="证据唯一 ID")
    title: str = Field(description="来源标题")
    source: str = Field(default="", description="来源平台")
    source_type: str = Field(
        default="其他",
        serialization_alias="sourceType",
        description="来源类型",
    )
    url: str = Field(default="", description="原始链接")
    year: Optional[int] = Field(default=None, description="发表年份")
    relevance_score: float = Field(
        default=0.7,
        serialization_alias="relevanceScore",
        description="相关性评分 0-1",
    )
    relevance_reasoning: str = Field(
        default="",
        serialization_alias="relevanceReasoning",
        description="相关性推理",
    )
    key_excerpt: str = Field(
        default="",
        serialization_alias="keyExcerpt",
        description="核心论点/原文片段",
    )
    dimension: str = Field(default="综合", description="所属评分维度")
    stance: str = Field(default="中性", description="支持/反对/中性")
    agent_name: str = Field(
        default="",
        serialization_alias="agentName",
        description="来源 Agent",
    )
    citation_info: Optional[dict] = Field(
        default=None,
        serialization_alias="citationInfo",
        description="引用信息",
    )
    related_evidence_ids: list[str] = Field(
        default_factory=list,
        serialization_alias="relatedEvidenceIds",
        description="关联证据 ID 列表",
    )
    user_mark: Optional[str] = Field(
        default=None,
        serialization_alias="userMark",
        description="用户标记: useful/useless/uncertain",
    )
    metrics: dict = Field(default_factory=dict, description="量化指标")


class ReportBody(BaseModel):
    """报告主体"""
    executive_summary: str = Field(
        default="",
        serialization_alias="executiveSummary",
        description="高管摘要",
    )
    arbitration: ArbitrationSummary = Field(
        default_factory=lambda: ArbitrationSummary(summary=""),
        description="仲裁结果",
    )
    agent_scores: list[AgentScoreDetail] = Field(
        default_factory=list,
        serialization_alias="agentScores",
        description="各 Agent 评分明细",
    )
    risk_flags: list[RiskFlag] = Field(
        default_factory=list,
        serialization_alias="riskFlags",
        description="风险清单",
    )
    key_findings: list[KeyFinding] = Field(
        default_factory=list,
        serialization_alias="keyFindings",
        description="关键发现",
    )
    evidence_items: list[ReportEvidenceItem] = Field(
        default_factory=list,
        serialization_alias="evidenceItems",
        description="全量证据条目",
    )
    meta: ReportMeta = Field(
        default_factory=ReportMeta,
        description="报告元数据",
    )


class FinalReport(BaseModel):
    """
    最终报告输出 — 对齐前端 PublicReportClient。

    用法：
      report = FinalReport(...)
      json_output = report.model_dump(by_alias=True)
    """
    template: str = Field(default="创新雷达报告", description="使用的报告模板名称")
    version: str = Field(default="1.0", description="报告模板版本")
    report: ReportBody = Field(
        default_factory=ReportBody,
        description="报告主体",
    )
