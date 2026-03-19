/**
 * Novoscan 工作流引擎 — 公共入口
 *
 * Step 1: Agent 注册表
 * Step 2: 工作流 JSON Schema + 校验器 + 预设
 * Step 3+: 执行引擎（后续步骤逐步添加）
 */

// Step 1: Agent 注册表
export {
    getAgentRegistry,
    getAgent,
    getAgent as getBuiltinAgent, // 向后兼容别名
    listAllAgents,
    ensureAgentRegistryReady,
    registerCustomAgent,
    listCustomAgents,
} from './agent-registry';

export type {
    StandardAgentFn,
    CrossAgentFn,
    ArbitratorFn,
    DebateFn,
    QualityGuardFn,
    AgentRole,
    BuiltinAgentEntry,
    CustomAgentEntry,
    CustomAgentConfig,
    AgentEntry,
} from './agent-registry';

// Step 2: 工作流 Schema + 校验器
export type {
    WorkflowDefinition,
    WorkflowNode,
    WorkflowEdge,
    WorkflowConfig,
    AgentNode,
    ParallelNode,
    ConditionNode,
    DebateNode,
    QualityNode,
    WorkflowCondition,
    WorkflowContext,
} from './types';

export {
    validateWorkflow,
    loadPreset,
    listPresets,
} from './validator';

export type { ValidationResult } from './validator';

// Step 3: 工作流执行引擎
export { executeWorkflow } from './engine';

// Step 6: Prompt 模板引擎
export {
    renderTemplate,
    extractVariables,
    validateTemplate,
    getDefaultPrompt,
    listPromptTemplates,
    BUILTIN_VARIABLES,
} from './prompt-template';

export type {
    PromptTemplate,
    TemplateContext,
    TemplateParseResult,
    TemplateVariable,
} from './prompt-template';
