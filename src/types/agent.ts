/**
 * Agent 核心类型 — AgentInput / AgentOutput / DimensionScore
 *
 * 原 src/agents/types.ts 中的 Agent 输入输出类型
 *
 * @module types/agent
 */

import type { IndustryResult, ModelProvider } from './index';

/** 学术检索结果的类型（取自 DualTrackResult.academic） */
export interface DualTrackAcademic {
    source: string;
    results: Array<{
        title?: string;
        year?: number;
        citationCount?: number;
        authors?: string[];
        url?: string;
        pdfUrl?: string;
        isOa?: boolean;
        isOpenAccess?: boolean;
        downloadUrl?: string;
        concepts?: string[];
        venue?: string;
        description?: string;
        [key: string]: unknown;   // 允许各数据源的额外字段
    }>;
    stats: {
        totalPapers: number;
        totalCitations: number;
        openAccessCount: number;
        avgCitation: number;
        bySource: { openAlex: number; arxiv: number; crossref: number; core: number };
        topCategories: string[];
    };
    topConcepts: string[];
}

export interface AgentInput {
    query: string;                      // 用户原始创意
    academicData: DualTrackAcademic;    // 学术检索结果（强类型）
    industryData: IndustryResult;       // 产业检索结果（强类型）
    language: 'zh' | 'en';
    modelProvider: ModelProvider;
    onProgress?: (event: 'log' | 'progress' | 'agent_state' | 'agent_stream' | 'agent_memory', data: Record<string, unknown> | string | number) => void;
    /** 编排器超时取消信号，传递给底层 AI 调用 */
    _abortSignal?: AbortSignal;
    /** 用户选择的一级学科 ID（如 'ENG'），可选 */
    domainId?: string;
    /** 用户选择的子学科 ID（如 'ENG.CS.ML'），可选 */
    subDomainId?: string;
    /** 学科中文提示（如 '工学 > 机器学习'），用于注入 Agent Prompt */
    domainHint?: string;
    /** NovoDNA 搜索前预洞察（DNA → 搜索 方向） */
    dnaInsight?: string;
    /** Agent 记忆进化 — RAG 检索到的相关历史经验上下文 */
    memoryContext?: string;
}

/** 多维评分维度 */
export interface DimensionScore {
    name: string;       // 维度名称
    score: number;      // 0-100
    reasoning: string;  // 该维度评分理由
}

/** NovoStarchart 六维创新性评估雷达图数据 */
export interface InnovationRadarDimension {
    key: string;            // 维度标识键（如 'techBreakthrough'）
    nameZh: string;         // 中文标签
    nameEn: string;         // 英文标签
    score: number;          // 0-100 标准化得分
    reasoning: string;      // 评分理由
}

/** Agent 通用输出（工业级） */
export interface AgentOutput {
    agentName: string;
    analysis: string;                    // 完整分析文本
    score: number;                       // 0-100 综合评分
    confidence: 'high' | 'medium' | 'low';
    confidenceReasoning: string;         // 置信度理由（必填）
    keyFindings: string[];
    redFlags: string[];
    evidenceSources: string[];           // 引用的原始数据来源
    reasoning: string;                   // 推理过程（CoT 留痕）
    dimensionScores: DimensionScore[];   // 多维评分明细
    isFallback?: boolean;                // 是否为超时/异常降级的 fallback 结果（区别于 AI 正常返回的 low confidence）
    innovationRadar?: InnovationRadarDimension[];   // NovoStarchart 六维创新性雷达图（仅创新评估师输出）
    // 学术审查员专用：AI 评估的高相似度论文（语义相似度）
    similarPapers?: Array<{
        title: string;
        year: number;
        similarityScore: number;         // 0-100，AI 语义相似度评估
        keyDifference: string;           // 与用户创意的核心差异
        description: string;             // 论文简述
        authors?: string;
        url?: string;
        citationCount?: number;
        venue?: string;                  // 发表期刊/会议
        authorityLevel?: 'high' | 'medium' | 'low';
    }>;
}
