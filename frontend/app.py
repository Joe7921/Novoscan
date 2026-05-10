"""
Novoscan-Open-Core Streamlit 调试前端 — Phase 6

功能覆盖：
  P6.1: 基础页面框架（输入区 + 步骤追踪 + 输出区）
  P6.2: 意图交互页（输入 + 分析结果 + 确认/修正按钮）
  P6.3: 检索进度可视化
  P6.4: 评分结果展示（柱状图 + 分差）
  P6.5: 辩论实况显示
  P6.6: 报告输出展示
  P6.7: 积木浏览器

启动方式：
  python -m uv run streamlit run frontend/app.py
"""

import json
import time
import httpx
import streamlit as st
import pandas as pd

# ── 配置 ──
API_BASE = "http://127.0.0.1:8001"
TIMEOUT = 600  # 管线执行超时（秒）

st.set_page_config(
    page_title="Novoscan-Open-Core 调试台",
    page_icon="🔬",
    layout="wide",
    initial_sidebar_state="expanded",
)


# ==============================================================================
# 侧边栏 — 引擎状态 + 积木浏览器（P6.7）
# ==============================================================================

with st.sidebar:
    st.title("🔬 Novoscan Core")
    st.caption("创新性检测引擎 · 调试前端")

    st.divider()

    # 引擎健康检查
    st.subheader("⚙️ 引擎状态")
    try:
        health = httpx.get(f"{API_BASE}/health", timeout=5).json()
        st.success(f"✅ 在线 · v{health.get('version', '?')}")
        st.caption(f"模型: {health.get('model_provider', '?')}")
        st.caption(f"就绪: {'是' if health.get('model_ready') else '否'}")
    except Exception:
        st.error("❌ 引擎离线")
        st.caption(f"请确认 {API_BASE} 可达")

    st.divider()

    # 积木浏览器（P6.7）
    st.subheader("🧱 积木浏览器")
    try:
        blocks_resp = httpx.get(f"{API_BASE}/api/v1/blocks", timeout=5)
        if blocks_resp.status_code == 200:
            blocks_data = blocks_resp.json()
            st.caption(f"共 {blocks_data.get('total', 0)} 个积木")
            for cat, icon in [("agents", "🤖"), ("interactions", "🔄"), ("reports", "📋")]:
                items = blocks_data.get(cat, [])
                if items:
                    with st.expander(f"{icon} {cat.title()} ({len(items)})"):
                        for item in items:
                            st.markdown(f"**{item.get('name', item.get('id', '?'))}**")
                            st.caption(item.get('description', ''))
    except Exception:
        st.caption("积木列表加载失败")

    # 显示管线拓扑
    st.subheader("🔀 管线拓扑")
    st.code(
        "START → 意图分析\n"
        "  → 人工确认\n"
        "  → 智能检索\n"
        "  → 并行评分 (N Agent)\n"
        "  → [辩论] (分差>20)\n"
        "  → 仲裁裁决\n"
        "  → 质量门\n"
        "  → 报告组装\n"
        "→ END",
        language=None,
    )


# ==============================================================================
# 主区域
# ==============================================================================

st.title("🔬 Novoscan-Open-Core 调试台")

# ── 初始化 session_state ──
if "thread_id" not in st.session_state:
    st.session_state.thread_id = None
if "phase" not in st.session_state:
    st.session_state.phase = "input"
if "intent_result" not in st.session_state:
    st.session_state.intent_result = None
if "final_result" not in st.session_state:
    st.session_state.final_result = None


# ==============================================================================
# P6.1 + P6.2: 输入区 + 意图交互
# ==============================================================================

st.header("📝 Step 1: 输入创新想法")

col_input, col_type = st.columns([3, 1])

with col_input:
    user_input = st.text_area(
        "描述你的创新想法",
        value="AI无人机群农业害虫检测",
        height=100,
        placeholder="例如：利用多无人机协同编队，搭载边缘AI芯片，实现大范围农田害虫实时检测...",
    )

with col_type:
    detection_type = st.selectbox(
        "检测类型",
        ["auto", "academic", "industrial", "skill"],
        index=0,
    )

if st.button("🚀 开始分析", type="primary", use_container_width=True):
    with st.spinner("正在分析意图..."):
        try:
            resp = httpx.post(
                f"{API_BASE}/api/v1/analyze",
                json={
                    "user_raw_input": user_input,
                    "detection_type": detection_type,
                },
                timeout=60,
            )
            data = resp.json()
            st.session_state.thread_id = data.get("thread_id")
            st.session_state.intent_result = data.get("analyzed_intent")
            st.session_state.phase = "confirm"
            st.session_state.final_result = None
        except Exception as e:
            st.error(f"❌ 请求失败: {e}")


# ==============================================================================
# P6.2: 意图确认/修正
# ==============================================================================

if st.session_state.phase == "confirm" and st.session_state.intent_result:
    st.header("🎯 Step 2: 确认意图解析")

    intent = st.session_state.intent_result
    st.info(f"**Thread**: `{st.session_state.thread_id[:8]}...`")

    col_idea, col_meta = st.columns([2, 1])

    with col_idea:
        st.subheader("核心创新点")
        st.write(intent.get("core_idea", "未提取"))

    with col_meta:
        st.subheader("关键词")
        keywords = intent.get("keywords", [])
        for kw in keywords:
            st.code(kw)
        st.subheader("领域")
        st.write(intent.get("domain", "未识别"))

    col_confirm, col_revise = st.columns(2)

    with col_confirm:
        if st.button("✅ 确认，继续分析", type="primary", use_container_width=True):
            st.session_state.phase = "running"
            with st.spinner("⏳ 管线执行中（评分 → 辩论 → 仲裁 → 质量门 → 报告）..."):
                try:
                    resp = httpx.post(
                        f"{API_BASE}/api/v1/thread/{st.session_state.thread_id}/resume",
                        json={"action": "confirm"},
                        timeout=TIMEOUT,
                    )
                    data = resp.json()
                    st.session_state.final_result = data
                    st.session_state.phase = "result"
                    st.rerun()
                except Exception as e:
                    st.error(f"❌ 执行失败: {e}")

    with col_revise:
        feedback = st.text_input("修正意见", placeholder="例如：我指的是水稻害虫，不是通用农作物")
        if st.button("🔄 修正", use_container_width=True):
            if feedback:
                with st.spinner("正在重新分析..."):
                    try:
                        resp = httpx.post(
                            f"{API_BASE}/api/v1/thread/{st.session_state.thread_id}/resume",
                            json={"action": "revise", "feedback": feedback},
                            timeout=60,
                        )
                        data = resp.json()
                        st.session_state.intent_result = data.get("analyzed_intent")
                        st.rerun()
                    except Exception as e:
                        st.error(f"❌ 修正失败: {e}")
            else:
                st.warning("请输入修正意见")


# ==============================================================================
# P6.4 + P6.5 + P6.6: 结果展示
# ==============================================================================

if st.session_state.phase == "result" and st.session_state.final_result:
    result = st.session_state.final_result

    st.header("📊 Step 3: 分析结果")

    # ── 顶部指标卡 ──
    col_score, col_status, col_agents, col_gap = st.columns(4)

    with col_score:
        score = result.get("final_score", 0)
        st.metric("最终评分", f"{score:.0f}/100")

    with col_status:
        st.metric("状态", result.get("status", "unknown"))

    with col_agents:
        agents = result.get("evaluation_results", [])
        st.metric("Agent 数量", len(agents))

    with col_gap:
        st.metric("分差", f"{result.get('score_gap', 0):.0f}")

    st.divider()

    # ── P6.4: 评分柱状图 ──
    st.subheader("📊 各 Agent 评分")

    if agents:
        chart_data = pd.DataFrame([
            {
                "Agent": r.get("agent_name", "未知"),
                "评分": r.get("score", 0),
                "置信度": r.get("confidence", "?"),
                "降级": "⚠️" if r.get("is_fallback") else "✅",
            }
            for r in agents
        ])
        st.bar_chart(chart_data.set_index("Agent")["评分"])
        st.dataframe(chart_data, use_container_width=True, hide_index=True)

    st.divider()

    # ── P6.3: 检索进度可视化 ──
    st.subheader("🔍 检索过程")
    search_history = result.get("search_history", [])
    if search_history:
        for i, step in enumerate(search_history, 1):
            if isinstance(step, dict):
                with st.container():
                    col_t, col_a, col_o = st.columns([1, 1, 2])
                    with col_t:
                        st.markdown(f"**💭 思考 #{i}**")
                        st.caption(step.get("thought", "—"))
                    with col_a:
                        st.markdown(f"**⚡ 动作**")
                        st.code(step.get("action", "—"))
                    with col_o:
                        st.markdown(f"**👁 观察**")
                        st.caption(str(step.get("observation", "—"))[:200])
            else:
                st.text(str(step))
        st.caption(f"共 {len(search_history)} 次工具调用")
    else:
        st.info("无检索记录（可能使用了缓存或工具未匹配）")

    st.divider()

    # ── P6.5: 辩论记录 ──
    st.subheader("⚔️ 辩论记录")
    debate_history = result.get("debate_history", [])
    exec_logs = result.get("execution_logs", [])
    gap = result.get("score_gap", 0)

    if debate_history:
        for i, entry in enumerate(debate_history, 1):
            if isinstance(entry, str):
                # 尝试判断发言方
                icon = "🔴" if i % 2 == 1 else "🔵"
                st.markdown(f"{icon} **轮次 {(i+1)//2}** · 发言 {i}")
                st.write(entry)
            elif isinstance(entry, dict):
                speaker = entry.get("speaker", f"发言者{i}")
                content = entry.get("content", "")
                winner = entry.get("winner", "")
                st.markdown(f"**🎤 {speaker}**")
                st.write(content)
                if winner:
                    st.success(f"🏆 本轮胜者: {winner}")
        st.caption(f"共 {len(debate_history)} 条辩论记录")
    else:
        debate_logs = [log for log in exec_logs if "辩论" in log or "debate" in log.lower()]
        if debate_logs:
            for log in debate_logs:
                st.write(f"- {log}")
        elif gap and gap <= 20:
            st.info(f"分差 {gap:.0f} ≤ 20，未触发辩论")
        else:
            st.info("辩论信息暂无详细记录")

    st.divider()

    # ── P6.6: 报告输出 ──
    st.subheader("📋 结构化报告")

    report_json = result.get("report_json")
    if report_json:
        report_body = report_json.get("report", {})

        # 高管摘要
        st.markdown("#### 🏢 高管摘要")
        st.write(report_body.get("executiveSummary", "无"))

        # 雷达图数据
        radar = report_body.get("arbitration", {}).get("radarScores", [])
        if radar:
            st.markdown("#### 🎯 评分雷达")
            radar_df = pd.DataFrame(radar)
            st.dataframe(radar_df, use_container_width=True, hide_index=True)

        # 关键发现
        findings = report_body.get("keyFindings", [])
        if findings:
            st.markdown("#### 💡 关键发现")
            for f in findings:
                title = f.get("title", "") if isinstance(f, dict) else str(f)
                source = f.get("source", "") if isinstance(f, dict) else ""
                st.write(f"- **{title}** _{source}_")

        # 风险清单
        risks = report_body.get("riskFlags", [])
        if risks:
            st.markdown("#### ⚠️ 风险清单")
            risk_df = pd.DataFrame(risks)
            st.dataframe(risk_df, use_container_width=True, hide_index=True)

        # 元数据
        meta = report_body.get("meta", {})
        if meta:
            st.markdown("#### 📐 元数据")
            col_m1, col_m2, col_m3 = st.columns(3)
            with col_m1:
                st.metric("创新等级", meta.get("noveltyLevel", "?"))
            with col_m2:
                st.metric("Agent 均分", f"{meta.get('avgAgentScore', 0):.1f}")
            with col_m3:
                qp = meta.get("qualityPassed")
                st.metric("质量门", "✅ 通过" if qp is None or qp else "⚠️ 有问题")

        # 原始 JSON
        with st.expander("🔍 原始 report_json"):
            st.json(report_json)
    else:
        st.warning("未返回 report_json")

    # ── 仲裁判决全文 ──
    st.divider()
    st.subheader("⚖️ 仲裁判决")
    st.write(result.get("final_judgment", "无"))

    # ── 执行日志 ──
    with st.expander("📜 执行日志"):
        for log in exec_logs:
            st.text(log)

    # ── 完整 API 响应 ──
    with st.expander("🔧 完整 API 响应"):
        st.json(result)

    # ── 重新分析 ──
    st.divider()
    if st.button("🔄 重新分析", use_container_width=True):
        st.session_state.phase = "input"
        st.session_state.thread_id = None
        st.session_state.intent_result = None
        st.session_state.final_result = None
        st.rerun()


# ==============================================================================
# P7: Agentic Mode 对比面板
# ==============================================================================

st.divider()
st.header("🤖 Agentic Mode（P7）")
st.caption("超级 ReAct Agent — LLM 自主决定工具调用顺序和次数，无需固定管线")

col_a_input, col_a_btn = st.columns([3, 1])

with col_a_input:
    agentic_input = st.text_area(
        "Agentic 分析输入",
        value="量子计算在药物发现中的应用",
        height=80,
        key="agentic_input",
    )

with col_a_btn:
    st.write("")
    st.write("")
    agentic_go = st.button("🤖 Agentic 分析", type="secondary", use_container_width=True)

if agentic_go:
    with st.spinner("🤖 Agentic Agent 自主执行中（可能需要 3-5 分钟）..."):
        try:
            resp = httpx.post(
                f"{API_BASE}/api/v1/analyze/agentic",
                json={"user_raw_input": agentic_input, "detection_type": "auto"},
                timeout=TIMEOUT,
            )
            if resp.status_code == 200:
                data = resp.json()
                st.session_state.agentic_result = data
            else:
                st.error(f"❌ Agentic 失败: {resp.status_code} - {resp.text[:200]}")
        except Exception as e:
            st.error(f"❌ 请求失败: {e}")

if "agentic_result" in st.session_state and st.session_state.agentic_result:
    ag = st.session_state.agentic_result

    # 指标卡
    col_m1, col_m2, col_m3 = st.columns(3)
    with col_m1:
        st.metric("模式", "🤖 Agentic")
    with col_m2:
        st.metric("工具调用次数", ag.get("tool_calls_count", 0))
    with col_m3:
        st.metric("消息轮次", ag.get("message_count", 0))

    # 工具调用链
    st.subheader("🔗 工具调用链")
    tool_calls = ag.get("tool_calls", [])
    if tool_calls:
        chain_str = " → ".join(tc.get("tool", "?") for tc in tool_calls)
        st.code(chain_str, language=None)

        with st.expander(f"📋 工具调用详情 ({len(tool_calls)} 次)"):
            for i, tc in enumerate(tool_calls, 1):
                st.markdown(f"**{i}. {tc.get('tool', '?')}**")
                st.caption(tc.get("args_preview", "")[:150])

    # 最终输出
    st.subheader("📝 Agent 最终输出")
    st.markdown(ag.get("final_output", "无输出"))

    with st.expander("🔧 完整 API 响应"):
        st.json(ag)
