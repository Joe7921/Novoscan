/**
 * DNA 创新基因库收割服务
 *
 * 定期从 OpenAlex 抓取各领域高引论文，提取 5 维创新基因向量并入库，
 * 持续丰富创新图谱的基因库。
 *
 * 运行方式：由 /api/innovation-dna/cron 端点触发（Vercel Cron，每周一凌晨 3 点）
 */

import { searchOpenAlex, type OpenAlexPaper } from '@/server/academic/openalex';
import { extractDNAVector, storeDNAVector } from './innovationDNA';
import { classifyDomain } from './domainClassifier';
import { supabaseAdmin } from '@/lib/supabase';
import { createHash } from 'crypto';

// ==================== 配置 ====================

/** 要搜索的领域关键词（英文，OpenAlex 对英文支持更好） */
const HARVEST_TOPICS = [
    { keywords: ['AI drug discovery'], domain: 'ai' },
    { keywords: ['CRISPR gene therapy clinical trial'], domain: 'biotech' },
    { keywords: ['quantum computing error correction'], domain: 'quantum' },
    { keywords: ['perovskite solar cell efficiency'], domain: 'energy' },
    { keywords: ['solid state battery energy density'], domain: 'energy' },
    { keywords: ['brain computer interface implant'], domain: 'neurotech' },
    { keywords: ['large language model reasoning'], domain: 'ai' },
    { keywords: ['nuclear fusion reactor breakthrough'], domain: 'energy' },
    { keywords: ['biodegradable polymer industrial'], domain: 'materials' },
    { keywords: ['protein structure prediction'], domain: 'biotech' },
    { keywords: ['climate AI weather prediction'], domain: 'climate' },
    { keywords: ['graphene semiconductor transistor'], domain: 'materials' },
];

/** 每个领域取 Top N 篇高引论文 */
const PAPERS_PER_TOPIC = 3;

/** 每次最大收割总量（避免 AI 调用过多） */
const MAX_HARVEST_TOTAL = 20;

// ==================== 类型 ====================

export interface HarvestResult {
    totalSearched: number;
    totalNew: number;
    totalSkipped: number;
    totalFailed: number;
    details: Array<{
        topic: string;
        papersFound: number;
        newlyAdded: number;
    }>;
    duration: number;
}

// ==================== 核心逻辑 ====================

/**
 * 生成查询哈希（与 innovationService 一致）
 */
function generateHash(text: string): string {
    return createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
}

/**
 * 检查 query_hash 是否已存在于 innovation_dna 表中
 */
async function isAlreadyHarvested(queryHash: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from('innovation_dna')
        .select('id')
        .eq('query_hash', queryHash)
        .limit(1);
    return (data?.length ?? 0) > 0;
}

/**
 * 将单篇论文转化为创新 DNA 并入库
 */
async function harvestPaper(
    paper: OpenAlexPaper,
    topicHint: string
): Promise<'added' | 'skipped' | 'failed'> {
    // 用论文标题作为 query（也可以加上摘要前一段）
    const query = paper.title;
    const queryHash = generateHash(query);

    // 去重检查
    if (await isAlreadyHarvested(queryHash)) {
        return 'skipped';
    }

    try {
        // 构建上下文（标题+摘要+期刊+主题）提高 AI 分析质量
        const context = [
            paper.abstract ? `摘要: ${paper.abstract.slice(0, 800)}` : '',
            paper.venue ? `发表于: ${paper.venue}` : '',
            paper.topics.length > 0 ? `主题: ${paper.topics.join(', ')}` : '',
            `引用数: ${paper.citationCount}`,
            `年份: ${paper.year}`,
        ].filter(Boolean).join('\n');

        // 提取 DNA 向量（AI 调用）
        const extraction = await extractDNAVector(query, context, 'minimax');

        // 领域分类（零成本关键词匹配）
        const domain = classifyDomain(query + ' ' + paper.abstract + ' ' + paper.topics.join(' '));

        // 构造 reasoning JSONB
        const reasoning = {
            summary: extraction.summary,
            dimensions: extraction.dimensions,
            domain,
            source: 'academic_harvest',
            paper: {
                venue: paper.venue,
                year: paper.year,
                citationCount: paper.citationCount,
                doi: paper.doi,
                topics: paper.topics,
                isOpenAccess: paper.isOpenAccess,
            },
        };

        // 存入数据库
        const { error } = await supabaseAdmin
            .from('innovation_dna')
            .upsert({
                query,
                query_hash: queryHash,
                tech_principle: extraction.vector[0],
                app_scenario: extraction.vector[1],
                target_user: extraction.vector[2],
                impl_path: extraction.vector[3],
                biz_model: extraction.vector[4],
                reasoning,
            }, { onConflict: 'query_hash' });

        if (error) {
            console.error(`[DNAHarvester] ❌ 存储失败: ${query.slice(0, 40)}... — ${error.message}`);
            return 'failed';
        }

        console.log(`[DNAHarvester] ✅ ${query.slice(0, 50)}... [${domain.zh}] vec=[${extraction.vector.join(',')}]`);
        return 'added';
    } catch (err: unknown) {
        console.error(`[DNAHarvester] ❌ 处理失败: ${query.slice(0, 40)}... — ${(err instanceof Error ? err.message : String(err))}`);
        return 'failed';
    }
}

/**
 * 执行一次完整的收割流程
 *
 * 1. 搜索各领域高引论文
 * 2. 去重过滤
 * 3. 提取 DNA 向量
 * 4. 存入数据库
 */
export async function harvestAndStore(): Promise<HarvestResult> {
    const startTime = Date.now();
    console.log('[DNAHarvester] 🌾 开始学术数据收割...');
    console.log(`[DNAHarvester] 📋 ${HARVEST_TOPICS.length} 个领域, 每个取 top ${PAPERS_PER_TOPIC}`);

    const details: HarvestResult['details'] = [];
    let totalSearched = 0;
    let totalNew = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const topic of HARVEST_TOPICS) {
        // 已达上限
        if (totalNew >= MAX_HARVEST_TOTAL) {
            console.log(`[DNAHarvester] ⚠️ 已达单次收割上限 ${MAX_HARVEST_TOTAL}，停止`);
            break;
        }

        const topicLabel = topic.keywords.join(' ');
        console.log(`\n[DNAHarvester] 🔍 搜索: ${topicLabel}`);

        try {
            // 搜索 OpenAlex（按引用量排序，取最近 2 年）
            const papers = await searchOpenAlex(topic.keywords, {
                fromYear: new Date().getFullYear() - 2,
                perPage: PAPERS_PER_TOPIC * 2, // 多取一些以应对去重
                sort: 'cited_by_count',
            });

            totalSearched += papers.length;
            let topicNew = 0;

            // 逐篇处理（限制每个领域的新增数量）
            for (const paper of papers) {
                if (topicNew >= PAPERS_PER_TOPIC) break;
                if (totalNew >= MAX_HARVEST_TOTAL) break;
                if (!paper.title || paper.title.length < 10) continue;

                const result = await harvestPaper(paper, topicLabel);
                if (result === 'added') {
                    topicNew++;
                    totalNew++;
                } else if (result === 'skipped') {
                    totalSkipped++;
                } else {
                    totalFailed++;
                }

                // 礼貌延迟，避免 AI API 过载（每篇间隔 500ms）
                await new Promise(r => setTimeout(r, 500));
            }

            details.push({
                topic: topicLabel,
                papersFound: papers.length,
                newlyAdded: topicNew,
            });

        } catch (err: unknown) {
            console.error(`[DNAHarvester] ❌ 领域搜索失败: ${topicLabel} — ${(err instanceof Error ? err.message : String(err))}`);
            details.push({
                topic: topicLabel,
                papersFound: 0,
                newlyAdded: 0,
            });
        }
    }

    const duration = Date.now() - startTime;

    // 查询最终表行数
    const { count } = await supabaseAdmin
        .from('innovation_dna')
        .select('*', { count: 'exact', head: true });

    console.log('\n' + '═'.repeat(50));
    console.log(`[DNAHarvester] 🌾 收割完成！`);
    console.log(`  📊 搜索: ${totalSearched} 篇 | 新增: ${totalNew} | 跳过: ${totalSkipped} | 失败: ${totalFailed}`);
    console.log(`  📦 基因库总量: ${count ?? '?'} 条`);
    console.log(`  ⏱️ 耗时: ${(duration / 1000).toFixed(1)}s`);

    return {
        totalSearched,
        totalNew,
        totalSkipped,
        totalFailed,
        details,
        duration,
    };
}
