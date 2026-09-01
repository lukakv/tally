import type { ComponentProps, ReactNode } from 'react'
import { motion } from 'motion/react'
import { cx } from './cx'
import { haptic } from './haptics'
import { springSoft, tap } from './motion'

/* -------------------------------- Button ------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink font-semibold',
  secondary: 'bg-surface-2 text-text font-medium ring-1 ring-line/60',
  ghost: 'bg-transparent text-dim font-medium',
  danger: 'bg-neg-soft text-neg font-semibold',
  quiet: 'bg-surface-3/70 text-dim font-medium',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] rounded-xl gap-1.5',
  md: 'h-11 px-4 text-[14px] rounded-2xl gap-2',
  lg: 'h-14 px-5 text-[16px] rounded-[18px] gap-2',
}

export interface ButtonProps extends Omit<ComponentProps<'button'>, 'ref'> {
  variant?: Variant
  size?: Size
  block?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  block,
  icon,
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      whileTap={rest.disabled ? undefined : tap}
      transition={springSoft}
      onClick={(e) => {
        if (!rest.disabled) haptic('tap')
        onClick?.(e)
      }}
      className={cx(
        'inline-flex items-center justify-center transition-opacity select-none',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...(rest as ComponentProps<typeof motion.button>)}
    >
      {icon}
      {children}
    </motion.button>
  )
}

/* --------------------------------- Card -------------------------------- */

export function Card({
  className,
  children,
  ...rest
}: ComponentProps<'div'> & { children: ReactNode }) {
  return (
    <div
      className={cx(
        'rounded-[var(--radius-card)] bg-surface ring-1 ring-line/50 shadow-[var(--shadow-card)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

/* ------------------------------ Section label --------------------------- */

export function SectionLabel({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex items-end justify-between px-1 pb-2.5', className)}>
      <h2 className="text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
        {children}
      </h2>
      {action}
    </div>
  )
}

/* --------------------------------- Chip -------------------------------- */

export function Chip({
  active,
  color,
  children,
  onClick,
  className,
}: {
  active?: boolean
  color?: string
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <motion.button
      whileTap={tap}
      onClick={() => {
        haptic('select')
        onClick?.()
      }}
      style={
        active && color
          ? { backgroundColor: color + '26', color, boxShadow: `inset 0 0 0 1px ${color}55` }
          : undefined
      }
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors',
        active
          ? color
            ? ''
            : 'bg-accent text-accent-ink'
          : 'bg-surface-2 text-dim ring-1 ring-line/50',
        className,
      )}
    >
      {children}
    </motion.button>
  )
}

/* ------------------------------ Empty state ----------------------------- */

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="flex flex-col items-center px-8 py-14 text-center"
    >
      {icon && (
        <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-surface-2 text-faint">
          {icon}
        </div>
      )}
      <p className="text-[15px] font-medium text-text">{title}</p>
      {hint && <p className="mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-faint">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}

/* --------------------------------- Bar ---------------------------------- */

/** Budget / proportion bar. `over` renders the excess in the warning hue. */
export function Bar({
  progress,
  color,
  height = 6,
  track = true,
  delay = 0,
}: {
  progress: number
  color: string
  height?: number
  track?: boolean
  delay?: number
}) {
  const over = progress > 1
  const fill = Math.min(progress, 1)
  return (
    <div
      className={cx('w-full overflow-hidden rounded-full', track && 'bg-surface-3')}
      style={{ height }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: over ? 'var(--neg)' : color }}
        initial={{ width: 0 }}
        animate={{ width: `${fill * 100}%` }}
        transition={{ ...springSoft, delay }}
      />
    </div>
  )
}
