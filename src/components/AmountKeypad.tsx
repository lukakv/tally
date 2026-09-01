import { motion } from 'motion/react'
import { Delete } from 'lucide-react'
import { haptic } from '../ui/haptics'
import { springSnappy } from '../ui/motion'
import { cx } from '../ui/cx'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const

/**
 * Applies one keypress to the raw amount string. Kept pure so the rules —
 * one separator, at most two decimals, no runaway leading zeros — are easy
 * to reason about and test.
 */
export function applyKey(current: string, key: string): string {
  if (key === 'del') return current.length <= 1 ? '' : current.slice(0, -1)

  if (key === '.') {
    if (current.includes('.')) return current
    return current === '' ? '0.' : current + '.'
  }

  const [, decimals] = current.split('.')
  if (decimals !== undefined && decimals.length >= 2) return current
  if (current === '0') return key
  // keep amounts sane rather than letting someone type a 12-digit number
  if (current.replace('.', '').length >= 11) return current
  return current + key
}

export function AmountKeypad({
  onKey,
  onClear,
  className,
}: {
  onKey: (key: string) => void
  onClear: () => void
  className?: string
}) {
  return (
    <div className={cx('grid grid-cols-3 gap-1.5', className)}>
      {KEYS.map((k) => (
        <motion.button
          key={k}
          whileTap={{ scale: 0.94, backgroundColor: 'var(--surface-3)' }}
          transition={springSnappy}
          onPointerDown={() => haptic('tap')}
          onClick={() => onKey(k)}
          onContextMenu={(e) => {
            if (k !== 'del') return
            e.preventDefault()
            haptic('warn')
            onClear()
          }}
          aria-label={k === 'del' ? 'Delete' : k}
          className={cx(
            'grid h-[52px] place-items-center rounded-2xl bg-surface-2/60',
            'text-[22px] font-medium tabular-nums select-none',
          )}
        >
          {k === 'del' ? <Delete size={20} strokeWidth={2} className="text-dim" /> : k}
        </motion.button>
      ))}
    </div>
  )
}
