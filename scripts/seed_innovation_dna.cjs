/**
 * 创新图谱种子数据填充脚本（CommonJS 版本）
 * 基于 2024-2025 年 Nature / Science / WEF / FDA 等真实突破性创新
 * 执行：node scripts/seed_innovation_dna.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('crypto');
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 缺少环境变量');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function generateQueryHash(query) {
    return createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
}

const SEED_DATA = [
    { query: 'AlphaFold — AI蛋白质结构预测革命', vector: [0.9, 0.7, 0.4, 0.8, 0.3], source: 'Nature 2024 / DeepMind', summary: '技术原理极高创新(0.9)，应用场景跨领域迁移(0.7)，面向专业科研用户(0.4)，需全新深度学习架构(0.8)，开源免费模式(0.3)' },
    { query: 'CRISPR Casgevy — 首个基因编辑疗法治疗镰刀型细胞贫血症', vector: [0.9, 0.6, 0.3, 0.9, 0.5], source: 'FDA 2023 批准 / Nature', summary: '技术原理颠覆性(0.9)，应用场景为精准医疗(0.6)，面向罕见病患者(0.3)，需全新基因编辑工程路线(0.9)，高价处方药模式(0.5)' },
    { query: 'Google Willow量子芯片 — 突破量子纠错阈值', vector: [1.0, 0.3, 0.2, 0.9, 0.2], source: 'Nature 2024 / Google Quantum AI', summary: '技术原理全球首创(1.0)，应用场景仍在基础研究(0.3)，面向极少数量子研究者(0.2)，需全新超导工程(0.9)，尚无商业模式(0.2)' },
    { query: 'GLP-1受体激动剂(司美格鲁肽) — 减重与心血管保护双效药物', vector: [0.5, 0.8, 0.7, 0.3, 0.6], source: 'Science 2024 Breakthrough / NEJM', summary: '技术原理改良现有(0.5)，应用场景跨多个疾病领域(0.8)，面向大众肥胖人群(0.7)，现成制药工艺(0.3)，重磅处方药模式(0.6)' },
    { query: 'Lenacapavir — 每年仅需两次注射即可预防HIV感染', vector: [0.7, 0.5, 0.6, 0.4, 0.7], source: 'NEJM 2024 / FDA', summary: '技术原理显著创新(0.7)，应用场景为已知领域(0.5)，面向HIV高风险人群(0.6)，路径较清晰(0.4)，长效注射订阅模式(0.7)' },
    { query: '钙钛矿-硅串联太阳能电池 — 光电转换效率突破33%', vector: [0.8, 0.6, 0.5, 0.7, 0.4], source: 'Nature Energy 2024', summary: '技术原理高度创新(0.8)，应用场景为可再生能源(0.6)，面向光伏行业(0.5)，需新制备工艺(0.7)，硬件销售模式(0.4)' },
    { query: 'CAR-T细胞疗法治疗系统性红斑狼疮等自身免疫病', vector: [0.8, 0.8, 0.3, 0.8, 0.5], source: 'Nature Medicine 2024', summary: '技术原理高创新(0.8)，应用场景跨领域迁移至自免疾病(0.8)，面向罕见病患者(0.3)，需个性化细胞工程(0.8)，高端医疗定价(0.5)' },
    { query: '嫦娥六号 — 人类首次月球背面采样返回', vector: [0.7, 0.9, 0.2, 0.9, 0.1], source: 'Nature 2024 / 中国国家航天局', summary: '技术原理显著创新(0.7)，应用场景开创全新探索领域(0.9)，面向科研群体(0.2)，需全新航天工程(0.9)，国家拨款无商业盈利(0.1)' },
    { query: '首个个性化CRISPR体内基因治疗 — 为新生儿定制的基因编辑疗法', vector: [1.0, 0.7, 0.2, 1.0, 0.6], source: 'NEJM 2025 / Innovative Genomics', summary: '技术原理全球首创(1.0)，应用场景为个性化医疗(0.7)，面向极罕见遗传病患者(0.2)，需全新按需定制工程(1.0)，定制化高价模式(0.6)' },
    { query: '石墨烯功能半导体 — 首个可取代硅基芯片的石墨烯晶体管', vector: [0.9, 0.5, 0.4, 0.8, 0.3], source: 'Nature 2024 / Georgia Tech', summary: '技术原理颠覆性(0.9)，应用场景为已知半导体领域(0.5)，面向芯片行业(0.4)，需全新工艺路线(0.8)，尚在实验室阶段(0.3)' },
    { query: 'AI气象预测(GraphCast/盘古气象) — 超越传统数值天气预报', vector: [0.8, 0.7, 0.8, 0.6, 0.3], source: 'Nature / Science 2024', summary: '技术原理高创新(0.8)，应用场景跨领域(0.7)，面向全球用户(0.8)，需定制化但路线清晰(0.6)，免费公共服务(0.3)' },
    { query: '室温超导材料研究新进展(后LK-99时代)', vector: [0.6, 0.4, 0.3, 0.5, 0.2], source: 'Nature 2024', summary: '技术原理改良中(0.6)，应用场景待验证(0.4)，面向材料科研(0.3)，路径尚不明确(0.5)，无商业模式(0.2)' },
    { query: '核时钟 — 钍-229核跃迁首次实现', vector: [1.0, 0.3, 0.1, 0.9, 0.1], source: 'Nature 2024', summary: '技术原理全球首创(1.0)，应用场景极度前沿(0.3)，面向极少数物理学家(0.1)，需全新核物理工程(0.9)，纯基础研究(0.1)' },
    { query: '可生物降解塑料PHA — 工业化微生物发酵量产突破', vector: [0.5, 0.7, 0.8, 0.5, 0.7], source: 'Nature Materials / WEF 2024', summary: '技术原理改良现有(0.5)，应用场景广泛替代(0.7)，面向大众消费者(0.8)，需优化现有发酵工艺(0.5)，绿色消费溢价模式(0.7)' },
    { query: 'Neuralink N1脑机接口 — 首位人类受试者完成植入', vector: [0.8, 0.9, 0.3, 0.8, 0.6], source: 'FDA批准 / Nature 2024', summary: '技术原理高创新(0.8)，应用场景开创性(0.9)，面向重度残障患者(0.3)，需全新神经工程(0.8)，医疗器械高端定价(0.6)' },
    { query: 'Prime Editing(先导编辑) — 下一代精准碱基编辑进入人体临床试验', vector: [0.9, 0.6, 0.3, 0.8, 0.4], source: 'Nature Medicine 2024 / Prime Medicine', summary: '技术原理颠覆性(0.9)，应用场景为精准医疗(0.6)，面向罕见病患者(0.3)，需定制化分子工程(0.8)，临床早期无模式(0.4)' },
    { query: '小型模块化核反应堆(SMR) — NuScale获NRC设计认证', vector: [0.6, 0.7, 0.6, 0.7, 0.8], source: 'NRC / WEF 2024', summary: '技术原理改良升级(0.6)，应用场景分布式能源(0.7)，面向工业与偏远地区(0.6)，需新核工程路线(0.7)，全新电力商业模式(0.8)' },
    { query: 'AI驱动药物发现 — Insilico首个全AI设计分子进入II期临床', vector: [0.7, 0.6, 0.4, 0.7, 0.8], source: 'Nature 2024 / Insilico Medicine', summary: '技术原理显著创新(0.7)，应用场景为药物研发(0.6)，面向制药行业(0.4)，需AI+生物学新路线(0.7)，平台授权+管线模式(0.8)' },
    { query: '詹姆斯·韦伯望远镜发现最远星系JADES-GS-z14-0', vector: [0.7, 1.0, 0.1, 0.8, 0.1], source: 'Nature 2024 / NASA', summary: '技术原理显著创新(0.7)，应用场景开创宇宙学新纪元(1.0)，面向极少数天文学家(0.1)，需复杂太空工程(0.8)，国家科研拨款(0.1)' },
    { query: '固态电池 — 丰田/三星原型突破500Wh/kg能量密度', vector: [0.7, 0.5, 0.7, 0.6, 0.5], source: 'Nature Energy / WEF 2024', summary: '技术原理显著创新(0.7)，应用场景为已有电动车领域(0.5)，面向大众消费者(0.7)，需新制造工艺但路径可见(0.6)，硬件供应链模式(0.5)' },
];

async function main() {
    console.log('🧬 创新图谱种子数据填充开始...');
    console.log(`📊 共 ${SEED_DATA.length} 条数据待插入`);
    console.log(`🔗 Supabase: ${supabaseUrl}\n`);

    let ok = 0, fail = 0;
    const dimKeys = ['techPrinciple', 'appScenario', 'targetUser', 'implPath', 'bizModel'];
    const dimLabels = ['技术原理', '应用场景', '目标用户', '实现路径', '商业模式'];

    for (const item of SEED_DATA) {
        const queryHash = generateQueryHash(item.query);
        const row = {
            query: item.query,
            query_hash: queryHash,
            tech_principle: item.vector[0],
            app_scenario: item.vector[1],
            target_user: item.vector[2],
            impl_path: item.vector[3],
            biz_model: item.vector[4],
            reasoning: {
                summary: item.summary,
                source: item.source,
                dimensions: dimKeys.map((key, i) => ({
                    key, value: item.vector[i],
                    reasoning: `[种子数据] ${dimLabels[i]}评分 ${item.vector[i]} — 来源: ${item.source}`,
                })),
            },
        };

        const { error } = await supabase.from('innovation_dna').upsert(row, { onConflict: 'query_hash' });
        if (error) { console.error(`  ❌ ${item.query.slice(0, 40)}... — ${error.message}`); fail++; }
        else { console.log(`  ✅ ${item.query.slice(0, 50)}...`); ok++; }
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`📊 结果: 成功 ${ok} | 失败 ${fail}`);

    const { count } = await supabase.from('innovation_dna').select('*', { count: 'exact', head: true });
    console.log(`📦 innovation_dna 表当前总行数: ${count}`);
    console.log('\n🎉 种子数据填充完成！');
}

main().catch(err => { console.error('💥', err); process.exit(1); });
