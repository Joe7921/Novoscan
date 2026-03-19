/**
 * 插件 Agent 发现 API
 *
 * 返回所有已注册的自定义（非内置）Agent 列表，
 * 供工作流编辑器调色板动态加载。
 */

import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // 动态导入避免服务端启动时循环依赖
        const { getAgentRegistry, ensureAgentRegistryReady } = await import('@/workflow/agent-registry');

        await ensureAgentRegistryReady();
        const registry = getAgentRegistry();
        const customAgents = registry.listCustom();

        return NextResponse.json({
            agents: customAgents.map(a => ({
                id: a.id,
                name: a.name,
                nameEn: a.nameEn,
                description: a.description,
                icon: a.icon,
                role: a.role,
                layer: a.layer,
                source: a.source,
                defaultTimeout: a.defaultTimeout,
            })),
            total: customAgents.length,
        });
    } catch (error) {
        console.error('[API] /api/plugins/agents 失败:', error);
        return NextResponse.json({ agents: [], total: 0 });
    }
}
