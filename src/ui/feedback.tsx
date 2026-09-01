import { useEffect, useRef, type ReactNode } from 'react'
import { create } from 'zustand'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, Info } from 'lucide-react'
import { uid } from '../lib/id'
import { haptic } from './haptics'
import { spring, springSoft, tap } from './motion'
import { Button } from './primitives'
import { cx } from './cx'

/* --------------------------------- Toast -------------------------------- */

type ToastTone = 'ok' | 'info' | 'warn'

interface Toast {
  id: string
  message: string
  tone: ToastTone
  /** shown as an inline action — the main use is undoing a delete */
  undo?: () => void
  duration: number
}

interface ToastStore {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id' | 'tone' | 'duration'> & { tone?: ToastTone; duration?: number }) => void
  dismiss: (id: string) => void
}

const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: ({ message, tone = 'ok', duration = 4200, undo }) =>
    set((s) => ({
      // one at a time keeps the surface calm
      toasts: [...s.toasts.slice(-1), { id: uid(), message, tone, duration, undo }],
    })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function toast(
  message: string,
  opts: { tone?: ToastTone; undo?: () => void; duration?: number } = {},
) {
  useToasts.getState().push({ message, ...opts })
}

const TONE_ICON: Record<ToastTone, ReactNode> = {
  ok: <Check size={15} strokeWidth={2.6} className="text-pos" />,
  info: <Info size={15} strokeWidth={2.4} className="text-accent" />,
  warn: <AlertTriangle size={15} strokeWidth={2.4} className="text-save" />,
}

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToasts((s) => s.dismiss)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    timer.current = setTimeout(() => dismiss(t.id), t.duration)
    return () => clearTimeout(timer.current)
  }, [t.id, t.duration, dismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={spring}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={(_, info) => info.offset.y > 40 && dismiss(t.id)}
      className="pointer-events-auto flex items-center gap-2.5 rounded-2xl bg-surface-2/95 py-2.5 pr-2 pl-3.5 ring-1 ring-line/70 shadow-[var(--shadow-card)] backdrop-blur-xl"
    >
      {TONE_ICON[t.tone]}
      <span className="text-[13.5px] font-medium">{t.message}</span>
      {t.undo && (
        <button
          onClick={() => {
            haptic('tap')
            t.undo?.()
            dismiss(t.id)
          }}
          className="ml-1 rounded-lg px-2.5 py-1 text-[13px] font-semibold text-accent active:bg-surface-3"
        >
          Undo
        </button>
      )}
    </motion.div>
  )
}

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts)
  return (
    <div className="safe-b pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  )
}

/* -------------------------------- Confirm ------------------------------- */

interface ConfirmRequest {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

interface ConfirmStore {
  request: ConfirmRequest | null
  ask: (r: Omit<ConfirmRequest, 'resolve'>) => Promise<boolean>
  answer: (ok: boolean) => void
}

const useConfirm = create<ConfirmStore>((set, get) => ({
  request: null,
  ask: (r) =>
    new Promise<boolean>((resolve) => {
      set({ request: { ...r, resolve } })
    }),
  answer: (ok) => {
    get().request?.resolve(ok)
    set({ request: null })
  },
}))

/** `await confirm({ title: 'Delete this?' , danger: true })` */
export function confirm(r: {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}) {
  haptic('warn')
  return useConfirm.getState().ask(r)
}

export function ConfirmHost() {
  const request = useConfirm((s) => s.request)
  const answer = useConfirm((s) => s.answer)

  return (
    <AnimatePresence>
      {request && (
        <div className="fixed inset-0 z-[70] grid place-items-center p-7">
          <motion.div
            className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => answer(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={springSoft}
            className="relative w-full max-w-[22rem] rounded-[26px] bg-surface p-6 ring-1 ring-line/60 shadow-[var(--shadow-sheet)]"
          >
            <h2 className="text-[17px] leading-snug font-semibold tracking-[-0.01em]">
              {request.title}
            </h2>
            {request.body && (
              <p className="mt-2 text-[13.5px] leading-relaxed text-dim">{request.body}</p>
            )}
            <div className="mt-6 flex gap-2.5">
              <Button block onClick={() => answer(false)}>
                {request.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                block
                variant={request.danger ? 'danger' : 'primary'}
                onClick={() => answer(true)}
              >
                {request.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------ Press wrapper ---------------------------- */

export function Pressable({
  onClick,
  className,
  children,
}: {
  onClick?: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <motion.button
      whileTap={tap}
      transition={springSoft}
      onClick={() => {
        haptic('tap')
        onClick?.()
      }}
      className={cx('text-left', className)}
    >
      {children}
    </motion.button>
  )
}
