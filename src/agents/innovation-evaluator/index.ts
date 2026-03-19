import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import { AgentInput, AgentOutput, InnovationRadarDimension } from '../types';

/**
 * 创新评估师 Agent（工业级）
 * 
 * 职责：综合三份 Layer1 报告（学术+产业+竞品），进行交叉质疑和创新性评估
 * 评分维度：原创性 / 技术壁垒 / 市场时机 / 执行可行性
 * 
 * 架构角色：Layer2（独占层，接收全部 Layer1 输出，执行交叉审查）
 * 依赖：academicReview + industryAnalysis + competitorAnalysis
 */
export async function innovationEvaluator(
    input: AgentInput,
    academicReview: AgentOutput,
    industryAnalysis: AgentOutput,
    competitorAnalysis: AgentOutput
): Promise<AgentOutput> {
    // 预处理：计算上游 Agent 的评分差异
    const scores = {
        academic: academicReview.score ?? 50,
        industry: industryAnalysis.score ?? 50,
        competitor: competitorAnalysis.score ?? 50
    };
    const maxDiff = Math.max(scores.academic, scores.industry, scores.competitor)
        - Math.min(scores.academic, scores.industry, scores.competitor);
    const avgScore = Math.round((scores.academic + scores.industry + scores.competitor) / 3);

    const prompt = `
# 系统角色

你是一位著名的技术创新评估专家，曾参与多个独角兽项目（如 Stripe、Notion、Figma）的早期技术评估。
你的核心能力是：**综合多方专家意见，识别矛盾点，做出独立的创新性判断**。

## 核心职责——交叉审查
你不仅要做创新评估，更要扮演"质疑者"的角色：
- 挑战上游三位专家报告中的矛盾和漏洞
- 识别各专家可能的认知偏差
- 做出独立于三位专家的、有理有据的判断

## 专业边界
- 你综合学术、产业、竞品三个维度做创新评估
- 你必须引用上游报告的具体结论，不能凭空分析
- ⚠️ **核心纠偏**：缺乏 GitHub 开源项目或开源代码，**绝对不等于**产业应用空白或学术空白。很多深水区技术（例如大模型的稀疏矩阵优化、底层调度等）是企业的核心机密，本就不会开源。若某位上游专家仅因“没有开源项目”就认定其为“蓝海”或“技术空白”，你必须作为质疑者在推理中**严厉反驳**这一逻辑漏洞，并基于真实商业逻辑重新评估。

---

# 任务

综合以下三份专家报告，对用户创新点做出独立的创新性评估：

**用户创新点**：${input.query}
${input.domainHint ? `
**用户指定学科领域**：${input.domainHint}
⚠️ 用户已明确指定了所属学科领域，请务必：
1. 以该领域的创新评判标准和范式来衡量创新性
2. 交叉质疑时，考虑该领域的特殊性（如医学领域的审批壁垒、工学领域的工程可行性等）
3. NovoStarchart 六维评估应以该领域的行业特征为基准
4. 上游专家报告中忽略领域特异性的结论，应在你的裁决中纠偏
` : ''}
${input.memoryContext ? `
## 历史经验参考（Agent Memory）
以下是平台积累的与本次分析相关的历史经验，请在分析时参考但不要盲从：
${input.memoryContext}
` : ''}

---

## 上游报告 A：学术审查员
- **评分**：${scores.academic}/100（置信度：${academicReview.confidence}）
- **核心发现**：${academicReview.keyFindings?.join(' | ') || '无'}
- **风险提示**：${academicReview.redFlags?.join(' | ') || '无'}
- **详细分析**：${academicReview.analysis}

## 上游报告 B：产业分析员
- **评分**：${scores.industry}/100（置信度：${industryAnalysis.confidence}）
- **核心发现**：${industryAnalysis.keyFindings?.join(' | ') || '无'}
- **风险提示**：${industryAnalysis.redFlags?.join(' | ') || '无'}
- **详细分析**：${industryAnalysis.analysis}

## 上游报告 C：竞品侦探
- **评分**：${scores.competitor}/100（置信度：${competitorAnalysis.confidence}）
- **核心发现**：${competitorAnalysis.keyFindings?.join(' | ') || '无'}
- **风险提示**：${competitorAnalysis.redFlags?.join(' | ') || '无'}
- **详细分析**：${competitorAnalysis.analysis}

---

## ⚠️ 评分差异预警

三位专家评分：学术 ${scores.academic} / 产业 ${scores.industry} / 竞品 ${scores.competitor}
平均分：${avgScore}，最大差异：${maxDiff} 分
${maxDiff > 20 ? '**警告：专家评分差异超过 20 分，请重点分析分歧原因！**' : '评分差异在正常范围内。'}

---

# 思维链（请按以下步骤逐步推理）

**Step 1 - 交叉验证**：
- 三位专家的结论中有哪些一致点？
- 有哪些矛盾？（如：学术说成熟但竞品说空白）
- 各专家的置信度是否可靠？数据支撑是否充分？

**Step 2 - 矛盾裁决**：
- 对每个矛盾点给出你的判断和理由
- 指出哪位专家的结论可能存在偏差

**Step 3 - 创新分类**：
- 颠覆式创新（全新赛道/技术范式转变）
- 平台式创新（构建生态或平台）
- 渐进式创新（现有方案的显著改进）
- 应用式创新（已有技术的新场景应用）

**Step 4 - 可行性评估**：
- 技术可行性：核心技术是否成熟？
- 市场可行性：目标用户是否明确？
- 执行可行性：是否需要大量资源？

**Step 5 - 护城河评估**：
- 该创意是否能建立技术壁垒？
- 网络效应/数据壁垒/品牌壁垒？

**Step 6 - NovoStarchart 六维创新性评估**：
基于德布林十型创新模型、IDEO DVF框架、Henderson-Clark分类法和ESG标准，对用户创意从以下六个维度分别独立评估（0-100分）：

1. **技术突破与性能跨越（techBreakthrough）**：
   - 产品功能独特性、技术含量、相对于现有方案的性能提升幅度
   - 组件知识和架构知识的创新程度（渐进式→架构→激进式）
   - 1分=完全模仿既有技术，100分=全球首创的颠覆性技术且专利壁垒极高

2. **商业模式与获利逻辑（businessModel）**：
   - 获利逻辑是否打破行业常规？（如买断→SaaS、免费增值等）
   - 商业活力：LTV/CAC比率、收入多元化程度、战略契合度
   - 1分=完全传统的定价策略，100分=颠覆行业获利规则的全新商业模式

3. **用户期望与交互体验（userExperience）**：
   - 是否解决了真实的、尚未被满足的用户痛点
   - 品牌情感连接、交互深度（NPS、CSAT、CES指标潜力）
   - 1分=用户无感/已有完善替代，100分=开创全新用户体验范式

4. **组织能力与流程效能（orgCapability）**：
   - 从概念到落地的执行路径是否清晰
   - 技术成熟度（TRL）、创新准备水平（IRL）
   - 1分=需要极长研发周期且路径模糊，100分=可快速迭代且流程高效

5. **网络协同与生态效应（networkEcosystem）**：
   - 是否能构建平台/生态效应、产品系统协同
   - 与外部合作伙伴的互补性、生态锁入效应
   - 1分=完全孤立的单一产品，100分=强大生态系统且高锁入效应

6. **社会贡献与环境可持续（socialImpact）**：
   - 对资源消耗、碳排放的降低程度
   - 社会投资回报率（SROI）、包容性与公平性
   - 1分=对环境社会无益或有害，100分=引领行业ESG标准、重大社会贡献

---

# 评分标准（Rubric）

## 综合评分（0-100）含义：
| 区间 | 含义 |
|------|------|
| 81-100 | 颠覆式创新，高壁垒，时机完美 |
| 61-80 | 高创新性，有明确壁垒，值得推进 |
| 41-60 | 中等创新，有一定可行性但壁垒不高 |
| 21-40 | 渐进式改进，壁垒弱，竞争优势不明显 |
| 0-20 | 创新性极低或完全不可行 |

## 4 个评分维度：
1. **原创性**（0-100）：创意的原创程度（综合学术空白 + 竞品差异）
2. **技术壁垒**（0-100）：能否建立有效的技术护城河
3. **市场时机**（0-100）：进入时机是否合适（综合产业阶段 + 趋势）
4. **执行可行性**（0-100）：技术和商业上是否可落地

---

# 自检 Checklist（输出前检查）

- [ ] 是否明确指出了三位专家之间的矛盾点？
- [ ] 每个矛盾裁决是否有你自己的独立理由？
- [ ] 创新分类是否有数据支撑（而非直觉）？
- [ ] 评分是否反映了交叉验证后的综合判断，而非简单平均？
- [ ] NovoStarchart 六维评分是否每个维度都有独立理由？

---

# 输出格式

⚠️ **关键要求**：以下仅为 JSON **结构**示例。所有 "YOUR_SCORE" 占位符必须替换为你根据上游三份报告**独立推理**得出的真实数值（0-100 整数）。**严禁直接复制示例中的任何数字，每个维度的分数必须基于该创意的实际情况独立打分！**

严格按以下 JSON 格式输出，不要有任何其他内容：
⚠️ **字段顺序很重要**：score/innovationRadar/keyFindings 等关键数据务必在前面先输出，reasoning 放最后（因为它最长，放后面可以确保关键评分和雷达数据先完成）。
{
  "agentName": "创新评估师",
  "score": "YOUR_SCORE",
  "confidence": "high 或 medium 或 low",
  "confidenceReasoning": "你的置信度理由...",
  "analysis": "最终分析结论（含矛盾裁决、创新分类、护城河评估）",
  "innovationRadar": [
    { "key": "techBreakthrough", "nameZh": "技术突破与性能跨越", "nameEn": "Technical Breakthrough", "score": "YOUR_SCORE", "reasoning": "你对该维度的独立分析..." },
    { "key": "businessModel", "nameZh": "商业模式与获利逻辑", "nameEn": "Business Model", "score": "YOUR_SCORE", "reasoning": "你对该维度的独立分析..." },
    { "key": "userExperience", "nameZh": "用户期望与交互体验", "nameEn": "User Experience", "score": "YOUR_SCORE", "reasoning": "你对该维度的独立分析..." },
    { "key": "orgCapability", "nameZh": "组织能力与流程效能", "nameEn": "Org Capability", "score": "YOUR_SCORE", "reasoning": "你对该维度的独立分析..." },
    { "key": "networkEcosystem", "nameZh": "网络协同与生态效应", "nameEn": "Network & Ecosystem", "score": "YOUR_SCORE", "reasoning": "你对该维度的独立分析..." },
    { "key": "socialImpact", "nameZh": "社会贡献与环境可持续", "nameEn": "Social Impact", "score": "YOUR_SCORE", "reasoning": "你对该维度的独立分析..." }
  ],
  "dimensionScores": [
    { "name": "原创性", "score": "YOUR_SCORE", "reasoning": "你的真实推理..." },
    { "name": "技术壁垒", "score": "YOUR_SCORE", "reasoning": "你的真实推理..." },
    { "name": "市场时机", "score": "YOUR_SCORE", "reasoning": "你的真实推理..." },
    { "name": "执行可行性", "score": "YOUR_SCORE", "reasoning": "你的真实推理..." }
  ],
  "keyFindings": ["交叉验证发现1", "矛盾裁决结论", "创新分类结论"],
  "redFlags": ["风险1"],
  "evidenceSources": ["学术审查员报告: ...", "产业分析员报告: ...", "竞品侦探报告: ..."],
  "reasoning": "按 Step1-6 的完整推理过程（此字段最长，放最后确保关键评分和六维雷达数据先输出完成）"
}

⚠️ **再次强调**：你必须根据上游三份报告的**具体内容**，为每个维度独立推理并给出**真实的、差异化的评分**。不同维度的分数应该反映该创意在各方面的真实表现差异。如果所有维度分数趋同，说明你的分析不够深入。
`;

    // 已知的示例值指纹（用于检测 AI 是否直接复制了示例分数）
    const EXAMPLE_FINGERPRINT = [75, 60, 70, 65, 50, 45];
    const EXAMPLE_KEYS = ['techBreakthrough', 'businessModel', 'userExperience', 'orgCapability', 'networkEcosystem', 'socialImpact'];

    function isExampleCopy(radar: InnovationRadarDimension[]): boolean {
        if (!Array.isArray(radar) || radar.length !== 6) return false;
        return EXAMPLE_KEYS.every((key, i) => {
            const dim = radar.find((d) => d.key === key);
            return dim && dim.score === EXAMPLE_FINGERPRINT[i];
        });
    }

    const callOptions = {
        timeout: 115000, // 对齐编排器 AGENT_TIMEOUT(120s)，留 5s 缓冲让编排器 abort 优先触发
        maxPromptLength: 80000,
        onStream: (chunk: string, isReasoning: boolean) => {
            if (input.onProgress) {
                input.onProgress('agent_stream', { agentId: 'innovationEvaluator', chunk, isReasoning });
            }
        },
    };

    try {
        // 第一次调用（temperature 0.85 提高输出多样性）
        const { text } = await callAIRaw(
            prompt,
            input.modelProvider,
            callOptions.timeout,
            callOptions.maxPromptLength,
            callOptions.onStream,
            input._abortSignal,
            16384, // 中文 reasoning + 六维评估需要更多 token 空间
            0.85  // 修复层 3：提高 temperature 避免示例复制
        );
        const result = parseAgentJSON<AgentOutput>(text);

        // 修复层 2：检测示例值复制
        if (result.innovationRadar && isExampleCopy(result.innovationRadar)) {
            console.warn('[创新评估师] ⚠️ 检测到六维分数与示例值完全一致，触发重试...');

            // 简短补充 prompt，强制重新评估六维分数
            const retryPrompt = `
你刚才输出的 innovationRadar 六维评分全部等于模板示例值 [75,60,70,65,50,45]，这是无效的。
请重新根据以下信息，独立评估六维评分并输出完整 JSON（格式与之前相同）：

用户创意：${input.query}
学术审查员评分：${scores.academic}/100
产业分析员评分：${scores.industry}/100
竞品侦探评分：${scores.competitor}/100

要求：
1. 每个维度必须根据创意的实际特征独立打分
2. 六个维度的分数之间应该有合理的差异（标准差至少 10 分以上）  
3. 分数需与上游三位专家的评分和分析内容逻辑一致
4. 每个维度至少写 20 字的 reasoning 理由

直接输出完整 JSON，不要有其他内容。
`;
            try {
                const { text: retryText } = await callAIRaw(
                    retryPrompt,
                    input.modelProvider,
                    callOptions.timeout,
                    callOptions.maxPromptLength,
                    callOptions.onStream,
                    input._abortSignal,
                    8192,
                    0.95  // 重试时使用更高 temperature
                );
                const retryResult = parseAgentJSON<AgentOutput>(retryText);
                if (retryResult.innovationRadar && !isExampleCopy(retryResult.innovationRadar)) {
                    console.log('[创新评估师] ✅ 重试成功，获得差异化评分');
                    // 保留原始分析内容，仅替换六维评分
                    result.innovationRadar = retryResult.innovationRadar;
                    if (retryResult.dimensionScores) result.dimensionScores = retryResult.dimensionScores;
                } else {
                    console.warn('[创新评估师] ⚠️ 重试仍返回示例值，保留原始结果并标记');
                }
            } catch (retryErr: unknown) {
                console.warn('[创新评估师] 重试失败，保留原始结果:', retryErr instanceof Error ? retryErr.message : String(retryErr));
            }
        }

        return result;
    } catch (err: unknown) {
        console.error('[创新评估师] Agent 执行失败:', err instanceof Error ? err.message : String(err));
        throw err;
    }
}
