/**
 * Novoscan 工作流引擎 — 工作流 JSON 校验器
 *
 * 在加载/保存工作流 JSON 时进行合法性校验：
 * - 结构完整性（必填字段）
 * - 节点 ID 唯一性
 * - 边引用合法性（source/target 必须存在）
 * - 环依赖检测（DAG 校验）
 * - 必要节点检查（至少 1 个 agent + 1 个 quality）
 *
 * @module workflow/validator
 */

import type { WorkflowDefinition, WorkflowNode, WorkflowEdge, RetryNode } from './types';

/** 校验结果 */
export interface ValidationResult {
    /** 是否通过校验 */
    valid: boolean;
    /** 错误列表（阻塞级，必须修复） */
    errors: string[];
    /** 警告列表（非阻塞，建议修复） */
    warnings: string[];
}

/**
 * 校验工作流定义的合法性
 *
 * @param workflow - 待校验的工作流 JSON
 * @returns 校验结果
 */
export function validateWorkflow(workflow: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // ---- 基础结构校验 ----
    if (!workflow || typeof workflow !== 'object') {
        return { valid: false, errors: ['工作流必须是非空对象'], warnings: [] };
    }

    const wf = workflow as Record<string, unknown>;

    // 必填字段
    if (!wf.id || typeof wf.id !== 'string') errors.push('缺少 id 字段');
    if (!wf.name || typeof wf.name !== 'string') errors.push('缺少 name 字段');
    if (!wf.version || typeof wf.version !== 'string') errors.push('缺少 version 字段');

    if (!Array.isArray(wf.nodes) || wf.nodes.length === 0) {
        errors.push('nodes 必须为非空数组');
        return { valid: false, errors, warnings };
    }

    if (!Array.isArray(wf.edges)) {
        errors.push('edges 必须为数组');
        return { valid: false, errors, warnings };
    }

    const nodes = wf.nodes as WorkflowNode[];
    const edges = wf.edges as WorkflowEdge[];

    // ---- 节点校验 ----
    const nodeIds = new Set<string>();
    let hasAgentNode = false;
    let hasQualityNode = false;

    for (const node of nodes) {
        // ID 存在性
        if (!node.id || typeof node.id !== 'string') {
            errors.push(`节点缺少 id 字段: ${JSON.stringify(node).slice(0, 80)}`);
            continue;
        }

        // ID 唯一性
        if (nodeIds.has(node.id)) {
            errors.push(`节点 ID 重复: "${node.id}"`);
        }
        nodeIds.add(node.id);

        // type 存在性
        if (!node.type) {
            errors.push(`节点 "${node.id}" 缺少 type 字段`);
            continue;
        }

        // 类型特定校验
        switch (node.type) {
            case 'agent':
                hasAgentNode = true;
                if (!node.agentId) {
                    errors.push(`Agent 节点 "${node.id}" 缺少 agentId`);
                }
                if (!node.role) {
                    errors.push(`Agent 节点 "${node.id}" 缺少 role`);
                }
                if (!node.fallbackStrategy) {
                    warnings.push(`Agent 节点 "${node.id}" 未指定 fallbackStrategy，将使用默认 "statistical"`);
                }
                break;

            case 'parallel':
                if (!Array.isArray(node.childNodeIds) || node.childNodeIds.length === 0) {
                    errors.push(`并行节点 "${node.id}" 的 childNodeIds 必须为非空数组`);
                }
                break;

            case 'condition':
                if (!node.condition) {
                    errors.push(`条件节点 "${node.id}" 缺少 condition`);
                } else {
                    if (!node.condition.field) errors.push(`条件节点 "${node.id}" 的 condition.field 缺失`);
                    if (!node.condition.operator) errors.push(`条件节点 "${node.id}" 的 condition.operator 缺失`);
                    if (node.condition.value === undefined) errors.push(`条件节点 "${node.id}" 的 condition.value 缺失`);
                }
                if (!node.trueTarget) errors.push(`条件节点 "${node.id}" 缺少 trueTarget`);
                if (!node.falseTarget) errors.push(`条件节点 "${node.id}" 缺少 falseTarget`);
                break;

            case 'debate':
                // 辩论节点无必填字段（超时有默认值）
                break;

            case 'quality':
                hasQualityNode = true;
                break;

            case 'retry': {
                const retryNode = node as RetryNode;
                if (!retryNode.targetNodeId) {
                    errors.push(`重试节点 "${node.id}" 缺少 targetNodeId`);
                }
                if (retryNode.targetNodeId && !nodeIds.has(retryNode.targetNodeId)) {
                    // 延迟检查：此时可能还未遍历到目标节点，在下方单独校验
                }
                if (!retryNode.retryCondition) {
                    errors.push(`重试节点 "${node.id}" 缺少 retryCondition`);
                }
                if (typeof retryNode.maxRetries !== 'number' || retryNode.maxRetries < 1 || retryNode.maxRetries > 10) {
                    warnings.push(`重试节点 "${node.id}" 的 maxRetries 建议在 1-10 之间`);
                }
                break;
            }

            default:
                errors.push(`节点 "${node.id}" 类型 "${(node as { type: string }).type}" 不合法，支持: agent/parallel/condition/debate/quality/retry`);
        }
    }

    // 必要节点检查
    if (!hasAgentNode) {
        errors.push('工作流至少需要 1 个 agent 类型节点');
    }
    if (!hasQualityNode) {
        warnings.push('工作流缺少 quality 节点，建议添加质量把关步骤');
    }

    // ---- 边校验 ----
    for (const edge of edges) {
        if (!edge.source || !edge.target) {
            errors.push(`边定义不完整: ${JSON.stringify(edge)}`);
            continue;
        }
        if (!nodeIds.has(edge.source)) {
            errors.push(`边的 source "${edge.source}" 不存在于节点列表中`);
        }
        if (!nodeIds.has(edge.target)) {
            errors.push(`边的 target "${edge.target}" 不存在于节点列表中`);
        }
        if (edge.source === edge.target) {
            errors.push(`边的 source 和 target 不能相同: "${edge.source}"`);
        }
    }

    // ---- 并行节点子节点引用校验 ----
    for (const node of nodes) {
        if (node.type === 'parallel') {
            for (const childId of node.childNodeIds) {
                if (!nodeIds.has(childId)) {
                    errors.push(`并行节点 "${node.id}" 引用了不存在的子节点: "${childId}"`);
                }
            }
        }
        if (node.type === 'condition') {
            if (node.trueTarget && !nodeIds.has(node.trueTarget)) {
                errors.push(`条件节点 "${node.id}" 的 trueTarget "${node.trueTarget}" 不存在`);
            }
            if (node.falseTarget && !nodeIds.has(node.falseTarget)) {
                errors.push(`条件节点 "${node.id}" 的 falseTarget "${node.falseTarget}" 不存在`);
            }
        }
    }

    // ---- 重试节点 targetNodeId 引用校验 ----
    for (const node of nodes) {
        if (node.type === 'retry') {
            const retryNode = node as RetryNode;
            if (retryNode.targetNodeId && !nodeIds.has(retryNode.targetNodeId)) {
                errors.push(`重试节点 "${node.id}" 的 targetNodeId "${retryNode.targetNodeId}" 不存在`);
            }
        }
    }

    // ---- 环依赖检测（拓扑排序法） ----
    if (errors.length === 0) {
        // 收集所有重试节点的回环边（合法重试环）
        const retryBackEdges = new Set<string>();
        for (const node of nodes) {
            if (node.type === 'retry') {
                const retryNode = node as RetryNode;
                // 重试节点指向 targetNodeId 的边是合法回环，不参与环检测
                retryBackEdges.add(`${node.id}::${retryNode.targetNodeId}`);
            }
        }
        const cycleError = detectCycle(nodes, edges, retryBackEdges);
        if (cycleError) {
            errors.push(cycleError);
        }
    }

    // ---- 配置校验 ----
    if (wf.config && typeof wf.config === 'object') {
        const config = wf.config as Record<string, unknown>;
        if (typeof config.totalTimeout === 'number' && config.totalTimeout < 10000) {
            warnings.push(`totalTimeout (${config.totalTimeout}ms) 过短，建议 ≥ 30000ms`);
        }
    } else {
        warnings.push('缺少 config 配置，将使用默认值');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * 环依赖检测 — Kahn 拓扑排序法
 *
 * 构建有向图的邻接表和入度表，逐步移除入度为 0 的节点。
 * 如果最终仍有节点剩余，说明存在环依赖。
 *
 * @returns 环依赖错误描述，无环返回 null
 */
function detectCycle(nodes: WorkflowNode[], edges: WorkflowEdge[], retryBackEdges?: Set<string>): string | null {
    // 构建邻接表和入度表
    const adj: Map<string, string[]> = new Map();
    const inDegree: Map<string, number> = new Map();

    for (const node of nodes) {
        adj.set(node.id, []);
        inDegree.set(node.id, 0);
    }

    // 从 edges 构建图（排除合法重试回环边）
    for (const edge of edges) {
        const edgeKey = `${edge.source}::${edge.target}`;
        if (retryBackEdges?.has(edgeKey)) continue; // 跳过合法重试环
        const neighbors = adj.get(edge.source);
        if (neighbors) neighbors.push(edge.target);
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }

    // 从 condition 节点的 trueTarget/falseTarget 构建隐式边
    for (const node of nodes) {
        if (node.type === 'condition') {
            if (node.trueTarget && adj.has(node.id)) {
                adj.get(node.id)!.push(node.trueTarget);
                inDegree.set(node.trueTarget, (inDegree.get(node.trueTarget) ?? 0) + 1);
            }
            if (node.falseTarget && adj.has(node.id)) {
                adj.get(node.id)!.push(node.falseTarget);
                inDegree.set(node.falseTarget, (inDegree.get(node.falseTarget) ?? 0) + 1);
            }
        }
    }

    // Kahn BFS
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
        if (degree === 0) queue.push(id);
    }

    let processed = 0;
    while (queue.length > 0) {
        const current = queue.shift()!;
        processed++;
        for (const neighbor of (adj.get(current) ?? [])) {
            const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
            inDegree.set(neighbor, newDegree);
            if (newDegree === 0) queue.push(neighbor);
        }
    }

    if (processed < nodes.length) {
        // 找出环中的节点
        const cycleNodes = nodes
            .filter(n => (inDegree.get(n.id) ?? 0) > 0)
            .map(n => n.id);
        return `检测到环依赖：节点 [${cycleNodes.join(', ')}] 形成循环，工作流必须是有向无环图 (DAG)`;
    }

    return null;
}

/**
 * 加载并校验预设工作流
 */
export function loadPreset(presetId: string): WorkflowDefinition | null {
    try {
        /* eslint-disable @typescript-eslint/no-require-imports */
        let data: unknown;
        switch (presetId) {
            case 'novoscan-default':
                data = require('./presets/default.json');
                break;
            case 'quick-academic':
                data = require('./presets/quick-academic.json');
                break;
            case 'minimal':
                data = require('./presets/minimal.json');
                break;
            case 'forced-debate':
                data = require('./presets/forced-debate.json');
                break;
            case 'industry-focus':
                data = require('./presets/industry-focus.json');
                break;
            default:
                console.warn(`[WorkflowValidator] 未知预设: "${presetId}"`);
                return null;
        }
        /* eslint-enable @typescript-eslint/no-require-imports */

        const result = validateWorkflow(data);
        if (!result.valid) {
            console.error(`[WorkflowValidator] 预设 "${presetId}" 校验失败:`, result.errors);
            return null;
        }
        if (result.warnings.length > 0) {
            console.warn(`[WorkflowValidator] 预设 "${presetId}" 校验警告:`, result.warnings);
        }

        return data as WorkflowDefinition;
    } catch (err: unknown) {
        console.error(`[WorkflowValidator] 加载预设 "${presetId}" 失败:`, err instanceof Error ? err.message : err);
        return null;
    }
}

/**
 * 获取所有可用预设列表（元数据，不含完整节点/边）
 */
export function listPresets(): Array<{
    id: string;
    name: string;
    nameEn: string;
    description: string;
    descriptionEn: string;
    icon: string;
    nodeCount: number;
    estimatedDuration?: string;
}> {
    const presetIds = ['novoscan-default', 'quick-academic', 'minimal', 'forced-debate', 'industry-focus'];
    const result: ReturnType<typeof listPresets> = [];

    for (const id of presetIds) {
        const preset = loadPreset(id);
        if (preset) {
            result.push({
                id: preset.id,
                name: preset.name,
                nameEn: preset.nameEn,
                description: preset.description,
                descriptionEn: preset.descriptionEn,
                icon: preset.icon,
                nodeCount: preset.nodes.length,
                estimatedDuration: preset.config.estimatedDuration,
            });
        }
    }

    return result;
}
