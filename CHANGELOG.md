# 变更日志 | Changelog

本项目遵循 [语义化版本控制](https://semver.org/lang/zh-CN/)。

## [1.0.0] — 2026-03-14

### 🎉 首次开源发布

Novoscan 正式以 Apache 2.0 许可证开源！三大业务板块完全开放。

#### ✨ 核心功能

- **Novoscan 创新查重**：5+1+1 多智能体协同决策，双轨七源检索引擎
- **Bizscan 商业评估**：AI 驱动的创业想法商业可行性综合评估
- **Clawscan 技能查重**：技能/履历创新性检验与评估

#### 🤖 Agent 系统

- 学术审查员、产业分析员、竞品侦探、创新评估师、仲裁员、质量守卫
- 分层执行拓扑（Layer1 并行 → Layer2 串行 → Layer3 仲裁 → Layer4 校验）
- 智能 Fallback 评估（基于统计特征，替代固定分数）
- Agent 超时控制 + AbortController 取消机制

#### 🔍 检索引擎

- 学术四源：OpenAlex、arXiv、CrossRef、CORE
- 产业三源：Brave Search、SerpAPI、GitHub API
- 交叉验证与可信度计算

#### 🧠 AI 模型

- 多模型降级链（MiniMax → DeepSeek V3 → Kimi）
- 双层信号量并发控制
- NDJSON 流式实时传输

#### 🌟 生态模块

- Novoscan Flash — 极速降维模式
- NovoDiscover — 跨域创新探索
- NovoDebate — 对抗性辩论引擎
- NovoDNA — 创新基因图谱
- NovoMind — 创新人格评测
- NovoTracker — 趋势监控与推送
- MCP 远程服务 — Claude/Cursor/ChatGPT 直接调用

#### 🛠️ 基础设施

- IndexedDB (Dexie.js) 本地结构化缓存
- localStorage 智能缓存（24h TTL）
- FinOps 监控大盘
- Admin CLI 管理工具
- Vercel Cron 定时任务 + Webhook 通知
- PWA 支持
