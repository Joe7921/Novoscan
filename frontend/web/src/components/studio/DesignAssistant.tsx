/**
 * Phase 10a-UX: DesignAssistant — 对话式设计助手（常驻右侧边栏）
 *
 * Windsurf/Cursor 风格的 AI 辅助面板：
 * - Turn-based 消息模型（用户 Turn / 助手 Turn）
 * - 助手 Turn 包含多个 Step（thinking / tool_call / text）
 * - 可折叠 ToolCallCard + ThinkingIndicator + StepTimeline
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Send, Bot, Zap, Trash2, Sparkles, Copy, Check, Loader2 } from 'lucide-react'
import { useStudioStore } from '@/lib/studioStore'
import { assistantChatStream } from '@/lib/api'
import { consumeSSE } from '@/lib/sse'
import type { YAMLPreview } from './YAMLPreviewCard'
import ThinkingIndicator from './ThinkingIndicator'
import ToolCallCard from './ToolCallCard'
import type { ToolCallStep } from './ToolCallCard'
import StepTimeline from './StepTimeline'
import type { TimelineItem } from './StepTimeline'
import ConfigPreviewCard from './ConfigPreviewCard'

// ── Turn / Step 消息模型 ──

interface ConfigPreview {
  changes: string[]
  warnings: string[]
  reloadOk: boolean
  configSnapshot: {
    temperature?: number
    max_iterations?: number
    tools_enabled?: string[]
    tools_disabled?: string[]
  }
}

interface Step {
  id: string
  type: 'thinking' | 'tool_call' | 'text' | 'config_preview'
  status: 'running' | 'done' | 'error'
  thinkingDurationMs?: number
  toolCall?: ToolCallStep
  configPreview?: ConfigPreview
  content?: string
}

interface Turn {
  id: string
  role: 'user' | 'assistant'
  content?: string
  steps: Step[]
  timestamp: number
}

// ── 快捷命令分组 ──

const QUICK_COMMANDS_GROUPS = [
  {
    group: '创建组件',
    items: [
      { label: '创建评分 Agent', cmd: '帮我创建一个新的评分 Agent，评估技术创新可行性' },
      { label: '添加搜索节点', cmd: '在当前管线中添加一个学术搜索节点' },
    ],
  },
  {
    group: '优化管线',
    items: [
      { label: '管线优化建议', cmd: '分析当前管线拓扑，给出优化建议' },
      { label: '同步 Prompt', cmd: '根据报告组件同步全体 Agent Prompt' },
    ],
  },
  {
    group: '导出模板',
    items: [
      { label: '导出为模板', cmd: '将当前管线导出为可复用模板' },
    ],
  },
]

const AGENTIC_COMMANDS_GROUPS = [
  {
    group: '策略调优',
    items: [
      { label: '调优 ReAct 策略', cmd: '分析当前管线的 ReAct 检索策略，给出调优方案' },
      { label: '多轮迭代配置', cmd: '为当前管线配置多轮迭代和自动反思机制' },
    ],
  },
  {
    group: '诊断分析',
    items: [
      { label: '工具链诊断', cmd: '诊断 Agent 工具调用链路，检测可能的瓶颈' },
      { label: 'Token 用量预估', cmd: '预估当前管线单次运行的 Token 消耗' },
      { label: 'Prompt 格式对齐', cmd: '分析各 Agent 输出格式是否与过滤器 Agent 输入兼容' },
    ],
  },
]

// ── 辅助：生成唯一 ID ──
let _stepSeq = 0
const nextStepId = () => `step_${Date.now()}_${++_stepSeq}`

export default function DesignAssistant() {
  const studioMode = useStudioStore(s => s.studioMode)
  const [turns, setTurns] = useState<Turn[]>([
    {
      id: 'welcome',
      role: 'assistant',
      steps: [{
        id: 'welcome_text',
        type: 'text',
        status: 'done',
        content: '你好！我是 Studio 设计助手。你可以用自然语言描述你想创建的管线或积木，我会帮你生成配置。\n\n试试下面的快捷命令，或直接输入你的需求。',
      }],
      timestamp: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  // 模式切换时重置对话
  useEffect(() => {
    setTurns([{
      id: `welcome_${Date.now()}`,
      role: 'assistant',
      steps: [{
        id: 'mode_switch_text',
        type: 'text',
        status: 'done',
        content: studioMode === 'agentic'
          ? '已切换到 Agentic 智能体工作流模式。我可以帮你调优 ReAct 策略、诊断工具链、配置多轮迭代等。\n\n试试下面的快捷命令。'
          : '已切换到 Standard 传统工作流模式。你可以用自然语言描述你想创建的管线或积木，我会帮你生成配置。\n\n试试下面的快捷命令。',
      }],
      timestamp: Date.now(),
    }])
    setInput('')
  }, [studioMode])

  const [streaming, setStreaming] = useState(false)
  const [llmAvailable, setLlmAvailable] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const { nodes, edges } = useStudioStore()

  // ── 辅助：更新最后一个 assistant turn 的 steps ──
  const updateLastAssistantSteps = useCallback(
    (updater: (steps: Step[]) => Step[]) => {
      setTurns(prev => {
        const last = prev[prev.length - 1]
        if (last?.role !== 'assistant') return prev
        return [...prev.slice(0, -1), { ...last, steps: updater(last.steps) }]
      })
    },
    [],
  )

  // ── 生成对话历史（用于 API 请求） ──
  const buildHistory = useCallback(() => {
    const hist: { role: string; content: string }[] = []
    for (const t of turns) {
      if (t.role === 'user' && t.content) {
        hist.push({ role: 'user', content: t.content })
      } else if (t.role === 'assistant') {
        const textContent = t.steps
          .filter(s => s.type === 'text' && s.content)
          .map(s => s.content)
          .join('\n')
        if (textContent) hist.push({ role: 'assistant', content: textContent })
      }
    }
    return hist
  }, [turns])

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || streaming) return
    setInput('')

    // 用户 Turn
    const userTurn: Turn = { id: `user_${Date.now()}`, role: 'user', content: msg, steps: [], timestamp: Date.now() }
    // 助手 Turn 占位
    const assistantTurnId = `asst_${Date.now()}`
    const assistantTurn: Turn = { id: assistantTurnId, role: 'assistant', steps: [], timestamp: Date.now() }

    setTurns(prev => [...prev, userTurn, assistantTurn])

    if (llmAvailable) {
      setStreaming(true)
      const ac = new AbortController()
      abortRef.current = ac

      try {
        const history = buildHistory()
        const context = {
          nodes: nodes.map(n => ({ id: n.id, label: (n.data as { label?: string }).label })),
          edges: edges.map(e => ({ source: e.source, target: e.target })),
        }

        const res = await assistantChatStream({
          message: msg,
          mode: studioMode,
          context,
          history,
        }, ac.signal)

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        await consumeSSE(res, (evt) => {
          if (evt.event === 'thinking') {
            const status = evt.data.status as string
            if (status === 'start') {
              const thinkStep: Step = { id: nextStepId(), type: 'thinking', status: 'running' }
              updateLastAssistantSteps(steps => [...steps, thinkStep])
            } else if (status === 'end') {
              const dur = evt.data.duration_ms as number
              updateLastAssistantSteps(steps => {
                const idx = [...steps].reverse().findIndex(s => s.type === 'thinking' && s.status === 'running')
                if (idx < 0) return steps
                const realIdx = steps.length - 1 - idx
                const updated = [...steps]
                updated[realIdx] = { ...updated[realIdx], status: 'done', thinkingDurationMs: dur }
                return updated
              })
            }
          } else if (evt.event === 'token') {
            const token = evt.data.token as string
            updateLastAssistantSteps(steps => {
              const last = steps[steps.length - 1]
              if (last?.type === 'text' && last.status === 'running') {
                const updated = [...steps]
                updated[updated.length - 1] = { ...last, content: (last.content || '') + token }
                return updated
              }
              return [...steps, { id: nextStepId(), type: 'text', status: 'running', content: token }]
            })
          } else if (evt.event === 'tool_call') {
            const toolCall: ToolCallStep = {
              toolName: evt.data.tool_name as string,
              toolLabel: (evt.data.tool_label as string) || (evt.data.tool_name as string),
              argsSummary: (evt.data.args_summary as string) || '',
              args: (evt.data.args as Record<string, unknown>) || {},
              status: 'running',
            }
            const step: Step = { id: nextStepId(), type: 'tool_call', status: 'running', toolCall }
            // 如果前一个 text step 还在 running，先标记为 done
            updateLastAssistantSteps(steps => {
              const newSteps = [...steps]
              const last = newSteps[newSteps.length - 1]
              if (last?.type === 'text' && last.status === 'running') {
                newSteps[newSteps.length - 1] = { ...last, status: 'done' }
              }
              return [...newSteps, step]
            })
          } else if (evt.event === 'yaml_preview') {
            const preview: YAMLPreview = {
              blockType: evt.data.block_type as YAMLPreview['blockType'],
              blockId: evt.data.block_id as string,
              content: evt.data.content as string,
            }
            const linkedTool = evt.data.tool_name as string | undefined
            updateLastAssistantSteps(steps => {
              if (linkedTool) {
                const idx = [...steps].reverse().findIndex(
                  s => s.type === 'tool_call' && s.toolCall?.toolName === linkedTool
                )
                if (idx >= 0) {
                  const realIdx = steps.length - 1 - idx
                  const updated = [...steps]
                  updated[realIdx] = {
                    ...updated[realIdx],
                    toolCall: { ...updated[realIdx].toolCall!, yamlPreview: preview },
                  }
                  return updated
                }
              }
              // 回退：最后一个 tool_call
              const lastToolIdx = [...steps].reverse().findIndex(s => s.type === 'tool_call')
              if (lastToolIdx >= 0) {
                const realIdx = steps.length - 1 - lastToolIdx
                const updated = [...steps]
                updated[realIdx] = {
                  ...updated[realIdx],
                  toolCall: { ...updated[realIdx].toolCall!, yamlPreview: preview },
                }
                return updated
              }
              return steps
            })
          } else if (evt.event === 'config_preview') {
            const preview: ConfigPreview = {
              changes: (evt.data.changes as string[]) || [],
              warnings: (evt.data.warnings as string[]) || [],
              reloadOk: evt.data.reload_ok as boolean,
              configSnapshot: (evt.data.config_snapshot as ConfigPreview['configSnapshot']) || {},
            }
            const step: Step = { id: nextStepId(), type: 'config_preview', status: 'done', configPreview: preview }
            updateLastAssistantSteps(steps => [...steps, step])
          } else if (evt.event === 'tool_done') {
            const toolName = evt.data.tool_name as string
            const success = evt.data.success as boolean
            updateLastAssistantSteps(steps => {
              const idx = [...steps].reverse().findIndex(
                s => s.type === 'tool_call' && s.toolCall?.toolName === toolName && s.status === 'running'
              )
              if (idx < 0) return steps
              const realIdx = steps.length - 1 - idx
              const updated = [...steps]
              updated[realIdx] = {
                ...updated[realIdx],
                status: success ? 'done' : 'error',
                toolCall: {
                  ...updated[realIdx].toolCall!,
                  status: success ? 'done' : 'error',
                  resultSummary: evt.data.result_summary as string,
                  durationMs: evt.data.duration_ms as number,
                  hasPreview: evt.data.has_preview as boolean,
                  resultDetail: evt.data.result_detail as string,
                },
              }
              return updated
            })
          } else if (evt.event === 'done') {
            // 标记最后的 text step 为 done
            updateLastAssistantSteps(steps => {
              const last = steps[steps.length - 1]
              if (last?.type === 'text' && last.status === 'running') {
                return [...steps.slice(0, -1), { ...last, status: 'done' }]
              }
              return steps
            })
          } else if (evt.event === 'error') {
            const errMsg = evt.data.message as string
            if (errMsg?.includes('模型未配置')) {
              setLlmAvailable(false)
              updateLastAssistantSteps(() => [{
                id: nextStepId(),
                type: 'text',
                status: 'done',
                content: getPlaceholderResponse(msg, studioMode),
              }])
            }
          }
        })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          updateLastAssistantSteps(steps => {
            const hasContent = steps.some(s => s.type === 'text' && s.content)
            if (!hasContent) {
              return [{ id: nextStepId(), type: 'text', status: 'done', content: getPlaceholderResponse(msg, studioMode) }]
            }
            return steps
          })
        }
      } finally {
        setStreaming(false)
      }
    } else {
      // Placeholder 回复
      setTimeout(() => {
        updateLastAssistantSteps(() => [{
          id: nextStepId(),
          type: 'text',
          status: 'done',
          content: getPlaceholderResponse(msg, studioMode),
        }])
      }, 300)
    }
  }, [input, streaming, llmAvailable, buildHistory, studioMode, nodes, edges, updateLastAssistantSteps])

  const quickGroups = studioMode === 'agentic' ? AGENTIC_COMMANDS_GROUPS : QUICK_COMMANDS_GROUPS
  const accentColor = studioMode === 'agentic' ? '#7C3AED' : 'var(--novo-accent-primary)'

  return (
    <div
      className="flex flex-col w-full h-full"
      style={{ background: 'var(--novo-bg-base)' }}
    >
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--novo-border-default)' }}>
        {studioMode === 'agentic' ? (
          <Zap className="w-4 h-4" style={{ color: '#7C3AED' }} />
        ) : (
          <Bot className="w-4 h-4" style={{ color: 'var(--novo-accent-primary)' }} />
        )}
        <span className="text-xs font-bold flex-1" style={{ color: 'var(--novo-text-primary)' }}>
          {studioMode === 'agentic' ? 'Agentic 智能体调优助手' : '设计助手'}
        </span>
        <span className="text-[8px] px-1.5 py-0.5 rounded-full"
          style={{
            background: studioMode === 'agentic' ? 'rgba(124,58,237,0.1)' : 'rgba(37,99,235,0.1)',
            color: accentColor,
          }}
        >
          {studioMode === 'agentic' ? 'Agentic' : 'Standard'}
        </span>
        {turns.length > 1 && (
          <button
            onClick={() => setTurns([{
              id: `clear_${Date.now()}`,
              role: 'assistant',
              steps: [{ id: 'clear_text', type: 'text', status: 'done', content: '对话已清空。请描述你的需求，或使用快捷命令。' }],
              timestamp: Date.now(),
            }])}
            className="p-1 rounded-lg hover:bg-[var(--novo-bg-hover)] transition-colors"
            title="清空对话"
          >
            <Trash2 className="w-3 h-3" style={{ color: 'var(--novo-text-disabled)' }} />
          </button>
        )}
      </div>

      {/* LLM 状态 */}
      <div className="flex items-center gap-1.5 px-4 py-1.5" style={{ background: llmAvailable ? 'color-mix(in srgb, var(--novo-accent-success) 6%, transparent)' : 'color-mix(in srgb, var(--novo-accent-primary) 6%, transparent)' }}>
        <Sparkles className="w-3 h-3" style={{ color: llmAvailable ? 'var(--novo-accent-success)' : 'var(--novo-accent-primary)' }} />
        <span className="text-[8px] font-medium" style={{ color: llmAvailable ? 'var(--novo-accent-success)' : 'var(--novo-accent-primary)' }}>
          {llmAvailable ? 'AI 对话已连接' : '未配置模型 — 使用内置回复'}
        </span>
      </div>

      {/* 对话 Turn 列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {turns.map((turn) => (
          <div key={turn.id}>
            {turn.role === 'user' ? (
              /* ── 用户气泡 ── */
              <div className="flex justify-end">
                <div
                  className="max-w-[90%] px-3 py-2 rounded-xl text-[10px] leading-relaxed"
                  style={{ background: accentColor, color: 'white' }}
                >
                  <RenderMarkdown text={turn.content || ''} isUser />
                </div>
              </div>
            ) : (
              /* ── 助手 Turn: StepTimeline ── */
              <div className="flex justify-start">
                <div className="max-w-[95%] w-full">
                  <AssistantTurnView steps={turn.steps} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 快捷命令（分组） */}
      <div className="px-3 py-2 border-t space-y-1.5" style={{ borderColor: 'var(--novo-border-default)' }}>
        {quickGroups.map((g, gi) => (
          <div key={gi}>
            <div className="text-[7px] font-semibold mb-0.5" style={{ color: 'var(--novo-text-disabled)' }}>{g.group}</div>
            <div className="flex flex-wrap gap-1">
              {g.items.map((qc, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(qc.cmd)}
                  className="px-2 py-1 rounded-lg text-[8px] font-medium transition-colors hover:bg-[var(--novo-bg-hover)]"
                  style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-secondary)' }}
                >
                  {qc.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 输入框 */}
      <div className="px-3 py-2.5 border-t" style={{ borderColor: 'var(--novo-border-default)' }}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={studioMode === 'agentic' ? '描述调优需求...' : '描述你的需求...'}
            className="flex-1 px-3 py-2 rounded-lg text-[10px] outline-none novo-input"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || streaming}
            className="p-2 rounded-lg disabled:opacity-30"
            style={{ background: accentColor, color: 'white' }}
          >
            {streaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 助手 Turn 视图：时间线 + Steps 渲染 ──

function AssistantTurnView({ steps }: { steps: Step[] }) {
  if (steps.length === 0) return null

  // 只有纯文本时不需要时间线
  const hasNonText = steps.some(s => s.type !== 'text')

  if (!hasNonText) {
    return (
      <>
        {steps.map(step => (
          <div
            key={step.id}
            className="px-3 py-2 rounded-xl text-[10px] leading-relaxed"
            style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-primary)' }}
          >
            <RenderMarkdown text={step.content || ''} isUser={false} />
          </div>
        ))}
      </>
    )
  }

  // 有 thinking 或 tool_call → 渲染时间线
  const timelineItems: TimelineItem[] = steps.map(step => ({
    id: step.id,
    status: step.status,
    children: (
      <>
        {step.type === 'thinking' && (
          <ThinkingIndicator status={step.status} durationMs={step.thinkingDurationMs} />
        )}
        {step.type === 'tool_call' && step.toolCall && (
          <ToolCallCard step={step.toolCall} />
        )}
        {step.type === 'text' && step.content && (
          <div
            className="px-3 py-2 rounded-xl text-[10px] leading-relaxed my-1"
            style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-primary)' }}
          >
            <RenderMarkdown text={step.content} isUser={false} />
          </div>
        )}
        {step.type === 'config_preview' && step.configPreview && (
          <ConfigPreviewCard preview={step.configPreview} />
        )}
      </>
    ),
  }))

  return <StepTimeline items={timelineItems} />
}


// Placeholder 回复 — 未来替换为真正的 LLM 调用
function getPlaceholderResponse(userMsg: string, mode: string): string {
  const lower = userMsg.toLowerCase()

  // Agentic 模式增强回复
  if (mode === 'agentic') {
    if (lower.includes('react') || lower.includes('调优') || lower.includes('策略')) {
      return 'ReAct 调优建议：\n\n1. **max_iterations** 建议设为 8-12，过高会浪费 Token\n2. 开启 **early_stop** 当连续 2 轮无新信息时提前终止\n3. 为 retriever 添加 **relevance_threshold**（0.7）过滤低质量结果\n4. 在 scoring 节点前插入 **context_compressor** 减少 prompt 长度\n\n需要我帮你自动应用这些配置吗？（即将上线）'
    }
    if (lower.includes('工具') || lower.includes('tool') || lower.includes('诊断')) {
      return '工具链诊断结果：\n\n当前管线中检测到 ReAct 检索节点使用了以下工具：\n- search_openalex ✅ 响应正常\n- search_arxiv ✅ 响应正常\n- search_crossref ⚠️ 偶尔超时\n\n建议：\n1. 为 crossref 添加 fallback 机制\n2. 考虑并行搜索策略减少总延迟\n3. 添加 Brave Search 覆盖产业数据'
    }
    if (lower.includes('迭代') || lower.includes('反思')) {
      return '多轮迭代配置方案：\n\n```yaml\niteration:\n  max_rounds: 3\n  reflection: true\n  stop_condition: "score >= 0.85"\n  backtrack_on_fail: true\n```\n\n这会让管线在每轮评分后自动决定是否需要补充检索。预估额外 Token 消耗约 30-50%。'
    }
    if (lower.includes('token') || lower.includes('消耗') || lower.includes('预估')) {
      return 'Token 用量预估（基于当前管线）：\n\n| 节点 | 输入 Token | 输出 Token |\n|---|---|---|\n| intent_analyzer | ~200 | ~300 |\n| react_retriever | ~1500 | ~800 |\n| academic_scorer | ~2000 | ~500 |\n| industry_analyst | ~2000 | ~500 |\n\n**单次运行合计**: ~7,800 Token\n**预估费用**: ¥0.03（DeepSeek-Chat）'
    }
    return '收到你的 Agentic 智能体调优需求！当前智能体工作流支持：\n\n- ReAct 策略调优\n- 工具链诊断与优化\n- 多轮迭代/反思配置\n- Token 用量预估\n- Agent 间协作模式建议\n\n请描述具体的调优场景。'
  }

  // Standard 模式回复
  if (lower.includes('评分') || lower.includes('scorer')) {
    return '好的，我建议创建一个「评分 Agent」积木：\n\n1. 前往 Studio → 设计器\n2. 角色分类选「执行器」\n3. 输入字段：user_raw_input, evidence\n4. 输出字段：score, reasoning\n5. config_schema 加入 system_prompt 和 temperature\n\n需要我帮你自动生成 YAML 吗？（即将上线）'
  }
  if (lower.includes('搜索') || lower.includes('search')) {
    return '在画布左侧积木面板中，找到 Agent 分类下的搜索类积木（如 openalex_searcher），直接拖入画布即可。\n\n别忘了连接边到正确的位置！'
  }
  if (lower.includes('优化') || lower.includes('建议')) {
    return '管线优化建议：\n\n1. 确保每个 Agent 节点只处理单一职责\n2. 搜索结果应先经过「综合器」再到评分器\n3. 添加「评论家」节点做质量审查\n4. 考虑加入 HITL 人工审核点\n\n具体场景建议在 Agent 设计器中逐个调优。'
  }
  if (lower.includes('导出') || lower.includes('模板')) {
    return '你可以通过工具栏的「导出」按钮将当前管线保存为 JSON 文件。\n\n未来版本将支持：\n- 管线模板市场\n- 一键克隆并修改\n- 版本对比'
  }
  if (lower.includes('同步') && lower.includes('prompt')) {
    return 'Prompt 同步功能：\n\n1. 点击工具栏的「同步 Prompt」按钮\n2. 系统会自动读取管线中所有报告组件的类型\n3. 点击「自动生成」生成格式后缀\n4. 确认后一键应用到全部 Agent\n\n这样每个 Agent 的输出就会包含报告组件需要的结构化字段，无需逐个修改。'
  }
  if (lower.includes('过滤器') || lower.includes('filter')) {
    return '过滤器 Agent 是转换层组件，位于上游分析 Agent 和报告组件之间：\n\n1. 在左侧积木栏找到「数据转换」分组\n2. 拖入「报告数据过滤器」或「时间线过滤器」\n3. 连接到评分 Agent 节点和报告节点之间\n4. 在节点配置中设置 target_schema\n\n过滤器会将上游原始输出转为报告组件所需的 JSON 格式。'
  }
  return '收到你的需求！对话式管线设计功能正在开发中，当前我能提供：\n\n- 基础设计建议\n- 快捷操作指引\n- 积木配置参考\n\n请尝试更具体的问题，或使用上方快捷命令。'
}

// ── 简易 Markdown 渲染 ──

function RenderMarkdown({ text, isUser }: { text: string; isUser: boolean }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const parts = useMemo(() => {
    const result: { type: 'text' | 'code'; content: string; lang?: string }[] = []
    const codeBlockRe = /```(\w*)\n([\s\S]*?)```/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = codeBlockRe.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', content: text.slice(lastIndex, match.index) })
      }
      result.push({ type: 'code', content: match[2], lang: match[1] || undefined })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) {
      result.push({ type: 'text', content: text.slice(lastIndex) })
    }
    return result
  }, [text])

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    })
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'code') {
          return (
            <div key={i} className="my-1.5 rounded-lg overflow-hidden" style={{ background: 'var(--novo-bg-base)' }}>
              <div className="flex items-center justify-between px-2 py-1" style={{ background: 'var(--novo-bg-active)' }}>
                <span className="text-[8px] font-mono" style={{ color: 'var(--novo-text-disabled)' }}>{part.lang || 'code'}</span>
                <button
                  onClick={() => handleCopy(part.content, i)}
                  className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded hover:bg-[var(--novo-bg-hover)] transition-colors"
                  style={{ color: 'var(--novo-text-muted)' }}
                >
                  {copiedIdx === i ? <><Check className="w-2.5 h-2.5" /> 已复制</> : <><Copy className="w-2.5 h-2.5" /> 复制</>}
                </button>
              </div>
              <pre className="px-2 py-1.5 text-[9px] font-mono overflow-x-auto whitespace-pre" style={{ color: 'var(--novo-text-secondary)' }}>
                {part.content}
              </pre>
            </div>
          )
        }
        return <span key={i} className="whitespace-pre-wrap">{renderInline(part.content, isUser)}</span>
      })}
    </>
  )
}

function renderInline(text: string, isUser: boolean): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const boldRe = /\*\*(.+?)\*\*/g
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = boldRe.exec(text)) !== null) {
    if (m.index > lastIdx) nodes.push(text.slice(lastIdx, m.index))
    nodes.push(<strong key={m.index} style={{ fontWeight: 700 }}>{m[1]}</strong>)
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < text.length) nodes.push(text.slice(lastIdx))
  return nodes
}
