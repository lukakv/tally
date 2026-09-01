import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export interface DonutSegment {
  id: string
  value: number
  color: string
}

/**
 * Proportional ring. Arcs are drawn as dashed circle strokes so each one can
 * sweep into place independently, which reads better than a static pie.
 */
export function Donut({
  segments,
  size = 168,
  thickness = 18,
  gap = 0.012,
  children,
}: {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  /** fraction of the circumference left blank between arcs */
  gap?: number
  children?: ReactNode
}) {
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((s, x) => s + Math.max(x.value, 0), 0)

  let cursor = 0
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const fraction = s.value / total
      const start = cursor
      cursor += fraction
      const visible = Math.max(fraction - gap, 0.004)
      return { ...s, start, length: visible * circumference }
    })

  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={thickness}
        />
        {total > 0 &&
          arcs.map((a, i) => (
            <motion.circle
              key={a.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${a.length} ${circumference - a.length}`}
              initial={{ strokeDashoffset: -a.start * circumference, opacity: 0, scale: 0.94 }}
              animate={{ strokeDashoffset: -a.start * circumference, opacity: 1, scale: 1 }}
              transition={{
                opacity: { duration: 0.3, delay: 0.06 + i * 0.045 },
                scale: { type: 'spring', stiffness: 260, damping: 26, delay: 0.06 + i * 0.045 },
              }}
              style={{ transformOrigin: 'center' }}
            />
          ))}
      </svg>
      {children && (
        <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
      )}
    </div>
  )
}
