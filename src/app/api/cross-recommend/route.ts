export const dynamic = 'force-dynamic';

/**
 * 跨产品推荐 AI 增强 API
 * 
 * 接收 Novoscan 的查询上下文 + 用户选择的商业化方向，
 * AI 生成一段增强版商业想法描述，可直接作为 Bizscan 的 idea 输入。
 */
import { NextResponse } from 'next/server';
import { callAIRaw, parseAgentJSON } from '@/lib/ai-client';
import { sanitizeInput, safeErrorResponse } from '@/lib/security/apiSecurity';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            query,
            summary,
            marketOption,
            strategyOption,
            modelProvider = 'minimax',
        } = body;

        if (!query) {
            return NextResponse.json(
                { success: false, error: 'query 必须提供' },
                { status: 400 }
            );
        }

        // 清洗输入
        const cleanQuery = sanitizeInput(query, 500);
        const cleanSummary = summary ? sanitizeInput(summary, 800) : '';

        const prompt = `你是一位商业战略顾问，擅长将创新技术转化为商业机会描述。

# 任务

根据用户在 Novoscan（创新性评估平台）上的搜索结果和他选择的商业化方向，生成一段完整的商业想法描述。这段描述将被用于 Bizscan 商业可行性评估引擎的输入。

## 用户原始搜索查询
"${cleanQuery}"

## 分析摘要
${cleanSummary || '无'}

## 用户选择的商业化方向
- 目标市场：${marketOption || '未指定'}
- 商业策略：${strategyOption || '未指定'}

# 输出要求

以 JSON 格式输出：
{
  "enhancedIdea": "一段 80-200 字的完整商业想法描述，融合原始创新点和商业化方向，要具体、可操作",
  "targetMarket": "简短的目标市场关键词（如'企业级客户'、'中小企业'），5-20字",
  "businessModel": "商业模式关键词（如'SaaS订阅'、'按次计费'），5-20字",
  "industryVertical": "行业垂直领域（如'医疗健康'、'金融科技'），5-15字"
}

规则：
- enhancedIdea 必须自然连贯、专业、具体，让读者一眼理解商业价值
- 其他字段从上下文推断，如无法推断则返回空字符串
- 严格输出 JSON，不要有多余内容`;

        const { text } = await callAIRaw(prompt, modelProvider, 15000, undefined, undefined, undefined, 800, 0.3);
        const result = parseAgentJSON<{
            enhancedIdea?: string;
            targetMarket?: string;
            businessModel?: string;
            industryVertical?: string;
        }>(text);

        if (!result?.enhancedIdea) {
            return NextResponse.json(
                { success: false, error: 'AI 生成失败，请重试' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            enhancedIdea: result.enhancedIdea,
            targetMarket: result.targetMarket || '',
            businessModel: result.businessModel || '',
            industryVertical: result.industryVertical || '',
        });
    } catch (error: unknown) {
        return safeErrorResponse(error, '商业想法增强失败', 500, '[API CrossRecommend]');
    }
}
