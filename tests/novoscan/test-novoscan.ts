/**
 * Novoscan 常规模式 全自动基准测试脚本
 * 
 * 测试层级：
 *   T1: 质量护卫纯逻辑验证（qualityGuard 函数 8 项检查维度）
 *   T2: 智能 Fallback 生成器验证（学术/产业/竞品/创新评估师）
 *   T3: NovoDebate 辩论触发与评分修正
 *   T4: 加权公式与等级判定边界验证
 *   T5: 格式转换 transformToLegacyFormat 验证
 *   T6: 编排器降级集成验证
 * 
 * 使用方式：npx tsx tests/novoscan/test-novoscan.ts
 */

// ============================================================
//  测试框架（复用 Bizscan 测试的轻量级框架）
// ============================================================

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    durationMs: number;
}

const results: TestResult[] = [];
let passCount = 0;
let failCount = 0;
const layerStats: Record<string, { pass: number; fail: number }> = {};

function test(name: string, fn: () => void) {
    const layer = name.split(' ')[0]; // e.g. "T1.1"
    const layerKey = layer.split('.')[0]; // e.g. "T1"
    if (!layerStats[layerKey]) layerStats[layerKey] = { pass: 0, fail: 0 };

    const start = Date.now();
    try {
        fn();
        passCount++;
        layerStats[layerKey].pass++;
        results.push({ name, passed: true, durationMs: Date.now() - start });
        console.log(`  ✅ ${name}`);
    } catch (err: any) {
        failCount++;
        layerStats[layerKey].fail++;
        results.push({ name, passed: false, error: err.message, durationMs: Date.now() - start });
        console.log(`  ❌ ${name}: ${err.message}`);
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
    const msg = message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    if (actual !== expected) throw new Error(msg);
}

function assertInRange(value: number, min: number, max: number, label: string) {
    if (value < min || value > max) {
        throw new Error(`${label} = ${value}，不在预期范围 [${min}, ${max}]`);
    }
}

// ============================================================
//  导入被测模块
// ============================================================

import { qualityGuard } from '../../src/agents/qualityGuard';
import { createFallbackAgentOutput, createFallbackArbitration, transformToLegacyFormat, FALLBACK_CONFIG, RECOMMENDATION_THRESHOLDS, mapScoreToRecommendation } from '../../src/agents/orchestrator';
import { shouldTriggerDebate, calculateScoreAdjustment } from '../../src/agents/debater';
import type {
    AgentOutput, ArbitrationResult, WeightedScoreItem,
    DebateExchange, DebateRecord, FinalReport, QualityCheckResult
} from '../../src/agents/types';

// ============================================================
//  Mock 数据构造工具
// ============================================================

function mockAgentOutput(
    name: string,
    score: number,
    opts?: Partial<AgentOutput>
): AgentOutput {
    return {
        agentName: name,
        analysis: `${name}的详细分析报告，包含多个段落的完整分析内容。`,
        score,
        confidence: 'medium',
        confidenceReasoning: '基于检索数据的 AI 深度分析',
        keyFindings: [`${name}发现1`, `${name}发现2`, `${name}发现3`],
        redFlags: [`${name}风险1`],
        evidenceSources: [`来源A`, `来源B`],
        reasoning: `${name}的完整推理过程（CoT 留痕），包含多步推理。`,
        dimensionScores: [
            { name: '维度1', score: score - 5, reasoning: '测试' },
            { name: '维度2', score: score + 5, reasoning: '测试' },
        ],
        ...opts
    };
}

function mockArbitration(
    overallScore: number,
    opts?: Partial<ArbitrationResult>
): ArbitrationResult {
    const recommendation = overallScore >= 80 ? '强烈推荐'
        : overallScore >= 65 ? '推荐'
            : overallScore >= 45 ? '谨慎考虑'
                : '不推荐';

    return {
        summary: '多专家综合分析后的结论摘要，包含完整的分析内容。',
        overallScore,
        recommendation,
        conflictsResolved: ['冲突1已解决'],
        nextSteps: ['下一步建议1', '下一步建议2'],
        weightedBreakdown: {
            academic: { raw: 70, weight: 0.30, weighted: 21, confidence: 'high' as const },
            industry: { raw: 60, weight: 0.25, weighted: 15, confidence: 'medium' as const },
            innovation: { raw: 65, weight: 0.35, weighted: 22.75, confidence: 'medium' as const },
            competitor: { raw: 55, weight: 0.10, weighted: 5.5, confidence: 'medium' as const },
        },
        consensusLevel: 'moderate' as const,
        dissent: [],
        ...opts
    };
}

function mockDebateRecord(triggered: boolean, sessions: any[] = []): DebateRecord {
    return {
        triggered,
        triggerReason: triggered ? '检测到专家分歧' : '共识度高，无需辩论',
        sessions,
        totalDurationMs: 5000,
        dissentReport: [],
        dissentReportText: ''
    };
}

function mockExchange(
    challenger: string,
    defender: string,
    outcome: 'challenger_wins' | 'defender_wins' | 'draw',
    round: number = 1
): DebateExchange {
    return {
        round,
        challenger,
        challengerArgument: `${challenger}对${defender}的质疑论点`,
        challengerEvidence: ['证据1', '证据2'],
        defender,
        defenderRebuttal: `${defender}的反驳论点`,
        defenderEvidence: ['反驳证据1'],
        outcome,
        outcomeReasoning: '裁判理由'
    };
}

// ============================================================
//  T1: 质量护卫纯逻辑验证（qualityGuard 函数）
// ============================================================

console.log('\n🧪 T1: 质量护卫纯逻辑验证');
console.log('─'.repeat(50));

test('T1.1 正常数据通过质量检查', () => {
    const agents = [
        mockAgentOutput('学术审查员', 70),
        mockAgentOutput('产业分析员', 65),
        mockAgentOutput('创新评估师', 68),
        mockAgentOutput('竞品侦探', 60),
    ];
    const arb = mockArbitration(66);
    const result = qualityGuard(arb, agents);
    assert(result.passed, `正常数据应通过质量检查，issues: ${result.issues.join(', ')}`);
    assert(result.consistencyScore > 50, `一致性分应 > 50，实际 ${result.consistencyScore}`);
});

test('T1.2 检测综合评分超范围（负数）', () => {
    const agents = [mockAgentOutput('A', 50), mockAgentOutput('B', 50)];
    const arb = mockArbitration(50, { overallScore: -5 });
    const result = qualityGuard(arb, agents);
    assert(result.issues.length > 0, '负评分应触发 issue');
    assert(result.issues.some(i => i.includes('有效范围')), '应提到有效范围');
});

test('T1.3 检测综合评分超范围（超 100）', () => {
    const agents = [mockAgentOutput('A', 50), mockAgentOutput('B', 50)];
    const arb = mockArbitration(50, { overallScore: 105 });
    const result = qualityGuard(arb, agents);
    assert(result.issues.length > 0, '超 100 评分应触发 issue');
});

test('T1.4 检测摘要缺失或过短', () => {
    const agents = [mockAgentOutput('A', 50)];
    const arb = mockArbitration(50, { summary: '' });
    const result = qualityGuard(arb, agents);
    assert(result.issues.some(i => i.includes('摘要')), '空摘要应触发 issue');
});

test('T1.5 检测缺失建议', () => {
    const agents = [mockAgentOutput('A', 50)];
    const arb = mockArbitration(50, { recommendation: '' });
    const result = qualityGuard(arb, agents);
    assert(result.issues.some(i => i.includes('建议')), '缺失建议应触发 issue');
});

test('T1.6 检测高分+不推荐逻辑矛盾', () => {
    const agents = [mockAgentOutput('A', 85)];
    const arb = mockArbitration(85, { recommendation: '不推荐' });
    const result = qualityGuard(arb, agents);
    assert(result.issues.some(i => i.includes('逻辑矛盾')), '高分不推荐应触发逻辑矛盾 issue');
});

test('T1.7 检测低分+强烈推荐逻辑矛盾', () => {
    const agents = [mockAgentOutput('A', 30)];
    const arb = mockArbitration(30, { recommendation: '强烈推荐' });
    const result = qualityGuard(arb, agents);
    assert(result.issues.some(i => i.includes('逻辑矛盾')), '低分强烈推荐应触发逻辑矛盾 issue');
});

test('T1.8 检测 Agent 评分高离散度（标准差 > 25）', () => {
    const agents = [
        mockAgentOutput('学术', 10),
        mockAgentOutput('产业', 90),
        mockAgentOutput('创新', 50),
        mockAgentOutput('竞品', 50),
    ];
    const arb = mockArbitration(50);
    const result = qualityGuard(arb, agents);
    assert(result.warnings.some(w => w.includes('离散度') || w.includes('标准差')),
        '高离散度应触发 warning');
});

test('T1.9 检测极端评分对（极差 > 40）', () => {
    const agents = [
        mockAgentOutput('学术', 10),
        mockAgentOutput('产业', 90),
        mockAgentOutput('创新', 60),
        mockAgentOutput('竞品', 55),
    ];
    const arb = mockArbitration(55);
    const result = qualityGuard(arb, agents);
    assert(result.warnings.some(w => w.includes('极差')),
        '极差 > 40 应触发 warning');
});

test('T1.10 检测置信度 vs 评分矛盾（低置信高分）', () => {
    const agents = [
        mockAgentOutput('测试Agent', 90, { confidence: 'low' }),
    ];
    const arb = mockArbitration(90);
    const result = qualityGuard(arb, agents);
    assert(result.warnings.some(w => w.includes('低置信度') && w.includes('高')),
        '低置信但高分应触发 warning');
});

test('T1.11 检测缺失证据来源', () => {
    const agents = [
        mockAgentOutput('A', 60, { evidenceSources: [] }),
        mockAgentOutput('B', 60, { evidenceSources: [] }),
    ];
    const arb = mockArbitration(60);
    const result = qualityGuard(arb, agents);
    assert(result.warnings.some(w => w.includes('证据来源')),
        '缺失证据来源应触发 warning');
});

test('T1.12 检测加权权重之和不为 1.0', () => {
    const agents = [mockAgentOutput('A', 60)];
    const arb = mockArbitration(60, {
        weightedBreakdown: {
            academic: { raw: 70, weight: 0.20, weighted: 14, confidence: 'high' as const },
            industry: { raw: 60, weight: 0.20, weighted: 12, confidence: 'medium' as const },
            innovation: { raw: 65, weight: 0.20, weighted: 13, confidence: 'medium' as const },
            competitor: { raw: 55, weight: 0.20, weighted: 11, confidence: 'medium' as const },
        }
    });
    const result = qualityGuard(arb, agents);
    assert(result.warnings.some(w => w.includes('权重')),
        '权重之和 0.80 ≠ 1.0 应触发 warning');
});

test('T1.13 评分-证据一致性（高分少证据 → warning）', () => {
    const agents = [
        mockAgentOutput('测试Agent', 85, { evidenceSources: ['仅一条证据'] }),
    ];
    const arb = mockArbitration(85);
    const result = qualityGuard(arb, agents);
    assert(result.warnings.some(w => w.includes('数据支撑不足') || w.includes('证据来源')),
        '高分但仅 1 条证据应触发 warning');
});

test('T1.14 评分-证据一致性（高分+高置信+零证据 → issue）', () => {
    const agents = [
        mockAgentOutput('测试Agent', 90, { confidence: 'high', evidenceSources: [] }),
    ];
    const arb = mockArbitration(90);
    const result = qualityGuard(arb, agents);
    assert(result.issues.some(i => i.includes('高分空口无凭')),
        '高分+高置信+零证据应升级为 issue');
    assert(!result.passed, '应不通过质量检查');
});

// ============================================================
//  T2: 智能 Fallback 生成器验证
// ============================================================

console.log('\n🧪 T2: 智能 Fallback 生成器验证');
console.log('─'.repeat(50));

test('T2.1 学术审查员 — 零论文推高创新性', () => {
    const input = {
        query: '测试创新点',
        academicData: {
            source: 'test',
            results: [],
            stats: { totalPapers: 0, totalCitations: 0, openAccessCount: 0, avgCitation: 0, bySource: { openAlex: 0, arxiv: 0, crossref: 0, core: 0 }, topCategories: [] },
            topConcepts: []
        },
        industryData: { webResults: [], githubRepos: [], sentiment: 'neutral', topProjects: [] } as any,
        language: 'zh' as const,
        modelProvider: 'deepseek' as const
    };
    const result = createFallbackAgentOutput('学术审查员', input);
    assertInRange(result.score, 80, 95, '零论文学术审查员 fallback 分');
});

test('T2.2 学术审查员 — 大量论文压低创新性', () => {
    const papers = Array.from({ length: 25 }, (_, i) => ({ title: `Paper ${i}`, year: 2024, citationCount: 50 }));
    const input = {
        query: '测试创新点',
        academicData: {
            source: 'test',
            results: papers,
            stats: { totalPapers: 25, totalCitations: 1250, openAccessCount: 10, avgCitation: 50, bySource: { openAlex: 15, arxiv: 5, crossref: 3, core: 2 }, topCategories: [] },
            topConcepts: []
        },
        industryData: { webResults: [], githubRepos: [], sentiment: 'neutral', topProjects: [] } as any,
        language: 'zh' as const,
        modelProvider: 'deepseek' as const
    };
    const result = createFallbackAgentOutput('学术审查员', input);
    assertInRange(result.score, 10, 35, '大量论文学术审查员 fallback 分');
});

test('T2.3 学术审查员 — 高引修正', () => {
    const papers3 = Array.from({ length: 3 }, (_, i) => ({ title: `Paper ${i}`, year: 2024, citationCount: 200 }));
    const inputBase = {
        query: '测试',
        academicData: {
            source: 'test', results: papers3,
            stats: { totalPapers: 3, totalCitations: 600, openAccessCount: 1, avgCitation: 10, bySource: { openAlex: 2, arxiv: 1, crossref: 0, core: 0 }, topCategories: [] },
            topConcepts: []
        },
        industryData: { webResults: [], githubRepos: [], sentiment: 'neutral', topProjects: [] } as any,
        language: 'zh' as const, modelProvider: 'deepseek' as const
    };
    const inputHighCite = {
        ...inputBase,
        academicData: {
            ...inputBase.academicData,
            stats: { ...inputBase.academicData.stats, avgCitation: 150 }
        }
    };
    const resultBase = createFallbackAgentOutput('学术审查员', inputBase);
    const resultHighCite = createFallbackAgentOutput('学术审查员', inputHighCite);
    assert(resultHighCite.score < resultBase.score,
        `高引(${resultHighCite.score})应低于低引(${resultBase.score})`);
});

test('T2.4 产业分析员 — 零市场信号推高创新性', () => {
    const input = {
        query: '测试',
        academicData: { source: 'test', results: [], stats: { totalPapers: 0, totalCitations: 0, openAccessCount: 0, avgCitation: 0, bySource: { openAlex: 0, arxiv: 0, crossref: 0, core: 0 }, topCategories: [] }, topConcepts: [] },
        industryData: { webResults: [], githubRepos: [], sentiment: 'neutral', topProjects: [] } as any,
        language: 'zh' as const, modelProvider: 'deepseek' as const
    };
    const result = createFallbackAgentOutput('产业分析员', input);
    assertInRange(result.score, 75, 95, '零市场信号产业分析员 fallback 分');
});

test('T2.5 产业分析员 — 大量市场信号压低', () => {
    const input = {
        query: '测试',
        academicData: { source: 'test', results: [], stats: { totalPapers: 0, totalCitations: 0, openAccessCount: 0, avgCitation: 0, bySource: { openAlex: 0, arxiv: 0, crossref: 0, core: 0 }, topCategories: [] }, topConcepts: [] },
        industryData: {
            webResults: Array.from({ length: 30 }, (_, i) => ({ title: `Web ${i}`, url: `http://example.com/${i}` })),
            githubRepos: Array.from({ length: 12 }, (_, i) => ({ name: `repo${i}`, stars: 100 })),
            sentiment: 'positive',
            topProjects: []
        } as any,
        language: 'zh' as const, modelProvider: 'deepseek' as const
    };
    const result = createFallbackAgentOutput('产业分析员', input);
    assertInRange(result.score, 10, 30, '大量市场信号产业分析员 fallback 分');
});

test('T2.6 竞品侦探 — 无 GitHub 竞品', () => {
    const input = {
        query: '测试',
        academicData: { source: 'test', results: [], stats: { totalPapers: 0, totalCitations: 0, openAccessCount: 0, avgCitation: 0, bySource: { openAlex: 0, arxiv: 0, crossref: 0, core: 0 }, topCategories: [] }, topConcepts: [] },
        industryData: { webResults: [], githubRepos: [], sentiment: 'neutral', topProjects: [] } as any,
        language: 'zh' as const, modelProvider: 'deepseek' as const
    };
    const result = createFallbackAgentOutput('竞品侦探', input);
    assertInRange(result.score, 80, 95, '无竞品的竞品侦探 fallback 分');
});

test('T2.7 竞品侦探 — 多个高星竞品', () => {
    const input = {
        query: '测试',
        academicData: { source: 'test', results: [], stats: { totalPapers: 0, totalCitations: 0, openAccessCount: 0, avgCitation: 0, bySource: { openAlex: 0, arxiv: 0, crossref: 0, core: 0 }, topCategories: [] }, topConcepts: [] },
        industryData: {
            webResults: [],
            githubRepos: [
                { name: 'big-project-1', stars: 15000 },
                { name: 'big-project-2', stars: 8000 },
                { name: 'big-project-3', stars: 6000 },
                { name: 'small-project', stars: 200 },
            ],
            sentiment: 'positive',
            topProjects: [{ name: 'big-project-1', stars: 15000 }, { name: 'big-project-2', stars: 8000 }]
        } as any,
        language: 'zh' as const, modelProvider: 'deepseek' as const
    };
    const result = createFallbackAgentOutput('竞品侦探', input);
    assertInRange(result.score, 10, 35, '多高星竞品侦探 fallback 分');
});

test('T2.8 所有 Fallback 标记验证', () => {
    const names = ['学术审查员', '产业分析员', '竞品侦探', '创新评估师'];
    for (const name of names) {
        const result = createFallbackAgentOutput(name);
        assert(result.isFallback === true, `${name} 的 fallback 应有 isFallback: true`);
        assertEqual(result.confidence, 'low', `${name} 的 fallback 应有 confidence: 'low'`);
        assert(result.agentName === name, `${name} 的 agentName 应正确`);
    }
});

// ============================================================
//  T3: NovoDebate 辩论触发与评分修正
// ============================================================

console.log('\n🧪 T3: NovoDebate 辩论触发与评分修正');
console.log('─'.repeat(50));

test('T3.1 高共识度不触发辩论', () => {
    const agents = {
        academic: mockAgentOutput('学术审查员', 50),
        industry: mockAgentOutput('产业分析员', 52),
        innovation: mockAgentOutput('创新评估师', 48),
        competitor: mockAgentOutput('竞品侦探', 51),
    };
    const result = shouldTriggerDebate(agents);
    assertEqual(result.trigger, false, `高共识度应返回 trigger: false，实际: ${result.trigger}，原因: ${result.reason}`);
});

test('T3.2 大分歧触发辩论', () => {
    const agents = {
        academic: mockAgentOutput('学术审查员', 80),
        industry: mockAgentOutput('产业分析员', 60),
        innovation: mockAgentOutput('创新评估师', 55),
        competitor: mockAgentOutput('竞品侦探', 20),
    };
    const result = shouldTriggerDebate(agents);
    assertEqual(result.trigger, true, `大分歧应触发辩论，原因: ${result.reason}`);
    assert(result.pairs.length > 0, '应有辩论对');
    assert(result.pairs.some(p => p.divergence > 15), '辩论对差异应 > 15');
});

test('T3.3 标准差高且动态配对发现大分歧', () => {
    // 学术=80, 竞品=75 → 差5; 产业=30, 创新=25 → 差5; 但学术 vs 产业 = 50
    const agents = {
        academic: mockAgentOutput('学术审查员', 80),
        industry: mockAgentOutput('产业分析员', 30),
        innovation: mockAgentOutput('创新评估师', 25),
        competitor: mockAgentOutput('竞品侦探', 75),
    };
    const result = shouldTriggerDebate(agents);
    // 动态配对应检测到学术(80) vs 创新(25) = 55 分差异，触发辩论
    assertEqual(result.trigger, true,
        `动态配对应触发辩论（最大分歧达 55 分），原因: ${result.reason}`);
    assert(result.reason.includes('动态配对'), '应明确说明是动态配对触发');
});

test('T3.3b 所有 Agent 对差异均不超阈值不触发', () => {
    // 所有两两配对差异均 ≤ 15
    const agents = {
        academic: mockAgentOutput('学术审查员', 50),
        industry: mockAgentOutput('产业分析员', 40),
        innovation: mockAgentOutput('创新评估师', 45),
        competitor: mockAgentOutput('竞品侦探', 35),
    };
    const result = shouldTriggerDebate(agents);
    assertEqual(result.trigger, false,
        `所有对差异 ≤ 15 时不应触发，原因: ${result.reason}`);
});

test('T3.4 评分修正 — 挑战方 3 轮全胜封顶 ±15', () => {
    const exchanges: DebateExchange[] = [
        mockExchange('学术审查员', '竞品侦探', 'challenger_wins', 1),
        mockExchange('竞品侦探', '学术审查员', 'defender_wins', 2),  // 学术审查员防守胜 = 学术审查员+5
        mockExchange('学术审查员', '竞品侦探', 'challenger_wins', 3),
    ];
    const result = calculateScoreAdjustment(exchanges, '学术审查员', '竞品侦探');
    assertEqual(result.proAgentDelta, 15, `学术审查员 3 轮全胜应 +15（封顶），实际 ${result.proAgentDelta}`);
    assertEqual(result.conAgentDelta, -15, `竞品侦探应 -15（封顶），实际 ${result.conAgentDelta}`);
});

test('T3.5 评分修正 — 空 exchanges 归零', () => {
    const result = calculateScoreAdjustment([], '学术审查员', '竞品侦探');
    assertEqual(result.proAgentDelta, 0, '空 exchanges 应 proAgentDelta 为 0');
    assertEqual(result.conAgentDelta, 0, '空 exchanges 应 conAgentDelta 为 0');
});

test('T3.6 辩论质量检查集成 — 高分歧未触发辩论应告警', () => {
    const agents = [
        mockAgentOutput('学术审查员', 10),
        mockAgentOutput('产业分析员', 60),
        mockAgentOutput('创新评估师', 60),
        mockAgentOutput('竞品侦探', 90),
    ];
    const arb = mockArbitration(55);
    // 辩论未触发但分歧很大
    const debate = mockDebateRecord(false);
    debate.triggered = false;
    const result = qualityGuard(arb, agents, debate);
    assert(result.warnings.some(w => w.includes('辩论') || w.includes('NovoDebate')),
        '高分歧未触发辩论应在质量检查中告警');
});

// ============================================================
//  T4: 加权公式与等级判定验证
// ============================================================

console.log('\n🧪 T4: 加权公式与等级判定验证');
console.log('─'.repeat(50));

test('T4.1 常规模式加权权重之和为 1.0', () => {
    // 常规模式权重：学术 0.30 + 产业 0.25 + 创新 0.35 + 竞品 0.10
    const WEIGHTS = { academic: 0.30, industry: 0.25, innovation: 0.35, competitor: 0.10 };
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    assertEqual(sum, 1.0, `权重之和应为 1.0，实际 ${sum}`);
});

test('T4.2 加权计算数值验证', () => {
    const scores = { academic: 80, industry: 70, innovation: 60, competitor: 90 };
    const WEIGHTS = { academic: 0.30, industry: 0.25, innovation: 0.35, competitor: 0.10 };
    const weighted =
        scores.academic * WEIGHTS.academic +
        scores.industry * WEIGHTS.industry +
        scores.innovation * WEIGHTS.innovation +
        scores.competitor * WEIGHTS.competitor;
    // 80*0.30 + 70*0.25 + 60*0.35 + 90*0.10 = 24 + 17.5 + 21 + 9 = 71.5
    assertEqual(weighted, 71.5, `加权结果应为 71.5，实际 ${weighted}`);
});

test('T4.3 Fallback 仲裁评分-推荐一致性', () => {
    // 高分
    const highAgents = [
        mockAgentOutput('A', 90), mockAgentOutput('B', 85),
        mockAgentOutput('C', 80), mockAgentOutput('D', 85)
    ];
    const highResult = createFallbackArbitration(highAgents);
    assert(highResult.recommendation.includes('强烈推荐'),
        `均分 85 应为"强烈推荐"，实际: ${highResult.recommendation}`);

    // 低分
    const lowAgents = [
        mockAgentOutput('A', 30), mockAgentOutput('B', 35),
        mockAgentOutput('C', 25), mockAgentOutput('D', 30)
    ];
    const lowResult = createFallbackArbitration(lowAgents);
    assert(lowResult.recommendation.includes('不推荐'),
        `均分 30 应为"不推荐"，实际: ${lowResult.recommendation}`);
});

test('T4.4 边界值推荐映射', () => {
    // 80 → 强烈推荐
    const r80 = createFallbackArbitration([mockAgentOutput('A', 80), mockAgentOutput('B', 80), mockAgentOutput('C', 80), mockAgentOutput('D', 80)]);
    assert(r80.recommendation.includes('强烈推荐'), `80 应为强烈推荐，实际: ${r80.recommendation}`);

    // 65 → 推荐
    const r65 = createFallbackArbitration([mockAgentOutput('A', 65), mockAgentOutput('B', 65), mockAgentOutput('C', 65), mockAgentOutput('D', 65)]);
    assert(r65.recommendation.includes('推荐'), `65 应包含"推荐"，实际: ${r65.recommendation}`);

    // 45 → 谨慎考虑
    const r45 = createFallbackArbitration([mockAgentOutput('A', 45), mockAgentOutput('B', 45), mockAgentOutput('C', 45), mockAgentOutput('D', 45)]);
    assert(r45.recommendation.includes('谨慎考虑'), `45 应为谨慎考虑，实际: ${r45.recommendation}`);

    // 30 → 不推荐
    const r30 = createFallbackArbitration([mockAgentOutput('A', 30), mockAgentOutput('B', 30), mockAgentOutput('C', 30), mockAgentOutput('D', 30)]);
    assert(r30.recommendation.includes('不推荐'), `30 应为不推荐，实际: ${r30.recommendation}`);
});

test('T4.5 权重偏差阈值检测', () => {
    // 权重之和 0.80（偏离 > 0.05）应触发 qualityGuard 告警
    const agents = [mockAgentOutput('A', 60)];
    const arb = mockArbitration(60, {
        weightedBreakdown: {
            academic: { raw: 70, weight: 0.20, weighted: 14, confidence: 'high' as const },
            industry: { raw: 60, weight: 0.20, weighted: 12, confidence: 'medium' as const },
            innovation: { raw: 65, weight: 0.20, weighted: 13, confidence: 'medium' as const },
            competitor: { raw: 55, weight: 0.20, weighted: 11, confidence: 'medium' as const },
        }
    });
    const result = qualityGuard(arb, agents);
    assert(result.warnings.some(w => w.includes('权重')), '权重之和偏差 > 0.05 应触发 warning');
});

test('T4.6 统一推荐映射函数验证', () => {
    assertEqual(mapScoreToRecommendation(100), '强烈推荐');
    assertEqual(mapScoreToRecommendation(80), '强烈推荐');
    assertEqual(mapScoreToRecommendation(79), '推荐');
    assertEqual(mapScoreToRecommendation(65), '推荐');
    assertEqual(mapScoreToRecommendation(64), '谨慎考虑');
    assertEqual(mapScoreToRecommendation(45), '谨慎考虑');
    assertEqual(mapScoreToRecommendation(44), '不推荐');
    assertEqual(mapScoreToRecommendation(0), '不推荐');
    // 验证阈值常量一致性
    assertEqual(RECOMMENDATION_THRESHOLDS.stronglyRecommend, 80);
    assertEqual(RECOMMENDATION_THRESHOLDS.recommend, 65);
    assertEqual(RECOMMENDATION_THRESHOLDS.caution, 45);
});

// ============================================================
//  T5: transformToLegacyFormat 格式转换验证
// ============================================================

console.log('\n🧪 T5: transformToLegacyFormat 格式转换验证');
console.log('─'.repeat(50));

function makeFinalReport(): FinalReport {
    return {
        academicReview: mockAgentOutput('学术审查员', 72, {
            keyFindings: ['学术发现1', '学术发现2', '学术发现3'],
            redFlags: ['学术风险1']
        }),
        industryAnalysis: mockAgentOutput('产业分析员', 65, {
            keyFindings: ['产业发现1', '产业发现2', '产业发现3'],
            redFlags: ['产业风险1']
        }),
        innovationEvaluation: mockAgentOutput('创新评估师', 68, {
            keyFindings: ['创新发现1', '创新发现2', '创新发现3'],
            redFlags: ['创新风险1']
        }),
        competitorAnalysis: mockAgentOutput('竞品侦探', 60, {
            keyFindings: ['竞品发现1', '竞品发现2'],
            redFlags: ['竞品风险1']
        }),
        debate: mockDebateRecord(false),
        arbitration: mockArbitration(66),
        qualityCheck: { passed: true, issues: [], warnings: [], consistencyScore: 85, corrections: [] },
    };
}

test('T5.1 必填字段完整性', () => {
    const report = makeFinalReport();
    const legacy = transformToLegacyFormat(report);
    assert('noveltyScore' in legacy, '应包含 noveltyScore');
    assert('internetNoveltyScore' in legacy, '应包含 internetNoveltyScore');
    assert('sections' in legacy, '应包含 sections');
    assert('keyPoints' in legacy, '应包含 keyPoints');
    assert(legacy.sections.academic !== undefined, '应包含 academic section');
    assert(legacy.sections.internet !== undefined, '应包含 internet section');
    assert(Array.isArray(legacy.keyPoints), 'keyPoints 应为数组');
    assert(legacy.keyPoints.length > 0, 'keyPoints 应非空');
});

test('T5.2 分数映射正确性', () => {
    const report = makeFinalReport();
    const legacy = transformToLegacyFormat(report);
    assertEqual(legacy.noveltyScore, 72, `noveltyScore 应映射学术审查员分 72，实际 ${legacy.noveltyScore}`);
    assertEqual(legacy.internetNoveltyScore, 65, `internetNoveltyScore 应映射产业分析员分 65，实际 ${legacy.internetNoveltyScore}`);
});

test('T5.3 redFlags 聚合到 improvementSuggestions', () => {
    const report = makeFinalReport();
    const legacy = transformToLegacyFormat(report);
    assert(legacy.improvementSuggestions !== undefined, 'improvementSuggestions 不应为 undefined');
    assert(legacy.improvementSuggestions!.includes('学术风险1'), '应包含学术 redFlag');
    assert(legacy.improvementSuggestions!.includes('产业风险1'), '应包含产业 redFlag');
    assert(legacy.improvementSuggestions!.includes('创新风险1'), '应包含创新 redFlag');
    assert(legacy.improvementSuggestions!.includes('竞品风险1'), '应包含竞品 redFlag');
});

// ============================================================
//  T6: 编排器降级集成验证
// ============================================================

console.log('\n🧪 T6: 编排器降级集成验证');
console.log('─'.repeat(50));

test('T6.1 createFallbackArbitration 平均分计算', () => {
    const agents = [
        mockAgentOutput('A', 60),
        mockAgentOutput('B', 80),
        mockAgentOutput('C', 40),
        mockAgentOutput('D', 100),
    ];
    const result = createFallbackArbitration(agents);
    // 平均值 = (60+80+40+100)/4 = 70
    assertEqual(result.overallScore, 70, `平均分应为 70，实际 ${result.overallScore}`);
});

test('T6.2 createFallbackArbitration 结构完整性', () => {
    const agents = [mockAgentOutput('A', 50, { isFallback: true })];
    const result = createFallbackArbitration(agents);
    assert(result.summary.length > 0, '摘要不应为空');
    assert(result.recommendation.length > 0, '建议不应为空');
    assert(Array.isArray(result.nextSteps), 'nextSteps 应为数组');
    assert(result.weightedBreakdown !== undefined, 'weightedBreakdown 不应为 undefined');
    assertEqual(result.consensusLevel, 'weak', '降级仲裁共识度应为 weak');
});

test('T6.3 创新评估师 Fallback 六维雷达图', () => {
    const result = createFallbackAgentOutput('创新评估师');
    assert(result.innovationRadar !== undefined, '创新评估师 fallback 应包含 innovationRadar');
    assertEqual(result.innovationRadar!.length, 6, `应有 6 个维度，实际 ${result.innovationRadar!.length}`);

    const expectedKeys = ['techBreakthrough', 'businessModel', 'userExperience', 'orgCapability', 'networkEcosystem', 'socialImpact'];
    for (const key of expectedKeys) {
        const dim = result.innovationRadar!.find(d => d.key === key);
        assert(dim !== undefined, `应包含维度 ${key}`);
        assertInRange(dim!.score, 0, 100, `${key} 的分数`);
        assert(dim!.nameZh.length > 0, `${key} 应有中文标签`);
        assert(dim!.nameEn.length > 0, `${key} 应有英文标签`);
    }
});

test('T6.4 FALLBACK_CONFIG 配置完整性验证', () => {
    // 学术配置
    assert(FALLBACK_CONFIG.academic.tiers.length >= 3, '学术层级应至少 3 个');
    assert(FALLBACK_CONFIG.academic.defaultScore > 0, '默认分应 > 0');
    assert(FALLBACK_CONFIG.academic.citationHighThreshold > FALLBACK_CONFIG.academic.citationLowThreshold,
        '高引阈值应 > 低引阈值');
    // 产业配置
    assert(FALLBACK_CONFIG.industry.tiers.length >= 3, '产业层级应至少 3 个');
    // 竞品配置
    assert(FALLBACK_CONFIG.competitor.highStarThreshold > 0, '高星阈值应 > 0');
    // 钳制范围
    assert(FALLBACK_CONFIG.clamp.min < FALLBACK_CONFIG.clamp.max, 'clamp.min 应 < clamp.max');
    assert(FALLBACK_CONFIG.clamp.min >= 0, 'clamp.min 应 >= 0');
    assert(FALLBACK_CONFIG.clamp.max <= 100, 'clamp.max 应 <= 100');
});

// ============================================================
//  T7: 质量门控逻辑验证（qualityGate 模块）
// ============================================================

console.log('\n🧪 T7: 质量门控逻辑验证');
console.log('─'.repeat(50));

import { shouldBlockStorage, computeQualityTier, computeConfidenceGate, QUALITY_GATE_CONFIG } from '../../src/lib/services/qualityGate';

test('T7.1 shouldBlockStorage — qualityCheck.passed=false 应阻止入库', () => {
    const qc: QualityCheckResult = { passed: false, issues: ['某个问题'], warnings: [], consistencyScore: 60, corrections: [] };
    const agents = [mockAgentOutput('A', 60), mockAgentOutput('B', 65)];
    const result = shouldBlockStorage(qc, agents);
    assert(result.blocked, '质量检查未通过应阻止入库');
    assert(result.reason.includes('质量检查未通过'), `原因应包含"质量检查未通过"，实际: ${result.reason}`);
});

test('T7.2 shouldBlockStorage — consistencyScore < 30 应阻止入库', () => {
    const qc: QualityCheckResult = { passed: true, issues: [], warnings: [], consistencyScore: 20, corrections: [] };
    const agents = [mockAgentOutput('A', 60)];
    const result = shouldBlockStorage(qc, agents);
    assert(result.blocked, '一致性评分 20 < 30 应阻止入库');
    assert(result.reason.includes('一致性评分过低'), `原因应包含"一致性评分过低"，实际: ${result.reason}`);
});

test('T7.3 shouldBlockStorage — 半数以上 Agent 为 low 置信度应阻止入库', () => {
    const qc: QualityCheckResult = { passed: true, issues: [], warnings: [], consistencyScore: 50, corrections: [] };
    const agents = [
        mockAgentOutput('A', 60, { confidence: 'low' }),
        mockAgentOutput('B', 55, { confidence: 'low' }),
        mockAgentOutput('C', 70, { confidence: 'medium' }),
    ];
    const result = shouldBlockStorage(qc, agents);
    assert(result.blocked, '2/3 Agent 低置信度应阻止入库');
    assert(result.reason.includes('低置信度'), `原因应包含"低置信度"，实际: ${result.reason}`);
});

test('T7.4 shouldBlockStorage — 正常数据应允许入库', () => {
    const qc: QualityCheckResult = { passed: true, issues: [], warnings: [], consistencyScore: 80, corrections: [] };
    const agents = [
        mockAgentOutput('A', 60, { confidence: 'high' }),
        mockAgentOutput('B', 65, { confidence: 'medium' }),
    ];
    const result = shouldBlockStorage(qc, agents);
    assert(!result.blocked, '正常数据应允许入库');
});

test('T7.5 computeQualityTier — 高一致性无 fallback 返回 high', () => {
    const qc: QualityCheckResult = { passed: true, issues: [], warnings: [], consistencyScore: 85, corrections: [] };
    const agents = [mockAgentOutput('A', 70), mockAgentOutput('B', 65)];
    const tier = computeQualityTier(qc, agents);
    assertEqual(tier, 'high', `高一致性应返回 high, 实际: ${tier}`);
});

test('T7.6 computeQualityTier — 有 fallback 降级到 medium', () => {
    const qc: QualityCheckResult = { passed: true, issues: [], warnings: [], consistencyScore: 85, corrections: [] };
    const agents = [
        mockAgentOutput('A', 70),
        mockAgentOutput('B', 50, { isFallback: true }),
    ];
    const tier = computeQualityTier(qc, agents);
    assertEqual(tier, 'medium', `有 fallback 应降到 medium，实际: ${tier}`);
});

test('T7.7 computeQualityTier — 低一致性返回 low', () => {
    const qc: QualityCheckResult = { passed: false, issues: ['问题'], warnings: [], consistencyScore: 25, corrections: [] };
    const agents = [mockAgentOutput('A', 50)];
    const tier = computeQualityTier(qc, agents);
    assertEqual(tier, 'low', `低一致性应返回 low，实际: ${tier}`);
});

test('T7.8 computeConfidenceGate — 全部 Agent fallback 应拦截', () => {
    const analysisResult = {
        academicReview: { confidence: 'low', isFallback: true },
        industryAnalysis: { confidence: 'low', isFallback: true },
        innovationEvaluation: { confidence: 'low', isFallback: true },
        competitorAnalysis: { confidence: 'low', isFallback: true },
    };
    const result = computeConfidenceGate(analysisResult);
    assert(!result.passed, '全部 fallback 应不通过');
    assertEqual(result.totalCount, 4, '应检测到 4 个 Agent');
});

test('T7.9 computeConfidenceGate — 混合置信度（多数 medium/high）应通过', () => {
    const analysisResult = {
        academicReview: { confidence: 'high', isFallback: false },
        industryAnalysis: { confidence: 'medium', isFallback: false },
        innovationEvaluation: { confidence: 'medium', isFallback: false },
        competitorAnalysis: { confidence: 'low', isFallback: false },
    };
    const result = computeConfidenceGate(analysisResult);
    assert(result.passed, '多数 medium/high 应通过');
    assertEqual(result.lowCount, 1, '低置信度应为 1 个');
});

test('T7.10 QUALITY_GATE_CONFIG 配置完整性', () => {
    assert(QUALITY_GATE_CONFIG.blockConsistencyThreshold > 0, '阻止阈值应 > 0');
    assert(QUALITY_GATE_CONFIG.highTierThreshold > QUALITY_GATE_CONFIG.mediumTierThreshold, 'high 阈值应 > medium');
    assert(QUALITY_GATE_CONFIG.trendWeights.high > QUALITY_GATE_CONFIG.trendWeights.medium, 'high 权重应 > medium');
    assert(QUALITY_GATE_CONFIG.trendWeights.medium > QUALITY_GATE_CONFIG.trendWeights.low, 'medium 权重应 > low');
    assertEqual(QUALITY_GATE_CONFIG.trendWeights.high, 1.0, 'high 权重应为 1.0');
});

// ============================================================
//  测试总结报告
// ============================================================

console.log('\n' + '═'.repeat(60));
console.log('📊 Novoscan 常规模式基准测试报告');
console.log('═'.repeat(60));

console.log('\n📋 各层通过率：');
for (const [layer, stat] of Object.entries(layerStats)) {
    const total = stat.pass + stat.fail;
    const pct = total > 0 ? Math.round(stat.pass / total * 100) : 0;
    const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
    console.log(`  ${layer}: ${bar} ${pct}% (${stat.pass}/${total})`);
}

console.log(`\n  ✅ 通过: ${passCount}`);
console.log(`  ❌ 失败: ${failCount}`);
console.log(`  📋 总计: ${results.length}`);

if (failCount > 0) {
    console.log('\n❌ 失败测试详情:');
    results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}`);
        console.log(`    ${r.error}`);
    });
}

// ============================================================
//  迭代改进建议（基于测试覆盖率分析）
// ============================================================

console.log('\n' + '═'.repeat(60));
console.log('💡 迭代改进建议');
console.log('═'.repeat(60));

const suggestions = [
    '1. [评分校准] qualityGuard 当前仅检查静态阈值（如极差 > 40），建议增加"评分-证据一致性"动态检查：\n   如果 Agent 评分 > 80 但 evidenceSources 数量 < 2，应生成 warning。这能捕获"高分空口无凭"场景。',
    '2. [Fallback 精度] 当前 Fallback 分数的边界值（如论文 3 篇 → 75 分）是硬编码魔法数字，\n   建议引入配置化阈值或自适应机制（根据不同领域的论文密度动态调整基线）。',
    '3. [辩论触发覆盖] shouldTriggerDebate 目前仅检查两个固定辩论对（学术vs竞品、产业vs创新），\n   高标准差但固定对差异不大时会漏掉辩论。建议增加动态配对机制，自动挑选分歧最大的 Agent 对。',
    '4. [推荐等级断裂] createFallbackArbitration 的推荐映射（80/65/45）和 qualityGuard 的矛盾检测阈值\n   （80/45）之间存在 gap（45~65 区间的边界行为未充分测试），建议统一推荐等级映射逻辑。',
    '5. [NovoDebate 封顶风险] calculateScoreAdjustment 上限 ±15 = 3轮×5分，恰好 3 轮全胜即封顶。\n   如果 MAX_ROUNDS 调整为 2，则最大修正为 ±10，但封顶仍为 ±15，导致逻辑失配。建议将封顶值与轮次联动。',
];

suggestions.forEach(s => console.log(`\n${s}`));

console.log('');
process.exit(failCount > 0 ? 1 : 0);
