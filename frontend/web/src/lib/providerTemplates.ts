/**
 * AI Provider 预设模板 — 对标 CherryStudio
 *
 * 覆盖国内主流 + 国际主流 + 聚合路由 + 本地部署
 * 仅预设地址和模型列表，不预设任何 API Key
 */

import type { ProviderTemplate } from '@/types/provider'

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  // ─── 国内主流 ───
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🔮',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    description: '深度求索，高性价比推理模型',
    docUrl: 'https://platform.deepseek.com/api_keys',
    defaultModels: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', supportsStreaming: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', supportsStreaming: true, supportsReasoning: true },
    ],
  },
  {
    id: 'siliconflow',
    name: '硅基流动 (SiliconFlow)',
    icon: '💎',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    description: '一站式推理加速平台，聚合多家模型',
    docUrl: 'https://cloud.siliconflow.cn/account/ak',
    defaultModels: [
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', supportsStreaming: true },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', supportsStreaming: true, supportsReasoning: true },
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', supportsStreaming: true },
      { id: 'THUDM/glm-4-9b-chat', name: 'GLM-4 9B', supportsStreaming: true },
    ],
  },
  {
    id: 'dashscope',
    name: '通义千问 (DashScope)',
    icon: '🧠',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    description: '阿里云百炼，通义千问系列',
    docUrl: 'https://help.aliyun.com/zh/dashscope/developer-reference/activate-dashscope',
    defaultModels: [
      { id: 'qwen-turbo', name: 'Qwen Turbo', supportsStreaming: true },
      { id: 'qwen-plus', name: 'Qwen Plus', supportsStreaming: true },
      { id: 'qwen-max', name: 'Qwen Max', supportsStreaming: true },
    ],
  },
  {
    id: 'zhipu',
    name: '智谱 AI (GLM)',
    icon: '🔬',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    description: '智谱清言，GLM 系列模型',
    docUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    defaultModels: [
      { id: 'glm-4-flash', name: 'GLM-4 Flash', supportsStreaming: true },
      { id: 'glm-4-plus', name: 'GLM-4 Plus', supportsStreaming: true },
    ],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    icon: '⚡',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://api.minimaxi.com/v1',
    description: '海螺 AI，MiniMax Text 系列',
    docUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
    defaultModels: [
      { id: 'MiniMax-Text-01', name: 'MiniMax Text 01', supportsStreaming: true },
      { id: 'abab6.5s-chat', name: 'ABAB 6.5s', supportsStreaming: true },
    ],
  },
  {
    id: 'moonshot',
    name: 'Kimi (Moonshot)',
    icon: '🌙',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    description: '月之暗面 Kimi，长上下文专长',
    docUrl: 'https://platform.moonshot.cn/console/api-keys',
    defaultModels: [
      { id: 'moonshot-v1-auto', name: 'Moonshot Auto', supportsStreaming: true },
      { id: 'moonshot-v1-128k', name: 'Moonshot 128K', supportsStreaming: true },
    ],
  },
  {
    id: 'doubao',
    name: '豆包 (火山引擎)',
    icon: '🌋',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    description: '字节跳动豆包大模型',
    docUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    defaultModels: [
      { id: 'doubao-1.5-pro-32k', name: 'Doubao 1.5 Pro 32K', supportsStreaming: true },
    ],
  },

  // ─── 国际主流 ───
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    description: 'GPT-4o, o1 系列',
    docUrl: 'https://platform.openai.com/api-keys',
    defaultModels: [
      { id: 'gpt-4o', name: 'GPT-4o', supportsStreaming: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', supportsStreaming: true },
      { id: 'o1-mini', name: 'o1 Mini', supportsStreaming: true, supportsReasoning: true },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: '🧬',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    description: 'Claude 4 / 3.5 系列',
    docUrl: 'https://console.anthropic.com/settings/keys',
    defaultModels: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', supportsStreaming: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', supportsStreaming: true },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    description: 'Gemini 2.0 / 2.5 系列',
    docUrl: 'https://aistudio.google.com/app/apikey',
    defaultModels: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', supportsStreaming: true },
      { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro', supportsStreaming: true },
    ],
  },
  {
    id: 'grok',
    name: 'Grok (xAI)',
    icon: '🚀',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://api.x.ai/v1',
    description: 'xAI Grok 系列',
    docUrl: 'https://console.x.ai/',
    defaultModels: [
      { id: 'grok-3', name: 'Grok 3', supportsStreaming: true },
      { id: 'grok-3-mini', name: 'Grok 3 Mini', supportsStreaming: true, supportsReasoning: true },
    ],
  },

  // ─── 聚合路由 ───
  {
    id: 'openrouter',
    name: 'OpenRouter',
    icon: '🔗',
    type: 'openai-compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    description: '聚合路由，一个 Key 用所有模型',
    docUrl: 'https://openrouter.ai/keys',
    defaultModels: [
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', supportsStreaming: true },
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', supportsStreaming: true },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', supportsStreaming: true },
    ],
  },

  // ─── 本地部署 ───
  {
    id: 'ollama',
    name: 'Ollama (本地)',
    icon: '🦙',
    type: 'ollama',
    defaultBaseUrl: 'http://localhost:11434/v1',
    description: '本地运行开源模型，零成本',
    docUrl: 'https://ollama.com/download',
    defaultModels: [
      { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', supportsStreaming: true },
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B', supportsStreaming: true },
      { id: 'deepseek-r1:7b', name: 'DeepSeek R1 7B', supportsStreaming: true, supportsReasoning: true },
    ],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    icon: '🖥️',
    type: 'openai-compatible',
    defaultBaseUrl: 'http://localhost:1234/v1',
    description: '本地模型 GUI 管理工具',
    docUrl: 'https://lmstudio.ai/',
    defaultModels: [],
  },
]
