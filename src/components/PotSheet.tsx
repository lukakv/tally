import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import { symbolFor, toMinor } from '../lib/money'
import { CURRENCIES, POT_COLORS } from '../lib/seed'
import { useStore } from '../lib/store'
import type { SavingsPot } from '../lib/types'
import { Sheet } from '../ui/Sheet'
import { Button, Card } from '../ui/primitives'
import { TextField } from '../ui/Field'
import { Money } from '../ui/Money'
import { confirm, toast } from '../ui/feedback'
import { haptic } from '../ui/haptics'
import { tap } from '../ui/motion'
import { cx } from '../ui/cx'

export function PotSheet({
  open,
  onClose,
  pot,
}: {
  open: boolean
  onClose: () => void
  /** null creates a new pot */
  pot: SavingsPot | null
}) {
  const main = useStore((s) => s.settings.currency)
  const pots = useStore((s) => s.savingsPots)
  const addPot = useStore((s) => s.addPot)
  const updatePot = useStore((s) => s.updatePot)
  const deletePot = useStore((s) => s.deletePot)

  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(main)
  const [opening, setOpening] = useState('')
  const [color, setColor] = useState(POT_COLORS[0])

  useEffect(() => {
    if (!open) return
    setName(pot?.name ?? '')
    setCurrency(pot?.currency ?? main)
    setOpening(
      pot && pot.opening > 0 ? (pot.opening / 100).toFixed(pot.opening % 100 === 0 ? 0 : 2) : '',
    )
    setColor(pot?.color ?? POT_COLORS[pots.length % POT_COLORS.length])
  }, [open, pot, main, pots.length])

  // Changing an existing pot's currency would silently reinterpret every
  // amount already recorded against it, so it is fixed once created.
  const currencyLocked = !!pot

  function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    const openingMinor = toMinor(opening || '0')

    if (pot) updatePot(pot.id, { name: trimmed, color, opening: openingMinor })
    else addPot({ name: trimmed, currency, color, opening: openingMinor })

    haptic('success')
    toast(pot ? 'Pot updated' : `${trimmed} added`)
    onClose()
  }

  async function remove() {
    if (!pot) return
    const ok = await confirm({
      title: `Remove "${pot.name}"?`,
      body: 'Its balance and movement history go with it. This cannot be undone.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    const res = deletePot(pot.id)
    if (!res.ok) {
      toast(res.reason ?? 'Could not remove that pot', { tone: 'warn', duration: 6000 })
      return
    }
    haptic('success')
    toast('Pot removed')
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pot ? 'Edit pot' : 'New savings pot'}
      action={
        pot ? (
          <button onClick={remove} aria-label="Remove pot" className="mr-1 p-1 text-neg">
            <Trash2 size={17} strokeWidth={2.1} />
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5 px-5 pt-1 pb-7">
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dollars, Emergency fund…"
          maxLength={24}
          autoFocus={!pot}
        />

        <div>
          <h3 className="mb-2 px-1 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
            Currency
          </h3>
          {currencyLocked ? (
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2/60 px-4 py-3 ring-1 ring-line/40">
              <span className="grid size-8 place-items-center rounded-lg bg-surface-3 text-[14px] font-semibold text-dim">
                {symbolFor(currency)}
              </span>
              <span className="flex-1 text-[14.5px]">{currency}</span>
              <span className="text-[12px] text-faint">fixed once created</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((c) => {
                const active = c.code === currency
                return (
                  <motion.button
                    key={c.code}
                    whileTap={tap}
                    onClick={() => {
                      haptic('select')
                      setCurrency(c.code)
                    }}
                    className={cx(
                      'flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-accent text-accent-ink'
                        : 'bg-surface-2 text-dim ring-1 ring-line/50',
                    )}
                  >
                    <span className="text-[14px]">{c.symbol}</span>
                    {c.code}
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 px-1 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
            Already in it
          </h3>
          <span className="flex h-13 items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 ring-1 ring-line/50 focus-within:ring-accent/60">
            <span className="text-[20px] text-faint">{symbolFor(currency)}</span>
            <input
              inputMode="decimal"
              value={opening}
              onChange={(e) => setOpening(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
              placeholder="0"
              className="tnum min-w-0 flex-1 bg-transparent text-[20px] font-medium placeholder:text-faint"
            />
          </span>
          <p className="px-1 pt-2 text-[12.5px] leading-relaxed text-faint">
            What this pot already held before you started tracking it. Everything you add later is
            counted separately, so you can always see how much you had versus how much you have put
            aside since.
          </p>
        </div>

        <div>
          <h3 className="mb-2 px-1 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
            Colour
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {POT_COLORS.map((c) => (
              <motion.button
                key={c}
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  haptic('select')
                  setColor(c)
                }}
                className="grid size-9 place-items-center rounded-full"
                style={{ backgroundColor: c + '2E' }}
              >
                <span
                  className="rounded-full transition-all duration-150"
                  style={{
                    backgroundColor: c,
                    width: color === c ? 20 : 16,
                    height: color === c ? 20 : 16,
                  }}
                />
              </motion.button>
            ))}
          </div>
        </div>

        <Button block size="lg" variant="primary" disabled={!name.trim()} onClick={save}>
          {pot ? 'Save changes' : 'Create pot'}
        </Button>
      </div>
    </Sheet>
  )
}

/**
 * Manual exchange rates. The app makes no network calls, so these are whatever
 * the person decides they are — which also means a combined total is only ever
 * "at your rates", and is labelled that way everywhere it appears.
 */
export function RatesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const main = useStore((s) => s.settings.currency)
  const pots = useStore((s) => s.savingsPots)
  const rates = useStore((s) => s.settings.rates)
  const setRate = useStore((s) => s.setRate)

  const foreign = useMemo(() => {
    const codes = new Set(pots.filter((p) => !p.archived).map((p) => p.currency))
    codes.delete(main)
    return [...codes]
  }, [pots, main])

  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setDraft(
      Object.fromEntries(foreign.map((c) => [c, rates[c] ? String(rates[c]) : ''])),
    )
  }, [open, foreign, rates])

  function commit(code: string, value: string) {
    const n = Number.parseFloat(value.replace(',', '.'))
    setRate(code, Number.isFinite(n) && n > 0 ? n : null)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Exchange rates">
      <div className="space-y-4 px-5 pt-1 pb-7">
        {foreign.length === 0 ? (
          <p className="px-1 text-[13.5px] leading-relaxed text-dim">
            Every pot is in {main}, so nothing needs converting. Add a pot in another currency and
            its rate will show up here.
          </p>
        ) : (
          <>
            <p className="px-1 text-[13px] leading-relaxed text-dim">
              What one unit is worth in {main}, in your own judgement. Tally never goes online, so
              these are yours to set and yours to keep up to date.
            </p>

            <Card className="divide-y divide-line-soft overflow-hidden">
              {foreign.map((code) => (
                <div key={code} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-[15px] font-semibold text-dim">
                    {symbolFor(code)}
                  </span>
                  <span className="flex-1 text-[14.5px]">
                    1 {code}
                    <span className="text-faint"> =</span>
                  </span>
                  <span className="flex h-10 w-[7.5rem] items-center gap-1.5 rounded-xl bg-surface-2 px-3 ring-1 ring-line/50 focus-within:ring-accent/60">
                    <span className="text-[13px] text-faint">{symbolFor(main)}</span>
                    <input
                      inputMode="decimal"
                      value={draft[code] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d.,]/g, '')
                        setDraft((d) => ({ ...d, [code]: v }))
                        commit(code, v)
                      }}
                      placeholder="0.00"
                      className="tnum w-full bg-transparent text-right text-[14.5px] font-medium"
                    />
                  </span>
                </div>
              ))}
            </Card>

            <p className="px-1 text-[12.5px] leading-relaxed text-faint">
              Leave one blank and that pot keeps its own balance but stays out of the combined
              total — better a visible gap than a number that looks right and is not.
            </p>
          </>
        )}

        <Button block size="lg" variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Sheet>
  )
}

/** Shown where a converted figure appears, so the source of truth is never implied. */
export function AtYourRates({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cx('text-[12px] text-faint', className)}>
      ≈ <Money value={value} tone="dim" className="text-[12px]" compactCents /> at your rates
    </span>
  )
}
