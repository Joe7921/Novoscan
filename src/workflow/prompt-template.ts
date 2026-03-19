/**
 * Novoscan 工作流引擎 — Prompt 模板引擎
 *
 * 支持 Mustache 风格的变量插值（{{variable}}），
 * 让开发者为每个 Agent 节点定义自定义系统提示词。
 *
 * 内置变量：
 *  - {{query}}           — 用户输入的分析主题
 *  - {{language}}        — 输出语言（zh / en）
 *  - {{modelProvider}}   — 当前模型提供商
 *  - {{domainHint}}      — 领域提示
 *  - {{academicData}}    — 学术审查员输出（JSON）
 *  - {{industryData}}    — 产业分析员输出（JSON）
 *  - {{competitorData}}  — 竞品侦探输出（JSON）
 *  - {{crossDomainData}} — 跨域侦察兵输出（JSON）
 *  - {{innovationData}}  — 创新评估师输出（JSON）
 *  - {{allAgentOutputs}} — 全部 Agent 输出汇总
 *
 * @module workflow/prompt-template
 */

// ==================== 类型定义 ====================

/** Prompt 模板定义 */
export interface PromptTemplate {
    /** 模板唯一 ID */
    id: string;
    /** 显示名 */
    name: string;
    /** 模板内容（含 {{变量}} 占位符） */
    content: string;
    /** 适用的 Agent ID（空 = 通用） */
    agentId?: string;
    /** 一句话描述 */
    description?: string;
    /** 内置模板标识（不可删除） */
    builtin?: boolean;
}

/** 模板渲染上下文 — 运行时填入的变量值 */
export interface TemplateContext {
    /** 用户输入（必填） */
    query: string;
    /** 语言 */
    language?: string;
    /** 模型提供商 */
    modelProvider?: string;
    /** 领域提示 */
    domainHint?: string;
    /** 各 Agent 输出（agentId → JSON 字符串） */
    agentOutputs?: Record<string, string>;
    /** 自定义变量（开发者扩展） */
    custom?: Record<string, string>;
}

/** 模板解析结果 */
export interface TemplateParseResult {
    /** 是否解析成功 */
    valid: boolean;
    /** 渲染后的文本 */
    rendered: string;
    /** 未匹配到的变量列表 */
    unmatchedVars: string[];
    /** 警告列表 */
    warnings: string[];
}

// ==================== 变量注册表 ====================

/** 变量描述（给编辑器 UI 展示） */
export interface TemplateVariable {
    /** 变量名（不含大括号） */
    name: string;
    /** 中文描述 */
    label: string;
    /** 英文描述 */
    labelEn: string;
    /** 类别 */
    category: 'input' | 'agent-output' | 'config' | 'custom';
    /** 示例值 */
    example: string;
}

/** 所有可用的内置变量 */
export const BUILTIN_VARIABLES: TemplateVariable[] = [
    { name: 'query',           label: '分析主题',     labelEn: 'Query',          category: 'input',        example: '基于 CRISPR 的基因编辑平台' },
    { name: 'language',        label: '输出语言',     labelEn: 'Language',       category: 'config',       example: 'zh' },
    { name: 'modelProvider',   label: '模型提供商',   labelEn: 'Model Provider', category: 'config',       example: 'deepseek' },
    { name: 'domainHint',      label: '领域提示',     labelEn: 'Domain Hint',    category: 'config',       example: '生物技术' },
    { name: 'academicData',    label: '学术审查输出', labelEn: 'Academic Data',  category: 'agent-output', example: '{"score": 85, ...}' },
    { name: 'industryData',    label: '产业分析输出', labelEn: 'Industry Data',  category: 'agent-output', example: '{"score": 72, ...}' },
    { name: 'competitorData',  label: '竞品侦探输出', labelEn: 'Competitor Data', category: 'agent-output', example: '{"score": 68, ...}' },
    { name: 'crossDomainData', label: '跨域侦察输出', labelEn: 'Cross Domain',   category: 'agent-output', example: '{"score": 78, ...}' },
    { name: 'innovationData',  label: '创新评估输出', labelEn: 'Innovation Data', category: 'agent-output', example: '{"score": 80, ...}' },
    { name: 'allAgentOutputs', label: '全部输出汇总', labelEn: 'All Outputs',    category: 'agent-output', example: '{...}' },
];

/** Agent ID → 变量名 映射 */
const AGENT_TO_VAR: Record<string, string> = {
    'academic-reviewer':    'academicData',
    'industry-analyst':     'industryData',
    'competitor-detective':  'competitorData',
    'cross-domain-scout':   'crossDomainData',
    'innovation-evaluator': 'innovationData',
};

// ==================== 核心渲染引擎 ====================

/**
 * 渲染 Prompt 模板
 *
 * 支持 `{{variable}}` 语法，自动从上下文中查找变量值。
 * 未匹配的变量保留原样并记录到 unmatchedVars。
 *
 * @param template - 模板文本
 * @param context - 渲染上下文
 * @returns 解析结果
 */
export function renderTemplate(template: string, context: TemplateContext): TemplateParseResult {
    const unmatchedVars: string[] = [];
    const warnings: string[] = [];

    // 构建变量查找表
    const vars: Record<string, string> = {
        query: context.query,
        language: context.language || 'zh',
        modelProvider: context.modelProvider || 'deepseek',
        domainHint: context.domainHint || '',
    };

    // 注入 Agent 输出变量
    if (context.agentOutputs) {
        for (const [agentId, varName] of Object.entries(AGENT_TO_VAR)) {
            if (context.agentOutputs[agentId]) {
                vars[varName] = context.agentOutputs[agentId];
            }
        }
        // allAgentOutputs 汇总
        vars.allAgentOutputs = JSON.stringify(context.agentOutputs);
    }

    // 注入自定义变量
    if (context.custom) {
        for (const [key, value] of Object.entries(context.custom)) {
            vars[key] = value;
        }
    }

    // 执行替换：{{varName}} → 实际值
    const rendered = template.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
        if (varName in vars) {
            return vars[varName];
        }
        unmatchedVars.push(varName);
        return match; // 保留原样
    });

    if (unmatchedVars.length > 0) {
        warnings.push(`以下变量未匹配：${unmatchedVars.join('、')}`);
    }

    return {
        valid: unmatchedVars.length === 0,
        rendered,
        unmatchedVars,
        warnings,
    };
}

/**
 * 提取模板中使用的变量列表
 *
 * @param template - 模板文本
 * @returns 变量名数组（不含大括号）
 */
export function extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
}

/**
 * 校验模板语法
 *
 * @param template - 待校验模板
 * @returns 校验结果
 */
export function validateTemplate(template: string): {
    valid: boolean;
    errors: string[];
    variables: string[];
} {
    const errors: string[] = [];
    const variables = extractVariables(template);

    if (!template.trim()) {
        errors.push('模板内容不能为空');
    }

    // 检查非法大括号（未正确闭合）
    const openCount = (template.match(/\{\{/g) || []).length;
    const closeCount = (template.match(/\}\}/g) || []).length;
    if (openCount !== closeCount) {
        errors.push(`大括号未正确配对：{{ 出现 ${openCount} 次，}} 出现 ${closeCount} 次`);
    }

    // 检查未知变量
    const knownVars = new Set(BUILTIN_VARIABLES.map(v => v.name));
    for (const v of variables) {
        if (!knownVars.has(v)) {
            // 非内置变量 — 不算错误，只警告（可能是自定义变量）
        }
    }

    return { valid: errors.length === 0, errors, variables };
}

// ==================== 内置 Prompt 模板 ====================

/**
 * 各 Agent 的默认 Prompt 模板
 *
 * 开发者可以在编辑器中基于这些模板修改，
 * 也可以从空白开始写全新的 Prompt。
 */
export const DEFAULT_PROMPTS: Record<string, PromptTemplate> = {
    'academic-reviewer': {
        id: 'tpl-academic-default',
        name: '学术审查员默认 Prompt',
        agentId: 'academic-reviewer',
        builtin: true,
        description: '检索学术文献，评估创意的学术创新性',
        content: `你是一位资深学术审查员。请对以下创意/技术方向进行学术文献审查。

## 分析主题
{{query}}

## 领域
{{domainHint}}

## 要求
1. 检索相关学术文献和专利，重点关注近 5 年内的研究成果
2. 评估该创意在学术领域的创新性和文献空白度
3. 识别核心竞争论文和研究组
4. 输出结构化的评分和关键发现

请使用 {{language}} 输出。`,
    },

    'industry-analyst': {
        id: 'tpl-industry-default',
        name: '产业分析员默认 Prompt',
        agentId: 'industry-analyst',
        builtin: true,
        description: '分析产业趋势和商业化可行性',
        content: `你是一位产业分析员。请分析以下创意/技术的产业化前景。

## 分析主题
{{query}}

## 要求
1. 分析相关产业趋势和市场规模
2. 评估商业化可行性和潜在壁垒
3. 识别目标客户群体和市场切入点
4. 分析政策环境和监管风险

请使用 {{language}} 输出。`,
    },

    'competitor-detective': {
        id: 'tpl-competitor-default',
        name: '竞品侦探默认 Prompt',
        agentId: 'competitor-detective',
        builtin: true,
        description: '侦察 GitHub 竞品项目',
        content: `你是一位竞品侦探。请侦察以下创意/技术相关的竞品和替代方案。

## 分析主题
{{query}}

## 要求
1. 搜索 GitHub、ProductHunt 等平台的相关项目
2. 评估竞品的技术成熟度和社区活跃度
3. 分析差异化空间和竞争壁垒
4. 识别潜在的合作或收购目标

请使用 {{language}} 输出。`,
    },

    'innovation-evaluator': {
        id: 'tpl-innovation-default',
        name: '创新评估师默认 Prompt',
        agentId: 'innovation-evaluator',
        builtin: true,
        description: '综合交叉评估创新性',
        content: `你是一位创新评估师。请综合以下各维度报告进行交叉验证和创新性评估。

## 分析主题
{{query}}

## 上游报告
- 学术审查：{{academicData}}
- 产业分析：{{industryData}}
- 竞品侦察：{{competitorData}}

## 要求
1. 交叉比对各报告的结论一致性
2. 独立评估该创意的六维创新雷达
3. 识别报告之间的矛盾和盲点
4. 给出综合创新性评分和建议

请使用 {{language}} 输出。`,
    },

    'arbitrator': {
        id: 'tpl-arbitrator-default',
        name: '仲裁员默认 Prompt',
        agentId: 'arbitrator',
        builtin: true,
        description: '综合裁决',
        content: `你是首席仲裁员。请整合全部分析报告，做出最终的透明裁决。

## 分析主题
{{query}}

## 全部报告
{{allAgentOutputs}}

## 要求
1. 综合所有 Agent 的分析结论
2. 处理矛盾观点，给出合理权重
3. 输出最终推荐等级（强烈推荐/推荐/谨慎/不推荐）
4. 提供透明的决策依据和行动建议

请使用 {{language}} 输出。`,
    },

    // ==================== 辩论专用 Prompt 模板 ====================

    'debate-challenger': {
        id: 'tpl-debate-challenger',
        name: '辩论挑战方 Prompt',
        agentId: 'novo-debate',
        builtin: true,
        description: '辩论中挑战方的发言规则和角度',
        content: `你是 {{challengerName}}，正在一场专家辩论中担任 **挑战方**。

## 分析主题
{{query}}

## 你的任务
基于你的报告数据，对对手的结论提出**有数据支撑**的质疑。

## 规则
1. 必须引用具体数据来支撑你的质疑
2. 每轮必须提出与之前不同的新论点
3. 质疑要有建设性，指出对方分析的盲点

请使用 {{language}} 输出。`,
    },

    'debate-defender': {
        id: 'tpl-debate-defender',
        name: '辩论防守方 Prompt',
        agentId: 'novo-debate',
        builtin: true,
        description: '辩论中防守方的反驳规则',
        content: `你是 {{defenderName}}，正在一场专家辩论中担任 **防守方**。

## 分析主题
{{query}}

## 你的任务
针对对方的质疑进行**有理有据**的反驳。

## 规则
1. 直接回应对方的论点（不要顾左右而言他）
2. 引用你报告中的数据来支撑反驳
3. 如果对方的质疑有道理，承认部分观点并补充解释

请使用 {{language}} 输出。`,
    },

    'debate-judge': {
        id: 'tpl-debate-judge',
        name: '辩论裁判 Prompt',
        agentId: 'novo-debate',
        builtin: true,
        description: '辩论裁判的评判标准',
        content: `你是一位公正的辩论裁判。

## 评判标准
1. **论点针对性**：防守方是否直接回应了质疑？
2. **证据质量**：证据是否具体、可验证、直接支撑论点
3. **逻辑严密性**：论证链是否完整，有无逻辑跳跃
4. **承认与反驳**：能承认对方合理部分并给出更深层解释者加分

请使用 {{language}} 输出。`,
    },
};

/**
 * 获取指定 Agent 的默认 Prompt 模板
 */
export function getDefaultPrompt(agentId: string): PromptTemplate | null {
    return DEFAULT_PROMPTS[agentId] || null;
}

/**
 * 获取所有可用的 Prompt 模板（内置 + 用户自定义）
 */
export function listPromptTemplates(): PromptTemplate[] {
    return Object.values(DEFAULT_PROMPTS);
}

// ==================== Prompt 实时预览 ====================

/**
 * Mock 预览上下文 — 模拟真实变量值，让预览面板呈现逼真效果
 */
export const MOCK_PREVIEW_CONTEXT: TemplateContext = {
    query: '量子计算在药物发现中的应用前景',
    language: 'zh',
    modelProvider: 'deepseek',
    domainHint: '量子计算, 药物研发, 分子模拟',
    agentOutputs: {
        'academic-reviewer': '发现 23 篇核心论文，其中 Nature 子刊 5 篇。量子化学模拟已在小分子对接中展现 100x 加速潜力...',
        'industry-analyst': '市场规模预计从 2025 年 $1.2B 增长至 2030 年 $8.5B (CAGR 47.8%)。头部玩家: IBM Quantum, Google Sycamore...',
        'competitor-detective': '竞品 QuantumPharma 已完成 B 轮融资 $45M，核心技术: 变分量子特征求解器(VQE)...',
        'cross-domain-scout': '跨域迁移机会: 材料科学量子模拟方法可直接移植到蛋白质折叠预测...',
    },
    custom: {
        customField: '自定义字段示例',
    },
};

/**
 * 使用 mock 数据渲染 Prompt 预览
 *
 * 在编辑 Prompt 时实时调用，展示模板变量替换后的效果。
 *
 * @param template - Prompt 模板文本
 * @param customContext - 可选的自定义上下文覆盖
 * @returns 渲染结果
 */
export function renderPreview(
    template: string,
    customContext?: Partial<TemplateContext>
): TemplateParseResult {
    const context: TemplateContext = {
        ...MOCK_PREVIEW_CONTEXT,
        ...customContext,
    };
    return renderTemplate(template, context);
}
