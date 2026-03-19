/**
 * 检索数据类型 — 学术论文、网页搜索、GitHub 仓库、双轨检索结果
 *
 * @module types/search
 */

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
