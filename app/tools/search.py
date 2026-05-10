"""
Novoscan-Open-Core — 搜索工具集

5 个 @tool 装饰器函数，从旧引擎搬运并适配。
每个工具封装一个外部数据源 API。

注意：这些函数通过 YAML 声明注册到 ToolRegistry，
不需要手动 import 或维护 ALL_TOOLS 列表。
"""

import httpx
from langchain_core.tools import tool
from app.config import settings


@tool
async def search_openalex(query: str) -> str:
    """
    搜索 OpenAlex 学术数据库。返回与查询相关的学术论文列表（标题、年份、引用数、期刊、作者）。
    适用于：需要了解某个技术方向的学术研究基础、论文数量和引用分布。
    """
    email = settings.openalex_email or ""
    params = {
        "search": query,
        "per_page": 15,
        "sort": "cited_by_count:desc",
    }
    if email:
        params["mailto"] = email

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get("https://api.openalex.org/works", params=params)
            resp.raise_for_status()
            data = resp.json()

        results = data.get("results", [])
        if not results:
            return f"OpenAlex 未找到与 '{query}' 相关的论文。"

        lines = [f"OpenAlex 检索到 {data.get('meta', {}).get('count', 0)} 篇论文（显示前 {len(results)} 篇）：\n"]
        for paper in results:
            title = paper.get("title", "无标题")
            year = paper.get("publication_year", "未知")
            cited = paper.get("cited_by_count", 0)
            venue = paper.get("primary_location", {}).get("source", {}).get("display_name", "未知期刊") if paper.get("primary_location") else "未知"
            authors = ", ".join([a.get("author", {}).get("display_name", "") for a in (paper.get("authorships", [])[:3])])
            oa = "开放获取" if paper.get("open_access", {}).get("is_oa") else "非开放"
            lines.append(f"- 「{title}」({year}) 引用:{cited} 期刊:{venue} 作者:{authors} [{oa}]")

        return "\n".join(lines)
    except Exception as e:
        return f"OpenAlex 查询失败: {str(e)}"


@tool
async def search_arxiv(query: str) -> str:
    """
    搜索 arXiv 预印本数据库。返回最新的相关学术预印本论文。
    适用于：了解前沿研究方向、最新技术突破和尚未正式发表的研究。
    """
    import xml.etree.ElementTree as ET

    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": 10,
        "sortBy": "relevance",
        "sortOrder": "descending",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get("http://export.arxiv.org/api/query", params=params)
            resp.raise_for_status()

        root = ET.fromstring(resp.text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        entries = root.findall("atom:entry", ns)

        if not entries:
            return f"arXiv 未找到与 '{query}' 相关的论文。"

        lines = [f"arXiv 检索到 {len(entries)} 篇预印本：\n"]
        for entry in entries:
            title = entry.findtext("atom:title", "", ns).strip().replace("\n", " ")
            published = entry.findtext("atom:published", "", ns)[:10]
            summary = entry.findtext("atom:summary", "", ns).strip()[:200]
            authors = ", ".join([a.findtext("atom:name", "", ns) for a in entry.findall("atom:author", ns)[:3]])
            lines.append(f"- 「{title}」({published}) 作者:{authors}")
            lines.append(f"  摘要:{summary}...")

        return "\n".join(lines)
    except Exception as e:
        return f"arXiv 查询失败: {str(e)}"


@tool
async def search_brave(query: str) -> str:
    """
    使用 Brave Search 搜索网页。返回与查询相关的网页结果（标题、URL、摘要）。
    适用于：了解产业动态、竞品信息、市场趋势、产品发布和新闻报道。
    """
    api_key = settings.brave_api_key
    if not api_key:
        return "Brave Search 未配置 API Key (BRAVE_API_KEY)，无法执行搜索。"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={"q": query, "count": 10},
                headers={"X-Subscription-Token": api_key, "Accept": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()

        results = data.get("web", {}).get("results", [])
        if not results:
            return f"Brave 未找到与 '{query}' 相关的网页结果。"

        lines = [f"Brave 搜索到 {len(results)} 条网页结果：\n"]
        for r in results:
            title = r.get("title", "")
            url = r.get("url", "")
            desc = r.get("description", "")[:150]
            lines.append(f"- 「{title}」{url}")
            lines.append(f"  {desc}")

        return "\n".join(lines)
    except Exception as e:
        return f"Brave 搜索失败: {str(e)}"


@tool
async def search_github(query: str) -> str:
    """
    搜索 GitHub 仓库。返回与查询相关的开源项目（名称、Star 数、语言、描述）。
    适用于：了解开源生态、技术实现情况、社区活跃度和竞品技术栈。
    """
    token = settings.github_token
    headers = {"Accept": "application/vnd.github.v3+json"}
    if token:
        headers["Authorization"] = f"token {token}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://api.github.com/search/repositories",
                params={"q": query, "sort": "stars", "order": "desc", "per_page": 10},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

        items = data.get("items", [])
        if not items:
            return f"GitHub 未找到与 '{query}' 相关的仓库。注意：无开源项目不等于产业空白。"

        lines = [f"GitHub 搜索到 {data.get('total_count', 0)} 个仓库（显示前 {len(items)} 个）：\n"]
        for repo in items:
            name = repo.get("full_name", "")
            stars = repo.get("stargazers_count", 0)
            lang = repo.get("language", "未知")
            desc = (repo.get("description") or "")[:100]
            updated = repo.get("updated_at", "")[:10]
            topics = ", ".join(repo.get("topics", [])[:5])
            lines.append(f"- {name} ⭐{stars} [{lang}] 更新:{updated}")
            lines.append(f"  {desc}")
            if topics:
                lines.append(f"  标签: {topics}")

        return "\n".join(lines)
    except Exception as e:
        return f"GitHub 搜索失败: {str(e)}"


@tool
async def search_crossref(query: str) -> str:
    """
    搜索 CrossRef 文献数据库。返回与查询相关的学术文献元数据（标题、DOI、引用数、出版商）。
    适用于：补充 OpenAlex 的学术搜索，获取更多文献元数据、DOI 及出版信息。
    """
    email = settings.crossref_email or ""
    params = {
        "query": query,
        "rows": 10,
        "sort": "relevance",
    }
    if email:
        params["mailto"] = email

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get("https://api.crossref.org/works", params=params)
            resp.raise_for_status()
            data = resp.json()

        items = data.get("message", {}).get("items", [])
        if not items:
            return f"CrossRef 未找到与 '{query}' 相关的文献。"

        total = data.get("message", {}).get("total-results", 0)
        lines = [f"CrossRef 检索到 {total} 篇文献（显示前 {len(items)} 篇）：\n"]
        for item in items:
            title = " ".join(item.get("title", ["无标题"]))
            year = item.get("published-print", {}).get("date-parts", [[None]])[0][0] or item.get("created", {}).get("date-parts", [[None]])[0][0] or "未知"
            cited = item.get("is-referenced-by-count", 0)
            publisher = item.get("publisher", "未知")
            doi = item.get("DOI", "")
            lines.append(f"- 「{title}」({year}) 引用:{cited} 出版:{publisher} DOI:{doi}")

        return "\n".join(lines)
    except Exception as e:
        return f"CrossRef 查询失败: {str(e)}"
