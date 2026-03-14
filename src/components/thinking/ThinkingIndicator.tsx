import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/types';
import { Search, Database, GitMerge, Brain, ShieldCheck, GraduationCap, Briefcase, BarChart3, SearchCode, Terminal, ChevronDown, ChevronUp, Swords, Trophy, Shield, Handshake, Scale, Sparkles, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import AgentThinkingBubble from './AgentThinkingBubble';
import LiveStatsBar from './LiveStatsBar';
import SourceTagSlider from './SourceTagSlider';

/* ────────────────────────────── 类型定义 ────────────────────────────── */

interface ThinkingIndicatorProps {
  language: Language;
  query?: string;
  isDataReady?: boolean;
  streamProgress?: {
    globalProgress: number;
    currentLog: string;
    agentProgress: Record<string, { status: string; progress: number }>;
    agentStreams?: Record<string, string>;
    contextData?: any;
    thinkingSnippets?: Record<string, { snippet: string; stats?: any }>;
    liveStats?: { papers: number; competitors: number; webPages: number };
    sourceLabels?: Array<{ label: string; agentId: string; timestamp: number; url?: string }>;
  };
  onComplete?: () => void;
  onCancel?: () => void;
}

/* ────────────────────────────── 阶段 & Agent 配置 ────────────────────────────── */

const STEPS = [
  {
    icon: Search, hex: '#4285F4',
    zh: { title: '全球数据雷达', desc: '全网扫描学术库与实时产业信号' },
    en: { title: 'Global Data Radar', desc: 'Scanning academic & real-time industry signals' },
  },
  {
    icon: Database, hex: '#EA4335',
    zh: { title: '双轨信号沉淀', desc: '分离提取底层技术特征与工程数据' },
    en: { title: 'Dual-Track Deposition', desc: 'Separating technical features & engineering data' },
  },
  {
    icon: GitMerge, hex: '#FBBC05',
    zh: { title: '跨域特征对齐', desc: '比对双轨信号，提取核心断层与共识' },
    en: { title: 'Cross-Domain Alignment', desc: 'Comparing signals for consensus & discrepancies' },
  },
  {
    icon: Brain, hex: '#34A853',
    zh: { title: '多智能体推演', desc: '并行评估技术新颖度与落地潜能' },
    en: { title: 'Multi-Agent Reasoning', desc: 'Parallel evaluation of novelty & potential' },
  },
  {
    icon: ShieldCheck, hex: '#6366f1',
    zh: { title: '全息引力共识', desc: '输出最终可行性评级与防伪证报告' },
    en: { title: 'Holographic Consensus', desc: 'Output final feasibility rating & report' },
  }
];

const AGENTS = [
  { id: 'academic', icon: GraduationCap, color: '#4285F4', zh: '学术评审官', en: 'Academic Reviewer', backendId: 'academicReviewer', zhDesc: '搜索全球论文库对比相似研究', enDesc: 'Searches global paper databases for similar work' },
  { id: 'industry', icon: Briefcase, color: '#EA4335', zh: '产业分析师', en: 'Industry Analyst', backendId: 'industryAnalyst', zhDesc: '扫描产业信号和市场落地情况', enDesc: 'Scans industry signals & market readiness' },
  { id: 'innovation', icon: BarChart3, color: '#FBBC05', zh: '创新评估员', en: 'Innovation Evaluator', backendId: 'innovationEvaluator', zhDesc: '六维雷达模型综合评估创新性', enDesc: '6-dimension radar model for innovation assessment' },
  { id: 'competitor', icon: SearchCode, color: '#34A853', zh: '竞品侦探', en: 'Competitor Detective', backendId: 'competitorDetective', zhDesc: '检索开源生态和竞品技术矩阵', enDesc: 'Searches open-source ecosystem & competitor matrix' },
];

/* ────────────────────────────── 工具函数 ────────────────────────────── */

const LOG_ACTIONS_ZH = [
  '初始化多维矩阵...', '连接学术文献库...', '对齐跨域语义空间...',
  '专利数据比对中...', '扫描SEC公开财报...', '计算创新性评分...',
  '生成融合报告草稿...', '验证参考信号源...',
];
const LOG_ACTIONS_EN = [
  'Initializing matrix...', 'Fetching from vector db...', 'Aligning semantic space...',
  'Agent checking patents...', 'Scanning SEC filings...', 'Computing novelty score...',
  'Drafting synthesis report...', 'Verifying citations...',
];


const BOOT_PHRASES_ZH = [
  '分配分析引擎算力...',
  '建立加密传输通道...',
  '挂载领域知识图谱...',
  '检索全网实时特征...',
  '编译超级系统提示词...',
  '申请高维推理配额...',
  '校验交叉引力模型...',
  '流式解析器就绪...',
  '等待首字返回 (TTFT)...',
  '加载上下文向量缓存...'
];
const BOOT_PHRASES_EN = [
  'Allocating compute resources...',
  'Establishing secure channel...',
  'Mounting domain knowledge graph...',
  'Retrieving real-time data...',
  'Compiling system prompts...',
  'Requesting reasoning quota...',
  'Verifying cross-gravity models...',
  'Stream parser ready...',
  'Waiting for LLM TTFT...',
  'Loading context cache...'
];

/* -- 双轨检索阶段：每个 Agent 专属的雷达扫描日志 -- */
const SEARCH_PHASE_LOGS: Record<string, { zh: string[]; en: string[] }> = {
  academic: {
    zh: [
      '连接 OpenAlex 学术元数据库...',
      '扫描 arXiv 预印本服务器...',
      '查询 CrossRef DOI 引用图谱...',
      '检索 CORE 开放获取论文全文...',
      '解析论文概念标签与引用网络...',
      '聚合四源学术检索结果...',
      '提取高被引论文特征向量...',
      '计算语义相似度矩阵...',
      '统计领域论文年份分布...',
      '分析研究趋势曲线...',
      '比对顶会 / 顶刊发表记录...',
      '构建学术先验知识图...',
    ],
    en: [
      'Connecting to OpenAlex metadata API...',
      'Scanning arXiv preprint server...',
      'Querying CrossRef DOI citation graph...',
      'Retrieving CORE open-access full texts...',
      'Parsing concept tags & citation networks...',
      'Aggregating quad-source academic results...',
      'Extracting highly-cited paper features...',
      'Computing semantic similarity matrix...',
      'Analyzing publication year distribution...',
      'Charting research trend curves...',
      'Cross-referencing top venue records...',
      'Building academic prior-art graph...',
    ],
  },
  industry: {
    zh: [
      '启动 Brave Search 全网雷达...',
      '调用 SerpAPI Google 搜索代理...',
      '扫描微信公众号产业资讯...',
      '解析网页正文与摘要片段...',
      '提取产业信号热度指数...',
      '检索企业官网和产品发布页...',
      '聚合多源搜索引擎结果...',
      '分析市场情绪 (sentiment)...',
      '识别关键产业玩家分布...',
      '扫描知识产权与专利公示...',
      '交叉验证产业落地信号...',
    ],
    en: [
      'Launching Brave Search radar...',
      'Calling SerpAPI Google proxy...',
      'Scanning WeChat industry articles...',
      'Parsing web body text & snippets...',
      'Extracting industry signal heat index...',
      'Retrieving enterprise & product pages...',
      'Aggregating multi-engine search results...',
      'Analyzing market sentiment...',
      'Identifying key industry players...',
      'Scanning IP & patent filings...',
      'Cross-validating industry signals...',
    ],
  },
  competitor: {
    zh: [
      '连接 GitHub REST API v3...',
      '检索开源竞品仓库列表...',
      '分析 Star / Fork 增长曲线...',
      '抓取 README 与技术栈标签...',
      '评估仓库健康度 (Commit 频率)...',
      '识别高影响力贡献者...',
      '比对技术路线差异...',
      '计算开源生态竞争密度...',
      '筛选 5000⭐ 以上标杆项目...',
      '扫描 npm / PyPI 包生态...',
      '构建竞品功能矩阵...',
    ],
    en: [
      'Connecting to GitHub REST API v3...',
      'Retrieving competitor repo listings...',
      'Analyzing Star / Fork growth curves...',
      'Fetching README & tech-stack tags...',
      'Evaluating repo health (commit freq)...',
      'Identifying high-impact contributors...',
      'Comparing tech roadmap differences...',
      'Computing open-source competition density...',
      'Filtering benchmark repos (>5000 stars)...',
      'Scanning npm / PyPI package ecosystem...',
      'Building competitor feature matrix...',
    ],
  },
  innovation: {
    zh: [
      '分配多维评估向量空间...',
      '加载六维创新性雷达模型...',
      '预热 NovoStarchart 评分引擎...',
      '等待上游 Agent 检索数据...',
      '监测学术轨 + 产业轨信号...',
      '编译交叉质疑推理模板...',
      '校验评估维度权重配置...',
      '初始化创新突破检测模型...',
      '构建商业模式评估框架...',
      '准备用户体验分析引擎...',
      '挂载生态网络效应模型...',
    ],
    en: [
      'Allocating multi-dim evaluation vectors...',
      'Loading NovoStarchart 6D radar model...',
      'Warming up scoring engine...',
      'Awaiting upstream agent search data...',
      'Monitoring academic + industry signals...',
      'Compiling cross-challenge templates...',
      'Verifying dimension weight config...',
      'Initializing breakthrough detection model...',
      'Building business model eval framework...',
      'Preparing UX analysis engine...',
      'Mounting network-effect model...',
    ],
  },
};

/* ────────────────────────────── 从 JSON stream 中提取 reasoning ────────────────────────────── */

function extractJsonStringField(raw: string, fieldName: string): string {
  const regex = new RegExp(`"${fieldName}"\\s*:\\s*"`);
  const m = raw.match(regex);
  if (!m) return '';
  const startIdx = m.index! + m[0].length;
  let endIdx = raw.length;
  let i = startIdx;
  while (i < raw.length) {
    if (raw[i] === '\\') { i += 2; continue; }
    if (raw[i] === '"') { endIdx = i; break; }
    i++;
  }
  return raw.slice(startIdx, endIdx)
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '  ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

/** 从原始流式文本中提取可读内容（多层回退） */
function extractReasoning(raw: string): { reasoning: string; agentName: string; currentStep: string } {
  if (!raw || raw.trim().length === 0) {
    return { reasoning: '', agentName: '', currentStep: '' };
  }

  let agentName = '';
  let currentStep = '';
  let reasoning = '';

  const nameMatch = raw.match(/"agentName"\s*:\s*"([^"]*?)"/);
  if (nameMatch) agentName = nameMatch[1];

  // 第一优先：提取 reasoning 字段
  reasoning = extractJsonStringField(raw, 'reasoning');

  // 第二优先：如果 reasoning 为空，尝试提取 analysis 字段
  if (!reasoning.trim()) {
    reasoning = extractJsonStringField(raw, 'analysis');
  }

  // 第三优先：如果仍为空，尝试提取 confidenceReasoning 字段
  if (!reasoning.trim()) {
    reasoning = extractJsonStringField(raw, 'confidenceReasoning');
  }

  // 第四优先（终极回退）：如果所有 JSON 字段都解析不到，
  // 直接从原始文本中提取可读内容（去掉 JSON 语法符号）
  if (!reasoning.trim() && raw.length > 20) {
    // 尝试提取所有 JSON 字符串值中的可读内容
    const stringValues: string[] = [];
    const valueRegex = /"(?:reasoning|analysis|confidenceReasoning|keyFindings|redFlags)"\s*:\s*(?:"([^"]*)|\[([^\]]*))/g;
    let vm;
    while ((vm = valueRegex.exec(raw)) !== null) {
      const val = (vm[1] || vm[2] || '').trim();
      if (val.length > 10) stringValues.push(val);
    }
    if (stringValues.length > 0) {
      reasoning = stringValues.join('\n')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '  ')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    } else {
      // 最终回退：显示原始流式文本的可读部分
      reasoning = raw
        .replace(/[{}\[\]]/g, '')
        .replace(/"\w+"\s*:/g, '')
        .replace(/"/g, '')
        .replace(/,\s*/g, '\n')
        .replace(/\\n/g, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 5)
        .join('\n');
    }
  }

  const stepMatches = reasoning.match(/(?:Step\s*\d|###\s*.+?(?:\n|$))/gi);
  if (stepMatches && stepMatches.length > 0) {
    currentStep = stepMatches[stepMatches.length - 1].replace(/^###\s*/, '').trim();
  }

  return { reasoning, agentName, currentStep };
}

function splitReasoningLines(text: string): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}


/* ────────────────────────────── 子组件：Agent 暗色终端 ────────────────────────────── */
const AgentTerminal = ({ agent, prog, done, streamText, isZh, contextData, agentOutput }: any) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [mountedTime] = useState(Date.now());
  const [isCollapsed, setIsCollapsed] = useState(false);

  const extracted = useMemo(() => extractReasoning(streamText || ''), [streamText]);
  const reasoningLines = useMemo(() => splitReasoningLines(extracted.reasoning), [extracted.reasoning]);
  // 判断是否有实际可展示的推理内容
  const hasDisplayableContent = reasoningLines.length > 0;

  // 自动滚到底部
  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [reasoningLines.length, bootLogs, isCollapsed]);

  // 生成初始等待阶段的动态日志
  // 修复：当 streamText 非空但解析不出可展示内容时，不要停止 boot 日志
  useEffect(() => {
    if (done) return;
    // 只有当 streamText 存在且能解析出可展示内容时才停止 boot 日志
    if (streamText && hasDisplayableContent) return;

    let items: string[] = [];
    let isMock = false;
    if (agent.id === 'academic' && contextData?.academic?.length > 0) {
      items = contextData.academic;
    } else if ((agent.id === 'industry' || agent.id === 'innovation' || agent.id === 'competitor') && (contextData?.industryRepos?.length > 0 || contextData?.industryWeb?.length > 0)) {
      items = [...(contextData.industryRepos || []), ...(contextData.industryWeb || [])];
    } else {
      const agentSearchLogs = SEARCH_PHASE_LOGS[agent.id];
      if (agentSearchLogs) {
        items = isZh ? agentSearchLogs.zh : agentSearchLogs.en;
      } else {
        items = isZh ? BOOT_PHRASES_ZH : BOOT_PHRASES_EN;
      }
      isMock = true;
    }

    const interval = setInterval(() => {
      setBootLogs(prev => {
        if (prev.length > (isMock ? 40 : 6)) return prev;
        const nextPhrase = items[Math.floor(Math.random() * items.length)];
        const prefix = isMock ? '' : (isZh ? '>> 分析检索源: ' : '>> Analyzing Source: ');
        const timeMs = (Date.now() - mountedTime) / 1000;
        return [...prev, `[${timeMs.toFixed(3)}s] ${prefix}${nextPhrase}`];
      });
    }, isMock ? 180 + Math.random() * 420 : 400 + Math.random() * 600);

    return () => clearInterval(interval);
  }, [streamText, done, isZh, mountedTime, prog, contextData, agent.id, hasDisplayableContent]);

  const VISIBLE_LINES = 20;
  const FOCUS_LINES = 6;
  const visibleReasoningLines = reasoningLines.slice(-VISIBLE_LINES);

  // Agent 状态文字
  const statusText = done
    ? (isZh ? '■ 任务完成' : '■ COMPLETED')
    : (streamText && hasDisplayableContent)
      ? (isZh ? '● 推理中...' : '● REASONING...')
      : prog > 0
        ? (isZh ? '◉ 数据检索中...' : '◉ RETRIEVING...')
        : (isZh ? '○ 等待启动...' : '○ STANDBY...');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="rounded-xl flex flex-col overflow-hidden relative"
      style={{
        background: '#ffffff',
        boxShadow: done
          ? `0 0 20px ${agent.color}15, 0 4px 15px rgba(0,0,0,0.06)`
          : '0 2px 12px rgba(0,0,0,0.06)',
        border: `1px solid ${done ? agent.color + '40' : '#e5e7eb'}`,
      }}
    >
      {/* 终端头部：macOS 风格 + Agent 信息 */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between px-3 py-2 w-full cursor-pointer select-none"
        style={{
          background: 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div className="flex items-center gap-2.5">
          {/* macOS 三点 */}
          <div className="flex items-center gap-1.5 mr-1">
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: done ? '#34d058' : '#ff6b6b' }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#f9c74f' }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#52c41a' }} />
          </div>
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${agent.color}15` }}
          >
            <agent.icon className="w-3.5 h-3.5" style={{ color: agent.color }} />
          </div>
          <span className="text-xs font-bold text-gray-700 font-mono">
            {isZh ? agent.zh : agent.en}
          </span>
          {/* #15 Agent 职责说明 */}
          <span className="text-[9px] text-gray-400 hidden md:inline truncate max-w-[180px]">
            {isZh ? agent.zhDesc : agent.enDesc}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {/* 运行状态指示灯 */}
          {!done && (
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: agent.color }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <span
            className="text-[10px] font-mono font-bold tabular-nums"
            style={{ color: done ? '#10b981' : agent.color }}
          >
            {done ? '100%' : `${prog}%`}
          </span>
          {isCollapsed
            ? <ChevronDown className="w-3 h-3 text-gray-400" />
            : <ChevronUp className="w-3 h-3 text-gray-400" />
          }
        </div>
      </button>

      {/* 主体：终端内容 */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              ref={scrollRef}
              className="flex-1 px-3 py-2 h-36 md:h-52 overflow-y-auto text-[11px] md:text-xs leading-relaxed scroll-smooth font-mono"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                background: '#ffffff',
              }}
            >
              <style dangerouslySetInnerHTML={{ __html: `::-webkit-scrollbar { display: none; }` }} />

              {/* 状态行 */}
              <div className="flex items-center gap-2 mb-2 pb-1.5" style={{ borderBottom: '1px solid #f0f0f0' }}>
                <span className="text-[10px] font-mono" style={{ color: done ? '#10b981' : streamText ? agent.color : '#9ca3af' }}>
                  {statusText}
                </span>
                {extracted.currentStep && !done && (
                  <span className="text-[9px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded max-w-[160px] truncate">
                    {extracted.currentStep}
                  </span>
                )}
              </div>

              {/* 无可展示推理内容时：双轨检索雷达扫描日志 */}
              {(!streamText || !hasDisplayableContent) ? (
                <div className="flex flex-col gap-1">
                  {bootLogs.length === 0 ? (
                    <span className="text-gray-400 animate-pulse">
                      <span style={{ color: agent.color }}>$</span> {isZh ? '初始化 Agent 进程...' : 'Initializing agent process...'}
                    </span>
                  ) : (
                    <AnimatePresence>
                      {bootLogs.map((log, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.15 }}
                          className="text-[10px] tracking-tight flex items-start gap-1.5"
                        >
                          <span style={{ color: agent.color, flexShrink: 0 }}>›</span>
                          <span className="text-gray-500">{log}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              ) : (
                /* 有流式数据时：格式化推理展示 */
                <div className="flex flex-col gap-0.5">
                  {visibleReasoningLines.map((line, idx) => {
                    const distFromBottom = visibleReasoningLines.length - 1 - idx;
                    const isFocused = distFromBottom < FOCUS_LINES;
                    const fadeOpacity = isFocused ? 1 : Math.max(0.2, 1 - (distFromBottom - FOCUS_LINES) * 0.1);

                    const isStep = /^(Step\s*\d|###|####|\*\*Step)/i.test(line);
                    const isBullet = /^[-•·]/.test(line);
                    const isScore = /分数|score|评分|rating|novelty/i.test(line);
                    const isMetric = /^\|/.test(line) || /^\d+[.、]/.test(line);

                    let lineColor = '#374151'; // 默认深灰色
                    let fontWeight = 'normal';

                    if (isStep) {
                      lineColor = agent.color;
                      fontWeight = 'bold';
                    } else if (isScore) {
                      lineColor = '#b45309';
                      fontWeight = '600';
                    } else if (isBullet) {
                      lineColor = '#6b7280';
                    } else if (isMetric) {
                      lineColor = '#2563eb';
                    }

                    return (
                      <motion.div
                        key={`${idx}-${line.slice(0, 20)}`}
                        initial={idx === visibleReasoningLines.length - 1 ? { opacity: 0, y: 4 } : false}
                        animate={{ opacity: fadeOpacity, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`${isStep ? 'mt-2 mb-0.5 pl-2' : ''}`}
                        style={{
                          color: lineColor,
                          fontWeight,
                          borderLeft: isStep ? `2px solid ${agent.color}` : 'none',
                          fontSize: isStep ? '11.5px' : '10.5px',
                        }}
                      >
                        {!isStep && <span style={{ color: agent.color, marginRight: '4px', opacity: 0.5 }}>│</span>}
                        {line}
                      </motion.div>
                    );
                  })}

                  {/* 打字光标 */}
                  {!done && hasDisplayableContent && (
                    <motion.span
                      className="inline-block w-1.5 h-3 ml-3 align-middle"
                      style={{ backgroundColor: agent.color }}
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </div>
              )}

              {/* 启动阶段的光标 */}
              {(!streamText || !hasDisplayableContent) && !done && (
                <motion.span
                  className="inline-block w-1.5 h-3 ml-1 align-middle mt-1"
                  style={{ backgroundColor: agent.color }}
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部微型进度条 */}
      <div className="h-[3px] w-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
        <motion.div
          className="h-full"
          style={{
            background: done
              ? 'linear-gradient(90deg, #059669, #10b981)'
              : `linear-gradient(90deg, ${agent.color}80, ${agent.color})`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${prog}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* #11 Agent 摘要预览卡片 — 完成后显示评分 + 关键发现 */}
      <AnimatePresence>
        {done && agentOutput?.output && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="px-3 py-2.5 border-t"
            style={{ borderColor: `${agent.color}20`, background: `${agent.color}06` }}
          >
            {/* 评分 */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {isZh ? '评分' : 'Score'}
              </span>
              <span
                className="text-sm font-black font-mono px-2 py-0.5 rounded-md"
                style={{
                  color: agent.color,
                  backgroundColor: `${agent.color}12`,
                }}
              >
                {agentOutput.output.score ?? '--'}/100
              </span>
            </div>
            {/* 关键发现 */}
            {agentOutput.output.findings?.length > 0 && (
              <div className="flex flex-col gap-1">
                {agentOutput.output.findings.slice(0, 2).map((f: string, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px] text-gray-600 leading-snug">
                    <span className="mt-0.5 flex-shrink-0" style={{ color: agent.color }}>▸</span>
                    <span className="line-clamp-2">{f}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};


/* ────────────────────────────── 子组件：NovoDebate 辩论面板 ────────────────────────────── */

const DEBATE_BOOT_ZH = [
  '检测专家评分分歧度...',
  '计算共识度标准差 (StdDev)...',
  '识别对抗辩论对...',
  '编译辩论 Prompt 模板...',
  '初始化多调用对抗协议...',
  '分配辩论 AI 调用额度...',
  '加载裁判规则引擎...',
  '构建证据交叉验证矩阵...',
  '启动收敛检测模块...',
];
const DEBATE_BOOT_EN = [
  'Detecting expert score divergence...',
  'Computing consensus StdDev...',
  'Identifying adversarial debate pairs...',
  'Compiling debate prompt templates...',
  'Initializing multi-call protocol...',
  'Allocating debate AI call quota...',
  'Loading judge rule engine...',
  'Building evidence cross-validation matrix...',
  'Starting convergence detector...',
];

const DebatePanel = ({ isZh, progress, debateLogs, agentStreams, streamProgress }: {
  isZh: boolean;
  progress: number;
  debateLogs: string[];
  agentStreams: Record<string, string>;
  streamProgress?: ThinkingIndicatorProps['streamProgress'];
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [mountedTime] = useState(Date.now());
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 从 agentStreams 中提取辩论交锋数据
  const debateExchanges = useMemo(() => {
    const exchanges: Array<{
      round: number;
      challenger: string;
      challengerArgument: string;
      defender: string;
      defenderRebuttal: string;
      outcome: string;
      outcomeReasoning: string;
      sessionId: string;
    }> = [];

    // 解析来自 agent_stream 事件的辩论数据
    for (const [key, value] of Object.entries(agentStreams)) {
      if (key.startsWith('debate_') && value) {
        try {
          const parsed = JSON.parse(value);
          if (parsed.debateExchange) {
            exchanges.push({
              ...parsed.debateExchange,
              sessionId: parsed.sessionId || key,
            });
          }
        } catch {
          // agentStreams 中的辩论数据可能还不完整，忽略解析错误
        }
      }
    }
    return exchanges.sort((a, b) => a.round - b.round);
  }, [agentStreams]);

  // 从 streamProgress 中提取 novoDebate 状态
  const debateStatus = useMemo(() => {
    if (!streamProgress?.agentProgress) return 'standby';
    const nd = streamProgress.agentProgress['novoDebate'];
    if (nd) {
      if (nd.status === 'completed') return 'completed';
      if (nd.status === 'running') return 'running';
    }
    // 检查单独的辩论 session 状态
    for (const [key, val] of Object.entries(streamProgress.agentProgress)) {
      if (key.startsWith('debate_') && val.status === 'running') return 'running';
      if (key.startsWith('debate_') && val.status === 'completed') return 'completed';
    }
    return progress >= 45 ? 'waiting' : 'standby';
  }, [streamProgress, progress]);

  // 自动滚动
  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [bootLogs, debateExchanges.length, debateLogs.length, isCollapsed]);

  // 启动阶段日志
  useEffect(() => {
    if (debateStatus === 'completed' || debateExchanges.length > 0) return;

    const phrases = isZh ? DEBATE_BOOT_ZH : DEBATE_BOOT_EN;
    const interval = setInterval(() => {
      setBootLogs(prev => {
        if (prev.length >= 15) return prev;
        const timeMs = (Date.now() - mountedTime) / 1000;
        const phrase = phrases[Math.floor(Math.random() * phrases.length)];
        return [...prev, `[${timeMs.toFixed(3)}s] ${phrase}`];
      });
    }, 300 + Math.random() * 500);

    return () => clearInterval(interval);
  }, [debateStatus, debateExchanges.length, isZh, mountedTime]);

  const isDone = debateStatus === 'completed';
  const debateColor = '#8b5cf6'; // 紫色主题

  const outcomeIcon = (outcome: string) => {
    if (outcome === 'challenger_wins') return <Trophy className="w-3 h-3 text-amber-500" />;
    if (outcome === 'defender_wins') return <Shield className="w-3 h-3 text-blue-500" />;
    return <Handshake className="w-3 h-3 text-gray-400" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl flex flex-col overflow-hidden relative"
      style={{
        background: '#ffffff',
        boxShadow: isDone
          ? `0 0 24px ${debateColor}20, 0 4px 18px rgba(0,0,0,0.08)`
          : debateStatus === 'running'
            ? `0 0 16px ${debateColor}12, 0 2px 12px rgba(0,0,0,0.06)`
            : '0 2px 12px rgba(0,0,0,0.06)',
        border: `1px solid ${isDone ? debateColor + '50' : debateStatus === 'running' ? debateColor + '30' : '#e5e7eb'}`,
      }}
    >
      {/* 终端头部 */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between px-3 py-2 w-full cursor-pointer select-none"
        style={{
          background: debateStatus === 'running'
            ? `linear-gradient(180deg, #faf5ff 0%, #f5f3ff 100%)`
            : 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 mr-1">
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: isDone ? '#34d058' : '#ff6b6b' }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#f9c74f' }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#52c41a' }} />
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#faf5ff', color: debateColor, border: '1px solid #ede9fe' }}>⚡ LAYER 2.5</span>
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${debateColor}15` }}
          >
            <Swords className="w-3.5 h-3.5" style={{ color: debateColor }} />
          </div>
          <span className="text-xs font-bold text-gray-700 font-mono">
            NovoDebate {isZh ? '对抗辩论引擎' : 'Adversarial Engine'}
          </span>
          {debateExchanges.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-bold">
              {debateExchanges.length} {isZh ? '轮交锋' : 'rounds'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {!isDone && debateStatus === 'running' && (
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: debateColor }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <span
            className="text-[10px] font-mono font-bold"
            style={{ color: isDone ? '#10b981' : debateStatus === 'running' ? debateColor : '#9ca3af' }}
          >
            {isDone ? (isZh ? '完成' : 'DONE') : debateStatus === 'running' ? (isZh ? '辩论中' : 'DEBATING') : (isZh ? '待触发' : 'STANDBY')}
          </span>
          {isCollapsed
            ? <ChevronDown className="w-3 h-3 text-gray-400" />
            : <ChevronUp className="w-3 h-3 text-gray-400" />
          }
        </div>
      </button>

      {/* 终端内容 */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              ref={scrollRef}
              className="px-3 py-2 h-32 md:h-40 overflow-y-auto text-[11px] md:text-xs leading-relaxed scroll-smooth font-mono"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* 辩论交锋数据 — 最优先展示 */}
              {debateExchanges.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {debateExchanges.map((ex, idx) => (
                    <motion.div
                      key={`${ex.sessionId}-${ex.round}-${idx}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-lg p-2"
                      style={{ backgroundColor: '#faf5ff', border: '1px solid #ede9fe' }}
                    >
                      {/* 轮次标题 */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <Swords className="w-3 h-3" style={{ color: debateColor }} />
                        <span className="text-[10px] font-bold" style={{ color: debateColor }}>
                          {isZh ? `第 ${ex.round} 轮` : `Round ${ex.round}`}
                        </span>
                        <span className="text-[9px] text-gray-400">
                          {ex.challenger} ⚔️ vs 🛡️ {ex.defender}
                        </span>
                        <span className="ml-auto flex items-center gap-1">
                          {outcomeIcon(ex.outcome)}
                          <span className="text-[9px] text-gray-500">
                            {ex.outcome === 'challenger_wins' ? (isZh ? `${ex.challenger} 优胜` : `${ex.challenger} wins`)
                              : ex.outcome === 'defender_wins' ? (isZh ? `${ex.defender} 优胜` : `${ex.defender} wins`)
                                : (isZh ? '平局' : 'Draw')}
                          </span>
                        </span>
                      </div>
                      {/* 挑战方论点 */}
                      <div className="text-[10px] text-red-600 mb-1 pl-2" style={{ borderLeft: '2px solid #ef4444' }}>
                        <span className="font-bold">⚔️ {ex.challenger}：</span>
                        <span className="text-gray-600">{ex.challengerArgument?.slice(0, 120)}{(ex.challengerArgument?.length || 0) > 120 ? '...' : ''}</span>
                      </div>
                      {/* 防守方反驳 */}
                      <div className="text-[10px] text-blue-600 pl-2" style={{ borderLeft: '2px solid #3b82f6' }}>
                        <span className="font-bold">🛡️ {ex.defender}：</span>
                        <span className="text-gray-600">{ex.defenderRebuttal?.slice(0, 120)}{(ex.defenderRebuttal?.length || 0) > 120 ? '...' : ''}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                /* 启动阶段日志 */
                <div className="flex flex-col gap-1">
                  {bootLogs.length === 0 ? (
                    <span className="text-gray-400 animate-pulse">
                      <span style={{ color: debateColor }}>$</span> {isZh ? '等待 Agent 评分结果以判断是否触发辩论...' : 'Waiting for agent scores to determine debate trigger...'}
                    </span>
                  ) : (
                    bootLogs.map((log, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-[10px] tracking-tight flex items-start gap-1.5"
                      >
                        <span style={{ color: debateColor, flexShrink: 0 }}>›</span>
                        <span className="text-gray-500">{log}</span>
                      </motion.div>
                    ))
                  )}
                  {!isDone && (
                    <motion.span
                      className="inline-block w-1.5 h-3 ml-1 align-middle mt-1"
                      style={{ backgroundColor: debateColor }}
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 底部进度条 */}
      <div className="h-[3px] w-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
        <motion.div
          className="h-full"
          style={{
            background: isDone
              ? 'linear-gradient(90deg, #059669, #10b981)'
              : `linear-gradient(90deg, ${debateColor}80, ${debateColor})`,
          }}
          initial={{ width: 0 }}
          animate={{ width: isDone ? '100%' : debateExchanges.length > 0 ? '70%' : debateStatus === 'running' ? '40%' : '15%' }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
};


/* ────────────────────────────── 子组件：Layer 2 创新评估师综合面板 ────────────────────────────── */

const SYNTHESIS_BOOT_ZH = [
  '加载 NovoStarchart 六维雷达模型...',
  '注入学术审查员报告数据...',
  '注入产业分析员报告数据...',
  '注入竞品侦探报告数据...',
  '执行跨领域交叉质疑校验...',
  '计算技术突破维度评分...',
  '计算商业模式维度评分...',
  '计算用户体验维度评分...',
  '计算组织能力维度评分...',
  '计算网络生态维度评分...',
  '计算社会贡献维度评分...',
  '综合三份报告发现矛盾 → 交叉验证...',
  '生成六维创新性雷达图...',
];
const SYNTHESIS_BOOT_EN = [
  'Loading NovoStarchart 6-dimension radar model...',
  'Injecting Academic Reviewer report data...',
  'Injecting Industry Analyst report data...',
  'Injecting Competitor Detective report data...',
  'Running cross-domain validation checks...',
  'Computing Technical Breakthrough score...',
  'Computing Business Model score...',
  'Computing User Experience score...',
  'Computing Org Capability score...',
  'Computing Network Ecosystem score...',
  'Computing Social Impact score...',
  'Detected inter-report conflict → cross-validating...',
  'Generating 6-dimension innovation radar...',
];

const SynthesisPanel = ({ isZh, progress, streamProgress, agentStreams }: {
  isZh: boolean;
  progress: number;
  streamProgress?: ThinkingIndicatorProps['streamProgress'];
  agentStreams: Record<string, string>;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [mountedTime] = useState(Date.now());
  const [isCollapsed, setIsCollapsed] = useState(false);

  const synthColor = '#FBBC05';

  const synthStatus = useMemo(() => {
    if (!streamProgress?.agentProgress) return progress >= 28 ? 'waiting' : 'standby';
    const ie = streamProgress.agentProgress['innovationEvaluator'];
    if (ie) {
      if (ie.status === 'completed' || ie.status === 'timeout') return 'completed';
      if (ie.status === 'running') return 'running';
    }
    return progress >= 28 ? 'waiting' : 'standby';
  }, [streamProgress, progress]);

  const isDone = synthStatus === 'completed';
  const streamText = agentStreams['innovationEvaluator'] || '';

  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [bootLogs, isCollapsed, streamText]);

  useEffect(() => {
    if (isDone || streamText) return;
    const phrases = isZh ? SYNTHESIS_BOOT_ZH : SYNTHESIS_BOOT_EN;
    const interval = setInterval(() => {
      setBootLogs(prev => {
        if (prev.length >= 12) return prev;
        const timeMs = (Date.now() - mountedTime) / 1000;
        const phrase = phrases[Math.min(prev.length, phrases.length - 1)];
        return [...prev, `[${timeMs.toFixed(3)}s] ${phrase}`];
      });
    }, 600 + Math.random() * 400);
    return () => clearInterval(interval);
  }, [isDone, streamText, isZh, mountedTime]);

  const synthProgress = isDone ? 100 : synthStatus === 'running' ? (bootLogs.length / 12) * 80 + 10 : bootLogs.length * 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl flex flex-col overflow-hidden relative"
      style={{
        background: '#ffffff',
        boxShadow: isDone
          ? `0 0 20px ${synthColor}15, 0 4px 15px rgba(0,0,0,0.06)`
          : '0 2px 12px rgba(0,0,0,0.06)',
        border: `1px solid ${isDone ? synthColor + '40' : '#e5e7eb'}`,
      }}
    >
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between px-3 py-2 w-full cursor-pointer select-none"
        style={{
          background: 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 mr-1">
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: isDone ? '#34d058' : '#f9c74f' }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#f9c74f' }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#52c41a' }} />
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${synthColor}15`, color: synthColor }}>LAYER 2</span>
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${synthColor}15` }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: synthColor }} />
          </div>
          <span className="text-xs font-bold text-gray-700 font-mono">
            {isZh ? '创新评估师 · 综合交叉质疑' : 'Innovation Evaluator · Cross-Synthesis'}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {!isDone && synthStatus === 'running' && (
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: synthColor }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <span
            className="text-[10px] font-mono font-bold"
            style={{ color: isDone ? '#10b981' : synthStatus === 'running' ? synthColor : '#9ca3af' }}
          >
            {isDone ? (isZh ? '完成' : 'DONE') : synthStatus === 'running' ? (isZh ? '综合中' : 'SYNTHESIZING') : (isZh ? '等待 L1' : 'WAITING')}
          </span>
          {isCollapsed ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronUp className="w-3 h-3 text-gray-400" />}
        </div>
      </button>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              ref={scrollRef}
              className="px-3 py-2 h-28 md:h-32 overflow-y-auto text-[11px] md:text-xs leading-relaxed scroll-smooth font-mono"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div className="flex flex-col gap-1">
                {bootLogs.length === 0 ? (
                  <span className="text-gray-400 animate-pulse">
                    <span style={{ color: synthColor }}>$</span> {isZh ? '等待 Layer 1 全部专家报告完成...' : 'Waiting for all Layer 1 expert reports...'}
                  </span>
                ) : (
                  bootLogs.map((log, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-[10px] tracking-tight flex items-start gap-1.5"
                    >
                      <span style={{ color: synthColor, flexShrink: 0 }}>›</span>
                      <span className="text-gray-500">{log}</span>
                    </motion.div>
                  ))
                )}
                {!isDone && (
                  <motion.span
                    className="inline-block w-1.5 h-3 ml-1 align-middle mt-1"
                    style={{ backgroundColor: synthColor }}
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-[3px] w-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
        <motion.div
          className="h-full"
          style={{
            background: isDone
              ? 'linear-gradient(90deg, #059669, #10b981)'
              : `linear-gradient(90deg, ${synthColor}80, ${synthColor})`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, synthProgress)}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
};


/* ────────────────────────────── 子组件：Layer 3 仲裁员裁决面板 ────────────────────────────── */

const ARBITRATOR_BOOT_ZH = [
  '载入加权裁决公式...',
  '学术权重 30% · 产业权重 25% · 创新权重 35% · 竞品权重 10%',
  '注入学术审查员最终评分...',
  '注入产业分析员最终评分...',
  '注入创新评估师最终评分...',
  '注入竞品侦探最终评分...',
  '读取 NovoDebate 辩论裁决记录...',
  '读取跨域侦察兵迁移桥梁...',
  '执行加权综合评分计算...',
  '检测评分冲突 → 仲裁解决...',
  '生成推荐等级与战略建议...',
  '输出最终综合评分...',
];
const ARBITRATOR_BOOT_EN = [
  'Loading weighted arbitration formula...',
  'Academic 30% · Industry 25% · Innovation 35% · Competitor 10%',
  'Injecting Academic Reviewer final score...',
  'Injecting Industry Analyst final score...',
  'Injecting Innovation Evaluator final score...',
  'Injecting Competitor Detective final score...',
  'Reading NovoDebate arbitration records...',
  'Reading Cross-Domain Scout migration bridges...',
  'Computing weighted composite score...',
  'Detecting score conflicts → arbitrating...',
  'Generating recommendation level & strategic advice...',
  'Outputting final composite score...',
];

const ArbitratorPanel = ({ isZh, progress, streamProgress }: {
  isZh: boolean;
  progress: number;
  streamProgress?: ThinkingIndicatorProps['streamProgress'];
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [mountedTime] = useState(Date.now());
  const [isCollapsed, setIsCollapsed] = useState(false);

  const arbColor = '#6366f1';

  const arbStatus = useMemo(() => {
    if (!streamProgress?.agentProgress) return progress >= 63 ? 'waiting' : 'standby';
    const arb = streamProgress.agentProgress['arbitrator'];
    if (arb) {
      if (arb.status === 'completed' || arb.status === 'timeout') return 'completed';
      if (arb.status === 'running') return 'running';
    }
    return progress >= 63 ? 'waiting' : 'standby';
  }, [streamProgress, progress]);

  const isDone = arbStatus === 'completed';

  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [bootLogs, isCollapsed]);

  useEffect(() => {
    if (isDone) return;
    const phrases = isZh ? ARBITRATOR_BOOT_ZH : ARBITRATOR_BOOT_EN;
    const interval = setInterval(() => {
      setBootLogs(prev => {
        if (prev.length >= 12) return prev;
        const timeMs = (Date.now() - mountedTime) / 1000;
        const phrase = phrases[Math.min(prev.length, phrases.length - 1)];
        return [...prev, `[${timeMs.toFixed(3)}s] ${phrase}`];
      });
    }, 500 + Math.random() * 600);
    return () => clearInterval(interval);
  }, [isDone, isZh, mountedTime]);

  const arbProgress = isDone ? 100 : arbStatus === 'running' ? (bootLogs.length / 12) * 80 + 10 : bootLogs.length * 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl flex flex-col overflow-hidden relative"
      style={{
        background: '#ffffff',
        boxShadow: isDone
          ? `0 0 24px ${arbColor}18, 0 4px 15px rgba(0,0,0,0.06)`
          : '0 2px 12px rgba(0,0,0,0.06)',
        border: `1px solid ${isDone ? arbColor + '40' : '#e5e7eb'}`,
      }}
    >
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between px-3 py-2 w-full cursor-pointer select-none"
        style={{
          background: 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 mr-1">
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: isDone ? '#34d058' : '#6366f1' }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#f9c74f' }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#52c41a' }} />
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${arbColor}15`, color: arbColor }}>LAYER 3</span>
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${arbColor}15` }}
          >
            <Scale className="w-3.5 h-3.5" style={{ color: arbColor }} />
          </div>
          <span className="text-xs font-bold text-gray-700 font-mono">
            {isZh ? '战略仲裁员 · 最终裁决' : 'Strategic Arbitrator · Final Verdict'}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {!isDone && arbStatus === 'running' && (
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: arbColor }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <span
            className="text-[10px] font-mono font-bold"
            style={{ color: isDone ? '#10b981' : arbStatus === 'running' ? arbColor : '#9ca3af' }}
          >
            {isDone ? (isZh ? '完成' : 'DONE') : arbStatus === 'running' ? (isZh ? '裁决中' : 'ARBITRATING') : (isZh ? '待启动' : 'STANDBY')}
          </span>
          {isCollapsed ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronUp className="w-3 h-3 text-gray-400" />}
        </div>
      </button>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              ref={scrollRef}
              className="px-3 py-2 h-28 md:h-32 overflow-y-auto text-[11px] md:text-xs leading-relaxed scroll-smooth font-mono"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <div className="flex flex-col gap-1">
                {bootLogs.length === 0 ? (
                  <span className="text-gray-400 animate-pulse">
                    <span style={{ color: arbColor }}>$</span> {isZh ? '等待辩论裁决完成...' : 'Waiting for debate verdict...'}
                  </span>
                ) : (
                  bootLogs.map((log, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-[10px] tracking-tight flex items-start gap-1.5"
                    >
                      <span style={{ color: arbColor, flexShrink: 0 }}>›</span>
                      <span className="text-gray-500">{log}</span>
                    </motion.div>
                  ))
                )}
                {!isDone && (
                  <motion.span
                    className="inline-block w-1.5 h-3 ml-1 align-middle mt-1"
                    style={{ backgroundColor: arbColor }}
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-[3px] w-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
        <motion.div
          className="h-full"
          style={{
            background: isDone
              ? 'linear-gradient(90deg, #059669, #10b981)'
              : `linear-gradient(90deg, ${arbColor}80, ${arbColor})`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, arbProgress)}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
};


/* ────────────────────────────── 子组件：Layer 4 质量把关面板 ────────────────────────────── */

const QG_CHECKS_ZH = [
  '评分-推荐等级一致性',
  '维度评分加权验证',
  '证据-结论因果链验证',
  'Agent 置信度交叉核对',
  '辩论修正幅度合规检查',
  '降级标记完整性校验',
  '评分边界合法性验证',
  '最终报告结构完整性',
];
const QG_CHECKS_EN = [
  'Score-Recommendation Consistency',
  'Dimension Weight Validation',
  'Evidence-Conclusion Causality',
  'Agent Confidence Cross-Check',
  'Debate Adjustment Compliance',
  'Fallback Flag Integrity',
  'Score Boundary Legality',
  'Final Report Structural Completeness',
];

const QualityGuardPanel = ({ isZh, progress, streamProgress }: {
  isZh: boolean;
  progress: number;
  streamProgress?: ThinkingIndicatorProps['streamProgress'];
}) => {
  const [checkedItems, setCheckedItems] = useState<number>(0);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const qgColor = '#10b981';
  const checks = isZh ? QG_CHECKS_ZH : QG_CHECKS_EN;

  useEffect(() => {
    if (checkedItems >= checks.length) return;
    const interval = setInterval(() => {
      setCheckedItems(prev => {
        if (prev >= checks.length) return prev;
        return prev + 1;
      });
    }, 250 + Math.random() * 200);
    return () => clearInterval(interval);
  }, [checkedItems, checks.length]);

  const isDone = checkedItems >= checks.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl flex flex-col overflow-hidden relative"
      style={{
        background: '#ffffff',
        boxShadow: isDone
          ? `0 0 16px ${qgColor}18, 0 4px 12px rgba(0,0,0,0.05)`
          : '0 2px 10px rgba(0,0,0,0.05)',
        border: `1px solid ${isDone ? qgColor + '40' : '#e5e7eb'}`,
      }}
    >
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center justify-between px-3 py-2 w-full cursor-pointer select-none"
        style={{
          background: 'linear-gradient(180deg, #f9fafb 0%, #f3f4f6 100%)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 mr-1">
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: isDone ? '#34d058' : '#f9c74f' }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#f9c74f' }} />
            <div className="w-[10px] h-[10px] rounded-full" style={{ backgroundColor: '#52c41a' }} />
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${qgColor}15`, color: qgColor }}>LAYER 4</span>
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${qgColor}15` }}
          >
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: qgColor }} />
          </div>
          <span className="text-xs font-bold text-gray-700 font-mono">
            {isZh ? '质量把关 · 8 项一致性检查' : 'Quality Guard · 8-Point Consistency'}
          </span>
          {checkedItems > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold" style={{
              backgroundColor: isDone ? '#ecfdf5' : '#fef3c7',
              color: isDone ? '#059669' : '#d97706',
            }}>
              {checkedItems}/{checks.length} {isDone ? '✓' : '...'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className="text-[10px] font-mono font-bold"
            style={{ color: isDone ? '#10b981' : '#d97706' }}
          >
            {isDone ? (isZh ? '全部通过' : 'ALL PASSED') : (isZh ? '检查中' : 'CHECKING')}
          </span>
          {isCollapsed ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronUp className="w-3 h-3 text-gray-400" />}
        </div>
      </button>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 py-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                {checks.map((check, idx) => {
                  const isChecked = idx < checkedItems;
                  const isCurrent = idx === checkedItems;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: isChecked || isCurrent ? 1 : 0.3, scale: 1 }}
                      transition={{ duration: 0.2, delay: isChecked ? 0 : 0.05 }}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-mono"
                      style={{
                        backgroundColor: isChecked ? '#ecfdf5' : isCurrent ? '#fef3c7' : '#f9fafb',
                        border: `1px solid ${isChecked ? '#a7f3d0' : isCurrent ? '#fde68a' : '#e5e7eb'}`,
                      }}
                    >
                      {isChecked ? (
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: '#10b981' }} />
                      ) : isCurrent ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Zap className="w-3 h-3 flex-shrink-0" style={{ color: '#d97706' }} />
                        </motion.div>
                      ) : (
                        <div className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" />
                      )}
                      <span className={`truncate ${isChecked ? 'text-emerald-700' : isCurrent ? 'text-amber-700' : 'text-gray-400'}`}>
                        {check}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-[3px] w-full overflow-hidden" style={{ backgroundColor: '#e5e7eb' }}>
        <motion.div
          className="h-full"
          style={{
            background: isDone
              ? 'linear-gradient(90deg, #059669, #10b981)'
              : 'linear-gradient(90deg, #fbbf24, #d97706)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${(checkedItems / checks.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
};


/* ────────────────────────────── 组件本体 ────────────────────────────── */

const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  language,
  query = '',
  isDataReady = false,
  streamProgress,
  onComplete,
  onCancel,
}) => {
  const isZh = language === 'zh';

  /* ───── 状态 ───── */
  const [simProgress, setSimProgress] = useState(0);
  const [simAgentProgress, setSimAgentProgress] = useState({ academic: 0, industry: 0, innovation: 0, competitor: 0 });
  const [simCurrentLog, setSimCurrentLog] = useState('');
  // 平滑进度：避免进度条在层级间跳变/停滞
  const [smoothProgress, setSmoothProgress] = useState(0);

  const progress = streamProgress?.globalProgress || simProgress;
  const currentLog = streamProgress?.currentLog || simCurrentLog;
  const agentStreams = streamProgress?.agentStreams || {};
  const contextData = streamProgress?.contextData || null;

  // 平滑进度插补：在后端进度跳变之间，以匀速爬行保证进度条始终在动
  // 追平后端进度后仍保持极低速微爬，消除"卡住"的视觉错觉
  useEffect(() => {
    // 已完成时直接同步
    if (progress >= 100) {
      setSmoothProgress(100);
      return;
    }
    // 当后端推送的真实进度大于当前平滑值时，立即同步（允许快速追赶）
    if (progress > smoothProgress + 2) {
      setSmoothProgress(progress);
      return;
    }
    // 快速爬行阶段：平滑值还没追上后端值
    if (smoothProgress < progress - 0.5) {
      const timer = setInterval(() => {
        setSmoothProgress(prev => {
          const next = prev + 0.3;
          if (next >= progress - 0.5) {
            clearInterval(timer);
            return progress;
          }
          return next;
        });
      }, 80);
      return () => clearInterval(timer);
    }
    // 微爬阶段：已追平后端进度，以极低速率继续微动（视觉填充）
    // 不超过当前阶段上限（progress + 3%），等待下次后端推送
    const microTimer = setInterval(() => {
      setSmoothProgress(prev => {
        const ceiling = Math.min(progress + 3, 99);
        if (prev >= ceiling) return prev; // 到达微爬上限，停止
        return prev + 0.08;
      });
    }, 200);
    return () => clearInterval(microTimer);
  }, [progress, smoothProgress]);

  // 实际用于渲染的进度值
  const displayProgress = Math.max(smoothProgress, simProgress);

  // L2/L2.5/L3 面板自动滚动 refs
  const synthRef = useRef<HTMLDivElement>(null);
  const debateRef = useRef<HTMLDivElement>(null);
  const arbRef = useRef<HTMLDivElement>(null);
  const qgRef = useRef<HTMLDivElement>(null);

  const agentProgress = useMemo(() => {
    if (isDataReady) {
      return { academic: 100, industry: 100, innovation: 100, competitor: 100 };
    }
    if (streamProgress && Object.keys(streamProgress.agentProgress).length > 0) {
      const sp = streamProgress.agentProgress;
      return {
        academic: sp['academicReviewer'] ? (sp['academicReviewer'].status === 'completed' ? 100 : sp['academicReviewer'].status === 'timeout' ? 100 : 50) : 0,
        industry: sp['industryAnalyst'] ? (sp['industryAnalyst'].status === 'completed' ? 100 : sp['industryAnalyst'].status === 'timeout' ? 100 : 50) : 0,
        competitor: sp['competitorDetective'] ? (sp['competitorDetective'].status === 'completed' ? 100 : sp['competitorDetective'].status === 'timeout' ? 100 : 50) : 0,
        innovation: sp['innovationEvaluator'] ? (sp['innovationEvaluator'].status === 'completed' ? 100 : sp['innovationEvaluator'].status === 'timeout' ? 100 : 50) : 0,
      };
    }
    return simAgentProgress;
  }, [streamProgress, simAgentProgress, isDataReady]);


  /* ───── 回退模拟逻辑 ───── */
  useEffect(() => {
    if (streamProgress) {
      if (progress >= 100 || isDataReady) {
        const t = setTimeout(() => onComplete?.(), 1000);
        return () => clearTimeout(t);
      }
      return;
    }

    let interval: NodeJS.Timeout;
    if (isDataReady) {
      interval = setInterval(() => {
        setSimProgress(p => { if (p >= 100) { clearInterval(interval); setTimeout(() => onComplete?.(), 800); return 100; } return p + 4; });
      }, 30);
    } else {
      interval = setInterval(() => {
        setSimProgress(p => { if (p < 85) { const inc = p < 40 ? 0.8 : p < 70 ? 0.4 : 0.1; return Math.min(85, p + inc); } return p; });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isDataReady, streamProgress, progress, onComplete]);

  /* ───── Agent 进度模拟 ───── */
  useEffect(() => {
    if (streamProgress) return;

    if (simProgress >= 15 && simProgress < 80) {
      const interval = setInterval(() => {
        setSimAgentProgress(prev => ({
          academic: Math.min(100, prev.academic + Math.random() * 5),
          industry: Math.min(100, prev.industry + Math.random() * 4),
          innovation: Math.min(100, prev.innovation + Math.random() * 6),
          competitor: Math.min(100, prev.competitor + Math.random() * 3),
        }));
      }, 100);
      return () => clearInterval(interval);
    } else if (simProgress >= 80) {
      setSimAgentProgress({ academic: 100, industry: 100, innovation: 100, competitor: 100 });
    }
  }, [simProgress, streamProgress]);

  /* ───── 日志模拟 ───── */
  useEffect(() => {
    if (streamProgress || progress >= 100) return;
    const actions = isZh ? LOG_ACTIONS_ZH : LOG_ACTIONS_EN;
    const interval = setInterval(() => {
      setSimCurrentLog(actions[Math.floor(Math.random() * actions.length)]);
    }, 1200 + Math.random() * 600);
    return () => clearInterval(interval);
  }, [progress, streamProgress, isZh]);

  /* ───── 派生 ───── */
  const currentStepIndex = displayProgress >= 100 ? 4 : Math.min(4, Math.floor((displayProgress / 100) * 5));
  const eta = useMemo(() => {
    if (displayProgress >= 100) return 0;
    return Math.max(1, Math.ceil((100 - displayProgress) * 0.35));
  }, [displayProgress]);

  // 计算完成的 Agent 数量
  const completedAgents = Object.values(agentProgress).filter(v => v >= 100).length;

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━ 渲染 ━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center overflow-y-auto pt-4 md:pt-0"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(248,250,252,0.98) 50%, rgba(255,255,255,0.97) 100%)',
      }}
    >

      {/* ── 背景网格 ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }} />

      {/* ── 背景光晕 ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex justify-center items-center">
        <motion.div
          className="w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] rounded-full"
          style={{
            background: `radial-gradient(circle, ${STEPS[currentStepIndex].hex}10, transparent 70%)`,
          }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="w-full max-w-6xl mx-auto flex flex-col z-10 px-3 md:px-8 pb-28 md:pb-8">

        {/* ━━━━ 1. 顶部标题 ━━━━ */}
        <div className="flex flex-col items-center justify-center mb-2 md:mb-6 shrink-0 pt-2 md:pt-4">
          <AnimatePresence mode="popLayout">
            <motion.h2
              key={currentStepIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="text-xl md:text-5xl font-black tracking-tight text-center"
              style={{ color: STEPS[currentStepIndex].hex }}
            >
              {isZh ? STEPS[currentStepIndex].zh.title : STEPS[currentStepIndex].en.title}
            </motion.h2>
          </AnimatePresence>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs md:text-base font-medium mt-1 md:mt-2 text-center max-w-2xl truncate"
            style={{ color: '#6b7280' }}
          >
            <Terminal className="inline-block w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2 mb-0.5" style={{ color: '#9ca3af' }} />
            {isZh ? STEPS[currentStepIndex].zh.desc : STEPS[currentStepIndex].en.desc}
          </motion.p>

          {/* 5步管道指示标签 */}
          <div className="flex items-center gap-1 mt-2 md:mt-4">
            {STEPS.map((step, idx) => {
              const isActive = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;
              return (
                <React.Fragment key={idx}>
                  <motion.div
                    className="flex items-center gap-1 px-2 py-1 rounded-md"
                    animate={{
                      backgroundColor: isActive ? `${step.hex}20` : 'transparent',
                      scale: isActive ? 1.05 : 1,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <step.icon
                      className="w-3 h-3"
                      style={{ color: isActive ? step.hex : isPast ? '#10b981' : '#9ca3af' }}
                    />
                    <span
                      className="text-[10px] font-bold font-mono hidden md:inline"
                      style={{ color: isActive ? step.hex : isPast ? '#10b981' : '#9ca3af' }}
                    >
                      {isZh ? step.zh.title : step.en.title}
                    </span>
                  </motion.div>
                  {idx < STEPS.length - 1 && (
                    <div className="w-4 h-px" style={{ backgroundColor: isPast ? '#10b981' : '#e5e7eb' }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ━━━━ 2. 查询显示 ━━━━ */}
        {query && (
          <div className="text-center mb-2 md:mb-4 shrink-0">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono"
              style={{
                backgroundColor: 'rgba(249,250,251,0.8)',
                border: '1px solid #e5e7eb',
                color: '#374151',
              }}
            >
              <span style={{ color: '#9ca3af' }}>›</span>
              <span className="truncate max-w-md">{isZh ? `正在分析 "${query}"` : `novoscan --analyze "${query}"`}</span>
            </div>
          </div>
        )}

        {/* #9 预估等待时间 + Agent 完成进度 */}
        <div className="flex items-center justify-center gap-3 mb-2 md:mb-4 shrink-0">
          <span className="text-[11px] text-gray-400 font-mono bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
            ⏱ {isZh ? `预计还需 ~${eta}s` : `ETA ~${eta}s`}
          </span>
          <span className="text-[11px] text-gray-400 font-mono bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
            🤖 {completedAgents}/4 {isZh ? '专家已完成' : 'agents done'}
          </span>
          {/* #10 取消分析按钮 */}
          {onCancel && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3 }}
              onClick={onCancel}
              className="text-[11px] text-gray-400 hover:text-red-500 font-medium px-3 py-1 rounded-full border border-gray-200 hover:border-red-200 hover:bg-red-50/50 transition-all duration-200"
            >
              ✕ {isZh ? '取消分析' : 'Cancel'}
            </motion.button>
          )}
        </div>

        {/* ━━━━ 3. Layer 1 — 四个 Agent 终端 (2x2 Grid) ━━━━ */}
        {/* 实时统计条 — 展示已分析文献/竞品/网页数 */}
        <LiveStatsBar
          papers={streamProgress?.liveStats?.papers || 0}
          competitors={streamProgress?.liveStats?.competitors || 0}
          webPages={streamProgress?.liveStats?.webPages || 0}
          language={language}
        />
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
          {AGENTS.map((agent) => {
            const prog = Math.round(agentProgress[agent.id as keyof typeof agentProgress]);
            const done = prog >= 100;
            const streamText = agentStreams[agent.backendId] || '';
            // #11 传递完整 Agent 状态数据（包含 output: { score, analysis, findings, redFlags }）
            const agentOutput = streamProgress?.agentProgress?.[agent.backendId] || null;
            // 思考快照和来源标签
            const thinkingData = streamProgress?.thinkingSnippets?.[agent.backendId];
            const agentSourceLabels = (streamProgress?.sourceLabels || []).filter(l => l.agentId === agent.backendId);

            return (
              <div key={agent.id} className="relative">
                <AgentTerminal
                  agent={agent}
                  prog={prog}
                  done={done}
                  streamText={streamText}
                  isZh={isZh}
                  contextData={contextData}
                  agentOutput={agentOutput}
                />
                {/* 思考气泡 — 展示最新思考片段 */}
                {thinkingData?.snippet && !done && (
                  <AgentThinkingBubble
                    snippet={thinkingData.snippet}
                    agentColor={agent.color}
                  />
                )}
                {/* 来源标签滑入 */}
                {agentSourceLabels.length > 0 && (
                  <SourceTagSlider
                    labels={agentSourceLabels}
                    agentColor={agent.color}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* ━━━━ 3.2 Layer 2 — 创新评估师综合面板 ━━━━ */}
        <AnimatePresence>
          {displayProgress >= 28 && (
            <motion.div
              ref={synthRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full mt-3 shrink-0"
              onAnimationComplete={() => synthRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
            >
              <SynthesisPanel
                isZh={isZh}
                progress={displayProgress}
                streamProgress={streamProgress}
                agentStreams={agentStreams}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ━━━━ 3.5 Layer 2.5 — NovoDebate 辩论面板 ━━━━ */}
        <AnimatePresence>
          {displayProgress >= 40 && (
            <motion.div
              ref={debateRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full mt-3 shrink-0"
              onAnimationComplete={() => debateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
            >
              <DebatePanel
                isZh={isZh}
                progress={displayProgress}
                debateLogs={(() => {
                  // 从 currentLog 和 agentStreams 中提取辩论相关的日志
                  const logs: string[] = [];
                  if (currentLog.includes('[NovoDebate]')) logs.push(currentLog);
                  return logs;
                })()}
                agentStreams={agentStreams}
                streamProgress={streamProgress}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ━━━━ 3.6 Layer 3 — 仲裁员裁决面板 ━━━━ */}
        <AnimatePresence>
          {displayProgress >= 63 && (
            <motion.div
              ref={arbRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full mt-3 shrink-0"
              onAnimationComplete={() => arbRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
            >
              <ArbitratorPanel
                isZh={isZh}
                progress={displayProgress}
                streamProgress={streamProgress}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ━━━━ 3.8 Layer 4 — 质量把关面板 ━━━━ */}
        <AnimatePresence>
          {displayProgress >= 90 && (
            <motion.div
              ref={qgRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full mt-3 shrink-0"
              onAnimationComplete={() => qgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
            >
              <QualityGuardPanel
                isZh={isZh}
                progress={displayProgress}
                streamProgress={streamProgress}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ━━━━ 4. HUD 底部信息栏 ━━━━ */}
        <div className="w-full mt-3 md:mt-6 shrink-0 mb-4 md:mb-0 sticky bottom-0 bg-white/95 md:relative md:bg-transparent py-2 md:py-0 px-1 rounded-t-xl md:rounded-none z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:shadow-none">
          {/* 状态信息行 */}
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <motion.div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: STEPS[currentStepIndex].hex }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentLog}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs md:text-sm font-mono truncate"
                  style={{ color: '#6b7280' }}
                >
                  {currentLog || (isZh ? '系统推演引擎启动中...' : 'System engine starting...')}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Agent 完成计数 */}
              <span className="text-[10px] font-mono hidden md:inline-block" style={{ color: '#9ca3af' }}>
                AGENTS <span style={{ color: completedAgents === 4 ? '#10b981' : '#374151' }} className="font-bold">{completedAgents}/4</span>
              </span>
              <span className="text-xs font-mono hidden md:inline-block" style={{ color: '#9ca3af' }}>
                ETA <span className="font-bold" style={{ color: '#374151' }}>{eta}s</span>
              </span>
              <span
                className="text-xl md:text-2xl font-black tabular-nums font-mono"
                style={{ color: STEPS[currentStepIndex].hex }}
              >
                {Math.round(displayProgress)}%
              </span>
            </div>
          </div>

          {/* 全局主进度条 */}
          <div className="h-2 w-full rounded-full overflow-hidden shadow-inner" style={{ backgroundColor: '#f3f4f6' }}>
            <motion.div
              className="h-full rounded-full relative"
              style={{ background: `linear-gradient(90deg, ${STEPS[0].hex}, ${STEPS[currentStepIndex].hex})` }}
              initial={{ width: 0 }}
              animate={{ width: `${displayProgress}%` }}
              transition={{ duration: 0.4 }}
            >
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.2) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.2) 75%, transparent 75%, transparent)',
                  backgroundSize: '20px 20px',
                  animation: 'hud-stripe 1s linear infinite',
                }}
              />
            </motion.div>
          </div>

          {/* 底部状态文字 */}
          <div className="flex justify-between mt-2 px-1 items-center">
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: '#9ca3af' }}>
              {isZh ? '系统推演引擎执行中 · 多智能体并行协作' : 'System Engine Active · Multi-Agent Parallel'}
            </span>
            <div className="flex items-center gap-1.5">
              {AGENTS.map(a => (
                <div
                  key={a.id}
                  className="w-1.5 h-1.5 rounded-full transition-colors duration-500"
                  style={{
                    backgroundColor: agentProgress[a.id as keyof typeof agentProgress] >= 100 ? '#10b981' : a.color,
                    opacity: agentProgress[a.id as keyof typeof agentProgress] >= 100 ? 1 : 0.4,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ── 全局内联关键帧 ── */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes hud-stripe {
          from { background-position: 0 0; }
          to { background-position: 20px 20px; }
        }
      `}} />
    </div>
  );
};

export default ThinkingIndicator;