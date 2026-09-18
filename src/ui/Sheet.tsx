import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { X } from 'lucide-react'
import { haptic } from './haptics'
import { springSoft, tap } from './motion'
import { cx } from './cx'
import { popSheet, pushSheet } from './sheetStack'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** shown on the right of the header */
  action?: ReactNode
  children: ReactNode
  /** full-height sheet for dense flows like the entry form */
  tall?: boolean
  /** hide the close button when the sheet has its own primary action */
  hideClose?: boolean
  /** off when the content manages its own scrolling, e.g. a pinned keypad */
  scroll?: boolean
}

const DISMISS_DISTANCE = 110
const DISMISS_VELOCITY = 520

export function Sheet({
  open,
  onClose,
  title,
  action,
  children,
  tall = false,
  hideClose = false,
  scroll = true,
}: SheetProps) {
  // Freeze the page behind the sheet so dragging never scrolls both layers.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  /**
   * onClose is almost always an inline arrow, so it is a different function on
   * every render of whatever owns the sheet. Listing it as a dependency below
   * made the history effect tear down and rebuild constantly — and since that
   * teardown calls history.back(), and a history navigation dismisses the
   * on-screen keyboard on Android, typing became impossible and the back
   * guard drifted until real back presses stopped closing anything.
   *
   * Holding it in a ref keeps the handler current while the effect below
   * depends only on whether the sheet is open.
   */
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Android's back gesture should close the sheet rather than leave the app.
  // The stack decides which sheet that is, so nested sheets close one at a
  // time and in the right order.
  useEffect(() => {
    if (!open) return
    const id = pushSheet(() => onCloseRef.current())
    return () => popSheet(id)
  }, [open])

  // Hardware back / Escape closes the top sheet instead of leaving the app.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > DISMISS_DISTANCE || info.velocity.y > DISMISS_VELOCITY) {
      haptic('tap')
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <motion.div
            className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            className={cx(
              'relative flex flex-col overflow-hidden rounded-t-[28px] bg-surface',
              'shadow-[var(--shadow-sheet)] ring-1 ring-line/70',
              tall ? 'h-[92dvh]' : 'max-h-[88dvh]',
            )}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springSoft}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
          >
            {/* grab handle doubles as the drag affordance */}
            <div className="flex shrink-0 cursor-grab justify-center pt-3 pb-1 active:cursor-grabbing">
              <div className="h-1 w-9 rounded-full bg-surface-3" />
            </div>

            {(title || !hideClose || action) && (
              <div className="flex shrink-0 items-center gap-3 px-5 pt-1 pb-3">
                <div className="min-w-0 flex-1 text-[17px] leading-tight font-semibold tracking-[-0.01em]">
                  {title}
                </div>
                {action}
                {!hideClose && (
                  <motion.button
                    whileTap={tap}
                    onClick={onClose}
                    aria-label="Close"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-dim"
                  >
                    <X size={16} strokeWidth={2.5} />
                  </motion.button>
                )}
              </div>
            )}

            <div
              className={cx(
                'no-scrollbar min-h-0 flex-1 overscroll-contain',
                scroll ? 'overflow-y-auto' : 'flex flex-col overflow-hidden',
              )}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
