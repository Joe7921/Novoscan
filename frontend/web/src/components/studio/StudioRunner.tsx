/**
 * Phase G2: StudioRunner — Agentic 调优面板
 *
 * 在 Studio 画布中嵌入试运行面板，输入测试 query，
 * 执行当前管线，实时更新节点状态（idle→running→done/error）。
 */

import { useState, useCallback, useRef } from 'react'
import { Play, Square, Loader2, Terminal, ChevronDown, ChevronUp } from 'lucide-react'
import { useStudioStore, type StudioNodeData } from '@/lib/studioStore'
import { useDebugStore } from '@/lib/debugStore'
import { startAnalysisStream } from '@/lib/api'
import { consumeSSE } from '@/lib/sse'

export default function StudioRunner() {
  const { nodes, currentFilename } = useStudioStore()
  const { updateNodeFromSSE } = useDebugStore()
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('studio-runner-expanded') === 'true' } catch { return false }
  })
  const [logs, setLogs] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const setNodeStatus = useCallback((nodeId: string, status: StudioNodeData['status']) => {
    useStudioStore.setState(s => ({
      nodes: s.nodes.map(n =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, status } }
          : n
      ),
    }))
  }, [])

  const resetNodeStatuses = useCallback(() => {
    useStudioStore.setState(s => ({
      nodes: s.nodes.map(n => ({
        ...n,
        data: { ...n.data, status: 'idle' },
      })),
    }))
  }, [])

  const handleRun = useCallback(async () => {
    if (!query.trim() || running) return
    setRunning(true)
    setLogs([])
    resetNodeStatuses()

    const ac = new AbortController()
    abortRef.current = ac

    const req = {
      user_raw_input: query.trim(),
      detection_type: 'auto',
      pipeline: currentFilename || null,
    }

    try {
      const res = await startAnalysisStream(req, ac.signal)
      if (!res.ok) {
        setLogs(prev => [...prev, `[ERROR] HTTP ${res.status}`])
        setRunning(false)
        return
      }

      await consumeSSE(res, (sseEvt) => {
        const { event: type, data } = sseEvt
        if (type === 'node_enter') {
          const nodeId = (data as Record<string, unknown>).node as string
          setNodeStatus(nodeId, 'running')
          setLogs(prev => [...prev, `▶ 进入节点: ${nodeId}`])
        } else if (type === 'node_exit' || type === 'node_done') {
          const d = data as Record<string, unknown>
          const nodeId = d.node as string
          setNodeStatus(nodeId, 'done')
          setLogs(prev => [...prev, `✓ 完成节点: ${nodeId}${d.duration_ms ? ` (${d.duration_ms}ms)` : ''}`])
          // S2.3: 写入 debugStore 缓存
          if (d.inputs || d.outputs) {
            updateNodeFromSSE(nodeId, {
              inputs: (d.inputs || {}) as Record<string, unknown>,
              outputs: (d.outputs || {}) as Record<string, unknown>,
              duration_ms: (d.duration_ms as number) || 0,
            })
          }
        } else if (type === 'tool_call') {
          const tool = (data as Record<string, unknown>).tool_name as string
          setLogs(prev => [...prev, `🔧 调用工具: ${tool}`])
        } else if (type === 'error') {
          setLogs(prev => [...prev, `[ERROR] ${(data as Record<string, unknown>).message}`])
        } else if (type === 'done') {
          setLogs(prev => [...prev, `✅ 运行完成`])
        }
      }, (err) => {
        setLogs(prev => [...prev, `[ERROR] ${err.message}`])
      })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setLogs(prev => [...prev, `[ERROR] ${(err as Error).message}`])
      }
    } finally {
      setRunning(false)
    }
  }, [query, running, currentFilename, setNodeStatus, resetNodeStatuses])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setRunning(false)
  }, [])

  return (
    <div
      className="border-t"
      style={{ borderColor: 'var(--novo-border-default)', background: 'var(--novo-bg-elevated)' }}
    >
      {/* 折叠头 */}
      <button
        onClick={() => { const next = !expanded; setExpanded(next); try { localStorage.setItem('studio-runner-expanded', String(next)) } catch {} }}
        className="w-full flex items-center gap-2 px-4 py-2 text-[10px] font-semibold hover:bg-[var(--novo-bg-hover)]"
        style={{ color: 'var(--novo-text-secondary)' }}
      >
        <Terminal className="w-3.5 h-3.5" />
        调试运行
        {running && <Loader2 className="w-3 h-3 animate-spin ml-1" style={{ color: 'var(--novo-accent-warning)' }} />}
        <span className="ml-auto">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2 max-h-[200px] overflow-y-auto">
          {/* 输入 */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRun()}
              placeholder="输入测试 query..."
              disabled={running}
              className="flex-1 px-3 py-1.5 rounded-lg text-[10px] outline-none novo-input"
            />
            {running ? (
              <button onClick={handleStop} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold"
                style={{ background: '#EF4444', color: 'white' }}>
                <Square className="w-3 h-3" /> 停止
              </button>
            ) : (
              <button onClick={handleRun} disabled={!query.trim()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-40"
                style={{ background: 'var(--novo-accent-primary)', color: 'white' }}>
                <Play className="w-3 h-3" /> 运行
              </button>
            )}
          </div>

          {/* 日志 */}
          {logs.length > 0 && (
            <div
              className="max-h-32 overflow-y-auto rounded-lg px-3 py-2 space-y-0.5 font-mono text-[9px]"
              style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-secondary)' }}
            >
              {logs.map((log, i) => (
                <div key={i} style={{ color: log.includes('[ERROR]') ? '#EF4444' : undefined }}>
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
