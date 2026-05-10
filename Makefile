.PHONY: dev test lint streamlit install clean build-web serve quickstart

# 🚀 一键启动（推荐）
quickstart:
	python quickstart.py

# 安装依赖
install:
	python -m uv sync

# 开发服务器（热重载）
dev:
	python -m uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# 运行测试
test:
	python -m uv run pytest tests/ -v

# 代码检查
lint:
	python -m uv run ruff check .

# Streamlit 调试前端（Phase 6）
streamlit:
	python -m uv run streamlit run frontend/app.py

# 构建前端
build-web:
	cd frontend/web && npm install && npm run build

# 一体化启动（前端构建 + 后端服务）
serve: build-web dev

# 清理缓存
clean:
	Remove-Item -Recurse -Force __pycache__, .pytest_cache, .ruff_cache -ErrorAction SilentlyContinue
