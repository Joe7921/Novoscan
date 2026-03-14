# Novoscan 双端同步开发 — 开源版（Novoscan-Open）开发上下文

## 项目背景

Novoscan 是一个多智能体驱动的创新评估引擎，分为两个版本：
- **云端商业版**：`D:\Antigravity projects\novoscan-next`（已部署 Vercel，域名 novoscan.cn）
- **开源版**：`D:\Antigravity projects\Novoscan-Open`（GitHub: https://github.com/Joe7921/Novoscan.git）

两个版本共享核心代码（Agent / Orchestrator / 检索引擎 / AI Client / 类型系统），
通过 Feature Flag (`src/config/edition.ts`) 区分功能。开源版默认 NEXT_PUBLIC_EDITION=open。

## 已完成的工作

1. ✅ Dockerfile（三阶段 standalone）+ docker-compose.yml（PG16 + Redis7 + healthcheck）
2. ✅ Vitest（5 个测试：qualityGuard / orchestrator / debater / parseAgentJSON / bizscan）
3. ✅ Mock AI 三模式（mock-ai.ts：回放/录制/正常 + 延迟 + 错误率）
4. ✅ 数据库迁移（migrations/ 9 个有序 SQL + README）
5. ✅ 多模态上传 API（/api/upload：PDF/DOCX/TXT/MD/PNG/JPG/WEBP）
6. ✅ FileAttachment.tsx（点击 + 拖拽 + 预览）
7. ✅ Admin CLI + 14 个管理 API
8. ✅ CI（ESLint + Build + SQL 语法检查 pgFormatter）
9. ✅ 代码质量（husky + commitlint + lint-staged）

## 已知 Bug（可能已被其他分身修复，先用 git status 检查）

1. 🔴 callAIRaw 参数错位 — academicReviewer.ts / competitorDetective.ts 传 13 参给 9 参函数
2. 🟡 analyze/route.ts 第 142 行 `charge` 未定义（云端积分残留）
3. 🟡 AI Client buildBody 不传 attachments（图像多模态不工作）

## 开源版待做任务

### P0（发布前）
1. 创建 `src/config/edition.ts`（Feature Flag：IS_OPEN / FEATURES 常量）
2. 创建 `src/config/cloud-sync.ts`（可选连接云端总库）
3. Git 首次推送到 https://github.com/Joe7921/Novoscan.git
4. 创建 `scripts/sync-to-open.ps1` 同步脚本

### P1（第一周）
5. README 英文重写 + Hero GIF
6. 首页 Flash Playground（3 个示例按钮 + 免注册体验）
7. 报告分享系统（OG 图 + 公开链接 + 分享按钮）
8. Agent 思考气泡 UI
9. GitHub Issue/PR 模板 + Good First Issues × 5

### P2（2-4 周）
10. 插件化框架（INovoAgent / ISearchProvider 接口 + Agent Registry）
11. Ollama 本地 AI 支持
12. 社群运营（贡献者墙 + PR 欢迎 Bot）

## 开源版排除的功能（绝不包含）

支付 / 积分 / 钱包 / 签到 / 推荐 / 广告 / NovoMind / SEO / 百度验证 / 用户访问控制

## 技术栈

Next.js 14 / React 18 / TypeScript / Tailwind CSS / Supabase JS（可选） /
Dexie.js / framer-motion / Recharts / Zod / mammoth / pdf-parse /
AI: DeepSeek + MiniMax + Moonshot + Ollama（OpenAI 兼容）

## 我的规则

1. 必须使用简体中文回复和注释
2. 不要擅自修改项目外观/CSS/UI 风格
3. 严格限制在当前任务范围内，不要动无关代码
4. 可能影响全局架构的操作，先问我同意才执行
5. 完成后给我至少三条优化建议
