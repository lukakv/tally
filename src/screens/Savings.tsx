import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDownLeft, ArrowUpRight, PiggyBank, Wallet } from 'lucide-react'
import { isContribution, isWithdrawal, savingsState } from '../lib/selectors'
import { currentMonthKey, monthLabel, monthKeyOf } from '../lib/date'
import { symbolFor, toMinor } from '../lib/money'
import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import { SAVINGS_CATEGORY_ID } from '../lib/seed'
import { Sheet } from '../ui/Sheet'
import { AnimatedMoney, Money } from '../ui/Money'
import { Button, Card, EmptyState, SectionLabel } from '../ui/primitives'
import { Row } from '../ui/Field'
import { toast } from '../ui/feedback'
import { haptic } from '../ui/haptics'
import { riseItem, stagger } from '../ui/motion'
import { TransactionRow } from '../components/TransactionRow'

export function SavingsSheet() {
  const open = useUI((s) => s.savingsOpen)
  const setOpen = useUI((s) => s.setSavingsOpen)
  const openEntry = useUI((s) => s.openEntry)

  const transactions = useStore((s) => s.transactions)
  const openingSavings = useStore((s) => s.settings.openingSavings)
  const currency = useStore((s) => s.settings.currency)
  const updateSettings = useStore((s) => s.updateSettings)

  const [editingOpening, setEditingOpening] = useState(false)
  const [raw, setRaw] = useState('')

  const month = currentMonthKey()
  const state = useMemo(
    () => savingsState(transactions, openingSavings, month),
    [transactions, openingSavings, month],
  )

  const history = useMemo(
    () =>
      transactions
        .filter((t) => isContribution(t) || isWithdrawal(t))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
    [transactions],
  )

  const thisMonth = history.filter((t) => monthKeyOf(t.date) === month)

  function saveOpening() {
    updateSettings({ openingSavings: toMinor(raw || '0') })
    setEditingOpening(false)
    haptic('success')
    toast('Starting balance updated')
  }

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Savings" tall>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="space-y-5 px-5 pt-1 pb-8"
      >
        <motion.div variants={riseItem}>
          <Card className="p-5 text-center">
            <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-save-soft text-save">
              <PiggyBank size={24} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
              Total saved
            </p>
            <AnimatedMoney
              value={state.balance}
              tone="save"
              className="mt-1 block text-[40px] leading-none font-semibold tracking-[-0.035em]"
            />
            {state.monthNet !== 0 && (
              <p className="mt-2 text-[13px] text-dim">
                <Money value={state.monthNet} tone="auto" signed className="text-[13px]" /> in{' '}
                {monthLabel(month)}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-pos-soft px-3.5 py-3 text-left">
                <p className="flex items-center gap-1 text-[11.5px] font-medium text-pos">
                  <ArrowDownLeft size={13} strokeWidth={2.6} />
                  Put in
                </p>
                <Money
                  value={state.contributed}
                  tone="plain"
                  compactCents
                  className="mt-0.5 block text-[17px] font-semibold"
                />
              </div>
              <div className="rounded-2xl bg-neg-soft px-3.5 py-3 text-left">
                <p className="flex items-center gap-1 text-[11.5px] font-medium text-neg">
                  <ArrowUpRight size={13} strokeWidth={2.6} />
                  Taken out
                </p>
                <Money
                  value={state.withdrawn}
                  tone="plain"
                  compactCents
                  className="mt-0.5 block text-[17px] font-semibold"
                />
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div variants={riseItem} className="grid grid-cols-2 gap-2.5">
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setOpen(false)
              openEntry({ kind: 'expense', categoryId: SAVINGS_CATEGORY_ID })
            }}
          >
            Add to savings
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setOpen(false)
              openEntry({ kind: 'expense', fromSavings: true })
            }}
          >
            Spend from it
          </Button>
        </motion.div>

        <motion.div variants={riseItem}>
          <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface ring-1 ring-line/50">
            {editingOpening ? (
              <div className="p-4">
                <p className="mb-2 text-[13px] text-dim">
                  What was already saved before you started using Tally?
                </p>
                <div className="flex gap-2">
                  <span className="flex h-12 flex-1 items-center gap-2 rounded-2xl bg-surface-2 px-3.5 ring-1 ring-line/50 focus-within:ring-accent/60">
                    <span className="text-[17px] text-faint">{symbolFor(currency)}</span>
                    <input
                      autoFocus
                      inputMode="decimal"
                      value={raw}
                      onChange={(e) =>
                        setRaw(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))
                      }
                      placeholder="0"
                      className="tnum min-w-0 flex-1 bg-transparent text-[17px] font-medium"
                    />
                  </span>
                  <Button variant="primary" onClick={saveOpening}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <Row
                icon={
                  <div className="grid size-9 place-items-center rounded-xl bg-surface-2 text-dim">
                    <Wallet size={17} strokeWidth={2.1} />
                  </div>
                }
                label="Starting balance"
                sub="Saved before you started"
                value={<Money value={state.opening} tone="dim" compactCents />}
                chevron
                onClick={() => {
                  setRaw(
                    state.opening > 0
                      ? (state.opening / 100).toFixed(state.opening % 100 === 0 ? 0 : 2)
                      : '',
                  )
                  setEditingOpening(true)
                }}
              />
            )}
          </div>
        </motion.div>

        <motion.div variants={riseItem}>
          <SectionLabel>
            {thisMonth.length > 0 ? 'Movements' : 'History'}
          </SectionLabel>
          {history.length === 0 ? (
            <Card>
              <EmptyState
                icon={<PiggyBank size={22} strokeWidth={1.9} />}
                title="No movements yet"
                hint='Log an expense under the "Savings" category to put money in, or tick "From savings" on any expense to take money out.'
              />
            </Card>
          ) : (
            <Card className="divide-y divide-line-soft overflow-hidden">
              {history.slice(0, 40).map((t) => (
                <TransactionRow
                  key={t.id}
                  tx={t}
                  showDate
                  onClick={(x) => {
                    setOpen(false)
                    openEntry({ tx: x })
                  }}
                />
              ))}
            </Card>
          )}
        </motion.div>

        <motion.p variants={riseItem} className="px-2 text-[12px] leading-relaxed text-faint">
          Money you put into savings is not counted as spending — it is a transfer between your own
          pots. Anything you later spend from savings does count, and comes back out of this
          balance.
        </motion.p>
      </motion.div>
    </Sheet>
  )
}
