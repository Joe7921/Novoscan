# Novoscan 开发提示词库

> 每个提示词可以直接粘贴到新对话中使用。
> 使用前先让分身读 `.agents/context.md` 获取背景上下文。
> 完整提示词库在 novoscan-next/.agents/prompts.md 中，这里放开源版相关的。

---

## 开源版常用提示词

### README 英文重写
> "读 .agents/context.md，然后重写 README.md，英文优先。首屏：Hero GIF 占位 → 一行话 '5 AI experts verify if your innovation exists' → Badges → 三按钮（Try Online / Docker / Discord）。中文放折叠区域。不改任何代码。"

### Feature Flag
> "读 .agents/context.md，然后创建 src/config/edition.ts 和 src/config/cloud-sync.ts。详见 prompts.md #1。"

### GitHub 运营模板
> "读 .agents/context.md，然后创建 Issue 模板 / PR 模板 / Good First Issues。详见 prompts.md #9。"

### Ollama 支持
> "读 .agents/context.md，然后在 ai-client.ts 的 PROVIDER_REGISTRY 注册 ollama。详见 prompts.md #10。"

### 插件化框架
> "读 .agents/context.md，然后设计 INovoAgent 接口 + AgentRegistry + 示范插件。详见 prompts.md #11。"

---

> 完整版提示词（含云端任务）在：`D:\Antigravity projects\novoscan-next\.agents\prompts.md`
