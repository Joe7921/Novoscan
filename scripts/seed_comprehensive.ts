/**
 * 综合种子数据填充脚本
 *
 * 为 Novoscan 平台 7 张核心表注入高质量种子数据，
 * 基于 2024-2025 顶刊和权威来源的真实突破性创新。
 *
 * 执行方式：
 *   npx tsx scripts/seed_comprehensive.ts          # 注入数据
 *   npx tsx scripts/seed_comprehensive.ts clean    # 清除种子数据
 */

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

// 手动加载 .env.local（不依赖 dotenv）
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ─── 种子数据标识（用于追踪和清除） ───
const SEED_HASH = 'seed_comprehensive_2026';

// ─── 工具函数 ───
function daysAgo(n: number): Date {
    return new Date(Date.now() - n * 86400000);
}
function dateStr(d: Date): string {
    return d.toISOString().split('T')[0];
}
function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ═══════════════════════════════════════════════════════════
// 1. innovations 种子数据（~35 条真实突破性创新）
// ═══════════════════════════════════════════════════════════
interface InnovationSeed {
    keyword: string;
    category: string;
    noveltyScore: number;
    searchCount: number;
    domainId: string;
    subDomainId: string | null;
    qualityTier: 'high' | 'medium';
}

const INNOVATIONS: InnovationSeed[] = [
    // ─── AI / 机器学习 ───
    { keyword: '稀疏注意力机制优化', category: 'tech', noveltyScore: 88, searchCount: 42, domainId: 'ENG', subDomainId: 'ENG.CS.ML', qualityTier: 'high' },
    { keyword: '多模态大模型跨域推理', category: 'tech', noveltyScore: 91, searchCount: 38, domainId: 'ENG', subDomainId: 'ENG.CS.ML', qualityTier: 'high' },
    { keyword: 'AI驱动蛋白质折叠预测', category: 'tech', noveltyScore: 95, searchCount: 35, domainId: 'ENG', subDomainId: 'ENG.CS.ML', qualityTier: 'high' },
    { keyword: '知识蒸馏端侧部署', category: 'tech', noveltyScore: 82, searchCount: 28, domainId: 'ENG', subDomainId: 'ENG.CS.ML', qualityTier: 'high' },
    { keyword: '强化学习自适应机器人控制', category: 'tech', noveltyScore: 85, searchCount: 22, domainId: 'ENG', subDomainId: 'ENG.CS.ML', qualityTier: 'high' },
    { keyword: 'Transformer长序列建模突破', category: 'tech', noveltyScore: 87, searchCount: 31, domainId: 'ENG', subDomainId: 'ENG.CS.ML', qualityTier: 'high' },
    { keyword: '生成式AI代码自动修复', category: 'tech', noveltyScore: 79, searchCount: 45, domainId: 'ENG', subDomainId: 'ENG.CS', qualityTier: 'medium' },
    { keyword: '联邦学习隐私计算', category: 'tech', noveltyScore: 83, searchCount: 19, domainId: 'ENG', subDomainId: 'ENG.CS.ML', qualityTier: 'high' },

    // ─── 自然语言处理 ───
    { keyword: '大模型幻觉检测与消除', category: 'tech', noveltyScore: 90, searchCount: 50, domainId: 'ENG', subDomainId: 'ENG.CS.NLP', qualityTier: 'high' },
    { keyword: '多语言低资源翻译', category: 'tech', noveltyScore: 78, searchCount: 15, domainId: 'ENG', subDomainId: 'ENG.CS.NLP', qualityTier: 'medium' },

    // ─── 计算机视觉 ───
    { keyword: '3D高斯溅射实时渲染', category: 'tech', noveltyScore: 93, searchCount: 33, domainId: 'ENG', subDomainId: 'ENG.CS.CV', qualityTier: 'high' },
    { keyword: '视觉基础模型零样本分割', category: 'tech', noveltyScore: 86, searchCount: 27, domainId: 'ENG', subDomainId: 'ENG.CS.CV', qualityTier: 'high' },

    // ─── 生物医学 ───
    { keyword: 'CRISPR体内基因治疗', category: 'method', noveltyScore: 94, searchCount: 30, domainId: 'MED', subDomainId: 'MED.BIO', qualityTier: 'high' },
    { keyword: 'CAR-T自免疾病跨领域治疗', category: 'method', noveltyScore: 92, searchCount: 25, domainId: 'MED', subDomainId: 'MED.BIO', qualityTier: 'high' },
    { keyword: 'GLP-1受体激动剂多适应症拓展', category: 'method', noveltyScore: 80, searchCount: 48, domainId: 'MED', subDomainId: 'MED.CLIN', qualityTier: 'high' },
    { keyword: 'mRNA个性化癌症疫苗', category: 'method', noveltyScore: 91, searchCount: 20, domainId: 'MED', subDomainId: 'MED.BIO', qualityTier: 'high' },
    { keyword: '脑机接口非侵入式信号增强', category: 'method', noveltyScore: 88, searchCount: 18, domainId: 'MED', subDomainId: 'MED.BIO', qualityTier: 'high' },
    { keyword: 'AI辅助药物分子设计', category: 'method', noveltyScore: 85, searchCount: 23, domainId: 'MED', subDomainId: null, qualityTier: 'high' },
    { keyword: '液体活检早期癌症筛查', category: 'method', noveltyScore: 83, searchCount: 16, domainId: 'MED', subDomainId: 'MED.CLIN', qualityTier: 'high' },

    // ─── 量子计算 / 物理 ───
    { keyword: '量子纠错阈值突破', category: 'tech', noveltyScore: 96, searchCount: 12, domainId: 'SCI', subDomainId: 'SCI.PHY', qualityTier: 'high' },
    { keyword: '拓扑量子比特稳定性提升', category: 'tech', noveltyScore: 89, searchCount: 8, domainId: 'SCI', subDomainId: 'SCI.PHY', qualityTier: 'high' },
    { keyword: '室温超导材料新进展', category: 'tech', noveltyScore: 75, searchCount: 40, domainId: 'SCI', subDomainId: 'SCI.PHY', qualityTier: 'medium' },
    { keyword: '核时钟精密计时', category: 'tech', noveltyScore: 93, searchCount: 6, domainId: 'SCI', subDomainId: 'SCI.PHY', qualityTier: 'high' },

    // ─── 能源 / 材料 ───
    { keyword: '钙钛矿硅串联太阳能电池', category: 'tech', noveltyScore: 87, searchCount: 24, domainId: 'ENG', subDomainId: null, qualityTier: 'high' },
    { keyword: '固态电池500Wh能量密度突破', category: 'tech', noveltyScore: 84, searchCount: 36, domainId: 'ENG', subDomainId: null, qualityTier: 'high' },
    { keyword: '小型模块化核反应堆SMR', category: 'tech', noveltyScore: 81, searchCount: 14, domainId: 'ENG', subDomainId: null, qualityTier: 'high' },
    { keyword: '可生物降解PHA工业化量产', category: 'tech', noveltyScore: 77, searchCount: 21, domainId: 'ENG', subDomainId: null, qualityTier: 'medium' },
    { keyword: '石墨烯功能半导体晶体管', category: 'tech', noveltyScore: 90, searchCount: 10, domainId: 'SCI', subDomainId: null, qualityTier: 'high' },

    // ─── 航天 / 交叉学科 ───
    { keyword: '月球背面采样返回', category: 'tech', noveltyScore: 88, searchCount: 32, domainId: 'INTER', subDomainId: null, qualityTier: 'high' },
    { keyword: 'AI气象预测超越数值模拟', category: 'tech', noveltyScore: 86, searchCount: 29, domainId: 'INTER', subDomainId: null, qualityTier: 'high' },
    { keyword: 'JWST宇宙早期星系发现', category: 'tech', noveltyScore: 84, searchCount: 17, domainId: 'SCI', subDomainId: 'SCI.PHY', qualityTier: 'high' },

    // ─── 商业 / 可持续 ───
    { keyword: '碳捕获直接空气回收DAC', category: 'business', noveltyScore: 82, searchCount: 13, domainId: 'ENG', subDomainId: null, qualityTier: 'high' },
    { keyword: '合成生物学细胞工厂', category: 'tech', noveltyScore: 89, searchCount: 11, domainId: 'MED', subDomainId: 'MED.BIO', qualityTier: 'high' },
    { keyword: '数字孪生工业预测性维护', category: 'business', noveltyScore: 76, searchCount: 26, domainId: 'ENG', subDomainId: 'ENG.CS', qualityTier: 'medium' },
    { keyword: '具身智能人形机器人', category: 'tech', noveltyScore: 92, searchCount: 44, domainId: 'ENG', subDomainId: 'ENG.CS.ML', qualityTier: 'high' },
];

// ═══════════════════════════════════════════════════════════
// 2. sub_domains 补充子领域
// ═══════════════════════════════════════════════════════════
const EXTRA_SUB_DOMAINS = [
    { id: 'ENG.EE', domain_id: 'ENG', parent_id: null, name_zh: '电子工程', name_en: 'Electrical Engineering', aliases: ['EE', 'Electronics', '电子信息'], level: 2 },
    { id: 'ENG.ME', domain_id: 'ENG', parent_id: null, name_zh: '机械工程', name_en: 'Mechanical Engineering', aliases: ['ME', 'Mechanical', '机械'], level: 2 },
    { id: 'ENG.MAT', domain_id: 'ENG', parent_id: null, name_zh: '材料工程', name_en: 'Materials Engineering', aliases: ['Materials', '材料科学'], level: 2 },
    { id: 'ENG.CS.SEC', domain_id: 'ENG', parent_id: 'ENG.CS', name_zh: '网络安全', name_en: 'Cybersecurity', aliases: ['Security', '信息安全', '密码学'], level: 3 },
    { id: 'ENG.CS.ROB', domain_id: 'ENG', parent_id: 'ENG.CS', name_zh: '机器人学', name_en: 'Robotics', aliases: ['Robotics', '智能机器人'], level: 3 },
    { id: 'ENG.CS.DB', domain_id: 'ENG', parent_id: 'ENG.CS', name_zh: '数据库与大数据', name_en: 'Database & Big Data', aliases: ['Database', 'Big Data', '大数据'], level: 3 },
    { id: 'SCI.CHEM', domain_id: 'SCI', parent_id: null, name_zh: '化学', name_en: 'Chemistry', aliases: ['Chemistry', '化工'], level: 2 },
    { id: 'SCI.BIO', domain_id: 'SCI', parent_id: null, name_zh: '生物学', name_en: 'Biology', aliases: ['Biology', '生命科学'], level: 2 },
    { id: 'SCI.GEO', domain_id: 'SCI', parent_id: null, name_zh: '地球科学', name_en: 'Earth Science', aliases: ['Geoscience', '地质'], level: 2 },
    { id: 'SCI.ASTRO', domain_id: 'SCI', parent_id: null, name_zh: '天文学', name_en: 'Astronomy', aliases: ['Astronomy', '天体物理'], level: 2 },
    { id: 'MED.PHARM', domain_id: 'MED', parent_id: null, name_zh: '药学', name_en: 'Pharmacy', aliases: ['Pharmacy', '药物化学', '药理学'], level: 2 },
    { id: 'MED.NEUR', domain_id: 'MED', parent_id: null, name_zh: '神经科学', name_en: 'Neuroscience', aliases: ['Neuro', '脑科学'], level: 2 },
    { id: 'AGR.FOOD', domain_id: 'AGR', parent_id: null, name_zh: '食品科学', name_en: 'Food Science', aliases: ['Food', '食品工程'], level: 2 },
    { id: 'AGR.CROP', domain_id: 'AGR', parent_id: null, name_zh: '作物学', name_en: 'Crop Science', aliases: ['Crop', '农作物', '种植'], level: 2 },
    { id: 'INTER.ENV', domain_id: 'INTER', parent_id: null, name_zh: '环境科学', name_en: 'Environmental Science', aliases: ['Environment', '环保', '可持续发展'], level: 2 },
];

// ═══════════════════════════════════════════════════════════
// 3. 追加兑换码
// ═══════════════════════════════════════════════════════════
const EXTRA_REDEEM_CODES = [
    { code: 'LAUNCH500', points: 500, max_uses: 200, description: '🚀 Novoscan 正式上线庆典码' },
    { code: 'STUDENT100', points: 100, max_uses: 0, description: '🎓 学生专享码，无限次使用（每用户一次）' },
    { code: 'EASTER200', points: 200, max_uses: 100, description: '🐣 节日活动码，限100人' },
];

// ═══════════════════════════════════════════════════════════
// 4. public_reports 公开报告
// ═══════════════════════════════════════════════════════════
function buildPublicReports(): any[] {
    return [
        {
            idea_summary: '基于 Transformer 的长序列时间序列预测方法',
            idea_full: '提出一种改进的 Transformer 架构，利用稀疏注意力和频域分解技术，实现超长时间序列（10000+ 步）的高效精准预测，适用于气象、金融和能源领域。',
            report_type: 'novoscan',
            overall_score: 82.5,
            novelty_level: 'High',
            key_finding: '稀疏注意力与频域分解的结合在超长序列预测任务中展现出显著优势，但工程化落地仍需解决计算效率问题。',
            report_json: {
                success: true, scanMode: 'standard', noveltyScore: 82,
                summary: '该方向具有较高创新潜力，现有工作主要集中在 PatchTST 和 iTransformer 框架，但超长序列场景仍有优化空间。',
                academicReview: { score: 78, analysis: '已有 PatchTST(2023)、iTransformer(2024) 等前沿工作，但 10000+ 步预测仍为未充分探索领域。', keyFindings: ['PatchTST 已实现中等长度序列的SOTA', 'iTransformer 提出倒置注意力新范式', '超长序列的计算复杂度仍是瓶颈'] },
                industryAnalysis: { score: 80, analysis: '时间序列预测在量化金融、气象预报、能源调度中均有强需求。', keyFindings: ['Bloomberg 已采用 Transformer 进行市场预测', '谷歌 MetNet-3 将 AI 气象预报推向实用'] },
                innovationEvaluation: { overallScore: 85, innovationRadar: { novelty: 82, feasibility: 78, impact: 88, differentiation: 80 } },
                arbitration: { overallScore: 82, summary: '创新方向明确，技术路径可行，建议关注计算效率优化。', recommendation: '建议在现有 PatchTST 基础上融合频域分解，优先验证气象预报场景。' },
            },
            view_count: randomBetween(15, 80),
            created_at: daysAgo(randomBetween(1, 10)).toISOString(),
        },
        {
            idea_summary: 'CRISPR-Cas13 靶向 RNA 的体内基因沉默疗法',
            idea_full: '利用 CRISPR-Cas13 系统，开发靶向致病 RNA 的体内基因沉默疗法，避免永久修改 DNA，适用于感染性疾病和急性炎症治疗。',
            report_type: 'novoscan',
            overall_score: 89.0,
            novelty_level: 'High',
            key_finding: 'RNA 靶向基因沉默提供了可逆的治疗选项，在安全性层面具有颠覆性优势，但递送效率是核心挑战。',
            report_json: {
                success: true, scanMode: 'standard', noveltyScore: 89,
                summary: 'Cas13 RNA 靶向是 CRISPR 领域的新兴方向，避免了 DNA 永久修改的伦理和安全顾虑。',
                academicReview: { score: 88, analysis: 'Nature Biotechnology 2024 发表了多项 Cas13 体内递送突破。', keyFindings: ['Cas13d 变体在哺乳动物细胞中表现出高效靶向', 'LNP 递送系统可实现肝脏靶向 RNA 沉默', '与 RNAi 相比，Cas13 具有更高的特异性'] },
                industryAnalysis: { score: 85, analysis: '多家生物技术公司已布局 RNA 编辑赛道。', keyFindings: ['Arbor Biotechnologies 获得 Cas13 关键专利', '辉瑞正评估 RNA 编辑在抗病毒领域的应用'] },
                arbitration: { overallScore: 89, summary: '高度创新的治疗策略，递送效率是产业化的关键突破口。', recommendation: '建议优先攻克 LNP 递送效率，以抗病毒适应症切入临床。' },
            },
            view_count: randomBetween(20, 100),
            created_at: daysAgo(randomBetween(2, 12)).toISOString(),
        },
        {
            idea_summary: '3D 高斯溅射在自动驾驶场景重建中的应用',
            idea_full: '将 3D Gaussian Splatting 技术应用于自动驾驶的实时场景重建，结合 LiDAR 和多目摄像头数据，实现高保真、低延迟的城市环境 3D 重建。',
            report_type: 'flash',
            overall_score: 78.0,
            novelty_level: 'Medium',
            key_finding: '3DGS 在场景重建速度上远超 NeRF，但在动态物体处理和大规模场景扩展方面仍需突破。',
            report_json: {
                success: true, scanMode: 'flash', noveltyScore: 78,
                summary: '3D 高斯溅射与自动驾驶场景重建的结合具有实用价值，但面临动态场景和规模化挑战。',
                academicReview: { score: 75, analysis: 'CVPR 2024 多篇论文验证了 3DGS 在驾驶场景中的可行性。', keyFindings: ['Street Gaussians 实现了街景级动态重建', 'DrivingGaussian 提出组合高斯场表示'] },
                industryAnalysis: { score: 80, analysis: 'Waymo、百度 Apollo 等均在探索神经辐射场在自动驾驶中的应用。', keyFindings: ['Waymo 已在仿真中使用 NeRF 生成测试场景'] },
                arbitration: { overallScore: 78, summary: '技术路径明确，建议关注实时性优化和动态物体分离。', recommendation: '建议融合 LiDAR 先验信息提升大规模场景的重建质量。' },
            },
            view_count: randomBetween(8, 50),
            created_at: daysAgo(randomBetween(1, 8)).toISOString(),
        },
        {
            idea_summary: '固态电池在电动航空中的可行性分析',
            idea_full: '评估全固态锂金属电池在电动垂直起降飞行器(eVTOL)中的应用前景，聚焦能量密度、安全性和循环寿命三大核心指标。',
            report_type: 'novoscan',
            overall_score: 74.0,
            novelty_level: 'Medium',
            key_finding: '固态电池对电动航空具有变革性意义，但当前技术距离商用化仍有 3-5 年差距。',
            report_json: {
                success: true, scanMode: 'standard', noveltyScore: 74,
                summary: '固态电池的能量密度优势对电动航空至关重要，但界面阻抗和规模化制造是核心挑战。',
                academicReview: { score: 72, analysis: '三星 SDI 和 QuantumScape 的原型已展示 400+ Wh/kg 能量密度。', keyFindings: ['硫化物固态电解质展现最高离子导率', '界面稳定性仍是循环寿命的主要瓶颈'] },
                industryAnalysis: { score: 75, analysis: 'Joby Aviation 和亿航智能正密切关注固态电池进展。', keyFindings: ['丰田计划 2027 年量产全固态电池', 'eVTOL 需要 >400 Wh/kg 才能满足商用续航需求'] },
                arbitration: { overallScore: 74, summary: '方向正确但时间线较长，建议跟踪制造工艺突破。', recommendation: '建议以地面充电站配合低续航场景先行切入。' },
            },
            view_count: randomBetween(5, 35),
            created_at: daysAgo(randomBetween(3, 13)).toISOString(),
        },
        {
            idea_summary: '基于联邦学习的跨机构医疗数据协同分析',
            idea_full: '设计一种联邦学习框架，使多家医院在不共享原始数据的前提下协同训练医疗影像诊断 AI 模型，解决医疗数据孤岛问题。',
            report_type: 'novoscan',
            overall_score: 80.0,
            novelty_level: 'High',
            key_finding: '联邦学习在医疗场景中的应用已从概念走向实验验证，差分隐私和通信效率是产业化的两大关键。',
            report_json: {
                success: true, scanMode: 'standard', noveltyScore: 80,
                summary: '跨机构联邦学习为医疗 AI 提供了合规的数据利用方案，但通信开销和异构数据对齐仍需优化。',
                academicReview: { score: 82, analysis: 'Nature Medicine 2024 报道了分布在 20 家医院的联邦学习实验。', keyFindings: ['FedAvg 在医疗影像分类中接近中心化训练性能', '差分隐私机制可确保单样本不可追溯'] },
                industryAnalysis: { score: 78, analysis: '微众银行 FATE 和 NVIDIA Clara 均推出医疗联邦学习平台。', keyFindings: ['NVIDIA Clara 已支持 20+ 家医院的联合训练', '数据合规法规（GDPR/个保法）推动联邦学习需求增长'] },
                arbitration: { overallScore: 80, summary: '技术成熟度中上，法规红利推动行业需求，建议关注通信效率优化。', recommendation: '建议结合安全多方计算，强化隐私保障等级以满足医疗合规要求。' },
            },
            view_count: randomBetween(10, 60),
            created_at: daysAgo(randomBetween(2, 11)).toISOString(),
        },
    ];
}

// ═══════════════════════════════════════════════════════════
// 主逻辑
// ═══════════════════════════════════════════════════════════

async function inject() {
    console.log('\n🌱 ═══════════════════════════════════════════');
    console.log('   Novoscan 综合种子数据注入');
    console.log('═══════════════════════════════════════════════\n');

    let totalSuccess = 0;
    let totalError = 0;

    // ─── 1. sub_domains 补充 ───
    console.log('📂 [1/7] sub_domains — 补充二级/三级子领域...');
    {
        const rows = EXTRA_SUB_DOMAINS.map(sd => ({
            id: sd.id,
            domain_id: sd.domain_id,
            parent_id: sd.parent_id,
            name_zh: sd.name_zh,
            name_en: sd.name_en,
            aliases: sd.aliases,
            level: sd.level,
        }));
        const { error } = await supabase.from('sub_domains').upsert(rows, { onConflict: 'id' });
        if (error) {
            console.error(`  ❌ sub_domains 失败: ${error.message}`);
            totalError++;
        } else {
            console.log(`  ✅ sub_domains: ${rows.length} 条补充`);
            totalSuccess++;
        }
    }

    // ─── 2. innovations 创新点 ───
    console.log('\n💡 [2/7] innovations — 注入突破性创新关键词...');
    const innovationIds: string[] = []; // 收集插入后的 UUID
    {
        for (const inv of INNOVATIONS) {
            const payload: Record<string, any> = {
                keyword: inv.keyword,
                keyword_normalized: inv.keyword.toLowerCase().trim(),
                category: inv.category,
                novelty_score: inv.noveltyScore,
                search_count: inv.searchCount,
                domain_id: inv.domainId,
                sub_domain_id: inv.subDomainId,
                source_idea_hash: SEED_HASH,
            };

            // 先检查是否已存在（upsert by keyword_normalized）
            const { data: existing } = await supabase
                .from('innovations')
                .select('innovation_id')
                .ilike('keyword_normalized', payload.keyword_normalized)
                .maybeSingle();

            if (existing) {
                innovationIds.push(existing.innovation_id);
                continue; // 跳过已存在
            }

            const { data, error } = await supabase
                .from('innovations')
                .insert(payload)
                .select('innovation_id')
                .single();

            if (error) {
                console.error(`  ❌ ${inv.keyword}: ${error.message}`);
                totalError++;
            } else if (data) {
                innovationIds.push(data.innovation_id);
            }
        }
        console.log(`  ✅ innovations: ${innovationIds.length} 条 (新增+已存在)`);
        totalSuccess++;
    }

    // ─── 3. search_events 检索事件 ───
    console.log('\n📊 [3/7] search_events — 注入检索事件数据...');
    {
        const events: any[] = [];
        const hotInnovations = innovationIds.slice(0, Math.min(20, innovationIds.length));

        for (const invId of hotInnovations) {
            // 每个创新点生成 3-6 个历史事件
            const eventCount = randomBetween(3, 6);
            for (let i = 0; i < eventCount; i++) {
                events.push({
                    innovation_id: invId,
                    query_hash: SEED_HASH,
                    domain_id: INNOVATIONS[hotInnovations.indexOf(invId)]?.domainId || 'ENG',
                    sub_domain_id: INNOVATIONS[hotInnovations.indexOf(invId)]?.subDomainId || null,
                    searched_at: daysAgo(randomBetween(0, 13)).toISOString(),
                });
            }
        }

        if (events.length > 0) {
            const { error } = await supabase.from('search_events').insert(events);
            if (error) {
                console.error(`  ❌ search_events 失败: ${error.message}`);
                totalError++;
            } else {
                console.log(`  ✅ search_events: ${events.length} 条`);
                totalSuccess++;
            }
        }
    }

    // ─── 4. innovation_trends 趋势数据 ───
    console.log('\n📈 [4/7] innovation_trends — 生成每日趋势快照...');
    {
        const trends: any[] = [];
        // 选取前 15 个创新点生成过去 14 天趋势
        const trendInnovations = INNOVATIONS.slice(0, Math.min(15, INNOVATIONS.length));

        for (let i = 0; i < trendInnovations.length; i++) {
            const inv = trendInnovations[i];
            const invId = innovationIds[i];
            if (!invId) continue;

            // 为每个创新点生成 7 天（每隔一天）的数据
            for (let day = 0; day < 14; day += 2) {
                const periodStart = dateStr(daysAgo(day));
                const baseCount = Math.max(1, Math.floor(inv.searchCount / 5));
                const dailyCount = baseCount + randomBetween(-2, 5);
                const prevCount = baseCount + randomBetween(-2, 3);
                const momentum = prevCount > 0 ? ((dailyCount - prevCount) / prevCount * 100) : 0;

                trends.push({
                    innovation_id: invId,
                    keyword: inv.keyword,
                    domain_id: inv.domainId,
                    sub_domain_id: inv.subDomainId,
                    period_type: 'daily',
                    period_start: periodStart,
                    search_count: Math.max(1, dailyCount),
                    avg_novelty_score: inv.noveltyScore + randomBetween(-3, 3),
                    momentum: parseFloat(momentum.toFixed(2)),
                });
            }
        }

        if (trends.length > 0) {
            const { error } = await supabase.from('innovation_trends').upsert(trends, {
                onConflict: 'innovation_id,period_type,period_start',
            });
            if (error) {
                console.error(`  ❌ innovation_trends 失败: ${error.message}`);
                totalError++;
            } else {
                console.log(`  ✅ innovation_trends: ${trends.length} 条`);
                totalSuccess++;
            }
        }
    }

    // ─── 5. trend_snapshots 平台趋势聚合 ───
    console.log('\n📉 [5/7] trend_snapshots — 平台级趋势快照...');
    {
        const snapshots: any[] = [];
        for (let day = 0; day < 14; day += 2) {
            const periodStart = dateStr(daysAgo(day + 2));
            const periodEnd = dateStr(daysAgo(day));
            snapshots.push({
                period_start: periodStart,
                period_end: periodEnd,
                total_searches: randomBetween(80, 200),
                active_innovations: randomBetween(20, 35),
                new_innovations: randomBetween(2, 8),
                avg_novelty_score: (78 + Math.random() * 10).toFixed(2),
                top_domains: JSON.stringify([
                    { domain_id: 'ENG', name_zh: '工学', count: randomBetween(30, 80) },
                    { domain_id: 'MED', name_zh: '医学', count: randomBetween(15, 40) },
                    { domain_id: 'SCI', name_zh: '理学', count: randomBetween(10, 30) },
                    { domain_id: 'INTER', name_zh: '交叉学科', count: randomBetween(5, 15) },
                ]),
                domain_distribution: JSON.stringify([
                    { domain_id: 'ENG', percentage: randomBetween(35, 50) },
                    { domain_id: 'MED', percentage: randomBetween(15, 25) },
                    { domain_id: 'SCI', percentage: randomBetween(10, 20) },
                    { domain_id: 'INTER', percentage: randomBetween(5, 10) },
                ]),
            });
        }

        const { error } = await supabase.from('trend_snapshots').upsert(snapshots, {
            onConflict: 'period_start',
        });
        if (error) {
            console.error(`  ❌ trend_snapshots 失败: ${error.message}`);
            totalError++;
        } else {
            console.log(`  ✅ trend_snapshots: ${snapshots.length} 条`);
            totalSuccess++;
        }
    }

    // ─── 6. public_reports 公开报告 ───
    console.log('\n📄 [6/7] public_reports — 展示级公开报告...');
    {
        const reports = buildPublicReports();
        const { error } = await supabase.from('public_reports').insert(reports);
        if (error) {
            if (error.message.includes('does not exist') || error.code === '42P01') {
                console.log(`  ⚠️  public_reports 表不存在，跳过`);
            } else {
                console.error(`  ❌ public_reports 失败: ${error.message}`);
                totalError++;
            }
        } else {
            console.log(`  ✅ public_reports: ${reports.length} 条`);
            totalSuccess++;
        }
    }

    // ─── 7. redeem_codes 兑换码补充 ───
    console.log('\n🎁 [7/7] redeem_codes — 补充兑换码...');
    {
        const { error } = await supabase.from('redeem_codes').upsert(EXTRA_REDEEM_CODES, {
            onConflict: 'code',
        });
        if (error) {
            if (error.message.includes('does not exist') || error.code === '42P01') {
                console.log(`  ⚠️  redeem_codes 表不存在，跳过`);
            } else {
                console.error(`  ❌ redeem_codes 失败: ${error.message}`);
                totalError++;
            }
        } else {
            console.log(`  ✅ redeem_codes: ${EXTRA_REDEEM_CODES.length} 条`);
            totalSuccess++;
        }
    }

    // ─── 结果汇总 ───
    console.log('\n═══════════════════════════════════════════════');
    console.log(`📊 注入完成: ✅ ${totalSuccess} 成功 | ❌ ${totalError} 失败`);

    // 统计各表行数
    const tables = ['innovations', 'innovation_trends', 'trend_snapshots', 'search_events', 'sub_domains', 'public_reports', 'redeem_codes'];
    console.log('\n📦 各表行数:');
    for (const table of tables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (!error) {
            console.log(`   ${table}: ${count} 行`);
        } else {
            console.log(`   ${table}: (查询失败) ${error.message}`);
        }
    }

    console.log('\n🎉 种子数据注入完成！\n');
}

// ═══════════════════════════════════════════════════════════
// 清除种子数据
// ═══════════════════════════════════════════════════════════
async function clean() {
    console.log('\n🧹 ═══════════════════════════════════════════');
    console.log('   清除种子数据');
    console.log('═══════════════════════════════════════════════\n');

    // 1. search_events（通过 query_hash 标识）
    const { count: evtCount } = await supabase
        .from('search_events')
        .select('*', { count: 'exact', head: true })
        .eq('query_hash', SEED_HASH);
    await supabase.from('search_events').delete().eq('query_hash', SEED_HASH);
    console.log(`  ✅ search_events: 清除 ${evtCount || 0} 条`);

    // 2. innovation_trends（通过关联 innovations 的 source_idea_hash 查找）
    // 先获取种子 innovation_ids
    const { data: seedInnovations } = await supabase
        .from('innovations')
        .select('innovation_id')
        .eq('source_idea_hash', SEED_HASH);
    const seedIds = (seedInnovations || []).map(r => r.innovation_id);

    if (seedIds.length > 0) {
        const { count: trendCount } = await supabase
            .from('innovation_trends')
            .select('*', { count: 'exact', head: true })
            .in('innovation_id', seedIds);
        await supabase.from('innovation_trends').delete().in('innovation_id', seedIds);
        console.log(`  ✅ innovation_trends: 清除 ${trendCount || 0} 条`);
    }

    // 3. innovations（通过 source_idea_hash）
    const { count: invCount } = await supabase
        .from('innovations')
        .select('*', { count: 'exact', head: true })
        .eq('source_idea_hash', SEED_HASH);
    await supabase.from('innovations').delete().eq('source_idea_hash', SEED_HASH);
    console.log(`  ✅ innovations: 清除 ${invCount || 0} 条`);

    // 4. trend_snapshots（无法精确标识种子数据，跳过）
    console.log(`  ⚠️  trend_snapshots: 跳过（无标识，请手动清除）`);

    // 5. public_reports（无 user_id 的为种子数据）
    const { count: repCount } = await supabase
        .from('public_reports')
        .select('*', { count: 'exact', head: true })
        .is('user_id', null);
    if (repCount && repCount > 0) {
        await supabase.from('public_reports').delete().is('user_id', null);
        console.log(`  ✅ public_reports: 清除 ${repCount} 条 (user_id=null)`);
    } else {
        console.log(`  ✅ public_reports: 无种子数据需清除`);
    }

    // 6. 额外兑换码
    const extraCodes = EXTRA_REDEEM_CODES.map(c => c.code);
    await supabase.from('redeem_codes').delete().in('code', extraCodes);
    console.log(`  ✅ redeem_codes: 清除 ${extraCodes.length} 条`);

    // 7. sub_domains 补充数据
    const extraSubIds = EXTRA_SUB_DOMAINS.map(sd => sd.id);
    await supabase.from('sub_domains').delete().in('id', extraSubIds);
    console.log(`  ✅ sub_domains: 清除 ${extraSubIds.length} 条`);

    console.log('\n🎉 种子数据清除完成！\n');
}

// ─── 入口 ───
const args = process.argv.slice(2);
if (args[0] === 'clean' || args[0] === 'clear') {
    clean().catch(err => { console.error('💥 清除失败:', err); process.exit(1); });
} else {
    inject().catch(err => { console.error('💥 注入失败:', err); process.exit(1); });
}
