/**
 * PromptSyncModal — 一键同步全体 Agent System Prompt
 *
 * 读取当前管线中所有 Agent 节点的 prompt，
 * 根据管线中 Report 节点的 sections 自动生成输出格式后缀指令，
 * 用户确认后批量追加到所有 Agent 的 prompt 尾部。
 */

import { useState, useMemo, useCallback } from 'react'
import { X, Wand2, Check, Copy, ChevronDown } from 'lucide-react'
import { useStudioStore, type StudioNodeData } from '@/lib/studioStore'
import type { ReportBlockMeta } from '@/types/blocks'

interface PromptSyncModalProps {
  open: boolean
  onClose: () => void
}

export default function PromptSyncModal({ open, onClose }: PromptSyncModalProps) {
  const { nodes, updateNodeConfig } = useStudioStore()
  const [suffix, setSuffix] = useState('')
  const [applied, setApplied] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // 提取所有 Agent 节点及其当前 prompt
  const agentNodes = useMemo(() => {
    return nodes
      .filter(n => {
        const d = n.data as unknown as StudioNodeData
        return d.blockType === 'agent' && d.label !== 'START' && d.label !== 'END'
      })
      .map(n => {
        const d = n.data as unknown as StudioNodeData
        const currentPrompt = (d.config?.prompt as string) || (d.config?.system_prompt as string) || ''
        return { id: n.id, label: d.label, prompt: currentPrompt, blockId: d.blockId }
      })
  }, [nodes])

  // 提取管线中所有 Report 节点的 sections 类型
  const reportSections = useMemo(() => {
    const sections: { reportName: string; sectionId: string; sectionType: string }[] = []
    for (const n of nodes) {
      const d = n.data as unknown as StudioNodeData
      if (d.blockType === 'report') {
        const meta = d.meta as ReportBlockMeta | undefined
        if (meta?.sections) {
          for (const sec of meta.sections) {
            sections.push({ reportName: d.label, sectionId: sec.id, sectionType: sec.type })
          }
        }
      }
    }
    return sections
  }, [nodes])

  // 自动生成格式后缀
  const generateSuffix = useCallback(() => {
    if (reportSections.length === 0) {
      setSuffix('【输出格式要求】\n请确保你的分析结果包含结构化数据，便于报告组件消费。')
      return
    }
    const lines = ['【输出格式要求】', '你的分析结果将被以下报告组件消费，请确保输出包含对应的结构化字段：', '']
    for (const sec of reportSections) {
      lines.push(`- ${sec.sectionType}（${sec.sectionId}）— 来自 ${sec.reportName}`)
    }
    lines.push('')
    lines.push('请在你的输出中包含：')

    const types = new Set(reportSections.map(s => s.sectionType))
    if (types.has('radar')) lines.push('- score: 数值评分（0-100）')
    if (types.has('bar_chart')) lines.push('- score: 数值评分（0-100），带维度标签')
    if (types.has('table')) lines.push('- 结构化列表数据（risk/severity/sourceAgent/suggestion）')
    if (types.has('markdown_card')) lines.push('- reasoning: 完整的分析推理文本')
    if (types.has('llm_generated')) lines.push('- 清晰的摘要/分析文本')
    if (types.has('timeline')) lines.push('- 带日期的事件列表（date/title/description/importance）')

    setSuffix(lines.join('\n'))
  }, [reportSections])

  // 批量应用后缀到所有 Agent 的 prompt
  const handleApply = useCallback(() => {
    if (!suffix.trim()) return
    for (const agent of agentNodes) {
      const promptKey = agent.prompt ? 'prompt' : 'system_prompt'
      const newPrompt = agent.prompt
        ? `${agent.prompt}\n\n${suffix}`
        : suffix
      updateNodeConfig(agent.id, { [promptKey]: newPrompt })
    }
    setApplied(true)
    setTimeout(() => setApplied(false), 2000)
  }, [suffix, agentNodes, updateNodeConfig])

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div
        className="w-[640px] max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--novo-bg-base)', border: '1px solid var(--novo-border-default)', boxShadow: 'var(--novo-shadow-lg)' }}
      >
        {/* 头部 */}
        <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: 'var(--novo-border-default)' }}>
          <Wand2 className="w-4 h-4" style={{ color: 'var(--novo-accent-primary)' }} />
          <span className="text-sm font-bold flex-1" style={{ color: 'var(--novo-text-primary)' }}>同步 Prompt</span>
          <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: 'var(--novo-accent-primary-light)', color: 'var(--novo-accent-primary)' }}>
            {agentNodes.length} Agent · {reportSections.length} 报告组件
          </span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--novo-bg-hover)]">
            <X className="w-4 h-4" style={{ color: 'var(--novo-text-muted)' }} />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Agent Prompt 列表 */}
          <div>
            <div className="text-[10px] font-semibold mb-2" style={{ color: 'var(--novo-text-muted)' }}>当前 Agent Prompt</div>
            <div className="space-y-1.5">
              {agentNodes.map(agent => (
                <div key={agent.id} className="rounded-lg" style={{ background: 'var(--novo-bg-surface)', border: '1px solid var(--novo-border-default)' }}>
                  <button
                    onClick={() => toggleExpand(agent.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left"
                  >
                    <ChevronDown
                      className="w-3 h-3 transition-transform shrink-0"
                      style={{ transform: expandedNodes.has(agent.id) ? 'none' : 'rotate(-90deg)', color: 'var(--novo-text-disabled)' }}
                    />
                    <span className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-primary)' }}>{agent.label}</span>
                    <span className="text-[8px] ml-auto" style={{ color: 'var(--novo-text-disabled)' }}>
                      {agent.prompt ? `${agent.prompt.length} 字符` : '无 prompt'}
                    </span>
                  </button>
                  {expandedNodes.has(agent.id) && agent.prompt && (
                    <div className="px-3 pb-2">
                      <pre className="text-[9px] leading-relaxed whitespace-pre-wrap p-2 rounded"
                        style={{ background: 'var(--novo-bg-base)', color: 'var(--novo-text-secondary)', maxHeight: 120, overflow: 'auto' }}>
                        {agent.prompt}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
              {agentNodes.length === 0 && (
                <div className="text-[9px] text-center py-4" style={{ color: 'var(--novo-text-disabled)' }}>
                  当前管线无 Agent 节点
                </div>
              )}
            </div>
          </div>

          {/* 报告组件列表 */}
          {reportSections.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--novo-text-muted)' }}>管线报告组件</div>
              <div className="flex flex-wrap gap-1">
                {reportSections.map((sec, i) => (
                  <span key={i} className="text-[8px] px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A' }}>
                    {sec.sectionType}({sec.sectionId})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 格式后缀编辑 */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-muted)' }}>输出格式后缀</span>
              <button
                onClick={generateSuffix}
                className="text-[9px] px-2 py-0.5 rounded-lg font-medium"
                style={{ background: 'var(--novo-accent-primary-light)', color: 'var(--novo-accent-primary)' }}
              >
                <Wand2 className="w-2.5 h-2.5 inline mr-0.5" />
                自动生成
              </button>
              {suffix && (
                <button
                  onClick={() => navigator.clipboard.writeText(suffix)}
                  className="text-[9px] px-2 py-0.5 rounded-lg font-medium hover:bg-[var(--novo-bg-hover)]"
                  style={{ color: 'var(--novo-text-muted)' }}
                >
                  <Copy className="w-2.5 h-2.5 inline mr-0.5" />
                  复制
                </button>
              )}
            </div>
            <textarea
              value={suffix}
              onChange={e => setSuffix(e.target.value)}
              placeholder="点击「自动生成」或手动输入要追加到所有 Agent prompt 尾部的格式要求..."
              rows={6}
              className="w-full px-3 py-2 rounded-lg text-[10px] outline-none resize-y font-mono"
              style={{
                background: 'var(--novo-bg-surface)',
                color: 'var(--novo-text-primary)',
                border: '1px solid var(--novo-border-default)',
              }}
            />
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: 'var(--novo-border-default)' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[10px] font-medium" style={{ color: 'var(--novo-text-muted)' }}>
            取消
          </button>
          <button
            onClick={handleApply}
            disabled={!suffix.trim() || agentNodes.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-semibold disabled:opacity-40"
            style={{ background: 'var(--novo-accent-primary)', color: 'white' }}
          >
            {applied ? <Check className="w-3 h-3" /> : <Wand2 className="w-3 h-3" />}
            {applied ? '已应用' : `应用到全部 (${agentNodes.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
