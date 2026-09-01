import { motion } from 'motion/react'
import { icon as iconFor } from '../lib/icons'
import { cx } from './cx'

const SIZES = {
  sm: { box: 32, glyph: 15, radius: 10 },
  md: { box: 40, glyph: 18, radius: 13 },
  lg: { box: 48, glyph: 21, radius: 15 },
  xl: { box: 60, glyph: 26, radius: 19 },
} as const

export function CategoryIcon({
  icon,
  color,
  size = 'md',
  active = true,
  className,
}: {
  icon: string
  color: string
  size?: keyof typeof SIZES
  /** inactive renders flat grey — used in pickers */
  active?: boolean
  className?: string
}) {
  const Glyph = iconFor(icon)
  const s = SIZES[size]
  return (
    <div
      className={cx('grid shrink-0 place-items-center', className)}
      style={{
        width: s.box,
        height: s.box,
        borderRadius: s.radius,
        backgroundColor: active ? color + '1F' : 'var(--surface-2)',
        boxShadow: active ? `inset 0 0 0 1px ${color}2E` : 'inset 0 0 0 1px var(--line)',
      }}
    >
      <Glyph
        size={s.glyph}
        strokeWidth={2}
        style={{ color: active ? color : 'var(--text-faint)' }}
      />
    </div>
  )
}

/** Round avatar for people in the split ledger. */
export function PersonAvatar({
  name,
  color,
  size = 36,
  dimmed = false,
}: {
  name: string
  color: string
  size?: number
  dimmed?: boolean
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <motion.div
      layout
      className="grid shrink-0 place-items-center rounded-full font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        backgroundColor: dimmed ? 'var(--surface-2)' : color + '24',
        color: dimmed ? 'var(--text-faint)' : color,
        boxShadow: `inset 0 0 0 1px ${dimmed ? 'var(--line)' : color + '33'}`,
      }}
    >
      {initials || '?'}
    </motion.div>
  )
}
