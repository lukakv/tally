import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Plus, UserPlus } from 'lucide-react'
import { formatMoney, splitEvenly, toMinor } from '../lib/money'
import { useStore } from '../lib/store'
import { ME, type Split } from '../lib/types'
import { Sheet } from '../ui/Sheet'
import { Segmented } from '../ui/Segmented'
import { Button } from '../ui/primitives'
import { PersonAvatar } from '../ui/CategoryIcon'
import { Money } from '../ui/Money'
import { haptic } from '../ui/haptics'
import { spring, springSoft, tap } from '../ui/motion'
import { cx } from '../ui/cx'

type Mode = 'even' | 'custom'

export function SplitEditor({
  open,
  onClose,
  amount,
  value,
  onSave,
}: {
  open: boolean
  onClose: () => void
  /** total of the transaction, minor units */
  amount: number
  value: Split | null
  onSave: (split: Split | null) => void
}) {
  const people = useStore((s) => s.people)
  const addPerson = useStore((s) => s.addPerson)
  const currency = useStore((s) => s.settings.currency)

  const [paidBy, setPaidBy] = useState<string>(ME)
  const [participants, setParticipants] = useState<string[]>([ME])
  const [mode, setMode] = useState<Mode>('even')
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  // Re-seed from the incoming split each time the sheet is opened.
  useEffect(() => {
    if (!open) return
    if (value) {
      setPaidBy(value.paidBy)
      setParticipants(value.shares.map((s) => s.who))
      const even = splitEvenly(amount, value.shares.length)
      const isEven = value.shares.every((s, i) => s.amount === even[i])
      setMode(isEven ? 'even' : 'custom')
      setCustom(
        Object.fromEntries(value.shares.map((s) => [s.who, (s.amount / 100).toFixed(2)])),
      )
    } else {
      setPaidBy(ME)
      setParticipants([ME])
      setMode('even')
      setCustom({})
    }
    setAdding(false)
    setNewName('')
  }, [open, value, amount])

  const everyone = useMemo(() => [{ id: ME, name: 'You', color: 'var(--accent)' }, ...people], [people])

  const shares = useMemo(() => {
    if (mode === 'even') {
      const parts = splitEvenly(amount, participants.length)
      return participants.map((who, i) => ({ who, amount: parts[i] ?? 0 }))
    }
    return participants.map((who) => ({ who, amount: toMinor(custom[who] ?? '0') }))
  }, [mode, amount, participants, custom])

  const assigned = shares.reduce((sum, s) => sum + s.amount, 0)
  const remainder = amount - assigned
  const valid = participants.length >= 2 && (mode === 'even' || remainder === 0)

  function toggleParticipant(id: string) {
    haptic('select')
    setParticipants((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev
        const next = prev.filter((p) => p !== id)
        // the payer must remain part of the conversation
        if (paidBy === id) setPaidBy(next[0] ?? ME)
        return next
      }
      return [...prev, id]
    })
  }

  function commitNewPerson() {
    const name = newName.trim()
    if (!name) return
    const id = addPerson(name)
    setParticipants((p) => [...p, id])
    setNewName('')
    setAdding(false)
    haptic('success')
  }

  function nameOf(id: string) {
    return id === ME ? 'You' : (people.find((p) => p.id === id)?.name ?? 'Someone')
  }
  function colorOf(id: string) {
    return id === ME ? 'var(--accent)' : (people.find((p) => p.id === id)?.color ?? '#94A3B8')
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Split this expense"
      action={
        value && (
          <button
            onClick={() => {
              haptic('tap')
              onSave(null)
              onClose()
            }}
            className="mr-1 text-[13.5px] font-medium text-neg"
          >
            Remove
          </button>
        )
      }
    >
      <div className="space-y-6 px-5 pt-1 pb-6">
        <section>
          <h3 className="mb-2.5 px-1 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
            Who paid
          </h3>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {everyone
              .filter((p) => participants.includes(p.id))
              .map((p) => {
                const active = paidBy === p.id
                return (
                  <motion.button
                    key={p.id}
                    whileTap={tap}
                    onClick={() => {
                      haptic('select')
                      setPaidBy(p.id)
                    }}
                    className={cx(
                      'flex h-11 shrink-0 items-center gap-2 rounded-full pr-4 pl-1.5 text-[13.5px] font-medium transition-colors',
                      active ? 'text-text' : 'bg-surface-2 text-dim ring-1 ring-line/50',
                    )}
                    style={
                      active
                        ? { backgroundColor: colorOf(p.id) + '22', boxShadow: `inset 0 0 0 1px ${colorOf(p.id)}55` }
                        : undefined
                    }
                  >
                    <PersonAvatar name={p.name} color={colorOf(p.id)} size={32} dimmed={!active} />
                    {p.name}
                  </motion.button>
                )
              })}
          </div>
        </section>

        <section>
          <h3 className="mb-2.5 px-1 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
            Split between
          </h3>
          <div className="flex flex-wrap gap-2">
            {everyone.map((p) => {
              const on = participants.includes(p.id)
              return (
                <motion.button
                  key={p.id}
                  whileTap={tap}
                  onClick={() => toggleParticipant(p.id)}
                  className={cx(
                    'flex h-11 items-center gap-2 rounded-full pr-4 pl-1.5 text-[13.5px] font-medium transition-colors',
                    on ? 'text-text' : 'bg-surface-2 text-dim ring-1 ring-line/50',
                  )}
                  style={
                    on
                      ? { backgroundColor: colorOf(p.id) + '22', boxShadow: `inset 0 0 0 1px ${colorOf(p.id)}55` }
                      : undefined
                  }
                >
                  <PersonAvatar name={p.name} color={colorOf(p.id)} size={32} dimmed={!on} />
                  {p.name}
                  {on && <Check size={14} strokeWidth={3} />}
                </motion.button>
              )
            })}

            {!adding && (
              <motion.button
                whileTap={tap}
                onClick={() => {
                  haptic('tap')
                  setAdding(true)
                }}
                className="flex h-11 items-center gap-2 rounded-full border border-dashed border-line px-4 text-[13.5px] font-medium text-dim"
              >
                <UserPlus size={15} strokeWidth={2.2} />
                Add someone
              </motion.button>
            )}
          </div>

          <AnimatePresence>
            {adding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={springSoft}
                className="overflow-hidden"
              >
                <div className="flex gap-2 pt-3">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && commitNewPerson()}
                    placeholder="Their name"
                    className="h-11 flex-1 rounded-2xl bg-surface-2 px-4 text-[15px] ring-1 ring-line/50 placeholder:text-faint"
                  />
                  <Button variant="primary" onClick={commitNewPerson} disabled={!newName.trim()}>
                    <Plus size={16} strokeWidth={2.6} />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {participants.length >= 2 && (
          <section>
            <Segmented
              options={[
                { value: 'even', label: 'Split evenly' },
                { value: 'custom', label: 'Exact amounts' },
              ]}
              value={mode}
              onChange={(m) => {
                if (m === 'custom') {
                  // carry the even split in as the starting point
                  const parts = splitEvenly(amount, participants.length)
                  setCustom(
                    Object.fromEntries(
                      participants.map((who, i) => [who, ((parts[i] ?? 0) / 100).toFixed(2)]),
                    ),
                  )
                }
                setMode(m)
              }}
            />

            <div className="mt-3 divide-y divide-line-soft overflow-hidden rounded-[var(--radius-card)] bg-surface ring-1 ring-line/50">
              {shares.map((s) => (
                <motion.div layout key={s.who} className="flex items-center gap-3 px-4 py-3">
                  <PersonAvatar name={nameOf(s.who)} color={colorOf(s.who)} size={32} />
                  <span className="flex-1 text-[14.5px]">{nameOf(s.who)}</span>
                  {mode === 'even' ? (
                    <Money value={s.amount} className="text-[14.5px]" />
                  ) : (
                    <span className="flex h-9 w-28 items-center rounded-xl bg-surface-2 px-3 ring-1 ring-line/50 focus-within:ring-accent/60">
                      <span className="mr-1 text-[13px] text-faint">
                        {formatMoney(0, currency, { decimals: 'none' }).replace('0', '')}
                      </span>
                      <input
                        inputMode="decimal"
                        value={custom[s.who] ?? ''}
                        onChange={(e) =>
                          setCustom((c) => ({
                            ...c,
                            [s.who]: e.target.value.replace(/[^\d.,]/g, ''),
                          }))
                        }
                        className="w-full bg-transparent text-right text-[14.5px] tabular-nums"
                      />
                    </span>
                  )}
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {mode === 'custom' && remainder !== 0 && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={spring}
                  className="px-2 pt-2.5 text-[12.5px] text-save"
                >
                  {remainder > 0
                    ? `${formatMoney(remainder, currency)} still unassigned`
                    : `${formatMoney(-remainder, currency)} over the total`}
                </motion.p>
              )}
            </AnimatePresence>
          </section>
        )}

        {participants.length < 2 && (
          <p className="px-1 text-[13px] leading-relaxed text-faint">
            Pick at least one more person to split with.
          </p>
        )}

        <Button
          block
          size="lg"
          variant="primary"
          disabled={!valid}
          onClick={() => {
            haptic('success')
            onSave({ paidBy, shares })
            onClose()
          }}
        >
          Save split
        </Button>
      </div>
    </Sheet>
  )
}
