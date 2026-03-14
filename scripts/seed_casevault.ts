/**
 * CaseVault 案例库种子数据填充脚本
 *
 * 为 case_library 表注入 10 条高质量 AI 应用案例，
 * 覆盖医疗、自动驾驶、代码生成、智能制造、气象、教育、金融等行业。
 *
 * 执行方式：npx tsx scripts/seed_casevault.ts
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

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

// ─── 哈希生成 ───
function contentHash(text: string): string {
    return createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
}

// ─── 10 条高质量 AI 应用案例 ───
interface CaseSeed {
    title: string;
    summary: string;
    original_content: string;
    source_url: string | null;
    source_type: 'web' | 'github' | 'wechat' | 'clawhub' | 'user_idea';
    industry: string;
    tags: string[];
    capabilities: string[];
    technology_stack: string[];
    deployment_scale: string;
    maturity: 'concept' | 'poc' | 'production' | 'scale';
    quality_score: number;
    author: string | null;
    publish_date: string | null;
}

const SEED_CASES: CaseSeed[] = [
    {
        title: 'AlphaFold 蛋白质结构数据库 — 2亿蛋白质的AI预测结构免费开放',
        summary: 'DeepMind 与 EMBL-EBI 合作，利用 AlphaFold2 AI 系统预测了超过 2 亿种已知蛋白质的 3D 结构，并通过 AlphaFold Protein Structure Database 向全球科研人员免费开放。该数据库覆盖了几乎所有已知的蛋白质，彻底改变了结构生物学的研究模式。',
        original_content: `AlphaFold 蛋白质结构数据库是 DeepMind 与欧洲分子生物学实验室（EMBL-EBI）的联合项目。AlphaFold2 在 CASP14 竞赛中以革命性精度解决了蛋白质结构预测这一 50 年难题。

核心技术：
- 基于 Transformer 的注意力机制，结合进化信息的多序列比对（MSA）
- 端到端的深度学习架构，直接从氨基酸序列预测原子级 3D 坐标
- 迭代优化的 Evoformer 模块处理序列-结构的共进化关系

应用影响：
1. 药物发现：加速靶点识别和药物设计的速度提升 10-100 倍
2. 酶工程：帮助设计用于工业催化和生物燃料的新型酶
3. 疾病研究：揭示遗传疾病相关蛋白质的致病机制
4. 合成生物学：辅助设计全新功能蛋白质

截至 2024 年，全球超过 200 万研究者访问了该数据库。Google DeepMind 进一步推出了 AlphaFold3，将预测范围扩展到蛋白质-小分子、蛋白质-DNA/RNA 复合物的相互作用。`,
        source_url: 'https://alphafold.ebi.ac.uk/',
        source_type: 'web',
        industry: '生物医药',
        tags: ['蛋白质结构预测', 'AI for Science', '开源数据库'],
        capabilities: ['结构预测', '药物发现', '分子模拟'],
        technology_stack: ['Transformer', 'JAX', 'TPU', 'Google Cloud'],
        deployment_scale: '全球 200万+ 研究者使用',
        maturity: 'scale',
        quality_score: 95,
        author: 'DeepMind & EMBL-EBI',
        publish_date: '2024-05',
    },
    {
        title: 'Waymo Driver — 全自动驾驶出租车在旧金山大规模商业运营',
        summary: 'Waymo 的第五代自动驾驶系统在旧金山、凤凰城等城市实现无人驾驶出租车的大规模商业化运营，周均出行量超 10 万次。系统基于多传感器融合和大规模模拟训练，是全球首个真正意义上的 L4 级自动驾驶商业服务。',
        original_content: `Waymo Driver 是 Alphabet 旗下 Waymo 公司研发的第五代自动驾驶系统，目前已在美国多个城市实现全自动（L4）出租车服务。

技术架构：
- 感知系统：29 个摄像头 + 6 个 LiDAR + 6 个雷达 + 外部麦克风组成的 360° 感知套件
- 端到端模型：基于 Transformer 的行为预测和路径规划
- 仿真平台：SurfelGAN 和 Sim Agents 每天模拟数百万英里的驾驶场景
- 定位系统：高精地图 + 实时 SLAM 融合定位

运营成果（2024年数据）：
1. 旧金山 & 凤凰城：周均出行量 >100,000 次
2. 事故率显著低于人类司机（NHTSA 报告）
3. 车队规模 >700 辆 Jaguar I-PACE
4. 用户满意度 4.7/5.0
5. 已扩展至洛杉矶、奥斯汀等新市场

商业模式：通过 Waymo One App 在线叫车，按里程计费，类似传统出租车。与 Uber 合作在多城市上线。`,
        source_url: 'https://waymo.com/waymo-driver/',
        source_type: 'web',
        industry: '出行交通',
        tags: ['自动驾驶', 'L4', 'RoboTaxi'],
        capabilities: ['自动驾驶', '多传感器融合', '路径规划'],
        technology_stack: ['LiDAR', 'Transformer', 'TensorFlow', 'Google Cloud'],
        deployment_scale: '700+ 车队，周均 10万+ 出行',
        maturity: 'scale',
        quality_score: 92,
        author: 'Waymo',
        publish_date: '2024-10',
    },
    {
        title: 'GitHub Copilot — AI 结对编程助手改变软件开发方式',
        summary: 'GitHub Copilot 基于 OpenAI Codex 大模型，在 IDE 中实时生成代码建议。截至 2024 年已有超过 130 万付费用户和 77,000 家企业客户，开发者采纳建议率超 30%，代码编写速度提升 55%。',
        original_content: `GitHub Copilot 是由 GitHub 和 OpenAI 联合开发的 AI 编程助手，于 2022 年正式商用。

核心能力：
- 基于上下文的实时代码补全（支持 20+ 编程语言）
- 自然语言到代码的转译（通过注释描述逻辑）
- 代码解释和文档自动生成
- Chat 模式支持代码审查和调试对话
- Copilot Workspace：从 issue 到 PR 的端到端 AI 辅助

技术栈：
- 底层模型：OpenAI Codex → GPT-4 系列
- IDE 集成：VS Code, JetBrains, Neovim, Xcode
- 企业功能：知识库索引、安全过滤、使用量分析

行业影响（2024年数据）：
1. 1,300,000+ 付费个人用户
2. 77,000+ 企业组织使用
3. 代码编写速度平均提升 55%
4. 采纳建议率 >30%
5. 帮助开发者更快速地完成 boilerplate 和测试代码

挑战：代码质量和安全性审查、版权合规问题、对开发者技能退化的担忧。`,
        source_url: 'https://github.com/features/copilot',
        source_type: 'web',
        industry: '软件开发',
        tags: ['AI编程', '代码生成', 'DevTools'],
        capabilities: ['代码补全', '代码审查', '文档生成'],
        technology_stack: ['GPT-4', 'OpenAI Codex', 'VS Code Extension', 'Azure'],
        deployment_scale: '130万+ 个人用户，7.7万+ 企业',
        maturity: 'scale',
        quality_score: 90,
        author: 'GitHub / OpenAI',
        publish_date: '2024-06',
    },
    {
        title: 'Siemens Industrial Copilot — 西门子工业 AI 副驾驶重塑制造业',
        summary: 'Siemens 与 Microsoft 联合推出 Industrial Copilot，将 GPT-4 与西门子工业软件深度集成，帮助工程师使用自然语言生成 PLC 代码、优化产线配置、预测设备故障。已在多家汽车和电子制造巨头部署。',
        original_content: `Siemens Industrial Copilot 是西门子与微软在 2024 年联合推出的工业 AI 助手，将大语言模型的能力无缝集成到工业自动化的全生命周期。

核心功能模块：
1. PLC 代码生成：工程师用自然语言描述控制逻辑，AI 自动生成 Structured Text / Ladder Diagram
2. 产线优化：基于数字孪生模型，AI 建议最优产线配置和排产策略
3. 预测性维护：分析传感器数据流，提前识别设备异常和潜在故障
4. 质量控制：视觉检测 + AI 分析，实时优化产品良率
5. 知识管理：将工程经验编码为可检索的知识库

技术架构：
- Azure OpenAI (GPT-4) + Siemens Xcelerator 平台
- Mendix 低代码平台构建工业应用
- MindSphere IoT 数据采集和分析
- Teamcenter 产品全生命周期管理

已落地案例：
- 某德国汽车零部件厂：PLC 编程效率提升 40%
- 某亚洲电子制造商：设备意外停机减少 30%
- 工程变更响应时间从数小时缩短至分钟级`,
        source_url: 'https://www.siemens.com/industrial-copilot',
        source_type: 'web',
        industry: '智能制造',
        tags: ['工业AI', 'PLC自动编程', '数字孪生'],
        capabilities: ['代码生成', '预测性维护', '产线优化'],
        technology_stack: ['GPT-4', 'Azure', 'Siemens Xcelerator', 'MindSphere'],
        deployment_scale: '多家全球制造业巨头部署',
        maturity: 'production',
        quality_score: 88,
        author: 'Siemens AG',
        publish_date: '2024-04',
    },
    {
        title: 'Google GraphCast — AI 天气预测超越传统数值模拟',
        summary: 'Google DeepMind 的 GraphCast 模型使用图神经网络在单台 TPU 上用不到 1 分钟预测 10 天全球天气，准确率超越 ECMWF 的传统数值天气预报系统 HRES。已被多国气象机构试验性部署。',
        original_content: `GraphCast 是 Google DeepMind 于 2023 年底在 Science 上发表的 AI 天气预测模型，标志着机器学习在中期天气预报领域首次全面超越传统物理方法。

技术原理：
- 基于图神经网络（GNN）的消息传递架构
- 将地球大气离散化为百万级网格节点
- 使用 39 年的 ERA5 再分析数据训练
- 输入：当前 + 前 6 小时的大气状态（温度、湿度、风场等 227 个变量）
- 输出：未来 10 天的 6 小时间隔逐步预测

性能指标（与 ECMWF HRES 对比）：
1. 在 90% 的标准评估指标上优于 HRES
2. 预测时间从数小时缩短到 <1 分钟（单台 TPU）
3. 极端天气事件追踪准确率显著提升
4. 能耗降低 1000 倍以上

后续发展：
- Google 推出 GenCast：概率性集合预报, 在 97% 的指标上超越 ENS
- 华为盘古气象：类似基于 Transformer 的竞品
- ECMWF 自身开始开发 AIFS（AI 预报系统）
- 模型已开源，可在 Google Cloud 上运行`,
        source_url: 'https://deepmind.google/discover/blog/graphcast-ai-model-for-faster-and-more-accurate-global-weather-forecasting/',
        source_type: 'web',
        industry: '气象科学',
        tags: ['AI气象', '图神经网络', '天气预报'],
        capabilities: ['天气预测', '极端天气追踪', '气候分析'],
        technology_stack: ['图神经网络', 'JAX', 'TPU', 'ERA5数据'],
        deployment_scale: '多国气象机构试验部署',
        maturity: 'production',
        quality_score: 93,
        author: 'Google DeepMind',
        publish_date: '2024-01',
    },
    {
        title: 'Khan Academy Khanmigo — AI 个性化辅导改变 K-12 教育',
        summary: 'Khan Academy 基于 GPT-4 构建的 AI 辅导助手 Khanmigo，通过苏格拉底式对话引导学生自主解题，而非直接给出答案。已在美国 1 万多所学校部署，为教师节省大量个性化辅导时间。',
        original_content: `Khanmigo 是 Khan Academy 与 OpenAI 合作开发的 AI 教育助手，于 2023 年发布。它革新了在线教育的个性化体验。

核心特色：
1. 苏格拉底式引导：当学生求助时，AI 不直接给出答案，而是通过提问引导学生思考
2. 动态难度调节：根据学生答题表现实时调整题目难度和解释深度
3. 多学科覆盖：数学、科学、编程、写作、历史、SAT 备考
4. 教师仪表板：教师可查看 AI 与学生的对话摘要，了解痛点
5. 写作教练：提供思路启发和结构化写作指导

技术实现：
- 底层模型：GPT-4 + 定制微调
- 安全机制：严格的内容过滤和年龄适配对话策略
- 学习记忆：记住学生历史表现，提供连贯的个性化体验
- 与 Khan Academy 课程库深度集成

影响数据（2024年）：
- 部署至 14,000+ 美国学校
- 数学学科正确率提升 14%（对照实验）
- 教师每周节省 5+ 小时个性化辅导时间
- 学生参与度提升 32%`,
        source_url: 'https://www.khanmigo.ai/',
        source_type: 'web',
        industry: '教育',
        tags: ['教育AI', '个性化辅导', 'K-12'],
        capabilities: ['自适应学习', '对话式辅导', '学情分析'],
        technology_stack: ['GPT-4', 'React', 'Node.js', 'Khan Academy平台'],
        deployment_scale: '14,000+ 学校, 数百万学生',
        maturity: 'production',
        quality_score: 87,
        author: 'Khan Academy',
        publish_date: '2024-08',
    },
    {
        title: 'Ant Group 智能风控 — 蚂蚁集团 AI 实时反欺诈系统',
        summary: '蚂蚁集团的智能风控系统利用图计算和实时机器学习，在 100 毫秒内完成交易风险评估，每日处理超 10 亿笔交易。系统准确率 >99.9%，资损率控制在十万分之一以下，是全球最大规模的实时 AI 风控系统之一。',
        original_content: `蚂蚁集团的智能风控系统是全球金融科技领域最先进的 AI 反欺诈基础设施之一，守护着支付宝超过 10 亿用户的交易安全。

技术架构：
1. 实时特征引擎：毫秒级提取 3000+ 维用户行为特征
2. 图计算网络：基于 GeaFlow 的动态图分析，识别团伙欺诈
3. 多模态模型：结合行为序列、设备指纹、社交图谱的深度学习
4. 联邦学习：与银行侧数据联合建模，不暴露原始数据
5. 可解释 AI：为风控决策提供人可读的理由（监管合规）

核心指标（2024年公开数据）：
- 日均处理交易：10+ 亿笔
- 风险判定延迟：<100ms
- 综合准确率：>99.9%
- 资损率：<0.001%（十万分之一）
- 每年阻止欺诈金额：千亿级人民币

模型迭代周期：
- 数据更新：实时流式
- 模型在线更新：分钟级
- 策略规则更新：小时级
- 全量模型重训练：每日

开源贡献：
- Apache TuGraph：高性能图数据库
- GraphScope：大规模图计算引擎`,
        source_url: null,
        source_type: 'web',
        industry: '金融科技',
        tags: ['风控', '反欺诈', '实时AI'],
        capabilities: ['实时风控', '图计算', '联邦学习'],
        technology_stack: ['图神经网络', 'GeaFlow', 'OceanBase', 'PyTorch'],
        deployment_scale: '日均 10亿+ 笔交易',
        maturity: 'scale',
        quality_score: 91,
        author: '蚂蚁集团',
        publish_date: '2024-03',
    },
    {
        title: 'Insilico Medicine — 全 AI 设计的抗纤维化药物进入 II 期临床',
        summary: 'Insilico Medicine 利用生成式 AI（PandaOmics + Chemistry42）从靶点发现到分子设计全流程 AI 驱动，将新药研发周期从 4-5 年压缩到 18 个月，候选药物 INS018_055 已进入 II 期临床试验。',
        original_content: `Insilico Medicine 是全球首家利用生成式 AI 从零开始设计候选药物并推进至临床 II 期的公司。

AI 药物发现平台：
1. PandaOmics：基于多组学数据的靶点发现引擎
   - 整合基因组、转录组、蛋白质组数据
   - AI 评估靶点的可成药性和疾病关联性
2. Chemistry42：生成式分子设计平台
   - 基于扩散模型和强化学习生成全新分子结构
   - 自动优化 ADMET 属性（吸收、分布、代谢、排泄、毒性）
3. inClinico：临床试验预测和优化

标杆案例 INS018_055（抗 IPF 纤维化）：
- 靶点发现：AI 识别 TNIK 为新型抗纤维化靶点（30 天）
- 分子设计：Chemistry42 生成并筛选 >10,000 分子（60 天）
- 临床前验证：活性、安全性确认（12 个月）
- I 期临床：安全性和 PK 验证通过（2023）
- II 期临床：在中国和美国同步进行（2024）
- 总时间线：18 个月（传统需 4-5 年）

对比传统流程：
| 阶段 | 传统 | AI 加速 |
|---|---|---|
| 靶点发现 | 12-24月 | 1月 |
| 先导化合物 | 24-36月 | 2月 |
| 优化到候选 | 12-18月 | 10月 |
| 总计 | 4-6年 | ~18月 |`,
        source_url: 'https://insilico.com/',
        source_type: 'web',
        industry: '生物医药',
        tags: ['AI药物发现', '生成式分子设计', '临床试验'],
        capabilities: ['靶点发现', '分子生成', '临床预测'],
        technology_stack: ['扩散模型', '强化学习', 'GNN', 'AWS'],
        deployment_scale: '2+ 管线进入临床试验',
        maturity: 'production',
        quality_score: 89,
        author: 'Insilico Medicine',
        publish_date: '2024-07',
    },
    {
        title: 'Figure 02 + OpenAI — 大模型驱动的人形机器人进入宝马工厂',
        summary: 'Figure AI 与 OpenAI 合作，将 GPT-4V 多模态能力接入 Figure 02 人形机器人，实现自然语言指令理解和复杂装配任务执行。2024 年已在宝马斯帕坦堡工厂进行初步试生产测试。',
        original_content: `Figure AI 是一家美国人形机器人初创公司，其最新产品 Figure 02 与 OpenAI 的深度合作标志着具身智能（Embodied AI）从实验室走向工业应用。

技术融合：
1. 视觉-语言模型：GPT-4V 提供场景理解和自然语言指令解析
2. 运动控制：端到端的强化学习 + 模仿学习运动策略
3. 精细操控：双臂 16 自由度灵巧手，力控精度达 0.1N
4. 自主导航：基于视觉的 SLAM + 语义地图
5. 安全系统：多层冗余安全机制，人机共存工作区

Figure 02 技术参数：
- 身高：1.7m / 体重：60kg
- 负载能力：双手各 25kg
- 续航：5 小时连续作业
- 行走速度：1.2 m/s

宝马工厂试点（2024年）：
- 任务：汽车钣金件分拣和装配工位物料供给
- 一次成功率：>85%（对比初始版本 60%）
- 人类监督比例：1 人监督 3 台机器人
- 评估结论：距离全面部署仍需 1-2 年优化

融资和估值：
- B 轮融资 6.75 亿美元，估值 26 亿美元
- 投资方：Microsoft, OpenAI, NVIDIA, Jeff Bezos
- 目标：2025 年实现小规模商业化`,
        source_url: 'https://www.figure.ai/',
        source_type: 'web',
        industry: '智能制造',
        tags: ['人形机器人', '具身智能', '工业自动化'],
        capabilities: ['视觉语言理解', '灵巧操控', '自主导航'],
        technology_stack: ['GPT-4V', '强化学习', 'ROS2', 'NVIDIA Isaac'],
        deployment_scale: '宝马工厂试点',
        maturity: 'poc',
        quality_score: 85,
        author: 'Figure AI',
        publish_date: '2024-09',
    },
    {
        title: 'NVIDIA Clara — 联邦学习赋能跨医院 AI 诊断协同训练',
        summary: 'NVIDIA Clara 联邦学习框架使全球 20+ 家医院在不共享患者数据的前提下协同训练医疗影像 AI 模型。在脑肿瘤分割任务中，联邦训练模型的性能接近集中式训练的 99%，同时完全保护了患者隐私。',
        original_content: `NVIDIA Clara 是 NVIDIA 专为医疗 AI 打造的端到端计算平台，其联邦学习（Federated Learning）模块是解决医疗数据孤岛问题的标杆方案。

联邦学习架构：
1. 本地训练：各医院在本地 GPU 上使用自有数据训练模型
2. 梯度聚合：仅上传模型参数更新（非原始数据）到中央聚合器
3. 隐私保护：差分隐私机制确保单患者数据不可逆推
4. 异构处理：自动处理不同医院的数据分布差异

EXAM 研究（Nature Medicine 2024 发表）：
- 参与方：20 家国际医疗机构（6 大洲）
- 任务：COVID-19 胸部 CT 严重度预测
- 结果：联邦模型在平均 AUC 上达到 0.96（接近集中训练的 0.97）
- 对比：各医院单独训练的本地模型 AUC 仅 0.82-0.91

脑肿瘤分割（FeTS 2024）：
- 33 家机构参与
- 联邦训练 Dice Score 达 0.87（集中训练 0.88）
- 各机构本地训练仅 0.75-0.83

商业化路线：
- BioNeMo 平台：AI 辅助新药研发
- MONAI 开源框架：医疗影像 AI 标准化工具链
- DGX-H100 定制化部署方案`,
        source_url: 'https://www.nvidia.com/en-us/clara/',
        source_type: 'web',
        industry: '医疗AI',
        tags: ['联邦学习', '医疗影像', '隐私计算'],
        capabilities: ['联邦训练', '医学影像分析', '隐私保护'],
        technology_stack: ['NVIDIA Clara', 'MONAI', 'PyTorch', 'DGX'],
        deployment_scale: '20+ 国际医疗机构',
        maturity: 'production',
        quality_score: 90,
        author: 'NVIDIA',
        publish_date: '2024-02',
    },
];

// ─── 执行注入 ───
async function main() {
    console.log('\n📚 ═══════════════════════════════════════════');
    console.log('   CaseVault 案例库种子数据注入');
    console.log('═══════════════════════════════════════════════\n');
    console.log(`📊 共 ${SEED_CASES.length} 条案例待注入`);
    console.log(`🔗 Supabase: ${supabaseUrl}\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const c of SEED_CASES) {
        const hash = contentHash(c.title + c.summary);

        const row = {
            title: c.title,
            summary: c.summary,
            original_content: c.original_content,
            source_url: c.source_url,
            source_type: c.source_type,
            industry: c.industry,
            tags: c.tags,
            capabilities: c.capabilities,
            technology_stack: c.technology_stack,
            deployment_scale: c.deployment_scale,
            maturity: c.maturity,
            quality_score: c.quality_score,
            content_hash: hash,
            author: c.author,
            publish_date: c.publish_date,
        };

        const { error } = await supabase
            .from('case_library')
            .upsert(row, { onConflict: 'content_hash' });

        if (error) {
            console.error(`  ❌ ${c.title.slice(0, 40)}... — ${error.message}`);
            errorCount++;
        } else {
            console.log(`  ✅ ${c.title.slice(0, 50)}...`);
            successCount++;
        }
    }

    console.log('\n' + '═'.repeat(50));
    console.log(`📊 结果: 成功 ${successCount} | 失败 ${errorCount}`);

    // 验证总行数
    const { count, error: countErr } = await supabase
        .from('case_library')
        .select('*', { count: 'exact', head: true });

    if (!countErr) {
        console.log(`📦 case_library 表当前总行数: ${count}`);
    } else {
        console.log(`⚠️  查询行数失败: ${countErr.message}`);
    }

    console.log('\n🎉 案例库种子数据注入完成！\n');
}

main().catch(err => {
    console.error('💥 脚本执行失败:', err);
    process.exit(1);
});
