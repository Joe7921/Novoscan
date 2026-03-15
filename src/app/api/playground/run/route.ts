/**
 * Playground API — 运行单个 Agent 插件
 *
 * POST /api/playground/run
 * Body: { agentId: string, query: string }
 *
 * 使用插件注册表加载并执行指定 Agent，
 * 返回标准 AgentOutput + 执行耗时。
 */

import { NextResponse } from 'next/server';
import { autoDiscoverPlugins } from '@/plugins/discovery';
import { getAgent } from '@/plugins/registry';
import type { AgentInput } from '@/agents/types';
import type { IndustryResult } from '@/types';

/** 标记是否已完成初始化 */
let initialized = false;

/** 确保插件已加载 */
async function ensurePluginsLoaded() {
  if (!initialized) {
    await autoDiscoverPlugins();
    initialized = true;
  }
}

/** 构造空的学术数据（Playground 不执行实际检索） */
function emptyAcademicData() {
  return {
    source: 'quad' as const,
    results: [],
    stats: {
      totalPapers: 0,
      totalCitations: 0,
      openAccessCount: 0,
      avgCitation: 0,
      bySource: { openAlex: 0, arxiv: 0, crossref: 0, core: 0 },
      topCategories: [],
    },
    topConcepts: [],
  };
}

/** 构造空的产业数据 */
function emptyIndustryData(): IndustryResult {
  return {
    source: 'triple',
    webResults: [],
    webSources: { brave: 0, serpapi: 0 },
    githubRepos: [],
    sentiment: 'cold',
    hasOpenSource: false,
    topProjects: [],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, query } = body;

    if (!agentId || !query) {
      return NextResponse.json(
        { error: '缺少必要参数: agentId 和 query' },
        { status: 400 }
      );
    }

    // 确保插件已加载
    await ensurePluginsLoaded();

    // 获取 Agent
    const agent = getAgent(agentId);
    if (!agent) {
      return NextResponse.json(
        { error: `Agent "${agentId}" 未找到。已注册的插件请查看 /dev 页面或运行 npm run create-agent 创建新插件。` },
        { status: 404 }
      );
    }

    // 构造标准输入（Playground 不执行实际双轨检索）
    const input: AgentInput = {
      query,
      academicData: emptyAcademicData(),
      industryData: emptyIndustryData(),
      language: 'zh',
      modelProvider: 'deepseek',
    };

    // 执行 Agent
    const startTime = Date.now();
    const output = await agent.analyze(input);
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      ...output,
      durationMs,
    });
  } catch (err) {
    console.error('[Playground API] 执行失败:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '未知错误' },
      { status: 500 }
    );
  }
}
