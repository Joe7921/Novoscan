/**
 * AI 模型配置类型
 *
 * @module types/model
 */

import type { ModelProvider } from './common';

// 模型选项配置
export interface ModelOption {
  id: ModelProvider;
  name: string;
  model: string;
  description: { en: string; zh: string };
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek R1',
    model: 'deepseek-chat',
    description: {
      en: 'DeepSeek R1 Reasoning Model',
      zh: 'DeepSeek R1 深度推理',
    },
  },
  {
    id: 'minimax',
    name: 'MiniMax M2.5',
    model: 'MiniMax-M2.5',
    description: {
      en: 'MiniMax M2.5 Chat Model',
      zh: 'MiniMax M2.5 对话模型',
    },
  },
  {
    id: 'moonshot',
    name: 'Kimi K2.5',
    model: 'kimi-k2.5',
    description: {
      en: 'Moonshot Kimi K2.5 Chat Model',
      zh: 'Moonshot Kimi K2.5 对话模型',
    },
  },
  {
    id: 'ollama',
    name: 'Ollama (本地)',
    model: 'qwen2.5:14b',
    description: {
      en: 'Ollama Local AI (Zero API Cost)',
      zh: 'Ollama 本地 AI（零 API 成本）',
    },
  },
];
