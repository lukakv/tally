import { useEffect, type ReactNode } from 'react'
import { motion, useAnimationControls, useMotionValue, useTransform } from 'motion/react'
import { Trash2 } from 'lucide-react'
import { haptic } from './haptics'
import { spring, springSnappy } from './motion'
import { ACTION_WIDTH, OPEN_THRESHOLD, shouldStayOpen } from './swipe'
import { cx } from './cx'

/**
 * Swipe a row aside to uncover a delete button.
 *
 * The gesture itself is deliberately harmless: no distance and no flick will
 * delete anything. It only *reveals* the action, and deleting still takes a
 * separate, aimed tap on a button that is not under your thumb when the swipe
 * ends. That rules out the two ways swipe-to-delete usually goes wrong — a
 * careless flick destroying a row, and a list that feels twitchy to scroll.
 *
 * Three things keep it calm:
 *   - the row must travel a third of the action's width before it will stay
 *     open, so a small horizontal wobble during a vertical scroll snaps back;
 *   - dragDirectionLock means a scroll that starts vertical stays vertical;
 *   - only one row is open at a time, so there is never an armed button
 *     somewhere off screen.
 *
 * A delete is still undoable from the toast, which covers a mis-aimed tap.
 */

export function SwipeRow({
  open,
  onOpenChange,
  onDelete,
  deleteLabel = 'Delete',
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => void
  deleteLabel?: string
  children: ReactNode
}) {
  const x = useMotionValue(0)
  const controls = useAnimationControls()

  // the button fades in with the swipe, so a half-open row never looks armed
  const actionOpacity = useTransform(x, [-ACTION_WIDTH, -OPEN_THRESHOLD, 0], [1, 0.5, 0])
  const actionScale = useTransform(x, [-ACTION_WIDTH, 0], [1, 0.8])

  useEffect(() => {
    controls.start({ x: open ? -ACTION_WIDTH : 0, transition: spring })
  }, [open, controls])

  return (
    <div className="relative overflow-hidden">
      {/* sits underneath; only reachable once the row has moved aside */}
      <motion.div
        style={{ opacity: actionOpacity }}
        className={cx('absolute inset-y-0 right-0 flex items-stretch', !open && 'pointer-events-none')}
        aria-hidden={!open}
      >
        <button
          tabIndex={open ? 0 : -1}
          onClick={() => {
            haptic('warn')
            onOpenChange(false)
            onDelete()
          }}
          className="flex w-[84px] flex-col items-center justify-center gap-1 bg-neg-soft text-neg"
        >
          <motion.span style={{ scale: actionScale }}>
            <Trash2 size={18} strokeWidth={2.2} />
          </motion.span>
          <span className="text-[11px] font-medium">{deleteLabel}</span>
        </button>
      </motion.div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
        dragElastic={{ left: 0.04, right: 0 }}
        dragMomentum={false}
        style={{ x }}
        animate={controls}
        onDragEnd={(_, info) => {
          const shouldOpen = shouldStayOpen(info.offset.x, info.velocity.x)
          if (shouldOpen !== open) haptic('tap')
          onOpenChange(shouldOpen)
          controls.start({ x: shouldOpen ? -ACTION_WIDTH : 0, transition: springSnappy })
        }}
        className="relative bg-surface"
      >
        {/* while open, a tap anywhere on the row just puts it back */}
        {open && (
          <button
            aria-label="Close actions"
            onClick={() => onOpenChange(false)}
            className="absolute inset-0 z-10"
          />
        )}
        {children}
      </motion.div>
    </div>
  )
}
