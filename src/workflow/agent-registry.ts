/**
 * Novoscan 工作流引擎 — Agent 统一注册表
 *
 * 将内置 Agent（硬编码 import）和插件 Agent（INovoAgent）统一为一个注册表，
 * 为后续的 JSON 驱动工作流引擎奠基。
 *
 * 设计原则：
 * - 内置 Agent 保持原有函数签名不变（零改动）
 * - 注册表只做"索引"，不改变 Agent 内部逻辑
 * - 与现有 PluginRegistry 共存，插件 Agent 自动桥接
 *
 * @module workflow/agent-registry
 */

import type { AgentInput, AgentOutput, ArbitrationResult, DebateRecord, CrossDomainScoutOutput } from '@/agents/types';
import type { ModelProvider } from '@/types';

// ==================== 内置 Agent 签名类型 ====================

/**
 * 标准型 Agent 函数签名（学术审查员 / 产业分析员 / 竞品侦探 / 跨域侦察兵）
 * 仅接收 AgentInput，返回 AgentOutput
 */
export type StandardAgentFn = (input: AgentInput) => Promise<AgentOutput>;

/**
 * 交叉型 Agent 函数签名（创新评估师）
 * 接收 AgentInput + 上游 Agent 输出
 */
export type CrossAgentFn = (
    input: AgentInput,
    academicReview: AgentOutput,
    industryAnalysis: AgentOutput,
    competitorAnalysis: AgentOutput
) => Promise<AgentOutput>;

/**
 * 仲裁型 Agent 函数签名（仲裁员）
 * 接收所有 Agent 输出 + 语言 + 模型提供商 + 可选参数
 */
export type ArbitratorFn = (
    academicReview: AgentOutput,
    industryAnalysis: AgentOutput,
    innovationEvaluation: AgentOutput,
    competitorAnalysis: AgentOutput,
    language: 'zh' | 'en',
    modelProvider: ModelProvider,
    onProgress?: (event: string, data: unknown) => void,
    abortSignal?: AbortSignal,
    domainHint?: string,
    debateRecord?: DebateRecord,
    crossDomainResult?: CrossDomainScoutOutput
) => Promise<ArbitrationResult>;

/**
 * 辩论引擎函数签名
 */
export type DebateFn = (
    agents: {
        academic: AgentOutput;
        industry: AgentOutput;
        innovation: AgentOutput;
        competitor: AgentOutput;
    },
    query: string,
    modelProvider: ModelProvider,
    onProgress?: (type: string, data: unknown) => void,
    abortSignal?: AbortSignal,
    remainingTime?: number,
    options?: Record<string, unknown>
) => Promise<DebateRecord>;

/**
 * 质量把关函数签名（同步）
 */
export type QualityGuardFn = (
    arbitration: ArbitrationResult,
    agents: AgentOutput[],
    debateRecord?: DebateRecord
) => import('@/agents/types').QualityCheckResult;

// ==================== 注册表条目类型 ====================

/** Agent 角色类型 — 决定其在管线中的位置和调用方式 */
export type AgentRole = 'standard' | 'cross' | 'arbitrator' | 'debate' | 'quality';

/** 内置 Agent 注册条目 */
export interface BuiltinAgentEntry {
    /** 唯一标识 */
    id: string;
    /** 中文显示名 */
    name: string;
    /** 英文显示名 */
    nameEn: string;
    /** 一句话描述 */
    description: string;
    /** emoji 图标 */
    icon: string;
    /** 角色类型 */
    role: AgentRole;
    /** Agent 函数引用（运行时懒加载） */
    fn: StandardAgentFn | CrossAgentFn | ArbitratorFn | DebateFn | QualityGuardFn;
    /** 默认超时（ms） */
    defaultTimeout: number;
    /** 管线层级（L1=并行初始层, L2=交叉层, L2.5=辩论层, L3=仲裁层, L4=质量层） */
    layer: 'L1' | 'L2' | 'L2.5' | 'L3' | 'L4';
    /** 是否为内置 Agent（区别于插件 Agent） */
    builtin: true;
}

// ==================== 自定义/插件 Agent 类型 ====================

/**
 * 自定义 Agent 注册参数
 *
 * 开发者通过 registerCustomAgent() 提供此对象即可注册一个自定义 Agent。
 */
export interface CustomAgentConfig {
    /** 唯一 ID（kebab-case，如 'patent-analyzer'） */
    id: string;
    /** 中文显示名 */
    name: string;
    /** 英文显示名（可选） */
    nameEn?: string;
    /** 一句话描述 */
    description?: string;
    /** emoji 图标（默认 🤖） */
    icon?: string;
    /** Agent 函数（接收 AgentInput，返回 AgentOutput） */
    fn: StandardAgentFn;
    /** 配置项 */
    schema?: {
        /** 超时（ms，默认 60000） */
        timeout?: number;
        /** 角色（默认 standard） */
        role?: AgentRole;
        /** 层级（默认 L1） */
        layer?: 'L1' | 'L2' | 'L2.5' | 'L3' | 'L4';
    };
}

/** 自定义 Agent 注册条目（内部存储） */
export interface CustomAgentEntry {
    id: string;
    name: string;
    nameEn: string;
    description: string;
    icon: string;
    role: AgentRole;
    fn: StandardAgentFn;
    defaultTimeout: number;
    layer: 'L1' | 'L2' | 'L2.5' | 'L3' | 'L4';
    /** 标记为自定义 Agent */
    builtin: false;
    /** 来源（手动注册 / 插件系统 / 市场） */
    source: 'manual' | 'plugin' | 'marketplace';
}

// ==================== Agent 注册表（单例） ====================

/** 注册表条目统一类型 */
export type AgentEntry = BuiltinAgentEntry | CustomAgentEntry;

class AgentRegistry {
    private static instance: AgentRegistry | null = null;
    private entries: Map<string, AgentEntry> = new Map();
    private initialized = false;

    private constructor() {}

    static getInstance(): AgentRegistry {
        if (!AgentRegistry.instance) {
            AgentRegistry.instance = new AgentRegistry();
        }
        return AgentRegistry.instance;
    }

    /**
     * 注册一个内置 Agent
     */
    register(entry: BuiltinAgentEntry): void {
        if (this.entries.has(entry.id)) {
            console.warn(`[AgentRegistry] ⚠️ Agent "${entry.id}" 已注册，将被覆盖`);
        }
        this.entries.set(entry.id, entry);
    }

    /**
     * 注册一个自定义/插件 Agent
     */
    registerCustom(config: CustomAgentConfig, source: 'manual' | 'plugin' | 'marketplace' = 'manual'): void {
        if (this.entries.has(config.id)) {
            console.warn(`[AgentRegistry] ⚠️ Agent "${config.id}" 已注册，将被覆盖`);
        }
        const entry: CustomAgentEntry = {
            id: config.id,
            name: config.name,
            nameEn: config.nameEn || config.name,
            description: config.description || '',
            icon: config.icon || '🤖',
            role: config.schema?.role || 'standard',
            fn: config.fn,
            defaultTimeout: config.schema?.timeout || 60000,
            layer: config.schema?.layer || 'L1',
            builtin: false,
            source,
        };
        this.entries.set(config.id, entry);
        console.log(`[AgentRegistry] 🔌 自定义 Agent "${config.name}" (${config.id}) 已注册 [${source}]`);
    }

    /**
     * 按 ID 获取 Agent 条目
     */
    get(id: string): AgentEntry | undefined {
        return this.entries.get(id);
    }

    /**
     * 获取指定角色的所有 Agent
     */
    getByRole(role: AgentRole): AgentEntry[] {
        return Array.from(this.entries.values()).filter(e => e.role === role);
    }

    /**
     * 获取指定层级的所有 Agent
     */
    getByLayer(layer: BuiltinAgentEntry['layer']): AgentEntry[] {
        return Array.from(this.entries.values()).filter(e => e.layer === layer);
    }

    /**
     * 列出所有已注册的 Agent
     */
    listAll(): AgentEntry[] {
        return Array.from(this.entries.values());
    }

    /**
     * 列出所有自定义（非内置）Agent
     */
    listCustom(): CustomAgentEntry[] {
        return Array.from(this.entries.values()).filter((e): e is CustomAgentEntry => !e.builtin);
    }

    /**
     * 列出所有内置 Agent
     */
    listBuiltin(): BuiltinAgentEntry[] {
        return Array.from(this.entries.values()).filter((e): e is BuiltinAgentEntry => e.builtin);
    }

    /**
     * 替换一个已注册的 Agent（开发者自定义用）
     * 允许社区开发者用自己的实现替换任意内置 Agent
     */
    replace(id: string, newFn: StandardAgentFn | CrossAgentFn | ArbitratorFn | DebateFn | QualityGuardFn): boolean {
        const existing = this.entries.get(id);
        if (!existing) {
            console.warn(`[AgentRegistry] \u26a0\ufe0f Agent "${id}" \u4e0d\u5b58\u5728\uff0c\u65e0\u6cd5\u66ff\u6362`);
            return false;
        }
        // 安全替换：原地修改 fn 避免 discriminated union 展开问题
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (existing as any).fn = newFn;
        console.log(`[AgentRegistry] 🔄 Agent "${id}" 已被替换`);
        return true;
    }

    /**
     * 初始化：注册所有内置 Agent（懒加载，只执行一次）
     */
    async ensureInitialized(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        // 懒加载内置 Agent 模块
        const [
            { academicReviewer },
            { industryAnalyst },
            { competitorDetective },
            { innovationEvaluator },
            { crossDomainScout },
            { arbitrator },
            { executeNovoDebate },
            { qualityGuard },
        ] = await Promise.all([
            import('@/agents/academic-reviewer'),
            import('@/agents/industry-analyst'),
            import('@/agents/competitor-detective'),
            import('@/agents/innovation-evaluator'),
            import('@/agents/cross-domain-scout'),
            import('@/agents/arbitration'),
            import('@/agents/debate'),
            import('@/agents/quality-guard'),
        ]);

        // ---- Layer 1：并行初始层（标准型） ----
        this.register({
            id: 'academic-reviewer',
            name: '学术审查员',
            nameEn: 'Academic Reviewer',
            description: '检索学术文献，评估创意的学术创新性和文献空白度',
            icon: '📚',
            role: 'standard',
            fn: academicReviewer as StandardAgentFn,
            defaultTimeout: 120000,
            layer: 'L1',
            builtin: true,
        });

        this.register({
            id: 'industry-analyst',
            name: '产业分析员',
            nameEn: 'Industry Analyst',
            description: '分析产业趋势、市场信号和商业化可行性',
            icon: '🏭',
            role: 'standard',
            fn: industryAnalyst as StandardAgentFn,
            defaultTimeout: 120000,
            layer: 'L1',
            builtin: true,
        });

        this.register({
            id: 'competitor-detective',
            name: '竞品侦探',
            nameEn: 'Competitor Detective',
            description: '侦察 GitHub 竞品项目，评估竞争格局和差异化空间',
            icon: '🔍',
            role: 'standard',
            fn: competitorDetective as StandardAgentFn,
            defaultTimeout: 120000,
            layer: 'L1',
            builtin: true,
        });

        this.register({
            id: 'cross-domain-scout',
            name: '跨域侦察兵',
            nameEn: 'Cross-Domain Scout',
            description: '探索跨领域技术迁移机会，发现创新桥梁',
            icon: '🌐',
            role: 'standard',
            fn: crossDomainScout as StandardAgentFn,
            defaultTimeout: 120000,
            layer: 'L1',
            builtin: true,
        });

        // ---- Layer 2：交叉层 ----
        this.register({
            id: 'innovation-evaluator',
            name: '创新评估师',
            nameEn: 'Innovation Evaluator',
            description: '综合交叉质疑 L1 报告，独立评估创新性和六维雷达',
            icon: '💡',
            role: 'cross',
            fn: innovationEvaluator as CrossAgentFn,
            defaultTimeout: 120000,
            layer: 'L2',
            builtin: true,
        });

        // ---- Layer 2.5：辩论层 ----
        this.register({
            id: 'novo-debate',
            name: 'NovoDebate 对抗辩论',
            nameEn: 'NovoDebate',
            description: '当 Agent 评分分歧 >20 分时自动触发对抗辩论',
            icon: '⚔️',
            role: 'debate',
            fn: executeNovoDebate as unknown as DebateFn,
            defaultTimeout: 60000,
            layer: 'L2.5',
            builtin: true,
        });

        // ---- Layer 3：仲裁层 ----
        this.register({
            id: 'arbitrator',
            name: '首席仲裁员',
            nameEn: 'Chief Arbitrator',
            description: '整合全部报告和辩论记录，做出透明的最终裁决',
            icon: '⚖️',
            role: 'arbitrator',
            fn: arbitrator as ArbitratorFn,
            defaultTimeout: 90000,
            layer: 'L3',
            builtin: true,
        });

        // ---- Layer 4：质量层 ----
        this.register({
            id: 'quality-guard',
            name: '质量把关',
            nameEn: 'Quality Guard',
            description: '逻辑一致性检查、评分矛盾检测和自动修正',
            icon: '🛡️',
            role: 'quality',
            fn: qualityGuard as QualityGuardFn,
            defaultTimeout: 5000,
            layer: 'L4',
            builtin: true,
        });

        console.log(`[AgentRegistry] ✅ 已注册 ${this.entries.size} 个内置 Agent`);
    }

    /**
     * 获取注册表摘要（调试/管理面板用）
     */
    getSummary(): { total: number; byLayer: Record<string, string[]> } {
        const byLayer: Record<string, string[]> = {};
        for (const entry of this.entries.values()) {
            if (!byLayer[entry.layer]) byLayer[entry.layer] = [];
            byLayer[entry.layer].push(`${entry.icon} ${entry.name} (${entry.id})`);
        }
        return { total: this.entries.size, byLayer };
    }

    /** 重置（测试用） */
    _reset(): void {
        this.entries.clear();
        this.initialized = false;
        AgentRegistry.instance = null;
    }
}

// ==================== 便捷导出 ====================

/** 获取 Agent 注册表单例 */
export function getAgentRegistry(): AgentRegistry {
    return AgentRegistry.getInstance();
}

/** 按 ID 获取 Agent */
export function getAgent(id: string): AgentEntry | undefined {
    return AgentRegistry.getInstance().get(id);
}

/** 列出所有 Agent（内置 + 自定义） */
export function listAllAgents(): AgentEntry[] {
    return AgentRegistry.getInstance().listAll();
}

/**
 * 注册自定义 Agent（开发者 API）
 *
 * @example
 * ```typescript
 * registerCustomAgent({
 *     id: 'patent-analyzer',
 *     name: '专利分析师',
 *     fn: async (input) => { ... },
 *     schema: { timeout: 60000, role: 'standard' },
 * });
 * ```
 */
export function registerCustomAgent(config: CustomAgentConfig): void {
    AgentRegistry.getInstance().registerCustom(config, 'manual');
}

/** 列出所有自定义 Agent */
export function listCustomAgents(): CustomAgentEntry[] {
    return AgentRegistry.getInstance().listCustom();
}

/** 确保注册表已初始化（首次调用时懒加载所有内置 Agent） */
export async function ensureAgentRegistryReady(): Promise<void> {
    await AgentRegistry.getInstance().ensureInitialized();
}

export default AgentRegistry;
