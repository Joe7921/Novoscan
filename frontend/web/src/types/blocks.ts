/**
 * Novoscan-Open-Core 前端积木类型系统
 *
 * 对齐后端四层元数据：
 *   L0: ConfigField / ToolDescriptor
 *   L1: AgentBlockMeta (BlockMeta)
 *   L2: InteractionBlockMeta (InteractionMeta)
 *   L3: ReportBlockMeta (ReportMeta)
 *
 * 附加：六层十类 Agent 角色分类体系
 */

// ══════════════════════════════════════════════════════════════
// L0: 配置字段描述
// ══════════════════════════════════════════════════════════════

export interface ConfigField {
  type: 'text' | 'float' | 'integer' | 'boolean' | 'select'
  default?: unknown
  description?: string
  min?: number
  max?: number
  options?: string[]
}

// ══════════════════════════════════════════════════════════════
// L1: Agent 积木元数据
// ══════════════════════════════════════════════════════════════

export interface AgentBlockMeta {
  id: string
  name: string
  description: string
  version: string
  category: string
  role_type?: AgentRoleType | ''
  block_type: 'agent'
  source?: string
  inputs: string[]
  outputs: string[]
  config_schema: Record<string, ConfigField>
  notes?: string
}

// ══════════════════════════════════════════════════════════════
// L2: 交互模式积木元数据
// ══════════════════════════════════════════════════════════════

export interface RoleSpec {
  name: string
  count: string // "1" 或 "2..n"
}

export interface InteractionBlockMeta {
  id: string
  name: string
  description: string
  version: string
  category: string
  block_type: 'interaction'
  source?: string
  inputs: string[]
  outputs: string[]
  config_schema: Record<string, ConfigField>
  roles: RoleSpec[]
  notes?: string
}

// ══════════════════════════════════════════════════════════════
// L3: 报告插件积木元数据
// ══════════════════════════════════════════════════════════════

export interface ReportSection {
  id: string
  type: string // radar | bar_chart | table | markdown_card | llm_generated | heatmap | timeline | quadrant | sankey | network | 自定义
  layout: Record<string, unknown>
  source?: string
  prompt?: string
  columns?: string[]
  dimensions?: Record<string, unknown>[]
  style?: Record<string, unknown>
}

export interface ReportBlockMeta {
  id: string
  name: string
  description: string
  version: string
  category: string
  block_type: 'report'
  source?: string
  inputs: string[]
  outputs: string[]
  config_schema: Record<string, ConfigField>
  requires: string[]
  sections: ReportSection[]
  notes?: string
}

// ══════════════════════════════════════════════════════════════
// 联合类型
// ══════════════════════════════════════════════════════════════

export type AnyBlockMeta = AgentBlockMeta | InteractionBlockMeta | ReportBlockMeta

export type BlockType = 'agent' | 'interaction' | 'report'

// ══════════════════════════════════════════════════════════════
// L0: 工具描述（对齐后端 ToolDescriptor）
// ══════════════════════════════════════════════════════════════

export interface ToolDescriptor {
  id: string
  name: string
  description: string
  type: 'local' | 'http' | 'mcp'
  tags: string[]
  detection_types: string[]
  entry?: string
  endpoint?: string
  method?: string
  headers?: Record<string, string>
  server?: string
  tool_name?: string
  config: Record<string, unknown>
}

// ══════════════════════════════════════════════════════════════
// 六层十类 Agent 角色分类体系
// ══════════════════════════════════════════════════════════════

export type AgentRoleType =
  | 'orchestrator'
  | 'monitor'
  | 'planner'
  | 'retriever'
  | 'memory_keeper'
  | 'executor'
  | 'synthesizer'
  | 'evaluator'
  | 'critic'
  | 'mediator'
  | 'filter'

export type AgentRoleLayer = 'control' | 'planning' | 'context' | 'execution' | 'quality' | 'mediation' | 'transform'

export interface AgentRoleDefinition {
  type: AgentRoleType
  layer: AgentRoleLayer
  label: string
  icon: string
  color: string
  description: string
  defaultTools?: string[]
  defaultPromptHint?: string
}

export const AGENT_ROLE_DEFINITIONS: AgentRoleDefinition[] = [
  // ── 控制层 ──
  {
    type: 'orchestrator',
    layer: 'control',
    label: '编排器',
    icon: '🎯',
    color: '#7C3AED', // 紫色
    description: '顶层决策者，管理全局目标和任务分配，不直接执行，只委派',
    defaultPromptHint: '你是一个全局编排 Agent，负责将用户目标分解为子任务并委派给专业 Agent。',
  },
  {
    type: 'monitor',
    layer: 'control',
    label: '监控器',
    icon: '🛡️',
    color: '#DC2626', // 红色
    description: '系统健康卫士：检测死循环/Token超限/漂移，触发熔断',
    defaultPromptHint: '你是一个系统监控 Agent，负责检测异常并在必要时触发熔断。',
  },
  // ── 规划层 ──
  {
    type: 'planner',
    layer: 'planning',
    label: '规划器',
    icon: '🗺️',
    color: '#4338CA', // 靛蓝
    description: '任务分解：将高层目标拆解为子任务图，动态更新计划',
    defaultPromptHint: '你是一个任务规划 Agent，负责将用户需求分解为具体的执行步骤。',
  },
  // ── 上下文层 ──
  {
    type: 'retriever',
    layer: 'context',
    label: '检索器',
    icon: '🔍',
    color: '#16A34A', // 绿色
    description: '信息猎手：决定搜什么、用哪个工具、信息够不够',
    defaultTools: ['search_openalex', 'search_arxiv', 'search_crossref'],
    defaultPromptHint: '你是一个信息检索 Agent，负责搜索和收集与用户需求相关的信息。',
  },
  {
    type: 'memory_keeper',
    layer: 'context',
    label: '记忆管理',
    icon: '🧠',
    color: '#0891B2', // 青色
    description: '上下文压缩：决定什么值得记住，管理长期记忆',
    defaultPromptHint: '你是一个记忆管理 Agent，负责压缩和管理对话上下文。',
  },
  // ── 执行层 ──
  {
    type: 'executor',
    layer: 'execution',
    label: '执行器',
    icon: '⚡',
    color: '#2563EB', // 蓝色
    description: '领域专家：执行具体评估/分析任务',
    defaultPromptHint: '你是一个领域专家 Agent，负责对指定维度进行深入分析和评分。',
  },
  {
    type: 'synthesizer',
    layer: 'execution',
    label: '综合器',
    icon: '📝',
    color: '#EA580C', // 橙色
    description: '编辑整合：将执行器的粗糙输出整理为结构化结果',
    defaultPromptHint: '你是一个综合整理 Agent，负责将多个来源的分析结果整合为结构化报告。',
  },
  // ── 质量层 ──
  {
    type: 'evaluator',
    layer: 'quality',
    label: '评估者',
    icon: '✅',
    color: '#CA8A04', // 金色
    description: '客观验证：输出是否符合 Schema？分数是否合理？',
    defaultPromptHint: '你是一个质量评估 Agent，负责验证输出是否符合预期格式和逻辑。',
  },
  {
    type: 'critic',
    layer: 'quality',
    label: '评论家',
    icon: '🔬',
    color: '#D97706', // 琥珀
    description: '主观审查：边缘情况、隐含假设、安全漏洞',
    defaultPromptHint: '你是一个批判性审查 Agent，负责发现隐含假设和边缘情况。',
  },
  // ── 调解层 ──
  {
    type: 'mediator',
    layer: 'mediation',
    label: '调解器',
    icon: '⚖️',
    color: '#DB2777', // 洋红
    description: '冲突仲裁：当评估者和评论家意见分歧时打破僵局',
    defaultPromptHint: '你是一个仲裁调解 Agent，负责在多方意见分歧时做出公正裁决。',
  },
  // ── 转换层 ──
  {
    type: 'filter',
    layer: 'transform',
    label: '过滤器',
    icon: '🔄',
    color: '#0D9488', // 青绿
    description: '数据转换：接收上游分析结果，输出特定报告组件所需的结构化数据',
    defaultPromptHint: '你是一个数据过滤/转换 Agent，负责将上游 Agent 的原始输出转换为下游报告组件所需的结构化 JSON 格式。',
  },
]

// ══════════════════════════════════════════════════════════════
// Pipeline 类型
// ══════════════════════════════════════════════════════════════

export interface PipelineNode {
  id: string
  type: BlockType | 'logic'
  agent_id?: string
  interaction_id?: string
  report_id?: string
  description?: string
  config?: Record<string, unknown>
}

export interface PipelineEdge {
  from: string
  to: string
  condition?: string
}

export interface PipelineDefinition {
  name: string
  version: string
  description: string
  nodes: PipelineNode[]
  edges: PipelineEdge[]
  interrupt_before?: string[]
  _filename?: string
  _is_builtin?: boolean
}

export interface PipelineListItem {
  filename: string
  name: string
  description: string
  version: string
  is_builtin: boolean
  node_count: number
  edge_count: number
}

// ══════════════════════════════════════════════════════════════
// API 响应类型
// ══════════════════════════════════════════════════════════════

export interface BlocksResponse {
  total: number
  agents: AgentBlockMeta[]
  interactions: InteractionBlockMeta[]
  reports: ReportBlockMeta[]
}

export interface ToolsResponse {
  tools: ToolDescriptor[]
  total: number
}

export interface PipelinesResponse {
  pipelines: PipelineListItem[]
  total: number
}
