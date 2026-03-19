/**
 * AI 响应 JSON 解析器 — parseAgentJSON / extractJSON
 *
 * 核心策略（按优先级）：
 * 1. 贪婪正则匹配最外层 ```json ... ``` 代码块
 * 2. 直接 JSON.parse 全文
 * 3. 花括号平衡匹配提取最外层 JSON 对象
 * 3.5. 截断 JSON 自愈（AI 因 maxOutputTokens 在 JSON 中段被截断时）
 * 4. 兜底 firstBrace + lastBrace
 *
 * @module lib/ai/json-parser
 */

import type { AIAnalysisResult } from './index';

/**
 * 从 AI 原始文本中提取 JSON 并做类型安全解析。
 */
export function parseAgentJSON<T>(text: string): T {
    // 策略 1：匹配 ```json ... ``` 代码块
    const codeBlockStart = text.match(/```json\s*\r?\n/);
    if (codeBlockStart && codeBlockStart.index !== undefined) {
        const contentStart = codeBlockStart.index + codeBlockStart[0].length;
        const remaining = text.substring(contentStart);
        const closingMatches = Array.from(remaining.matchAll(/\n```/g));
        if (closingMatches.length > 0) {
            const lastClose = closingMatches[closingMatches.length - 1];
            const jsonStr = remaining.substring(0, lastClose.index!).trim();
            try {
                return JSON.parse(jsonStr) as T;
            } catch (e) {
                console.warn('[parseAgentJSON] 代码块提取的 JSON 解析失败，尝试其他策略:', (e as Error).message?.slice(0, 100));
            }
        }
    }

    // 策略 2：直接 JSON.parse 全文
    try {
        return JSON.parse(text.trim()) as T;
    } catch {
        // 继续下一策略
    }

    // 策略 3：花括号平衡匹配 — 找到最外层完整的 JSON 对象
    const firstBrace = text.indexOf('{');
    if (firstBrace !== -1) {
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = firstBrace; i < text.length; i++) {
            const ch = text[i];
            if (escape) { escape = false; continue; }
            if (ch === '\\' && inString) { escape = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    const jsonStr = text.substring(firstBrace, i + 1);
                    try {
                        return JSON.parse(jsonStr) as T;
                    } catch (e) {
                        console.warn('[parseAgentJSON] 花括号平衡匹配的 JSON 解析失败:', (e as Error).message?.slice(0, 100));
                        break;
                    }
                }
            }
        }
    }

    // 策略 3.5：截断 JSON 自愈
    if (firstBrace !== -1) {
        let jsonCandidate = text.substring(firstBrace);
        
        // 检测是否在字符串中间被截断
        let inStr = false;
        let esc = false;
        for (let i = 0; i < jsonCandidate.length; i++) {
            const ch = jsonCandidate[i];
            if (esc) { esc = false; continue; }
            if (ch === '\\' && inStr) { esc = true; continue; }
            if (ch === '"') { inStr = !inStr; }
        }
        
        // 如果在字符串中间被截断，保留所有内容并追加闭合引号
        if (inStr) {
            jsonCandidate = jsonCandidate.replace(/\\+$/, '');
            jsonCandidate += '"';
        }
        
        // 重新计算缺失的闭合括号
        let openBraces = 0, openBrackets = 0;
        inStr = false; esc = false;
        for (let i = 0; i < jsonCandidate.length; i++) {
            const ch = jsonCandidate[i];
            if (esc) { esc = false; continue; }
            if (ch === '\\' && inStr) { esc = true; continue; }
            if (ch === '"') { inStr = !inStr; continue; }
            if (inStr) continue;
            if (ch === '{') openBraces++;
            else if (ch === '}') openBraces--;
            else if (ch === '[') openBrackets++;
            else if (ch === ']') openBrackets--;
        }
        
        if (openBraces > 0 || openBrackets > 0) {
            let trimmed = jsonCandidate.replace(/[,:\s]+$/, '');
            trimmed = trimmed.replace(/,\s*"[^"]*"\s*:\s*$/, '');
            const closing = ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
            trimmed += closing;
            try {
                const result = JSON.parse(trimmed) as T;
                console.warn(`[parseAgentJSON] ⚠️ 截断 JSON 自愈成功：补全了 ${openBraces} 个 } 和 ${openBrackets} 个 ]`);
                return result;
            } catch (e) {
                console.warn('[parseAgentJSON] 截断 JSON 自愈失败:', (e as Error).message?.slice(0, 100));
            }
        }
    }

    // 最终兜底：firstBrace + lastBrace
    const fb = text.indexOf('{');
    const lb = text.lastIndexOf('}');
    if (fb !== -1 && lb > fb) {
        try {
            return JSON.parse(text.substring(fb, lb + 1)) as T;
        } catch (e) {
            console.error('[parseAgentJSON] 所有策略均失败。原始文本前 200 字符:', text.slice(0, 200));
            throw new Error(`Unable to extract valid JSON from AI response: ${(e as Error).message}`);
        }
    }

    throw new Error('Unable to extract valid JSON from AI response: no JSON object found');
}

/**
 * 提取 AI 响应中的 JSON（旧版兼容函数）
 */
export function extractJSON(text: string): AIAnalysisResult {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    let jsonStr = jsonMatch ? jsonMatch[1] : text;

    try {
        const parsed = JSON.parse(jsonStr);
        return parsed as AIAnalysisResult;
    } catch (e) {
        console.error("Failed to parse JSON directly:", e);
        const firstBrace2 = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace2 !== -1 && lastBrace !== -1) {
            try {
                return JSON.parse(text.substring(firstBrace2, lastBrace + 1)) as AIAnalysisResult;
            } catch (err) {
                throw new Error("Unable to extract valid JSON from model response.");
            }
        }
        throw e;
    }
}
