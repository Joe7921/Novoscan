/**
 * 跨产品智能推荐规则引擎
 *
 * 根据 Novoscan 搜索查询和分析结果，判断应推荐哪些姐妹产品线。
 * 支持推荐：Clawscan、Bizscan、Tracker、CaseVault
 *
 * 优化特性：
 * - 基于精化上下文动态更新推荐理由
 * - 支持 4 个产品线
 * - 推荐点击事件追踪
 */

/** 产品 ID 联合类型 */
export type ProductId = 'clawscan' | 'bizscan' | 'tracker' | 'casevault';

/** 推荐项类型 */
export interface CrossProductRecommendation {
    /** 产品 ID */
    productId: ProductId;
    /** 产品名称 */
    productName: string;
    /** 推荐理由（中文） */
    reasonZh: string;
    /** 推荐理由（英文） */
    reasonEn: string;
    /** 推荐强度 0-100 */
    strength: number;
    /** 跳转基础 URL */
    baseUrl: string;
    /** Emoji 图标 */
    icon: string;
    /** 匹配的关键词 */
    matchedKeywords: string[];
}

// ========== Clawscan 匹配关键词 ==========
const CLAWSCAN_KEYWORDS = [
    'openclaw', 'open claw', 'opnclaw',
    'clawscan', 'claw scan',
    'clawhub', 'claw hub',
    'skill', 'skills',
    'agent', 'agents', 'ai agent',
    'mcp', 'model context protocol',
    'tool use', 'function calling',
    'plugin', 'plugins',
    'automation', '自动化',
    '落地应用', '落地', '实际应用',
];

// ========== Tracker 匹配关键词 ==========
const TRACKER_KEYWORDS = [
    '监控', '追踪', '持续', '动态', '趋势',
    '竞争', '竞品', '威胁', '护城河',
    'monitor', 'track', 'watch', 'alert',
    'competitor', 'threat', 'moat',
    '专利', 'patent',
];

// ========== CaseVault 匹配关键词 ==========
const CASEVAULT_KEYWORDS = [
    '案例', '应用', '落地', '部署', '实战',
    '行业', '场景', '解决方案', '最佳实践',
    'case', 'use case', 'deployment', 'production',
    'industry', 'solution', 'practice',
    'openclaw', 'mcp', 'ai agent',
];

// ========== Bizscan 商业化方向快捷选项 ==========
export interface BizscanQuickOption {
    id: string;
    labelZh: string;
    labelEn: string;
    icon: string;
    /** 附加到 AI 增强 prompt 中的上下文 */
    contextHint: string;
}

export const BIZSCAN_MARKET_OPTIONS: BizscanQuickOption[] = [
    { id: 'b2b', labelZh: 'B2B 企业服务', labelEn: 'B2B Enterprise', icon: '🏢', contextHint: 'B2B企业服务模式' },
    { id: 'b2c', labelZh: 'B2C 消费者', labelEn: 'B2C Consumer', icon: '👤', contextHint: 'B2C消费者市场' },
    { id: 'saas', labelZh: 'SaaS 订阅', labelEn: 'SaaS Subscription', icon: '☁️', contextHint: 'SaaS 云软件订阅模式' },
];

export const BIZSCAN_STRATEGY_OPTIONS: BizscanQuickOption[] = [
    { id: 'vertical', labelZh: '垂直化深耕', labelEn: 'Vertical Niche', icon: '🎯', contextHint: '垂直化深耕特定行业' },
    { id: 'platform', labelZh: '平台化扩展', labelEn: 'Platform Play', icon: '🌐', contextHint: '平台化横向扩展' },
    { id: 'api', labelZh: 'API / 基础设施', labelEn: 'API / Infra', icon: '⚡', contextHint: 'API/基础设施层服务' },
];

/**
 * 从 report 中提取动态上下文用于推荐理由的个性化
 */
function extractDynamicContext(report?: any): {
    noveltyScore: number;
    summary: string;
    hasCompetitors: boolean;
    industries: string[];
} {
    const noveltyScore = report?.arbitration?.overallScore || report?.noveltyScore || 0;
    const summary = report?.arbitration?.summary || report?.summary || '';
    const hasCompetitors = !!(report?.competitorAnalysis?.competitors?.length > 0);

    // 从行业分析中提取涉及的行业
    const industries: string[] = [];
    const industryText = report?.industryAnalysis?.analysis || '';
    const industryMatches = industryText.match(/(?:医疗|金融|教育|零售|制造|物流|农业|能源|法律|安全)/g);
    if (industryMatches) industries.push(...Array.from(new Set(industryMatches)) as string[]);

    return { noveltyScore, summary, hasCompetitors, industries };
}

/**
 * 根据查询和分析结果生成跨产品推荐列表
 */
export function matchCrossProductRecommendations(
    query: string,
    report?: any,
): CrossProductRecommendation[] {
    const recommendations: CrossProductRecommendation[] = [];
    const queryLower = query.toLowerCase();
    const ctx = extractDynamicContext(report);

    // 从 report 中提取额外信号用于关键词匹配
    const reportText = JSON.stringify(report?.arbitration?.summary || '') +
        JSON.stringify(report?.industryAnalysis?.analysis || '') +
        JSON.stringify(report?.innovationEvaluation?.analysis || '');
    const reportLower = reportText.toLowerCase();

    // ========== 1. Clawscan 推荐 ==========
    const clawMatches: string[] = [];
    for (const kw of CLAWSCAN_KEYWORDS) {
        if (queryLower.includes(kw.toLowerCase())) {
            clawMatches.push(kw);
        }
    }
    for (const kw of ['openclaw', 'clawhub', 'mcp', 'agent skill']) {
        if (!clawMatches.includes(kw) && reportLower.includes(kw)) {
            clawMatches.push(kw);
        }
    }

    if (clawMatches.length > 0) {
        const strength = Math.min(95, 50 + clawMatches.length * 15);
        // 动态推荐理由
        const dynamicZh = ctx.noveltyScore > 70
            ? `您的创新评分高达 ${ctx.noveltyScore} 分！结合 ${clawMatches.slice(0, 2).join('、')} 的关联，Clawscan 可以快速验证 OpenClaw 落地应用是否存在同类实现，找到差异化空间。`
            : `检测到您的搜索涉及 ${clawMatches.slice(0, 3).join('、')} 等关键领域，Clawscan 可以快速帮您评估 OpenClaw 落地应用的可行性与差异化空间。`;
        const dynamicEn = ctx.noveltyScore > 70
            ? `Your innovation scores ${ctx.noveltyScore}! With signals on ${clawMatches.slice(0, 2).join(', ')}, Clawscan can verify if similar OpenClaw implementations exist.`
            : `Your search involves ${clawMatches.slice(0, 3).join(', ')} — Clawscan can quickly evaluate OpenClaw application feasibility.`;

        recommendations.push({
            productId: 'clawscan',
            productName: 'Clawscan',
            reasonZh: dynamicZh,
            reasonEn: dynamicEn,
            strength,
            baseUrl: '/skill-check',
            icon: '🐚',
            matchedKeywords: clawMatches.slice(0, 5),
        });
    }

    // ========== 2. Bizscan 推荐（通用，始终显示） ==========
    {
        // 动态推荐理由
        let reasonZh = '想把这个创新想法应用到商业中吗？Bizscan 可以帮您从市场空间、竞品格局、商业模式等维度全面评估商业可行性。';
        let reasonEn = 'Want to turn this innovation into a business? Bizscan can assess market space, competitive landscape, and business model viability.';

        if (ctx.noveltyScore >= 80) {
            reasonZh = `创新评分 ${ctx.noveltyScore} 分，高度原创！Bizscan 可以帮您评估这个蓝海机会的商业化路径和市场空间。`;
            reasonEn = `Novelty score ${ctx.noveltyScore} — highly original! Bizscan can help evaluate the commercialization path for this blue ocean opportunity.`;
        } else if (ctx.hasCompetitors) {
            reasonZh = '检测到有竞品存在，Bizscan 可以帮您从差异化定位和商业模式角度，找到超越竞品的商业策略。';
            reasonEn = 'Competitors detected — Bizscan can help find business strategies that differentiate you from existing players.';
        }

        recommendations.push({
            productId: 'bizscan',
            productName: 'Bizscan',
            reasonZh,
            reasonEn,
            strength: 70,
            baseUrl: '/bizscan',
            icon: '💡',
            matchedKeywords: [],
        });
    }

    // ========== 3. Tracker 推荐 ==========
    {
        const trackerMatches: string[] = [];
        for (const kw of TRACKER_KEYWORDS) {
            if (queryLower.includes(kw.toLowerCase())) {
                trackerMatches.push(kw);
            }
        }
        // 有竞品时自动提升推荐强度
        if (ctx.hasCompetitors && !trackerMatches.includes('竞品')) {
            trackerMatches.push('竞品');
        }

        // Tracker 推荐需至少有一定信号，或者首次分析已完成（report 存在）
        const baseStrength = report ? 45 : 20;
        const strength = Math.min(85, baseStrength + trackerMatches.length * 12);

        if (strength >= 40) {
            let reasonZh = '想持续监控这个创新领域的动态吗？Tracker 可以自动追踪竞品变化和新威胁，守护您的创新护城河。';
            let reasonEn = 'Want to continuously monitor this innovation space? Tracker can automatically track competitor changes and new threats.';

            if (ctx.hasCompetitors) {
                reasonZh = '发现有竞品活跃于该领域！建议使用 Tracker 持续监控竞争动态，第一时间获取威胁预警。';
                reasonEn = 'Competitors detected in this space! Use Tracker to continuously monitor competitive dynamics and receive threat alerts.';
            }

            recommendations.push({
                productId: 'tracker',
                productName: 'Tracker',
                reasonZh,
                reasonEn,
                strength,
                baseUrl: '/tracker',
                icon: '📡',
                matchedKeywords: trackerMatches.slice(0, 3),
            });
        }
    }

    // ========== 4. CaseVault 推荐 ==========
    {
        const caseMatches: string[] = [];
        for (const kw of CASEVAULT_KEYWORDS) {
            if (queryLower.includes(kw.toLowerCase())) {
                caseMatches.push(kw);
            }
        }
        // OpenClaw/MCP 相关时额外提升
        for (const kw of ['openclaw', 'mcp', 'ai agent']) {
            if (!caseMatches.includes(kw) && reportLower.includes(kw)) {
                caseMatches.push(kw);
            }
        }

        const strength = Math.min(80, 30 + caseMatches.length * 10);

        if (caseMatches.length > 0 && strength >= 40) {
            const industryHint = ctx.industries.length > 0
                ? `（涉及 ${ctx.industries.slice(0, 2).join('、')} 等行业）`
                : '';

            recommendations.push({
                productId: 'casevault',
                productName: 'CaseVault',
                reasonZh: `想看看这个领域的实战案例吗？CaseVault 收录了 OpenClaw / AI Agent 的行业落地图谱${industryHint}，可以帮您了解前沿实践。`,
                reasonEn: `Want to see real-world cases? CaseVault maps AI Agent / OpenClaw deployments across industries.`,
                strength,
                baseUrl: '/casevault',
                icon: '🗺️',
                matchedKeywords: caseMatches.slice(0, 4),
            });
        }
    }

    // 按推荐强度降序
    return recommendations.sort((a, b) => b.strength - a.strength);
}

/**
 * 构建跳转 URL（带预填参数）
 */
export function buildJumpUrl(
    baseUrl: string,
    params: Record<string, string>,
): string {
    const url = new URL(baseUrl, 'http://placeholder');
    for (const [key, value] of Object.entries(params)) {
        if (value) url.searchParams.set(key, value);
    }
    return `${url.pathname}?${url.searchParams.toString()}`;
}

/**
 * 追踪推荐点击事件（fire-and-forget，不阻塞 UI）
 */
export function trackRecommendationClick(
    productId: ProductId,
    query: string,
    strength: number,
    source: 'followup_panel' | 'inline_enhance' = 'followup_panel',
): void {
    try {
        fetch('/api/track-recommendation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productId,
                query,
                strength,
                source,
                timestamp: new Date().toISOString(),
            }),
        }).catch(() => { /* 静默失败 */ });
    } catch {
        /* 静默失败 */
    }
}
