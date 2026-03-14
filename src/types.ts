export type Language = 'en' | 'zh';

// 模型提供商类型
export type ModelProvider = 'deepseek' | 'minimax' | 'moonshot' | 'ollama';

// 扫描模式（标准 vs Flash 极速）
export type ScanMode = 'standard' | 'flash';

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

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface SimilarPaper {
  title: string;
  year: string | number;
  similarityScore: number; // 0-100
  keyDifference: string;
  citation: string;
  authors?: string;
  url?: string;
  description?: string;
  citationCount?: number;      // 被引次数
  venue?: string;              // 发表期刊/会议名称
  authorityLevel?: 'high' | 'medium' | 'low'; // 权威度
}

export interface InternetSource {
  title: string;
  url: string;
  summary: string;
  snippet?: string;
  type: 'Github' | 'News' | 'Blog' | 'Product' | 'Forum' | 'Other';
}

export interface AnalysisReport {
  rawText: string;
  academicText: string;
  internetText: string;
  noveltyScore?: number; // Academic Score
  internetNoveltyScore?: number; // Internet Score
  practicalScore?: number;
  commercialScore?: number;
  summary?: string;
  keyDifferentiators?: string;
  improvementSuggestions?: string;
  groundingChunks?: GroundingChunk[];
  similarPapers?: SimilarPaper[];
  internetSources?: InternetSource[];
  isPartial?: boolean;
  fromCache?: boolean;
  cacheSavedMs?: number;
  dualTrackResult?: DualTrackResult; // 新增：保存双轨检索的结果对象
  sections?: Record<string, unknown>;        // 新增：结构化深度审查报告
  usedModel?: string;    // 新增：实际使用的AI模型
  innovationRadar?: Array<{  // NovoStarchart 六维创新性雷达图数据
    key: string;
    nameZh: string;
    nameEn: string;
    score: number;
    reasoning: string;
  }>;
}

export enum AppState {
  INPUT = 'INPUT',
  ANALYZING = 'ANALYZING',
  REPORT = 'REPORT',
}

export interface Credibility {
  score: number;
  level: 'high' | 'medium' | 'low';
  reasoning: string[];
}

export interface CrossValidation {
  consistencyScore: number;
  academicSupport: 'strong' | 'moderate' | 'weak';
  industrySupport: 'strong' | 'moderate' | 'weak';
  openSourceVerified: boolean;
  conceptOverlap: string[];
  redFlags: string[];
  insights: string[];
}

/** 网页搜索结果条目 */
export interface WebResult {
  title?: string;
  url?: string;
  snippet?: string;
  description?: string;
  source?: string;
  [key: string]: unknown;
}

/** GitHub 仓库条目 */
export interface GithubRepo {
  name?: string;
  fullName?: string;
  stars?: number;
  health?: string;
  language?: string;
  topics?: string[];
  description?: string;
  [key: string]: unknown;
}

export interface IndustryResult {
  source: 'triple';
  webResults: WebResult[];
  webSources: { brave: number; serpapi: number };
  githubRepos: GithubRepo[];
  sentiment: 'hot' | 'warm' | 'cold';
  hasOpenSource: boolean;
  topProjects: Array<{ name: string; stars: number; health: string }>;
}

/** 学术检索统计 */
export interface AcademicStats {
  totalPapers: number;
  totalCitations: number;
  openAccessCount: number;
  avgCitation: number;
  bySource: { openAlex: number; arxiv: number; crossref: number; core: number };
  topCategories: string[];
  [key: string]: unknown;
}

/** 学术论文条目 */
export interface AcademicPaper {
  title?: string;
  year?: number;
  citationCount?: number;
  authors?: string[];
  url?: string;
  venue?: string;
  description?: string;
  [key: string]: unknown;
}

export interface DualTrackResult {
  academic: {
    source: 'quad';
    results: AcademicPaper[];
    stats: AcademicStats;
    topConcepts: string[];
    openAccessCount: number;
  };
  industry: IndustryResult;
  crossValidation: CrossValidation;
  finalCredibility: Credibility;
  credibility?: Credibility; // API response map
  recommendation: string;
  searchTimeMs: number;
}