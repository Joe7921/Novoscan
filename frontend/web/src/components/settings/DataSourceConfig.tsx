import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Database, BookOpen, FileText, Globe, Code2, Library, Save, Loader2, Eye, EyeOff } from 'lucide-react'
import { fetchModelConfig, updateModelConfig, type ModelConfigResponse } from '@/lib/api'

interface DataSource {
  id: string
  name: string
  description: string
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>
  color: string
  requiresKey: boolean
  envVar?: string
}

const DATA_SOURCES: DataSource[] = [
  {
    id: 'openalex',
    name: 'OpenAlex',
    description: '开放学术数据库，涵盖论文、引用、作者信息',
    icon: BookOpen,
    color: 'var(--novo-accent-primary)',
    requiresKey: false,
  },
  {
    id: 'arxiv',
    name: 'arXiv',
    description: '预印本数据库，前沿研究论文',
    icon: Library,
    color: 'var(--novo-accent-success)',
    requiresKey: false,
  },
  {
    id: 'crossref',
    name: 'CrossRef',
    description: '文献元数据，DOI 与出版信息',
    icon: FileText,
    color: 'var(--novo-accent-info)',
    requiresKey: false,
  },
  {
    id: 'brave',
    name: 'Brave Search',
    description: '网页搜索引擎，产业动态与竞品情报',
    icon: Globe,
    color: 'var(--novo-accent-warning)',
    requiresKey: true,
    envVar: 'BRAVE_API_KEY',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: '开源项目搜索，Star 数与社区活跃度',
    icon: Code2,
    color: 'var(--novo-accent-danger)',
    requiresKey: false,
    envVar: 'GITHUB_TOKEN',
  },
]

export default function DataSourceConfig() {
  const [config, setConfig] = useState<ModelConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // State for form fields
  const [braveApiKey, setBraveApiKey] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [openalexEmail, setOpenalexEmail] = useState('')
  const [crossrefEmail, setCrossrefEmail] = useState('')

  const [showBraveKey, setShowBraveKey] = useState(false)
  const [showGithubToken, setShowGithubToken] = useState(false)

  useEffect(() => {
    fetchModelConfig().then(data => {
      setConfig(data)
      setBraveApiKey(data.tools?.brave_api_key && data.tools.brave_api_key !== '***' ? data.tools.brave_api_key : '')
      setGithubToken(data.tools?.github_token && data.tools.github_token !== '***' ? data.tools.github_token : '')
      setOpenalexEmail(data.tools?.openalex_email || '')
      setCrossrefEmail(data.tools?.crossref_email || '')
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const payload: Record<string, any> = {}
      if (braveApiKey !== (config?.tools?.brave_api_key === '***' ? '' : config?.tools?.brave_api_key || '')) payload.brave_api_key = braveApiKey
      if (githubToken !== (config?.tools?.github_token === '***' ? '' : config?.tools?.github_token || '')) payload.github_token = githubToken
      if (openalexEmail !== (config?.tools?.openalex_email || '')) payload.openalex_email = openalexEmail
      if (crossrefEmail !== (config?.tools?.crossref_email || '')) payload.crossref_email = crossrefEmail

      if (Object.keys(payload).length > 0) {
        await updateModelConfig(payload)
      }
      setSaveMsg('✅ 保存成功')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (e: any) {
      setSaveMsg(`❌ 保存失败: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--novo-accent-primary)' }} />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
    >
      <div className="novo-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-4 h-4" style={{ color: 'var(--novo-accent-primary)' }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--novo-text-primary)' }}>数据源</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--novo-accent-primary-light)', color: 'var(--novo-accent-primary)' }}>
            {DATA_SOURCES.length} 个引擎
          </span>
        </div>

        <div className="space-y-2">
          {DATA_SOURCES.map((ds) => {
            const Icon = ds.icon
            return (
              <div
                key={ds.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all"
                style={{ borderColor: 'var(--novo-border-default)' }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in srgb, ${ds.color} 12%, transparent)` }}
                >
                  <Icon className="w-4 h-4" style={{ color: ds.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: 'var(--novo-text-primary)' }}>
                      {ds.name}
                    </span>
                    {ds.requiresKey && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--novo-accent-warning-light)', color: 'var(--novo-accent-warning)' }}>
                        需要 API Key
                      </span>
                    )}
                    {!ds.requiresKey && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--novo-accent-success-light)', color: 'var(--novo-accent-success)' }}>
                        免费
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--novo-text-muted)' }}>
                    {ds.description}
                  </div>
                </div>
                {ds.envVar && (
                  <code
                    className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      background: 'var(--novo-bg-surface)',
                      color: 'var(--novo-text-muted)',
                      fontFamily: 'var(--novo-font-mono)',
                      border: '1px solid var(--novo-border-default)',
                    }}
                  >
                    {ds.envVar}
                  </code>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6 space-y-4 border-t pt-4" style={{ borderColor: 'var(--novo-border-default)' }}>
          <h4 className="text-xs font-bold" style={{ color: 'var(--novo-text-primary)' }}>配置数据源参数</h4>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-muted)' }}>Brave Search API Key</label>
              <div className="relative">
                <input
                  type={showBraveKey ? "text" : "password"}
                  value={braveApiKey}
                  onChange={e => setBraveApiKey(e.target.value)}
                  placeholder={config?.tools?.brave_api_key === '***' ? '已配置 (***)' : '未配置'}
                  className="w-full text-xs px-3 py-2 rounded-lg novo-input pr-8"
                />
                <button
                  onClick={() => setShowBraveKey(!showBraveKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: 'var(--novo-text-disabled)' }}
                >
                  {showBraveKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-muted)' }}>GitHub Token</label>
              <div className="relative">
                <input
                  type={showGithubToken ? "text" : "password"}
                  value={githubToken}
                  onChange={e => setGithubToken(e.target.value)}
                  placeholder={config?.tools?.github_token === '***' ? '已配置 (***)' : '未配置'}
                  className="w-full text-xs px-3 py-2 rounded-lg novo-input pr-8"
                />
                <button
                  onClick={() => setShowGithubToken(!showGithubToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: 'var(--novo-text-disabled)' }}
                >
                  {showGithubToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-muted)' }}>OpenAlex 邮箱 <span className="text-[9px] font-normal" style={{ color: 'var(--novo-text-disabled)' }}>(提高速率限制)</span></label>
              <input
                type="email"
                value={openalexEmail}
                onChange={e => setOpenalexEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full text-xs px-3 py-2 rounded-lg novo-input"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold mb-1" style={{ color: 'var(--novo-text-muted)' }}>CrossRef 邮箱 <span className="text-[9px] font-normal" style={{ color: 'var(--novo-text-disabled)' }}>(可选)</span></label>
              <input
                type="email"
                value={crossrefEmail}
                onChange={e => setCrossrefEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full text-xs px-3 py-2 rounded-lg novo-input"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: saving ? 'var(--novo-bg-surface)' : 'var(--novo-accent-primary)',
                color: saving ? 'var(--novo-text-muted)' : 'white',
              }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? '保存中...' : '保存配置'}
            </button>
            {saveMsg && (
              <span className="text-[11px] font-medium" style={{ color: saveMsg.startsWith('✅') ? 'var(--novo-accent-success)' : 'var(--novo-accent-danger)' }}>
                {saveMsg}
              </span>
            )}
          </div>
        </div>

        <p className="text-[10px] mt-4 leading-relaxed" style={{ color: 'var(--novo-text-disabled)' }}>
          提示：这些配置会被持久化保存到后端 <code>.env</code> 文件中，重启服务后仍然有效。
        </p>
      </div>
    </motion.div>
  )
}
