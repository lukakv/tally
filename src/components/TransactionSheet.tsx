import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, PiggyBank, Trash2, Users } from 'lucide-react'
import { splitEvenly, symbolFor, toMinor } from '../lib/money'
import { todayISO } from '../lib/date'
import { useStore } from '../lib/store'
import { ME, type Split, type Transaction, type TxKind } from '../lib/types'
import { Sheet } from '../ui/Sheet'
import { Segmented } from '../ui/Segmented'
import { Button } from '../ui/primitives'
import { CategoryIcon } from '../ui/CategoryIcon'
import { confirm, toast } from '../ui/feedback'
import { haptic } from '../ui/haptics'
import { spring, springBouncy, tap } from '../ui/motion'
import { cx } from '../ui/cx'
import { AmountKeypad, applyKey } from './AmountKeypad'
import { CategoryPickerSheet } from './CategoryPicker'
import { SplitEditor } from './SplitEditor'

function rawFromMinor(minor: number): string {
  if (minor === 0) return ''
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2)
}

export function TransactionSheet({
  open,
  onClose,
  editing,
  defaultKind = 'expense',
  defaultDate,
  preset,
}: {
  open: boolean
  onClose: () => void
  editing?: Transaction | null
  defaultKind?: TxKind
  defaultDate?: string
  /** pre-selected category / funding source for a brand new entry */
  preset?: { categoryId?: string; fromSavings?: boolean } | null
}) {
  const categories = useStore((s) => s.categories)
  const transactions = useStore((s) => s.transactions)
  const people = useStore((s) => s.people)
  const currency = useStore((s) => s.settings.currency)
  const addTransaction = useStore((s) => s.addTransaction)
  const updateTransaction = useStore((s) => s.updateTransaction)
  const deleteTransaction = useStore((s) => s.deleteTransaction)

  const [kind, setKind] = useState<TxKind>(defaultKind)
  const [raw, setRaw] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())
  const [fromSavings, setFromSavings] = useState(false)
  const [split, setSplit] = useState<Split | null>(null)
  const [pickingCategory, setPickingCategory] = useState(false)
  const [editingSplit, setEditingSplit] = useState(false)
  const [bump, setBump] = useState(0)

  const amount = toMinor(raw || '0')
  const ofKind = useMemo(
    () => categories.filter((c) => c.kind === kind && !c.archived),
    [categories, kind],
  )
  const category = ofKind.find((c) => c.id === categoryId) ?? ofKind[0]
  const isSavingsCategory = category?.system === 'savings'

  /** Most recently used category for this kind, so repeat entries are one tap. */
  const lastUsed = useMemo(() => {
    for (let i = transactions.length - 1; i >= 0; i--) {
      const t = transactions[i]
      if (t.kind === kind && categories.some((c) => c.id === t.categoryId)) return t.categoryId
    }
    return undefined
  }, [transactions, categories, kind])

  useEffect(() => {
    if (!open) return
    if (editing) {
      setKind(editing.kind)
      setRaw(rawFromMinor(editing.amount))
      setCategoryId(editing.categoryId)
      setNote(editing.note ?? '')
      setDate(editing.date)
      setFromSavings(editing.account === 'savings')
      setSplit(editing.split ?? null)
    } else {
      setKind(defaultKind)
      setRaw('')
      setCategoryId(preset?.categoryId ?? '')
      setNote('')
      setDate(defaultDate ?? todayISO())
      setFromSavings(preset?.fromSavings ?? false)
      setSplit(null)
    }
  }, [open, editing, defaultKind, defaultDate, preset])

  // Fall back to the last-used category whenever the kind changes.
  useEffect(() => {
    if (editing) return
    setCategoryId((cur) => {
      if (ofKind.some((c) => c.id === cur)) return cur
      const wanted = preset?.categoryId
      if (wanted && ofKind.some((c) => c.id === wanted)) return wanted
      return lastUsed && ofKind.some((c) => c.id === lastUsed) ? lastUsed : (ofKind[0]?.id ?? '')
    })
  }, [kind, ofKind, lastUsed, editing, preset])

  // A savings transfer is a move between pots — it can't be shared or funded
  // from the pot it is going into.
  useEffect(() => {
    if (isSavingsCategory) {
      setSplit(null)
      setFromSavings(false)
    }
  }, [isSavingsCategory])

  // Keep shares adding up to the total after the amount is edited.
  useEffect(() => {
    if (!split) return
    const sum = split.shares.reduce((s, x) => s + x.amount, 0)
    if (sum === amount) return
    const parts = splitEvenly(amount, split.shares.length)
    setSplit({
      paidBy: split.paidBy,
      shares: split.shares.map((s, i) => ({ who: s.who, amount: parts[i] ?? 0 })),
    })
  }, [amount, split])

  function press(key: string) {
    setRaw((r) => {
      const next = applyKey(r, key)
      if (next !== r && key !== 'del') setBump((b) => b + 1)
      return next
    })
  }

  function save() {
    if (amount <= 0 || !category) return
    const payload = {
      kind,
      amount,
      date,
      categoryId: category.id,
      note: note.trim() || undefined,
      ...(kind === 'expense'
        ? {
            account: fromSavings ? ('savings' as const) : ('main' as const),
            isSaving: isSavingsCategory || undefined,
            split: split ?? undefined,
          }
        : {}),
    }

    if (editing) {
      updateTransaction(editing.id, {
        ...payload,
        account: kind === 'expense' ? payload.account : undefined,
        isSaving: kind === 'expense' ? payload.isSaving : undefined,
        split: kind === 'expense' ? payload.split : undefined,
      })
      toast('Entry updated')
    } else {
      addTransaction(payload)
      toast(isSavingsCategory ? 'Moved to savings' : kind === 'income' ? 'Income added' : 'Expense added')
    }
    haptic('success')
    onClose()
  }

  async function remove() {
    if (!editing) return
    const ok = await confirm({
      title: 'Delete this entry?',
      body: 'It will be removed from every total.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    const snapshot = editing
    deleteTransaction(editing.id)
    haptic('success')
    onClose()
    toast('Entry deleted', {
      undo: () => {
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = snapshot
        addTransaction(rest)
      },
    })
  }

  const [whole, decimals] = raw.split('.')
  const wholeText = whole ? new Intl.NumberFormat('en-US').format(Number(whole)) : '0'
  const splitLabel = split
    ? split.shares.length === 2
      ? `Split with ${people.find((p) => p.id === split.shares.find((s) => s.who !== ME)?.who)?.name ?? '1 person'}`
      : `Split ${split.shares.length} ways`
    : 'Split with someone'

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        tall
        scroll={false}
        title={
          <Segmented
            className="max-w-[15rem]"
            options={[
              { value: 'expense', label: 'Expense', color: 'var(--neg)' },
              { value: 'income', label: 'Income', color: 'var(--pos)' },
            ]}
            value={kind}
            onChange={(k) => !editing && setKind(k)}
          />
        }
        action={
          editing ? (
            <button onClick={remove} aria-label="Delete entry" className="mr-1 p-1 text-neg">
              <Trash2 size={17} strokeWidth={2.1} />
            </button>
          ) : undefined
        }
      >
        {/* amount — grows to fill whatever the keypad and form leave over */}
        <div className="flex min-h-[104px] flex-1 flex-col justify-center px-5 py-3 text-center">
          <motion.div
            key={bump}
            initial={{ scale: 0.985 }}
            animate={{ scale: 1 }}
            transition={springBouncy}
            className={cx(
              'tnum text-[46px] leading-none font-semibold tracking-[-0.035em]',
              amount > 0 ? (kind === 'income' ? 'text-pos' : 'text-text') : 'text-faint',
            )}
          >
            <span className="mr-0.5 text-[0.62em] opacity-55">{symbolFor(currency)}</span>
            {wholeText}
            {raw.includes('.') && (
              <span className="text-[0.7em] opacity-60">.{(decimals ?? '').padEnd(0)}</span>
            )}
          </motion.div>

          <AnimatePresence>
            {split && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={spring}
                className="mt-2 text-[12.5px] text-dim"
              >
                Your share{' '}
                <span className="tnum font-medium text-text">
                  {symbolFor(currency)}
                  {((split.shares.find((s) => s.who === ME)?.amount ?? 0) / 100).toFixed(2)}
                </span>
                {split.paidBy !== ME && ' · someone else paid'}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* form — pinned directly above the keypad */}
        <div className="no-scrollbar shrink-0 space-y-3 overflow-y-auto px-5 pb-2">
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {ofKind.slice(0, 8).map((c) => {
              const active = c.id === category?.id
              return (
                <motion.button
                  key={c.id}
                  whileTap={tap}
                  onClick={() => {
                    haptic('select')
                    setCategoryId(c.id)
                  }}
                  className={cx(
                    'flex h-11 shrink-0 items-center gap-2 rounded-full pr-3.5 pl-1.5 text-[13px] font-medium transition-colors',
                    active ? 'text-text' : 'bg-surface-2 text-dim ring-1 ring-line/50',
                  )}
                  style={
                    active
                      ? { backgroundColor: c.color + '20', boxShadow: `inset 0 0 0 1px ${c.color}55` }
                      : undefined
                  }
                >
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" active={active} />
                  {c.name}
                </motion.button>
              )
            })}
            <motion.button
              whileTap={tap}
              onClick={() => {
                haptic('tap')
                setPickingCategory(true)
              }}
              className="h-11 shrink-0 rounded-full bg-surface-2 px-4 text-[13px] font-medium text-dim ring-1 ring-line/50"
            >
              All…
            </motion.button>
          </div>

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
              <CalendarDays size={16} strokeWidth={2.1} />
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

          {kind === 'expense' && !isSavingsCategory && (
            <div className="flex gap-2">
              <motion.button
                whileTap={tap}
                onClick={() => {
                  haptic('tap')
                  setEditingSplit(true)
                }}
                className={cx(
                  'flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-3 text-[13px] font-medium transition-colors',
                  split
                    ? 'bg-accent-soft text-accent ring-1 ring-accent/30'
                    : 'bg-surface-2/60 text-dim ring-1 ring-line/40',
                )}
              >
                <Users size={16} strokeWidth={2.1} />
                <span className="truncate">{splitLabel}</span>
              </motion.button>

              <motion.button
                whileTap={tap}
                onClick={() => {
                  haptic('select')
                  setFromSavings((v) => !v)
                }}
                className={cx(
                  'flex h-11 shrink-0 items-center gap-2 rounded-2xl px-3.5 text-[13px] font-medium transition-colors',
                  fromSavings
                    ? 'bg-save-soft text-save ring-1 ring-save/30'
                    : 'bg-surface-2/60 text-dim ring-1 ring-line/40',
                )}
              >
                <PiggyBank size={16} strokeWidth={2.1} />
                From savings
              </motion.button>
            </div>
          )}

          {isSavingsCategory && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 rounded-2xl bg-save-soft px-4 py-3 text-[12.5px] leading-snug text-save"
            >
              <PiggyBank size={16} strokeWidth={2.1} className="shrink-0" />
              This adds to your savings balance instead of counting as spending.
            </motion.p>
          )}
        </div>

        {/* keypad */}
        <div className="safe-b shrink-0 px-5 pt-2 pb-3">
          <AmountKeypad onKey={press} onClear={() => setRaw('')} />
          <Button
            block
            size="lg"
            variant="primary"
            className="mt-2.5"
            disabled={amount <= 0 || !category}
            onClick={save}
          >
            {editing ? 'Save changes' : isSavingsCategory ? 'Move to savings' : 'Add entry'}
          </Button>
        </div>
      </Sheet>

      <CategoryPickerSheet
        open={pickingCategory}
        onClose={() => setPickingCategory(false)}
        kind={kind}
        value={category?.id}
        onPick={setCategoryId}
      />

      <SplitEditor
        open={editingSplit}
        onClose={() => setEditingSplit(false)}
        amount={amount}
        value={split}
        onSave={(s) => {
          setSplit(s)
          if (s) toast('Split saved', { tone: 'info', duration: 1800 })
        }}
      />
    </>
  )
}
