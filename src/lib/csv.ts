import { myShare } from './selectors'
import { ME, type AppData } from './types'

/** Wraps a field only when it needs it, so the file stays readable. */
function cell(value: string | number | undefined | null): string {
  const s = value === undefined || value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * A spreadsheet-friendly dump of the ledger.
 *
 * Amounts are written as plain decimals rather than minor units, because this
 * is for a human in a spreadsheet — the JSON backup is what round-trips back
 * into the app. Both the full amount and your share are included, since a split
 * expense genuinely has two answers and which one matters depends on what is
 * being worked out.
 */
export function transactionsToCSV(data: AppData): string {
  const category = new Map(data.categories.map((c) => [c.id, c.name]))
  const person = new Map(data.people.map((p) => [p.id, p.name]))
  const pot = new Map(data.savingsPots.map((p) => [p.id, p.name]))
  const money = (minor: number) => (minor / 100).toFixed(2)

  const header = [
    'date',
    'type',
    'category',
    'full_amount',
    'your_share',
    'currency',
    'note',
    'paid_by',
    'split_with',
    'from_savings',
    'savings_transfer',
    'pot',
  ]

  const rows = [...data.transactions]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))
    .map((t) => {
      const others =
        t.split?.shares
          .filter((s) => s.who !== ME)
          .map((s) => person.get(s.who) ?? 'unknown')
          .join(' + ') ?? ''
      const paidBy = t.split ? (t.split.paidBy === ME ? 'you' : (person.get(t.split.paidBy) ?? 'unknown')) : 'you'

      return [
        t.date,
        t.kind,
        category.get(t.categoryId) ?? 'uncategorised',
        money(t.amount),
        money(myShare(t)),
        data.settings.currency,
        t.note ?? '',
        t.split ? paidBy : '',
        others,
        t.account === 'savings' && !t.isSaving ? 'yes' : '',
        t.isSaving ? 'yes' : '',
        t.savingsPotId ? (pot.get(t.savingsPotId) ?? '') : '',
      ].map(cell).join(',')
    })

  return [header.join(','), ...rows].join('\n')
}

/** Savings movements recorded on a pot, which never reach the ledger above. */
export function savingsEntriesToCSV(data: AppData): string {
  const pot = new Map(data.savingsPots.map((p) => [p.id, p]))
  const header = ['date', 'pot', 'currency', 'amount', 'direction', 'note']

  const rows = [...data.savingsEntries]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt))
    .map((e) => {
      const p = pot.get(e.potId)
      return [
        e.date,
        p?.name ?? 'removed pot',
        p?.currency ?? '',
        (Math.abs(e.amount) / 100).toFixed(2),
        e.amount < 0 ? 'out' : 'in',
        e.note ?? '',
      ].map(cell).join(',')
    })

  return [header.join(','), ...rows].join('\n')
}
