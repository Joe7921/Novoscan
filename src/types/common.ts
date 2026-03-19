/**
 * 通用基础类型 — 语言、应用状态、模型提供商、扫描模式
 *
 * @module types/common
 */

export type Language = 'en' | 'zh';

// 模型提供商类型
export type ModelProvider = 'deepseek' | 'minimax' | 'moonshot' | 'ollama';

// 扫描模式（标准 vs Flash 极速）
export type ScanMode = 'standard' | 'flash';

export enum AppState {
  INPUT = 'INPUT',
  ANALYZING = 'ANALYZING',
  REPORT = 'REPORT',
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}
