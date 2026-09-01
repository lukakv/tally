import { motion } from 'motion/react'
import { useId } from 'react'
import { haptic } from './haptics'
import { spring } from './motion'
import { cx } from './cx'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** tints the pill when this option is selected */
  color?: string
}

/**
 * Sliding pill selector. The indicator is a shared layout element so it
 * travels between options instead of blinking.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  const id = useId()
  const active = options.find((o) => o.value === value)

  return (
    <div
      className={cx(
        'relative grid gap-1 rounded-2xl bg-surface-2 p-1 ring-1 ring-line/50',
        size === 'sm' ? 'h-9' : 'h-11',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => {
              if (!selected) haptic('select')
              onChange(o.value)
            }}
            className={cx(
              'relative z-10 rounded-[13px] font-medium transition-colors duration-150',
              size === 'sm' ? 'text-[12.5px]' : 'text-[13.5px]',
              selected ? '' : 'text-dim',
            )}
            style={selected ? { color: o.color ?? 'var(--text)' } : undefined}
          >
            {selected && (
              <motion.span
                layoutId={id}
                transition={spring}
                className="absolute inset-0 -z-10 rounded-[13px] bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.25)]"
                style={
                  active?.color
                    ? { boxShadow: `inset 0 0 0 1px ${active.color}33` }
                    : undefined
                }
              />
            )}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
