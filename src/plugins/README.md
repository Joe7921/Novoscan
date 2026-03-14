# 🧩 Novoscan 插件开发指南

为 Novoscan 创建自定义 Agent 和数据源插件，扩展创新性分析能力。

## 📖 目录

- [快速上手（3 步）](#-快速上手)
- [完整示例](#-完整示例)
- [AgentInput / AgentOutput 结构](#-接口结构说明)
- [注册中心 API](#-注册中心-api)
- [目录规范](#-目录规范)
- [未来规划](#-未来规划)

---

## 🚀 快速上手

### 第 1 步：创建插件文件

在 `src/plugins/agents/` 下新建以你的插件 ID 命名的目录：

```
src/plugins/agents/
└── my-agent/
    └── index.ts
```

### 第 2 步：定义 Agent

```typescript
// src/plugins/agents/my-agent/index.ts
import { defineAgent } from '@/plugins/types'
import type { AgentInput, AgentOutput } from '@/agents/types'

export default defineAgent({
  id: 'my-agent',
  name: '我的分析员',
  nameEn: 'My Analyst',
  description: '基于 XX 数据源的深度分析',
  version: '1.0.0',
  author: 'Your Name',
  category: 'community',    // 'academic' | 'industry' | 'specialized' | 'community'
  icon: '🔬',

  async analyze(input: AgentInput): Promise<AgentOutput> {
    const { query, academicData, industryData, language } = input

    // 你的分析逻辑...
    const score = 75

    return {
      agentName: language === 'zh' ? '我的分析员' : 'My Analyst',
      analysis: '分析结果...',
      score,
      confidence: 'medium',
      confidenceReasoning: '基于 XX 数据源的置信度评估',
      keyFindings: ['发现1', '发现2'],
      redFlags: [],
      evidenceSources: ['数据源A', '数据源B'],
      reasoning: '推理过程...',
      dimensionScores: [
        { name: '维度A', score: 80, reasoning: '评分理由' },
        { name: '维度B', score: 70, reasoning: '评分理由' },
      ],
    }
  },
})
```

### 第 3 步：注册插件

```typescript
import { registerAgent } from '@/plugins'
import myAgent from '@/plugins/agents/my-agent'

registerAgent(myAgent)
```

完成！你的 Agent 现在可以被发现和调用了。

---

## 📋 完整示例

参见内置示范插件 [patent-scout](./agents/patent-scout/index.ts)，它演示了：

- 使用 `defineAgent()` 定义插件
- 模拟外部 API 调用（Google Patents）
- 构建多维评分（`dimensionScores`）
- 生成结构化分析报告
- 标记红旗（高风险项）

---

## 📐 接口结构说明

### AgentInput（Agent 接收的输入）

| 字段 | 类型 | 说明 |
|------|------|------|
| `query` | `string` | 用户原始创意描述 |
| `academicData` | `DualTrackAcademic` | 学术检索结果（论文列表、统计信息、热门概念） |
| `industryData` | `IndustryResult` | 产业检索结果（网页结果、GitHub 仓库、市场热度） |
| `language` | `'zh' \| 'en'` | 用户选择的语言 |
| `modelProvider` | `ModelProvider` | 用户选择的 AI 模型 |
| `onProgress?` | `Function` | 进度回调（可选） |
| `domainId?` | `string` | 一级学科 ID（可选） |
| `domainHint?` | `string` | 学科中文提示（可选） |

### AgentOutput（Agent 返回的输出）

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `agentName` | `string` | ✅ | Agent 名称 |
| `analysis` | `string` | ✅ | 完整分析文本（支持 Markdown） |
| `score` | `number` | ✅ | 综合评分 0-100 |
| `confidence` | `'high' \| 'medium' \| 'low'` | ✅ | 置信度等级 |
| `confidenceReasoning` | `string` | ✅ | 置信度理由 |
| `keyFindings` | `string[]` | ✅ | 关键发现列表 |
| `redFlags` | `string[]` | ✅ | 风险/红旗列表 |
| `evidenceSources` | `string[]` | ✅ | 引用的证据来源 |
| `reasoning` | `string` | ✅ | 推理过程（CoT 留痕） |
| `dimensionScores` | `DimensionScore[]` | ✅ | 多维评分明细 |
| `isFallback?` | `boolean` | ❌ | 是否为降级结果 |

### DimensionScore（多维评分项）

```typescript
interface DimensionScore {
  name: string       // 维度名称
  score: number      // 0-100
  reasoning: string  // 评分理由
}
```

---

## 🔌 注册中心 API

```typescript
import {
  registerAgent,
  getAgent,
  getAllAgents,
  registerSearchProvider,
  getSearchProvider,
  getAllSearchProviders,
  PluginRegistry,
} from '@/plugins'

// Agent 管理
registerAgent(myAgent)                      // 注册
const agent = getAgent('my-agent')          // 按 ID 获取
const allAgents = getAllAgents()             // 获取全部

// SearchProvider 管理
registerSearchProvider(myProvider)           // 注册
const provider = getSearchProvider('my-sp')  // 按 ID 获取
const allProviders = getAllSearchProviders()  // 获取全部（按优先级排序）

// 高级：直接使用注册中心实例
const registry = PluginRegistry.getInstance()
registry.unregisterAgent('my-agent')         // 注销
console.log(registry.getSummary())           // 摘要信息
```

---

## 📁 目录规范

```
src/plugins/
├── types.ts                          # 核心接口定义
├── registry.ts                       # 注册中心（单例）
├── index.ts                          # 统一入口
├── README.md                         # 本文档
└── agents/                           # Agent 插件目录
    ├── patent-scout/                 # 示范插件
    │   └── index.ts
    ├── your-agent/                   # 你的插件
    │   ├── index.ts                  # 入口（必须 export default）
    │   └── utils.ts                  # 可选的辅助模块
    └── ...
```

---

## 🔮 未来规划

| 阶段 | 内容 | 状态 |
|------|------|------|
| **P0** | 接口定义 + 注册中心 + 示范插件 | ✅ 已完成 |
| **P1** | Orchestrator 集成（自动发现并调用插件 Agent） | 🟡 规划中 |
| **P2** | 插件生命周期钩子（`onInit` / `onDestroy`） | 🟡 规划中 |
| **P3** | 插件市场（社区发布、安装、更新） | 🔴 远期 |
| **P3** | 沙箱隔离（安全执行第三方插件） | 🔴 远期 |

---

## 💡 提示

- **类型安全**：始终使用 `defineAgent()` 而非手动构造对象，享受完整的 IDE 类型提示
- **标准输出**：确保 `analyze()` 返回完整的 `AgentOutput`，所有必填字段都不能省略
- **错误处理**：在 `analyze()` 中妥善处理异常，避免未捕获的错误影响编排器
- **性能**：注意控制外部 API 调用的超时时间，建议不超过 30 秒
