// ==================== 配置中心 ====================
// 统一加载所有环境变量，提供类型安全的配置访问
// 启动时验证必要配置，友好报错

/** AI 提供商配置 */
interface AIProviderConfig {
  apiKey: string;
  baseUrl: string;
  model?: string;
  backupApiKey?: string;
}

/** 站点配置 */
interface SiteConfig {
  url: string;
  name: string;
}

/** 完整应用配置 */
export interface AppConfig {
  /** AI 模型配置 */
  ai: {
    deepseek?: AIProviderConfig;
    minimax?: AIProviderConfig;
    moonshot?: AIProviderConfig;
    /** 自定义 OpenAI 兼容模型（如 Ollama） */
    custom?: AIProviderConfig & { id: string };
  };
  /** 数据源配置 */
  dataSources: {
    serpapi?: { apiKey: string; baseUrl?: string };
    brave?: { apiKey: string; baseUrl?: string };
    github?: { token: string; baseUrl?: string };
    openalex?: { email?: string; baseUrl?: string };
    crossref?: { email?: string; baseUrl?: string };
    core?: { apiKey: string; baseUrl?: string };
    arxiv?: { baseUrl?: string };
  };
  /** 存储配置 */
  storage: {
    type: 'supabase' | 'local';
    supabase?: {
      url: string;
      anonKey: string;
      serviceRoleKey?: string;
    };
  };
  /** 站点配置 */
  site: SiteConfig;
  /** Redis 缓存（可选） */
  redis?: {
    url: string;
    token: string;
  };
}

/**
 * 从环境变量加载完整配置
 * 所有值均从 process.env 读取，无硬编码
 */
export function loadConfig(): AppConfig {
  return {
    ai: {
      deepseek: process.env.DEEPSEEK_API_KEY ? {
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        model: process.env.DEEPSEEK_MODEL,
        backupApiKey: process.env.DEEPSEEK_API_KEY_BACKUP,
      } : undefined,
      minimax: process.env.MINIMAX_API_KEY ? {
        apiKey: process.env.MINIMAX_API_KEY,
        baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com/v1',
        model: process.env.MINIMAX_MODEL,
      } : undefined,
      moonshot: process.env.MOONSHOT_API_KEY ? {
        apiKey: process.env.MOONSHOT_API_KEY,
        baseUrl: process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1',
        model: process.env.MOONSHOT_MODEL,
      } : undefined,
      custom: process.env.CUSTOM_AI_API_KEY ? {
        id: process.env.CUSTOM_AI_ID || 'custom',
        apiKey: process.env.CUSTOM_AI_API_KEY,
        baseUrl: process.env.CUSTOM_AI_BASE_URL || 'http://localhost:11434/v1',
        model: process.env.CUSTOM_AI_MODEL || 'llama3',
      } : undefined,
    },
    dataSources: {
      serpapi: process.env.SERPAPI_KEY ? {
        apiKey: process.env.SERPAPI_KEY,
        baseUrl: process.env.SERPAPI_BASE_URL,
      } : undefined,
      brave: process.env.BRAVE_API_KEY ? {
        apiKey: process.env.BRAVE_API_KEY,
        baseUrl: process.env.BRAVE_API_BASE_URL,
      } : undefined,
      github: process.env.GITHUB_TOKEN ? {
        token: process.env.GITHUB_TOKEN,
        baseUrl: process.env.GITHUB_API_BASE_URL,
      } : undefined,
      openalex: {
        email: process.env.OPENALEX_EMAIL,
        baseUrl: process.env.OPENALEX_BASE_URL,
      },
      crossref: {
        email: process.env.CROSSREF_EMAIL,
        baseUrl: process.env.CROSSREF_BASE_URL,
      },
      core: process.env.CORE_API_KEY ? {
        apiKey: process.env.CORE_API_KEY,
        baseUrl: process.env.CORE_API_BASE_URL,
      } : undefined,
      arxiv: {
        baseUrl: process.env.ARXIV_BASE_URL,
      },
    },
    storage: {
      type: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'supabase' : 'local',
      supabase: process.env.NEXT_PUBLIC_SUPABASE_URL ? {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      } : undefined,
    },
    site: {
      url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      name: process.env.NEXT_PUBLIC_SITE_NAME || 'Novoscan',
    },
    redis: process.env.UPSTASH_REDIS_REST_URL ? {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    } : undefined,
  };
}

/**
 * 启动时验证配置，返回警告信息
 * 不会抛错，只是提示缺少哪些可选配置
 */
export function validateConfig(config: AppConfig): string[] {
  const warnings: string[] = [];

  // AI 模型：至少需要一个
  const hasAI = config.ai.deepseek || config.ai.minimax || config.ai.moonshot || config.ai.custom;
  if (!hasAI) {
    warnings.push('[CRITICAL] 未配置任何 AI 模型。请至少配置一个: DEEPSEEK_API_KEY / MINIMAX_API_KEY / MOONSHOT_API_KEY / CUSTOM_AI_API_KEY');
  }

  // 数据源：可选但推荐
  const hasIndustry = config.dataSources.serpapi || config.dataSources.brave || config.dataSources.github;
  if (!hasIndustry) {
    warnings.push('[INFO] 未配置产业数据源 (SERPAPI_KEY / BRAVE_API_KEY / GITHUB_TOKEN)。产业分析功能将受限');
  }

  // 存储：可选
  if (config.storage.type === 'local') {
    warnings.push('[INFO] 未配置 Supabase，使用本地存储模式。云端历史同步和用户认证不可用');
  }

  return warnings;
}

/** 单例配置实例 */
let _config: AppConfig | null = null;

/** 获取配置（懒加载单例） */
export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}
