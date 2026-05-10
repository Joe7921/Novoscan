/**
 * StudioPage — 可视化管线设计画布
 *
 * Phase D: 整合 BlockSidebar + StudioCanvas + NodeConfigDrawer + StudioToolbar + StudioStatusBar
 */

import { useEffect, useState, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { useStudioStore } from '@/lib/studioStore'
import { fetchBlocks, fetchPipeline, savePipeline } from '@/lib/api'
import { BlockSidebar, StudioToolbar, StudioCanvas, NodeConfigDrawer, StudioStatusBar, StudioBottomDrawer, DesignAssistant, AgenticCanvas } from '@/components/studio'
import { useAgenticConfigStore } from '@/lib/agenticConfigStore'

export default function StudioPage() {
  const { setBlocksCache, loadPipeline, selectedNodeId, blocksResponse, studioMode } = useStudioStore()
  const fetchAgenticCfg = useAgenticConfigStore(s => s.fetchConfig)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const init = async () => {
    setLoading(true)
    setError(null)
    try {
      const blocks = await fetchBlocks()
      setBlocksCache(blocks)

      const pipeline = await fetchPipeline('standard.json')
      useStudioStore.getState().loadPipeline(pipeline, 'standard.json')
    } catch (err) {
      console.error('Studio 初始化失败:', err)
      setError((err as Error).message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { init() }, [setBlocksCache])

  // 键盘快捷键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const state = useStudioStore.getState()
    // Delete / Backspace 删除选中节点（不在输入框内）
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedNodeId) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      state.removeNode(state.selectedNodeId)
    }
    // Ctrl+S 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      const { currentFilename, isDirty, toPipelineJSON, markClean } = state
      if (!isDirty || !currentFilename || currentFilename === 'standard.json') return
      const json = toPipelineJSON()
      if (json) savePipeline(currentFilename, json).then(() => markClean()).catch(console.error)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // T4.4: 切换到 Agentic 智能体工作流模式时自动加载配置
  useEffect(() => {
    if (studioMode === 'agentic') {
      fetchAgenticCfg()
    }
  }, [studioMode, fetchAgenticCfg])

  // 加载中
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--novo-bg-base)' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: 'var(--novo-accent-primary)' }} />
          <div className="text-xs font-medium" style={{ color: 'var(--novo-text-muted)' }}>加载 Studio...</div>
        </div>
      </div>
    )
  }

  // 加载失败
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--novo-bg-base)' }}>
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--novo-accent-danger)' }} />
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--novo-text-primary)' }}>Studio 加载失败</div>
          <div className="text-[10px] mb-3" style={{ color: 'var(--novo-text-muted)' }}>{error}</div>
          <button onClick={init} className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg text-[10px] font-medium"
            style={{ background: 'var(--novo-accent-primary)', color: 'white' }}>
            <RotateCcw className="w-3 h-3" /> 重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* 顶部工具栏 */}
        <StudioToolbar />

        {/* 主体：左侧积木栏 + 画布区域 + 右侧 AI 助手 */}
        <div className="flex flex-1 min-h-0">
          {studioMode !== 'agentic' && <BlockSidebar />}
          <div className="flex flex-col flex-1 min-w-0">
            {studioMode === 'agentic' ? <AgenticCanvas /> : <StudioCanvas />}
          </div>
          {/* 右侧面板：选中节点时显示配置，否则显示 AI 助手（Standard/Agentic 统一入口） */}
          <div className="w-72 shrink-0 h-full border-l" style={{ borderColor: 'var(--novo-border-default)' }}>
            {selectedNodeId
              ? <NodeConfigDrawer />
              : <DesignAssistant />
            }
          </div>
        </div>

        {/* 底部抽屉：分析 + 进度 + 运行器 */}
        <StudioBottomDrawer />

        {/* 底部状态栏 */}
        <StudioStatusBar />
      </div>
    </ReactFlowProvider>
  )
}
