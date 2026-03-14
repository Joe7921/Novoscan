/**
 * 领域规范定义 (Domain Registry)
 * 
 * 用于规范化应用内所有的学科领域体系
 */

export interface DomainMeta {
    id: string;
    nameZh: string;
    nameEn: string;
    colorClasses: {
        bg: string;
        text: string;
        border: string;
        dot: string;
    };
}

// 1. 一级领域枚举字典
export const DOMAIN_REGISTRY: DomainMeta[] = [
    {
        id: 'ENG', nameZh: '工学', nameEn: 'Engineering',
        colorClasses: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' }
    },
    {
        id: 'SCI', nameZh: '理学', nameEn: 'Science',
        colorClasses: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' }
    },
    {
        id: 'MED', nameZh: '医学', nameEn: 'Medicine',
        colorClasses: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' }
    },
    {
        id: 'AGR', nameZh: '农学', nameEn: 'Agriculture',
        colorClasses: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' }
    },
    {
        id: 'HUM', nameZh: '人文', nameEn: 'Humanities',
        colorClasses: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' }
    },
    {
        id: 'SOC', nameZh: '社科', nameEn: 'Social Sciences',
        colorClasses: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' }
    },
    {
        id: 'ART', nameZh: '艺术', nameEn: 'Arts',
        colorClasses: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', dot: 'bg-pink-500' }
    },
    {
        id: 'INTER', nameZh: '交叉学科', nameEn: 'Interdisciplinary',
        colorClasses: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-500' }
    },
];

export type DomainId = typeof DOMAIN_REGISTRY[number]['id'];

// 2. 预置的子领域种子（前端备用的静态匹配表，完整数据在 Supabase sub_domains 表）
export interface SubDomainSeed {
    id: string;         //如 ENG.CS.ML
    domainId: DomainId;
    nameZh: string;
    aliases: string[];  //同义词
}

export const SUB_DOMAIN_SEEDS: SubDomainSeed[] = [
    // ======================== 工学 (ENG) ========================
    // —— 计算机类 ——
    { id: 'ENG.CS', domainId: 'ENG', nameZh: '计算机科学与技术', aliases: ['CS', 'Computer Science', '计算机'] },
    { id: 'ENG.CS.ML', domainId: 'ENG', nameZh: '机器学习与人工智能', aliases: ['ML', 'Machine Learning', 'AI', '人工智能', '深度学习'] },
    { id: 'ENG.CS.NLP', domainId: 'ENG', nameZh: '自然语言处理', aliases: ['NLP', '大模型', 'LLM', 'GPT'] },
    { id: 'ENG.CS.CV', domainId: 'ENG', nameZh: '计算机视觉', aliases: ['CV', 'Computer Vision', '图像处理', '机器视觉'] },
    { id: 'ENG.CS.SE', domainId: 'ENG', nameZh: '软件工程', aliases: ['SE', 'Software Engineering'] },
    { id: 'ENG.CS.SEC', domainId: 'ENG', nameZh: '信息安全与网络安全', aliases: ['Cybersecurity', 'InfoSec', '网络安全', '密码学'] },
    { id: 'ENG.CS.DB', domainId: 'ENG', nameZh: '数据库与大数据技术', aliases: ['Database', 'Big Data', '大数据', '数据工程'] },
    { id: 'ENG.CS.NET', domainId: 'ENG', nameZh: '计算机网络', aliases: ['Computer Network', '网络工程', '通信网络'] },
    { id: 'ENG.CS.ROB', domainId: 'ENG', nameZh: '机器人工程', aliases: ['Robotics', '机器人学', '机器人'] },
    { id: 'ENG.CS.IOT', domainId: 'ENG', nameZh: '物联网工程', aliases: ['IoT', 'Internet of Things', '物联网'] },
    { id: 'ENG.CS.BC', domainId: 'ENG', nameZh: '区块链工程', aliases: ['Blockchain', 'Web3', '区块链'] },
    // —— 电子信息类 ——
    { id: 'ENG.EE', domainId: 'ENG', nameZh: '电气工程及自动化', aliases: ['EE', 'Electrical Engineering', '电气工程'] },
    { id: 'ENG.EI', domainId: 'ENG', nameZh: '电子信息工程', aliases: ['Electronic Information', '电子工程', '信息工程'] },
    { id: 'ENG.COMM', domainId: 'ENG', nameZh: '通信工程', aliases: ['Communication Engineering', '通信', 'Telecom'] },
    { id: 'ENG.IC', domainId: 'ENG', nameZh: '集成电路与微电子', aliases: ['IC Design', 'Microelectronics', '芯片设计', '半导体'] },
    { id: 'ENG.OE', domainId: 'ENG', nameZh: '光电信息科学与工程', aliases: ['Optoelectronics', '光电工程', '光学'] },
    { id: 'ENG.CTRL', domainId: 'ENG', nameZh: '自动化与控制工程', aliases: ['Automation', 'Control Engineering', '自动化'] },
    // —— 机械与动力类 ——
    { id: 'ENG.ME', domainId: 'ENG', nameZh: '机械工程', aliases: ['ME', 'Mechanical Engineering', '机械设计制造'] },
    { id: 'ENG.IE', domainId: 'ENG', nameZh: '工业工程与智能制造', aliases: ['Industrial Engineering', '工业工程', '智能制造'] },
    { id: 'ENG.VE', domainId: 'ENG', nameZh: '车辆工程', aliases: ['Vehicle Engineering', '汽车工程', '新能源汽车'] },
    { id: 'ENG.ENERGY', domainId: 'ENG', nameZh: '能源与动力工程', aliases: ['Energy Engineering', '热能工程', '动力工程'] },
    // —— 土建与环境类 ——
    { id: 'ENG.CE', domainId: 'ENG', nameZh: '土木工程', aliases: ['Civil Engineering', '建筑工程', '结构工程'] },
    { id: 'ENG.ARCH', domainId: 'ENG', nameZh: '建筑学', aliases: ['Architecture', '建筑设计'] },
    { id: 'ENG.UP', domainId: 'ENG', nameZh: '城乡规划', aliases: ['Urban Planning', '城市规划', '国土空间规划'] },
    { id: 'ENG.ENV', domainId: 'ENG', nameZh: '环境科学与工程', aliases: ['Environmental Engineering', '环境工程', '环保'] },
    { id: 'ENG.WR', domainId: 'ENG', nameZh: '水利工程', aliases: ['Water Resources', 'Hydraulic Engineering', '水利'] },
    // —— 化工与材料类 ——
    { id: 'ENG.CHE', domainId: 'ENG', nameZh: '化学工程与工艺', aliases: ['Chemical Engineering', 'ChemE', '化工'] },
    { id: 'ENG.MAT', domainId: 'ENG', nameZh: '材料科学与工程', aliases: ['Materials Science', '材料学', '新材料', '高分子'] },
    { id: 'ENG.TEX', domainId: 'ENG', nameZh: '纺织科学与工程', aliases: ['Textile Engineering', '纺织工程'] },
    // —— 生物与食品类 ——
    { id: 'ENG.BIOE', domainId: 'ENG', nameZh: '生物工程', aliases: ['Bioengineering', '生物技术', 'Biotech'] },
    { id: 'ENG.BMED', domainId: 'ENG', nameZh: '生物医学工程', aliases: ['BME', 'Biomedical Engineering'] },
    { id: 'ENG.FOOD', domainId: 'ENG', nameZh: '食品科学与工程', aliases: ['Food Engineering', '食品工程', '食品安全'] },
    // —— 航空航天与交通类 ——
    { id: 'ENG.AE', domainId: 'ENG', nameZh: '航空航天工程', aliases: ['Aerospace', '航天', '飞行器设计'] },
    { id: 'ENG.NA', domainId: 'ENG', nameZh: '船舶与海洋工程', aliases: ['Naval Architecture', 'Marine Engineering', '船舶', '海洋工程'] },
    { id: 'ENG.TE', domainId: 'ENG', nameZh: '交通运输工程', aliases: ['Transportation Engineering', '交通工程', '轨道交通'] },
    // —— 矿业与地质类 ——
    { id: 'ENG.MIN', domainId: 'ENG', nameZh: '矿业工程', aliases: ['Mining Engineering', '采矿', '矿业'] },
    { id: 'ENG.GEE', domainId: 'ENG', nameZh: '地质工程', aliases: ['Geological Engineering', '勘查技术'] },
    { id: 'ENG.NUC', domainId: 'ENG', nameZh: '核科学与技术', aliases: ['Nuclear Engineering', '核工程', '核能'] },
    // —— 前沿技术类 ——
    { id: 'ENG.QC', domainId: 'ENG', nameZh: '量子信息科学', aliases: ['Quantum Computing', '量子计算', '量子信息'] },
    { id: 'ENG.SAF', domainId: 'ENG', nameZh: '安全工程', aliases: ['Safety Engineering', '安全科学', '消防工程'] },

    // ======================== 理学 (SCI) ========================
    { id: 'SCI.MATH', domainId: 'SCI', nameZh: '数学', aliases: ['Mathematics', 'Math', '应用数学', '基础数学'] },
    { id: 'SCI.STAT', domainId: 'SCI', nameZh: '统计学', aliases: ['Statistics', 'Stats', '应用统计'] },
    { id: 'SCI.PHY', domainId: 'SCI', nameZh: '物理学', aliases: ['Physics', '应用物理', '理论物理'] },
    { id: 'SCI.QM', domainId: 'SCI', nameZh: '量子力学与粒子物理', aliases: ['Quantum Mechanics', 'Quantum Physics', '粒子物理'] },
    { id: 'SCI.ASTRO', domainId: 'SCI', nameZh: '天文学', aliases: ['Astronomy', 'Astrophysics', '天体物理'] },
    { id: 'SCI.CHEM', domainId: 'SCI', nameZh: '化学', aliases: ['Chemistry', '应用化学', '有机化学', '无机化学'] },
    { id: 'SCI.BIO', domainId: 'SCI', nameZh: '生物科学', aliases: ['Biology', '生物学', '生命科学'] },
    { id: 'SCI.GEN', domainId: 'SCI', nameZh: '遗传学与基因组学', aliases: ['Genetics', 'Genomics', '基因组学', '基因'] },
    { id: 'SCI.MBIO', domainId: 'SCI', nameZh: '微生物学', aliases: ['Microbiology', '微生物'] },
    { id: 'SCI.BCHEM', domainId: 'SCI', nameZh: '生物化学与分子生物学', aliases: ['Biochemistry', '分子生物学'] },
    { id: 'SCI.GEO', domainId: 'SCI', nameZh: '地质学', aliases: ['Geology', 'Geoscience', '地球科学'] },
    { id: 'SCI.GEOG', domainId: 'SCI', nameZh: '地理科学', aliases: ['Geography', '地理信息系统', 'GIS'] },
    { id: 'SCI.ATM', domainId: 'SCI', nameZh: '大气科学', aliases: ['Atmospheric Science', '气象学', 'Meteorology'] },
    { id: 'SCI.OCEAN', domainId: 'SCI', nameZh: '海洋科学', aliases: ['Oceanography', 'Marine Science', '海洋学'] },
    { id: 'SCI.ECO', domainId: 'SCI', nameZh: '生态学', aliases: ['Ecology', '生态', '生态环境'] },

    // ======================== 医学 (MED) ========================
    { id: 'MED.CLIN', domainId: 'MED', nameZh: '临床医学', aliases: ['Clinical Medicine', 'Clinical', '内科', '外科'] },
    { id: 'MED.BMED', domainId: 'MED', nameZh: '基础医学', aliases: ['Basic Medicine', '基础医学研究', '病理学'] },
    { id: 'MED.PH', domainId: 'MED', nameZh: '公共卫生与预防医学', aliases: ['Public Health', 'Epidemiology', '预防医学', '流行病学'] },
    { id: 'MED.PHARM', domainId: 'MED', nameZh: '药学', aliases: ['Pharmacy', 'Pharmacology', '制药', '临床药学'] },
    { id: 'MED.CPHARM', domainId: 'MED', nameZh: '中药学', aliases: ['Chinese Pharmacy', '中药', '中药制剂'] },
    { id: 'MED.TCM', domainId: 'MED', nameZh: '中医学', aliases: ['Traditional Chinese Medicine', 'TCM', '针灸推拿'] },
    { id: 'MED.INTM', domainId: 'MED', nameZh: '中西医结合', aliases: ['Integrative Medicine', '中西医结合临床'] },
    { id: 'MED.DEN', domainId: 'MED', nameZh: '口腔医学', aliases: ['Dentistry', '口腔', '牙科'] },
    { id: 'MED.NUR', domainId: 'MED', nameZh: '护理学', aliases: ['Nursing', '护理'] },
    { id: 'MED.NEURO', domainId: 'MED', nameZh: '神经科学', aliases: ['Neuroscience', '脑科学', '神经生物学'] },
    { id: 'MED.REHAB', domainId: 'MED', nameZh: '康复医学', aliases: ['Rehabilitation', '康复治疗', '物理治疗'] },
    { id: 'MED.FMED', domainId: 'MED', nameZh: '法医学', aliases: ['Forensic Medicine', '法医'] },
    { id: 'MED.MI', domainId: 'MED', nameZh: '医学信息学与智慧医疗', aliases: ['Medical Informatics', 'Health IT', '数字健康', '智慧医疗'] },
    { id: 'MED.IMG', domainId: 'MED', nameZh: '医学影像学', aliases: ['Medical Imaging', '影像诊断', '放射学'] },
    { id: 'MED.LAB', domainId: 'MED', nameZh: '医学检验技术', aliases: ['Medical Laboratory', '检验医学', '临床检验'] },

    // ======================== 农学 (AGR) ========================
    { id: 'AGR.CROP', domainId: 'AGR', nameZh: '作物学', aliases: ['Crop Science', '农作物', '作物栽培', '作物遗传'] },
    { id: 'AGR.HORT', domainId: 'AGR', nameZh: '园艺学', aliases: ['Horticulture', '果树学', '蔬菜学'] },
    { id: 'AGR.PP', domainId: 'AGR', nameZh: '植物保护', aliases: ['Plant Protection', '植保', '农药学', '病虫害防治'] },
    { id: 'AGR.ANI', domainId: 'AGR', nameZh: '畜牧学', aliases: ['Animal Science', '畜牧', '动物科学', '动物遗传育种'] },
    { id: 'AGR.VET', domainId: 'AGR', nameZh: '兽医学', aliases: ['Veterinary', '兽医', '动物医学'] },
    { id: 'AGR.SOIL', domainId: 'AGR', nameZh: '农业资源与环境', aliases: ['Soil Science', '土壤学', '农业环境'] },
    { id: 'AGR.FOR', domainId: 'AGR', nameZh: '林学', aliases: ['Forestry', '林业', '森林培育', '林木遗传'] },
    { id: 'AGR.LAND', domainId: 'AGR', nameZh: '草学与草地管理', aliases: ['Grassland Science', '草学', '草业'] },
    { id: 'AGR.FISH', domainId: 'AGR', nameZh: '水产学', aliases: ['Fisheries', 'Aquaculture', '水产养殖', '渔业'] },
    { id: 'AGR.TEA', domainId: 'AGR', nameZh: '茶学', aliases: ['Tea Science', '茶叶'] },
    { id: 'AGR.AGRI', domainId: 'AGR', nameZh: '智慧农业与农业工程', aliases: ['Smart Agriculture', 'AgTech', '精准农业', '农业机械'] },
    { id: 'AGR.FOOD', domainId: 'AGR', nameZh: '农产品加工与储藏', aliases: ['Agricultural Product Processing', '农产品加工'] },

    // ======================== 人文 (HUM) ========================
    // —— 哲学类 ——
    { id: 'HUM.PHI', domainId: 'HUM', nameZh: '哲学', aliases: ['Philosophy', '中国哲学', '西方哲学', '科学哲学'] },
    { id: 'HUM.LOGIC', domainId: 'HUM', nameZh: '逻辑学', aliases: ['Logic', '形式逻辑'] },
    { id: 'HUM.ETHICS', domainId: 'HUM', nameZh: '伦理学', aliases: ['Ethics', '应用伦理', '科技伦理'] },
    // —— 文学类 ——
    { id: 'HUM.CLIT', domainId: 'HUM', nameZh: '中国语言文学', aliases: ['Chinese Literature', '中文', '汉语言文学', '古典文献'] },
    { id: 'HUM.FLIT', domainId: 'HUM', nameZh: '外国语言文学', aliases: ['Foreign Literature', '英语', '日语', '外国文学', '翻译学'] },
    { id: 'HUM.LING', domainId: 'HUM', nameZh: '语言学', aliases: ['Linguistics', '语言科学', '应用语言学', '计算语言学'] },
    // —— 历史学类 ——
    { id: 'HUM.CHIS', domainId: 'HUM', nameZh: '中国史', aliases: ['Chinese History', '中国古代史', '中国近现代史'] },
    { id: 'HUM.WHIS', domainId: 'HUM', nameZh: '世界史', aliases: ['World History', '世界历史', '外国史'] },
    { id: 'HUM.ARCH', domainId: 'HUM', nameZh: '考古学', aliases: ['Archaeology', '文物学', '博物馆学'] },
    // —— 其他人文 ——
    { id: 'HUM.REL', domainId: 'HUM', nameZh: '宗教学', aliases: ['Religious Studies', 'Theology', '宗教'] },
    { id: 'HUM.ANT', domainId: 'HUM', nameZh: '人类学与民族学', aliases: ['Anthropology', 'Ethnology', '民族学'] },
    { id: 'HUM.CUL', domainId: 'HUM', nameZh: '文化遗产与文化产业', aliases: ['Cultural Heritage', '文化产业', '非遗保护'] },
    { id: 'HUM.CLAS', domainId: 'HUM', nameZh: '古典学', aliases: ['Classics', '古典文献学', '版本学'] },

    // ======================== 社科 (SOC) ========================
    // —— 经济学类 ——
    { id: 'SOC.ECO', domainId: 'SOC', nameZh: '经济学', aliases: ['Economics', 'Econ', '理论经济学', '西方经济学'] },
    { id: 'SOC.AECO', domainId: 'SOC', nameZh: '应用经济学', aliases: ['Applied Economics', '产业经济学', '区域经济', '国际贸易'] },
    { id: 'SOC.FIN', domainId: 'SOC', nameZh: '金融学', aliases: ['Finance', '投资学', '保险学', '金融工程'] },
    // —— 管理学类 ——
    { id: 'SOC.MGT', domainId: 'SOC', nameZh: '工商管理', aliases: ['Business Administration', 'MBA', '企业管理'] },
    { id: 'SOC.PMGT', domainId: 'SOC', nameZh: '公共管理', aliases: ['Public Administration', 'MPA', '行政管理'] },
    { id: 'SOC.MIS', domainId: 'SOC', nameZh: '管理科学与信息系统', aliases: ['Management Information Systems', 'MIS', '信息管理'] },
    { id: 'SOC.ACC', domainId: 'SOC', nameZh: '会计学与审计学', aliases: ['Accounting', 'Audit', '审计', '财务管理'] },
    { id: 'SOC.TM', domainId: 'SOC', nameZh: '旅游管理', aliases: ['Tourism Management', '酒店管理', '旅游'] },
    { id: 'SOC.LM', domainId: 'SOC', nameZh: '图书情报与档案管理', aliases: ['Library Science', '情报学', '档案学', '信息资源管理'] },
    // —— 法学类 ——
    { id: 'SOC.LAW', domainId: 'SOC', nameZh: '法学', aliases: ['Law', 'Legal', '法律', '刑法学', '民商法'] },
    { id: 'SOC.ILAW', domainId: 'SOC', nameZh: '国际法与知识产权', aliases: ['International Law', 'IP Law', '知识产权', '国际法'] },
    // —— 教育学类 ——
    { id: 'SOC.EDU', domainId: 'SOC', nameZh: '教育学', aliases: ['Education', '教育理论', '课程与教学论'] },
    { id: 'SOC.PE', domainId: 'SOC', nameZh: '体育学', aliases: ['Physical Education', 'Sports Science', '体育', '运动训练'] },
    // —— 其他社科 ——
    { id: 'SOC.PSY', domainId: 'SOC', nameZh: '心理学', aliases: ['Psychology', 'Psych', '应用心理', '认知心理'] },
    { id: 'SOC.SOC', domainId: 'SOC', nameZh: '社会学', aliases: ['Sociology', '社会工作', '社工'] },
    { id: 'SOC.POL', domainId: 'SOC', nameZh: '政治学与行政学', aliases: ['Political Science', 'PoliSci', '国际政治', '外交学'] },
    { id: 'SOC.MKT', domainId: 'SOC', nameZh: '市场营销与电子商务', aliases: ['Marketing', '营销', '电子商务', 'E-Commerce'] },
    { id: 'SOC.COMM', domainId: 'SOC', nameZh: '新闻传播学', aliases: ['Communication', 'Journalism', '传媒', '广播电视', '广告学'] },
    { id: 'SOC.MX', domainId: 'SOC', nameZh: '马克思主义理论', aliases: ['Marxism', '马克思主义', '思想政治教育'] },

    // ======================== 艺术 (ART) ========================
    { id: 'ART.DESIGN', domainId: 'ART', nameZh: '设计学', aliases: ['Design', '工业设计', '视觉传达', '产品设计'] },
    { id: 'ART.UX', domainId: 'ART', nameZh: '交互设计与用户体验', aliases: ['UX', 'UI', 'Interaction Design', '用户体验', '人机交互'] },
    { id: 'ART.ENV', domainId: 'ART', nameZh: '环境设计', aliases: ['Environmental Design', '室内设计', '景观设计'] },
    { id: 'ART.FASH', domainId: 'ART', nameZh: '服装与服饰设计', aliases: ['Fashion Design', '服装设计', '时尚'] },
    { id: 'ART.FINE', domainId: 'ART', nameZh: '美术学', aliases: ['Fine Arts', 'Visual Arts', '绘画', '雕塑', '油画', '国画'] },
    { id: 'ART.CALI', domainId: 'ART', nameZh: '书法学', aliases: ['Calligraphy', '书法'] },
    { id: 'ART.MUSIC', domainId: 'ART', nameZh: '音乐与舞蹈学', aliases: ['Music', '舞蹈', '音乐表演', '作曲'] },
    { id: 'ART.THEATER', domainId: 'ART', nameZh: '戏剧与影视学', aliases: ['Theater', 'Film Studies', '戏剧', '表演', '导演', '编剧'] },
    { id: 'ART.ANIM', domainId: 'ART', nameZh: '动画与数字媒体', aliases: ['Animation', 'Digital Media', '动画', '数字媒体艺术', '新媒体'] },
    { id: 'ART.GAME', domainId: 'ART', nameZh: '游戏设计与电子竞技', aliases: ['Game Design', 'GameDev', '游戏开发', '电子竞技'] },
    { id: 'ART.CRAFT', domainId: 'ART', nameZh: '工艺美术', aliases: ['Arts and Crafts', '陶艺', '漆艺'] },
    { id: 'ART.PHO', domainId: 'ART', nameZh: '摄影艺术', aliases: ['Photography', '摄影'] },

    // ======================== 交叉学科 (INTER) ========================
    { id: 'INTER.AIGC', domainId: 'INTER', nameZh: 'AI 生成内容', aliases: ['AIGC', 'Generative AI', '生成式AI'] },
    { id: 'INTER.BIOINF', domainId: 'INTER', nameZh: '生物信息学', aliases: ['Bioinformatics', '计算生物学'] },
    { id: 'INTER.DH', domainId: 'INTER', nameZh: '数字人文', aliases: ['Digital Humanities'] },
    { id: 'INTER.COGS', domainId: 'INTER', nameZh: '认知科学', aliases: ['Cognitive Science', 'CogSci'] },
    { id: 'INTER.SUS', domainId: 'INTER', nameZh: '可持续发展与碳中和', aliases: ['Sustainability', 'ESG', '碳中和', '碳达峰'] },
    { id: 'INTER.DS', domainId: 'INTER', nameZh: '数据科学', aliases: ['Data Science', '数据分析', '商业智能'] },
    { id: 'INTER.HEALTH', domainId: 'INTER', nameZh: '健康科技', aliases: ['HealthTech', 'Digital Health', '医疗科技'] },
    { id: 'INTER.ACFIN', domainId: 'INTER', nameZh: '金融科技与量化投资', aliases: ['Computational Finance', 'Quant', '量化交易', '量化'] },
    { id: 'INTER.XR', domainId: 'INTER', nameZh: 'XR 与元宇宙', aliases: ['VR', 'AR', 'XR', 'Metaverse', '虚拟现实', '增强现实', '元宇宙'] },
    { id: 'INTER.RENEW', domainId: 'INTER', nameZh: '新能源与储能技术', aliases: ['Clean Energy', 'Renewable', '清洁能源', '新能源', '储能'] },
    { id: 'INTER.SPACE', domainId: 'INTER', nameZh: '深空探测与空间科学', aliases: ['Space Science', '空间科学', '深空探测', '卫星'] },
    { id: 'INTER.NATSEC', domainId: 'INTER', nameZh: '国家安全学', aliases: ['National Security', '国家安全', '安全情报'] },
    { id: 'INTER.AREA', domainId: 'INTER', nameZh: '区域国别学', aliases: ['Area Studies', '国别研究', '区域研究'] },
];

/**
 * 3. 旧 Category 向前兼容映射表
 * 
 * 将原先硬编码的 5 个 category 映射到新的一级领域
 */
export const CATEGORY_TO_DOMAIN_MAP: Record<string, DomainId> = {
    'tech': 'ENG',
    'healthcare': 'MED',
    'business': 'SOC',
    'method': 'SCI',
    'other': 'INTER'
};

/**
 * 将系统或 AI 产出的旧 Category 转换成标准 DomainId
 */
export function mapCategoryToDomainId(category: string): DomainId {
    const norm = category.toLowerCase().trim();
    if (CATEGORY_TO_DOMAIN_MAP[norm]) {
        return CATEGORY_TO_DOMAIN_MAP[norm];
    }
    return 'INTER'; // 兜底返回交叉学科
}

/**
 * 从文本匹配规范的 sub_domain_id 及其父级 domain_id
 * (仅基于静态种子数据，服务层还会结合数据库动态查找)
 */
export function matchSubDomainFromStatic(input: string): { subDomainId: string, domainId: string } | null {
    if (!input) return null;
    const lowerInput = input.toLowerCase().trim();

    // 优先完全匹配标准中文名
    const exactNameMatch = SUB_DOMAIN_SEEDS.find(s => s.nameZh.toLowerCase() === lowerInput);
    if (exactNameMatch) return { subDomainId: exactNameMatch.id, domainId: exactNameMatch.domainId };

    // 次优先匹配 alias 同义词
    for (const seed of SUB_DOMAIN_SEEDS) {
        for (const alias of seed.aliases) {
            if (alias.toLowerCase() === lowerInput) {
                return { subDomainId: seed.id, domainId: seed.domainId };
            }
        }
    }

    return null;
}

/**
 * 4. 前端组件辅助工具：获取展示信息
 */
export function getDomainDisplayInfo(domainId?: string, fallbackCategory?: string): DomainMeta {
    // 优先使用传入的 domainId 查找
    if (domainId) {
        const found = DOMAIN_REGISTRY.find(d => d.id === domainId);
        if (found) return found;
    }

    // 尝试通过旧类别映射
    if (fallbackCategory) {
        const mappedId = mapCategoryToDomainId(fallbackCategory);
        const found = DOMAIN_REGISTRY.find(d => d.id === mappedId);
        if (found) return found;
    }

    // 最底线：兜底策略
    return DOMAIN_REGISTRY.find(d => d.id === 'INTER')!;
}
