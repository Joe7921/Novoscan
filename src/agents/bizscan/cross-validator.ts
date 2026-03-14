/**
 * Bizscan 交叉验证引擎 (Layer 3)
 *
 * Bizscan 独有设计 — 常规查重没有此层。
 *
 * 职责：识别4份L1+L2报告间的分歧和矛盾，做评分校准和证据交叉核验。
 * 架构角色：Layer3（串行，依赖全部 L1+L2 报告）
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import type {
    BizscanAgentInput,
    BizscanAgentOutput,
    MarketScoutOutput,
    CompetitorProfilerOutput,
    CrossValidationResult,
} from './types';

export async function crossValidator(
    input: BizscanAgentInput,
    marketScout: MarketScoutOutput,
    competitorProfiler: CompetitorProfilerOutput,
    noveltyAuditor: BizscanAgentOutput,
    feasibilityExaminer: BizscanAgentOutput,
): Promise<CrossValidationResult> {
    const prompt = `
# 系统角色

你是一位元分析师（Meta-Analyst），你的工作不是分析商业想法本身，而是分析和校准其他分析师的报告。
你追求的是：逻辑一致性、证据可靠性和评分合理性。

---

# 任务

以下是4位专家对同一商业想法的独立评估报告。请识别分歧、做评分校准、并交叉核验证据。

## 专家报告摘要

### 1. 市场侦察员（评分: ${marketScout.score}/100, 置信度: ${marketScout.confidence}）
分析: ${marketScout.analysis.slice(0, 200)}
关键发现: ${marketScout.keyFindings.slice(0, 3).join('; ')}
红旗: ${marketScout.redFlags.join('; ') || '无'}
维度: ${marketScout.dimensionScores.map(d => `${d.name}:${d.score}`).join(', ')}

### 2. 竞品拆解师（评分: ${competitorProfiler.score}/100, 置信度: ${competitorProfiler.confidence}）
分析: ${competitorProfiler.analysis.slice(0, 200)}
发现竞品: ${competitorProfiler.competitors.length} 个
红旗: ${competitorProfiler.redFlags.join('; ') || '无'}
维度: ${competitorProfiler.dimensionScores.map(d => `${d.name}:${d.score}`).join(', ')}

### 3. 创新度审计师（评分: ${noveltyAuditor.score}/100, 置信度: ${noveltyAuditor.confidence}）
分析: ${noveltyAuditor.analysis.slice(0, 200)}
关键发现: ${noveltyAuditor.keyFindings.slice(0, 3).join('; ')}
红旗: ${noveltyAuditor.redFlags.join('; ') || '无'}
维度: ${noveltyAuditor.dimensionScores.map(d => `${d.name}:${d.score}`).join(', ')}

### 4. 可行性检验师（评分: ${feasibilityExaminer.score}/100, 置信度: ${feasibilityExaminer.confidence}）
分析: ${feasibilityExaminer.analysis.slice(0, 200)}
关键发现: ${feasibilityExaminer.keyFindings.slice(0, 3).join('; ')}
红旗: ${feasibilityExaminer.redFlags.join('; ') || '无'}
维度: ${feasibilityExaminer.dimensionScores.map(d => `${d.name}:${d.score}`).join(', ')}

---

# 交叉验证步骤

**Step 1 - 分歧识别**：哪些维度评分差异超过 20 分？对同一事实的描述是否矛盾？
**Step 2 - 证据交叉核验**：各专家引用的证据是否一致？是否有专家忽视了关键证据？
**Step 3 - 评分校准**：基于一致性分析，生成校准后的四维度评分

---

# 输出格式

严格按以下 JSON 格式输出：
{
  "divergences": [
    {
      "dimension": "分歧所在维度",
      "agents": ["Agent1", "Agent2"],
      "scoreDelta": 25,
      "resolution": "如何解决这个分歧..."
    }
  ],
  "calibratedScores": {
    "semanticNovelty": 60,
    "competitiveLandscape": 50,
    "marketGap": 65,
    "feasibility": 70
  },
  "consistencyScore": 75,
  "evidenceConflicts": ["冲突描述1", "冲突描述2"]
}

关键规则：
- calibratedScores 的四个分数必须是 0-100 整数
- semanticNovelty 主要参考创新度审计师
- competitiveLandscape 主要参考竞品拆解师
- marketGap 主要参考市场侦察员
- feasibility 主要参考可行性检验师
- 但每个分数都应考虑其他报告的交叉验证信息做校准
- consistencyScore 表示4份报告的内部一致性（0-100，越高越一致）
`;

    try {
        const { text } = await callAIRaw(prompt, input.modelProvider, 50000, 2048, undefined, input._abortSignal);
        const parsed = parseAgentJSON<CrossValidationResult>(text);

        if (!parsed || !parsed.calibratedScores) {
            throw new Error('交叉验证引擎返回数据不完整');
        }

        // 确保分数范围
        const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n || 50)));
        parsed.calibratedScores = {
            semanticNovelty: clamp(parsed.calibratedScores.semanticNovelty),
            competitiveLandscape: clamp(parsed.calibratedScores.competitiveLandscape),
            marketGap: clamp(parsed.calibratedScores.marketGap),
            feasibility: clamp(parsed.calibratedScores.feasibility),
        };
        parsed.consistencyScore = clamp(parsed.consistencyScore);
        parsed.divergences = parsed.divergences || [];
        parsed.evidenceConflicts = parsed.evidenceConflicts || [];

        return parsed;
    } catch (err: unknown) {
        console.error('[交叉验证引擎] 执行失败，使用降级策略:', err instanceof Error ? err.message : String(err));
        return createFallbackCrossValidation(marketScout, competitorProfiler, noveltyAuditor, feasibilityExaminer);
    }
}

/** 降级策略：直接取各Agent相关维度的得分 */
function createFallbackCrossValidation(
    ms: MarketScoutOutput,
    cp: CompetitorProfilerOutput,
    na: BizscanAgentOutput,
    fe: BizscanAgentOutput,
): CrossValidationResult {
    return {
        divergences: [],
        calibratedScores: {
            semanticNovelty: na.score,
            competitiveLandscape: cp.score,
            marketGap: ms.score,
            feasibility: fe.score,
        },
        consistencyScore: 50,
        evidenceConflicts: ['交叉验证引擎异常，评分为各Agent直接输出（未经校准）'],
    };
}
