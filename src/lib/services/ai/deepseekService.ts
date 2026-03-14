// deepseekService - DeepSeek AI 񣨽ʹã
import { AnalysisReport, Language } from "@/types";

// ʹ÷˻ͨ NEXT_PUBLIC_ й©ͻ
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

//  DeepSeek API URLݹٷʹƽ̨
function getDeepSeekChatUrl(): string {
    const trimmed = DEEPSEEK_BASE_URL.replace(/\/+$/, '');
    if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`;
    if (trimmed.includes('api.deepseek.com')) return `${trimmed}/v1/chat/completions`;
    return `${trimmed}/v1/chat/completions`;
}

if (!DEEPSEEK_API_KEY) {
    console.warn("DEEPSEEK_API_KEY is not set. DeepSeek model will not be available.");
}

/**
 *  Prompt Gemini ͬһ Prompt ߼
 */
const buildPrompt = (idea: string, language: Language): string => {
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
        return `
     **NovoScan ϯ**Ҫͬʱɫ
    1.  **USPTO ߼רԱ**ѧ/רĲأ
    2.  **ȶ̽**ȫ/GitHub/ƷĲأ
    
    ûĴµ
    "${idea}"

    Ҫִ **˫ (Dual-Track Review)**

    ### һѧר (Academic Track)
    *   **Ŀ** Google Scholar, IEEE, Patent Databases м
    *   **ص**ѧԭ㷨Ƶʵá
    *   ****noveltyScore (0-100)۴µϡȱԡ

    ### ȫҵ (Internet/Industry Track)
    *   **Ŀ** **GitHub, TechCrunch, Reddit, Hacker News, Medium, ˾, ҵĿ**
    *   **ص**ǷпԴʵƹܣǷдҵ˾Ƿв۹˼·
    *   ****internetNoveltyScore (0-100)"δ̻ʵ"ĳ̶ȡ
    *   **ע**ѧûģҵû GitHub ֳɴ룬·Ӧ͡

    ---
    
    ### Ҫ
    
    **SECTION_ACADEMIC ֣Markdown ʽ**
    1.  **м**չʾѧ·
    2.  **Ĳ绤**ӽĽ"Զ׼"绤
    3.  **ѧö**ѧԽۡ

    **SECTION_INTERNET ֣Markdown ʽ**
    1.  **ȫɨ״**гĹؼʣٵƽ̨
    2.  **ҵ״**
        *   **ԴĿ**ûƵ Repo
        *   **ҵƷ**ǷоƷ
        *   ****̳۹ hack 
    3.  **̿ص**û idea ǲѾ"ҵ"δģ

    ---

    ### ??  similarPapers Ҫ
    1. **гƶ  70% **Ҫʡԣжж١
    2. **Ȩ** > /( Nature, Science, NeurIPS, ICML, CVPR, ACL, ICLR, AAAI ) > ͨڿ
    3. ÿƪıд **citationCount**㣩**venue**/ڿ**authorityLevel**"high"=, "medium"=֪ڿ, "low"=ͨԴ
    4. ȷʵֻƪģгǼƪҪΪ̫Ϊضϡ

    ${sectionSeparators}

    ڻظĩβ JSON 󣨸ʽϸ£
    ${jsonFormat}
    ע⣺internetSources  type ֻ 'Github' | 'News' | 'Blog' | 'Product' | 'Forum' | 'Other'
    `;
    } else {
        return `
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
    1.  **Web Scan Radar**: Keywords and platforms searched.
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
};

/**
 * ıͨãGemini  DeepSeek ã
 */
export const parseAnalysisResponse = (text: string): AnalysisReport => {
    // ԣӡԭʼӦ
    console.log("[NovoScan] ԭʼ AI Ӧı:", text.substring(0, 500) + "...");

    let academicText = "";
    let internetText = "";

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
        academicText = text;
    }

    // ȡ JSON  ʹ̰ƥ֧Ƕ׶
    // Զģʽ:::JSON { ... } :::  ```json { ... } ``` ֱ { ... }
    let jsonStr = '';
    const jsonMatch1 = text.match(/:::JSON\s*\n?\s*({[\s\S]*})\s*:::/);
    const jsonMatch2 = text.match(/```json\s*\n\s*({[\s\S]*?})\s*\n\s*```/);
    const jsonMatch3 = text.match(/({\s*"noveltyScore"[\s\S]*})/); // 

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
    let similarPapers: any[] = [];
    let internetSources: any[] = [];

    if (jsonStr) {
        try {
            const scoreData = JSON.parse(jsonStr);
            console.log("[NovoScan]  JSON :", scoreData);
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
            console.warn("[NovoScan] JSON ʧܣԭʼַ:", jsonStr.substring(0, 300));
            console.warn("[NovoScan] :", e);
        }
    } else {
        console.warn("[NovoScan] δҵκ JSON 飬ԭʼı:", text.substring(0, 500));
    }

    //  summary Ϊգ academicText ǰΪ
    if (!summary && academicText) {
        const paragraphs = academicText.split('\n\n').filter(p => p.trim());
        summary = paragraphs.slice(0, 2).join('\n\n');
    }

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
        similarPapers,
        internetSources,
    };
};

/**
 * ʹ DeepSeek V3 о뷨
 */
export const analyzeWithDeepSeek = async (idea: string, language: Language): Promise<AnalysisReport> => {
    if (!DEEPSEEK_API_KEY) throw new Error("DeepSeek API Key is missing");


    const { trackApiCall } = await import('./apiMonitor');

    return trackApiCall('deepseek', async () => {
        const prompt = buildPrompt(idea, language);
        const systemMessage = language === 'zh'
            ? "һλרҵѧרҡϸûĸʽҪ档"
            : "You are a professional academic novelty reviewer. Follow the user's format requirements strictly.";

        const response = await fetch(getDeepSeekChatUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemMessage },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 8192,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`DeepSeek API error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "No analysis generated.";

        return parseAnalysisResponse(text);
    }, { callType: 'analyze' });
};

/**
 * ʹ DeepSeek 
 */
let deepseekChatHistory: { role: string; content: string }[] = [];

export const sendMessageToDeepSeekChat = async (
    message: string,
    history: { role: 'user' | 'model'; text: string }[],
    language: Language
): Promise<string> => {
    if (!DEEPSEEK_API_KEY) throw new Error("DeepSeek API Key is missing");


    const systemMessage = language === 'zh'
        ? "һλ˵ѧоûǵ뷨͸оֻۡشа"
        : "You are a helpful academic research assistant. You help users refine their ideas, explain concepts, and discuss research methodology. Keep answers concise and helpful.";

    // ʷ¼תΪ DeepSeek ʽ
    const messages = [
        { role: 'system', content: systemMessage },
        ...history.map(h => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.text,
        })),
        { role: 'user', content: message },
    ];

    try {
        const response = await fetch(getDeepSeekChatUrl(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages,
                temperature: 0.7,
                max_tokens: 4096,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`DeepSeek Chat error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "No response generated.";
    } catch (error) {
        console.error("DeepSeek chat error:", error);
        throw error;
    }
};

export const resetDeepSeekChat = () => {
    deepseekChatHistory = [];
};
