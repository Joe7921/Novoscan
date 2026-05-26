/**
 * Open-Core 后端 API 客户端
 *
 * 所有请求通过 Vite proxy 转发到 FastAPI 8001。
 */

import type {
  BlocksResponse,
  ToolsResponse,
  PipelinesResponse,
  PipelineDefinition,
  AnyBlockMeta,
} from '../types/blocks'

const BASE = ''  // Vite proxy 已配置 /api → localhost:8001

export interface HealthResponse {
  status: string
  engine: string
  version: string
  model_provider: string
  model_ready: boolean
}

export interface AnalyzeRequest {
  user_raw_input: string
  detection_type: string
  enabled_tools?: string[] | null
  extra_instructions?: string
  pipeline?: string | null
}

export interface ResumeRequest {
  action: 'confirm' | 'revise'
  feedback: string
}

export interface AgenticResumeRequest {
  action: 'approve_and_continue' | 'revise_inputs' | 'abort'
  feedback?: string
  revised_user_input?: string
  enabled_tools?: string[] | null
}

export interface AgenticRuntimeState {
  thread_id: string
  status: string
  pause_target?: string | null
  pause_phase?: string | null
  resume_actions?: Array<{
    id: string
    label: string
    description?: string
  }>
  tool_policy?: Record<string, unknown>
  waiting_for?: string | null
  dsl?: Record<string, unknown>
  events?: Array<Record<string, unknown>>
  created_at?: number | null
  updated_at?: number | null
  error?: string | null
}

// ── 模型配置 ──

export interface ModelConfigResponse {
  primary: {
    provider: string
    api_key: string
    base_url: string
    model_name: string
    temperature: number
    supports_structured_output: boolean
  }
  fallback: {
    api_key: string
    base_url: string
    model_name: string
  }
  has_fallback: boolean
  tools?: {
    brave_api_key: string
    github_token: string
    openalex_email: string
    crossref_email: string
  }
}

export interface ModelConfigUpdate {
  model_provider?: string
  llm_api_key?: string
  llm_base_url?: string
  llm_model_name?: string
  llm_temperature?: number
  llm_supports_structured_output?: boolean
  fallback_api_key?: string
  fallback_base_url?: string
  fallback_model_name?: string
  brave_api_key?: string
  github_token?: string
  openalex_email?: string
  crossref_email?: string
}

export async function fetchModelConfig(): Promise<ModelConfigResponse> {
  const res = await fetch(`${BASE}/api/v1/config/model`)
  if (!res.ok) throw new Error(`Fetch model config failed: ${res.status}`)
  return res.json()
}

export async function updateModelConfig(payload: ModelConfigUpdate): Promise<{ status: string; updated_fields: string[]; primary_ok: boolean; fallback_ok: boolean }> {
  const res = await fetch(`${BASE}/api/v1/config/model`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Update model config failed: ${res.status}`)
  return res.json()
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE}/health`)
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  return res.json()
}

/**
 * 启动 Standard（传统工作流）SSE 流分析
 * 返回 Response 对象供 SSE 解析
 */
export async function startAnalysisStream(req: AnalyzeRequest, signal?: AbortSignal): Promise<Response> {
  return fetch(`${BASE}/api/v1/analyze/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
}

/**
 * HITL 恢复 SSE 流
 */
export async function resumeStream(threadId: string, req: ResumeRequest, signal?: AbortSignal): Promise<Response> {
  return fetch(`${BASE}/api/v1/thread/${threadId}/resume/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
}

/**
 * Agentic 模式 SSE 流分析
 */
export async function startAgenticStream(req: AnalyzeRequest, signal?: AbortSignal): Promise<Response> {
  return fetch(`${BASE}/api/v1/analyze/agentic/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
}

export async function resumeAgenticStream(
  threadId: string,
  req: AgenticResumeRequest,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(`${BASE}/api/v1/agentic/thread/${threadId}/resume/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
}

export async function fetchAgenticRuntime(threadId: string): Promise<AgenticRuntimeState> {
  const res = await fetch(`${BASE}/api/v1/agentic/thread/${threadId}`)
  if (!res.ok) throw new Error(`Fetch agentic runtime failed: ${res.status}`)
  return res.json()
}

export type { BlocksResponse }

// ── 积木 API（A5 增强版：返回完整三级元数据） ──

export async function fetchBlocks(): Promise<BlocksResponse> {
  const res = await fetch(`${BASE}/api/v1/blocks`)
  if (!res.ok) throw new Error(`Blocks fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchBlockDetail(blockId: string): Promise<AnyBlockMeta> {
  const res = await fetch(`${BASE}/api/v1/blocks/${blockId}`)
  if (!res.ok) throw new Error(`Block detail fetch failed: ${res.status}`)
  return res.json()
}

// ── Block CRUD（G1） ──

export async function createBlock(blockType: string, yamlContent: string) {
  const res = await fetch(`${BASE}/api/v1/blocks/${blockType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml_content: yamlContent }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Create block failed: ${res.status}`)
  }
  return res.json()
}

export async function updateBlock(blockType: string, blockId: string, yamlContent: string) {
  const res = await fetch(`${BASE}/api/v1/blocks/${blockType}/${blockId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml_content: yamlContent }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Update block failed: ${res.status}`)
  }
  return res.json()
}

export async function deleteBlock(blockType: string, blockId: string) {
  const res = await fetch(`${BASE}/api/v1/blocks/${blockType}/${blockId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Delete block failed: ${res.status}`)
  }
  return res.json()
}

export function getBlockExportUrl(blockType: string, blockId: string): string {
  return `${BASE}/api/v1/blocks/${blockType}/${blockId}/export`
}

export async function importBlock(blockType: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE}/api/v1/blocks/${blockType}/import`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Import block failed: ${res.status}`)
  }
  return res.json()
}

// ── 工具 API（A6 + CRUD） ──

export async function fetchTools(): Promise<ToolsResponse> {
  const res = await fetch(`${BASE}/api/v1/tools`)
  if (!res.ok) throw new Error(`Tools fetch failed: ${res.status}`)
  return res.json()
}

export async function createTool(yamlContent: string) {
  const res = await fetch(`${BASE}/api/v1/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml_content: yamlContent }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Create tool failed: ${res.status}`)
  }
  return res.json()
}

export async function updateTool(toolId: string, yamlContent: string) {
  const res = await fetch(`${BASE}/api/v1/tools/${toolId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml_content: yamlContent }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Update tool failed: ${res.status}`)
  }
  return res.json()
}

export async function deleteTool(toolId: string) {
  const res = await fetch(`${BASE}/api/v1/tools/${toolId}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Delete tool failed: ${res.status}`)
  }
  return res.json()
}

export function getToolExportUrl(toolId: string): string {
  return `${BASE}/api/v1/tools/${toolId}/export`
}

export async function importTool(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${BASE}/api/v1/tools/import`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Import tool failed: ${res.status}`)
  }
  return res.json()
}

// ── Pipeline API（A1-A4） ──

export async function fetchPipelines(): Promise<PipelinesResponse> {
  const res = await fetch(`${BASE}/api/v1/pipelines`)
  if (!res.ok) throw new Error(`Pipelines fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchPipeline(filename: string): Promise<PipelineDefinition> {
  const res = await fetch(`${BASE}/api/v1/pipelines/${filename}`)
  if (!res.ok) throw new Error(`Pipeline fetch failed: ${res.status}`)
  return res.json()
}

export async function savePipeline(filename: string, pipeline: PipelineDefinition) {
  const res = await fetch(`${BASE}/api/v1/pipelines/${filename}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pipeline }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Save pipeline failed: ${res.status}`)
  }
  return res.json()
}

export async function deletePipeline(filename: string) {
  const res = await fetch(`${BASE}/api/v1/pipelines/${filename}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Delete pipeline failed: ${res.status}`)
  }
  return res.json()
}

// ── Debug API（S1 Studio 调试） ──

export interface DebugNodeRequest {
  node_id: string
  inputs: Record<string, unknown>
  config?: Record<string, unknown>
}

export interface DebugNodeResponse {
  status: 'ok' | 'error'
  node_id: string
  outputs?: Record<string, unknown>
  inputs_echo?: Record<string, unknown>
  duration_ms: number
  logs: string[]
  error?: string
}

export interface DebugNodeInfo {
  id: string
  name: string
  inputs: string[]
  outputs: string[]
  category?: string
}

export interface DebugRunRecord {
  run_id: string
  pipeline: string
  user_input: string
  mode: string
  status: string
  total_duration_ms: number
  node_count: number
  node_cache: Record<string, { inputs: Record<string, unknown>; outputs: Record<string, unknown>; duration_ms: number }>
  timestamp: string
}

export async function debugNode(req: DebugNodeRequest): Promise<DebugNodeResponse> {
  const res = await fetch(`${BASE}/api/v1/debug/node`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`Debug node failed: ${res.status}`)
  return res.json()
}

export async function fetchDebugNodes(): Promise<{ nodes: DebugNodeInfo[] }> {
  const res = await fetch(`${BASE}/api/v1/debug/nodes`)
  if (!res.ok) throw new Error(`Fetch debug nodes failed: ${res.status}`)
  return res.json()
}

export async function fetchDebugHistory(limit = 20): Promise<{ runs: DebugRunRecord[]; total: number }> {
  const res = await fetch(`${BASE}/api/v1/debug/history?limit=${limit}`)
  if (!res.ok) throw new Error(`Fetch debug history failed: ${res.status}`)
  return res.json()
}

export async function fetchDebugHistoryDetail(runId: string): Promise<DebugRunRecord> {
  const res = await fetch(`${BASE}/api/v1/debug/history/${runId}`)
  if (!res.ok) throw new Error(`Fetch debug detail failed: ${res.status}`)
  return res.json()
}


export interface CitationRequest {
  evidence_items: Record<string, unknown>[]
  topic?: string
}

/**
 * 一键生成论文引用段落 — SSE 流式返回
 */
export async function generateCitationStream(req: CitationRequest, signal?: AbortSignal): Promise<Response> {
  return fetch(`${BASE}/api/v1/citation/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
}

// ── S7: DesignAssistant Chat API ──

export interface AssistantChatRequest {
  message: string
  context?: { nodes: { id: string; label?: string }[]; edges: { source: string; target: string }[] } | null
  mode?: string
  history?: { role: string; content: string }[]
}

/**
 * DesignAssistant LLM 对话 — SSE 流式返回
 */
export async function assistantChatStream(req: AssistantChatRequest, signal?: AbortSignal): Promise<Response> {
  return fetch(`${BASE}/api/v1/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  })
}

// ── T1: Agentic Config API ──

export interface AgenticToolConfig {
  id: string
  enabled: boolean
  group: string
  description: string
}

export interface AgenticConfig {
  name: string
  description: string
  version: string
  system_prompt: string
  system_prompt_preview?: string
  system_prompt_length?: number
  model: { temperature: number; max_iterations: number }
  tools: AgenticToolConfig[]
  prompt_history: { timestamp: string; content: string; length: number }[]
}

export interface AgenticConfigUpdate {
  system_prompt?: string
  model?: { temperature?: number; max_iterations?: number }
  tools?: { id: string; enabled: boolean }[]
}

export async function fetchAgenticConfig(): Promise<AgenticConfig> {
  const res = await fetch(`${BASE}/api/v1/agentic/config`)
  if (!res.ok) throw new Error(`Fetch agentic config failed: ${res.status}`)
  return res.json()
}

export async function updateAgenticConfig(
  payload: AgenticConfigUpdate
): Promise<{ status: string; updated_fields: string[]; reload_ok: boolean; enabled_tools_count: number }> {
  const res = await fetch(`${BASE}/api/v1/agentic/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Update agentic config failed: ${res.status}`)
  return res.json()
}

export async function fetchAgenticTools(): Promise<{ tools: AgenticToolConfig[]; total: number }> {
  const res = await fetch(`${BASE}/api/v1/agentic/tools`)
  if (!res.ok) throw new Error(`Fetch agentic tools failed: ${res.status}`)
  return res.json()
}
