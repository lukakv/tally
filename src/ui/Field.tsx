import type { ComponentProps, ReactNode } from 'react'
import { motion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import { haptic } from './haptics'
import { springSnappy } from './motion'
import { cx } from './cx'

/** A grouped list container, like a settings panel. */
export function Group({
  title,
  footnote,
  children,
  className,
}: {
  title?: string
  footnote?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {title && (
        <h3 className="px-1 pb-2 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
          {title}
        </h3>
      )}
      <div className="divide-y divide-line-soft overflow-hidden rounded-[var(--radius-card)] bg-surface ring-1 ring-line/50">
        {children}
      </div>
      {footnote && (
        <p className="px-2 pt-2.5 text-[12.5px] leading-relaxed text-faint">{footnote}</p>
      )}
    </div>
  )
}

/** One row inside a Group. Becomes a button when `onClick` is supplied. */
export function Row({
  icon,
  label,
  sub,
  value,
  chevron,
  onClick,
  danger,
  children,
  className,
}: {
  icon?: ReactNode
  label: ReactNode
  sub?: ReactNode
  value?: ReactNode
  chevron?: boolean
  onClick?: () => void
  danger?: boolean
  children?: ReactNode
  className?: string
}) {
  const body = (
    <>
      {icon && <div className="shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1 text-left">
        <div className={cx('text-[14.5px] leading-tight', danger ? 'text-neg' : 'text-text')}>
          {label}
        </div>
        {sub && <div className="mt-0.5 text-[12.5px] leading-snug text-faint">{sub}</div>}
      </div>
      {value !== undefined && (
        <div className="shrink-0 text-[14.5px] text-dim tabular-nums">{value}</div>
      )}
      {children}
      {chevron && <ChevronRight size={17} className="shrink-0 text-faint" strokeWidth={2.2} />}
    </>
  )

  if (onClick) {
    return (
      <motion.button
        whileTap={{ backgroundColor: 'var(--surface-2)' }}
        transition={{ duration: 0.08 }}
        onClick={() => {
          haptic('tap')
          onClick()
        }}
        className={cx('flex w-full items-center gap-3 px-4 py-3.5 text-left', className)}
      >
        {body}
      </motion.button>
    )
  }

  return <div className={cx('flex items-center gap-3 px-4 py-3.5', className)}>{body}</div>
}

/* --------------------------------- Input -------------------------------- */

export function TextField({
  label,
  prefix,
  suffix,
  className,
  ...rest
}: ComponentProps<'input'> & { label?: string; prefix?: ReactNode; suffix?: ReactNode }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block px-1 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
          {label}
        </span>
      )}
      <span
        className={cx(
          'flex h-12 items-center gap-2 rounded-2xl bg-surface-2 px-3.5 ring-1 ring-line/50',
          'focus-within:ring-accent/60 transition-[box-shadow,background-color]',
          className,
        )}
      >
        {prefix && <span className="shrink-0 text-dim">{prefix}</span>}
        <input
          className="min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-faint"
          {...rest}
        />
        {suffix && <span className="shrink-0 text-dim">{suffix}</span>}
      </span>
    </label>
  )
}

/* -------------------------------- Toggle -------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        haptic('select')
        onChange(!checked)
      }}
      className={cx(
        'relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-accent' : 'bg-surface-3',
      )}
    >
      <motion.span
        layout
        transition={springSnappy}
        className="absolute top-[3px] size-6 rounded-full bg-white shadow-sm"
        style={{ left: checked ? 23 : 3 }}
      />
    </button>
  )
}
