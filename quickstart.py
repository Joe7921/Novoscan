#!/usr/bin/env python3
"""
Novoscan-Open-Core 一键启动脚本

用法：
  python quickstart.py          # 默认启动（端口 8001）
  python quickstart.py --port 9000
  python quickstart.py --skip-frontend  # 跳过前端构建
"""

import os
import sys
import shutil
import subprocess
import argparse
from pathlib import Path

# ── 项目根目录 ──
ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "frontend" / "web"
FRONTEND_DIST = FRONTEND_DIR / "dist"
ENV_FILE = ROOT / ".env"
ENV_EXAMPLE = ROOT / ".env.example"

# ── 颜色输出 ──
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def info(msg: str):
    print(f"{GREEN}✅{RESET} {msg}")


def warn(msg: str):
    print(f"{YELLOW}⚠️{RESET}  {msg}")


def error(msg: str):
    print(f"{RED}❌{RESET} {msg}")


def step(msg: str):
    print(f"\n{CYAN}{BOLD}▸ {msg}{RESET}")


def check_python():
    """检查 Python 版本 ≥ 3.12"""
    step("检查 Python 版本")
    v = sys.version_info
    if v.major < 3 or (v.major == 3 and v.minor < 12):
        error(f"需要 Python 3.12+，当前为 {v.major}.{v.minor}.{v.micro}")
        sys.exit(1)
    info(f"Python {v.major}.{v.minor}.{v.micro}")


def check_uv():
    """检查 uv 是否可用"""
    step("检查 uv 包管理器")
    if shutil.which("uv"):
        info("uv 已安装")
        return
    warn("uv 未安装，尝试通过 pip 安装...")
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "uv", "-q"],
            check=True,
        )
        info("uv 安装成功")
    except subprocess.CalledProcessError:
        error("uv 安装失败。请手动安装: pip install uv 或 https://docs.astral.sh/uv/")
        sys.exit(1)


def install_deps():
    """安装 Python 依赖"""
    step("安装 Python 依赖 (uv sync)")
    try:
        subprocess.run(
            [sys.executable, "-m", "uv", "sync"],
            cwd=str(ROOT),
            check=True,
        )
        info("依赖安装完成")
    except subprocess.CalledProcessError:
        error("依赖安装失败")
        sys.exit(1)


def setup_env():
    """从 .env.example 创建 .env（如果不存在）"""
    step("检查环境配置")
    if ENV_FILE.exists():
        info(f".env 已存在")
        return
    if ENV_EXAMPLE.exists():
        shutil.copy2(ENV_EXAMPLE, ENV_FILE)
        info(f"已从 .env.example 创建 .env")
        warn("请编辑 .env 填入你的 API Key（也可稍后通过 Web UI 配置）")
    else:
        warn(".env.example 不存在，将使用默认配置启动（无 API Key）")


def build_frontend(skip: bool = False):
    """构建前端（需要 Node.js）"""
    step("检查前端")

    if skip:
        warn("已跳过前端构建（--skip-frontend）")
        return

    if FRONTEND_DIST.is_dir() and (FRONTEND_DIST / "index.html").is_file():
        info("前端已构建 (dist/ 存在)")
        return

    node = shutil.which("node")
    npm = shutil.which("npm")

    if not node or not npm:
        warn("未检测到 Node.js / npm，跳过前端构建")
        warn("后端 API 仍可正常使用（http://localhost:{port}/health）")
        warn("如需 Web UI，请安装 Node.js 后运行: cd frontend/web && npm install && npm run build")
        return

    info("检测到 Node.js，开始构建前端...")

    # npm install
    try:
        subprocess.run(
            [npm, "install"],
            cwd=str(FRONTEND_DIR),
            check=True,
        )
    except subprocess.CalledProcessError:
        warn("npm install 失败，跳过前端构建")
        return

    # npm run build
    try:
        subprocess.run(
            [npm, "run", "build"],
            cwd=str(FRONTEND_DIR),
            check=True,
        )
        info("前端构建完成")
    except subprocess.CalledProcessError:
        warn("前端构建失败，但后端 API 仍可正常使用")


def start_server(port: int, host: str):
    """启动 FastAPI 服务"""
    step("启动 Novoscan-Open-Core 引擎")

    has_web = FRONTEND_DIST.is_dir() and (FRONTEND_DIST / "index.html").is_file()

    print()
    print(f"  {BOLD}🚀 Novoscan-Open-Core 启动中...{RESET}")
    print()
    print(f"  {CYAN}API:     {RESET}http://localhost:{port}/health")
    if has_web:
        print(f"  {CYAN}Web UI:  {RESET}http://localhost:{port}/")
    else:
        print(f"  {YELLOW}Web UI:  {RESET}未构建（仅 API 可用）")
    print(f"  {CYAN}Docs:    {RESET}http://localhost:{port}/docs")
    print()
    print(f"  按 {BOLD}Ctrl+C{RESET} 停止服务")
    print()

    try:
        subprocess.run(
            [
                sys.executable, "-m", "uv", "run",
                "uvicorn", "app.main:app",
                "--reload",
                "--host", host,
                "--port", str(port),
            ],
            cwd=str(ROOT),
        )
    except KeyboardInterrupt:
        print(f"\n{GREEN}🛑 服务已停止{RESET}")


def main():
    parser = argparse.ArgumentParser(description="Novoscan-Open-Core 一键启动")
    parser.add_argument("--port", type=int, default=8001, help="服务端口（默认 8001）")
    parser.add_argument("--host", default="0.0.0.0", help="监听地址（默认 0.0.0.0）")
    parser.add_argument("--skip-frontend", action="store_true", help="跳过前端构建")
    args = parser.parse_args()

    print()
    print(f"  {BOLD}🔬 Novoscan-Open-Core — 一键启动{RESET}")
    print(f"  {'─' * 38}")
    print()

    check_python()
    check_uv()
    install_deps()
    setup_env()
    build_frontend(skip=args.skip_frontend)
    start_server(port=args.port, host=args.host)


if __name__ == "__main__":
    main()
