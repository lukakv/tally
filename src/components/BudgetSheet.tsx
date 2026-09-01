import { useEffect, useState } from 'react'
import { monthLabel, type MonthKey } from '../lib/date'
import { formatMoney, symbolFor, toMinor } from '../lib/money'
import { useStore } from '../lib/store'
import type { Category } from '../lib/types'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/primitives'
import { CategoryIcon } from '../ui/CategoryIcon'
import { Row, Toggle } from '../ui/Field'
import { toast } from '../ui/feedback'
import { haptic } from '../ui/haptics'

export function BudgetSheet({
  open,
  onClose,
  category,
  month,
  spent,
}: {
  open: boolean
  onClose: () => void
  category: Category | null
  month: MonthKey
  spent: number
}) {
  const budgets = useStore((s) => s.budgets)
  const overrides = useStore((s) => s.budgetOverrides)
  const currency = useStore((s) => s.settings.currency)
  const setBudget = useStore((s) => s.setBudget)
  const setBudgetOverride = useStore((s) => s.setBudgetOverride)

  const [raw, setRaw] = useState('')
  const [thisMonthOnly, setThisMonthOnly] = useState(false)

  const overrideKey = month + ':' + (category?.id ?? '')
  const hasOverride = category ? overrides[overrideKey] !== undefined : false
  const existing = category ? (overrides[overrideKey] ?? budgets[category.id] ?? 0) : 0

  useEffect(() => {
    if (!open || !category) return
    setRaw(existing > 0 ? (existing / 100).toFixed(existing % 100 === 0 ? 0 : 2) : '')
    setThisMonthOnly(hasOverride)
    // only re-seed when the sheet is (re)opened for a category
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category?.id])

  if (!category) return null

  const amount = toMinor(raw || '0')

  function save() {
    if (!category) return
    if (thisMonthOnly) {
      setBudgetOverride(month, category.id, amount > 0 ? amount : null)
    } else {
      setBudget(category.id, amount > 0 ? amount : null)
      if (hasOverride) setBudgetOverride(month, category.id, null)
    }
    haptic('success')
    toast(amount > 0 ? `Budget set for ${category.name}` : `Budget removed from ${category.name}`)
    onClose()
  }

  function clear() {
    if (!category) return
    setBudget(category.id, null)
    setBudgetOverride(month, category.id, null)
    haptic('success')
    toast(`Budget removed from ${category.name}`)
    onClose()
  }

  const remaining = amount - spent

  return (
    <Sheet open={open} onClose={onClose} title="Monthly budget">
      <div className="space-y-4 px-5 pt-1 pb-7">
        <div className="flex items-center gap-3">
          <CategoryIcon icon={category.icon} color={category.color} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] leading-tight font-semibold">{category.name}</p>
            <p className="mt-0.5 text-[12.5px] text-faint">
              {formatMoney(spent, currency)} spent in {monthLabel(month)}
            </p>
          </div>
        </div>

        <div
          className="flex h-16 items-center gap-2 rounded-2xl bg-surface-2 px-4 ring-1 ring-line/50 focus-within:ring-accent/60"
          style={{ transition: 'box-shadow 150ms' }}
        >
          <span className="text-[22px] text-faint">{symbolFor(currency)}</span>
          <input
            autoFocus
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
            placeholder="0"
            className="tnum min-w-0 flex-1 bg-transparent text-[26px] font-semibold tracking-[-0.02em] placeholder:text-faint"
          />
        </div>

        {amount > 0 && (
          <p className="px-1 text-[13px] text-dim">
            {remaining >= 0 ? (
              <>
                <span className="font-medium text-pos">{formatMoney(remaining, currency)}</span> left
                for the rest of {monthLabel(month)}.
              </>
            ) : (
              <>
                <span className="font-medium text-neg">{formatMoney(-remaining, currency)}</span>{' '}
                over budget already.
              </>
            )}
          </p>
        )}

        <div className="overflow-hidden rounded-[var(--radius-card)] bg-surface ring-1 ring-line/50">
          <Row
            label={`Only for ${monthLabel(month)}`}
            sub={
              thisMonthOnly
                ? 'Other months keep their usual budget.'
                : 'Applies to every month until you change it.'
            }
          >
            <Toggle checked={thisMonthOnly} onChange={setThisMonthOnly} label="This month only" />
          </Row>
        </div>

        <div className="flex gap-2.5">
          {existing > 0 && (
            <Button block variant="danger" onClick={clear}>
              Remove
            </Button>
          )}
          <Button block size="md" variant="primary" onClick={save}>
            Save budget
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
