/**
 * Phase G: Agent 积木设计器
 *
 * Dify 风格的 GUI 编辑器：
 *  G1: 基础信息面板（id, name, description, version, category）
 *  G2: 角色分类选择器（六层十类 Agent 角色）
 *  G3: config_schema 编辑器（动态增删字段）
 *  G4: inputs/outputs 编辑器
 *  G5: YAML 预览 + 导出
 *  G6: Agent-as-Tool 双重接口预览
 */

import { useState, useMemo, useCallback } from 'react'
import {
  Bot, Save, Download, Upload, Eye, Plus, Trash2, Copy,
  ChevronDown, Wrench, Code2, ArrowLeftRight, ArrowLeft,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AGENT_ROLE_DEFINITIONS, type AgentRoleType, type ConfigField } from '@/types/blocks'
import { createBlock, updateBlock, getBlockExportUrl } from '@/lib/api'

interface AgentFormData {
  id: string
  name: string
  description: string
  version: string
  category: string
  roleType: AgentRoleType | ''
  inputs: string[]
  outputs: string[]
  config_schema: Record<string, ConfigField>
}

const EMPTY_FORM: AgentFormData = {
  id: '',
  name: '',
  description: '',
  version: '1.0',
  category: 'custom',
  roleType: '',
  inputs: ['user_raw_input'],
  outputs: [],
  config_schema: {
    system_prompt: { type: 'text', default: '', description: '系统 Prompt' },
    temperature: { type: 'float', default: 0.3, min: 0, max: 1, description: '模型温度' },
  },
}

interface AgentDesignerProps {
  initialData?: Partial<AgentFormData>
  editMode?: boolean
  onSaved?: () => void
}

export default function AgentDesigner({ initialData, editMode, onSaved }: AgentDesignerProps) {
  const [form, setForm] = useState<AgentFormData>({ ...EMPTY_FORM, ...initialData })
  const [activeTab, setActiveTab] = useState<'basic' | 'config' | 'preview' | 'dual'>('basic')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const updateForm = useCallback((patch: Partial<AgentFormData>) => {
    setForm(prev => ({ ...prev, ...patch }))
  }, [])

  // 生成 YAML
  const yamlPreview = useMemo(() => {
    const lines: string[] = [
      `id: ${form.id || 'my_agent'}`,
      `name: ${form.name || '我的 Agent'}`,
      `description: ${form.description || ''}`,
      `version: "${form.version}"`,
      `category: ${form.category}`,
    ]
    if (form.roleType) {
      lines.push(`role_type: ${form.roleType}`)
    }
    if (form.inputs.length > 0) {
      lines.push(`inputs:`)
      form.inputs.forEach(i => lines.push(`  - ${i}`))
    }
    if (form.outputs.length > 0) {
      lines.push(`outputs:`)
      form.outputs.forEach(o => lines.push(`  - ${o}`))
    }
    if (Object.keys(form.config_schema).length > 0) {
      lines.push(`config_schema:`)
      Object.entries(form.config_schema).forEach(([key, f]) => {
        lines.push(`  ${key}:`)
        lines.push(`    type: ${f.type}`)
        if (f.default !== undefined && f.default !== null) lines.push(`    default: ${JSON.stringify(f.default)}`)
        if (f.description) lines.push(`    description: ${f.description}`)
        if (f.min !== undefined && f.min !== null) lines.push(`    min: ${f.min}`)
        if (f.max !== undefined && f.max !== null) lines.push(`    max: ${f.max}`)
        if (f.options) lines.push(`    options: [${f.options.join(', ')}]`)
      })
    }
    return lines.join('\n')
  }, [form])

  const handleSave = useCallback(async () => {
    if (!form.id.trim()) { setError('请输入积木 ID'); return }
    if (!form.name.trim()) { setError('请输入积木名称'); return }
    setError(null)
    setSaving(true)
    try {
      if (editMode) {
        await updateBlock('agents', form.id, yamlPreview)
      } else {
        await createBlock('agents', yamlPreview)
      }
      setSuccess(editMode ? '积木已更新' : '积木已创建')
      onSaved?.()
      setTimeout(() => setSuccess(null), 3000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }, [form, yamlPreview, editMode, onSaved])

  const handleExportYAML = useCallback(() => {
    const blob = new Blob([yamlPreview], { type: 'application/x-yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${form.id || 'agent'}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }, [yamlPreview, form.id])

  const selectedRole = AGENT_ROLE_DEFINITIONS.find(r => r.type === form.roleType)

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--novo-bg-base)' }}>
      {/* 头部 */}
      <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--novo-border-default)', background: 'var(--novo-bg-elevated)' }}>
        <Link to="/studio" className="p-1.5 rounded-lg hover:bg-[var(--novo-bg-hover)] transition-colors" title="返回 Studio">
          <ArrowLeft className="w-4 h-4" style={{ color: 'var(--novo-text-muted)' }} />
        </Link>
        <Bot className="w-5 h-5" style={{ color: '#2563EB' }} />
        <div className="flex-1">
          <div className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>
            {editMode ? '编辑 Agent 积木' : '创建 Agent 积木'}
          </div>
          <div className="text-[9px]" style={{ color: 'var(--novo-text-muted)' }}>
            {form.id || '未命名'} · {form.version}
          </div>
        </div>
        <button onClick={handleExportYAML} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium hover:bg-[var(--novo-bg-hover)]" style={{ color: 'var(--novo-text-secondary)' }}>
          <Download className="w-3.5 h-3.5" /> 导出
        </button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold" style={{ background: 'var(--novo-accent-primary)', color: 'white' }}>
          <Save className="w-3.5 h-3.5" /> {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {/* 消息提示 */}
      {error && <div className="px-5 py-2 text-[10px] font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>{error}</div>}
      {success && <div className="px-5 py-2 text-[10px] font-medium" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>{success}</div>}

      {/* Tab 切换 */}
      <div className="flex gap-0 px-5 border-b" style={{ borderColor: 'var(--novo-border-default)' }}>
        {([
          { key: 'basic', label: '基础信息', icon: Bot },
          { key: 'config', label: '配置参数', icon: Wrench },
          { key: 'preview', label: 'YAML 预览', icon: Code2 },
          { key: 'dual', label: '双重接口', icon: ArrowLeftRight },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold transition-colors border-b-2"
            style={{
              color: activeTab === tab.key ? 'var(--novo-accent-primary)' : 'var(--novo-text-muted)',
              borderColor: activeTab === tab.key ? 'var(--novo-accent-primary)' : 'transparent',
            }}
          >
            <tab.icon className="w-3 h-3" /> {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* ── 基础信息 ── */}
        {activeTab === 'basic' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="积木 ID" hint="唯一标识，如 my_scorer">
                <input type="text" value={form.id} onChange={e => updateForm({ id: e.target.value })} disabled={editMode}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none novo-input" placeholder="my_agent" />
              </FormField>
              <FormField label="显示名称">
                <input type="text" value={form.name} onChange={e => updateForm({ name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none novo-input" placeholder="我的 Agent" />
              </FormField>
              <FormField label="版本" hint="语义化版本号">
                <input type="text" value={form.version} onChange={e => updateForm({ version: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none novo-input" placeholder="1.0" />
              </FormField>
              <FormField label="分类">
                <select value={form.category} onChange={e => updateForm({ category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none novo-input">
                  <option value="intent">意图分析</option>
                  <option value="retrieval">信息检索</option>
                  <option value="scoring">评分评估</option>
                  <option value="orchestration">编排控制</option>
                  <option value="transform">数据转换</option>
                  <option value="custom">自定义</option>
                </select>
              </FormField>
            </div>
            <FormField label="描述">
              <textarea value={form.description} onChange={e => updateForm({ description: e.target.value })} rows={2}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y novo-input" placeholder="一句话说明 Agent 功能..." />
            </FormField>

            {/* 角色分类选择器 */}
            <div>
              <div className="text-[10px] font-semibold mb-2" style={{ color: 'var(--novo-text-secondary)' }}>
                Agent 角色分类（六层十类）
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {AGENT_ROLE_DEFINITIONS.map(role => (
                  <button
                    key={role.type}
                    onClick={() => updateForm({
                      roleType: role.type,
                      description: form.description || role.description,
                    })}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[10px] transition-all"
                    style={{
                      background: form.roleType === role.type ? `${role.color}15` : 'var(--novo-bg-surface)',
                      border: `1.5px solid ${form.roleType === role.type ? role.color : 'var(--novo-border-default)'}`,
                      color: form.roleType === role.type ? role.color : 'var(--novo-text-secondary)',
                    }}
                  >
                    <span className="text-sm">{role.icon}</span>
                    <div>
                      <div className="font-semibold">{role.label}</div>
                      <div className="text-[8px]" style={{ color: 'var(--novo-text-muted)' }}>{role.layer}</div>
                    </div>
                  </button>
                ))}
              </div>
              {selectedRole && (
                <div className="mt-2 px-3 py-2 rounded-lg text-[9px]" style={{ background: `${selectedRole.color}08`, color: 'var(--novo-text-secondary)' }}>
                  {selectedRole.icon} <strong>{selectedRole.label}</strong>：{selectedRole.description}
                  {selectedRole.defaultPromptHint && (
                    <div className="mt-1 italic" style={{ color: 'var(--novo-text-muted)' }}>
                      建议 Prompt：{selectedRole.defaultPromptHint}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Inputs/Outputs 编辑器 */}
            <div className="grid grid-cols-2 gap-4">
              <ListEditor label="输入字段 (inputs)" items={form.inputs} onChange={inputs => updateForm({ inputs })} placeholder="字段名" />
              <ListEditor label="输出字段 (outputs)" items={form.outputs} onChange={outputs => updateForm({ outputs })} placeholder="字段名" />
            </div>
          </>
        )}

        {/* ── 配置参数 ── */}
        {activeTab === 'config' && (
          <ConfigSchemaEditor
            schema={form.config_schema}
            onChange={config_schema => updateForm({ config_schema })}
          />
        )}

        {/* ── YAML 预览 ── */}
        {activeTab === 'preview' && (
          <div className="relative">
            <button
              onClick={() => navigator.clipboard.writeText(yamlPreview)}
              className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-[var(--novo-bg-hover)]"
              title="复制 YAML"
            >
              <Copy className="w-3.5 h-3.5" style={{ color: 'var(--novo-text-muted)' }} />
            </button>
            <pre className="px-4 py-3 rounded-xl text-[10px] leading-relaxed overflow-x-auto font-mono"
              style={{ background: 'var(--novo-bg-surface)', color: 'var(--novo-text-primary)', border: '1px solid var(--novo-border-default)' }}>
              {yamlPreview}
            </pre>
          </div>
        )}

        {/* ── 双重接口预览 ── */}
        {activeTab === 'dual' && (
          <div className="space-y-4">
            <div className="novo-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)' }}>
                  <Bot className="w-3.5 h-3.5" style={{ color: '#2563EB' }} />
                </div>
                <div className="text-xs font-bold" style={{ color: 'var(--novo-text-primary)' }}>作为 Graph Node</div>
              </div>
              <div className="text-[10px] space-y-1" style={{ color: 'var(--novo-text-secondary)' }}>
                <p>此 Agent 可作为 LangGraph 节点拖入管线画布：</p>
                <div className="font-mono px-2 py-1 rounded" style={{ background: 'var(--novo-bg-surface)' }}>
                  await agent.run_as_node(state, config)
                </div>
                <p className="text-[9px]" style={{ color: 'var(--novo-text-muted)' }}>
                  从 state 中读取 [{form.inputs.join(', ') || '—'}]，写入 [{form.outputs.join(', ') || '—'}]
                </p>
              </div>
            </div>
            <div className="novo-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.1)' }}>
                  <Wrench className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
                </div>
                <div className="text-xs font-bold" style={{ color: 'var(--novo-text-primary)' }}>作为 Tool</div>
              </div>
              <div className="text-[10px] space-y-1" style={{ color: 'var(--novo-text-secondary)' }}>
                <p>此 Agent 同时可被 Orchestrator 作为 Tool 自动调用：</p>
                <div className="font-mono px-2 py-1 rounded" style={{ background: 'var(--novo-bg-surface)' }}>
                  tool = agent.as_tool()  # StructuredTool
                </div>
                <p className="text-[9px]" style={{ color: 'var(--novo-text-muted)' }}>
                  Tool 名称：<strong>{form.id || 'my_agent'}</strong>，描述："{form.name}: {form.description}"
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 辅助组件 ──

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold mb-1 block" style={{ color: 'var(--novo-text-secondary)' }}>
        {label}
        {hint && <span className="font-normal ml-1" style={{ color: 'var(--novo-text-disabled)' }}>({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function ListEditor({ label, items, onChange, placeholder }: { label: string; items: string[]; onChange: (items: string[]) => void; placeholder: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--novo-text-secondary)' }}>{label}</div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input type="text" value={item}
              onChange={e => { const n = [...items]; n[i] = e.target.value; onChange(n) }}
              className="flex-1 px-2 py-1 rounded text-[10px] outline-none novo-input" placeholder={placeholder} />
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-red-50">
              <Trash2 className="w-3 h-3" style={{ color: '#EF4444' }} />
            </button>
          </div>
        ))}
        <button onClick={() => onChange([...items, ''])}
          className="flex items-center gap-1 text-[9px] font-medium px-2 py-1 rounded-lg hover:bg-[var(--novo-bg-hover)]"
          style={{ color: 'var(--novo-accent-primary)' }}>
          <Plus className="w-3 h-3" /> 添加
        </button>
      </div>
    </div>
  )
}

function ConfigSchemaEditor({ schema, onChange }: { schema: Record<string, ConfigField>; onChange: (s: Record<string, ConfigField>) => void }) {
  const [newKey, setNewKey] = useState('')

  const addField = () => {
    if (!newKey.trim() || schema[newKey]) return
    onChange({ ...schema, [newKey]: { type: 'text', default: '', description: '' } })
    setNewKey('')
  }

  const removeField = (key: string) => {
    const next = { ...schema }
    delete next[key]
    onChange(next)
  }

  const updateField = (key: string, patch: Partial<ConfigField>) => {
    onChange({ ...schema, [key]: { ...schema[key], ...patch } })
  }

  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold" style={{ color: 'var(--novo-text-secondary)' }}>
        配置参数 (config_schema)
      </div>

      {Object.entries(schema).map(([key, field]) => (
        <div key={key} className="novo-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--novo-text-primary)' }}>{key}</span>
            <select value={field.type}
              onChange={e => updateField(key, { type: e.target.value as ConfigField['type'] })}
              className="text-[9px] px-1.5 py-0.5 rounded novo-input ml-auto">
              <option value="text">text</option>
              <option value="float">float</option>
              <option value="integer">integer</option>
              <option value="boolean">boolean</option>
              <option value="select">select</option>
            </select>
            <button onClick={() => removeField(key)} className="p-1 rounded hover:bg-red-50">
              <Trash2 className="w-3 h-3" style={{ color: '#EF4444' }} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="描述"
              value={field.description || ''}
              onChange={e => updateField(key, { description: e.target.value })}
              className="px-2 py-1 rounded text-[9px] outline-none novo-input" />
            <input type="text" placeholder="默认值"
              value={field.default !== undefined ? String(field.default) : ''}
              onChange={e => {
                const v = field.type === 'float' ? parseFloat(e.target.value) || 0
                  : field.type === 'integer' ? parseInt(e.target.value) || 0
                  : field.type === 'boolean' ? e.target.value === 'true'
                  : e.target.value
                updateField(key, { default: v })
              }}
              className="px-2 py-1 rounded text-[9px] outline-none novo-input" />
          </div>
          {(field.type === 'float' || field.type === 'integer') && (
            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder="最小值" value={field.min ?? ''}
                onChange={e => updateField(key, { min: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="px-2 py-1 rounded text-[9px] outline-none novo-input" />
              <input type="number" placeholder="最大值" value={field.max ?? ''}
                onChange={e => updateField(key, { max: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="px-2 py-1 rounded text-[9px] outline-none novo-input" />
            </div>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input type="text" value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="新字段名..."
          onKeyDown={e => e.key === 'Enter' && addField()}
          className="flex-1 px-2 py-1.5 rounded-lg text-[10px] outline-none novo-input" />
        <button onClick={addField} disabled={!newKey.trim()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--novo-accent-primary)', color: 'white' }}>
          <Plus className="w-3 h-3" /> 添加字段
        </button>
      </div>
    </div>
  )
}
