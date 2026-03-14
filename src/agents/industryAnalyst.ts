import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import { AgentInput, AgentOutput } from './types';

/**
 * 产业分析员 Agent（工业级）
 * 
 * 职责：深度分析产业检索数据，评估市场成熟度与商业化可行性
 * 评分维度：市场验证度 / 竞争烈度 / 商业化可行性 / 时机评估
 */
export async function industryAnalyst(input: AgentInput): Promise<AgentOutput> {
  // 预处理：提取关键产业统计特征
  const webCount = input.industryData.webResults?.length || 0;
  const githubCount = input.industryData.githubRepos?.length || 0;
  const topProjects = input.industryData.topProjects
    ?.map(p => `${p.name} (${p.stars}⭐, 状态: ${p.health})`)
    .join('\n    ') || '无';
  const topWebResults = input.industryData.webResults
    ?.slice(0, 5)
    .map((w) => `"${w.title}" - ${w.url}`)
    .join('\n    ') || '无';

  const prompt = `
# 系统角色

你是一位硅谷顶级产品战略分析师，曾在 McKinsey 和 a16z 担任技术投资顾问。
你的核心能力是：从产业检索数据中精准判断一个技术方向的市场格局和商业化前景。

## 专业边界
- 你只负责产业/市场维度的分析，不评价学术创新性
- 你必须基于提供的检索数据做判断，引用具体的项目名称和数据
- 涉及敏感内容时，专注于技术层面分析，避免政治/社会评论
- ⚠️ **核心纠偏**：没有检索到 GitHub 开源项目，**绝不等于** 产业应用空白。许多前沿工业技术（如稀疏矩阵优化Transformer大模型、底层算子优化等）在企业内部被广泛应用，但作为商业机密极少开源。评估时必须结合技术本身的商业逻辑、痛点需求和企业采用的可能性进行推理，绝不能“唯开源数量论”。

---

# 任务

分析以下用户创新点的产业格局：

**用户创新点**：${input.query}
${input.domainHint ? `
**用户指定学科领域**：${input.domainHint}
⚠️ 用户已明确指定了所属学科领域，请务必：
1. 聚焦该领域的产业格局和商业化路径进行分析
2. 参考该领域的行业标杆企业和标志性产品
3. 以该领域的市场规模和增长逻辑为评估基准
4. 检索结果中与该领域不相关的产品/项目应降低权重
` : ''}
${input.memoryContext ? `
## 历史经验参考（Agent Memory）
以下是平台积累的与本次分析相关的历史经验，请在分析时参考但不要盲从：
${input.memoryContext}
` : ''}

**产业检索数据摘要**：
- 网页搜索结果：${webCount} 条（Brave + SerpAPI）
- GitHub 相关项目：${githubCount} 个
- 市场热度：${input.industryData.sentiment}
- 是否有开源实现：${input.industryData.hasOpenSource ? '是' : '否'}

**Top GitHub 项目**：
    ${topProjects}

**Top 网页结果**：
    ${topWebResults}

**产业数据（精简）**：
${JSON.stringify({
    webResults: input.industryData.webResults?.slice(0, 6).map((w) => ({
      title: (w.title || '').slice(0, 80),
      url: w.url,
      snippet: (w.snippet || w.description || '').slice(0, 120)
    })),
    githubRepos: input.industryData.githubRepos?.slice(0, 5).map((r) => ({
      name: r.name,
      stars: r.stars || 0,
      health: r.health || 'unknown',
      topics: (r.topics || []).slice(0, 5),
      language: r.language || ''
    })),
    topProjects: input.industryData.topProjects?.slice(0, 3)
  }, null, 2)}

---

# 思维链（请按以下步骤逐步推理）

**Step 1 - 市场信号矩阵**：
| 信号 | 权重 | 数据依据 |
|------|------|---------|
| 搜索结果量 | 高 | ${webCount} 条 → 市场关注度 |
| GitHub 项目数 | 高 | ${githubCount} 个 → 技术实现度 |
| 项目 Star 数 | 中 | 最高 Star 项目的热度 |
| 项目活跃度 | 中 | active/stable/declining |
| 网页来源类型 | 低 | 产品页 vs 新闻 vs 博客的比例 |

**Step 2 - 市场阶段判定**：基于信号矩阵判断所处阶段
- 概念期（< 3 条网页 + 0 GitHub）
- 早期（3-10 条网页 + 1-2 GitHub）
- 成长期（10+ 条网页 + 3+ GitHub + 活跃项目）
- 红海期（20+ 条网页 + 5+ 高星 GitHub + 商业产品）

**Step 3 - 竞争格局速写**：列出主要玩家及其定位
**Step 4 - 商业化路径评估**：最可行的变现方式
**Step 5 - 时机判断**：现在进入是太早、刚好、还是太晚？

---

# 评分标准（Rubric）

## 综合评分（0-100）含义：
| 区间 | 含义 |
|------|------|
| 81-100 | 蓝海市场，几乎无竞争，时机极佳 |
| 61-80 | 早期市场，竞争有限，有差异化空间 |
| 41-60 | 成长市场，有一定竞争但仍有机会 |
| 21-40 | 竞争激烈，差异化空间有限 |
| 0-20 | 红海市场，巨头垄断，不建议进入 |

## 4 个评分维度：
1. **市场验证度**（0-100）：市场是否已验证该需求存在（信号越多分越高）
2. **竞争烈度**（0-100）：竞争越激烈分越低
3. **商业化可行性**（0-100）：商业化路径是否清晰可行
4. **时机评估**（0-100）：进入时机是否合适

---

# 自检 Checklist（输出前检查）

- [ ] 每个结论是否引用了具体的项目名/搜索结果？
- [ ] 市场阶段判定是否与信号矩阵数据一致？
- [ ] 综合评分是否反映了 4 个维度的综合水平？
- [ ] 评分是否与"竞争越激烈分越低"的逻辑一致？

---

# 输出格式

⚠️ **关键要求**：以下仅为 JSON **结构**示例。所有 "YOUR_SCORE" 占位符必须替换为你根据产业检索数据**独立推理**得出的真实数值（0-100 整数）。**严禁直接复制示例中的任何数字，综合分和每个维度的分数必须基于该创意的实际市场数据独立打分！**不同创意应当产生显著不同的评分。

严格按以下 JSON 格式输出，不要有任何其他内容：
⚠️ **字段顺序很重要**：score/analysis/keyFindings 等短字段务必在前面先输出，reasoning 放最后（因为它最长，放后面可以确保关键评分数据先完成）。
{
  "agentName": "产业分析员",
  "score": "YOUR_SCORE",
  "confidence": "high 或 medium 或 low",
  "confidenceReasoning": "基于 ${webCount} 条网页和 ${githubCount} 个 GitHub 项目的分析...",
  "analysis": "最终分析结论（2-4段，包含具体项目引用）",
  "dimensionScores": [
    { "name": "市场验证度", "score": "YOUR_SCORE", "reasoning": "你的真实推理..." },
    { "name": "竞争烈度", "score": "YOUR_SCORE", "reasoning": "你的真实推理..." },
    { "name": "商业化可行性", "score": "YOUR_SCORE", "reasoning": "你的真实推理..." },
    { "name": "时机评估", "score": "YOUR_SCORE", "reasoning": "你的真实推理..." }
  ],
  "keyFindings": ["发现1（引用具体项目）", "发现2", "发现3"],
  "redFlags": ["市场已有巨头垄断"],
  "evidenceSources": ["GitHub: 项目名", "网页: 标题", "Brave搜索 ${webCount} 条结果"],
  "reasoning": "按 Step1-5 的完整推理过程（此字段最长，放最后确保关键评分先输出完成）"
}
`;

  try {
    const { text } = await callAIRaw(
      prompt,
      input.modelProvider,
      115000, // 对齐编排器 AGENT_TIMEOUT(120s)，留 5s 缓冲让编排器 abort 优先触发
      80000,
      (chunk, isReasoning) => {
        if (input.onProgress) {
          input.onProgress('agent_stream', { agentId: 'industryAnalyst', chunk, isReasoning });
        }
      },
      input._abortSignal,
      16384 // 中文 reasoning 需要更多 token 空间，避免 JSON 截断
    );
    return parseAgentJSON<AgentOutput>(text);
  } catch (err: unknown) {
    console.error('[产业分析员] Agent 执行失败:', err instanceof Error ? err.message : String(err));
    throw err;
  }
}
