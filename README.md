# Novoscan-Open-Core

> **AI 多智能体创新检测引擎** — 多源检索 · 多专家评分 · 对抗辩论 · 终裁报告

![Python 3.12+](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-0.3-1C3C3C?logo=langchain&logoColor=white)
![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ⚡ 30 秒快速开始

### 🐳 Docker（零配置）

```bash
git clone https://github.com/Joe7921/Novoscan.git
cd Novoscan/Novoscan-Open-Core
docker compose up
```

打开 http://localhost:8001 → Setup Wizard 引导你配置模型 → 开始使用

### 🐍 本地开发（需要 Python 3.12+ & uv）

```bash
git clone https://github.com/Joe7921/Novoscan.git
cd Novoscan/Novoscan-Open-Core
python quickstart.py
```

一条命令完成：依赖安装 → 环境配置 → 前端构建 → 启动服务

> **无需提前配置 API Key**：启动后 Web UI 的 Setup Wizard 会引导你在线配置。

---

## 🖥️ 首次打开

启动后浏览器访问 http://localhost:8001，你会看到 **WeFlow 风格的分步引导向导**：

1. **欢迎** — 了解 Novoscan
2. **模型配置** — 选择 Provider（DeepSeek / 硅基流动 / OpenAI / Ollama 等），填入 API Key，一键测试连通性
3. **数据源** — 查看可用数据源（3 个免费 + 2 个需 Key，可跳过）
4. **完成** — 开始创新评估

---

## 🏗️ 架构

```
Novoscan-Open-Core/
├── app/
│   ├── main.py          # FastAPI 入口 + SSE 流式端点
│   ├── config.py         # pydantic-settings 配置管理
│   ├── core/             # 核心引擎
│   │   ├── pipeline.py   # LangGraph 标准管线
│   │   ├── intent.py     # 意图分析 + HITL
│   │   ├── retrieval.py  # 多源 ReAct 检索
│   │   ├── scoring.py    # 多智能体并行评分
│   │   ├── debate.py     # 对抗辩论系统
│   │   └── report.py     # 仲裁 + 报告生成
│   ├── agents/           # Agent 定义 + Agentic 编排
│   └── interactions/     # 交互模式（辩论协议 / HITL）
├── frontend/web/         # React 18 + Vite + TailwindCSS
├── tests/                # 107 个测试
├── quickstart.py         # 一键启动脚本
├── Dockerfile            # 多阶段构建
├── docker-compose.yml    # Docker 一键启动
└── Makefile
```

## 🛠️ 技术栈

| 层 | 技术 |
|:--:|:-----|
| 引擎 | LangGraph + LangChain |
| 后端 | FastAPI + Uvicorn + SSE |
| 前端 | React 18 + Vite + TailwindCSS + Zustand |
| 配置 | pydantic-settings |
| 测试 | pytest · 107 tests |

## 🤖 模型配置

本项目 **不绑定** 任何具体模型，支持所有 OpenAI-Compatible API 协议。

**推荐方式**：启动后在 Web UI 的 **设置 → 模型服务** 中在线配置。

也可以通过 `.env` 文件配置：

```env
LLM_API_KEY=sk-xxx
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL_NAME=deepseek-chat
```

推荐服务商（按性价比排序）：
1. **DeepSeek Chat** — 最佳性价比
2. **硅基流动** — 国内聚合平台
3. **GPT-4o** — 质量最优
4. **Ollama 本地** — 零成本

## 📦 开发命令

```bash
make quickstart  # 一键启动（推荐）
make dev         # 仅启动后端（热重载）
make serve       # 构建前端 + 启动服务
make test        # 运行测试
make lint        # 代码检查
```

## 📖 更多文档

- [架构详解](docs/architecture.md)
- [API 文档](docs/api.md)（启动后也可访问 http://localhost:8001/docs）

## 许可

MIT License
