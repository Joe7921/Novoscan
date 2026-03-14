/**
 * Clawscan 评估引擎入口
 *
 * 调用 Clawscan 编排器并将结果转换为 ClawscanReport 格式
 */

import { clawscanOrchestrate } from '@/agents/clawscan/orchestrator';
import type { ModelProvider } from '@/types';
import type {
    ParsedClawIdea,
    ClawscanSearchSignals,
    ClawscanReport,
    SkillMatchResult,
    CaseStudy,
    FeatureCoverage,
} from '@/types/clawscan';
import type { ClawscanAgentInput } from '@/agents/clawscan/types';

function formatInstalls(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}

export async function evaluateClawscan(
    parsedIdea: ParsedClawIdea,
    signals: ClawscanSearchSignals,
    modelProvider: ModelProvider = 'minimax',
    onProgress?: (event: 'log' | 'progress' | 'agent_state', data: any) => void,
): Promise<ClawscanReport> {
    console.log(`[Clawscan/Evaluator] 启动 4-Agent 评估 (${modelProvider})`);
    const startTime = Date.now();

    const agentInput: ClawscanAgentInput = {
        parsedIdea,
        signals,
        language: 'zh',
        modelProvider,
        onProgress,
    };

    const report = await clawscanOrchestrate(agentInput);
    const { registryScout, caseAnalyst, noveltyAuditor, strategicArbiter, executionMeta } = report;

    // 构建 Skill 匹配列表
    const similarSkills: SkillMatchResult[] = registryScout.skillMatches
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

    // 构建功能覆盖分析
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

    // 构建实战案例列表
    const caseStudies: CaseStudy[] = caseAnalyst.caseStudies.map(c => ({
        title: c.title,
        url: c.url,
        snippet: '',
        source: 'AI Analysis',
        relevanceScore: c.relevanceScore,
        keyInsight: c.keyInsight,
        technologyUsed: c.technologyUsed,
        deploymentScale: c.deploymentScale,
    }));

    const clawscanReport: ClawscanReport = {
        parsedIdea,
        overallScore: strategicArbiter.overallScore,
        duplicationLevel: strategicArbiter.duplicationLevel,
        grade: strategicArbiter.grade,
        verdict: strategicArbiter.verdict,
        similarSkills,
        featureCoverage,
        caseStudies,
        recommendation: strategicArbiter.recommendation,
        strategicAdvice: strategicArbiter.strategicAdvice,
        riskWarnings: strategicArbiter.riskWarnings,
        agentOutputs: {
            registryScout: { analysis: registryScout.analysis, score: registryScout.score, keyFindings: registryScout.keyFindings },
            caseAnalyst: { analysis: caseAnalyst.analysis, score: caseAnalyst.score, keyFindings: caseAnalyst.keyFindings },
            noveltyAuditor: { analysis: noveltyAuditor.analysis, score: noveltyAuditor.score, keyFindings: noveltyAuditor.keyFindings },
            strategicArbiter: { analysis: strategicArbiter.analysis, score: strategicArbiter.score, keyFindings: strategicArbiter.keyFindings },
        },
        metadata: {
            searchTimeMs: Date.now() - startTime,
            registrySize: signals.registrySkills.length,
            candidatesEvaluated: signals.registrySkills.length,
            webResultsFound: signals.webCaseResults.length,
            githubReposFound: signals.githubRepos.length,
            modelUsed: modelProvider,
            dataSourcesUsed: signals.dataSourcesUsed,
            agentTimings: executionMeta.agentTimings,
            timeoutsOccurred: executionMeta.timeoutsOccurred,
        },
    };

    console.log(
        `[Clawscan/Evaluator] 评估完成: Score=${clawscanReport.overallScore}, Grade=${clawscanReport.grade}, ` +
        `DupLevel=${clawscanReport.duplicationLevel}, 耗时=${clawscanReport.metadata.searchTimeMs}ms`
    );

    return clawscanReport;
}
