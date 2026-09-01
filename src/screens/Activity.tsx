import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Inbox } from 'lucide-react'
import { activeMonths, monthSummary, myShare } from '../lib/selectors'
import { currentMonthKey, dayLabel, monthKeyOf } from '../lib/date'
import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import type { Transaction } from '../lib/types'
import { Money } from '../ui/Money'
import { Button, Card, Chip, EmptyState } from '../ui/primitives'
import { Segmented } from '../ui/Segmented'
import { MonthNav } from '../ui/MonthNav'
import { springSoft } from '../ui/motion'
import { Screen, ScreenTitle } from '../components/Screen'
import { TransactionRow } from '../components/TransactionRow'

type Filter = 'all' | 'expense' | 'income'

export function Activity() {
  const transactions = useStore((s) => s.transactions)
  const categories = useStore((s) => s.categories)
  const month = useUI((s) => s.month)
  const setMonth = useUI((s) => s.setMonth)
  const openEntry = useUI((s) => s.openEntry)

  const [filter, setFilter] = useState<Filter>('all')
  const [categoryId, setCategoryId] = useState<string | null>(null)

  const months = useMemo(
    () => activeMonths(transactions, currentMonthKey()),
    [transactions],
  )
  const summary = useMemo(() => monthSummary(transactions, month), [transactions, month])

  const inMonth = useMemo(
    () => transactions.filter((t) => monthKeyOf(t.date) === month),
    [transactions, month],
  )

  /** Only offer filters for categories that actually appear this month. */
  const presentCategories = useMemo(() => {
    const ids = new Set(inMonth.filter((t) => filter === 'all' || t.kind === filter).map((t) => t.categoryId))
    return categories.filter((c) => ids.has(c.id))
  }, [inMonth, categories, filter])

  const visible = useMemo(
    () =>
      inMonth
        .filter((t) => (filter === 'all' ? true : t.kind === filter))
        .filter((t) => (categoryId ? t.categoryId === categoryId : true))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
    [inMonth, filter, categoryId],
  )

  const days = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of visible) {
      const list = map.get(t.date)
      if (list) list.push(t)
      else map.set(t.date, [t])
    }
    return [...map.entries()]
  }, [visible])

  const filteredTotal = visible.reduce(
    (sum, t) => sum + (t.kind === 'income' ? myShare(t) : -myShare(t)),
    0,
  )

  return (
    <Screen>
      <ScreenTitle
        title="Activity"
        sub={`${summary.expenseCount + summary.incomeCount} entries this month`}
      />

      <div className="mb-3">
        <MonthNav month={month} onChange={setMonth} months={months} />
      </div>

      <div className="mb-3">
        <Segmented
          options={[
            { value: 'all', label: 'All' },
            { value: 'expense', label: 'Expenses', color: 'var(--neg)' },
            { value: 'income', label: 'Income', color: 'var(--pos)' },
          ]}
          value={filter}
          onChange={(f) => {
            setFilter(f)
            setCategoryId(null)
          }}
        />
      </div>

      {presentCategories.length > 1 && (
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          <Chip active={categoryId === null} onClick={() => setCategoryId(null)}>
            Everything
          </Chip>
          {presentCategories.map((c) => (
            <Chip
              key={c.id}
              active={categoryId === c.id}
              color={c.color}
              onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {categoryId && (
          <motion.div
            key="filter-total"
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={springSoft}
            className="mb-4 flex items-center justify-between rounded-2xl bg-accent-soft px-4 py-3"
          >
            <span className="text-[13px] font-medium text-accent">
              {categories.find((c) => c.id === categoryId)?.name} · {visible.length}{' '}
              {visible.length === 1 ? 'entry' : 'entries'}
            </span>
            <Money
              value={Math.abs(filteredTotal)}
              tone="plain"
              className="text-[15px] font-semibold"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {days.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox size={22} strokeWidth={1.9} />}
            title="Nothing here"
            hint={
              categoryId || filter !== 'all'
                ? 'No entries match this filter for the month.'
                : 'No entries logged for this month yet.'
            }
            action={
              <Button variant="primary" onClick={() => openEntry()}>
                Add an entry
              </Button>
            }
          />
        </Card>
      ) : (
        <motion.div layout className="space-y-4">
          {days.map(([date, list]) => {
            const dayTotal = list.reduce(
              (sum, t) => sum + (t.kind === 'income' ? myShare(t) : -myShare(t)),
              0,
            )
            return (
              <motion.section layout key={date} transition={springSoft}>
                <div className="mb-2 flex items-baseline justify-between px-2">
                  <h2 className="text-[12.5px] font-semibold text-dim">{dayLabel(date)}</h2>
                  <Money
                    value={dayTotal}
                    tone={dayTotal >= 0 ? 'pos' : 'dim'}
                    signed
                    compactCents
                    className="text-[12.5px]"
                  />
                </div>
                <Card className="divide-y divide-line-soft overflow-hidden">
                  {list.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} onClick={(t) => openEntry({ tx: t })} />
                  ))}
                </Card>
              </motion.section>
            )
          })}
        </motion.div>
      )}
    </Screen>
  )
}
