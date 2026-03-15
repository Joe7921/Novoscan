//! 质量守卫评分引擎 — qualityGuard.ts 的 Rust 等价实现
//!
//! 9 维检查：基础字段 → 评分一致性 → 离散度 → 置信度 → 证据覆盖 →
//! 评分-证据矛盾 → Fallback 检测 → 推理留痕 → 加权检查 → 辩论质量 → 自动修正

use serde::{Deserialize, Serialize};

// ==================== 常量（与 TypeScript 版完全一致） ====================

/// 推荐等级阈值
const THRESHOLD_STRONGLY_RECOMMEND: f64 = 80.0;
const THRESHOLD_RECOMMEND: f64 = 65.0;
const THRESHOLD_CAUTION: f64 = 45.0;

/// 根据评分映射到统一推荐等级（与 TS mapScoreToRecommendation 一致）
fn map_score_to_recommendation(score: f64) -> &'static str {
    if score >= THRESHOLD_STRONGLY_RECOMMEND { "强烈推荐" }
    else if score >= THRESHOLD_RECOMMEND { "推荐" }
    else if score >= THRESHOLD_CAUTION { "谨慎考虑" }
    else { "不推荐" }
}

// ==================== 输入输出类型 ====================

/// WASM 入口接收的顶层输入
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityGuardInput {
    pub arbitration: ArbitrationResult,
    pub agents: Vec<AgentOutput>,
    pub debate_record: Option<DebateRecord>,
}

/// 仲裁结果
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArbitrationResult {
    pub overall_score: Option<f64>,
    pub summary: Option<String>,
    pub recommendation: Option<String>,
    pub next_steps: Option<Vec<String>>,
    pub conflicts_resolved: Option<Vec<String>>,
    pub weighted_breakdown: Option<WeightedBreakdown>,
}

/// 加权明细
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeightedBreakdown {
    pub academic: WeightedItem,
    pub industry: WeightedItem,
    pub innovation: WeightedItem,
    pub competitor: WeightedItem,
}

#[derive(Deserialize)]
pub struct WeightedItem {
    pub weight: f64,
}

/// Agent 输出
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentOutput {
    pub agent_name: String,
    pub score: Option<f64>,
    pub confidence: Option<String>,
    pub evidence_sources: Option<Vec<String>>,
    pub reasoning: Option<String>,
    pub is_fallback: Option<bool>,
}

/// 辩论记录
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebateRecord {
    pub triggered: bool,
    pub sessions: Vec<DebateSession>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebateSession {
    pub session_id: String,
    pub score_adjustment: ScoreAdjustment,
    pub exchanges: Vec<serde_json::Value>, // 只检查长度，不解析内部结构
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreAdjustment {
    pub pro_agent_delta: f64,
    pub con_agent_delta: f64,
}

/// 质量检查结果（输出）
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QualityCheckResult {
    pub passed: bool,
    pub issues: Vec<String>,
    pub warnings: Vec<String>,
    pub consistency_score: i32,
    pub corrections: Vec<Correction>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Correction {
    pub field: String,
    pub from: String,
    pub to: String,
    pub reason: String,
}

// ==================== 核心逻辑 ====================

pub fn quality_guard(
    arbitration: &ArbitrationResult,
    agents: &[AgentOutput],
    debate_record: Option<&DebateRecord>,
) -> QualityCheckResult {
    let mut issues: Vec<String> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut consistency_score: i32 = 100;

    // ==================== 1. 基础字段检查 ====================

    if let Some(score) = arbitration.overall_score {
        if score < 0.0 || score > 100.0 {
            issues.push(format!("综合评分超出有效范围 (0-100): {}", score));
        }
    } else {
        issues.push("综合评分超出有效范围 (0-100): undefined".to_string());
    }

    match &arbitration.summary {
        Some(s) if s.trim().len() >= 10 => {},
        _ => { issues.push("综合摘要缺失或过短（至少10字符）".to_string()); }
    }

    let rec = arbitration.recommendation.as_deref().unwrap_or("");
    if rec.trim().is_empty() {
        issues.push("缺少最终建议".to_string());
    }

    let valid_recommendations = [
        "强烈推荐", "推荐", "谨慎考虑", "不推荐",
        "Strongly Recommended", "Recommended", "Proceed with Caution", "Not Recommended",
    ];
    if !rec.is_empty() && !valid_recommendations.iter().any(|v| rec.contains(v)) {
        warnings.push(format!("建议值不在预期范围内: \"{}\"", rec));
    }

    match &arbitration.next_steps {
        Some(steps) if !steps.is_empty() => {},
        _ => { issues.push("缺少下一步行动建议".to_string()); }
    }

    if arbitration.conflicts_resolved.is_none() {
        warnings.push("缺少冲突解决记录".to_string());
    }

    // ==================== 2. 评分 vs 建议等级一致性 ====================

    let score = arbitration.overall_score.unwrap_or(-1.0);
    if score >= 0.0 {
        if score >= THRESHOLD_STRONGLY_RECOMMEND && rec.contains("不推荐") {
            issues.push(format!(
                "逻辑矛盾：综合评分 {} ≥ {} 但建议为\"不推荐\"",
                score, THRESHOLD_STRONGLY_RECOMMEND
            ));
        }
        if score < THRESHOLD_CAUTION
            && (rec.contains("强烈推荐") || rec == "推荐" || rec == "Recommended")
        {
            issues.push(format!(
                "逻辑矛盾：综合评分 {} < {} 但建议为\"{}\"",
                score, THRESHOLD_CAUTION, rec
            ));
        }
    }

    // ==================== 3. 各 Agent 评分离散度检查 ====================

    let agent_scores: Vec<f64> = agents
        .iter()
        .filter(|a| a.score.is_some() && a.confidence.as_deref() != Some("low"))
        .filter_map(|a| a.score)
        .collect();

    if agent_scores.len() >= 2 {
        let n = agent_scores.len() as f64;
        let avg = agent_scores.iter().sum::<f64>() / n;
        let variance = agent_scores.iter().map(|v| (v - avg).powi(2)).sum::<f64>() / n;
        let std_dev = variance.sqrt();

        if std_dev > 25.0 {
            warnings.push(format!(
                "专家评分离散度极高（标准差 {}），共识度低",
                std_dev.round() as i32
            ));
            consistency_score -= 30;
        } else if std_dev > 15.0 {
            warnings.push(format!(
                "专家评分存在较大分歧（标准差 {}）",
                std_dev.round() as i32
            ));
            consistency_score -= 15;
        }

        let max_score = agent_scores.iter().cloned().fold(f64::MIN, f64::max);
        let min_score = agent_scores.iter().cloned().fold(f64::MAX, f64::min);
        let range = max_score - min_score;
        if range > 40.0 {
            warnings.push(format!("评分极差达 {} 分，建议关注分歧原因", range as i32));
            consistency_score -= 10;
        }
    }

    // ==================== 4. 置信度 vs 评分一致性 ====================

    for agent in agents {
        let agent_score = agent.score.unwrap_or(50.0);
        let confidence = agent.confidence.as_deref().unwrap_or("medium");

        if confidence == "high" && agent_score < 20.0 {
            warnings.push(format!(
                "{}：高置信度但评分极低 ({})，可能存在评判偏差",
                agent.agent_name, agent_score
            ));
            consistency_score -= 5;
        }
        if confidence == "low" && agent_score > 80.0 {
            warnings.push(format!(
                "{}：低置信度但评分极高 ({})，数据支撑不足",
                agent.agent_name, agent_score
            ));
            consistency_score -= 10;
        }
    }

    // ==================== 5. 证据覆盖率检查 ====================

    let agents_with_evidence = agents
        .iter()
        .filter(|a| {
            a.evidence_sources
                .as_ref()
                .map_or(false, |es| !es.is_empty())
        })
        .count();

    if agents_with_evidence == 0 {
        warnings.push("所有 Agent 均未提供证据来源引用".to_string());
        consistency_score -= 15;
    } else if agents_with_evidence < agents.len() {
        warnings.push(format!(
            "{} 个 Agent 未提供证据来源引用",
            agents.len() - agents_with_evidence
        ));
        consistency_score -= 5;
    }

    // ==================== 5.5 评分-证据一致性动态检查 ====================

    for agent in agents {
        let agent_score = agent.score.unwrap_or(0.0);
        if agent_score > 80.0 {
            let evidence_count = agent
                .evidence_sources
                .as_ref()
                .map_or(0, |es| es.len());
            let confidence = agent.confidence.as_deref().unwrap_or("medium");

            if evidence_count == 0 && confidence == "high" {
                issues.push(format!(
                    "{}：评分 {} 且置信度高，但未提供任何证据来源（高分空口无凭）",
                    agent.agent_name, agent_score
                ));
                consistency_score -= 15;
            } else if evidence_count < 2 {
                warnings.push(format!(
                    "{}：评分 {} > 80 但仅有 {} 条证据来源，数据支撑不足",
                    agent.agent_name, agent_score, evidence_count
                ));
                consistency_score -= 5;
            }
        }
    }

    // ==================== 5.6 Fallback Agent 降级检测 ====================

    let fallback_agents: Vec<&AgentOutput> = agents
        .iter()
        .filter(|a| a.is_fallback.unwrap_or(false))
        .collect();
    if !fallback_agents.is_empty() {
        let fallback_names: Vec<&str> = fallback_agents.iter().map(|a| a.agent_name.as_str()).collect();
        issues.push(format!(
            "{} 个 Agent 使用了降级数据（{}），报告可靠性受限",
            fallback_agents.len(),
            fallback_names.join("、")
        ));
        consistency_score -= fallback_agents.len() as i32 * 15;
    }

    // ==================== 6. 推理留痕检查 ====================

    let agents_with_reasoning = agents
        .iter()
        .filter(|a| {
            a.reasoning
                .as_ref()
                .map_or(false, |r| r.trim().len() > 20)
        })
        .count();

    if agents_with_reasoning == 0 {
        warnings.push("所有 Agent 均未提供推理过程".to_string());
        consistency_score -= 10;
    }

    // ==================== 7. 加权明细检查 ====================

    if let Some(wb) = &arbitration.weighted_breakdown {
        let total_weight = wb.academic.weight + wb.industry.weight + wb.innovation.weight + wb.competitor.weight;
        if (total_weight - 1.0).abs() > 0.05 {
            warnings.push(format!("加权权重之和 {:.2} 不等于 1.0", total_weight));
        }
    } else {
        warnings.push("仲裁结果缺少加权评分明细".to_string());
    }

    consistency_score = consistency_score.clamp(0, 100);

    // ==================== 8. NovoDebate 辩论质量检查 ====================

    if let Some(debate) = debate_record {
        let all_scores: Vec<f64> = agents.iter().filter_map(|a| a.score).collect();
        if all_scores.len() >= 2 {
            let max_s = all_scores.iter().cloned().fold(f64::MIN, f64::max);
            let min_s = all_scores.iter().cloned().fold(f64::MAX, f64::min);
            let max_diff = max_s - min_s;

            if max_diff > 30.0 && !debate.triggered {
                warnings.push(format!(
                    "专家评分极差达 {} 分但未触发 NovoDebate 辩论",
                    max_diff as i32
                ));
            }
        }

        if debate.triggered {
            for session in &debate.sessions {
                let adj = &session.score_adjustment;
                if adj.pro_agent_delta.abs() > 15.0 || adj.con_agent_delta.abs() > 15.0 {
                    warnings.push(format!(
                        "辩论场次 {} 评分修正幅度过大（超过 ±15）",
                        session.session_id
                    ));
                    consistency_score -= 5;
                }

                if session.exchanges.is_empty() {
                    // 统计空辩论（在循环外统一报告会更好，但为保持行为一致分开处理）
                }
            }

            let empty_debates = debate.sessions.iter().filter(|s| s.exchanges.is_empty()).count();
            if empty_debates > 0 {
                warnings.push(format!("{} 场辩论未产出有效交锋记录", empty_debates));
            }
        }
    }

    consistency_score = consistency_score.clamp(0, 100);

    // ==================== 9. 自动修正 ====================

    let mut corrections: Vec<Correction> = Vec::new();

    if score >= 0.0 {
        if let Some(current_rec) = &arbitration.recommendation {
            let expected_rec = map_score_to_recommendation(score);
            let is_contradiction = (score >= THRESHOLD_STRONGLY_RECOMMEND && current_rec.contains("不推荐"))
                || (score < THRESHOLD_CAUTION
                    && (current_rec.contains("强烈推荐") || current_rec == "推荐"));
            if is_contradiction {
                corrections.push(Correction {
                    field: "recommendation".to_string(),
                    from: current_rec.clone(),
                    to: expected_rec.to_string(),
                    reason: format!(
                        "评分 {} 与推荐等级\"{}\"矛盾，按阈值重新映射为\"{}\"",
                        score, current_rec, expected_rec
                    ),
                });
            }
        }
    }

    QualityCheckResult {
        passed: issues.is_empty(),
        issues,
        warnings,
        consistency_score,
        corrections,
    }
}
