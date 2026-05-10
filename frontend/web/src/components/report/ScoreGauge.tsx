import { motion } from 'framer-motion'
import { Shield, Users, TrendingUp } from 'lucide-react'
import type { ReportMeta } from '@/types/report'

interface ScoreGaugeProps {
  meta: ReportMeta
}

function scoreColor(score: number): string {
  if (score >= 75) return 'var(--novo-accent-success)'
  if (score >= 50) return 'var(--novo-accent-warning)'
  return 'var(--novo-accent-danger)'
}

function noveltyColor(level: string): { bg: string; text: string } {
  switch (level) {
    case 'High':
      return { bg: 'var(--novo-accent-success-light)', text: 'var(--novo-accent-success)' }
    case 'Medium':
      return { bg: 'var(--novo-accent-warning-light)', text: 'var(--novo-accent-warning)' }
    default:
      return { bg: 'var(--novo-accent-danger-light)', text: 'var(--novo-accent-danger)' }
  }
}

const NOVELTY_LABEL: Record<string, string> = {
  High: '高创新',
  Medium: '中等创新',
  Low: '低创新',
}

export default function ScoreGauge({ meta }: ScoreGaugeProps) {
  const score = meta.overallScore ?? 0
  const color = scoreColor(score)
  const nv = noveltyColor(meta.noveltyLevel)

  // SVG 环形参数
  const size = 160
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      {/* 环形仪表 */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* 背景环 */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="var(--novo-bg-active)"
            strokeWidth={stroke}
          />
          {/* 进度环 */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        {/* 中心文字 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-bold"
            style={{ color }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {score.toFixed(0)}
          </motion.span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
            style={{ background: nv.bg, color: nv.text }}
          >
            {NOVELTY_LABEL[meta.noveltyLevel] ?? meta.noveltyLevel}
          </span>
        </div>
      </div>

      {/* 元数据指标 */}
      <div className="flex items-center gap-4 mt-4">
        <MetaItem icon={Users} label="Agent" value={`${meta.agentCount} 个`} />
        <MetaItem icon={TrendingUp} label="分差" value={`${meta.scoreGap.toFixed(0)}`} />
        <MetaItem
          icon={Shield}
          label="质量门"
          value={meta.qualityPassed ? '通过' : '未通过'}
          color={meta.qualityPassed ? 'var(--novo-accent-success)' : 'var(--novo-accent-danger)'}
        />
      </div>
    </div>
  )
}

function MetaItem({ icon: Icon, label, value, color }: {
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <Icon className="w-3 h-3" style={{ color: color ?? 'var(--novo-text-muted)' }} />
      <span style={{ color: 'var(--novo-text-muted)' }}>{label}</span>
      <span className="font-bold" style={{ color: color ?? 'var(--novo-text-primary)' }}>{value}</span>
    </div>
  )
}
