# Novoscan 开源版 — 开发提示词库

> 每个提示词可以直接粘贴到新对话中使用。
> 使用前先让分身读 `.agents/context.md` 获取背景上下文。
> 云端版完整提示词库在 `D:\Antigravity projects\novoscan-next\.agents\prompts.md`。

---

## 快捷工作流

| 命令 | 说明 |
|------|------|
| `/dual-dev` | 双端协同开发工作流（代码同步、Feature Flag 管理） |
| `/optimize` | 代码优化工作流（重构策略、性能优化） |

---

## 常用提示词

### 快速定位工作区
> "我要改**云端版**的XXX" → Agent 自动定位 novoscan-next
> "我要改**开源版**的XXX" → Agent 自动定位 Novoscan-Open

### Feature Flag 同步
> "读 .agents/context.md，然后把云端版的 src/config/edition.ts 同步到开源版，确保 NEXT_PUBLIC_EDITION 默认值为 'open'。"

### cloud-sync 配置
> "读 .agents/context.md，然后创建 src/config/cloud-sync.ts。包含 getCloudSyncConfig() 和 syncReportToCloud(report) 两个函数，用于可选连接 novoscan.cn/api/sync。"

### Ollama 调试
> "读 .agents/context.md，然后帮我检查 Ollama 本地 AI 的集成是否正常。检查 ai-client.ts 中 ollama provider 的注册、健康探测和降级链逻辑。"

### 插件开发
> "读 .agents/context.md，然后帮我创建一个新的插件 Agent，放在 src/plugins/agents/ 下。参考 patent-scout 的结构，包含 index.ts + plugin-manifest.json。"

### 数据库迁移
> "读 .agents/context.md，然后帮我创建一个新的数据库迁移文件。放到 migrations/ 目录，编号接续现有最新文件（010）。"

### 清理残留代码
> "读 .agents/context.md，然后帮我清理 src/components/skill-check/ 目录。这些组件的 API 路由已删除，前端组件应该也清理掉。"

### 图像多模态修复
> "读 .agents/context.md，然后修复 AI Client 不支持图像多模态的问题。需要在 callAIRaw → callProvider → buildBody 链路中透传 attachments 参数。"

### README 英文化
> "读 .agents/context.md，然后优化 README.md 的英文内容。参考 novoscan-next 提示词库中 #3 的详细要求。"

---

## 调试与验证

### 构建验证
```powershell
cd "D:\Antigravity projects\Novoscan-Open"
npm run build
```

### 类型检查
```powershell
cd "D:\Antigravity projects\Novoscan-Open"
npx tsc --noEmit
```

### E2E 测试
```powershell
cd "D:\Antigravity projects\Novoscan-Open"
npx playwright test
```
