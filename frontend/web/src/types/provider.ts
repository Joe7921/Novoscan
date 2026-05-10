/**
 * AI Provider 类型定义 — 对标 CherryStudio 架构
 *
 * 多供应商并存 + 降级链自动重试 + localStorage 持久化
 */

// ── 协议类型 ──

export type ProviderType =
  | 'openai-compatible'   // OpenAI 兼容协议（DeepSeek, 硅基流动, OpenRouter 等）
  | 'ollama'              // Ollama 本地部署
  | 'anthropic'           // Anthropic Claude（保留）
  | 'gemini'              // Google Gemini（保留）

// ── 模型 ──

export interface ModelConfig {
  id: string
  name: string
  supportsStreaming?: boolean
  supportsReasoning?: boolean
  maxTokens?: number
}

// ── Provider ──

export interface AIProvider {
  id: string
  type: ProviderType
  name: string
  apiKey: string
  baseUrl: string
  models: ModelConfig[]
  enabled: boolean
  isDefault?: boolean
  icon?: string
  notes?: string
  createdAt: string
}

// ── 全局设置 ──

export interface ProviderSettings {
  providers: AIProvider[]
  defaultProviderId: string | null
  defaultModelId: string | null
  /** 降级链 — Provider ID 有序列表，失败时按顺序自动重试 */
  fallbackChain: string[]
}

export const EMPTY_PROVIDER_SETTINGS: ProviderSettings = {
  providers: [],
  defaultProviderId: null,
  defaultModelId: null,
  fallbackChain: [],
}

// ── Provider 模板 ──

export interface ProviderTemplate {
  id: string
  name: string
  icon: string
  type: ProviderType
  defaultBaseUrl: string
  defaultModels: ModelConfig[]
  docUrl: string
  description: string
}
