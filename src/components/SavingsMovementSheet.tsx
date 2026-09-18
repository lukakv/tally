import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownLeft, ArrowUpRight, Check, Info } from 'lucide-react'
import { symbolFor, toMinor } from '../lib/money'
import { todayISO } from '../lib/date'
import { mainPot } from '../lib/selectors'
import { SAVINGS_CATEGORY_ID } from '../lib/seed'
import { useStore } from '../lib/store'
import type { SavingsPot } from '../lib/types'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/primitives'
import { Money } from '../ui/Money'
import { toast } from '../ui/feedback'
import { haptic } from '../ui/haptics'
import { spring, springSoft, tap } from '../ui/motion'
import { cx } from '../ui/cx'

export type MovementMode = 'add' | 'take'

/** Where money added to savings came from. */
type Source = 'month' | 'existing'

/**
 * The single place savings move in or out.
 *
 * The old flow made you log an "expense" in a Savings category, which read as
 * spending and buried the one distinction that actually matters: whether the
 * money is coming out of THIS MONTH's income, or is money you already had
 * sitting somewhere. That choice is now the centre of this sheet, because it is
 * the only thing that changes what the rest of the app reports.
 */
export function SavingsMovementSheet({
  open,
  onClose,
  mode,
  potId,
}: {
  open: boolean
  onClose: () => void
  mode: MovementMode
  /** pre-selected pot; falls back to the main-currency one */
  potId?: string
}) {
  const pots = useStore((s) => s.savingsPots)
  const main = useStore((s) => s.settings.currency)
  const addSavingsEntry = useStore((s) => s.addSavingsEntry)
  const addTransaction = useStore((s) => s.addTransaction)

  const live = useMemo(() => pots.filter((p) => !p.archived), [pots])
  const fallback = mainPot(pots, main)

  const [selected, setSelected] = useState<string>('')
  const [raw, setRaw] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [source, setSource] = useState<Source>('existing')

  const pot: SavingsPot | undefined =
    live.find((p) => p.id === selected) ?? live.find((p) => p.id === potId) ?? fallback

  const isMainCurrency = pot?.currency === main
  const amount = toMinor(raw || '0')

  useEffect(() => {
    if (!open) return
    setSelected(potId ?? fallback?.id ?? '')
    setRaw('')
    setDate(todayISO())
    setNote('')
    setSource('existing')
  }, [open, potId, fallback?.id])

  // Only money in the main currency can come out of this month's budget —
  // the transaction ledger has no concept of any other currency.
  useEffect(() => {
    if (!isMainCurrency) setSource('existing')
  }, [isMainCurrency])

  function save() {
    if (!pot || amount <= 0) return

    if (mode === 'add' && source === 'month') {
      addTransaction({
        kind: 'expense',
        amount,
        date,
        categoryId: SAVINGS_CATEGORY_ID,
        note: note.trim() || undefined,
        account: 'main',
        isSaving: true,
        savingsPotId: pot.id,
      })
      toast('Set aside from this month')
    } else {
      addSavingsEntry({
        potId: pot.id,
        amount: mode === 'add' ? amount : -amount,
        date,
        note: note.trim() || undefined,
      })
      toast(mode === 'add' ? `Added to ${pot.name}` : `Taken out of ${pot.name}`)
    }

    haptic('success')
    onClose()
  }

  if (!pot) return null

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === 'add' ? 'Add to savings' : 'Take out of savings'}
    >
      <div className="space-y-5 px-5 pt-1 pb-7">
        {live.length > 1 && (
          <section>
            <h3 className="mb-2.5 px-1 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
              Which pot
            </h3>
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {live.map((p) => {
                const active = p.id === pot.id
                return (
                  <motion.button
                    key={p.id}
                    whileTap={tap}
                    onClick={() => {
                      haptic('select')
                      setSelected(p.id)
                    }}
                    className={cx(
                      'flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium transition-colors',
                      active ? 'text-text' : 'bg-surface-2 text-dim ring-1 ring-line/50',
                    )}
                    style={
                      active
                        ? {
                            backgroundColor: p.color + '22',
                            boxShadow: `inset 0 0 0 1px ${p.color}55`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: active ? p.color : 'var(--text-faint)' }}
                    />
                    {p.name}
                    <span className="text-[11.5px] opacity-60">{p.currency}</span>
                  </motion.button>
                )
              })}
            </div>
          </section>
        )}

        <div className="flex h-[72px] items-center gap-2 rounded-2xl bg-surface-2 px-4 ring-1 ring-line/50 focus-within:ring-accent/60">
          <span className="text-[26px] text-faint">{symbolFor(pot.currency)}</span>
          <input
            autoFocus
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
            placeholder="0"
            className="tnum min-w-0 flex-1 bg-transparent text-[32px] font-semibold tracking-[-0.025em] placeholder:text-faint"
          />
          <span className="shrink-0 rounded-lg bg-surface-3 px-2 py-1 text-[11.5px] font-medium text-dim">
            {pot.currency}
          </span>
        </div>

        {mode === 'add' && (
          <section>
            <h3 className="mb-2.5 px-1 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
              Where is it coming from
            </h3>
            <div className="space-y-2">
              <SourceOption
                active={source === 'existing'}
                disabled={false}
                onClick={() => setSource('existing')}
                title="Money I already had"
                body="Savings you already hold, or money moved in from somewhere else. Your month is left alone."
              />
              <SourceOption
                active={source === 'month'}
                disabled={!isMainCurrency}
                onClick={() => isMainCurrency && setSource('month')}
                title="Out of this month's money"
                body={
                  isMainCurrency
                    ? `Counts as Saved in this month and comes off what you have left.`
                    : `Only possible for pots in ${main} — this one holds ${pot.currency}.`
                }
              />
            </div>
          </section>
        )}

        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={80}
            className="h-11 min-w-0 flex-1 rounded-2xl bg-surface-2/60 px-4 text-[14.5px] ring-1 ring-line/40 placeholder:text-faint focus:ring-accent/50"
          />
          <label
            className={cx(
              'relative flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-surface-2/60 px-3.5',
              'text-[13.5px] font-medium ring-1 ring-line/40',
              date === todayISO() ? 'text-dim' : 'text-accent',
            )}
          >
            {date === todayISO() ? 'Today' : date.slice(8) + '/' + date.slice(5, 7)}
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="absolute inset-0 opacity-0"
            />
          </label>
        </div>

        <AnimatePresence>
          {mode === 'take' && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring}
              className="flex gap-2 rounded-2xl bg-surface-2/50 px-4 py-3 text-[12.5px] leading-snug text-faint"
            >
              <Info size={15} strokeWidth={2.1} className="mt-px shrink-0" />
              <span>
                This just moves money out of the pot. Spending it on something? Log that as an
                expense and turn on <span className="text-dim">From savings</span> instead, so it
                lands in the right category.
              </span>
            </motion.p>
          )}
        </AnimatePresence>

        <Button
          block
          size="lg"
          variant="primary"
          disabled={amount <= 0}
          icon={
            mode === 'add' ? (
              <ArrowDownLeft size={17} strokeWidth={2.4} />
            ) : (
              <ArrowUpRight size={17} strokeWidth={2.4} />
            )
          }
          onClick={save}
        >
          {amount > 0 ? (
            <span className="flex items-center gap-1.5">
              {mode === 'add' ? 'Add' : 'Take out'}
              <Money value={amount} currency={pot.currency} className="font-semibold" />
            </span>
          ) : (
            <span>{mode === 'add' ? 'Add to savings' : 'Take out'}</span>
          )}
        </Button>
      </div>
    </Sheet>
  )
}

function SourceOption({
  active,
  disabled,
  onClick,
  title,
  body,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  title: string
  body: string
}) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.99 }}
      transition={springSoft}
      onClick={() => {
        if (disabled) return
        haptic('select')
        onClick()
      }}
      className={cx(
        'flex w-full gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors',
        disabled && 'opacity-45',
        active ? 'bg-accent-soft ring-1 ring-accent/35' : 'bg-surface-2/60 ring-1 ring-line/40',
      )}
    >
      <span
        className={cx(
          'mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full transition-colors',
          active ? 'bg-accent text-accent-ink' : 'ring-1 ring-line',
        )}
      >
        {active && <Check size={11} strokeWidth={3.5} />}
      </span>
      <span className="min-w-0">
        <span className={cx('block text-[14px] font-medium', active ? 'text-accent' : 'text-text')}>
          {title}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-faint">{body}</span>
      </span>
    </motion.button>
  )
}
