/**
 * Novoscan 工作流引擎 — 工作流 Schema 类型定义
 *
 * 将硬编码的 Agent 编排管线转变为声明式 JSON Schema，
 * 让开发者通过编辑 JSON 即可定义自己的分析工作流。
 *
 * 核心概念：
 * - WorkflowDefinition：工作流顶层定义（节点 + 边 + 配置）
 * - WorkflowNode：5 种节点类型（agent / parallel / condition / debate / quality）
 * - WorkflowEdge：节点间的数据流连线
 *
 * @module workflow/types
 */

import type { AgentRole } from './agent-registry';

// ==================== 工作流顶层定义 ====================

/**
 * 工作流定义 — 描述完整的 Agent 编排管线
 *
 * @example
 * ```json
 * {
 *   "id": "novoscan-default",
 *   "name": "Novoscan 默认管线",
 *   "version": "1.0.0",
 *   "nodes": [...],
 *   "edges": [...],
 *   "config": { "totalTimeout": 380000 }
 * }
 * ```
 */
export interface WorkflowDefinition {
    /** 工作流唯一标识（kebab-case） */
    id: string;
    /** 显示名（中文） */
    name: string;
    /** 英文名 */
    nameEn: string;
    /** 语义化版本号 */
    version: string;
    /** 一句话描述 */
    description: string;
    /** 英文描述 */
    descriptionEn: string;
    /** emoji 图标 */
    icon: string;
    /** 作者 */
    author: string;
    /** 是否为系统预设（不可删除） */
    isPreset: boolean;

    /** 节点列表 */
    nodes: WorkflowNode[];
    /** 边列表（数据流连线） */
    edges: WorkflowEdge[];

    /** 全局配置 */
    config: WorkflowConfig;

    /** 社区分享元数据（可选） */
    meta?: WorkflowMeta;
}

/** 社区分享元数据 */
export interface WorkflowMeta {
    /** 分享者名称 */
    sharedBy?: string;
    /** 分享时间戳 */
    sharedAt?: number;
    /** 下载/导入次数 */
    downloads?: number;
    /** 标签 */
    tags?: string[];
    /** 社区唯一 ID（base64 编码的指纹） */
    communityId?: string;
}

/** 工作流全局配置 */
export interface WorkflowConfig {
    /** 总超时时间（ms），默认 380000 */
    totalTimeout: number;
    /** 熔断阈值：≥ 此数量的 L1 Agent 返回 fallback 则中止，默认 3 */
    circuitBreakerThreshold: number;
    /** 预估运行时间描述（给前端展示） */
    estimatedDuration?: string;
    /** 预估运行时间（秒，给前端展示） */
    estimatedDurationSec?: number;
}

// ==================== 节点类型 ====================

/**
 * 工作流节点 — 联合类型，5 种节点
 */
export type WorkflowNode =
    | AgentNode
    | ParallelNode
    | ConditionNode
    | DebateNode
    | QualityNode
    | RetryNode;

/** 所有节点共有的基础字段 */
interface BaseNode {
    /** 节点唯一 ID（工作流内唯一，如 'node-academic'） */
    id: string;
    /** 在可视化编辑器中的位置坐标 */
    position?: { x: number; y: number };
    /** 节点描述（可选，给开发者看） */
    comment?: string;
}

/**
 * Agent 节点 — 执行单个 Agent
 *
 * 关联的 Agent 通过 agentId 在注册表中查找。
 * 支持标准型、交叉型、仲裁型三种 Agent。
 */
export interface AgentNode extends BaseNode {
    type: 'agent';
    /** 关联的 Agent ID（对应 agent-registry 中的 id） */
    agentId: string;
    /** Agent 角色（引擎据此决定如何调用） */
    role: AgentRole;
    /** 超时时间（ms），覆盖 Agent 默认超时 */
    timeout?: number;
    /** 降级策略 */
    fallbackStrategy: 'statistical' | 'skip' | 'default';
    /** 自定义 Prompt 模板（覆盖内置 Prompt，支持 {{变量}} 插值） */
    customPrompt?: string;
    /** 显示名（覆盖注册表中的名称，可选） */
    label?: string;
    /** 图标（覆盖注册表中的图标，可选） */
    icon?: string;
}

/**
 * 并行节点 — 同时执行多个子节点
 *
 * 所有 childNodeIds 引用的节点将被并行调度，
 * 全部完成后（或超时降级后）进入下一个节点。
 */
export interface ParallelNode extends BaseNode {
    type: 'parallel';
    /** 要并行执行的子节点 ID 列表 */
    childNodeIds: string[];
    /** 显示名 */
    label?: string;
}

/**
 * 条件节点 — 运行时动态分支
 *
 * 根据条件表达式决定走 trueTarget 还是 falseTarget。
 * 条件表达式在引擎内以安全的方式求值（不使用 eval）。
 */
export interface ConditionNode extends BaseNode {
    type: 'condition';
    /** 条件表达式（引擎内置解释器求值） */
    condition: WorkflowCondition;
    /** 满足条件时跳转的节点 ID */
    trueTarget: string;
    /** 不满足条件时跳转的节点 ID */
    falseTarget: string;
    /** 显示名 */
    label?: string;
}

/**
 * 条件表达式 — 安全结构化（不使用字符串 eval）
 *
 * @example
 * { field: "fallbackCount", operator: ">=", value: 2 }
 * 等价于：运行时上下文中 fallbackCount >= 2
 */
export interface WorkflowCondition {
    /** 运行时上下文字段名 */
    field: string;
    /** 比较运算符 */
    operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
    /** 比较值 */
    value: number | string | boolean;
}

/**
 * 辩论节点 — NovoDebate 对抗辩论（可编程模块）
 *
 * 引擎将自动从运行时上下文中获取 Agent 输出作为辩论输入。
 * 开发者可自定义辩论的每个细节：轮次、辩手、模式、Prompt。
 */
export interface DebateNode extends BaseNode {
    type: 'debate';
    /** 超时时间（ms） */
    timeout?: number;
    /** 触发辩论所需的最小评分差异（默认 15，设为 0 = 强制辩论） */
    minScoreDivergence?: number;
    /** 最大辩论轮次（1-10，默认 3） */
    maxRounds?: number;
    /** 参与辩论的 Agent ID 列表（为空则自动从上游 Agent 中选取） */
    participants?: string[];
    /**
     * 辩论模式
     * - structured：结构化对抗（挑战→反驳→裁判，默认）
     * - freeform：自由辩论（开放式讨论，单轮多角度）
     */
    debateMode?: 'structured' | 'freeform';
    /** 自定义辩论规则 Prompt（覆盖内置辩论 Prompt，支持 {{变量}} 插值） */
    customPrompt?: string;
    /** 是否攻防轮换（每轮攻守互换，默认 true） */
    autoSwapRoles?: boolean;
    /** 是否启用收敛检测（连续同结果提前终止，默认 true） */
    convergenceEnabled?: boolean;
    /** 显示名 */
    label?: string;
    /** 图标 */
    icon?: string;
}

/**
 * 质量检查节点 — 逻辑一致性检查 + 自动修正
 */
export interface QualityNode extends BaseNode {
    type: 'quality';
    /** 显示名 */
    label?: string;
    /** 图标 */
    icon?: string;
}

/**
 * 重试节点 — 支持「质量不通过 → 回到某节点重跑」的循环
 *
 * 引擎会检查 retryCondition，如果条件成立且未达 maxRetries，
 * 抹掉目标节点的 executed 标记并重新执行它。
 */
export interface RetryNode extends BaseNode {
    type: 'retry';
    /** 最大重试次数（1-5，默认 2） */
    maxRetries: number;
    /** 触发重试的条件（如果条件成立则重试，不成立则放行） */
    retryCondition: WorkflowCondition;
    /** 重试目标节点 ID（回到这个节点重新执行） */
    targetNodeId: string;
    /** 显示名 */
    label?: string;
    /** 图标 */
    icon?: string;
}

// ==================== 边定义 ====================

/**
 * 工作流边 — 节点间的数据流连线
 *
 * 决定节点的执行顺序和数据传递关系。
 * 引擎通过边的有向图进行拓扑排序，确定执行计划。
 */
export interface WorkflowEdge {
    /** 边唯一 ID（可选，自动生成） */
    id?: string;
    /** 源节点 ID */
    source: string;
    /** 目标节点 ID */
    target: string;
    /** 边标签（可选，给可视化编辑器显示） */
    label?: string;
}

// ==================== 运行时上下文（引擎内部使用） ====================

/**
 * 工作流运行时上下文 — 引擎执行期间维护的状态
 *
 * 节点执行完毕后，输出会被写入上下文，供下游节点读取。
 */
export interface WorkflowContext {
    /** 各节点的输出（nodeId → output） */
    outputs: Record<string, unknown>;
    /** L1 Agent 中 fallback 的数量 */
    fallbackCount: number;
    /** 全部 Agent 输出（按 agentId） */
    agentOutputs: Record<string, unknown>;
    /** 开始时间 */
    startTime: number;
    /** 日志记录 */
    logs: string[];
    /** 重试节点计数器（retryNodeId → 已重试次数） */
    retryCounters: Record<string, number>;
}
