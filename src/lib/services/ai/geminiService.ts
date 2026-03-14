// geminiService - Gemini AI 分析服务（仅服务端使用）
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { AnalysisReport, Language, SimilarPaper, InternetSource, GroundingChunk } from "@/types";
import { checkCostLimit } from '@/lib/stubs';

// 仅使用服务端环境变量，避免通过 NEXT_PUBLIC_ 泄漏到客户端
const API_KEY = process.env.GEMINI_API_KEY || '';
const BACKUP_API_KEY = process.env.GEMINI_API_KEY_BACKUP || '';
const BASE_URL = process.env.GEMINI_BASE_URL || '';

if (!API_KEY) {
  console.error("GEMINI_API_KEY is not set. Please set it in your .env.local file. The Gemini API client will not work properly.");
}

/** 根据 API Key 创建 GoogleGenAI 客户端 */
function createGeminiClient(apiKey: string): GoogleGenAI {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- GoogleGenAI 构造器类型不含 baseURL/baseUrl，但运行时支持
  const config: Record<string, string> = { apiKey: apiKey || 'MISSING_API_KEY' };
  if (BASE_URL) {
    config.baseURL = BASE_URL;
    config.baseUrl = BASE_URL;
  }
  return new GoogleGenAI(config);
}

// 主客户端
const ai = createGeminiClient(API_KEY);

/**
 * Analyzes the research idea using Gemini 3 Pro with Thinking Mode and Google Search.
 */
export const analyzeResearchIdea = async (idea: string, language: Language): Promise<AnalysisReport> => {
  if (!API_KEY) throw new Error("API Key is missing");

  const limitCheck = await checkCostLimit('gemini', 'analyze');
  if (!limitCheck.allowed) throw new Error(limitCheck.reason || 'Cost limit exceeded for Gemini analyze');

  let prompt = '';

  const jsonFormat = `
  :::JSON
  {
    "noveltyScore": 85,
    "internetNoveltyScore": 70,
    "practicalScore": 75,
    "commercialScore": 60,
    "summary": "A 2-3 sentence executive summary of the analysis results.",
    "keyDifferentiators": "Markdown bullet list of what makes this idea unique.",
    "improvementSuggestions": "Markdown bullet list of how to improve novelty.",
    "similarPapers": [
      {
        "title": "Paper Title",
        "year": "2023",
        "similarityScore": 75,
        "keyDifference": "One sentence explaining how this paper differs from the user's idea",
        "description": "One sentence summary of what this paper proposes or achieves",
        "citation": "Author et al., Conference/Journal, Year",
        "authors": "First Author, Second Author",
        "url": "https://arxiv.org/abs/...",
        "citationCount": 150,
        "venue": "NeurIPS 2023",
        "authorityLevel": "high"
      }
    ],
    "internetSources": [
      {
        "title": "Project Name or Article Title",
        "url": "https://...",
        "summary": "Brief explanation of relevance",
        "type": "Github" 
      }
    ]
  }
  :::
  `;

  const sectionSeparators = `
  Please structure your response strictly with these separators:
  :::SECTION_ACADEMIC:::
  (Markdown content for Academic & Patent Analysis)
  :::SECTION_INTERNET:::
  (Markdown content for Global Internet & Industry Analysis)
  :::JSON:::
  (The JSON object)
  `;

  if (language === 'zh') {
    prompt = `
    你现在是 **NovoScan 的首席审查官**。你需要同时扮演两个角色：
    1.  **USPTO 高级专利审查员**（负责学术/专利界的查重）
    2.  **硅谷顶级技术侦探**（负责全网/GitHub/产品界的查重）
    
    用户输入的创新点描述：
    "${idea}"

    你需要执行 **双轨查重 (Dual-Track Review)**：

    ### 轨道一：学术与专利审查 (Academic Track)
    *   **目标**：在 Google Scholar, IEEE, Patent Databases 中检索。
    *   **重点**：数学原理、算法推导、实验设置。
    *   **评分**：noveltyScore (0-100)，基于理论创新的稀缺性。

    ### 轨道二：全网与产业审查 (Internet/Industry Track)
    *   **目标**：检索 **GitHub, TechCrunch, Reddit, Hacker News, Medium, 公司技术博客, 创业项目**。
    *   **重点**：是否有开源代码实现了类似功能？是否有创业公司正在做？是否有博客讨论过这个思路？
    *   **评分**：internetNoveltyScore (0-100)，基于“未被工程化实现”的程度。
    *   **注意**：学术界没发论文，不代表工业界没做出来。如果 GitHub 上有现成代码，互联网创新分应大幅降低。

    ---
    
    ### 报告生成要求
    
    **SECTION_ACADEMIC 部分（Markdown 格式）：**
    1.  **现有技术树**：展示学术界的搜索路径。
    2.  **核心差异辩护**：针对最接近的论文进行“非显而易见性”辩护。
    3.  **学术裁定**：给出学术创新性结论。

    **SECTION_INTERNET 部分（Markdown 格式）：**
    1.  **全网扫描雷达**：列出你检索的关键词（包括俚语、工程术语）和平台（如 "GitHub: transformer sparse attention", "Reddit: LLM optimization"）。
    2.  **工业界现状**：
        *   **开源项目**：有没有类似的 Repo？
        *   **商业产品**：是否有竞品？
        *   **社区讨论**：开发者论坛里有人讨论过类似 hack 吗？
    3.  **工程可行性与重叠度**：用户的 idea 是不是已经是“行业惯例”但未发论文？

    ---

    ### 🔴 关于 similarPapers 的特殊要求：
    1. **列出所有相似度 ≥ 70% 的论文**，不要省略，有多少列多少。
    2. **按权威度优先排序**：高引用 > 顶刊/顶会(如 Nature, Science, NeurIPS, ICML, CVPR, ACL, ICLR, AAAI 等) > 普通期刊。
    3. 每篇论文必须填写 **citationCount**（被引次数估算）、**venue**（发表会议/期刊名）、**authorityLevel**（"high"=顶刊顶会或高引用, "medium"=知名期刊, "low"=普通来源）。
    4. 如果确实只有少数几篇高相似论文，就列出那几篇；但不要因为怕列太多而人为截断。

    ${sectionSeparators}

    在回复的最末尾，输出 JSON 对象（格式严格如下）：
    ${jsonFormat}
    注意：internetSources 的 type 只能是 'Github' | 'News' | 'Blog' | 'Product' | 'Forum' | 'Other'。
    `;
  } else {
    prompt = `
    You are the **Chief Examiner at NovoScan**. You must perform two distinct roles:
    1.  **Senior Patent Examiner** (Academic/Patent Check)
    2.  **Silicon Valley Tech Investigator** (Global Internet/Industry Check)
    
    User's Innovation Description:
    "${idea}"

    Execute a **Dual-Track Review**:

    ### Track 1: Academic & Patent Review
    *   **Scope**: Google Scholar, IEEE, Patent Databases.
    *   **Focus**: Mathematical principles, algorithms, experimental rigor.
    *   **Score**: noveltyScore (0-100), based on theoretical scarcity.

    ### Track 2: Global Internet & Industry Review
    *   **Scope**: **GitHub, TechCrunch, Reddit, Hacker News, Medium, Tech Blogs, Startups**.
    *   **Focus**: Is there open source code? Is a startup doing this? Is it discussed in forums?
    *   **Score**: internetNoveltyScore (0-100), based on lack of engineering implementation.
    *   **Note**: Just because there is no paper doesn't mean it's not on GitHub. If code exists, the Internet Score should be low.

    ---
    
    ### Report Requirements
    
    **SECTION_ACADEMIC (Markdown):**
    1.  **Prior Art Tree**: Visualization of search path.
    2.  **Defense of Differences**: Defend against the closest papers.
    3.  **Academic Verdict**.

    **SECTION_INTERNET (Markdown):**
    1.  **Web Scan Radar**: Keywords (including slang/jargon) and platforms searched (e.g., "GitHub: ...", "Reddit: ...").
    2.  **Industry Landscape**:
        *   **Open Source**: Any Repos?
        *   **Products**: Any competitors?
        *   **Discussions**: Is this a known hack in developer communities?
    3.  **Engineering Overlap**: Is this idea "industry standard practice" even if unpublished?

    ---

    ${sectionSeparators}

    At the very end, output the JSON object (Strict format):
    ${jsonFormat}
    Note: internetSources type must be 'Github' | 'News' | 'Blog' | 'Product' | 'Forum' | 'Other'.
    `;
  }

  const { trackApiCall } = await import('../monitoring/apiMonitor');

  /** 使用指定客户端执行分析 */
  const doAnalyze = async (client: GoogleGenAI): Promise<AnalysisReport> => {
    const response: GenerateContentResponse = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 32768 },
      }
    });

    const text = response.text || "No analysis generated.";

    // Parse Sections
    let academicText = "";
    let internetText = "";
    let cleanText = text;

    const academicSplit = text.split(":::SECTION_ACADEMIC:::");
    if (academicSplit.length > 1) {
      const remaining = academicSplit[1];
      const internetSplit = remaining.split(":::SECTION_INTERNET:::");
      academicText = internetSplit[0].trim();

      if (internetSplit.length > 1) {
        const jsonSplit = internetSplit[1].split(":::JSON");
        internetText = jsonSplit[0].trim();
      }
    } else {
      // Fallback if model fails strict formatting
      academicText = text;
    }

    // Extract JSON - 使用多种模式匹配
    let jsonStr = '';
    const jsonMatch1 = text.match(/:::JSON\s*\n?\s*({[\s\S]*})\s*:::/);
    const jsonMatch2 = text.match(/```json\s*\n\s*({[\s\S]*?})\s*\n\s*```/);
    const jsonMatch3 = text.match(/({\s*"noveltyScore"[\s\S]*})/);

    if (jsonMatch1 && jsonMatch1[1]) {
      jsonStr = jsonMatch1[1].trim();
    } else if (jsonMatch2 && jsonMatch2[1]) {
      jsonStr = jsonMatch2[1].trim();
    } else if (jsonMatch3 && jsonMatch3[1]) {
      jsonStr = jsonMatch3[1].trim();
    }

    let noveltyScore = 0;
    let internetNoveltyScore = 0;
    let practicalScore: number | undefined;
    let commercialScore: number | undefined;
    let summary: string | undefined;
    let keyDifferentiators: string | undefined;
    let improvementSuggestions: string | undefined;
    let similarPapers: SimilarPaper[] = [];
    let internetSources: InternetSource[] = [];

    if (jsonStr) {
      try {
        const scoreData = JSON.parse(jsonStr);
        noveltyScore = scoreData.noveltyScore || 0;
        internetNoveltyScore = scoreData.internetNoveltyScore || 0;
        practicalScore = scoreData.practicalScore;
        commercialScore = scoreData.commercialScore;
        summary = scoreData.summary;
        keyDifferentiators = scoreData.keyDifferentiators;
        improvementSuggestions = scoreData.improvementSuggestions;
        similarPapers = scoreData.similarPapers || [];
        internetSources = scoreData.internetSources || [];
      } catch (e) {
        console.warn("Failed to parse analysis JSON", e);
      }
    }

    // 如果 summary 为空，用 academicText 的前两段作为兜底
    if (!summary && academicText) {
      const paragraphs = academicText.split('\n\n').filter(p => p.trim());
      summary = paragraphs.slice(0, 2).join('\n\n');
    }

    // Extract grounding metadata if available
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return {
      rawText: text,
      academicText,
      internetText,
      noveltyScore,
      internetNoveltyScore,
      practicalScore,
      commercialScore,
      summary,
      keyDifferentiators,
      improvementSuggestions,
      groundingChunks: groundingChunks as GroundingChunk[],
      similarPapers,
      internetSources
    };
  };

  return trackApiCall('gemini', async () => {
    try {
      return await doAnalyze(ai);
    } catch (primaryErr: unknown) {
      // 主 Key 失败且有备用 Key 时，自动切换重试
      if (BACKUP_API_KEY) {
        const errMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
        console.warn(`[Gemini Failover] 主 Key 调用失败 (${errMsg})，切换备用 Key 重试...`);
        const backupAi = createGeminiClient(BACKUP_API_KEY);
        const result = await doAnalyze(backupAi);
        // 异步记录 failover 事件，供巡检脚本检测
        import('@/lib/supabase').then(async ({ supabaseAdmin }) => {
          await supabaseAdmin.from('api_call_logs').insert({
            provider: 'gemini-failover', is_success: true,
            call_type: 'analyze', error_message: `主Key失败: ${errMsg}`,
            called_at: new Date().toISOString(),
          });
        }).catch(() => {});
        return result;
      }
      throw primaryErr;
    }
  }, { callType: 'analyze' });
};

/**
   * Chat service for the chatbot feature.
   */
let chatSession: Chat | null = null;
let currentLanguage: Language = 'en';

export const sendMessageToChat = async (message: string, history: { role: 'user' | 'model', text: string }[], language: Language): Promise<string> => {
  if (!API_KEY && !BACKUP_API_KEY) throw new Error("API Key is missing");

  const limitCheck = await checkCostLimit('gemini', 'chat');
  if (!limitCheck.allowed) throw new Error(limitCheck.reason || 'Cost limit exceeded for Gemini chat');

  const systemInstruction = language === 'zh'
    ? "你是一位乐于助人的学术研究助理。你帮助用户完善他们的想法，解释概念，并讨论研究方法论。保持回答简洁且有帮助。"
    : "You are a helpful academic research assistant. You help users refine their ideas, explain concepts, and discuss research methodology. Keep answers concise and helpful.";

  /** 使用指定客户端执行聊天 */
  const doChat = async (client: GoogleGenAI): Promise<string> => {
    // 使用备用客户端时需要重建 session
    if (client !== ai || !chatSession || currentLanguage !== language) {
      currentLanguage = language;
      chatSession = client.chats.create({
        model: 'gemini-3-pro-preview',
        config: { systemInstruction },
        history: history.map(h => ({
          role: h.role,
          parts: [{ text: h.text }]
        }))
      });
    }
    const result = await chatSession.sendMessage({ message });
    return result.text || '';
  };

  try {
    return await doChat(ai);
  } catch (primaryErr: unknown) {
    // 主 Key 失败且有备用 Key 时，自动切换重试
    if (BACKUP_API_KEY) {
      const errMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      console.warn(`[Gemini Failover] 聊天主 Key 失败 (${errMsg})，切换备用 Key 重试...`);
      chatSession = null; // 重置 session，让备用客户端重建
      const backupAi = createGeminiClient(BACKUP_API_KEY);
      const result = await doChat(backupAi);
      // 异步记录 failover 事件
      import('@/lib/supabase').then(async ({ supabaseAdmin }) => {
        await supabaseAdmin.from('api_call_logs').insert({
          provider: 'gemini-failover', is_success: true,
          call_type: 'chat', error_message: `主Key失败: ${errMsg}`,
          called_at: new Date().toISOString(),
        });
      }).catch(() => {});
      return result;
    }
    console.error("Chat error", primaryErr);
    throw primaryErr;
  }
}

export const resetChat = () => {
  chatSession = null;
}
