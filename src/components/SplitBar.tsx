import { motion } from 'motion/react'
import { springSoft } from '../ui/motion'

export interface Segment {
  value: number
  color: string
  label: string
}

/**
 * A single bar divided proportionally — used to show how a month's income
 * was split between spending, saving and what is left.
 */
export function SplitBar({ segments, height = 10 }: { segments: Segment[]; height?: number }) {
  const total = segments.reduce((s, x) => s + Math.max(x.value, 0), 0)
  if (total <= 0) {
    return <div className="w-full rounded-full bg-surface-3" style={{ height }} />
  }
  return (
    <div className="flex w-full gap-[3px] overflow-hidden" style={{ height }}>
      {segments
        .filter((s) => s.value > 0)
        .map((s, i) => (
          <motion.div
            key={s.label}
            title={s.label}
            className="h-full rounded-full first:rounded-l-full last:rounded-r-full"
            style={{ backgroundColor: s.color }}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: `${(s.value / total) * 100}%`, opacity: 1 }}
            transition={{ ...springSoft, delay: 0.05 + i * 0.06 }}
          />
        ))}
    </div>
  )
}
