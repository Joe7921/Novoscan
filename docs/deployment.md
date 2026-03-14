# 系统部署指南 (Deployment Guide)

Novoscan-Next 基础骨架被设计为无缝部署在以 Vercel 为代表的主流 Serverless 云控制台平台，且同样具备轻松友好的开箱即用直接本地启动体验。

## 1. 运行系统环境基线需求
- **执行宿主运行时环境 Node.js**: >= 18.17.0
- **依赖安装包管理器选型**: npm, yarn, pnpm (由锁文件控制) 或 bun
- **执行核心验证密钥集**: 必须配置 Gemini API, SerpApi (跨站调用免鉴权搜索 API), （若需全面持久化远端共享记录则挂载配置 Supabase ;默认采用 IndexedDB `Dexie.js` 执行不掉线本地会话缓存）

## 2. 环境隐藏变量注入清单设置 (`.env.local`)
请在工程根目录建立环境副本隐藏文件并配置如下敏感令牌信息鉴权节点：
```env
# Google Gemini 核心人工智能基建密钥 (必须项目)
GEMINI_API_KEY=your_gemini_api_key_here

# DeepSeek AI 模型密钥 (必须项目)
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 外部搜索引擎与学术数据库联动令牌 (深度数据源整合项目)
SERPAPI_API_KEY=your_serpapi_api_key_here
BRAVE_API_KEY=your_brave_api_key_here
CORE_API_KEY=your_core_api_key_here
GITHUB_TOKEN=your_github_token_here

# Supabase 云端持久化 (可选)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Cron 定时任务
CRON_SECRET=your_cron_secret_here

# Cron Webhook 通知推送（可选，留空则不推送）
# 支持飞书 / Slack / 企业微信 / 自定义 URL，系统根据 URL 自动识别平台格式
CRON_WEBHOOK_URL=
```

## 3. 本地构建开发流与联调动作
1. 完整加载拉取包依赖：
   ```bash
   npm install
   ```
2. 启动具备前端热刷新 (HMR, Hot Module Replacement) 能力的本地开发测试服务器：
   ```bash
   npm run dev
   ```
3. Typescript 强类型编译器静态验证阻截报错（部署交付合并分支阶段强制检查前置动作）：
   ```bash
   npm run build
   ```

## 4. Vercel 控制台一键云端派发部署建议策略 (推荐首选)

本系统源码作为纯正的 Next.js 工程结构标准体系被创立，已针对 Vercel 面向边缘网络架构（Edge Network Regions）节点的执行函数机制做了彻底包容预热与融合处理体系设置。

1. **推送当前可用系统发行版代码分支至 GitHub 中央远端仓库**。
2. 通过 GitHub Oauth 接入登录至 Vercel 管理视窗面板终端首屏，选择 **Add New Project**。
3. 从关联列表中搜寻同步载入当前持有的项目库 `novoscan-next` 仓库。
4. 在 Vercel Settings / Environment Variables 工程级别配置栏中，安全地拷贝填入环境变量组合令牌列表 (参照对应本地 `.env` 内部的格式逐行黏贴)。
5. 单击高亮执行区按钮 **Deploy**，经历平均约时长为 2-3 分钟的云端持续集成流管道组装流转后，系统骨架即可在目标全球 CDN 边缘节点发布分布部署完毕，并自动向公网分配合法合规携带 SSL 免签发的受控生产级 HTTPS 主干顶级分发网 URL。

## 5. Vercel Cron 定时任务配置

系统通过 `vercel.json` 配置了以下定时任务：

```json
{
    "crons": [
        {
            "path": "/api/tracker/cron?secret=${CRON_SECRET}",
            "schedule": "0 2,14 * * *"
        },
        {
            "path": "/api/casevault/cron?secret=${CRON_SECRET}",
            "schedule": "0 8 * * *"
        },
        {
            "path": "/api/innovation-dna/cron?secret=${CRON_SECRET}",
            "schedule": "0 3 * * 1"
        }
    ]
}
```

| Cron 任务 | 执行频率 | 说明 |
|-----------|----------|------|
| **Tracker 扫描** | 每日 02:00 和 14:00 UTC | 执行所有活跃监控任务的定时扫描 |
| **CaseVault 同步** | 每日 08:00 UTC | CaseVault 案例库定时同步 |
| **DNA 收割** | 每周一 03:00 UTC | DNA Harvester 从 OpenAlex 抓取高引论文入库 |

**Webhook 通知**: 每次 Cron 执行完成后，系统自动将结果推送到 `CRON_WEBHOOK_URL`。根据 URL 自动识别平台（飞书卡片消息 / Slack Block Kit / 企业微信 Markdown / 通用 JSON），推送内容包含成功/失败/跳过数量、耗时、错误详情等。

**健康检查**: 访问 `/api/tracker/health?secret=YOUR_SECRET` 可获取 Cron 运行状态概览（`healthy` / `degraded` / `critical`），包含过期任务列表和上次执行信息。

### 重磅部署排险提示预警与特殊注意事项
*   **多智能代理长驻轮询推理引擎耗时超出截断限制 (Timeout Limitation)**：由于极度复杂的 Agent 思考长链在涉及相互纠集冲突验证流时可能无法保证在低级额度套餐内预设执行，甚至跨越并耗时超过常规额度 Vercel 免费沙盒版实例（即 Hobby Plan 许可下调取限额为 10s 至 15s），进而将面临强制系统性挂起关闭（504 TimeOut）函数响应危机问题。
*   面对此问题，推荐并请务必如果持有可修改特权级别 `Pro` 版本及更高等级计算集群资源账号特权配额时，请尝试优先在全工程根层级目录内部配置文件 `next.config.js` 或者 route handler 指派头区域局部调整重写覆盖控制标识配额并调整放行额度以修改放行门槛执行上线（建议为：`maxDuration: 60` 秒最大安全缓冲执行限高区间顶线）。
*   **Cron 任务频率限制**：Vercel Hobby Plan 限制 Cron 最快每日执行一次。当前 Tracker 配置为每日两次（02:00 和 14:00），需 Pro 计划支持。DNA Harvester 为每周一次，Hobby 计划可用。
