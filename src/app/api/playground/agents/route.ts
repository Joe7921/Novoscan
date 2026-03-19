/**
 * Playground Agent 列表 API
 *
 * GET /api/playground/agents
 *
 * 从 PluginRegistry 获取所有已注册的插件 Agent 列表，
 * 供 Playground 页面动态加载 Agent 选择器。
 */

import { NextResponse } from 'next/server';
import { autoDiscoverPlugins } from '@/plugins/discovery';
import { PluginRegistry } from '@/plugins/registry';

/** 标记是否已完成初始化 */
let initialized = false;

/** 确保插件已加载 */
async function ensurePluginsLoaded() {
  if (!initialized) {
    await autoDiscoverPlugins();
    initialized = true;
  }
}

export async function GET() {
  try {
    await ensurePluginsLoaded();

    const registry = PluginRegistry.getInstance();
    const agents = registry.getAllAgents();

    return NextResponse.json({
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        nameEn: a.nameEn,
        icon: a.icon || '🤖',
        description: a.description,
        category: a.category,
        version: a.version,
        author: a.author,
      })),
      total: agents.length,
    });
  } catch (error) {
    console.error('[Playground API] /api/playground/agents 失败:', error);
    return NextResponse.json({ agents: [], total: 0 });
  }
}
