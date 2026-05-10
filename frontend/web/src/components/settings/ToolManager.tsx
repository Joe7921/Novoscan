/**
 * ToolManager — 工具注册表完整管理界面
 *
 * 支持：列表展示 / 添加 / 编辑 / 删除 / 导入 / 导出
 */

import { useState, useEffect, useRef } from 'react'
import {
  Wrench, Plus, Pencil, Trash2, Download, Upload, X,
  Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react'
import {
  fetchTools, createTool, updateTool, deleteTool,
  getToolExportUrl, importTool,
} from '@/lib/api'
import type { ToolDescriptor } from '@/types/blocks'

const DEFAULT_YAML = `id: my_custom_tool
name: 自定义工具
description: 工具描述（给 LLM 看的）
type: http
endpoint: https://api.example.com/search
method: GET
tags: [custom]
detection_types: [auto]
config:
  max_results: { type: integer, default: 10 }
`

export default function ToolManager() {
  const [tools, setTools] = useState<ToolDescriptor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  // 编辑/新建
  const [editMode, setEditMode] = useState<'create' | 'edit' | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [yaml, setYaml] = useState('')
  const [saving, setSaving] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const r = await fetchTools()
      setTools(r.tools)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [])

  function showToast(type: 'ok' | 'err', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  function openCreate() {
    setEditMode('create')
    setEditId(null)
    setYaml(DEFAULT_YAML)
  }

  function openEdit(t: ToolDescriptor) {
    if (t.type !== 'http' && t.type !== 'mcp') {
      showToast('err', '仅可编辑自定义工具（HTTP/MCP）')
      return
    }
    setEditMode('edit')
    setEditId(t.id)
    // 构造简易 YAML 预填
    const lines = [
      `id: ${t.id}`,
      `name: ${t.name}`,
      `description: ${t.description}`,
      `type: ${t.type}`,
      t.endpoint ? `endpoint: ${t.endpoint}` : null,
      `method: ${t.method || 'GET'}`,
      t.tags.length > 0 ? `tags: [${t.tags.join(', ')}]` : null,
      t.detection_types.length > 0 ? `detection_types: [${t.detection_types.join(', ')}]` : null,
    ].filter(Boolean).join('\n')
    setYaml(lines + '\n')
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (editMode === 'create') {
        await createTool(yaml)
        showToast('ok', '工具创建成功')
      } else if (editMode === 'edit' && editId) {
        await updateTool(editId, yaml)
        showToast('ok', '工具更新成功')
      }
      setEditMode(null)
      await reload()
    } catch (e) {
      showToast('err', (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(`确认删除工具 "${id}"？`)) return
    try {
      await deleteTool(id)
      showToast('ok', '已删除')
      await reload()
    } catch (e) {
      showToast('err', (e as Error).message)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await importTool(file)
      showToast('ok', '导入成功')
      await reload()
    } catch (err) {
      showToast('err', (err as Error).message)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const isBuiltin = (t: ToolDescriptor) => {
    // 内置工具不可编辑/删除
    return t.type === 'local'
  }

  return (
    <div className="space-y-4">
      {/* 标题行 */}
      <div className="flex items-center gap-2">
        <Wrench className="w-4 h-4" style={{ color: 'var(--novo-accent-info)' }} />
        <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>工具注册表</h3>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full ml-auto"
          style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-muted)' }}>
          {tools.length} 个工具
        </span>
      </div>

      {/* 操作栏 */}
      <div className="flex gap-2">
        <button onClick={openCreate}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
          style={{ background: 'var(--novo-accent-primary)', color: 'white' }}>
          <Plus className="w-3 h-3" /> 添加工具
        </button>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
          style={{ border: '1px solid var(--novo-border-default)', color: 'var(--novo-text-secondary)' }}>
          <Upload className="w-3 h-3" /> 导入 YAML
        </button>
        <input ref={fileRef} type="file" accept=".yaml,.yml" className="hidden" onChange={handleImport} />
      </div>

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px]"
          style={{
            background: toast.type === 'ok' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)',
            color: toast.type === 'ok' ? '#16A34A' : '#DC2626',
          }}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {toast.msg}
        </div>
      )}

      {/* 加载/错误 */}
      {loading && (
        <div className="flex items-center gap-2 text-xs py-4" style={{ color: 'var(--novo-text-muted)' }}>
          <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* 工具列表 */}
      {!loading && tools.length > 0 && (
        <div className="space-y-1.5">
          {tools.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg group"
              style={{ background: 'var(--novo-bg-surface)' }}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--novo-text-primary)' }}>
                    {t.name}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded"
                    style={{
                      background: t.type === 'local' ? 'rgba(37,99,235,0.1)' : t.type === 'http' ? 'rgba(22,163,74,0.1)' : 'rgba(124,58,237,0.1)',
                      color: t.type === 'local' ? '#2563EB' : t.type === 'http' ? '#16A34A' : '#7C3AED',
                    }}>
                    {t.type}
                  </span>
                  {isBuiltin(t) && (
                    <span className="text-[8px] px-1 py-0.5 rounded" style={{ background: 'var(--novo-bg-active)', color: 'var(--novo-text-disabled)' }}>
                      内置
                    </span>
                  )}
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: 'var(--novo-text-muted)' }}>
                  {t.id}
                  {t.tags && t.tags.length > 0 && ` · ${typeof t.tags === 'string' ? t.tags : t.tags.join(', ')}`}
                </div>
              </div>
              {/* 操作按钮 */}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={getToolExportUrl(t.id)} download title="导出"
                  className="p-1.5 rounded-lg transition-colors hover:bg-[var(--novo-bg-hover)]"
                  style={{ color: 'var(--novo-text-muted)' }}>
                  <Download className="w-3 h-3" />
                </a>
                {!isBuiltin(t) && (
                  <>
                    <button onClick={() => openEdit(t)} title="编辑"
                      className="p-1.5 rounded-lg transition-colors hover:bg-[var(--novo-bg-hover)]"
                      style={{ color: 'var(--novo-text-muted)' }}>
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} title="删除"
                      className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(220,38,38,0.08)]"
                      style={{ color: '#DC2626' }}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tools.length === 0 && (
        <div className="text-[10px] text-center py-6" style={{ color: 'var(--novo-text-disabled)' }}>
          暂无已注册工具
        </div>
      )}

      {/* 编辑/新建面板 */}
      {editMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="w-[520px] max-h-[80vh] overflow-y-auto rounded-2xl p-5 space-y-3"
            style={{ background: 'var(--novo-bg-base)', boxShadow: 'var(--novo-shadow-lg)', border: '1px solid var(--novo-border-default)' }}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>
                {editMode === 'create' ? '添加工具' : `编辑工具 — ${editId}`}
              </h4>
              <button onClick={() => setEditMode(null)}
                className="p-1 rounded-lg transition-colors hover:bg-[var(--novo-bg-hover)]"
                style={{ color: 'var(--novo-text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--novo-text-muted)' }}>
              编辑完整的工具 YAML 定义。必须包含 <code>id</code>、<code>name</code>、<code>type</code> 字段。
            </p>
            <textarea
              value={yaml}
              onChange={e => setYaml(e.target.value)}
              rows={16}
              className="w-full text-xs font-mono p-3 rounded-lg outline-none resize-y"
              style={{
                background: 'var(--novo-bg-surface)',
                color: 'var(--novo-text-primary)',
                border: '1px solid var(--novo-border-default)',
                fontFamily: 'var(--novo-font-mono)',
              }}
              spellCheck={false}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditMode(null)}
                className="px-4 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={{ border: '1px solid var(--novo-border-default)', color: 'var(--novo-text-secondary)' }}>
                取消
              </button>
              <button onClick={handleSave} disabled={saving || !yaml.trim()}
                className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50"
                style={{ background: 'var(--novo-accent-primary)', color: 'white' }}>
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                {editMode === 'create' ? '创建' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
