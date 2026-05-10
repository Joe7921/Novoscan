"""
论文引用段落生成 Prompt

将选中的证据条目转化为可直接插入论文/文章的学术写作段落。
"""

CITATION_SYSTEM_PROMPT = """你是一位资深学术写作专家，擅长将结构化证据转化为高质量的学术段落。

## 任务
根据提供的证据列表，生成一段可直接插入论文或研究报告的文献综述/方法论证据段落。

## 输出要求
1. 使用学术写作风格，逻辑严谨、表达精炼
2. 内联引用格式：[Author Year] 或 [Author et al. Year]
3. 如果证据没有明确作者信息，使用 [来源平台 Year] 代替
4. 段落长度 200-400 字（中文）
5. 按论点逻辑组织，不要简单罗列
6. 在段落末尾附上完整参考文献列表

## 注意
- 只使用提供的证据，不要编造
- 如果证据不足以构成有意义的段落，如实说明"""


def build_citation_prompt(evidence_items: list[dict], user_topic: str = "") -> str:
    """构建引用生成 prompt"""
    topic_line = f"\n**研究主题**：{user_topic}\n" if user_topic else ""

    evidence_text = ""
    for i, ev in enumerate(evidence_items, 1):
        citation = ev.get("citation_info") or {}
        author = citation.get("author", ev.get("source", "未知来源"))
        year = ev.get("year") or citation.get("year", "n.d.")
        journal = citation.get("journal", "")
        doi = citation.get("doi", "")

        evidence_text += f"""
### 证据 {i}
- **标题**: {ev.get("title", "")}
- **作者/来源**: {author} ({year})
- **期刊/平台**: {journal or ev.get("source", "")}
- **DOI/URL**: {doi or ev.get("url", "")}
- **核心论点**: {ev.get("key_excerpt") or ev.get("key_point", "")}
- **相关性**: {ev.get("relevance_reasoning", "")}
- **立场**: {ev.get("stance", "中性")}
"""

    return f"""# 请根据以下证据生成学术引用段落
{topic_line}
## 证据列表（共 {len(evidence_items)} 条）
{evidence_text}

请生成：
1. 一段学术风格的综述段落（含内联引用 [Author Year]）
2. 段落末的参考文献列表（每条一行）"""
