"""
兼容层测试 — extract_json_from_text + invoke_with_fallback
"""

import pytest
from app.compat import extract_json_from_text


class TestExtractJson:
    """JSON 提取测试"""

    def test_pure_json(self):
        """纯 JSON 直接通过"""
        text = '{"score": 85, "summary": "good"}'
        assert extract_json_from_text(text) == text

    def test_markdown_wrapped(self):
        """```json ... ``` 包裹"""
        text = '```json\n{"score": 85, "summary": "good"}\n```'
        result = extract_json_from_text(text)
        assert result is not None
        assert '"score": 85' in result

    def test_markdown_no_lang(self):
        """``` ... ``` 无语言标识"""
        text = '```\n{"score": 85}\n```'
        result = extract_json_from_text(text)
        assert result is not None
        assert '"score": 85' in result

    def test_mixed_text_with_json(self):
        """前后有文字"""
        text = '以下是分析结果：\n```json\n{"score": 72}\n```\n以上是我的评估。'
        result = extract_json_from_text(text)
        assert result is not None
        assert '"score": 72' in result

    def test_brace_extraction(self):
        """无代码块但有 JSON 对象"""
        text = '评分结果如下 {"score": 60, "summary": "test"} 请参考。'
        result = extract_json_from_text(text)
        assert result is not None
        assert '"score": 60' in result

    def test_no_json(self):
        """纯文本无 JSON"""
        text = '这个创新点非常有趣，我认为分数应该是 85 分。'
        assert extract_json_from_text(text) is None

    def test_empty(self):
        """空字符串"""
        assert extract_json_from_text("") is None
        assert extract_json_from_text(None) is None

    def test_nested_json(self):
        """嵌套 JSON"""
        text = '```json\n{"score": 75, "evidence": [{"title": "test"}]}\n```'
        result = extract_json_from_text(text)
        assert result is not None
        assert '"evidence"' in result
