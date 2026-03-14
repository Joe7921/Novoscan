/**
 * Bizscan 战略仲裁官 Agent (Layer 4)
 *
 * 职责：整合全部报告和交叉验证结果，生成最终 BII 指数、评级和战略建议
 * 架构角色：Layer4（串行，依赖全部上游报告）
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type {
    BizscanAgentInput,
    BizscanAgentOutput,
    MarketScoutOutput,
    CompetitorProfilerOutput,
    CrossValidationResult,
    StrategicArbiterResult,
} from './types';

const WEIGHTS = {
    semanticNovelty: 0.25,
    competitiveLandscape: 0.30,
    marketGap: 0.25,
    feasibility: 0.20,
};

export async function strategicArbiter(
    input: BizscanAgentInput,
    marketScout: MarketScoutOutput,
    competitorProfiler: CompetitorProfilerOutput,
    noveltyAuditor: BizscanAgentOutput,
    feasibilityExaminer: BizscanAgentOutput,
    crossValidation: CrossValidationResult,
): Promise<StrategicArbiterResult> {
    const { calibratedScores } = crossValidation;

    const prompt = `
# 系统角色

你是一位顶级风险投资合伙人和战略顾问，拥有交叉验证后的完整数据。
你的最终任务是：做出投资/不投资的建议性判断，并提供可执行的战略建议。

---

# 输入数据

## 校准后评分（经交叉验证引擎校准）
- 语义新颖度: ${calibratedScores.semanticNovelty}/100
- 竞争态势: ${calibratedScores.competitiveLandscape}/100
- 市场空白: ${calibratedScores.marketGap}/100
- 可行性: ${calibratedScores.feasibility}/100
- 报告一致性: ${crossValidation.consistencyScore}/100

## 各专家核心结论
- 市场侦察员 (${marketScout.score}分): ${marketScout.analysis.slice(0, 150)}
- 竞品拆解师 (${competitorProfiler.score}分): ${competitorProfiler.analysis.slice(0, 150)}
- 创新度审计师 (${noveltyAuditor.score}分): ${noveltyAuditor.analysis.slice(0, 150)}
- 可行性检验师 (${feasibilityExaminer.score}分): ${feasibilityExaminer.analysis.slice(0, 150)}

## 交叉验证发现的证据冲突
${crossValidation.evidenceConflicts.join('\n') || '无冲突'}

## 红旗汇总
${[...marketScout.redFlags, ...competitorProfiler.redFlags, ...noveltyAuditor.redFlags, ...feasibilityExaminer.redFlags]
            .filter(Boolean).slice(0, 8).join('\n- ') || '无'}

---

# 任务

基于上述完整数据，请生成：
1. 最终一句话判定（verdict，15-30字）
2. 3-5 条可执行的战略建议
3. 2-4 条严肃的风险警告
4. 200字以内的战略建议文本
5. 对分歧的处理说明

---

# 输出格式

严格按以下 JSON 格式输出：
{
  "overallBII": 62,
  "grade": "B",
  "verdict": "一句话总结（15-30字）",
  "recommendations": [
    "建议1：可操作的具体建议",
    "建议2",
    "建议3"
  ],
  "riskWarnings": [
    "风险1：严肃的风险提醒",
    "风险2"
  ],
  "strategicAdvice": "200字以内的战略建议文本...",
  "consensusLevel": "moderate",
  "dissent": ["少数派意见"]
}

关键规则：
- overallBII 基于加权公式计算：语义新颖度×0.25 + 竞争态势×0.30 + 市场空白×0.25 + 可行性×0.20，但你可以在 ±5 范围内微调
- grade 标准：S(≥90), A(≥75), B(≥55), C(≥35), D(<35)
- consensusLevel：strong(一致性>80)/moderate(60-80)/weak(<60)
- recommendations 至少 3 条，必须可操作
- riskWarnings 至少 2 条，必须严肃真诚
`;

    try {
        const { text } = await callAIRaw(prompt, input.modelProvider, 65000, 6144, undefined, input._abortSignal);
        const parsed = parseAgentJSON<StrategicArbiterResult>(text);

        if (!parsed || typeof parsed.overallBII !== 'number') {
            throw new Error('战略仲裁官返回数据不完整');
        }

        // 基准 BII 计算
        const baseBII = Math.round(
            calibratedScores.semanticNovelty * WEIGHTS.semanticNovelty +
            calibratedScores.competitiveLandscape * WEIGHTS.competitiveLandscape +
            calibratedScores.marketGap * WEIGHTS.marketGap +
            calibratedScores.feasibility * WEIGHTS.feasibility
        );

        // AI 可在 ±5 范围微调
        parsed.overallBII = Math.max(0, Math.min(100,
            Math.abs(parsed.overallBII - baseBII) <= 5 ? parsed.overallBII : baseBII
        ));

        // 强制 grade 逻辑
        parsed.grade = determineGrade(parsed.overallBII);

        // 计算加权明细
        parsed.weightedBreakdown = {
            semanticNovelty: { raw: calibratedScores.semanticNovelty, weight: WEIGHTS.semanticNovelty, weighted: Math.round(calibratedScores.semanticNovelty * WEIGHTS.semanticNovelty) },
            competitiveLandscape: { raw: calibratedScores.competitiveLandscape, weight: WEIGHTS.competitiveLandscape, weighted: Math.round(calibratedScores.competitiveLandscape * WEIGHTS.competitiveLandscape) },
            marketGap: { raw: calibratedScores.marketGap, weight: WEIGHTS.marketGap, weighted: Math.round(calibratedScores.marketGap * WEIGHTS.marketGap) },
            feasibility: { raw: calibratedScores.feasibility, weight: WEIGHTS.feasibility, weighted: Math.round(calibratedScores.feasibility * WEIGHTS.feasibility) },
        };

        parsed.recommendations = parsed.recommendations || [];
        parsed.riskWarnings = parsed.riskWarnings || [];
        parsed.dissent = parsed.dissent || [];

        return parsed;
    } catch (err: any) {
        console.error('[战略仲裁官] 执行失败，使用降级策略:', err.message);
        return createFallbackArbiter(calibratedScores, crossValidation);
    }
}

function determineGrade(bii: number): StrategicArbiterResult['grade'] {
    if (bii >= 90) return 'S';
    if (bii >= 75) return 'A';
    if (bii >= 55) return 'B';
    if (bii >= 35) return 'C';
    return 'D';
}

function createFallbackArbiter(
    scores: CrossValidationResult['calibratedScores'],
    cv: CrossValidationResult,
): StrategicArbiterResult {
    const bii = Math.round(
        scores.semanticNovelty * WEIGHTS.semanticNovelty +
        scores.competitiveLandscape * WEIGHTS.competitiveLandscape +
        scores.marketGap * WEIGHTS.marketGap +
        scores.feasibility * WEIGHTS.feasibility
    );

    return {
        overallBII: bii,
        grade: determineGrade(bii),
        verdict: '基于数据的初步评估，建议完善后重新分析',
        recommendations: ['完善核心差异化定位', '进行目标用户访谈验证', '研究头部竞品的商业模式'],
        riskWarnings: ['此报告基于降级策略，仲裁官分析未完成', '建议稍后重试以获得完整战略建议'],
        strategicAdvice: '战略仲裁官异常，此为基于校准评分的初步建议。请重新运行分析以获得详细战略指导。',
        weightedBreakdown: {
            semanticNovelty: { raw: scores.semanticNovelty, weight: WEIGHTS.semanticNovelty, weighted: Math.round(scores.semanticNovelty * WEIGHTS.semanticNovelty) },
            competitiveLandscape: { raw: scores.competitiveLandscape, weight: WEIGHTS.competitiveLandscape, weighted: Math.round(scores.competitiveLandscape * WEIGHTS.competitiveLandscape) },
            marketGap: { raw: scores.marketGap, weight: WEIGHTS.marketGap, weighted: Math.round(scores.marketGap * WEIGHTS.marketGap) },
            feasibility: { raw: scores.feasibility, weight: WEIGHTS.feasibility, weighted: Math.round(scores.feasibility * WEIGHTS.feasibility) },
        },
        consensusLevel: cv.consistencyScore > 80 ? 'strong' : cv.consistencyScore > 60 ? 'moderate' : 'weak',
        dissent: ['仲裁官异常，无分歧分析'],
    };
}
