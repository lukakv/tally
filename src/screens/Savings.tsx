import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Coins,
  Minus,
  PiggyBank,
  Plus,
  TriangleAlert,
} from 'lucide-react'
import { cashOut, isContribution, isWithdrawal, savingsOverview } from '../lib/selectors'
import { currentMonthKey, monthLabel, shortDate } from '../lib/date'
import { symbolFor } from '../lib/money'
import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import type { SavingsPot } from '../lib/types'
import { Sheet } from '../ui/Sheet'
import { AnimatedMoney, Money } from '../ui/Money'
import { Button, Card, EmptyState, SectionLabel } from '../ui/primitives'
import { confirm, toast } from '../ui/feedback'
import { haptic } from '../ui/haptics'
import { riseItem, stagger, springSoft, tap } from '../ui/motion'
import { cx } from '../ui/cx'
import { PotSheet, RatesSheet } from '../components/PotSheet'
import { SavingsMovementSheet, type MovementMode } from '../components/SavingsMovementSheet'

/** One row in the history, whichever of the two sources it came from. */
interface Movement {
  id: string
  potId: string
  date: string
  createdAt: number
  /** in the pot's currency; positive in, negative out */
  amount: number
  note?: string
  kind: 'entry' | 'transfer' | 'spend'
  txId?: string
}

export function SavingsSheet() {
  const open = useUI((s) => s.savingsOpen)
  const setOpen = useUI((s) => s.setSavingsOpen)
  const openEntry = useUI((s) => s.openEntry)

  const transactions = useStore((s) => s.transactions)
  const pots = useStore((s) => s.savingsPots)
  const entries = useStore((s) => s.savingsEntries)
  const main = useStore((s) => s.settings.currency)
  const rates = useStore((s) => s.settings.rates)
  const deleteSavingsEntry = useStore((s) => s.deleteSavingsEntry)
  const addSavingsEntry = useStore((s) => s.addSavingsEntry)

  const [movement, setMovement] = useState<MovementMode | null>(null)
  const [movementPot, setMovementPot] = useState<string | undefined>()
  const [editingPot, setEditingPot] = useState<SavingsPot | 'new' | null>(null)
  const [ratesOpen, setRatesOpen] = useState(false)

  const month = currentMonthKey()
  const overview = useMemo(
    () => savingsOverview(pots, transactions, entries, main, rates, month),
    [pots, transactions, entries, main, rates, month],
  )

  const potById = useMemo(() => new Map(pots.map((p) => [p.id, p])), [pots])

  const movements = useMemo<Movement[]>(() => {
    const out: Movement[] = entries.map((e) => ({
      id: e.id,
      potId: e.potId,
      date: e.date,
      createdAt: e.createdAt,
      amount: e.amount,
      note: e.note,
      kind: 'entry',
    }))

    for (const t of transactions) {
      if (t.kind !== 'expense' || !t.savingsPotId) continue
      if (isContribution(t)) {
        out.push({
          id: t.id,
          potId: t.savingsPotId,
          date: t.date,
          createdAt: t.createdAt,
          amount: t.amount,
          note: t.note,
          kind: 'transfer',
          txId: t.id,
        })
      } else if (isWithdrawal(t)) {
        out.push({
          id: t.id,
          potId: t.savingsPotId,
          date: t.date,
          createdAt: t.createdAt,
          amount: -cashOut(t),
          note: t.note,
          kind: 'spend',
          txId: t.id,
        })
      }
    }

    return out.sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt,
    )
  }, [entries, transactions])

  function startMovement(mode: MovementMode, potId?: string) {
    setMovementPot(potId)
    setMovement(mode)
  }

  async function removeMovement(m: Movement) {
    if (m.kind !== 'entry') {
      setOpen(false)
      const tx = transactions.find((t) => t.id === m.txId)
      if (tx) openEntry({ tx })
      return
    }
    const ok = await confirm({
      title: 'Remove this movement?',
      body: 'The pot balance goes back to what it was.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    const snapshot = entries.find((e) => e.id === m.id)
    deleteSavingsEntry(m.id)
    haptic('success')
    toast('Movement removed', {
      undo: snapshot
        ? () => {
            const { id: _id, createdAt: _c, ...rest } = snapshot
            addSavingsEntry(rest)
          }
        : undefined,
    })
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Savings"
        tall
        action={
          <motion.button
            whileTap={tap}
            onClick={() => {
              haptic('tap')
              setEditingPot('new')
            }}
            aria-label="New pot"
            className="mr-1 grid size-8 place-items-center rounded-full bg-surface-2 text-dim"
          >
            <Plus size={16} strokeWidth={2.6} />
          </motion.button>
        }
      >
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-5 px-5 pt-1 pb-8"
        >
          {/* ------------------------- headline ------------------------- */}
          <motion.div variants={riseItem}>
            <Card className="p-5 text-center">
              <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-save-soft text-save">
                <PiggyBank size={24} strokeWidth={2} />
              </div>
              <p className="text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
                Total saved
              </p>
              <AnimatedMoney
                value={overview.total}
                tone="save"
                className="mt-1 block text-[40px] leading-none font-semibold tracking-[-0.035em]"
              />
              {overview.multiCurrency && (
                <p className="mt-1 text-[12px] text-faint">combined, at your rates</p>
              )}
              {overview.monthNet !== 0 && (
                <p className="mt-2 text-[13px] text-dim">
                  <Money value={overview.monthNet} tone="auto" signed className="text-[13px]" /> in{' '}
                  {monthLabel(month)}
                </p>
              )}

              {/* the two figures the whole screen exists to answer */}
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-surface-2/70 px-3.5 py-3 text-left">
                  <p className="text-[11.5px] font-medium text-faint">You already had</p>
                  <Money
                    value={overview.totalOpening}
                    tone="plain"
                    compactCents
                    className="mt-0.5 block text-[17px] font-semibold"
                  />
                </div>
                <div className="rounded-2xl bg-pos-soft px-3.5 py-3 text-left">
                  <p className="flex items-center gap-1 text-[11.5px] font-medium text-pos">
                    <ArrowDownLeft size={13} strokeWidth={2.6} />
                    Added since
                  </p>
                  <Money
                    value={overview.totalAdded}
                    tone="plain"
                    compactCents
                    className="mt-0.5 block text-[17px] font-semibold"
                  />
                </div>
              </div>

              {overview.missingRates.length > 0 && (
                <button
                  onClick={() => {
                    haptic('tap')
                    setRatesOpen(true)
                  }}
                  className="mt-3 flex w-full items-center gap-2 rounded-2xl bg-save-soft px-3.5 py-2.5 text-left text-[12.5px] leading-snug text-save"
                >
                  <TriangleAlert size={15} strokeWidth={2.2} className="shrink-0" />
                  <span className="flex-1">
                    {overview.missingRates.join(', ')} {overview.missingRates.length === 1 ? 'is' : 'are'}{' '}
                    missing a rate, so {overview.missingRates.length === 1 ? 'it is' : 'they are'} not
                    in this total
                  </span>
                  <ChevronRight size={15} strokeWidth={2.4} />
                </button>
              )}
            </Card>
          </motion.div>

          {/* -------------------------- actions ------------------------- */}
          <motion.div variants={riseItem} className="grid grid-cols-2 gap-2.5">
            <Button
              variant="primary"
              size="md"
              icon={<Plus size={16} strokeWidth={2.6} />}
              onClick={() => startMovement('add')}
            >
              Add money
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<Minus size={16} strokeWidth={2.6} />}
              onClick={() => startMovement('take')}
            >
              Take out
            </Button>
          </motion.div>

          {/* --------------------------- pots --------------------------- */}
          <motion.div variants={riseItem}>
            <SectionLabel
              action={
                overview.multiCurrency ? (
                  <button
                    onClick={() => {
                      haptic('tap')
                      setRatesOpen(true)
                    }}
                    className="flex items-center gap-1 text-[12.5px] font-medium text-accent"
                  >
                    <Coins size={13} strokeWidth={2.3} />
                    Rates
                  </button>
                ) : undefined
              }
            >
              Pots
            </SectionLabel>

            <Card className="divide-y divide-line-soft overflow-hidden">
              {overview.pots.map((st) => (
                <button
                  key={st.pot.id}
                  onClick={() => {
                    haptic('tap')
                    setEditingPot(st.pot)
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2"
                >
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-2xl text-[14px] font-semibold"
                    style={{ backgroundColor: st.pot.color + '22', color: st.pot.color }}
                  >
                    {st.pot.currency === main ? (
                      <PiggyBank size={18} strokeWidth={2.2} />
                    ) : (
                      <span className="text-[17px]">{symbolFor(st.pot.currency)}</span>
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[14.5px] font-medium">{st.pot.name}</span>
                      <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-faint">
                        {st.pot.currency}
                      </span>
                    </div>
                    {st.monthNet !== 0 && (
                      <p className="mt-0.5 text-[12px] text-faint">
                        <Money
                          value={st.monthNet}
                          currency={st.pot.currency}
                          tone="auto"
                          signed
                          compactCents
                          className="text-[12px]"
                        />{' '}
                        this month
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <Money
                      value={st.balance}
                      currency={st.pot.currency}
                      tone="plain"
                      className="text-[15.5px] font-semibold"
                    />
                    {st.pot.currency !== main && (
                      <p className="mt-0.5 text-[11.5px] text-faint">
                        {st.inMain === null ? (
                          <span className="text-save">no rate</span>
                        ) : (
                          <>
                            ≈{' '}
                            <Money
                              value={st.inMain}
                              tone="dim"
                              compactCents
                              className="text-[11.5px]"
                            />
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={16} strokeWidth={2.2} className="shrink-0 text-faint" />
                </button>
              ))}
            </Card>
          </motion.div>

          {/* ------------------------ movements ------------------------- */}
          <motion.div variants={riseItem}>
            <SectionLabel>Movements</SectionLabel>
            {movements.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<PiggyBank size={22} strokeWidth={1.9} />}
                  title="Nothing moved yet"
                  hint="Tap Add money to record what you already have, or to set something aside from this month."
                  action={
                    <Button variant="primary" onClick={() => startMovement('add')}>
                      Add money
                    </Button>
                  }
                />
              </Card>
            ) : (
              <Card className="divide-y divide-line-soft overflow-hidden">
                {movements.slice(0, 40).map((m) => {
                  const pot = potById.get(m.potId)
                  return (
                    <motion.button
                      key={m.kind + m.id}
                      layout="position"
                      transition={springSoft}
                      whileTap={{ backgroundColor: 'var(--surface-2)' }}
                      onClick={() => removeMovement(m)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <span
                        className={cx(
                          'grid size-9 shrink-0 place-items-center rounded-xl',
                          m.amount >= 0 ? 'bg-pos-soft text-pos' : 'bg-neg-soft text-neg',
                        )}
                      >
                        {m.amount >= 0 ? (
                          <ArrowDownLeft size={16} strokeWidth={2.4} />
                        ) : (
                          <ArrowUpRight size={16} strokeWidth={2.4} />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium">{LABELS[m.kind]}</p>
                        <p className="truncate text-[12px] text-faint">
                          {[pot?.name, shortDate(m.date), m.note].filter(Boolean).join(' · ')}
                        </p>
                      </div>

                      <Money
                        value={m.amount}
                        currency={pot?.currency}
                        tone={m.amount >= 0 ? 'pos' : 'neg'}
                        signed
                        className="shrink-0 text-[14.5px] font-medium"
                      />
                    </motion.button>
                  )
                })}
              </Card>
            )}
            <p className="px-2 pt-2.5 text-[12px] leading-relaxed text-faint">
              Money set aside from a month counts as <span className="text-dim">Saved</span>, never
              as spending. Money you already had never touches a monthly total at all.
            </p>
          </motion.div>
        </motion.div>
      </Sheet>

      <SavingsMovementSheet
        open={movement !== null}
        onClose={() => setMovement(null)}
        mode={movement ?? 'add'}
        potId={movementPot}
      />
      <PotSheet
        open={editingPot !== null}
        onClose={() => setEditingPot(null)}
        pot={editingPot === 'new' ? null : editingPot}
      />
      <RatesSheet open={ratesOpen} onClose={() => setRatesOpen(false)} />
    </>
  )
}

const LABELS: Record<Movement['kind'], string> = {
  entry: 'Moved',
  transfer: 'Set aside from the month',
  spend: 'Spent from savings',
}
