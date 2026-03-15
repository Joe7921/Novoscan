# Novoscan 开源版（Novoscan-Open）开发上下文

> **最后更新**：2026-03-15
> 本文件供 AI Agent 在每次对话开始时读取，以便快速理解项目背景、定位工作区。

---

## 🎯 项目别名速查（Vibe Coding 快捷定位）

| 你说的关键字 | 对应项目 | 本地路径 | 远程地址 |
|------------|---------|---------|---------|
| **开源版** / open / 社区版 / self-hosted / 自部署 | Novoscan-Open | `D:\Antigravity projects\Novoscan-Open` | github.com/Joe7921/Novoscan |
| **云端版** / cloud / 商业版 / novoscan.cn / next | novoscan-next | `D:\Antigravity projects\novoscan-next` | novoscan.cn (Vercel) |

⚠️ **当用户提到"云端版"相关任务时，请切换到 `novoscan-next` 工作区操作。**
⚠️ **当前文件所在工作区是 Novoscan-Open（开源版）。**

---

## 🧠 新功能 / 新想法归属决策框架（Agent 必读）

**当用户提出任何新功能想法或优化建议时，你必须先按以下决策树判断功能归属，然后主动告知用户影响范围：**

```
用户提出新想法
  │
  ├─ 涉及支付/积分/钱包/签到/推荐/广告/NovoMind/SEO/用户访问控制？
  │   └→ 🔴 云端独有。告知用户："这是云端增值功能，开源版不包含。建议在 novoscan-next 实现，并用 FEATURES.xxx 包裹。"
  │
  ├─ 涉及 Docker/Admin CLI/MockAI/本地部署/Ollama？
  │   └→ 🟢 开源独有。直接在 Novoscan-Open 实现。
  │
  ├─ 涉及 Agent 逻辑/Orchestrator/检索引擎/AI Client/类型系统/评分系统？
  │   └→ 🔵 两端共享核心代码。告知用户："这是共享核心代码，需要在 novoscan-next 先改，测试通过后同步到开源版。"
  │
  ├─ 涉及 UI 组件/新页面/新 API 路由？
  │   └→ ⚠️ 需要判断。问自己：
  │       ├─ 这个功能开源用户需要吗？
  │       │   ├─ 是 → 两端都做，但可能有差异化实现
  │       │   └─ 否 → 云端独有，用 Feature Flag 隔离
  │       └→ 主动询问用户："这个功能是否需要在开源版也提供？如果是，两端实现方式可能有差异。"
  │
  └─ 不确定归属？
      └→ 主动询问用户，并给出你的判断建议
```

**示例思考链路：**
- 用户说"加一个报告导出 PDF 功能" → 🔵 两端共享，需双端同步
- 用户说"加一个会员订阅系统" → 🔴 云端独有，开源版不包含
- 用户说"优化 Docker 启动速度" → 🟢 开源独有
- 用户说"加一个数据可视化大屏" → ⚠️ 需判断，主动询问用户

---

## 项目背景

Novoscan 是一个多智能体驱动的创新评估引擎，分为两个版本：
- **云端商业版**：`D:\Antigravity projects\novoscan-next`（已部署 Vercel，域名 novoscan.cn）
- **开源版**：`D:\Antigravity projects\Novoscan-Open`（GitHub: https://github.com/Joe7921/Novoscan.git）

两个版本共享核心代码（Agent / Orchestrator / 检索引擎 / AI Client / 类型系统），
通过 Feature Flag (`src/config/edition.ts`) 区分功能。开源版默认 `NEXT_PUBLIC_EDITION=open`。

---

## 已完成的工作

### 核心基建
1. ✅ Dockerfile（三阶段 standalone）+ docker-compose.yml（PG16 + Redis7 + healthcheck）
2. ✅ Mock AI 三模式（mock-ai.ts：回放/录制/正常 + 延迟 + 错误率）
3. ✅ 数据库迁移体系（migrations/ 11 个有序 SQL，含 auth_users）
4. ✅ 多模态上传 API（/api/upload：PDF/DOCX/TXT/MD/PNG/JPG/WEBP）
5. ✅ FileAttachment.tsx（点击 + 拖拽 + 预览）
6. ✅ Admin CLI + 管理 API
7. ✅ CI 流水线（.github/workflows/ci.yml：ESLint + 单元测试 + Build + SQL 语法检查 + Rust WASM 构建）
8. ✅ 代码质量工具链（.husky + commitlint + lint-staged）
9. ✅ Vitest 配置 + 4 个测试套件（parseAgentJSON / qualityGuard / debater / orchestrator）

### 数据库抽象层
10. ✅ IDatabase 接口（src/lib/db/IDatabase.ts）
11. ✅ PostgresAdapter 实现（src/lib/db/PostgresAdapter.ts）— select/eq/insert/upsert 参数化查询

### Auth 解耦
12. ✅ auth.config.ts（Edge-safe 配置）+ auth.node.ts（Node.js 专用）
13. ✅ auth-users.ts（独立用户表 CRUD，脱离 Supabase Auth）
14. ✅ migrations/010_auth_users.sql

### 插件生态系统
15. ✅ 插件协议层（src/plugins/types.ts + registry.ts + discovery.ts）
16. ✅ 3 个内置插件 Agent（patent-scout / arxiv-scanner / github-trends，各含 plugin-manifest.json）
17. ✅ 插件市场前端（src/app/marketplace/ + marketplaceService.ts + marketplace-types.ts）
18. ✅ CLI 发布工具（scripts/publish-agent.ts）

### AI 能力
19. ✅ Ollama 本地 AI 支持（PROVIDER_REGISTRY 已注册，健康探测 + 缓存 + 降级链兜底）
20. ✅ 模型降级链：MiniMax → DeepSeek → Kimi → Ollama

### 测试框架
21. ✅ Playwright E2E 测试（playwright.config.ts + tests/ 下 4 个 spec 文件）

### Rust WASM 核心引擎
22. ✅ Rust crate `novoscan-core`（rust/novoscan-core/：score_engine.rs + json_healer.rs，8/8 原生测试通过）
23. ✅ WASM npm 包（pkg/novoscan-core/ Node.js 150KB + pkg/novoscan-core-web/ 浏览器 150KB）
24. ✅ WASM 桥接层（src/lib/wasmBridge.ts：自动检测环境 + TS fallback 降级）
25. ✅ CI rust-wasm job（Rust stable + cargo test + wasm-pack build 双 target + Cargo 缓存）
26. ✅ next.config.js asyncWebAssembly webpack 配置

### 前端组件
22. ✅ ShareButton 报告分享组件
23. ✅ ExportReportButton 报告导出
24. ✅ SelfHostCTA 自部署引导组件
25. ✅ DataSourceCoverage 数据源覆盖可视化

### 云端代码清理
26. ✅ walletService 已删除
27. ✅ chargeForFeature / featureCosts 已全部清除
28. ✅ anonymous_usage 逻辑已清除
29. ✅ /api/skill-check API 路由已删除

### GitHub 运营
30. ✅ Issue 模板（bug_report.yml + feature_request.yml + config.yml）
31. ✅ PR 模板（pull_request_template.md）
32. ✅ FUNDING.yml
33. ✅ Good First Issues 文档（docs/good-first-issues.md）

### 云端版同步基建（在 novoscan-next 完成）
34. ✅ Feature Flag 系统（src/config/edition.ts）— 已在云端版创建
35. ✅ 同步脚本（scripts/sync-to-open.ps1）— 已在云端版创建

---

## 已知 Bug / 技术债

| 优先级 | 描述 | 状态 |
|--------|------|------|
| 🟡 | AI Client 不支持图像多模态 — buildBody 未传 attachments，图像 base64 无法传入 AI API | ❌ 未修复 |
| 🟡 | `src/components/skill-check/` 前端组件残留 — API 已删但 3 个 TSX 组件仍在 | ❌ 待清理 |
| ✅ | Vitest 测试文件缺失 — 已补充 4 个测试套件 | ✅ 已修复 |

---

## 待做任务（按优先级）

### P0 — 必做
1. 在开源版创建 `src/config/edition.ts`（同步云端版已有的版本）
2. 创建 `src/config/cloud-sync.ts`（可选连接云端总库）

### P1 — 短期
3. 补充 Vitest 单元测试文件
4. 清理 skill-check 前端组件残留
5. AI Client 图像多模态支持（attachments 参数透传）

### P2 — 中期
6. README 英文化完善 + Hero GIF
7. Agent 思考气泡 UI 增强
8. 社群运营（贡献者墙 + PR 欢迎 Bot）

### P3 — 远期
9. ✅ 🦀 Rust WASM Phase 1 已完成（评分引擎 + JSON 解析器 WASM 化，双端同步）
10. 🦀 Rust Phase 2（搜索引擎 Rust 微服务）— 待启动

---

## 开源版排除的功能（绝不包含）

支付 / 积分 / 钱包 / 签到 / 推荐 / 广告 / NovoMind / SEO / 百度验证 / 用户访问控制

---

## 技术栈

Next.js 14 / React 18 / TypeScript / Tailwind CSS / Supabase JS（可选） /
Dexie.js / framer-motion / Recharts / Zod / mammoth / pdf-parse /
AI: DeepSeek + MiniMax + Moonshot + Ollama（OpenAI 兼容）
**Rust WASM**: novoscan-core（评分引擎 + JSON 解析器）/ wasm-bindgen / serde_json

---

## 我的规则

1. 必须使用简体中文回复和注释
2. 不要擅自修改项目外观/CSS/UI 风格
3. 严格限制在当前任务范围内，不要动无关代码
4. 可能影响全局架构的操作，先问我同意才执行
5. 完成后给我至少三条优化建议
