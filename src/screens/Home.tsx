import { useMemo } from 'react'
import { motion } from 'motion/react'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChartPie,
  Inbox,
  PiggyBank,
  Settings,
  Users,
} from 'lucide-react'
import { currentMonthKey, monthLabel } from '../lib/date'
import {
  budgetRows,
  budgetTotals,
  monthSummary,
  personBalances,
  savingsState,
  splitOverview,
} from '../lib/selectors'
import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import { AnimatedMoney, Money } from '../ui/Money'
import { Bar, Button, Card, EmptyState, SectionLabel } from '../ui/primitives'
import { CategoryIcon, PersonAvatar } from '../ui/CategoryIcon'
import { Pressable } from '../ui/feedback'
import { riseItem, stagger, springSoft } from '../ui/motion'
import { Screen, ScreenTitle } from '../components/Screen'
import { SplitBar } from '../components/SplitBar'
import { TransactionRow } from '../components/TransactionRow'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function Home() {
  const transactions = useStore((s) => s.transactions)
  const categories = useStore((s) => s.categories)
  const people = useStore((s) => s.people)
  const settlements = useStore((s) => s.settlements)
  const budgets = useStore((s) => s.budgets)
  const overrides = useStore((s) => s.budgetOverrides)
  const openingSavings = useStore((s) => s.settings.openingSavings)

  const setTab = useUI((s) => s.setTab)
  const setMonth = useUI((s) => s.setMonth)
  const openEntry = useUI((s) => s.openEntry)
  const setSavingsOpen = useUI((s) => s.setSavingsOpen)
  const setSettingsOpen = useUI((s) => s.setSettingsOpen)

  const month = currentMonthKey()

  const summary = useMemo(() => monthSummary(transactions, month), [transactions, month])
  const savings = useMemo(
    () => savingsState(transactions, openingSavings, month),
    [transactions, openingSavings, month],
  )
  const balances = useMemo(
    () => personBalances(transactions, settlements, people),
    [transactions, settlements, people],
  )
  const shared = useMemo(() => splitOverview(balances), [balances])
  const budgetsList = useMemo(
    () => budgetRows(transactions, categories, budgets, overrides, month),
    [transactions, categories, budgets, overrides, month],
  )
  const totals = useMemo(() => budgetTotals(budgetsList), [budgetsList])
  const recent = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))
        .slice(0, 5),
    [transactions],
  )

  const hasAnything = transactions.length > 0
  const budgeted = budgetsList.filter((r) => r.hasBudget).slice(0, 3)

  return (
    <Screen>
      <ScreenTitle
        title={greeting()}
        sub={`${monthLabel(month)} · ${summary.expenseCount + summary.incomeCount} entries`}
        right={
          <Pressable
            onClick={() => setSettingsOpen(true)}
            className="grid size-10 place-items-center rounded-full bg-surface text-dim ring-1 ring-line/50"
          >
            <Settings size={18} strokeWidth={2.1} />
          </Pressable>
        }
      />

      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
        {/* ---------------------------- hero ---------------------------- */}
        <motion.div variants={riseItem}>
          <Card className="overflow-hidden p-5">
            <p className="text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
              Left this month
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <AnimatedMoney
                value={summary.left}
                tone={summary.left < 0 ? 'neg' : 'plain'}
                className="text-[38px] leading-none font-semibold tracking-[-0.03em]"
              />
            </div>

            <div className="mt-4">
              <SplitBar
                segments={[
                  { value: summary.spent - summary.fromSavings, color: 'var(--neg)', label: 'Spent' },
                  { value: summary.saved, color: 'var(--save)', label: 'Saved' },
                  { value: Math.max(summary.left, 0), color: 'var(--accent)', label: 'Left' },
                ]}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat
                icon={<ArrowDownLeft size={13} strokeWidth={2.6} />}
                label="Income"
                value={summary.income}
                tone="pos"
              />
              <Stat
                icon={<ArrowUpRight size={13} strokeWidth={2.6} />}
                label="Spent"
                value={summary.spent}
                tone="neg"
              />
              <Stat
                icon={<PiggyBank size={13} strokeWidth={2.4} />}
                label="Saved"
                value={summary.saved}
                tone="save"
              />
            </div>

            {summary.fromSavings > 0 && (
              <p className="mt-3 text-[12px] text-faint">
                <Money value={summary.fromSavings} tone="dim" className="text-[12px]" /> of that
                came out of savings.
              </p>
            )}
          </Card>
        </motion.div>

        {/* -------------------------- savings --------------------------- */}
        <motion.div variants={riseItem}>
          <Pressable onClick={() => setSavingsOpen(true)} className="block w-full">
            <Card className="flex items-center gap-4 p-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-save-soft text-save">
                <PiggyBank size={21} strokeWidth={2.1} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
                  Savings
                </p>
                <AnimatedMoney
                  value={savings.balance}
                  tone="save"
                  className="text-[22px] leading-tight font-semibold tracking-[-0.02em]"
                />
              </div>
              {savings.monthNet !== 0 && (
                <div className="text-right">
                  <Money
                    value={savings.monthNet}
                    tone="auto"
                    signed
                    className="text-[13.5px] font-medium"
                  />
                  <p className="text-[11.5px] text-faint">this month</p>
                </div>
              )}
              <ArrowRight size={17} className="shrink-0 text-faint" strokeWidth={2.2} />
            </Card>
          </Pressable>
        </motion.div>

        {/* --------------------------- shared --------------------------- */}
        {people.length > 0 && (shared.owedToMe > 0 || shared.iOwe > 0) && (
          <motion.div variants={riseItem}>
            <SectionLabel
              action={
                <button
                  onClick={() => setTab('split')}
                  className="text-[12.5px] font-medium text-accent"
                >
                  See all
                </button>
              }
            >
              Shared
            </SectionLabel>
            <Card className="divide-y divide-line-soft">
              {balances
                .filter((b) => b.balance !== 0)
                .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
                .slice(0, 3)
                .map((b) => (
                  <button
                    key={b.person.id}
                    onClick={() => setTab('split')}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
                  >
                    <PersonAvatar name={b.person.name} color={b.person.color} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium">{b.person.name}</p>
                      <p className="text-[12.5px] text-faint">
                        {b.balance > 0 ? 'owes you' : 'you owe'}
                      </p>
                    </div>
                    <Money
                      value={Math.abs(b.balance)}
                      tone={b.balance > 0 ? 'pos' : 'neg'}
                      className="text-[15px] font-medium"
                    />
                  </button>
                ))}
            </Card>
          </motion.div>
        )}

        {/* -------------------------- budgets --------------------------- */}
        {budgeted.length > 0 && (
          <motion.div variants={riseItem}>
            <SectionLabel
              action={
                <button
                  onClick={() => {
                    setMonth(month)
                    setTab('report')
                  }}
                  className="text-[12.5px] font-medium text-accent"
                >
                  Report
                </button>
              }
            >
              Budgets
            </SectionLabel>
            <Card className="space-y-4 p-4">
              {budgeted.map((r, i) => (
                <div key={r.category.id}>
                  <div className="mb-1.5 flex items-center gap-2.5">
                    <CategoryIcon icon={r.category.icon} color={r.category.color} size="sm" />
                    <span className="flex-1 truncate text-[13.5px] font-medium">
                      {r.category.name}
                    </span>
                    <span className="tnum text-[12.5px] text-faint">
                      <Money value={r.spent} tone="dim" className="text-[12.5px]" /> /{' '}
                      <Money value={r.budget} tone="dim" className="text-[12.5px]" />
                    </span>
                  </div>
                  <Bar progress={r.progress} color={r.category.color} delay={i * 0.05} />
                </div>
              ))}
              {totals.budget > 0 && (
                <div className="hairline-t flex items-center justify-between pt-3">
                  <span className="text-[13px] text-dim">
                    {totals.diff >= 0 ? 'Left to spend' : 'Over budget'}
                  </span>
                  <Money
                    value={Math.abs(totals.diff)}
                    tone={totals.diff >= 0 ? 'pos' : 'neg'}
                    className="text-[14.5px] font-semibold"
                  />
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* --------------------------- recent --------------------------- */}
        <motion.div variants={riseItem}>
          <SectionLabel
            action={
              hasAnything ? (
                <button
                  onClick={() => setTab('activity')}
                  className="text-[12.5px] font-medium text-accent"
                >
                  See all
                </button>
              ) : undefined
            }
          >
            Recent
          </SectionLabel>
          <Card className="divide-y divide-line-soft overflow-hidden">
            {hasAnything ? (
              recent.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} showDate onClick={(t) => openEntry({ tx: t })} />
              ))
            ) : (
              <EmptyState
                icon={<Inbox size={22} strokeWidth={1.9} />}
                title="Nothing logged yet"
                hint="Tap the + button to record what you earned or spent. It only takes a couple of taps."
                action={
                  <Button variant="primary" onClick={() => openEntry()}>
                    Add your first entry
                  </Button>
                }
              />
            )}
          </Card>
        </motion.div>

        {!hasAnything && (
          <motion.div variants={riseItem} className="grid grid-cols-2 gap-3">
            <QuickLink
              icon={<ChartPie size={17} strokeWidth={2.1} />}
              label="Set budgets"
              onClick={() => setTab('report')}
            />
            <QuickLink
              icon={<Users size={17} strokeWidth={2.1} />}
              label="Shared costs"
              onClick={() => setTab('split')}
            />
          </motion.div>
        )}
      </motion.div>
    </Screen>
  )
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: 'pos' | 'neg' | 'save'
}) {
  const toneClass = tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-save'
  return (
    <div className="rounded-2xl bg-surface-2/60 px-3 py-2.5">
      <div className={`flex items-center gap-1 text-[11px] font-medium ${toneClass}`}>
        {icon}
        <span className="text-faint">{label}</span>
      </div>
      <Money value={value} tone="plain" compactCents className="mt-1 block text-[15px] font-medium" />
    </div>
  )
}

function QuickLink({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Pressable onClick={onClick} className="block">
      <motion.div
        whileTap={{ scale: 0.98 }}
        transition={springSoft}
        className="flex items-center gap-2.5 rounded-[var(--radius-card)] bg-surface px-4 py-3.5 ring-1 ring-line/50"
      >
        <span className="text-accent">{icon}</span>
        <span className="text-[13.5px] font-medium">{label}</span>
      </motion.div>
    </Pressable>
  )
}
