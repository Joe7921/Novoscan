/**
 * 跨域创新迁移引擎类型
 *
 * @module types/cross-domain
 */

import type { AgentOutput } from './agent';

/** 跨域桥梁节点 — 连接不同领域的技术原理 */
export interface CrossDomainBridge {
    sourceField: string;          // 源领域（用户的领域）
    targetField: string;          // 目标领域（航空/材料/游戏等）
    techPrinciple: string;        // 共通的底层技术原理
    sourceExample: string;        // 源领域的具体案例
    targetExample: string;        // 目标领域的具体案例
    reference?: string;           // 参考文献（Nature/Science 等顶刊）
    transferPath: string;         // 迁移路径描述
    noveltyPotential: number;     // 迁移创新潜力 0-100
    feasibility: 'high' | 'medium' | 'low';
    riskLevel: 'low' | 'medium' | 'high';
}

/** 跨域知识图谱节点 */
export interface KnowledgeGraphNode {
    id: string;
    label: string;
    field: string;                // 所属领域
    type: 'technology' | 'application' | 'principle';
}

/** 跨域知识图谱边 */
export interface KnowledgeGraphEdge {
    source: string;
    target: string;
    relation: 'same_principle' | 'analogous' | 'evolved_from' | 'inspires';
    strength: number;             // 0-1 连接强度
}

/** 跨域侦察兵 Agent 输出 */
export interface CrossDomainScoutOutput extends AgentOutput {
    bridges: CrossDomainBridge[];
    knowledgeGraph: {
        nodes: KnowledgeGraphNode[];
        edges: KnowledgeGraphEdge[];
    };
    exploredDomains: string[];    // 已探索的领域列表
    transferSummary: string;      // 跨域迁移总结
}
