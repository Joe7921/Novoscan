/**
 * Clawscan 轻量评估引擎（Registry 模式 — 性能优化版）
 *
 * 架构优化：将原来串行的 registryScout + quickVerdict 两次 AI 调用
 * 合并为 unifiedRegistryEvaluate 单次调用，节省 ~50% AI 等待时间。
 */

import { unifiedRegistryEvaluate } from '@/server/clawscan/unified-evaluator';
import type { ModelProvider } from '@/types';
import type {
    ParsedClawIdea,
    ClawscanSearchSignals,
    ClawscanReport,
    SkillMatchResult,
    FeatureCoverage,
} from '@/types/clawscan';
import type { ClawscanAgentInput } from '@/agents/clawscan/types';

function formatInstalls(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}

// ============================================================
//  轻量评估入口（优化版：单次 AI 调用）
// ============================================================

export async function evaluateClawscanLite(
    parsedIdea: ParsedClawIdea,
    signals: ClawscanSearchSignals,
    modelProvider: ModelProvider = 'minimax',
    onProgress?: (event: 'log' | 'progress' | 'agent_state', data: any) => void,
): Promise<ClawscanReport> {
    console.log(`[Clawscan/EvalLite] 启动统一评估 (${modelProvider})`);
    const startTime = Date.now();

    // 单次 AI 调用完成侦察+仲裁
    onProgress?.('log', '[编排器] 统一评估启动（单次 AI 调用）');
    onProgress?.('progress', 10);

    const agentInput: ClawscanAgentInput = {
        parsedIdea,
        signals,
        language: 'zh',
        modelProvider,
        onProgress,
    };

    const { scout: registryResult, arbiter: arbiterResult } = await unifiedRegistryEvaluate(agentInput);

    onProgress?.('log', `[编排器] 评估完成: ${registryResult.skillMatches.length} 个评分, Grade=${arbiterResult.grade}`);
    onProgress?.('progress', 100);

    // 构建报告
    const similarSkills: SkillMatchResult[] = registryResult.skillMatches
        .map(match => {
            const skill = signals.registrySkills[match.index];
            if (!skill) return null;
            return {
                name: skill.name,
                author: skill.author || 'unknown',
                description: skill.description || '',
                githubUrl: skill.githubUrl || '#',
                installs: formatInstalls(skill.installs || 0),
                installsRaw: skill.installs || 0,
                similarityPercentage: match.similarityPercentage,
                reason: match.reason,
                matchedFeatures: match.matchedFeatures,
                allFeatures: skill.features || [],
                tags: skill.tags || [],
                coverageRate: match.coverageRate,
            };
        })
        .filter(Boolean)
        .sort((a, b) => b!.similarityPercentage - a!.similarityPercentage)
        .filter(s => s!.similarityPercentage >= 5)
        .slice(0, 10) as SkillMatchResult[];

    const featureCoverage: FeatureCoverage[] = parsedIdea.coreCapabilities.map(feature => {
        const featureLower = feature.toLowerCase();
        let coveredBy = '-';
        let covered = false;
        for (const skill of similarSkills) {
            if (skill.matchedFeatures.some(f => f.toLowerCase().includes(featureLower) || featureLower.includes(f.toLowerCase()))) {
                covered = true;
                coveredBy = skill.name;
                break;
            }
        }
        return { feature, required: true, covered, coveredBy };
    });

    const report: ClawscanReport = {
        parsedIdea,
        overallScore: arbiterResult.overallScore,
        duplicationLevel: arbiterResult.duplicationLevel,
        grade: arbiterResult.grade,
        verdict: arbiterResult.verdict,
        similarSkills,
        featureCoverage,
        caseStudies: [],
        recommendation: arbiterResult.recommendation,
        strategicAdvice: arbiterResult.strategicAdvice,
        riskWarnings: arbiterResult.riskWarnings,
        agentOutputs: {
            registryScout: { analysis: registryResult.analysis, score: registryResult.score, keyFindings: registryResult.keyFindings },
            caseAnalyst: { analysis: '（轻量模式未启用）', score: 0, keyFindings: [] },
            noveltyAuditor: { analysis: '（轻量模式未启用）', score: 0, keyFindings: [] },
            strategicArbiter: { analysis: arbiterResult.analysis, score: arbiterResult.score, keyFindings: arbiterResult.keyFindings },
        },
        metadata: {
            searchTimeMs: Date.now() - startTime,
            registrySize: signals.registrySkills.length,
            candidatesEvaluated: signals.registrySkills.length,
            webResultsFound: 0,
            githubReposFound: 0,
            modelUsed: modelProvider,
            dataSourcesUsed: ['ClawHub Registry'],
            agentTimings: {},
            timeoutsOccurred: [],
        },
    };

    console.log(
        `[Clawscan/EvalLite] 评估完成: Score=${report.overallScore}, Grade=${report.grade}, 耗时=${report.metadata.searchTimeMs}ms`
    );

    return report;
}
