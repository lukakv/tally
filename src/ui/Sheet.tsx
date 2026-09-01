import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { X } from 'lucide-react'
import { haptic } from './haptics'
import { springSoft, tap } from './motion'
import { cx } from './cx'

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

let sheetSeq = 0
/** popstate events this component caused itself, waiting to be swallowed */
let selfNavigations = 0

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

  // Android's back gesture should close the sheet, not leave the app, so each
  // open sheet owns one history entry.
  //
  // history.back() resolves asynchronously, so the popstate it triggers can
  // land after this effect has already been torn down and re-run — under
  // StrictMode that reliably closed the sheet the instant it opened. The
  // module-level counter lets whichever listener is alive at that moment know
  // the event was ours and swallow it.
  useEffect(() => {
    if (!open) return
    const id = ++sheetSeq
    history.pushState({ tallySheet: id }, '')

    const onPop = () => {
      if (selfNavigations > 0) {
        selfNavigations--
        return
      }
      onClose()
    }
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('popstate', onPop)
      // only unwind the entry we actually pushed
      if (history.state?.tallySheet === id) {
        selfNavigations++
        history.back()
      }
    }
  }, [open, onClose])

  // Hardware back / Escape closes the top sheet instead of leaving the app.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
