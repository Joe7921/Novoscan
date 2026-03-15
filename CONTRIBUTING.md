# 贡献指南 | Contributing Guide

感谢你对 Novoscan 的关注！我们欢迎所有形式的贡献 — 无论是 Bug 报告、功能建议、文档改进还是代码提交。

Thank you for your interest in Novoscan! We welcome all kinds of contributions.

---

## 🚀 快速开始

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/novoscan.git
cd novoscan
```

### 2. 安装依赖

```bash
npm install
```

### 3. 初始化环境变量

```bash
npm run setup   # 自动创建 .env.local，Mock AI 模式已开启
```

### 4. 启动开发服务器

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000) 即可。

---

## 📋 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Type 类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式调整（不影响功能） |
| `refactor` | 代码重构（不修复 Bug 也不添加功能） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具链/辅助工具变动 |

### 示例

```
feat(agents): 添加跨域侦察兵 Agent 的类比推理能力
fix(dual-track): 修复 CrossRef API 超时后未正确回退的问题
docs(readme): 更新自部署指南，添加 Docker 部署说明
```

---

## 🔧 代码规范

- **语言**：TypeScript（严格模式）
- **代码风格**：ESLint + Next.js 推荐配置
- **组件**：React 函数组件 + Hooks
- **样式**：Tailwind CSS
- **命名**：
  - 文件名：`camelCase.ts` / `PascalCase.tsx`（组件）
  - 变量/函数：`camelCase`
  - 类型/接口：`PascalCase`
  - 常量：`UPPER_SNAKE_CASE`

### 代码检查

```bash
# 运行 ESLint
npm run lint

# TypeScript 类型检查
npx tsc --noEmit
```

---

## 🔀 Pull Request 流程

1. **创建分支**：从 `main` 分支创建你的功能分支
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **开发与提交**：遵循提交规范，保持每个提交专注于单一目的

3. **构建验证**：确保本地构建通过
   ```bash
   npm run build
   ```

4. **提交 PR**：
   - 使用 PR 模板填写说明
   - 描述你的改动内容和动机
   - 附上相关 Issue 编号（如有）
   - 如涉及 UI 变更，请附上截图

5. **代码审查**：等待维护者审查，根据反馈进行调整

---

## 🐛 Bug 报告

提交 Bug 报告时，请提供：

1. **环境信息**：浏览器版本、操作系统、Node.js 版本
2. **复现步骤**：详细的操作步骤
3. **期望行为**：你期望看到什么
4. **实际行为**：实际发生了什么
5. **截图/日志**：如有相关截图或控制台日志

---

## 💡 功能建议

提交功能建议前，请：

1. 先搜索 [已有 Issue](../../issues)，避免重复
2. 描述你想解决的问题或需求
3. 描述你设想的解决方案（如有）
4. 说明这对其他用户的价值

---

## 📄 许可证

通过提交贡献，你同意你的贡献将按照项目的 [Apache License 2.0](./LICENSE) 进行许可。
