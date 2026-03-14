import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { resolve } from 'path';

function loadEnv() {
    const envPath = resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            value = value.replace(/^['"]|['"]$/g, '');
            process.env[key] = value;
        }
    });
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// 简化版的静态映射（避免在独立 tsx 脚本中导入 Next.js 环境依赖出错）
// ==========================================
const DOMAIN_REGISTRY = [
    { id: 'ENG', nameZh: '工学', nameEn: 'Engineering' },
    { id: 'SCI', nameZh: '理学', nameEn: 'Science' },
    { id: 'MED', nameZh: '医学', nameEn: 'Medicine' },
    { id: 'AGR', nameZh: '农学', nameEn: 'Agriculture' },
    { id: 'HUM', nameZh: '人文', nameEn: 'Humanities' },
    { id: 'SOC', nameZh: '社科', nameEn: 'Social Sciences' },
    { id: 'ART', nameZh: '艺术', nameEn: 'Arts' },
    { id: 'INTER', nameZh: '交叉学科', nameEn: 'Interdisciplinary' },
];

const SUB_DOMAIN_SEEDS = [
    { id: 'ENG.CS', domainId: 'ENG', nameZh: '计算机科学', aliases: ['CS', 'Computer Science'] },
    { id: 'ENG.CS.ML', domainId: 'ENG', nameZh: '机器学习', aliases: ['ML', 'Machine Learning', 'AI', '人工智能'] },
    { id: 'ENG.CS.NLP', domainId: 'ENG', nameZh: '自然语言处理', aliases: ['NLP', '大模型', 'LLM'] },
    { id: 'ENG.CS.CV', domainId: 'ENG', nameZh: '计算机视觉', aliases: ['CV', '图像处理', '机器视觉'] },
    { id: 'SCI.PHY', domainId: 'SCI', nameZh: '物理学', aliases: ['Physics'] },
    { id: 'SCI.MATH', domainId: 'SCI', nameZh: '数学', aliases: ['Mathematics', 'Math'] },
    { id: 'SCI.CHEM', domainId: 'SCI', nameZh: '化学', aliases: ['Chemistry'] },
    { id: 'MED.BIO', domainId: 'MED', nameZh: '生物医学', aliases: ['Biomedical', 'Life Science'] },
    { id: 'MED.CLIN', domainId: 'MED', nameZh: '临床医学', aliases: ['Clinical Medicine', 'Clinical'] },
    { id: 'SOC.ECO', domainId: 'SOC', nameZh: '经济学', aliases: ['Economics', 'Econ', '商业', '管理', 'Business'] },
    { id: 'HUM.PHI', domainId: 'HUM', nameZh: '哲学', aliases: ['Philosophy', 'Phil'] },
];

const CATEGORY_TO_DOMAIN_MAP: Record<string, string> = {
    'tech': 'ENG',
    'healthcare': 'MED',
    'business': 'SOC',
    'method': 'SCI',
    'other': 'INTER'
};

function assignDomainSync(keyword: string, oldCategory: string) {
    const lowerInput = keyword.toLowerCase().trim();

    // 1. 尝试静态匹配
    const exactNameMatch = SUB_DOMAIN_SEEDS.find(s => s.nameZh.toLowerCase() === lowerInput);
    if (exactNameMatch) return { domainId: exactNameMatch.domainId, subDomainId: exactNameMatch.id };

    for (const seed of SUB_DOMAIN_SEEDS) {
        for (const alias of seed.aliases) {
            if (alias.toLowerCase() === lowerInput) {
                return { domainId: seed.domainId, subDomainId: seed.id };
            }
        }
    }

    // 2. 只有静态 fallback
    const normCat = (oldCategory || '').toLowerCase().trim();
    if (CATEGORY_TO_DOMAIN_MAP[normCat]) {
        return { domainId: CATEGORY_TO_DOMAIN_MAP[normCat] };
    }

    return { domainId: 'INTER' };
}

async function cleanseDatabase() {
    console.log('[Cleanse] 正在获取需要清洗的历史创新点数据...');

    const { data: innovations, error } = await supabase
        .from('innovations')
        .select('innovation_id, keyword, category, domain_id, sub_domain_id')
        .is('domain_id', null);

    if (error) {
        console.error('[Cleanse] 获取数据失败:', error);
        return;
    }

    if (!innovations || innovations.length === 0) {
        console.log('[Cleanse] 数据库中没有缺少领域字段的数据，无需清洗。');
        return;
    }

    console.log(`[Cleanse] 找到 ${innovations.length} 条待清洗记录，开始处理...`);

    let successCount = 0;
    let errorCount = 0;

    for (const inv of innovations) {
        const info = assignDomainSync(inv.keyword, inv.category);

        const updateData: any = { domain_id: info.domainId };
        if (info.subDomainId) {
            updateData.sub_domain_id = info.subDomainId;
        }

        const { error: updateErr } = await supabase
            .from('innovations')
            .update(updateData)
            .eq('innovation_id', inv.innovation_id);

        if (updateErr) {
            console.error(`[Cleanse] 更新记录失败 [${inv.keyword}]:`, updateErr);
            errorCount++;
        } else {
            console.log(`[Cleanse] 成功映射: ${inv.keyword} (${inv.category}) -> Domain: ${info.domainId}, SubDomain: ${info.subDomainId || 'N/A'}`);
            successCount++;
        }
    }

    console.log(`\n[Cleanse] 清洗完成！成功: ${successCount}, 失败: ${errorCount}`);
}

cleanseDatabase().catch(console.error);
