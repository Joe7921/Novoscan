/**
 * json-parser.ts 单元测试
 *
 * 测试 parseAgentJSON 的多策略 JSON 提取能力
 */

import { describe, it, expect } from 'vitest';
import { parseAgentJSON } from '../json-parser';

// ==================== 策略 1：```json 代码块 ====================

describe('parseAgentJSON — 代码块提取', () => {
    it('应从 ```json 代码块中正确提取 JSON', () => {
        const text = '以下是分析结果：\n```json\n{"score": 85, "analysis": "很好"}\n```\n总结完毕。';
        const result = parseAgentJSON<{ score: number; analysis: string }>(text);
        expect(result.score).toBe(85);
        expect(result.analysis).toBe('很好');
    });

    it('应处理嵌套代码块（取最外层）', () => {
        const text = '```json\n{"score": 75, "code": "示例"}\n```';
        const result = parseAgentJSON<{ score: number }>(text);
        expect(result.score).toBe(75);
    });
});

// ==================== 策略 2：直接 JSON.parse ====================

describe('parseAgentJSON — 直接解析', () => {
    it('应能直接解析纯 JSON 文本', () => {
        const text = '{"score": 90, "keyFindings": ["发现1", "发现2"]}';
        const result = parseAgentJSON<{ score: number; keyFindings: string[] }>(text);
        expect(result.score).toBe(90);
        expect(result.keyFindings).toHaveLength(2);
    });
});

// ==================== 策略 3：花括号平衡匹配 ====================

describe('parseAgentJSON — 花括号平衡', () => {
    it('应从混合文本中通过花括号平衡提取 JSON', () => {
        const text = '好的，我来分析一下。\n{"score": 60, "analysis": "分析结果"}\n以上就是我的分析。';
        const result = parseAgentJSON<{ score: number }>(text);
        expect(result.score).toBe(60);
    });

    it('应正确处理嵌套对象', () => {
        const text = 'Result: {"outer": {"inner": {"value": 42}}, "score": 100}';
        const result = parseAgentJSON<{ outer: { inner: { value: number } }; score: number }>(text);
        expect(result.outer.inner.value).toBe(42);
        expect(result.score).toBe(100);
    });
});

// ==================== 策略 3.5：截断自愈 ====================

describe('parseAgentJSON — 截断自愈', () => {
    it('应自愈缺少闭合花括号的截断 JSON', () => {
        const text = '{"score": 70, "analysis": "这是一段分析';
        // 策略 3.5 应补全 "} 
        const result = parseAgentJSON<{ score: number }>(text);
        expect(result.score).toBe(70);
    });

    it('应自愈缺少闭合方括号和花括号的截断 JSON', () => {
        const text = '{"score": 55, "items": ["a", "b"';
        const result = parseAgentJSON<{ score: number; items: string[] }>(text);
        expect(result.score).toBe(55);
    });
});

// ==================== 错误处理 ====================

describe('parseAgentJSON — 错误处理', () => {
    it('完全无 JSON 时应抛出错误', () => {
        expect(() => parseAgentJSON('这段文字没有任何 JSON 内容')).toThrow();
    });
});
