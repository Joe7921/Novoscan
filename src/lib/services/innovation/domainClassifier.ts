/**
 * 轻量级领域分类器
 *
 * 基于关键词匹配自动为创新数据打上领域标签，零 AI 调用成本。
 * 支持中英文关键词匹配。
 */

// ==================== 领域定义 ====================

export interface DomainInfo {
    id: string;
    zh: string;
    en: string;
    color: string;   // 用于 UI 展示的颜色
    emoji: string;
}

interface DomainRule extends DomainInfo {
    keywords: string[];  // 全部小写
}

const DOMAIN_RULES: DomainRule[] = [
    {
        id: 'ai',
        zh: '人工智能',
        en: 'AI',
        color: '#6366f1',
        emoji: '🤖',
        keywords: [
            'ai', 'artificial intelligence', 'machine learning', 'deep learning',
            'neural network', 'llm', 'large language model', 'transformer',
            'computer vision', 'nlp', 'natural language', 'generative ai',
            '人工智能', '机器学习', '深度学习', '大模型', '神经网络',
            'alphafold', 'graphcast', 'diffusion model', 'reinforcement learning',
        ],
    },
    {
        id: 'biotech',
        zh: '生物技术',
        en: 'Biotech',
        color: '#10b981',
        emoji: '🧬',
        keywords: [
            'crispr', 'gene editing', 'gene therapy', 'genomic', 'genome',
            'protein', 'cell therapy', 'car-t', 'car t', 'mrna',
            'base editing', 'prime editing', 'biologic', 'synthetic biology',
            '基因编辑', '基因治疗', '蛋白质', '细胞疗法', '合成生物学',
            'casgevy', 'cas9', 'cas12', 'cas13',
        ],
    },
    {
        id: 'quantum',
        zh: '量子科技',
        en: 'Quantum',
        color: '#8b5cf6',
        emoji: '⚛️',
        keywords: [
            'quantum computing', 'quantum', 'qubit', 'quantum error correction',
            'quantum advantage', 'quantum supremacy', 'superconducting qubit',
            '量子计算', '量子纠错', '量子比特', '量子优势',
            'topological qubit', 'ion trap',
        ],
    },
    {
        id: 'energy',
        zh: '新能源',
        en: 'Energy',
        color: '#f59e0b',
        emoji: '⚡',
        keywords: [
            'solar cell', 'solar panel', 'photovoltaic', 'perovskite',
            'battery', 'solid state battery', 'lithium', 'energy storage',
            'nuclear fusion', 'nuclear reactor', 'smr', 'modular reactor',
            'hydrogen', 'fuel cell', 'wind energy',
            '太阳能', '电池', '核聚变', '核反应堆', '储能', '固态电池',
        ],
    },
    {
        id: 'space',
        zh: '航天探索',
        en: 'Space',
        color: '#0ea5e9',
        emoji: '🚀',
        keywords: [
            'space', 'spacecraft', 'satellite', 'moon', 'lunar', 'mars',
            'telescope', 'exoplanet', 'orbit', 'rocket', 'starship',
            'james webb', 'jwst', 'nasa', 'spacex',
            '航天', '卫星', '月球', '火星', '嫦娥', '望远镜', '星系',
        ],
    },
    {
        id: 'materials',
        zh: '新材料',
        en: 'Materials',
        color: '#64748b',
        emoji: '🔬',
        keywords: [
            'graphene', 'semiconductor', '2d material', 'metamaterial',
            'superconductor', 'room temperature superconductor', 'polymer',
            'nanomaterial', 'carbon nanotube', 'biodegradable',
            '石墨烯', '半导体', '超导', '纳米材料', '新材料', '可降解',
        ],
    },
    {
        id: 'medicine',
        zh: '医药健康',
        en: 'Medicine',
        color: '#ef4444',
        emoji: '💊',
        keywords: [
            'drug discovery', 'clinical trial', 'fda', 'therapy',
            'vaccine', 'hiv', 'cancer', 'oncology', 'immunotherapy',
            'glp-1', 'semaglutide', 'lenacapavir', 'antibiotic',
            'pharmaceutical', 'treatment', 'diagnosis',
            '药物', '临床试验', '疫苗', '癌症', '免疫', '减重',
        ],
    },
    {
        id: 'neurotech',
        zh: '神经科技',
        en: 'Neurotech',
        color: '#ec4899',
        emoji: '🧠',
        keywords: [
            'brain computer interface', 'bci', 'neuralink', 'neural interface',
            'neuroprosthetic', 'brain implant', 'eeg', 'brain-machine',
            '脑机接口', '神经接口', '脑植入',
        ],
    },
    {
        id: 'climate',
        zh: '气候环境',
        en: 'Climate',
        color: '#22c55e',
        emoji: '🌍',
        keywords: [
            'climate', 'climate change', 'carbon capture', 'carbon dioxide',
            'greenhouse', 'environmental', 'sustainability', 'ecosystem',
            'weather forecast', 'weather prediction', 'decarbonization',
            '气候', '碳捕获', '环境', '可持续', '气象预测',
        ],
    },
    {
        id: 'robotics',
        zh: '机器人',
        en: 'Robotics',
        color: '#a855f7',
        emoji: '🦾',
        keywords: [
            'robot', 'robotics', 'autonomous', 'autonomous driving',
            'drone', 'uav', 'humanoid', 'self-driving', 'lidar',
            '机器人', '自动驾驶', '无人机',
        ],
    },
    {
        id: 'computing',
        zh: '计算技术',
        en: 'Computing',
        color: '#14b8a6',
        emoji: '💻',
        keywords: [
            'chip', 'processor', 'gpu', 'tpu', 'fpga', 'asic',
            '5g', '6g', 'edge computing', 'cloud computing',
            'neuromorphic', 'photonic computing',
            '芯片', '处理器', '边缘计算',
        ],
    },
    {
        id: 'physics',
        zh: '物理学',
        en: 'Physics',
        color: '#d946ef',
        emoji: '🔭',
        keywords: [
            'nuclear clock', 'atomic clock', 'particle physics',
            'dark matter', 'dark energy', 'gravitational wave',
            'higgs', 'cern', 'thorium', 'isotope',
            '核时钟', '粒子物理', '暗物质', '引力波',
        ],
    },
];

// ==================== 分类函数 ====================

/**
 * 对文本进行领域分类
 *
 * 匹配策略：
 * 1. 将文本转小写
 * 2. 检查每个领域的关键词是否出现在文本中
 * 3. 返回匹配数最多的领域
 * 4. 如果无匹配，返回 'other'
 *
 * @param text - 要分类的文本（通常是 query + 摘要/上下文）
 * @returns 领域信息 { id, zh, en, color, emoji }
 */
export function classifyDomain(text: string): DomainInfo {
    const lower = text.toLowerCase();

    let bestDomain: DomainRule | null = null;
    let bestScore = 0;

    for (const rule of DOMAIN_RULES) {
        let score = 0;
        for (const kw of rule.keywords) {
            if (lower.includes(kw)) {
                // 更长的关键词匹配给更高权重（避免短词误匹配）
                score += kw.length;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestDomain = rule;
        }
    }

    if (bestDomain && bestScore > 0) {
        return {
            id: bestDomain.id,
            zh: bestDomain.zh,
            en: bestDomain.en,
            color: bestDomain.color,
            emoji: bestDomain.emoji,
        };
    }

    return { id: 'other', zh: '其他', en: 'Other', color: '#94a3b8', emoji: '📌' };
}

/**
 * 批量分类（用于种子数据或收割器）
 */
export function classifyDomainBatch(texts: string[]): DomainInfo[] {
    return texts.map(classifyDomain);
}

/**
 * 获取所有可用领域列表（用于 UI 筛选器）
 */
export function getAllDomains(): DomainInfo[] {
    return [
        ...DOMAIN_RULES.map(r => ({
            id: r.id, zh: r.zh, en: r.en, color: r.color, emoji: r.emoji,
        })),
        { id: 'other', zh: '其他', en: 'Other', color: '#94a3b8', emoji: '📌' },
    ];
}
