/**
 * Clawscan 本地想法解析器（零 AI 调用）
 *
 * 替代原来的 AI 解析，通过纯本地 NLP 完成想法结构化。
 * 核心逻辑：中英文分词 + 停用词过滤 + 规则分类 + 内置同义词表
 *
 * 延迟: <5ms（对比原 AI 调用 3-8s）
 */

import type { ParsedClawIdea } from '@/types/clawscan';

// ============================================================
//  停用词（中英文）
// ============================================================

const STOP_WORDS = new Set([
    // 中文
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '一', '个', '做', '想',
    '能', '可以', '要', '会', '也', '到', '说', '对', '这', '那', '但', '都', '把',
    '让', '被', '给', '用', '很', '还', '去', '来', '上', '下', '它', '他', '她',
    '什么', '怎么', '如何', '为什么', '需要', '应该', '可能', '通过', '进行', '使用',
    '支持', '功能', '实现', '开发', '创建', '构建', '设计', '提供',
    // 英文
    'the', 'a', 'an', 'is', 'are', 'to', 'for', 'with', 'and', 'or', 'i', 'you',
    'we', 'they', 'it', 'this', 'that', 'be', 'have', 'has', 'do', 'does',
    'can', 'could', 'will', 'would', 'should', 'may', 'might', 'shall',
    'of', 'in', 'on', 'at', 'by', 'from', 'as', 'into', 'about', 'than',
    'but', 'not', 'no', 'so', 'if', 'then', 'my', 'your', 'our', 'their',
    'what', 'how', 'which', 'who', 'when', 'where', 'why',
    'tool', 'app', 'application', 'build', 'create', 'make', 'develop',
]);

// ============================================================
//  平台识别规则
// ============================================================

const PLATFORM_RULES: Array<{ keywords: string[]; platform: string }> = [
    { keywords: ['cli', '命令行', 'terminal', '终端', 'shell', 'bash'], platform: 'CLI' },
    { keywords: ['web', '网页', '网站', 'website', 'browser', '浏览器', '前端', 'frontend'], platform: 'Web' },
    { keywords: ['app', '移动', 'mobile', 'ios', 'android', '手机'], platform: 'App' },
    { keywords: ['api', '接口', 'rest', 'graphql', 'sdk', 'endpoint'], platform: 'API' },
    { keywords: ['bot', '机器人', 'chatbot', '助手', 'assistant', 'agent'], platform: 'Bot' },
    { keywords: ['plugin', '插件', 'extension', '扩展'], platform: '插件' },
];

// ============================================================
//  分类识别规则
// ============================================================

const CATEGORY_RULES: Array<{ keywords: string[]; category: string }> = [
    { keywords: ['框架', 'framework', 'library', '库', 'sdk'], category: '框架' },
    { keywords: ['插件', 'plugin', 'extension', '扩展', 'addon'], category: '插件' },
    { keywords: ['服务', 'service', 'saas', 'platform', '平台', 'cloud', '云'], category: '服务' },
    { keywords: ['工具', 'tool', 'utility', '脚本', 'script', '助手', 'helper'], category: '工具' },
];

// ============================================================
//  内置同义词表（OpenClaw 生态高频词）
// ============================================================

const SYNONYM_MAP: Record<string, string[]> = {
    '搜索': ['search', 'query', 'find', '检索', '查找'],
    '翻译': ['translate', 'translation', 'i18n', '多语言', 'multilingual'],
    '爬虫': ['crawler', 'scraper', 'spider', 'scraping', '抓取'],
    '分析': ['analysis', 'analytics', 'analyze', '统计', 'statistics'],
    '数据': ['data', 'dataset', 'database', '数据库', 'db'],
    '代码': ['code', 'coding', 'programming', '编程', '开发'],
    '图片': ['image', 'photo', 'picture', '图像', 'visual'],
    '视频': ['video', 'movie', 'stream', '视频流', 'media'],
    '文档': ['document', 'doc', 'documentation', '文件', 'file'],
    '测试': ['test', 'testing', 'qa', '质量', 'quality'],
    '部署': ['deploy', 'deployment', 'ci/cd', '发布', 'release'],
    '监控': ['monitor', 'monitoring', 'alert', '告警', 'observability'],
    '安全': ['security', 'authentication', 'auth', '认证', '授权'],
    '自动化': ['automation', 'automate', 'workflow', '工作流', 'pipeline'],
    'ai': ['人工智能', 'machine learning', 'ml', '机器学习', 'llm', '大模型'],
    '天气': ['weather', 'forecast', '气象', '预报'],
    '邮件': ['email', 'mail', 'smtp', '邮箱', 'newsletter'],
    '日历': ['calendar', 'schedule', '日程', '排程', 'todo'],
    '地图': ['map', 'location', 'gps', '位置', '定位', 'navigation'],
    '支付': ['payment', 'pay', 'billing', '账单', 'checkout'],
    '社交': ['social', 'sns', 'community', '社区', 'chat'],
    '存储': ['storage', 'file', 'upload', '上传', '云存储', 's3'],
    '通知': ['notification', 'push', 'alert', '推送', 'message'],
};

// ============================================================
//  PII 脱敏（复用原有逻辑）
// ============================================================

function anonymizeText(text: string): string {
    let cleaned = text;
    cleaned = cleaned.replace(/[\w.-]+@[\w.-]+\.\w{2,}/g, '[EMAIL]');
    cleaned = cleaned.replace(/1[3-9]\d{9}/g, '[PHONE]');
    cleaned = cleaned.replace(/\+?\d{1,3}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g, '[PHONE]');
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, (url) => {
        try { return `[URL:${new URL(url).hostname}]`; } catch { return '[URL]'; }
    });
    cleaned = cleaned.replace(/\d{17}[\dxX]/g, '[ID]');
    return cleaned;
}

// ============================================================
//  核心：分词 + 关键词提取
// ============================================================

function tokenize(text: string): string[] {
    const cleaned = text
        .replace(/[，。！？、；：""''（）《》【】\[\]{}(),.!?;:"'<>]/g, ' ')
        .toLowerCase();
    const words = cleaned.split(/\s+/).filter(w => w.length >= 2 && !STOP_WORDS.has(w));
    return Array.from(new Set(words));
}

/** 提取核心能力点 */
function extractCapabilities(tokens: string[], rawText: string): string[] {
    const capabilities: string[] = [];
    const textLower = rawText.toLowerCase();

    // 1. 基于动词+名词模式识别（中文 "XX功能"、"XX能力"）
    const patterns = [
        /[\u4e00-\u9fa5]{2,6}(?:功能|能力|模块|系统|引擎|处理|管理|分析|生成|转换)/g,
        /(?:自动|智能|实时|批量|多维)[\u4e00-\u9fa5]{2,6}/g,
    ];

    for (const pat of patterns) {
        const matches = textLower.match(pat);
        if (matches) {
            capabilities.push(...matches.map(m => m.trim()));
        }
    }

    // 2. 高信息量 token 加入（去重）
    const existing = new Set(capabilities.map(c => c.toLowerCase()));
    for (const token of tokens.slice(0, 8)) {
        if (!existing.has(token) && token.length >= 2) {
            capabilities.push(token);
            existing.add(token);
        }
    }

    return capabilities.slice(0, 8);
}

/** 生成搜索关键词 */
function generateSearchKeywords(tokens: string[], capabilities: string[]): string[] {
    const keywords = new Set<string>();

    // 生态专用词
    keywords.add('openclaw');
    keywords.add('claw skill');

    // 从 token 取高质量关键词
    for (const t of tokens.slice(0, 6)) {
        keywords.add(t);
    }

    // 从能力点提取短语
    for (const cap of capabilities.slice(0, 3)) {
        if (cap.length <= 8) keywords.add(cap);
    }

    return Array.from(keywords).slice(0, 8);
}

/** 生成同义词 */
function generateSynonyms(tokens: string[]): string[] {
    const synonyms = new Set<string>();

    for (const token of tokens) {
        // 查找同义词表
        for (const [key, syns] of Object.entries(SYNONYM_MAP)) {
            if (token.includes(key) || key.includes(token) ||
                syns.some(s => token.includes(s) || s.includes(token))) {
                // 取不同于 token 的同义词
                const picked = [key, ...syns].filter(s => s !== token);
                for (const s of picked.slice(0, 2)) {
                    synonyms.add(s);
                }
                break;
            }
        }
    }

    return Array.from(synonyms).slice(0, 6);
}

/** 识别平台 */
function detectPlatform(textLower: string): string {
    for (const rule of PLATFORM_RULES) {
        if (rule.keywords.some(k => textLower.includes(k))) {
            return rule.platform;
        }
    }
    return '其他';
}

/** 识别分类 */
function detectCategory(textLower: string): string {
    for (const rule of CATEGORY_RULES) {
        if (rule.keywords.some(k => textLower.includes(k))) {
            return rule.category;
        }
    }
    return '工具';
}

/** 提取问题陈述 */
function extractProblemStatement(text: string): string {
    // 尝试匹配明确的问题描述
    const patterns = [
        /(?:想要|希望|需要|目的是|旨在|用于)(.{5,50})/,
        /(?:解决|处理|应对|优化)(.{3,40})(?:的问题|问题)/,
    ];
    for (const pat of patterns) {
        const match = text.match(pat);
        if (match) return match[1].trim();
    }
    return text.slice(0, 80);
}

/** 提取目标用户 */
function extractTargetUser(textLower: string): string {
    const userPatterns = [
        /(?:面向|针对|为了|服务于|适合)(.{2,20})(?:用户|开发者|团队|人员|群体)/,
        /(.{2,15})(?:开发者|工程师|设计师|运营|产品经理)/,
    ];
    for (const pat of userPatterns) {
        const match = textLower.match(pat);
        if (match) return match[0].trim();
    }
    return 'OpenClaw 开发者';
}

// ============================================================
//  导出：本地想法解析（替代 AI parseClawIdea）
// ============================================================

export function parseClawIdeaLocal(ideaDescription: string): ParsedClawIdea {
    const cleanText = anonymizeText(ideaDescription);
    const textLower = cleanText.toLowerCase();
    const tokens = tokenize(cleanText);

    const coreCapabilities = extractCapabilities(tokens, cleanText);
    const searchKeywords = generateSearchKeywords(tokens, coreCapabilities);
    const synonyms = generateSynonyms(tokens);
    const platform = detectPlatform(textLower);
    const category = detectCategory(textLower);
    const problemStatement = extractProblemStatement(cleanText);
    const targetUser = extractTargetUser(textLower);

    console.log(`[Clawscan/LocalParser] 本地解析完成: ${coreCapabilities.length} 能力点, ${searchKeywords.length} 关键词`);

    return {
        coreCapabilities,
        searchKeywords,
        synonyms,
        platform,
        category,
        problemStatement,
        targetUser,
    };
}
