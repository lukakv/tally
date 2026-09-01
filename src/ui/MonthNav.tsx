import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { currentMonthKey, monthLabel, shiftMonth, type MonthKey } from '../lib/date'
import { Sheet } from './Sheet'
import { haptic } from './haptics'
import { spring, tap } from './motion'
import { cx } from './cx'

/** The label enters from the side you travelled towards and leaves the other way. */
const SLIDE = {
  enter: (d: number) => ({ opacity: 0, x: d * 18 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: d * -18 }),
}

/**
 * Month stepper. The label slides in the direction you travelled so the
 * movement matches the gesture.
 */
export function MonthNav({
  month,
  onChange,
  months,
  className,
}: {
  month: MonthKey
  onChange: (m: MonthKey) => void
  /** months that contain data, newest first — powers the jump-to picker */
  months: MonthKey[]
  className?: string
}) {
  const [dir, setDir] = useState(1)
  const [picking, setPicking] = useState(false)
  const isCurrent = month === currentMonthKey()

  function step(by: number) {
    setDir(by)
    haptic('select')
    onChange(shiftMonth(month, by))
  }

  return (
    <>
      <div className={cx('flex items-center gap-1', className)}>
        <motion.button
          whileTap={tap}
          onClick={() => step(-1)}
          aria-label="Previous month"
          className="grid size-9 place-items-center rounded-full text-dim active:bg-surface-2"
        >
          <ChevronLeft size={19} strokeWidth={2.4} />
        </motion.button>

        <motion.button
          whileTap={tap}
          onClick={() => {
            haptic('tap')
            setPicking(true)
          }}
          className="relative h-9 min-w-[9.5rem] flex-1 overflow-hidden rounded-full px-2 active:bg-surface-2"
        >
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.span
              key={month}
              custom={dir}
              variants={SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={spring}
              className="absolute inset-0 flex items-center justify-center text-[15px] font-semibold tracking-[-0.01em] whitespace-nowrap"
            >
              {monthLabel(month)}
            </motion.span>
          </AnimatePresence>
        </motion.button>

        <motion.button
          whileTap={tap}
          onClick={() => step(1)}
          disabled={isCurrent}
          aria-label="Next month"
          className="grid size-9 place-items-center rounded-full text-dim transition-opacity active:bg-surface-2 disabled:opacity-25"
        >
          <ChevronRight size={19} strokeWidth={2.4} />
        </motion.button>
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Jump to month">
        <div className="grid grid-cols-2 gap-2 px-5 pt-1 pb-8">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => {
                setDir(m < month ? -1 : 1)
                haptic('select')
                onChange(m)
                setPicking(false)
              }}
              className={cx(
                'h-12 rounded-2xl text-[14px] font-medium transition-colors',
                m === month
                  ? 'bg-accent text-accent-ink'
                  : 'bg-surface-2 text-text ring-1 ring-line/50',
              )}
            >
              {monthLabel(m)}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  )
}
