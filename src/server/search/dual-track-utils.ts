/**
 * 搜索层共享工具 — AI 中英关键词翻译
 *
 * 供 dual-track.ts / bizscan/data-sources.ts / clawscan/data-sources.ts 共用。
 * DeepSeek 极简非流式调用（~100 tokens, 3s 超时），AI 失败时回退到静态词典。
 */

// ==================== AI 关键词提取（主） ====================

/**
 * 用 AI 从中文 query 提取英文搜索关键词
 * 极简非流式调用，~100 tokens，3s 超时，成本约 ¥0.001/次
 * 失败时 fallback 到静态词典
 */
export async function extractEnglishKeywordsAI(zhQuery: string): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

    if (!apiKey) {
        console.warn('[SearchUtils] DEEPSEEK_API_KEY 未配置，回退到静态词典');
        return extractEnglishKeywordsFallback(zhQuery);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s 硬超时

    try {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{
                    role: 'user',
                    content: `将以下中文创意/技术描述提取为 5-8 个最相关的英文学术搜索关键词。
要求：
1. 输出英文关键词，用空格分隔
2. 优先使用学术界常用术语
3. 保留原文中的英文缩写（如 AI, IoT, 3D）
4. 不要输出任何其他内容，只输出关键词

输入: "${zhQuery}"
英文关键词:`
                }],
                temperature: 0.1,
                max_tokens: 100,
                stream: false,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`[SearchUtils] AI 关键词提取失败 (${response.status})，回退到词典`);
            return extractEnglishKeywordsFallback(zhQuery);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content?.trim();

        if (!content || content.length < 3) {
            console.warn('[SearchUtils] AI 返回空内容，回退到词典');
            return extractEnglishKeywordsFallback(zhQuery);
        }

        // 清理：去除引号、换行、多余符号
        const cleaned = content
            .replace(/["'`\n\r]/g, ' ')
            .replace(/[,，、;；]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        console.log(`[SearchUtils] 🤖 AI 关键词提取: "${zhQuery}" → "${cleaned}"`);
        return cleaned;

    } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            console.warn('[SearchUtils] AI 关键词提取超时(3s)，回退到词典');
        } else {
            console.warn('[SearchUtils] AI 关键词提取异常，回退到词典:', err.message);
        }
        return extractEnglishKeywordsFallback(zhQuery);
    }
}

// ==================== 静态词典 Fallback ====================

/** 高频学术/产业术语中英映射（AI 失败时的兜底） */
const ZH_EN_TERMS: Record<string, string> = {
    '人工智能': 'artificial intelligence', '机器学习': 'machine learning',
    '深度学习': 'deep learning', '神经网络': 'neural network',
    '大语言模型': 'large language model', '自然语言处理': 'NLP',
    '计算机视觉': 'computer vision', '强化学习': 'reinforcement learning',
    '生成式': 'generative', '生成对抗': 'GAN',
    '扩散模型': 'diffusion model', '图神经网络': 'graph neural network',
    '注意力机制': 'attention mechanism', '预训练': 'pre-training',
    '蛋白质折叠': 'protein folding', '蛋白质结构': 'protein structure',
    '基因编辑': 'gene editing', '药物发现': 'drug discovery',
    '机械结构': 'mechanical structure', '机械设计': 'mechanical design',
    '结构优化': 'structural optimization', '拓扑优化': 'topology optimization',
    '有限元': 'finite element', '3D打印': '3D printing',
    '增材制造': 'additive manufacturing', '自动化': 'automation',
    '机器人': 'robotics', '自动驾驶': 'autonomous driving',
    '无人机': 'drone UAV', '物联网': 'IoT',
    '区块链': 'blockchain', '量子计算': 'quantum computing',
    '半导体': 'semiconductor', '芯片': 'chip',
    '新能源': 'renewable energy', '电池': 'battery',
    '储能': 'energy storage', '碳中和': 'carbon neutrality',
    '纳米': 'nano', '超导': 'superconductor',
    '生物医学': 'biomedical', '智能制造': 'intelligent manufacturing',
    '数字孪生': 'digital twin', '元宇宙': 'metaverse',
    '虚拟现实': 'VR', '增强现实': 'AR',
    '推荐系统': 'recommendation system', '知识图谱': 'knowledge graph',
    '多模态': 'multimodal', '联邦学习': 'federated learning',
    '边缘计算': 'edge computing', '云计算': 'cloud computing',
    '大数据': 'big data', '数据挖掘': 'data mining',
    '优化': 'optimization', '预测': 'prediction',
    '检测': 'detection', '识别': 'recognition',
    '生成': 'generation', '设计': 'design',
    '蛋白质': 'protein', '分子': 'molecular',
    '材料': 'material', '医疗': 'healthcare',
    '创新': 'innovation',
};

/**
 * 静态词典提取（AI 失败时的 fallback）
 */
export function extractEnglishKeywordsFallback(zhQuery: string): string {
    let remaining = zhQuery;
    const enParts: string[] = [];

    // 1. 提取已有的英文部分（如 AI, 3D, IoT 等）
    const englishMatches = zhQuery.match(/[a-zA-Z][a-zA-Z0-9.+-]*/g);
    if (englishMatches) enParts.push(...englishMatches);

    // 2. 词典匹配（按长度降序，优先匹配长词）
    const sortedTerms = Object.entries(ZH_EN_TERMS)
        .sort((a, b) => b[0].length - a[0].length);
    for (const [zh, en] of sortedTerms) {
        if (remaining.includes(zh)) {
            enParts.push(en);
            remaining = remaining.replace(zh, ' ');
        }
    }

    const unique = [...new Set(enParts.flatMap(p => p.split(' ')))];
    const result = unique.join(' ').trim();
    if (result) console.log(`[SearchUtils] 📖 词典 fallback: "${zhQuery}" → "${result}"`);
    return result || zhQuery;
}

/**
 * 检测是否包含中文字符
 */
export function containsChinese(text: string): boolean {
    return /[\u4e00-\u9fff]/.test(text);
}
