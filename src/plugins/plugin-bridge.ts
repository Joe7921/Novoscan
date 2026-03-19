/**
 * 插件桥接器 — PluginRegistry → AgentRegistry 自动同步
 *
 * 解决两套注册中心的职责重叠问题：
 * - PluginRegistry（plugins/registry.ts）：插件生命周期管理（发现/校验/启用）
 * - AgentRegistry（workflow/agent-registry.ts）：工作流运行时注册表（Agent 标准签名、拓扑调度）
 *
 * PluginBridge 在插件发现完成后自动将 INovoAgent 适配注册到 AgentRegistry，
 * 避免两套注册中心手动同步。
 *
 * 使用方式（在应用初始化时调用一次）：
 * ```typescript
 * import { bridgePluginsToAgentRegistry } from '@/plugins/plugin-bridge'
 * await bridgePluginsToAgentRegistry()
 * ```
 *
 * @module plugins/plugin-bridge
 */

import { getActivePluginAgents } from './discovery';
import { registerCustomAgent } from '@/workflow/agent-registry';
import type { INovoAgent } from './types';
import type { AgentInput, AgentOutput } from '@/agents/types';

/** 桥接结果 */
export interface BridgeResult {
    /** 成功桥接的 Agent 数量 */
    bridged: number;
    /** 跳过（已注册）的数量 */
    skipped: number;
    /** 失败的 Agent 及原因 */
    errors: Array<{ agentId: string; error: string }>;
}

/** 已桥接的 Agent ID 集合（防止重复注册） */
const bridgedAgentIds = new Set<string>();

/**
 * 将 INovoAgent 适配为 Agent 标准签名
 *
 * INovoAgent.analyze 签名已是 (input: AgentInput) => Promise<AgentOutput>
 * 此适配器添加了错误捕获和降级逻辑
 */
function adaptPluginAgent(agent: INovoAgent): (input: AgentInput) => Promise<AgentOutput> {
    return async (input: AgentInput): Promise<AgentOutput> => {
        try {
            return await agent.analyze(input);
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[PluginBridge] ${agent.name} 执行失败:`, errMsg);

            return {
                agentName: agent.name,
                analysis: `插件 Agent "${agent.name}" 执行失败: ${errMsg}`,
                score: 50,
                confidence: 'low',
                confidenceReasoning: '插件执行异常',
                keyFindings: [`${agent.name} 执行失败`],
                redFlags: [`插件异常: ${errMsg}`],
                evidenceSources: [],
                reasoning: '插件 Agent 执行异常，返回降级结果',
                dimensionScores: [],
                isFallback: true,
            };
        }
    };
}

/**
 * 将 PluginRegistry 中的 INovoAgent 自动桥接注册到 AgentRegistry
 *
 * 此函数幂等——重复调用不会重复注册。
 * 新增的插件 Agent 会被自动发现并注册。
 */
export function bridgePluginsToAgentRegistry(): BridgeResult {
    const pluginAgents = getActivePluginAgents();
    const result: BridgeResult = { bridged: 0, skipped: 0, errors: [] };

    for (const agent of pluginAgents) {
        // 跳过已桥接的
        if (bridgedAgentIds.has(agent.id)) {
            result.skipped++;
            continue;
        }

        try {
            const adaptedFn = adaptPluginAgent(agent);

            registerCustomAgent({
                id: agent.id,
                name: agent.name,
                fn: adaptedFn,
                schema: {
                    timeout: 15000,
                    role: 'standard',
                    layer: 'L1',
                },
            });

            bridgedAgentIds.add(agent.id);
            result.bridged++;
            console.log(`[PluginBridge] ✅ 已桥接: ${agent.name} (${agent.id})`);
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            result.errors.push({ agentId: agent.id, error: errMsg });
            console.error(`[PluginBridge] ❌ 桥接失败: ${agent.name} — ${errMsg}`);
        }
    }

    console.log(
        `[PluginBridge] 桥接完成: ${result.bridged} 成功, ${result.skipped} 跳过, ${result.errors.length} 失败`
    );

    return result;
}

/**
 * 重置桥接状态（用于测试）
 */
export function resetBridge(): void {
    bridgedAgentIds.clear();
}
