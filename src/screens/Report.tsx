import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChartPie, ChevronDown, Plus, Target } from 'lucide-react'
import { activeMonths, budgetRows, budgetTotals, categoryTotals, monthSummary } from '../lib/selectors'
import { currentMonthKey, monthLabel, monthProgress } from '../lib/date'
import { monthKeyOf } from '../lib/date'
import { formatMoney, symbolFor } from '../lib/money'
import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import type { Category } from '../lib/types'
import { Money } from '../ui/Money'
import { Bar, Card, EmptyState, SectionLabel } from '../ui/primitives'
import { Segmented } from '../ui/Segmented'
import { MonthNav } from '../ui/MonthNav'
import { CategoryIcon } from '../ui/CategoryIcon'
import { haptic } from '../ui/haptics'
import { spring, springSoft } from '../ui/motion'
import { cx } from '../ui/cx'
import { Screen, ScreenTitle } from '../components/Screen'
import { Donut } from '../components/Donut'
import { TransactionRow } from '../components/TransactionRow'
import { BudgetSheet } from '../components/BudgetSheet'

type Mode = 'spending' | 'budget' | 'income'

/** Name column flexes; the three figures get fixed, equal columns. */
const ROW_GRID = 'grid grid-cols-[minmax(0,1fr)_58px_58px_62px] items-center gap-2'

/** Table figures drop the currency symbol — it is stated once in the header. */
function Cell({
  value,
  tone,
  signed,
  bold,
}: {
  value: number
  tone: 'dim' | 'plain' | 'pos' | 'neg'
  signed?: boolean
  bold?: boolean
}) {
  const currency = useStore((s) => s.settings.currency)
  return (
    <span
      className={cx(
        'tnum text-[13px]',
        bold && 'font-medium',
        tone === 'dim' ? 'text-dim' : tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-text',
      )}
    >
      {formatMoney(value, currency, {
        decimals: 'auto',
        signed,
        showSymbol: false,
      })}
    </span>
  )
}

export function Report() {
  const transactions = useStore((s) => s.transactions)
  const categories = useStore((s) => s.categories)
  const budgets = useStore((s) => s.budgets)
  const overrides = useStore((s) => s.budgetOverrides)
  const month = useUI((s) => s.month)
  const setMonth = useUI((s) => s.setMonth)
  const openEntry = useUI((s) => s.openEntry)

  const currency = useStore((s) => s.settings.currency)

  const [mode, setMode] = useState<Mode>('spending')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [budgetFor, setBudgetFor] = useState<Category | null>(null)

  const months = useMemo(() => activeMonths(transactions, currentMonthKey()), [transactions])
  const summary = useMemo(() => monthSummary(transactions, month), [transactions, month])

  const rows = useMemo(
    () => categoryTotals(transactions, categories, month, mode === 'income' ? 'income' : 'expense'),
    [transactions, categories, month, mode],
  )

  const budgetList = useMemo(
    () => budgetRows(transactions, categories, budgets, overrides, month),
    [transactions, categories, budgets, overrides, month],
  )
  const totals = useMemo(() => budgetTotals(budgetList), [budgetList])

  const unbudgeted = useMemo(
    () =>
      categories.filter(
        (c) => c.kind === 'expense' && !c.archived && !budgetList.some((r) => r.category.id === c.id),
      ),
    [categories, budgetList],
  )

  // Savings is a transfer between pots, not consumption. Leaving it in the
  // breakdown would make the percentages add up to more than the headline,
  // so it is reported on its own line under the chart instead.
  const breakdown = rows.filter((r) => !(mode === 'spending' && r.category.system === 'savings'))
  const headline = mode === 'income' ? summary.income : summary.spent
  const pace = monthProgress(month)

  return (
    <Screen>
      <ScreenTitle title="Report" sub="Where the month went" />

      <div className="mb-3">
        <MonthNav month={month} onChange={setMonth} months={months} />
      </div>

      <div className="mb-5">
        <Segmented
          options={[
            { value: 'spending', label: 'Spending', color: 'var(--neg)' },
            { value: 'budget', label: 'Budget', color: 'var(--accent)' },
            { value: 'income', label: 'Income', color: 'var(--pos)' },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m)
            setExpanded(null)
          }}
        />
      </div>

      <div>
        {mode === 'budget' ? (
          <motion.div
            key="budget"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSoft}
            className="space-y-5"
          >
            {totals.budget > 0 ? (
              <Card className="p-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
                    {totals.diff >= 0 ? 'Left to spend' : 'Over budget'}
                  </p>
                  <p className="text-[12px] text-faint">
                    {Math.round(totals.progress * 100)}% used
                  </p>
                </div>
                <Money
                  value={Math.abs(totals.diff)}
                  tone={totals.diff >= 0 ? 'plain' : 'neg'}
                  className="mt-1 block text-[34px] leading-none font-semibold tracking-[-0.03em]"
                />

                <div className="relative mt-4">
                  <Bar progress={totals.progress} color="var(--accent)" height={10} />
                  {month === currentMonthKey() && (
                    <div
                      className="absolute -top-1 h-[18px] w-[2px] rounded-full bg-text/45"
                      style={{ left: `calc(${pace * 100}% - 1px)` }}
                      title="Where you are in the month"
                    />
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-[12.5px] text-faint">
                  <span>
                    <Money value={totals.spent} tone="dim" className="text-[12.5px]" /> of{' '}
                    <Money value={totals.budget} tone="dim" className="text-[12.5px]" />
                  </span>
                  {totals.overCount > 0 && (
                    <span className="text-neg">
                      {totals.overCount} over{' '}
                      {totals.overCount === 1 ? 'category' : 'categories'}
                    </span>
                  )}
                </div>
                {month === currentMonthKey() && (
                  <p className="mt-2 text-[12px] text-faint">
                    {totals.progress > pace + 0.06
                      ? 'Spending faster than the month is passing.'
                      : totals.progress < pace - 0.06
                        ? 'Running comfortably ahead of pace.'
                        : 'Right on pace for the month.'}
                  </p>
                )}
              </Card>
            ) : (
              <Card>
                <EmptyState
                  icon={<Target size={22} strokeWidth={1.9} />}
                  title="No budgets set"
                  hint="Pick a category below and decide what you want to spend there each month. Tally will track the difference for you."
                />
              </Card>
            )}

            {budgetList.length > 0 && (
              <div>
                <SectionLabel>Planned vs actual · {symbolFor(currency)}</SectionLabel>
                <Card className="divide-y divide-line-soft overflow-hidden">
                  <div className={cx(ROW_GRID, 'bg-surface-2/40 px-4 py-2 text-[10.5px] font-semibold tracking-[0.05em] text-faint uppercase')}>
                    <span>Category</span>
                    <span className="text-right">Planned</span>
                    <span className="text-right">Actual</span>
                    <span className="text-right">Diff</span>
                  </div>
                  {budgetList.map((r) => (
                    <button
                      key={r.category.id}
                      onClick={() => {
                        haptic('tap')
                        setBudgetFor(r.category)
                      }}
                      className="w-full px-4 py-3 text-left active:bg-surface-2"
                    >
                      <div className={ROW_GRID}>
                        <div className="flex min-w-0 items-center gap-2">
                          <CategoryIcon
                            icon={r.category.icon}
                            color={r.category.color}
                            size="sm"
                          />
                          <span className="truncate text-[13.5px] font-medium">
                            {r.category.name}
                          </span>
                        </div>
                        <span className="text-right">
                          {r.hasBudget ? (
                            <Cell value={r.budget} tone="dim" />
                          ) : (
                            <span className="text-[13px] text-faint">—</span>
                          )}
                        </span>
                        <span className="text-right">
                          <Cell value={r.spent} tone="plain" bold />
                        </span>
                        <span className="text-right">
                          {r.hasBudget ? (
                            <Cell value={r.diff} tone={r.diff >= 0 ? 'pos' : 'neg'} signed bold />
                          ) : (
                            <span className="text-[13px] text-faint">—</span>
                          )}
                        </span>
                      </div>
                      {r.hasBudget && (
                        <div className="mt-2 pl-[40px]">
                          <Bar progress={r.progress} color={r.category.color} height={4} />
                        </div>
                      )}
                    </button>
                  ))}
                </Card>
                <p className="px-2 pt-2.5 text-[12px] text-faint">
                  Tap a row to set or change its monthly budget.
                </p>
              </div>
            )}

            {unbudgeted.length > 0 && (
              <div>
                <SectionLabel>Add a budget</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {unbudgeted.map((c) => (
                    <motion.button
                      key={c.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        haptic('tap')
                        setBudgetFor(c)
                      }}
                      className="flex h-10 items-center gap-2 rounded-full bg-surface px-3.5 pl-2 text-[13px] font-medium text-dim ring-1 ring-line/50"
                    >
                      <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                      {c.name}
                      <Plus size={14} strokeWidth={2.4} className="text-faint" />
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSoft}
            className="space-y-5"
          >
            {breakdown.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<ChartPie size={22} strokeWidth={1.9} />}
                  title={`No ${mode === 'income' ? 'income' : 'spending'} in ${monthLabel(month)}`}
                  hint="Once you log a few entries this is where the shape of the month shows up."
                />
              </Card>
            ) : (
              <>
                <Card className="flex flex-col items-center p-5">
                  <Donut
                    segments={breakdown.map((r) => ({
                      id: r.category.id,
                      value: r.total,
                      color: r.category.color,
                    }))}
                  >
                    <div>
                      <p className="text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">
                        {mode === 'income' ? 'Earned' : 'Spent'}
                      </p>
                      <Money
                        value={headline}
                        tone="plain"
                        compactCents
                        className="mt-0.5 block text-[22px] leading-none font-semibold tracking-[-0.02em]"
                      />
                    </div>
                  </Donut>

                  {mode === 'spending' && summary.saved > 0 && (
                    <p className="mt-4 text-[12.5px] text-faint">
                      Plus <Money value={summary.saved} tone="save" className="text-[12.5px]" />{' '}
                      moved into savings.
                    </p>
                  )}
                </Card>

                <div>
                  <SectionLabel>
                    {mode === 'income' ? 'By source' : 'By category'}
                  </SectionLabel>
                  <Card className="divide-y divide-line-soft overflow-hidden">
                    {breakdown.map((r) => {
                      const open = expanded === r.category.id
                      const entries = transactions
                        .filter(
                          (t) =>
                            t.categoryId === r.category.id &&
                            monthKeyOf(t.date) === month &&
                            t.kind === (mode === 'income' ? 'income' : 'expense'),
                        )
                        .sort((a, b) => (a.date < b.date ? 1 : -1))

                      return (
                        <div key={r.category.id}>
                          <button
                            onClick={() => {
                              haptic('tap')
                              setExpanded(open ? null : r.category.id)
                            }}
                            className="w-full px-4 py-3 text-left active:bg-surface-2"
                          >
                            <div className="flex items-center gap-3">
                              <CategoryIcon
                                icon={r.category.icon}
                                color={r.category.color}
                                size="md"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="truncate text-[14.5px] font-medium">
                                    {r.category.name}
                                  </span>
                                  <span className="tnum shrink-0 text-[12px] text-faint">
                                    {Math.round(r.fraction * 100)}%
                                  </span>
                                </div>
                                <div className="mt-1.5">
                                  <Bar
                                    progress={r.fraction}
                                    color={r.category.color}
                                    height={4}
                                    track={false}
                                  />
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <Money
                                  value={r.total}
                                  tone={mode === 'income' ? 'pos' : 'plain'}
                                  className="text-[15px] font-medium"
                                />
                                <p className="text-[11.5px] text-faint">
                                  {r.count} {r.count === 1 ? 'entry' : 'entries'}
                                </p>
                              </div>
                              <motion.span
                                animate={{ rotate: open ? 180 : 0 }}
                                transition={spring}
                                className="shrink-0 text-faint"
                              >
                                <ChevronDown size={16} strokeWidth={2.3} />
                              </motion.span>
                            </div>
                          </button>

                          <AnimatePresence initial={false}>
                            {open && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={springSoft}
                                className="overflow-hidden bg-bg-soft/60"
                              >
                                <div className="divide-y divide-line-soft">
                                  {entries.map((t) => (
                                    <TransactionRow
                                      key={t.id}
                                      tx={t}
                                      showDate
                                      onClick={(x) => openEntry({ tx: x })}
                                    />
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}

                    <div
                      className={cx(
                        'flex items-center justify-between bg-surface-2/40 px-4 py-3',
                        'text-[13.5px] font-semibold',
                      )}
                    >
                      <span className="text-dim">
                        Total {mode === 'income' ? 'earned' : 'spent'}
                      </span>
                      <Money
                        value={headline}
                        tone={mode === 'income' ? 'pos' : 'plain'}
                        className="text-[15px]"
                      />
                    </div>
                  </Card>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>

      <BudgetSheet
        open={budgetFor !== null}
        onClose={() => setBudgetFor(null)}
        category={budgetFor}
        month={month}
        spent={budgetList.find((r) => r.category.id === budgetFor?.id)?.spent ?? 0}
      />
    </Screen>
  )
}
