/**
 * 跨域侦察兵 Agent（Cross-Domain Scout）
 *
 * 职责：在用户创新领域之外的完全不同领域（航空、材料、生物仿生、游戏等）
 *       中搜索类似的底层技术原理，生成跨域迁移建议和知识图谱连接。
 *
 * 架构角色：Layer1（与学术审查员/产业分析员/竞品侦探并行执行，无上游依赖）
 *
 * 特殊之处：
 *   - 它不分析用户所在领域的数据，而是让 AI 联想完全不同的领域
 *   - 输出结构化的跨域桥梁（Bridge），包含迁移路径和创新潜力评估
 *   - 构建跨领域知识图谱，连接不同领域的技术节点
 */

import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import { AgentInput, CrossDomainScoutOutput, CrossDomainBridge, KnowledgeGraphNode, KnowledgeGraphEdge } from '../types';
import { findCrossDomainDNANeighbors, findExistingBridges } from '@/lib/services/innovation/crossDomainService';

/**
 * 跨域侦察兵 Agent 主函数
 */
export async function crossDomainScout(input: AgentInput): Promise<CrossDomainScoutOutput> {
    // 预处理：提取关键上下文供 Prompt 使用
    const paperTopics = input.academicData.topConcepts?.slice(0, 5).join(', ') || 'unknown';
    const industrySignal = input.industryData.sentiment || 'unknown';
    const topPapers = input.academicData.results
        ?.slice(0, 3)
        .map(p => p.title)
        .filter(Boolean)
        .join('; ') || 'none';

    // ==================== NovoDNA Deep Fusion ====================
    let dnaHintsBlock = '';
    try {
        const dnaInsightRaw = (input as { dnaInsight?: string }).dnaInsight || '';
        const techPrincipleMatch = dnaInsightRaw.match(/techPrinciple[=:]\s*(\d\.\d)/i);
        const appScenarioMatch = dnaInsightRaw.match(/appScenario[=:]\s*(\d\.\d)/i);
        const techValue = techPrincipleMatch ? parseFloat(techPrincipleMatch[1]) : 0.5;
        const appValue = appScenarioMatch ? parseFloat(appScenarioMatch[1]) : 0.5;

        const [dnaNeighbors, historicalBridges] = await Promise.all([
            findCrossDomainDNANeighbors(techValue, appValue, 5).catch(() => []),
            findExistingBridges(
                (input.academicData.topConcepts || []).slice(0, 3),
                5
            ).catch(() => []),
        ]);

        const hints: string[] = [];

        if (dnaNeighbors.length > 0) {
            hints.push('### NovoDNA Gene Pool Cross-Domain Candidates');
            hints.push('The following innovations share similar tech principles but differ in application scenario:');
            dnaNeighbors.forEach((n, i) => {
                hints.push(`${i + 1}. "${n.query}" - tech similarity ${(n.techSimilarity * 100).toFixed(0)}%, scenario difference ${(n.scenarioDifference * 100).toFixed(0)}%`);
            });
        }

        if (historicalBridges.length > 0) {
            hints.push('\n### Historical Cross-Domain Bridges');
            hints.push('Previously discovered cross-domain bridges for reference:');
            historicalBridges.forEach((b, i) => {
                hints.push(`${i + 1}. ${b.source_field} -> ${b.target_field}: ${b.tech_principle} (potential ${b.novelty_potential}/100)`);
            });
        }

        if (hints.length > 0) {
            dnaHintsBlock = `\n\n---\n\n## NovoDNA Smart Reference Clues\n\n${hints.join('\n')}\n\nNote: These clues are for reference only. You should independently discover more cross-domain connections.\n`;
            console.log(`[CrossDomainScout] NovoDNA fusion: ${dnaNeighbors.length} DNA neighbors + ${historicalBridges.length} historical bridges`);
        }
    } catch (err: unknown) {
        console.warn('[CrossDomainScout] NovoDNA fusion query failed (non-blocking):', err instanceof Error ? err.message : String(err));
    }

    const prompt = `
# 系统角色

你是一位拥有 20 年跨学科创新咨询经验的"跨域侦察兵"，曾帮助 NASA、IDEO、MIT Media Lab 等机构
发现跨领域灵感。你精通以下领域的底层原理映射：

- 生物仿生学（Biomimicry）
- 航空航天工程
- 材料科学与纳米技术
- 游戏设计与交互技术
- 金融工程与算法交易
- 建筑与城市规划
- 军事与国防技术
- 农业与食品科技
- 量子计算与信息论
- 艺术与认知科学

你的核心信念：**最伟大的创新往往来自把 A 领域的方法搬到 B 领域。**

## 专业边界
- 你专注于发现跨领域的技术原理共通性，不评价具体领域内的学术深度
- 你的联想必须有科学依据，不能天马行空地编造
- 每一条跨域桥梁都必须说明底层原理的共通性

---

# 任务

分析用户的创新点，提取其**底层技术原理**，然后在至少 5 个**完全不同的领域**中
寻找使用了类似原理或方法的案例，生成跨域迁移建议。

**用户创新点**：${input.query}
${input.domainHint ? `**用户所在领域**：${input.domainHint}` : ''}

**学术检索上下文**：
- 相关学术关键词：${paperTopics}
- 代表性论文：${topPapers}
- 市场热度信号：${industrySignal}
${dnaHintsBlock}

---

# 思维链（请按以下步骤逐步推理）

**Step 1 - 底层原理提取（最关键）**：
从用户创意中剥离表面应用，提取 2-3 个核心底层技术原理。
例如："柔性传感器医疗监测" → 底层原理是"柔性基底上的应力-电阻转换"和"连续信号的实时边缘处理"

**Step 2 - 远源领域联想**：
针对每个底层原理，联想至少 5 个**完全不同**的领域中存在类似原理的应用。
要求："完全不同"意味着必须跨越至少 2 个学科大类。

**Step 3 - 具体案例匹配**：
在每个远源领域中找到 1-2 个具体案例（最好是知名论文、专利或产品），
说明它使用了何种类似原理。

**Step 4 - 迁移可行性评估**：
评估每条跨域桥梁的：
- 迁移创新潜力（0-100）
- 可行性（技术上是否可实现）
- 风险等级

**Step 5 - 知识图谱构建**：
将用户创意、底层原理、远源案例组织成节点-边关系的知识图谱。

---

# 评分标准

## 综合评分（0-100）— 跨域迁移潜力：
| 区间 | 含义 |
|------|------|
| 81-100 | 发现了极其惊人的跨域联系，多条高价值迁移路径 |
| 61-80 | 发现了有价值的跨域联系，至少 2 条高潜力桥梁 |
| 41-60 | 有一些跨域联系但迁移价值中等 |
| 21-40 | 跨域联系较弱，原理共通性有限 |
| 0-20 | 几乎无法找到有意义的跨域联系 |

## 4 个评分维度：
1. **原理共通性**（0-100）：用户创意的底层原理在其他领域出现的广泛程度
2. **迁移创新潜力**（0-100）：跨域迁移产生全新专利/产品的可能性
3. **领域跨度**（0-100）：联想到的领域与用户领域的差异程度（越远越高分）
4. **案例可信度**（0-100）：引用的跨域案例的真实性和权威性

---

# 输出格式

严格按以下 JSON 格式输出，不要有任何其他内容：
{
  "agentName": "跨域侦察兵",
  "reasoning": "按 Step1-5 的完整推理过程...",
  "analysis": "跨域迁移分析总结（2-3段，包含具体案例引用）",
  "score": 72,
  "confidence": "medium",
  "confidenceReasoning": "基于 X 个领域的交叉分析...",
  "dimensionScores": [
    { "name": "原理共通性", "score": 75, "reasoning": "..." },
    { "name": "迁移创新潜力", "score": 70, "reasoning": "..." },
    { "name": "领域跨度", "score": 85, "reasoning": "..." },
    { "name": "案例可信度", "score": 60, "reasoning": "..." }
  ],
  "keyFindings": ["发现1", "发现2", "发现3"],
  "redFlags": ["风险提示"],
  "evidenceSources": ["Nature 2024 - 论文标题", "专利 US1234567"],
  "transferSummary": "一段精华总结，告诉用户最有价值的跨域灵感是什么",
  "exploredDomains": ["航空航天", "生物仿生", "游戏设计", "材料科学", "金融工程"],
  "bridges": [
    {
      "sourceField": "用户所在领域",
      "targetField": "远源领域名",
      "techPrinciple": "共通的底层技术原理",
      "sourceExample": "用户领域的应用案例",
      "targetExample": "远源领域的具体案例（含年份和出处）",
      "reference": "参考文献（如有）",
      "transferPath": "从A到B的具体迁移路径描述",
      "noveltyPotential": 75,
      "feasibility": "medium",
      "riskLevel": "low"
    }
  ],
  "knowledgeGraph": {
    "nodes": [
      { "id": "user_innovation", "label": "用户创新点简称", "field": "用户领域", "type": "application" },
      { "id": "principle_1", "label": "底层原理名", "field": "通用", "type": "principle" },
      { "id": "case_1", "label": "远源案例名", "field": "远源领域", "type": "technology" }
    ],
    "edges": [
      { "source": "user_innovation", "target": "principle_1", "relation": "same_principle", "strength": 0.9 },
      { "source": "principle_1", "target": "case_1", "relation": "inspires", "strength": 0.7 }
    ]
  }
}

⚠️ 重要要求：
- bridges 至少包含 3 条，最多 6 条
- knowledgeGraph 至少包含 5 个节点和 4 条边
- exploredDomains 至少包含 5 个不同领域
- 所有案例引用必须尽可能真实（如 Nature 论文、知名专利、著名产品）
- transferPath 必须是具体可执行的迁移描述，不能是空洞的"可以结合"
`;

    try {
        const { text } = await callAIRaw(
            prompt,
            input.modelProvider,
            115000, // 对齐编排器 AGENT_TIMEOUT(120s)，留 5s 缓冲让编排器 abort 优先触发
            80000,
            (chunk, isReasoning) => {
                if (input.onProgress) {
                    input.onProgress('agent_stream', { agentId: 'crossDomainScout', chunk, isReasoning });
                }
            },
            input._abortSignal,
            16384
        );

        const parsed = parseAgentJSON<CrossDomainScoutOutput>(text);

        // 标准化和校验
        const output: CrossDomainScoutOutput = {
            agentName: parsed.agentName || '跨域侦察兵',
            analysis: parsed.analysis || '',
            score: typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 50,
            confidence: parsed.confidence || 'medium',
            confidenceReasoning: parsed.confidenceReasoning || '',
            keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
            redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
            evidenceSources: Array.isArray(parsed.evidenceSources) ? parsed.evidenceSources : [],
            reasoning: parsed.reasoning || '',
            dimensionScores: Array.isArray(parsed.dimensionScores) ? parsed.dimensionScores : [],
            bridges: normalizeBridges(parsed.bridges),
            knowledgeGraph: normalizeGraph(parsed.knowledgeGraph),
            exploredDomains: Array.isArray(parsed.exploredDomains) ? parsed.exploredDomains.slice(0, 10) : [],
            transferSummary: parsed.transferSummary || parsed.analysis || '',
        };

        return output;
    } catch (err: unknown) {
        console.error('[跨域侦察兵] Agent 执行失败:', err instanceof Error ? err.message : String(err));
        throw err;
    }
}

// ==================== 辅助函数 ====================

/** 标准化桥梁数据，确保必填字段存在 */
function normalizeBridges(bridges: unknown): CrossDomainBridge[] {
    if (!Array.isArray(bridges)) return [];
    return bridges
        .filter((b: Partial<CrossDomainBridge>) => b && b.sourceField && b.targetField && b.techPrinciple)
        .slice(0, 6)
        .map((b: Partial<CrossDomainBridge>) => ({
            sourceField: String(b.sourceField),
            targetField: String(b.targetField),
            techPrinciple: String(b.techPrinciple),
            sourceExample: String(b.sourceExample || ''),
            targetExample: String(b.targetExample || ''),
            reference: b.reference ? String(b.reference) : undefined,
            transferPath: String(b.transferPath || ''),
            noveltyPotential: typeof b.noveltyPotential === 'number'
                ? Math.max(0, Math.min(100, b.noveltyPotential)) : 50,
            feasibility: (['high', 'medium', 'low'] as const).includes(b.feasibility as 'high' | 'medium' | 'low') ? b.feasibility as 'high' | 'medium' | 'low' : 'medium',
            riskLevel: (['low', 'medium', 'high'] as const).includes(b.riskLevel as 'low' | 'medium' | 'high') ? b.riskLevel as 'low' | 'medium' | 'high' : 'medium',
        }));
}

/** 标准化知识图谱数据 */
function normalizeGraph(graph: unknown): { nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } {
    const defaultGraph = { nodes: [] as KnowledgeGraphNode[], edges: [] as KnowledgeGraphEdge[] };
    if (!graph || typeof graph !== 'object') return defaultGraph;
    const g = graph as Record<string, unknown>;

    const nodes: KnowledgeGraphNode[] = Array.isArray(g.nodes)
        ? g.nodes
            .filter((n: Partial<KnowledgeGraphNode>) => n && n.id && n.label)
            .slice(0, 20)
            .map((n: Partial<KnowledgeGraphNode>) => ({
                id: String(n.id),
                label: String(n.label),
                field: String(n.field || '未知'),
                type: (['technology', 'application', 'principle'] as const).includes(n.type as 'technology' | 'application' | 'principle') ? n.type! : 'technology',
            }))
        : [];

    const nodeIds = new Set(nodes.map(n => n.id));
    const edges: KnowledgeGraphEdge[] = Array.isArray(g.edges)
        ? g.edges
            .filter((e: Partial<KnowledgeGraphEdge>) => e && e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target))
            .slice(0, 30)
            .map((e: Partial<KnowledgeGraphEdge>) => ({
                source: String(e.source),
                target: String(e.target),
                relation: (['same_principle', 'analogous', 'evolved_from', 'inspires'] as const).includes(e.relation as 'same_principle' | 'analogous' | 'evolved_from' | 'inspires')
                    ? e.relation as 'same_principle' | 'analogous' | 'evolved_from' | 'inspires' : 'analogous',
                strength: typeof e.strength === 'number' ? Math.max(0, Math.min(1, e.strength)) : 0.5,
            }))
        : [];

    return { nodes, edges };
}

/**
 * 生成跨域侦察兵的 Fallback 输出
 * 当 Agent 超时或异常时返回
 */
export function createFallbackCrossDomainOutput(input?: AgentInput): CrossDomainScoutOutput {
    return {
        agentName: '跨域侦察兵',
        analysis: '跨域分析暂不可用（超时或服务异常）。建议稍后重试以获取跨领域创新灵感。',
        score: 50,
        confidence: 'low',
        confidenceReasoning: '跨域侦察兵未能完成 AI 分析，无法提供跨域迁移建议',
        keyFindings: ['跨域侦察兵服务暂不可用'],
        redFlags: ['跨域分析未完成，建议重新分析'],
        evidenceSources: [],
        reasoning: '该 Agent 未能完成跨域分析',
        dimensionScores: [
            { name: '原理共通性', score: 50, reasoning: '无法推断' },
            { name: '迁移创新潜力', score: 50, reasoning: '无法推断' },
            { name: '领域跨度', score: 50, reasoning: '无法推断' },
            { name: '案例可信度', score: 50, reasoning: '无法推断' },
        ],
        isFallback: true,
        bridges: [],
        knowledgeGraph: { nodes: [], edges: [] },
        exploredDomains: [],
        transferSummary: '跨域分析暂不可用，请重试。',
    };
}
