import { motion } from 'framer-motion'
import type { RadarScore } from '@/types/report'

interface RadarChartProps {
  scores: RadarScore[]
  size?: number
}

export default function RadarChart({ scores, size = 200 }: RadarChartProps) {
  if (scores.length < 3) return null

  const cx = size / 2
  const cy = size / 2
  const maxR = size / 2 - 30 // 留出标签空间
  const n = scores.length
  const angleStep = (2 * Math.PI) / n

  // 生成多边形顶点
  function getPoint(index: number, value: number): { x: number; y: number } {
    const angle = angleStep * index - Math.PI / 2 // 从顶部开始
    const r = (value / 100) * maxR
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    }
  }

  // 网格线 — 4 层
  const gridLevels = [25, 50, 75, 100]
  const gridPaths = gridLevels.map(level => {
    const points = Array.from({ length: n }, (_, i) => getPoint(i, level))
    return points.map(p => `${p.x},${p.y}`).join(' ')
  })

  // 轴线
  const axes = Array.from({ length: n }, (_, i) => getPoint(i, 100))

  // 数据多边形
  const dataPoints = scores.map((s, i) => getPoint(i, s.score))
  const dataPath = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  // 标签位置（比轴线顶点更远）
  const labels = scores.map((s, i) => {
    const angle = angleStep * i - Math.PI / 2
    const r = maxR + 18
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      label: s.label,
      score: s.score,
    }
  })

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* 网格 */}
        {gridPaths.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="var(--novo-border-default)"
            strokeWidth={i === gridLevels.length - 1 ? 1 : 0.5}
            opacity={0.6}
          />
        ))}

        {/* 轴线 */}
        {axes.map((p, i) => (
          <line
            key={i}
            x1={cx} y1={cy} x2={p.x} y2={p.y}
            stroke="var(--novo-border-default)"
            strokeWidth={0.5}
            opacity={0.4}
          />
        ))}

        {/* 数据填充 */}
        <motion.polygon
          points={dataPath}
          fill="var(--novo-accent-primary)"
          fillOpacity={0.15}
          stroke="var(--novo-accent-primary)"
          strokeWidth={2}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* 数据点 */}
        {dataPoints.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x} cy={p.y} r={3.5}
            fill="var(--novo-accent-primary)"
            stroke="white" strokeWidth={1.5}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.1 }}
          />
        ))}

        {/* 标签 */}
        {labels.map((l, i) => (
          <text
            key={i}
            x={l.x} y={l.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fontWeight={600}
            fill="var(--novo-text-secondary)"
          >
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  )
}
