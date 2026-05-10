# ══════════════════════════════════════════════════════════════
# Novoscan-Open-Core — 多阶段构建
#
# Stage 1: 构建前端 (Node 20 Alpine)
# Stage 2: Python 运行时 + 前端 dist
#
# 用法:
#   docker build -t novoscan-core .
#   docker run -p 8001:8001 novoscan-core
# ══════════════════════════════════════════════════════════════

# ── Stage 1: 前端构建 ──
FROM node:20-alpine AS frontend-builder

WORKDIR /build
COPY frontend/web/package.json frontend/web/package-lock.json ./
RUN npm ci --prefer-offline
COPY frontend/web/ ./
RUN npm run build

# ── Stage 2: Python 运行时 ──
FROM python:3.12-slim AS runtime

# 系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 uv
RUN pip install --no-cache-dir uv

WORKDIR /app

# 先复制依赖文件以利用 Docker 缓存
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# 复制后端代码
COPY app/ ./app/

# 从 Stage 1 复制前端构建产物
COPY --from=frontend-builder /build/dist/ ./frontend/web/dist/

# 复制配置文件
COPY .env.example ./.env.example

# 若无 .env 则自动从 .env.example 复制
RUN cp -n .env.example .env 2>/dev/null || true

# 端口
EXPOSE 8001

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# 启动
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
