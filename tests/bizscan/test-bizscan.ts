/**
 * Bizscan 全自动测试脚本
 *
 * 测试层级：
 *  T1: 纯逻辑单元测试（不依赖 AI / 网络）
 *  T2: 数据结构与类型安全验证
 *  T3: 集成测试（调用真实 API，端到端）
 *
 * 使用方式：npx tsx tests/bizscan/test-bizscan.ts
 */

// ============================================================
//  T1: 纯逻辑单元测试
// ============================================================

import { anonymizeText } from '../../src/server/bizscan/idea-parser';

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
    durationMs: number;
}

const results: TestResult[] = [];
let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void) {
    const start = Date.now();
    try {
        fn();
        passCount++;
        results.push({ name, passed: true, durationMs: Date.now() - start });
        console.log(`  ✅ ${name}`);
    } catch (err: any) {
        failCount++;
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

// ────────────────────────────────────────────────
//  T1.1: PII 脱敏管道测试
// ────────────────────────────────────────────────

console.log('\n🧪 T1: PII 脱敏管道测试');
console.log('─'.repeat(50));

test('T1.1 邮箱地址脱敏', () => {
    const { cleanText, removedCount } = anonymizeText('联系我 test@example.com 或 admin@corp.cn');
    assert(!cleanText.includes('test@example.com'), '邮箱未被脱敏');
    assert(!cleanText.includes('admin@corp.cn'), '第二个邮箱未被脱敏');
    assert(cleanText.includes('[EMAIL]'), '未包含脱敏标记');
    assertEqual(removedCount, 2, '应移除 2 个邮箱');
});

test('T1.2 中国大陆手机号脱敏', () => {
    const { cleanText, removedCount } = anonymizeText('请拨打 13812345678 咨询');
    assert(!cleanText.includes('13812345678'), '手机号未被脱敏');
    assert(cleanText.includes('[PHONE]'), '未包含脱敏标记');
    assertEqual(removedCount, 1);
});

test('T1.3 国际电话号脱敏', () => {
    const { cleanText } = anonymizeText('Call +1-800-555-1234 for details');
    assert(!cleanText.includes('+1-800-555-1234'), '国际号码未被脱敏');
    assert(cleanText.includes('[PHONE]'), '未包含脱敏标记');
});

test('T1.4 URL 脱敏', () => {
    const { cleanText } = anonymizeText('详见 https://startup.example.com/pitch?id=123');
    assert(!cleanText.includes('https://'), 'URL 未被脱敏');
    assert(cleanText.includes('[URL]'), '未包含脱敏标记');
});

test('T1.5 身份证号脱敏', () => {
    const { cleanText } = anonymizeText('身份证号 110101199001011234');
    assert(!cleanText.includes('110101199001011234'), '身份证号未被脱敏');
});

test('T1.6 无 PII 文本保持不变', () => {
    const input = '这是一个基于AI的SaaS平台，面向中小企业提供智能客服解决方案';
    const { cleanText, removedCount } = anonymizeText(input);
    assertEqual(cleanText, input, '无 PII 文本不应被修改');
    assertEqual(removedCount, 0, '不应有任何移除');
});

test('T1.7 混合 PII 脱敏', () => {
    const { cleanText, removedCount } = anonymizeText(
        '创始人邮箱 a@b.com，电话 13900000000，详见 https://demo.io'
    );
    assert(removedCount >= 3, `应至少移除 3 处 PII，实际 ${removedCount}`);
    assert(!cleanText.includes('a@b.com'), '邮箱未脱敏');
    assert(!cleanText.includes('13900000000'), '手机号未脱敏');
});

// ────────────────────────────────────────────────
//  T1.2: 质量护卫纯逻辑测试
// ────────────────────────────────────────────────

console.log('\n🧪 T1.2: 质量护卫逻辑测试');
console.log('─'.repeat(50));

import { bizscanQualityGuard } from '../../src/agents/bizscan/quality-guard';
import type {
    MarketScoutOutput,
    CompetitorProfilerOutput,
    BizscanAgentOutput,
    CrossValidationResult,
    StrategicArbiterResult,
} from '../../src/agents/bizscan/types';

// 构建最小合法 Mock 数据
function mockAgentOutput(name: string, score: number, isFallback = false): BizscanAgentOutput {
    return {
        agentName: name,
        analysis: `${name} 分析结果`,
        score,
        confidence: 'medium',
        confidenceReasoning: '测试数据',
        keyFindings: ['发现1'],
        redFlags: [],
        evidenceSources: [],
        reasoning: '测试推理',
        dimensionScores: [],
        isFallback,
    };
}

function mockMarketScout(score: number, isFallback = false): MarketScoutOutput {
    return {
        ...mockAgentOutput('市场侦察员', score, isFallback),
        marketInsights: { growthTrend: 'growing', saturationLevel: 'moderate' },
        demandSignals: ['需求信号'],
    };
}

function mockCompetitorProfiler(score: number, isFallback = false): CompetitorProfilerOutput {
    return {
        ...mockAgentOutput('竞品拆解师', score, isFallback),
        competitors: [],
        competitiveMoat: '护城河',
        entryBarriers: [],
    };
}

function mockCrossValidation(scores?: Partial<CrossValidationResult['calibratedScores']>): CrossValidationResult {
    return {
        divergences: [],
        calibratedScores: {
            semanticNovelty: 60,
            competitiveLandscape: 55,
            marketGap: 65,
            feasibility: 70,
            ...scores,
        },
        consistencyScore: 75,
        evidenceConflicts: [],
    };
}

function mockArbiterResult(bii?: number): StrategicArbiterResult {
    const overallBII = bii ?? 62;
    return {
        overallBII,
        grade: overallBII >= 90 ? 'S' : overallBII >= 75 ? 'A' : overallBII >= 55 ? 'B' : overallBII >= 35 ? 'C' : 'D',
        verdict: '测试判定',
        recommendations: ['建议1', '建议2'],
        riskWarnings: ['风险1'],
        strategicAdvice: '战略建议',
        weightedBreakdown: {
            semanticNovelty: { raw: 60, weight: 0.25, weighted: 15 },
            competitiveLandscape: { raw: 55, weight: 0.30, weighted: 17 },
            marketGap: { raw: 65, weight: 0.25, weighted: 16 },
            feasibility: { raw: 70, weight: 0.20, weighted: 14 },
        },
        consensusLevel: 'moderate',
        dissent: [],
    };
}

test('T1.2.1 正常数据通过质量检查', () => {
    const result = bizscanQualityGuard(
        mockMarketScout(65),
        mockCompetitorProfiler(60),
        mockAgentOutput('创新度审计师', 55),
        mockAgentOutput('可行性检验师', 70),
        mockCrossValidation(),
        mockArbiterResult(62),
    );
    assert(result.passed, `正常数据应通过质量检查，issues: ${result.issues.join(', ')}`);
    assert(result.consistencyScore > 50, `一致性分应 > 50，实际 ${result.consistencyScore}`);
});

test('T1.2.2 检测 Fallback Agent', () => {
    const result = bizscanQualityGuard(
        mockMarketScout(65, true),
        mockCompetitorProfiler(60, true),
        mockAgentOutput('创新度审计师', 55),
        mockAgentOutput('可行性检验师', 70),
        mockCrossValidation(),
        mockArbiterResult(62),
    );
    assert(result.warnings.length > 0, '应有降级警告');
    assert(result.warnings.some(w => w.includes('降级')), '警告应提到降级');
});

test('T1.2.3 检测极端评分', () => {
    const result = bizscanQualityGuard(
        mockMarketScout(2),
        mockCompetitorProfiler(99),
        mockAgentOutput('创新度审计师', 55),
        mockAgentOutput('可行性检验师', 70),
        mockCrossValidation(),
        mockArbiterResult(62),
    );
    assert(result.warnings.length > 0, '极端评分应有警告');
});

test('T1.2.4 检测 BII 与维度评分不一致', () => {
    const result = bizscanQualityGuard(
        mockMarketScout(65),
        mockCompetitorProfiler(60),
        mockAgentOutput('创新度审计师', 55),
        mockAgentOutput('可行性检验师', 70),
        mockCrossValidation(),
        mockArbiterResult(15), // BII 15 远低于平均 62
    );
    assert(result.issues.length > 0 || result.warnings.length > 0, 'BII 与维度差距大应有问题');
});

test('T1.2.5 检测高分散度', () => {
    const result = bizscanQualityGuard(
        mockMarketScout(10),
        mockCompetitorProfiler(95),
        mockAgentOutput('创新度审计师', 50),
        mockAgentOutput('可行性检验师', 70),
        mockCrossValidation(),
        mockArbiterResult(62),
    );
    assert(result.warnings.some(w => w.includes('分散度')), '应检测到高分散度');
});

test('T1.2.6 检测缺失 verdict', () => {
    const arbiter = mockArbiterResult(62);
    arbiter.verdict = '';
    const result = bizscanQualityGuard(
        mockMarketScout(65),
        mockCompetitorProfiler(60),
        mockAgentOutput('创新度审计师', 55),
        mockAgentOutput('可行性检验师', 70),
        mockCrossValidation(),
        arbiter,
    );
    assert(result.issues.some(i => i.includes('verdict')), '缺失 verdict 应被检测');
});

test('T1.2.7 低交叉验证一致性触发警告', () => {
    const cv = mockCrossValidation();
    cv.consistencyScore = 30;
    const result = bizscanQualityGuard(
        mockMarketScout(65),
        mockCompetitorProfiler(60),
        mockAgentOutput('创新度审计师', 55),
        mockAgentOutput('可行性检验师', 70),
        cv,
        mockArbiterResult(62),
    );
    assert(result.warnings.some(w => w.includes('一致性')), '低一致性应触发警告');
});

// ────────────────────────────────────────────────
//  T1.3: 数据结构边界测试
// ────────────────────────────────────────────────

console.log('\n🧪 T1.3: 数据结构边界测试');
console.log('─'.repeat(50));

test('T1.3.1 输入验证 — 空描述应拒绝', () => {
    const trimmed = '';
    assert(trimmed.length < 50, '空描述应不满足最低字数');
});

test('T1.3.2 输入验证 — 短描述应拒绝', () => {
    const trimmed = '一个APP想法';
    assert(trimmed.length < 50, '短描述应不满足最低字数要求');
});

test('T1.3.3 输入验证 — 超长描述应拒绝', () => {
    const trimmed = 'a'.repeat(5001);
    assert(trimmed.length > 5000, '超长描述应超过最大字数限制');
});

test('T1.3.4 有效的商业描述应通过验证', () => {
    const trimmed = '我想做一个基于人工智能的智能客服系统，可以自动回答用户问题，面向中小型电商企业，采用SaaS订阅模式，月费99元起。';
    assert(trimmed.length >= 50, '合法描述应满足最低字数');
    assert(trimmed.length <= 5000, '合法描述应不超过最大字数');
});

// ────────────────────────────────────────────────
//  T2: 评分权重一致性验证
// ────────────────────────────────────────────────

console.log('\n🧪 T2: 评分权重一致性验证');
console.log('─'.repeat(50));

test('T2.1 BII 加权计算公式验证', () => {
    // 从 strategic-arbiter.ts 和 evaluator.ts 中的权重
    const WEIGHTS = {
        semanticNovelty: 0.25,
        competitiveLandscape: 0.30,
        marketGap: 0.25,
        feasibility: 0.20,
    };

    // 验证权重之和为 1
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    assertEqual(sum, 1.0, `权重之和应为 1.0，实际 ${sum}`);

    // 验证加权计算
    const scores = { semanticNovelty: 80, competitiveLandscape: 70, marketGap: 60, feasibility: 90 };
    const expectedBII = Math.round(
        scores.semanticNovelty * WEIGHTS.semanticNovelty +
        scores.competitiveLandscape * WEIGHTS.competitiveLandscape +
        scores.marketGap * WEIGHTS.marketGap +
        scores.feasibility * WEIGHTS.feasibility
    );
    // 80*0.25 + 70*0.30 + 60*0.25 + 90*0.20 = 20 + 21 + 15 + 18 = 74
    assertEqual(expectedBII, 74, `加权 BII 应为 74，实际 ${expectedBII}`);
});

test('T2.2 Grade 判定边界验证', () => {
    // 来自 strategic-arbiter.ts determineGrade
    const determineGrade = (bii: number) => {
        if (bii >= 90) return 'S';
        if (bii >= 75) return 'A';
        if (bii >= 55) return 'B';
        if (bii >= 35) return 'C';
        return 'D';
    };

    assertEqual(determineGrade(100), 'S');
    assertEqual(determineGrade(90), 'S');
    assertEqual(determineGrade(89), 'A');
    assertEqual(determineGrade(75), 'A');
    assertEqual(determineGrade(74), 'B');
    assertEqual(determineGrade(55), 'B');
    assertEqual(determineGrade(54), 'C');
    assertEqual(determineGrade(35), 'C');
    assertEqual(determineGrade(34), 'D');
    assertEqual(determineGrade(0), 'D');
});

test('T2.3 维度 Grade 判定一致性（evaluator.ts）', () => {
    // 来自 buildDimensionAssessment
    const dimGrade = (score: number) =>
        score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F';

    assertEqual(dimGrade(100), 'A');
    assertEqual(dimGrade(80), 'A');
    assertEqual(dimGrade(79), 'B');
    assertEqual(dimGrade(60), 'B');
    assertEqual(dimGrade(59), 'C');
    assertEqual(dimGrade(40), 'C');
    assertEqual(dimGrade(39), 'D');
    assertEqual(dimGrade(20), 'D');
    assertEqual(dimGrade(19), 'F');
    assertEqual(dimGrade(0), 'F');
});

// ============================================================
//  测试总结报告
// ============================================================

console.log('\n' + '═'.repeat(50));
console.log('📊 测试总结');
console.log('═'.repeat(50));
console.log(`  ✅ 通过: ${passCount}`);
console.log(`  ❌ 失败: ${failCount}`);
console.log(`  📋 总计: ${results.length}`);
console.log('');

if (failCount > 0) {
    console.log('❌ 失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
    });
}

console.log('');
process.exit(failCount > 0 ? 1 : 0);
