import { motion } from 'framer-motion'
import { Database, BookOpen, FileText, Globe, Code2, Library } from 'lucide-react'

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

        <p className="text-[10px] mt-3 leading-relaxed" style={{ color: 'var(--novo-text-disabled)' }}>
          数据源通过后端 .env 文件配置。OpenAlex / arXiv / CrossRef 无需 API Key 即可使用。
        </p>
      </div>
    </motion.div>
  )
}
