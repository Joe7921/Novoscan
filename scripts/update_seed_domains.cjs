/**
 * 为已有种子数据补充领域标签
 * 执行：node scripts/update_seed_domains.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 手动加载 .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 领域分类器（与 domainClassifier.ts 逻辑一致的简化版）
const DOMAIN_RULES = [
    { id: 'ai', zh: '人工智能', en: 'AI', color: '#6366f1', emoji: '🤖', keywords: ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural', 'llm', 'large language model', 'alphafold', 'graphcast', '人工智能', '机器学习', '深度学习', '大模型', 'ai气象'] },
    { id: 'biotech', zh: '生物技术', en: 'Biotech', color: '#10b981', emoji: '🧬', keywords: ['crispr', 'gene editing', 'gene therapy', 'protein', 'cell therapy', 'car-t', 'prime editing', '基因编辑', '基因治疗', '蛋白质', '细胞疗法', 'casgevy'] },
    { id: 'quantum', zh: '量子科技', en: 'Quantum', color: '#8b5cf6', emoji: '⚛️', keywords: ['quantum', 'qubit', '量子', 'willow'] },
    { id: 'energy', zh: '新能源', en: 'Energy', color: '#f59e0b', emoji: '⚡', keywords: ['solar', 'battery', 'nuclear', 'fusion', 'perovskite', '太阳能', '电池', '核聚变', '核反应堆', '固态电池', 'smr', '钙钛矿'] },
    { id: 'space', zh: '航天探索', en: 'Space', color: '#0ea5e9', emoji: '🚀', keywords: ['space', 'moon', 'lunar', 'telescope', '航天', '月球', '嫦娥', '望远镜', '星系', 'jwst', 'webb', 'jades'] },
    { id: 'materials', zh: '新材料', en: 'Materials', color: '#64748b', emoji: '🔬', keywords: ['graphene', 'semiconductor', 'superconductor', 'biodegradable', '石墨烯', '半导体', '超导', '可降解', 'pha'] },
    { id: 'medicine', zh: '医药健康', en: 'Medicine', color: '#ef4444', emoji: '💊', keywords: ['drug', 'clinical', 'fda', 'therapy', 'hiv', 'cancer', 'glp-1', 'semaglutide', 'lenacapavir', '药物', '临床', '减重', '司美格鲁肽'] },
    { id: 'neurotech', zh: '神经科技', en: 'Neurotech', color: '#ec4899', emoji: '🧠', keywords: ['brain computer interface', 'bci', 'neuralink', '脑机接口'] },
    { id: 'climate', zh: '气候环境', en: 'Climate', color: '#22c55e', emoji: '🌍', keywords: ['climate', 'weather', '气候', '气象'] },
    { id: 'physics', zh: '物理学', en: 'Physics', color: '#d946ef', emoji: '🔭', keywords: ['nuclear clock', '核时钟', 'thorium', '钍'] },
];

function classifyDomain(text) {
    const lower = text.toLowerCase();
    let bestDomain = null, bestScore = 0;
    for (const rule of DOMAIN_RULES) {
        let score = 0;
        for (const kw of rule.keywords) {
            if (lower.includes(kw)) score += kw.length;
        }
        if (score > bestScore) {
            bestScore = score;
            bestDomain = rule;
        }
    }
    if (bestDomain && bestScore > 0) {
        return { id: bestDomain.id, zh: bestDomain.zh, en: bestDomain.en, color: bestDomain.color, emoji: bestDomain.emoji };
    }
    return { id: 'other', zh: '其他', en: 'Other', color: '#94a3b8', emoji: '📌' };
}

async function main() {
    console.log('🏷️  为种子数据补充领域标签...\n');

    const { data, error } = await supabase
        .from('innovation_dna')
        .select('id, query, reasoning');

    if (error || !data) {
        console.error('❌ 查询失败:', error?.message);
        return;
    }

    let updated = 0;
    for (const row of data) {
        const domain = classifyDomain(row.query);
        const reasoning = {
            ...(row.reasoning || {}),
            domain,
            source: row.reasoning?.source || 'seed',
        };

        const { error: updateErr } = await supabase
            .from('innovation_dna')
            .update({ reasoning })
            .eq('id', row.id);

        if (updateErr) {
            console.error(`  ❌ ${row.query.slice(0, 30)}... — ${updateErr.message}`);
        } else {
            console.log(`  ✅ ${domain.emoji} ${domain.zh} ← ${row.query.slice(0, 40)}...`);
            updated++;
        }
    }

    console.log(`\n📊 更新完成: ${updated}/${data.length}`);
}

main().catch(err => { console.error('💥', err); process.exit(1); });
