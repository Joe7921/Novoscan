---
description: 双端协同开发工作流。在开源版和云端版之间同步代码、管理 Feature Flag、确保两端构建兼容。
---

# 双端协同开发工作流

## 项目速查

| 关键字 | 项目 | 路径 |
|--------|------|------|
| 云端版 / cloud / novoscan.cn | novoscan-next | `D:\Antigravity projects\novoscan-next` |
| 开源版 / open / self-hosted | Novoscan-Open | `D:\Antigravity projects\Novoscan-Open` |

## 开发流程

### 1. 判断任务归属
- **共享核心代码**（Agent / Orchestrator / AI Client / 类型系统）：在 **novoscan-next** 先改
- **云端独有功能**（支付/积分/NovoMind/SEO）：仅在 **novoscan-next** 改
- **开源独有功能**（Admin CLI/Docker/MockAI/Ollama）：仅在 **Novoscan-Open** 改

### 2. Feature Flag 规范
云端独有功能必须用 `FEATURES.xxx` 条件包裹：
```typescript
import { FEATURES } from '@/config/edition';
if (FEATURES.payment) {
  // 仅云端执行的代码
}
```

### 3. 代码同步（云端 → 开源）
```powershell
# 在 novoscan-next 目录执行
.\scripts\sync-to-open.ps1
```

### 4. 验证两端构建
```powershell
// turbo
# 开源版
cd "D:\Antigravity projects\Novoscan-Open" && npm run build

// turbo
# 云端版
cd "D:\Antigravity projects\novoscan-next" && npm run build
```

## 绝不同步到开源版的文件
- 支付相关（lemonsqueezy.ts / walletService / quotaService）
- NovoMind 相关（components/novomind / /api/novomind）
- 广告系统（components/ads）
- SEO（robots.ts / sitemap.ts / 百度验证）
- 签到/推荐系统

## 注意事项
- 修改共享代码后，**必须确保两端构建都能通过**
- 新增云端功能时，开源版构建不应报错（用 Feature Flag 隔离）
- 不要在开源版残留任何云端商业功能的代码
