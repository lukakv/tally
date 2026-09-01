import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeftRight, Check, Pencil, Scale, Trash2, UserPlus, Users } from 'lucide-react'
import { personBalances, splitOverview, type PersonBalance } from '../lib/selectors'
import { formatMoney, symbolFor, toMinor } from '../lib/money'
import { shortDate, todayISO } from '../lib/date'
import { useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import { Money } from '../ui/Money'
import { Button, Card, EmptyState, SectionLabel } from '../ui/primitives'
import { Sheet } from '../ui/Sheet'
import { PersonAvatar } from '../ui/CategoryIcon'
import { TextField } from '../ui/Field'
import { confirm, toast } from '../ui/feedback'
import { haptic } from '../ui/haptics'
import { riseItem, stagger, springSoft, tap } from '../ui/motion'
import { Screen, ScreenTitle } from '../components/Screen'
import { TransactionRow } from '../components/TransactionRow'

export function Split() {
  const transactions = useStore((s) => s.transactions)
  const settlements = useStore((s) => s.settlements)
  const people = useStore((s) => s.people)
  const openEntry = useUI((s) => s.openEntry)

  const [detail, setDetail] = useState<PersonBalance | null>(null)
  const [settling, setSettling] = useState<PersonBalance | null>(null)
  const [adding, setAdding] = useState(false)

  const balances = useMemo(
    () => personBalances(transactions, settlements, people),
    [transactions, settlements, people],
  )
  const overview = useMemo(() => splitOverview(balances), [balances])

  // keep the open detail sheet in sync after a settle or edit
  const liveDetail = detail ? (balances.find((b) => b.person.id === detail.person.id) ?? null) : null

  const active = balances.filter((b) => b.balance !== 0)
  const settled = balances.filter((b) => b.balance === 0)

  return (
    <Screen>
      <ScreenTitle
        title="Shared"
        sub="Who owes what, at a glance"
        right={
          <motion.button
            whileTap={tap}
            onClick={() => {
              haptic('tap')
              setAdding(true)
            }}
            className="grid size-10 place-items-center rounded-full bg-surface text-dim ring-1 ring-line/50"
            aria-label="Add person"
          >
            <UserPlus size={18} strokeWidth={2.1} />
          </motion.button>
        }
      />

      {people.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={22} strokeWidth={1.9} />}
            title="No one here yet"
            hint="Add the people you regularly split costs with. When you log an expense you can divide it between them, and the running balance lands here."
            action={
              <Button variant="primary" onClick={() => setAdding(true)}>
                Add someone
              </Button>
            }
          />
        </Card>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
          <motion.div variants={riseItem}>
            <Card className="p-5">
              <p className="text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
                Net position
              </p>
              <Money
                value={overview.net}
                tone="auto"
                signed
                className="mt-1 block text-[34px] leading-none font-semibold tracking-[-0.03em]"
              />
              <p className="mt-1.5 text-[13px] text-dim">
                {overview.net > 0
                  ? 'in your favour once everyone settles up'
                  : overview.net < 0
                    ? 'you owe once everyone settles up'
                    : 'everything is square'}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-pos-soft px-3.5 py-3">
                  <p className="text-[11.5px] font-medium text-pos">Owed to you</p>
                  <Money
                    value={overview.owedToMe}
                    tone="pos"
                    className="mt-0.5 block text-[17px] font-semibold"
                  />
                </div>
                <div className="rounded-2xl bg-neg-soft px-3.5 py-3">
                  <p className="text-[11.5px] font-medium text-neg">You owe</p>
                  <Money
                    value={overview.iOwe}
                    tone="neg"
                    className="mt-0.5 block text-[17px] font-semibold"
                  />
                </div>
              </div>
            </Card>
          </motion.div>

          {active.length > 0 && (
            <motion.div variants={riseItem}>
              <SectionLabel>Open balances</SectionLabel>
              <div className="space-y-2.5">
                {active
                  .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
                  .map((b) => (
                    <PersonCard
                      key={b.person.id}
                      balance={b}
                      onOpen={() => setDetail(b)}
                      onSettle={() => setSettling(b)}
                    />
                  ))}
              </div>
            </motion.div>
          )}

          {settled.length > 0 && (
            <motion.div variants={riseItem}>
              <SectionLabel>Settled up</SectionLabel>
              <Card className="divide-y divide-line-soft overflow-hidden">
                {settled.map((b) => (
                  <button
                    key={b.person.id}
                    onClick={() => {
                      haptic('tap')
                      setDetail(b)
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
                  >
                    <PersonAvatar name={b.person.name} color={b.person.color} size={36} dimmed />
                    <span className="flex-1 truncate text-[14.5px]">{b.person.name}</span>
                    <span className="flex items-center gap-1.5 text-[12.5px] text-pos">
                      <Check size={14} strokeWidth={2.8} />
                      Square
                    </span>
                  </button>
                ))}
              </Card>
            </motion.div>
          )}

          <motion.div variants={riseItem}>
            <Button block variant="secondary" onClick={() => openEntry()} icon={<Users size={16} />}>
              Log a shared expense
            </Button>
          </motion.div>
        </motion.div>
      )}

      <AddPersonSheet open={adding} onClose={() => setAdding(false)} />
      <PersonDetailSheet
        balance={liveDetail}
        onClose={() => setDetail(null)}
        onSettle={() => {
          if (liveDetail) setSettling(liveDetail)
        }}
      />
      <SettleSheet balance={settling} onClose={() => setSettling(null)} />
    </Screen>
  )
}

function PersonCard({
  balance,
  onOpen,
  onSettle,
}: {
  balance: PersonBalance
  onOpen: () => void
  onSettle: () => void
}) {
  const owed = balance.balance > 0
  return (
    <motion.div layout transition={springSoft}>
      <Card className="overflow-hidden">
        <button
          onClick={() => {
            haptic('tap')
            onOpen()
          }}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2"
        >
          <PersonAvatar name={balance.person.name} color={balance.person.color} size={42} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{balance.person.name}</p>
            <p className="text-[12.5px] text-faint">
              {owed ? 'owes you' : 'you owe'} · {balance.entries.length}{' '}
              {balance.entries.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <Money
            value={Math.abs(balance.balance)}
            tone={owed ? 'pos' : 'neg'}
            className="text-[19px] font-semibold tracking-[-0.02em]"
          />
        </button>
        <div className="hairline-t px-3 py-2.5">
          <Button
            block
            size="sm"
            variant="quiet"
            icon={<ArrowLeftRight size={14} strokeWidth={2.3} />}
            onClick={onSettle}
          >
            Settle up
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}

function AddPersonSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addPerson = useStore((s) => s.addPerson)
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) setName('')
  }, [open])

  function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    addPerson(trimmed)
    haptic('success')
    toast(`${trimmed} added`)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add someone">
      <div className="space-y-4 px-5 pt-1 pb-7">
        <TextField
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Their name"
          maxLength={30}
        />
        <p className="px-1 text-[12.5px] leading-relaxed text-faint">
          They only exist inside this app on your phone — nothing is sent anywhere and they are
          never notified.
        </p>
        <Button block size="lg" variant="primary" disabled={!name.trim()} onClick={save}>
          Add person
        </Button>
      </div>
    </Sheet>
  )
}

function PersonDetailSheet({
  balance,
  onClose,
  onSettle,
}: {
  balance: PersonBalance | null
  onClose: () => void
  onSettle: () => void
}) {
  const settlements = useStore((s) => s.settlements)
  const deleteSettlement = useStore((s) => s.deleteSettlement)
  const deletePerson = useStore((s) => s.deletePerson)
  const updatePerson = useStore((s) => s.updatePerson)
  const currency = useStore((s) => s.settings.currency)
  const openEntry = useUI((s) => s.openEntry)

  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    if (balance) {
      setName(balance.person.name)
      setRenaming(false)
    }
  }, [balance])

  if (!balance) return null

  const theirSettlements = settlements
    .filter((s) => s.personId === balance.person.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  async function removePerson() {
    if (!balance) return
    const res = deletePerson(balance.person.id)
    if (!res.ok) {
      toast(res.reason ?? 'Could not remove', { tone: 'warn', duration: 5200 })
      return
    }
    haptic('success')
    toast('Person removed')
    onClose()
  }

  return (
    <Sheet
      open={!!balance}
      onClose={onClose}
      title={
        renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const t = name.trim()
              if (t) updatePerson(balance.person.id, { name: t })
              setRenaming(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-full rounded-lg bg-surface-2 px-2 py-1 text-[16px] font-semibold"
          />
        ) : (
          <span className="flex items-center gap-2">
            {balance.person.name}
            <button onClick={() => setRenaming(true)} className="text-faint" aria-label="Rename">
              <Pencil size={14} strokeWidth={2.2} />
            </button>
          </span>
        )
      }
    >
      <div className="px-5 pt-1 pb-7">
        <div className="rounded-[var(--radius-card)] bg-surface-2/60 p-5 text-center">
          <p className="text-[12.5px] text-faint">
            {balance.balance > 0
              ? `${balance.person.name} owes you`
              : balance.balance < 0
                ? `You owe ${balance.person.name}`
                : 'All square'}
          </p>
          <Money
            value={Math.abs(balance.balance)}
            tone={balance.balance > 0 ? 'pos' : balance.balance < 0 ? 'neg' : 'dim'}
            className="mt-1 block text-[32px] leading-none font-semibold tracking-[-0.03em]"
          />
          {balance.balance !== 0 && (
            <Button
              variant="primary"
              className="mt-4"
              icon={<ArrowLeftRight size={15} strokeWidth={2.3} />}
              onClick={onSettle}
            >
              Settle up
            </Button>
          )}
        </div>

        {balance.settled !== 0 && (
          <p className="px-1 pt-3 text-center text-[12px] text-faint">
            {formatMoney(Math.abs(balance.gross), currency)} shared ·{' '}
            {formatMoney(Math.abs(balance.settled), currency)} already settled
          </p>
        )}

        {theirSettlements.length > 0 && (
          <div className="mt-6">
            <SectionLabel>Payments</SectionLabel>
            <Card className="divide-y divide-line-soft overflow-hidden">
              {theirSettlements.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-dim">
                    <Scale size={16} strokeWidth={2.1} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px]">
                      {s.amount > 0
                        ? `${balance.person.name} paid you`
                        : `You paid ${balance.person.name}`}
                    </p>
                    <p className="text-[12px] text-faint">
                      {shortDate(s.date)}
                      {s.note ? ` · ${s.note}` : ''}
                    </p>
                  </div>
                  <Money value={Math.abs(s.amount)} tone="dim" className="text-[14px]" />
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Remove this payment?',
                        body: 'The balance will go back to what it was before.',
                        confirmLabel: 'Remove',
                        danger: true,
                      })
                      if (ok) {
                        deleteSettlement(s.id)
                        toast('Payment removed')
                      }
                    }}
                    className="shrink-0 p-1 text-faint"
                    aria-label="Remove payment"
                  >
                    <Trash2 size={15} strokeWidth={2.1} />
                  </button>
                </div>
              ))}
            </Card>
          </div>
        )}

        <div className="mt-6">
          <SectionLabel>Shared expenses</SectionLabel>
          {balance.entries.length === 0 ? (
            <Card>
              <EmptyState
                title="Nothing shared yet"
                hint={`Split an expense with ${balance.person.name} and it will show up here.`}
              />
            </Card>
          ) : (
            <Card className="divide-y divide-line-soft overflow-hidden">
              {balance.entries.map((t) => (
                <TransactionRow
                  key={t.id}
                  tx={t}
                  showDate
                  onClick={(x) => {
                    onClose()
                    openEntry({ tx: x })
                  }}
                />
              ))}
            </Card>
          )}
        </div>

        <button
          onClick={removePerson}
          className="mt-6 w-full rounded-2xl py-3 text-[13.5px] font-medium text-neg active:bg-neg-soft"
        >
          Remove {balance.person.name}
        </button>
      </div>
    </Sheet>
  )
}

function SettleSheet({
  balance,
  onClose,
}: {
  balance: PersonBalance | null
  onClose: () => void
}) {
  const addSettlement = useStore((s) => s.addSettlement)
  const currency = useStore((s) => s.settings.currency)
  const [raw, setRaw] = useState('')
  const [date, setDate] = useState(todayISO())

  const owed = (balance?.balance ?? 0) > 0
  const full = Math.abs(balance?.balance ?? 0)

  useEffect(() => {
    if (!balance) return
    setRaw((full / 100).toFixed(full % 100 === 0 ? 0 : 2))
    setDate(todayISO())
  }, [balance, full])

  if (!balance) return null

  const amount = toMinor(raw || '0')
  const valid = amount > 0 && amount <= full

  function save() {
    if (!balance || !valid) return
    addSettlement({
      personId: balance.person.id,
      // positive means money came to me, negative means it went out
      amount: owed ? amount : -amount,
      date,
    })
    haptic('success')
    toast(
      amount === full
        ? `Settled up with ${balance.person.name}`
        : `${formatMoney(amount, currency)} recorded`,
    )
    onClose()
  }

  return (
    <Sheet open={!!balance} onClose={onClose} title="Settle up">
      <div className="space-y-4 px-5 pt-1 pb-7">
        <div className="flex items-center gap-3">
          <PersonAvatar name={balance.person.name} color={balance.person.color} size={44} />
          <div>
            <p className="text-[15px] font-medium">
              {owed ? `${balance.person.name} pays you` : `You pay ${balance.person.name}`}
            </p>
            <p className="text-[12.5px] text-faint">
              Full balance is {formatMoney(full, currency)}
            </p>
          </div>
        </div>

        <div className="flex h-16 items-center gap-2 rounded-2xl bg-surface-2 px-4 ring-1 ring-line/50 focus-within:ring-accent/60">
          <span className="text-[22px] text-faint">{symbolFor(currency)}</span>
          <input
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
            className="tnum min-w-0 flex-1 bg-transparent text-[26px] font-semibold tracking-[-0.02em]"
          />
        </div>

        <div className="flex items-center gap-2">
          {amount !== full && (
            <button
              onClick={() => setRaw((full / 100).toFixed(full % 100 === 0 ? 0 : 2))}
              className="rounded-full bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-dim ring-1 ring-line/50"
            >
              Full amount
            </button>
          )}
          <label className="flex items-center gap-2 rounded-full bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-dim ring-1 ring-line/50">
            {date === todayISO() ? 'Today' : shortDate(date)}
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="w-0 opacity-0"
            />
          </label>
        </div>

        {amount > full && (
          <p className="px-1 text-[12.5px] text-neg">That is more than the outstanding balance.</p>
        )}

        <Button block size="lg" variant="primary" disabled={!valid} onClick={save}>
          Record payment
        </Button>

        <p className="px-1 text-center text-[12px] leading-relaxed text-faint">
          Settling only clears the balance — it is not counted as income or an expense.
        </p>
      </div>
    </Sheet>
  )
}
