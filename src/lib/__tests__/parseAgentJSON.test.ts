/**
 * parseAgentJSON 单元测试
 *
 * 测试 AI 原始文本 → JSON 提取的多策略解析器
 */
import { describe, it, expect } from 'vitest';
import { parseAgentJSON } from '../ai-client';

describe('parseAgentJSON', () => {
    // ==================== 策略 1：代码块提取 ====================

    it('应从 ```json ``` 代码块中提取 JSON', () => {
        const text = `
这是一些前置文本。

\`\`\`json
{"score": 85, "analysis": "很好"}
\`\`\`

这是一些后置文本。
`;
        const result = parseAgentJSON<{ score: number; analysis: string }>(text);

        expect(result.score).toBe(85);
        expect(result.analysis).toBe('很好');
    });

    it('应处理 content 中嵌套代码块的情况', () => {
        const text = `
\`\`\`json
{
  "score": 90,
  "analysis": "代码示例：\\n\`\`\`python\\nprint('hello')\\n\`\`\`\\n结束"
}
\`\`\`
`;
        // 由于嵌套代码块，使用贪婪匹配找最后一个 ```
        const result = parseAgentJSON<{ score: number }>(text);
        expect(result.score).toBe(90);
    });

    // ==================== 策略 2：直接 JSON 解析 ====================

    it('应直接解析纯 JSON 文本', () => {
        const text = '{"name": "test", "value": 42}';

        const result = parseAgentJSON<{ name: string; value: number }>(text);

        expect(result.name).toBe('test');
        expect(result.value).toBe(42);
    });

    it('应处理带空白的纯 JSON', () => {
        const text = '  \n  {"key": "value"}  \n  ';

        const result = parseAgentJSON<{ key: string }>(text);

        expect(result.key).toBe('value');
    });

    // ==================== 策略 3：花括号平衡匹配 ====================

    it('应从夹杂文本中通过花括号平衡匹配提取 JSON', () => {
        const text = '这是 AI 的回答：{"score": 75, "detail": "内容"} 以上就是分析结果。';

        const result = parseAgentJSON<{ score: number; detail: string }>(text);

        expect(result.score).toBe(75);
        expect(result.detail).toBe('内容');
    });

    it('应正确处理嵌套花括号', () => {
        const text = `
分析如下：
{"outer": {"inner": {"deep": 1}}, "list": [1, 2, 3]}
结束
`;
        const result = parseAgentJSON<{ outer: { inner: { deep: number } }; list: number[] }>(text);

        expect(result.outer.inner.deep).toBe(1);
        expect(result.list).toEqual([1, 2, 3]);
    });

    // ==================== 策略 3.5：截断 JSON 自愈 ====================

    it('应修复截断的 JSON（缺少闭合花括号）', () => {
        const text = '{"score": 85, "findings": ["发现1", "发现2"';
        // 缺少 ]} → 自愈应补全

        const result = parseAgentJSON<{ score: number; findings: string[] }>(text);

        expect(result.score).toBe(85);
        expect(result.findings).toContain('发现1');
    });

    it('应修复截断的 JSON（在字符串中间截断）', () => {
        const text = '{"score": 85, "analysis": "这是一段分析文';
        // 截断在字符串中间 → 应补全引号 + 花括号

        const result = parseAgentJSON<{ score: number }>(text);

        expect(result.score).toBe(85);
    });

    // ==================== 异常处理 ====================

    it('完全无 JSON 应抛出异常', () => {
        const text = '这里完全没有任何 JSON 内容，只有纯文本。';

        expect(() => parseAgentJSON(text)).toThrow();
    });

    it('空文本应抛出异常', () => {
        expect(() => parseAgentJSON('')).toThrow();
    });

    // ==================== 复杂场景 ====================

    it('应处理包含 Agent 完整输出的复杂 JSON', () => {
        const text = `
根据分析，结果如下：

\`\`\`json
{
  "agentName": "学术审查员",
  "score": 72,
  "confidence": "medium",
  "keyFindings": ["发现1", "发现2"],
  "redFlags": [],
  "analysis": "详细分析文本"
}
\`\`\`

以上是我的评估。
`;
        const result = parseAgentJSON<{ agentName: string; score: number; keyFindings: string[] }>(text);

        expect(result.agentName).toBe('学术审查员');
        expect(result.score).toBe(72);
        expect(result.keyFindings).toHaveLength(2);
    });

    it('应处理含转义字符的 JSON', () => {
        const text = '{"message": "包含\\"引号\\"和\\n换行"}';

        const result = parseAgentJSON<{ message: string }>(text);

        expect(result.message).toContain('引号');
    });
});
