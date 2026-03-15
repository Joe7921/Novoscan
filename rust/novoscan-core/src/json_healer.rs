//! AI 输出 JSON 自愈解析器 — parseAgentJSON 的 Rust 等价实现
//!
//! 4 层策略（按优先级）：
//! 1. 代码块提取 (```json ... ```)
//! 2. 直接 JSON 解析
//! 3. 花括号平衡匹配
//! 3.5. 截断 JSON 自愈（补全缺失闭合符号）
//! 4. 最终兜底（firstBrace + lastBrace）

/// 从 AI 模型的原始文本输出中提取有效 JSON。
///
/// 返回 Ok(json_string) 或 Err(error_message)。
pub fn parse_agent_json(text: &str) -> Result<String, String> {
    // ==================== 策略 1：代码块提取 ====================
    // 匹配 ```json\n ... 然后找最后一个 \n``` 作为结束标记

    if let Some(start_pos) = find_code_block_start(text) {
        let remaining = &text[start_pos..];
        // 找所有 \n``` 位置，取最后一个
        if let Some(end_offset) = find_last_code_block_end(remaining) {
            let json_str = remaining[..end_offset].trim();
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_str) {
                return serde_json::to_string(&val)
                    .map_err(|e| format!("序列化失败: {}", e));
            }
            // 代码块提取的 JSON 解析失败，尝试其他策略
        }
    }

    // ==================== 策略 2：直接 JSON 解析 ====================

    let trimmed = text.trim();
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
        return serde_json::to_string(&val)
            .map_err(|e| format!("序列化失败: {}", e));
    }

    // ==================== 策略 3：花括号平衡匹配 ====================

    let bytes = text.as_bytes();
    if let Some(first_brace) = bytes.iter().position(|&b| b == b'{') {
        let mut depth: i32 = 0;
        let mut in_string = false;
        let mut escape = false;

        let chars: Vec<char> = text.chars().collect();
        // 将 byte 位置转换为 char 位置
        let first_brace_char = text[..first_brace].chars().count();

        for i in first_brace_char..chars.len() {
            let ch = chars[i];
            if escape {
                escape = false;
                continue;
            }
            if ch == '\\' && in_string {
                escape = true;
                continue;
            }
            if ch == '"' {
                in_string = !in_string;
                continue;
            }
            if in_string {
                continue;
            }
            if ch == '{' {
                depth += 1;
            } else if ch == '}' {
                depth -= 1;
                if depth == 0 {
                    let json_str: String = chars[first_brace_char..=i].iter().collect();
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_str) {
                        return serde_json::to_string(&val)
                            .map_err(|e| format!("序列化失败: {}", e));
                    }
                    break;
                }
            }
        }

        // ==================== 策略 3.5：截断 JSON 自愈 ====================

        let from_brace: String = chars[first_brace_char..].iter().collect();
        let healed = heal_truncated_json(&from_brace);
        if let Some(healed_json) = healed {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&healed_json) {
                return serde_json::to_string(&val)
                    .map_err(|e| format!("序列化失败: {}", e));
            }
        }

        // ==================== 策略 4：最终兜底 firstBrace + lastBrace ====================

        if let Some(last_brace) = text.rfind('}') {
            if last_brace > first_brace {
                let json_str = &text[first_brace..=last_brace];
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_str) {
                    return serde_json::to_string(&val)
                        .map_err(|e| format!("序列化失败: {}", e));
                }
                return Err(format!(
                    "Unable to extract valid JSON from AI response: all strategies failed"
                ));
            }
        }
    }

    Err("Unable to extract valid JSON from AI response: no JSON object found".to_string())
}

/// 查找 ```json\n 代码块的内容起始位置（字节偏移）
fn find_code_block_start(text: &str) -> Option<usize> {
    // 匹配 ```json 后跟可选空白 + 换行
    let patterns = ["```json\r\n", "```json\n", "```json "];
    for pat in &patterns {
        if let Some(pos) = text.find(pat) {
            return Some(pos + pat.len());
        }
    }
    None
}

/// 查找最后一个 \n``` 的位置（在 remaining 文本中）
fn find_last_code_block_end(remaining: &str) -> Option<usize> {
    let mut last_pos: Option<usize> = None;
    let mut search_from = 0;
    while let Some(pos) = remaining[search_from..].find("\n```") {
        last_pos = Some(search_from + pos);
        search_from = search_from + pos + 1;
    }
    last_pos
}

/// 截断 JSON 自愈 — 与 TS parseAgentJSON 策略 3.5 完全一致
fn heal_truncated_json(json_candidate: &str) -> Option<String> {
    let chars: Vec<char> = json_candidate.chars().collect();

    // 第一遍：检测是否在字符串中间被截断
    let mut in_str = false;
    let mut esc = false;
    for &ch in &chars {
        if esc {
            esc = false;
            continue;
        }
        if ch == '\\' && in_str {
            esc = true;
            continue;
        }
        if ch == '"' {
            in_str = !in_str;
        }
    }

    let mut candidate = json_candidate.to_string();

    // 如果在字符串中间被截断，移除尾部不完整转义 + 补全引号
    if in_str {
        // 移除尾部连续的反斜杠
        while candidate.ends_with('\\') {
            candidate.pop();
        }
        candidate.push('"');
    }

    // 第二遍：重新计算缺失的闭合括号
    let mut open_braces: i32 = 0;
    let mut open_brackets: i32 = 0;
    in_str = false;
    esc = false;

    for ch in candidate.chars() {
        if esc {
            esc = false;
            continue;
        }
        if ch == '\\' && in_str {
            esc = true;
            continue;
        }
        if ch == '"' {
            in_str = !in_str;
            continue;
        }
        if in_str {
            continue;
        }
        match ch {
            '{' => open_braces += 1,
            '}' => open_braces -= 1,
            '[' => open_brackets += 1,
            ']' => open_brackets -= 1,
            _ => {}
        }
    }

    if open_braces <= 0 && open_brackets <= 0 {
        return None; // 括号已平衡，不需要自愈
    }

    // 去掉尾部不完整的 key-value（逗号、冒号、空白结尾）
    let trimmed = candidate.trim_end();
    let trimmed = trimmed.trim_end_matches(|c: char| c == ',' || c == ':' || c.is_whitespace());

    // 去掉尾部未赋值的 key（如 , "score":）
    let mut result = trimmed.to_string();
    // 简化版正则：查找尾部的 ,"key": 模式
    if let Some(last_comma) = result.rfind(',') {
        let after_comma = result[last_comma + 1..].trim();
        // 如果逗号后只有一个 "key": 形式的残留
        if after_comma.starts_with('"') && after_comma.ends_with(':') {
            result.truncate(last_comma);
        }
    }

    // 补全闭合括号
    for _ in 0..open_brackets.max(0) {
        result.push(']');
    }
    for _ in 0..open_braces.max(0) {
        result.push('}');
    }

    Some(result)
}

// ==================== 单元测试 ====================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_code_block_extraction() {
        let text = "前置文本\n\n```json\n{\"score\": 85, \"analysis\": \"很好\"}\n```\n\n后置文本";
        let result = parse_agent_json(text).unwrap();
        let val: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val["score"], 85);
    }

    #[test]
    fn test_direct_parse() {
        let text = r#"{"name": "test", "value": 42}"#;
        let result = parse_agent_json(text).unwrap();
        let val: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val["value"], 42);
    }

    #[test]
    fn test_brace_balanced_extraction() {
        let text = r#"这是 AI 的回答：{"score": 75, "detail": "内容"} 以上就是分析结果。"#;
        let result = parse_agent_json(text).unwrap();
        let val: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val["score"], 75);
    }

    #[test]
    fn test_truncated_heal_missing_braces() {
        let text = r#"{"score": 85, "findings": ["发现1", "发现2""#;
        let result = parse_agent_json(text).unwrap();
        let val: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val["score"], 85);
    }

    #[test]
    fn test_truncated_heal_in_string() {
        let text = r#"{"score": 85, "analysis": "这是一段分析文"#;
        let result = parse_agent_json(text).unwrap();
        let val: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val["score"], 85);
    }

    #[test]
    fn test_no_json_should_error() {
        let text = "这里完全没有任何 JSON 内容，只有纯文本。";
        assert!(parse_agent_json(text).is_err());
    }

    #[test]
    fn test_empty_text_should_error() {
        assert!(parse_agent_json("").is_err());
    }

    #[test]
    fn test_nested_braces() {
        let text = r#"分析如下：{"outer": {"inner": {"deep": 1}}, "list": [1, 2, 3]} 结束"#;
        let result = parse_agent_json(text).unwrap();
        let val: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(val["outer"]["inner"]["deep"], 1);
    }
}
