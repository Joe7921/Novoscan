// ============================================================
// Mock AI 引擎 — 零成本本地开发
// ============================================================
//
// 模式说明（通过环境变量 MOCK_AI 控制）：
//   MOCK_AI=true     → 回放模式：优先回放录制文件，无录制时使用内置 fixture
//   MOCK_AI=record   → 录制模式：调用真实 API，将响应写入 .mock-recordings/
//   MOCK_AI=false|空  → 正常模式：直接调用真实 API
//
// 辅助环境变量：
//   MOCK_AI_DELAY=3000       → 模拟每次调用的额外延迟（毫秒）
//   MOCK_AI_ERROR_RATE=0.2   → 模拟 20% 的随机失败率
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ==================== 模式判断 ====================

/** Mock 模式类型 */
export type MockMode = 'true' | 'record' | false;

/**
 * 获取当前 Mock 模式
 */
export function getMockMode(): MockMode {
    const val = process.env.MOCK_AI?.toLowerCase();
    if (val === 'true') return 'true';
    if (val === 'record') return 'record';
    return false;
}

/**
 * 判断是否处于 Mock 回放模式（向后兼容）
 */
export function isMockMode(): boolean {
    return getMockMode() === 'true';
}

/**
 * 判断是否处于录制模式
 */
export function isRecordMode(): boolean {
    return getMockMode() === 'record';
}

// ==================== 延迟 & 错误模拟 ====================

/**
 * 获取配置的模拟延迟（毫秒）
 * 环境变量 MOCK_AI_DELAY，默认 0
 */
function getMockDelay(): number {
    const val = parseInt(process.env.MOCK_AI_DELAY || '0', 10);
    return isNaN(val) ? 0 : Math.max(0, val);
}

/**
 * 获取配置的模拟错误率
 * 环境变量 MOCK_AI_ERROR_RATE，取值 0~1，默认 0
 */
function getMockErrorRate(): number {
    const val = parseFloat(process.env.MOCK_AI_ERROR_RATE || '0');
    return isNaN(val) ? 0 : Math.max(0, Math.min(1, val));
}

/**
 * 应用模拟延迟（如果配置了的话）
 */
async function applyMockDelay(): Promise<void> {
    const delay = getMockDelay();
    if (delay > 0) {
        console.log(`[Mock AI] ⏱️  模拟延迟 ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
    }
}

/**
 * 检查是否应模拟失败（如果配置了错误率）
 * @throws 模拟的 API 错误
 */
function checkMockError(): void {
    const errorRate = getMockErrorRate();
    if (errorRate > 0 && Math.random() < errorRate) {
        const errors = [
            { status: 429, message: 'API rate limited (Mock 模拟)' },
            { status: 503, message: 'Service temporarily unavailable (Mock 模拟)' },
            { status: 500, message: 'Internal server error (Mock 模拟)' },
        ];
        const err = errors[Math.floor(Math.random() * errors.length)];
        console.warn(`[Mock AI] 💥 模拟 API 错误: ${err.status} ${err.message}`);
        throw new Error(`${err.message} [status: ${err.status}]`);
    }
}

// ==================== 流式模拟 ====================

/**
 * 模拟流式输出：将文本分块通过 onStream 回调传出
 * @param text - 要模拟流式输出的完整文本
 * @param onStream - 流式回调（与 callProvider 的 onStream 签名一致）
 * @param chunkSize - 每次输出的字符数（默认 50）
 * @param delayMs - 每 chunk 间隔毫秒（默认 15ms，模拟真实打字效果）
 */
export async function simulateStream(
    text: string,
    onStream: (chunk: string, isReasoning: boolean) => void,
    chunkSize: number = 50,
    delayMs: number = 15
): Promise<void> {
    for (let i = 0; i < text.length; i += chunkSize) {
        const chunk = text.slice(i, i + chunkSize);
        onStream(chunk, false);
        if (delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }
}

// ==================== 录制/回放：文件系统 ====================

/** 录制文件存储根目录 */
function getRecordingsDir(): string {
    return path.join(process.cwd(), '.mock-recordings');
}

/**
 * 生成 fixture 文件名
 * 格式：{agentType}_{queryHash}.json
 * queryHash 取 prompt 中的用户原始查询词的 MD5 前 8 位
 */
function getFixtureFileName(agentType: MockAgentType, prompt: string): string {
    // 尝试从 prompt 中提取用户查询词（通常在引号或特定标记中）
    const queryMatch = prompt.match(/(?:查询|query|创意|idea|分析|analyze)[：:\s]*[「"']([^「"']+)[」"']/i)
        || prompt.match(/用户(?:的)?(?:创意|查询|输入)[：:\s]*(.+?)(?:\n|$)/i);
    const queryText = queryMatch ? queryMatch[1].trim() : prompt.slice(0, 200);
    const hash = crypto.createHash('md5').update(queryText).digest('hex').slice(0, 8);
    return `${agentType}_${hash}.json`;
}

/**
 * 保存录制数据到文件
 */
function saveRecording(agentType: MockAgentType, prompt: string, response: string): void {
    try {
        const dir = getRecordingsDir();
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const fileName = getFixtureFileName(agentType, prompt);
        const filePath = path.join(dir, fileName);
        const recording = {
            _meta: {
                agentType,
                recordedAt: new Date().toISOString(),
                promptLength: prompt.length,
                responseLength: response.length,
                promptPreview: prompt.slice(0, 300) + (prompt.length > 300 ? '...' : ''),
            },
            response,
        };
        fs.writeFileSync(filePath, JSON.stringify(recording, null, 2), 'utf-8');
        console.log(`[Mock AI] 📼 录制已保存: ${fileName}`);
    } catch (err) {
        console.warn(`[Mock AI] ⚠️ 录制保存失败:`, (err as Error).message);
    }
}

/**
 * 保存 R1 录制数据
 */
function saveR1Recording(prompt: string, text: string, reasoningContent: string): void {
    try {
        const dir = getRecordingsDir();
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const hash = crypto.createHash('md5').update(prompt.slice(0, 200)).digest('hex').slice(0, 8);
        const fileName = `r1_${hash}.json`;
        const filePath = path.join(dir, fileName);
        const recording = {
            _meta: {
                agentType: 'deepseek-r1',
                recordedAt: new Date().toISOString(),
                promptLength: prompt.length,
                promptPreview: prompt.slice(0, 300) + (prompt.length > 300 ? '...' : ''),
            },
            text,
            reasoningContent,
        };
        fs.writeFileSync(filePath, JSON.stringify(recording, null, 2), 'utf-8');
        console.log(`[Mock AI] 📼 R1 录制已保存: ${fileName}`);
    } catch (err) {
        console.warn(`[Mock AI] ⚠️ R1 录制保存失败:`, (err as Error).message);
    }
}

/**
 * 尝试加载录制文件
 * 优先匹配精确的 agentType + queryHash，其次回退到同 agentType 的任意录制
 */
function loadRecording(agentType: MockAgentType, prompt: string): string | null {
    try {
        const dir = getRecordingsDir();
        if (!fs.existsSync(dir)) return null;

        // 1) 精确匹配：agentType + queryHash
        const exactFile = getFixtureFileName(agentType, prompt);
        const exactPath = path.join(dir, exactFile);
        if (fs.existsSync(exactPath)) {
            const data = JSON.parse(fs.readFileSync(exactPath, 'utf-8'));
            console.log(`[Mock AI] 🔄 精确匹配录制: ${exactFile}`);
            return data.response;
        }

        // 2) 模糊回退：同 agentType 的任意录制
        const files = fs.readdirSync(dir).filter(f => f.startsWith(`${agentType}_`) && f.endsWith('.json'));
        if (files.length > 0) {
            const fallbackFile = files[0];
            const data = JSON.parse(fs.readFileSync(path.join(dir, fallbackFile), 'utf-8'));
            console.log(`[Mock AI] 🔄 模糊回退录制: ${fallbackFile} (共 ${files.length} 个同类型录制)`);
            return data.response;
        }
    } catch (err) {
        console.warn(`[Mock AI] ⚠️ 加载录制失败:`, (err as Error).message);
    }
    return null;
}

/**
 * 尝试加载 R1 录制文件
 */
function loadR1Recording(prompt: string): { text: string; reasoningContent: string } | null {
    try {
        const dir = getRecordingsDir();
        if (!fs.existsSync(dir)) return null;

        const hash = crypto.createHash('md5').update(prompt.slice(0, 200)).digest('hex').slice(0, 8);
        const exactFile = `r1_${hash}.json`;
        const exactPath = path.join(dir, exactFile);
        if (fs.existsSync(exactPath)) {
            const data = JSON.parse(fs.readFileSync(exactPath, 'utf-8'));
            console.log(`[Mock AI] 🔄 精确匹配 R1 录制: ${exactFile}`);
            return { text: data.text, reasoningContent: data.reasoningContent };
        }

        // 模糊回退
        const files = fs.readdirSync(dir).filter(f => f.startsWith('r1_') && f.endsWith('.json'));
        if (files.length > 0) {
            const data = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf-8'));
            console.log(`[Mock AI] 🔄 模糊回退 R1 录制: ${files[0]}`);
            return { text: data.text, reasoningContent: data.reasoningContent };
        }
    } catch (err) {
        console.warn(`[Mock AI] ⚠️ 加载 R1 录制失败:`, (err as Error).message);
    }
    return null;
}

// ==================== Prompt → Agent 匹配 ====================

/** Agent 类型标识 */
type MockAgentType =
    | 'academicReviewer'
    | 'industryAnalyst'
    | 'innovationEvaluator'
    | 'competitorDetective'
    | 'arbitrator'
    | 'crossDomainScout'
    | 'debater'
    | 'qualityGuard'
    | 'generic';

/**
 * 根据 prompt 中的关键词匹配对应的 Agent 类型
 * 按照各 Agent prompt 中的角色标识关键词做模糊匹配
 */
function detectAgentType(prompt: string): MockAgentType {
    const lower = prompt.toLowerCase();

    if (lower.includes('academic') || lower.includes('学术') || lower.includes('reviewer') || lower.includes('论文')) {
        return 'academicReviewer';
    }
    if (lower.includes('industry') || lower.includes('产业') || lower.includes('analyst') || lower.includes('行业')) {
        return 'industryAnalyst';
    }
    if (lower.includes('innovation') || lower.includes('创新') || lower.includes('evaluator') || lower.includes('novelty')) {
        return 'innovationEvaluator';
    }
    if (lower.includes('competitor') || lower.includes('竞品') || lower.includes('detective') || lower.includes('竞争')) {
        return 'competitorDetective';
    }
    if (lower.includes('arbitrat') || lower.includes('仲裁') || lower.includes('综合') || lower.includes('final verdict')) {
        return 'arbitrator';
    }
    if (lower.includes('cross-domain') || lower.includes('跨域') || lower.includes('跨领域') || lower.includes('scout')) {
        return 'crossDomainScout';
    }
    if (lower.includes('debate') || lower.includes('辩论') || lower.includes('challenge') || lower.includes('rebuttal')) {
        return 'debater';
    }
    if (lower.includes('quality') || lower.includes('质检') || lower.includes('consistency') || lower.includes('guard')) {
        return 'qualityGuard';
    }

    return 'generic';
}

// ==================== 预录制 Fixture 数据（内置兜底） ====================

/** 通用 AgentOutput fixture 模板 */
function makeAgentOutput(name: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        agentName: name,
        analysis: `[Mock] ${name} 的详细分析报告。该创意在技术可行性、市场前景和创新性方面均表现良好。基于对学术文献和产业数据的交叉验证，该方向具有较高的研究价值和商业化潜力。`,
        score: 72,
        confidence: 'medium',
        confidenceReasoning: '[Mock] 基于有限的检索数据和 AI 分析，置信度为中等。建议进一步验证核心假设。',
        keyFindings: [
            '[Mock] 技术方案具有理论基础支撑',
            '[Mock] 市场存在未被满足的需求缺口',
            '[Mock] 近 3 年相关领域论文发表量呈上升趋势',
        ],
        redFlags: [
            '[Mock] 核心技术路线尚未经过大规模验证',
        ],
        evidenceSources: [
            'OpenAlex: 15 篇相关论文',
            'Brave Search: 8 条产业新闻',
            'GitHub: 3 个相关开源项目',
        ],
        reasoning: '[Mock] 通过交叉比对学术数据和产业数据，综合评估了技术成熟度、市场规模、竞争格局等多个维度。',
        dimensionScores: [
            { name: '技术可行性', score: 75, reasoning: '[Mock] 核心技术路线有文献支撑' },
            { name: '市场前景', score: 70, reasoning: '[Mock] 目标市场规模适中，增长趋势明显' },
            { name: '创新程度', score: 68, reasoning: '[Mock] 在现有方案基础上有增量创新' },
        ],
        ...overrides,
    };
}

/** 各 Agent 的 fixture 响应（JSON 字符串，模拟真实 AI 返回） */
const MOCK_FIXTURES: Record<MockAgentType, string> = {

    academicReviewer: JSON.stringify(makeAgentOutput('学术审查员', {
        score: 68,
        analysis: '[Mock] 学术审查报告：经过对 OpenAlex、arXiv、CrossRef 等数据源的全面检索，发现该创意方向在学术界已有初步探索，但尚未形成主流研究范式。最近 3 年发表论文约 42 篇，引用总量 380 次，说明该领域处于早期成长阶段。',
        keyFindings: [
            '[Mock] 全球约 42 篇直接相关论文，引用总量 380 次',
            '[Mock] 最高被引论文来自 MIT，2024 年发表于 Nature Communications',
            '[Mock] 开放获取论文比例达 60%，学术生态健康',
        ],
        similarPapers: [
            {
                title: '[Mock] A Novel Framework for Cross-Modal Innovation Analysis',
                year: 2024, similarityScore: 72,
                keyDifference: '该论文侧重于理论框架构建，而用户创意更偏向工程实现',
                description: '提出了一种跨模态创新分析框架，通过多维度评分实现自动化创新性评估。',
                authors: 'Zhang et al.', url: 'https://example.com/paper1',
                citationCount: 45, venue: 'Nature Communications', authorityLevel: 'high',
            },
            {
                title: '[Mock] Deep Learning Approaches for Patent Novelty Detection',
                year: 2023, similarityScore: 58,
                keyDifference: '聚焦于专利领域，与用户的学术创新场景有差异',
                description: '利用深度学习技术实现专利文献的新颖性自动检测。',
                authors: 'Liu & Wang', url: 'https://example.com/paper2',
                citationCount: 23, venue: 'ACM Computing Surveys', authorityLevel: 'high',
            },
        ],
    })),

    industryAnalyst: JSON.stringify(makeAgentOutput('产业分析师', {
        score: 74,
        analysis: '[Mock] 产业分析报告：该创意方向在全球市场中呈现明显增长态势。根据 Brave Search 和 GitHub 数据，行业巨头（Google、Microsoft、OpenAI）均已布局相关技术。预计 2026 年全球市场规模将达 45 亿美元。本地化和垂直行业应用是差异化竞争的关键突破口。',
        keyFindings: [
            '[Mock] 预计 2026 年全球市场规模 45 亿美元',
            '[Mock] Google、Microsoft 等巨头已有布局',
            '[Mock] 垂直行业应用是差异化竞争关键',
        ],
        dimensionScores: [
            { name: '市场规模', score: 78, reasoning: '[Mock] TAM 约 45 亿美元，增长率 22%' },
            { name: '竞争格局', score: 65, reasoning: '[Mock] 巨头已入场，但垂直领域仍有空间' },
            { name: '商业化路径', score: 72, reasoning: '[Mock] SaaS + API 模式可快速变现' },
        ],
    })),

    innovationEvaluator: JSON.stringify(makeAgentOutput('创新评估师', {
        score: 76,
        analysis: '[Mock] 创新评估报告：该创意在技术创新性、应用创新性和模式创新性三个维度综合评估后，展现出较强的创新潜力。特别是在跨学科融合方面，有望产生突破性成果。',
        keyFindings: [
            '[Mock] 技术路线融合了多个前沿领域',
            '[Mock] 应用场景有明确的用户痛点',
            '[Mock] 商业模式具有可持续性',
        ],
        innovationRadar: [
            { key: 'techBreakthrough', nameZh: '技术突破性', nameEn: 'Tech Breakthrough', score: 75, reasoning: '[Mock] 融合多种前沿技术' },
            { key: 'marketDisruption', nameZh: '市场颠覆性', nameEn: 'Market Disruption', score: 62, reasoning: '[Mock] 对现有市场格局有一定冲击' },
            { key: 'paradigmShift', nameZh: '范式转变', nameEn: 'Paradigm Shift', score: 55, reasoning: '[Mock] 部分改变现有工作流程' },
            { key: 'crossDomain', nameZh: '跨域融合', nameEn: 'Cross-Domain', score: 80, reasoning: '[Mock] 跨学科融合度高' },
            { key: 'scalability', nameZh: '规模化潜力', nameEn: 'Scalability', score: 70, reasoning: '[Mock] 技术架构支持大规模部署' },
            { key: 'sustainability', nameZh: '可持续性', nameEn: 'Sustainability', score: 68, reasoning: '[Mock] 商业模式和技术演进路径可持续' },
        ],
    })),

    competitorDetective: JSON.stringify(makeAgentOutput('竞品侦探', {
        score: 70,
        analysis: '[Mock] 竞品分析报告：通过对 GitHub、ProductHunt、Crunchbase 等平台数据交叉验证，发现目前市场上有 3 个直接竞品和 5 个间接竞品。用户创意的差异化优势在于：多 Agent 协作架构和跨域迁移能力。',
        keyFindings: [
            '[Mock] 直接竞品 3 个，间接竞品 5 个',
            '[Mock] 主要竞品 A 已获 B 轮融资 2000 万美元',
            '[Mock] 用户创意在跨域迁移方面具有差异化优势',
        ],
        redFlags: [
            '[Mock] 头部竞品 A 的用户基数已达 10 万+',
            '[Mock] 部分技术特征可能涉及已有专利',
        ],
    })),

    arbitrator: JSON.stringify({
        summary: '[Mock] 经过四位专家 Agent 的独立评审和对抗辩论，综合研判如下：该创意具有中等偏上的创新价值，技术路线可行但面临一定竞争压力。建议优先在垂直场景验证 PMF，再考虑横向扩展。',
        overallScore: 73,
        recommendation: '[Mock] 值得推进至 MVP 阶段。建议先在教育科技和医疗健康两个垂直领域做概念验证。',
        conflictsResolved: [
            '[Mock] 学术审查员与竞品侦探在"技术新颖性"上的分歧已调和：学术上有一定基础，但工程实现方式确属创新',
        ],
        nextSteps: [
            '[Mock] 1. 在目标垂直领域进行用户调研（2 周）',
            '[Mock] 2. 构建最小可行产品原型（4 周）',
            '[Mock] 3. 申请相关技术专利保护',
        ],
        weightedBreakdown: {
            academic: { raw: 68, weight: 0.25, weighted: 17, confidence: 'medium' },
            industry: { raw: 74, weight: 0.30, weighted: 22.2, confidence: 'medium' },
            innovation: { raw: 76, weight: 0.25, weighted: 19, confidence: 'medium' },
            competitor: { raw: 70, weight: 0.20, weighted: 14, confidence: 'medium' },
        },
        consensusLevel: 'moderate',
        dissent: ['[Mock] 学术审查员对长期技术壁垒持保留意见'],
    }),

    crossDomainScout: JSON.stringify({
        ...makeAgentOutput('跨域侦察兵', {
            score: 78,
            analysis: '[Mock] 跨域创新迁移报告：通过对航天、生物医学、游戏设计等领域的技术原理比对，发现 3 条高价值跨域迁移路径。',
        }),
        bridges: [
            {
                sourceField: '人工智能', targetField: '生物医学',
                techPrinciple: '多 Agent 协作决策机制',
                sourceExample: '多 Agent 辩论式 AI 评审系统',
                targetExample: '多专家远程会诊决策支持系统',
                transferPath: '将 AI Agent 协作框架迁移至医疗多专家协同诊断',
                noveltyPotential: 82, feasibility: 'high', riskLevel: 'medium',
            },
            {
                sourceField: '人工智能', targetField: '游戏设计',
                techPrinciple: '创新性评分的多维雷达图',
                sourceExample: 'NovoStarchart 六维创新性评估',
                targetExample: '游戏平衡性多维评估工具',
                transferPath: '将创新评估雷达图模型应用于游戏数值平衡分析',
                noveltyPotential: 65, feasibility: 'medium', riskLevel: 'low',
            },
        ],
        knowledgeGraph: {
            nodes: [
                { id: 'n1', label: '多 Agent 协作', field: 'AI', type: 'technology' },
                { id: 'n2', label: '远程会诊系统', field: '生物医学', type: 'application' },
                { id: 'n3', label: '协作决策', field: '通用', type: 'principle' },
            ],
            edges: [
                { source: 'n1', target: 'n3', relation: 'same_principle', strength: 0.9 },
                { source: 'n3', target: 'n2', relation: 'inspires', strength: 0.75 },
            ],
        },
        exploredDomains: ['生物医学', '游戏设计', '航天工程', '金融科技'],
        transferSummary: '[Mock] 共发现 2 条高价值跨域迁移路径，其中"多 Agent 协作 → 远程会诊"具有最高的创新潜力和可行性。',
    }),

    debater: JSON.stringify({
        round: 1,
        challenger: '竞品侦探',
        challengerArgument: '[Mock] 市场已有成熟竞品，技术壁垒不高',
        challengerEvidence: ['竞品 A 已获 B 轮融资', '核心技术栈为开源方案'],
        defender: '创新评估师',
        defenderRebuttal: '[Mock] 多 Agent 协作架构和跨域迁移能力是核心差异化',
        defenderEvidence: ['架构设计获得学术审查员认可', '跨域迁移在现有竞品中未见实现'],
        outcome: 'draw',
        outcomeReasoning: '[Mock] 双方论据均有合理支撑，市场竞争压力确实存在，但差异化路径清晰',
    }),

    qualityGuard: JSON.stringify({
        passed: true,
        issues: [],
        warnings: ['[Mock] 学术审查员与产业分析师在技术成熟度评估上有 8 分偏差，已在可接受范围内'],
        consistencyScore: 85,
        corrections: [],
    }),

    generic: JSON.stringify({
        result: '[Mock] 通用 AI 响应。当前处于 Mock 模式，返回预录制数据。',
        score: 70,
        analysis: '[Mock] 这是一个通用的 Mock 响应，用于未匹配到特定 Agent 类型的调用。',
    }),
};

// ==================== 对外接口 ====================

/**
 * 获取 Mock AI 响应（回放模式）
 * 优先级：录制文件（精确匹配 → 同类型回退）→ 内置 fixture
 */
export async function getMockResponse(
    prompt: string,
    onStream?: (chunk: string, isReasoning: boolean) => void,
): Promise<string> {
    const agentType = detectAgentType(prompt);

    // 延迟 & 错误模拟
    await applyMockDelay();
    checkMockError();

    // 优先尝试加载录制文件
    const recorded = loadRecording(agentType, prompt);
    const mockText = recorded || MOCK_FIXTURES[agentType];
    const source = recorded ? '录制文件' : '内置 fixture';

    console.log(`[Mock AI] 🎭 拦截 AI 调用 → Agent: ${agentType}, 来源: ${source}, 长度: ${mockText.length} 字符`);

    // 基础延迟（不受 MOCK_AI_DELAY 影响的最小延迟）
    await new Promise(r => setTimeout(r, 50));

    if (onStream) {
        await simulateStream(mockText, onStream);
    }

    return mockText;
}

/**
 * 获取 Mock DeepSeek R1 响应
 */
export async function getMockR1Response(
    prompt: string,
): Promise<{ text: string; reasoningContent: string }> {
    // 延迟 & 错误模拟
    await applyMockDelay();
    checkMockError();

    // 优先尝试加载 R1 录制文件
    const recorded = loadR1Recording(prompt);
    if (recorded) {
        console.log(`[Mock AI] 🎭 拦截 R1 调用 → 来源: 录制文件`);
        return recorded;
    }

    console.log(`[Mock AI] 🎭 拦截 R1 调用 → 来源: 内置 fixture, prompt 长度: ${prompt.length} 字符`);

    await new Promise(r => setTimeout(r, 100));

    const reasoningContent = [
        '[Mock 思维链] 让我分析一下这个创意的各个方面...',
        '首先，从技术可行性角度来看，该方案的核心技术栈是成熟的。',
        '其次，市场层面存在明确的需求信号。',
        '最后，综合考虑创新性和竞争格局，做出如下判断。',
    ].join('\n');

    const text = MOCK_FIXTURES.arbitrator;
    return { text, reasoningContent };
}

/**
 * 录制模式：保存真实 AI 响应到文件（供 callProvider 回调后使用）
 */
export function recordResponse(prompt: string, response: string): void {
    if (!isRecordMode()) return;
    const agentType = detectAgentType(prompt);
    saveRecording(agentType, prompt, response);
}

/**
 * 录制模式：保存真实 R1 响应到文件
 */
export function recordR1Response(prompt: string, text: string, reasoningContent: string): void {
    if (!isRecordMode()) return;
    saveR1Recording(prompt, text, reasoningContent);
}
