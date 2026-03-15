//! Novoscan 核心计算引擎（Rust → WASM）
//!
//! 包含两个核心模块：
//! - `score_engine`: 质量守卫评分引擎（9 维检查）
//! - `json_healer`: AI 输出 JSON 自愈解析器（4 层策略）

mod score_engine;
mod json_healer;

use wasm_bindgen::prelude::*;

// ==================== WASM 导出接口 ====================

/// 质量守卫评分检查 — WASM 入口
///
/// 接收 JSON 字符串格式的输入（ArbitrationResult + AgentOutput[] + 可选 DebateRecord），
/// 返回 JSON 字符串格式的 QualityCheckResult。
///
/// 此函数是 TypeScript `qualityGuard()` 的 Rust 等价实现，
/// 行为完全一致（通过同一组 vitest 测试用例验证）。
#[wasm_bindgen(js_name = "qualityGuard")]
pub fn quality_guard_wasm(input_json: &str) -> Result<String, JsError> {
    let input: score_engine::QualityGuardInput =
        serde_json::from_str(input_json).map_err(|e| JsError::new(&format!("输入 JSON 解析失败: {}", e)))?;

    let result = score_engine::quality_guard(&input.arbitration, &input.agents, input.debate_record.as_ref());

    serde_json::to_string(&result).map_err(|e| JsError::new(&format!("输出序列化失败: {}", e)))
}

/// JSON 自愈解析器 — WASM 入口
///
/// 接收 AI 模型的原始文本输出，尝试 4 层策略提取有效 JSON：
/// 1. 代码块提取 (```json ... ```)
/// 2. 直接 JSON.parse
/// 3. 花括号平衡匹配
/// 3.5. 截断 JSON 自愈（补全缺失的闭合符号）
/// 4. 最终兜底（firstBrace + lastBrace）
///
/// 返回提取的 JSON 字符串，如果失败则返回错误。
#[wasm_bindgen(js_name = "parseAgentJSON")]
pub fn parse_agent_json_wasm(text: &str) -> Result<String, JsError> {
    json_healer::parse_agent_json(text)
        .map_err(|e| JsError::new(&e))
}

/// 版本号 — 用于前端检测 WASM 是否加载成功
#[wasm_bindgen(js_name = "version")]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
