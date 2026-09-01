import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { cx } from '../ui/cx'

/**
 * Every tab shares this frame: safe-area aware, capped width for large
 * screens, and enough bottom padding to clear the tab bar and its FAB.
 */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
      className={cx(
        'mx-auto w-full max-w-lg px-4 pb-32',
        'pt-[calc(env(safe-area-inset-top)+0.875rem)]',
        className,
      )}
    >
      {children}
    </motion.div>
  )
}

export function ScreenTitle({
  title,
  sub,
  right,
}: {
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
}) {
  return (
    <header className="mb-5 flex items-start gap-3 px-1">
      <div className="min-w-0 flex-1">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em]">{title}</h1>
        {sub && <p className="mt-0.5 text-[13px] text-faint">{sub}</p>}
      </div>
      {right}
    </header>
  )
}
