import { monthKeyOf, type MonthKey } from './date'
import { ME, type Category, type Person, type Settlement, type Transaction } from './types'

/* ------------------------------------------------------------------ *
 * Accounting model
 *
 * Two different questions get two different numbers:
 *
 *   myShare(tx)  what the thing actually COST me — my slice of a split.
 *                Drives spending totals, budgets and category reports.
 *
 *   cashOut(tx)  what physically LEFT my pocket on the day.
 *                Drives the savings balance.
 *
 * The gap between them is exactly what the split ledger tracks. A dinner
 * I paid ₾100 for and halved with someone costs me ₾50 but drains ₾100;
 * they owe me the ₾50 difference until they settle.
 * ------------------------------------------------------------------ */

/** My slice of the cost, regardless of who fronted the money. */
export function myShare(tx: Transaction): number {
  if (!tx.split) return tx.amount
  return tx.split.shares.find((s) => s.who === ME)?.amount ?? 0
}

/** What left my own pocket. Zero when somebody else picked up the bill. */
export function cashOut(tx: Transaction): number {
  if (tx.kind !== 'expense') return 0
  if (!tx.split) return tx.amount
  return tx.split.paidBy === ME ? tx.amount : 0
}

/** True for the "I moved money into savings" flavour of expense. */
export function isContribution(tx: Transaction): boolean {
  return tx.kind === 'expense' && !!tx.isSaving
}

/** True for an expense funded out of the savings pot. */
export function isWithdrawal(tx: Transaction): boolean {
  return tx.kind === 'expense' && tx.account === 'savings' && !tx.isSaving
}

/** Signed effect of one transaction on my balance with a person. + they owe me. */
export function personDelta(tx: Transaction, personId: string): number {
  const sp = tx.split
  if (!sp) return 0
  if (sp.paidBy === ME) return sp.shares.find((s) => s.who === personId)?.amount ?? 0
  if (sp.paidBy === personId) return -(sp.shares.find((s) => s.who === ME)?.amount ?? 0)
  return 0
}

/* ------------------------------- months ------------------------------ */

export interface MonthSummary {
  income: number
  /** consumption only — savings transfers are not spending */
  spent: number
  /** money moved into the savings pot */
  saved: number
  /** part of `spent` that was funded from savings rather than this month's cash */
  fromSavings: number
  /** what this month's income has left over after spending and saving */
  left: number
  expenseCount: number
  incomeCount: number
}

export function monthSummary(transactions: Transaction[], month: MonthKey): MonthSummary {
  let income = 0
  let spent = 0
  let saved = 0
  let fromSavings = 0
  let expenseCount = 0
  let incomeCount = 0

  for (const t of transactions) {
    if (monthKeyOf(t.date) !== month) continue
    if (t.kind === 'income') {
      income += t.amount
      incomeCount++
      continue
    }
    expenseCount++
    if (isContribution(t)) {
      saved += t.amount
    } else {
      spent += myShare(t)
      if (isWithdrawal(t)) fromSavings += myShare(t)
    }
  }

  return {
    income,
    spent,
    saved,
    fromSavings,
    left: income - spent - saved + fromSavings,
    expenseCount,
    incomeCount,
  }
}

/** Months that actually contain something, newest first, always including today. */
export function activeMonths(transactions: Transaction[], current: MonthKey): MonthKey[] {
  const set = new Set<MonthKey>([current])
  for (const t of transactions) set.add(monthKeyOf(t.date))
  return [...set].sort().reverse()
}

/* ----------------------------- categories ---------------------------- */

export interface CategoryTotal {
  category: Category
  total: number
  count: number
  /** share of the month's spending, 0..1 */
  fraction: number
}

/**
 * Per-category totals for one month. Savings transfers are kept out of the
 * denominator so percentages describe real spending.
 */
export function categoryTotals(
  transactions: Transaction[],
  categories: Category[],
  month: MonthKey,
  kind: 'expense' | 'income',
): CategoryTotal[] {
  const totals = new Map<string, { total: number; count: number }>()
  let denom = 0

  for (const t of transactions) {
    if (t.kind !== kind || monthKeyOf(t.date) !== month) continue
    const value = kind === 'income' ? t.amount : isContribution(t) ? t.amount : myShare(t)
    if (value === 0) continue
    const cur = totals.get(t.categoryId) ?? { total: 0, count: 0 }
    cur.total += value
    cur.count += 1
    totals.set(t.categoryId, cur)
    if (!(kind === 'expense' && isContribution(t))) denom += value
  }

  const byId = new Map(categories.map((c) => [c.id, c]))
  const rows: CategoryTotal[] = []
  for (const [id, v] of totals) {
    const category = byId.get(id)
    if (!category) continue
    rows.push({
      category,
      total: v.total,
      count: v.count,
      fraction: denom > 0 ? v.total / denom : 0,
    })
  }
  return rows.sort((a, b) => b.total - a.total)
}

/* ------------------------------ budgets ------------------------------ */

export interface BudgetRow {
  category: Category
  /** 0 when no budget is set for this category */
  budget: number
  spent: number
  /** budget - spent; positive means under, negative means over */
  diff: number
  /** spent / budget, uncapped so we can show >100% */
  progress: number
  hasBudget: boolean
  isSavings: boolean
}

export function budgetRows(
  transactions: Transaction[],
  categories: Category[],
  budgets: Record<string, number>,
  overrides: Record<string, number>,
  month: MonthKey,
): BudgetRow[] {
  const spentBy = new Map<string, number>()
  for (const t of transactions) {
    if (t.kind !== 'expense' || monthKeyOf(t.date) !== month) continue
    const value = isContribution(t) ? t.amount : myShare(t)
    spentBy.set(t.categoryId, (spentBy.get(t.categoryId) ?? 0) + value)
  }

  return categories
    .filter((c) => c.kind === 'expense' && !c.archived)
    .map((category) => {
      const override = overrides[month + ':' + category.id]
      const budget = override ?? budgets[category.id] ?? 0
      const spent = spentBy.get(category.id) ?? 0
      return {
        category,
        budget,
        spent,
        diff: budget - spent,
        progress: budget > 0 ? spent / budget : 0,
        hasBudget: budget > 0,
        isSavings: category.system === 'savings',
      }
    })
    .filter((r) => r.hasBudget || r.spent > 0)
    .sort((a, b) => {
      // budgeted rows first, then by how much was spent
      if (a.hasBudget !== b.hasBudget) return a.hasBudget ? -1 : 1
      return b.spent - a.spent
    })
}

export interface BudgetTotals {
  budget: number
  spent: number
  diff: number
  progress: number
  overCount: number
}

export function budgetTotals(rows: BudgetRow[]): BudgetTotals {
  let budget = 0
  let spent = 0
  let overCount = 0
  for (const r of rows) {
    if (!r.hasBudget) continue
    budget += r.budget
    spent += r.spent
    if (r.diff < 0) overCount++
  }
  return { budget, spent, diff: budget - spent, progress: budget > 0 ? spent / budget : 0, overCount }
}

/* ------------------------------ savings ------------------------------ */

export interface SavingsState {
  balance: number
  contributed: number
  withdrawn: number
  opening: number
  /** contributions minus withdrawals inside the given month */
  monthNet: number
}

export function savingsState(
  transactions: Transaction[],
  opening: number,
  month?: MonthKey,
): SavingsState {
  let contributed = 0
  let withdrawn = 0
  let monthIn = 0
  let monthOut = 0

  for (const t of transactions) {
    if (t.kind !== 'expense') continue
    const inMonth = month ? monthKeyOf(t.date) === month : false
    if (isContribution(t)) {
      contributed += t.amount
      if (inMonth) monthIn += t.amount
    } else if (isWithdrawal(t)) {
      // what actually left the pot, not just my share of it
      withdrawn += cashOut(t)
      if (inMonth) monthOut += cashOut(t)
    }
  }

  return {
    balance: opening + contributed - withdrawn,
    contributed,
    withdrawn,
    opening,
    monthNet: monthIn - monthOut,
  }
}

/* ------------------------------- splits ------------------------------ */

export interface PersonBalance {
  person: Person
  /** + they owe me, - I owe them */
  balance: number
  /** raw ledger before settlements */
  gross: number
  settled: number
  /** shared transactions involving this person, newest first */
  entries: Transaction[]
}

export function personBalances(
  transactions: Transaction[],
  settlements: Settlement[],
  people: Person[],
): PersonBalance[] {
  return people.map((person) => {
    let gross = 0
    const entries: Transaction[] = []
    for (const t of transactions) {
      const d = personDelta(t, person.id)
      if (d === 0 && !involves(t, person.id)) continue
      gross += d
      entries.push(t)
    }
    const settled = settlements
      .filter((s) => s.personId === person.id)
      .reduce((sum, s) => sum + s.amount, 0)
    entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))
    return { person, balance: gross - settled, gross, settled, entries }
  })
}

function involves(tx: Transaction, personId: string): boolean {
  const sp = tx.split
  if (!sp) return false
  return sp.paidBy === personId || sp.shares.some((s) => s.who === personId)
}

export interface SplitOverview {
  /** total others owe me */
  owedToMe: number
  /** total I owe others */
  iOwe: number
  net: number
}

export function splitOverview(balances: PersonBalance[]): SplitOverview {
  let owedToMe = 0
  let iOwe = 0
  for (const b of balances) {
    if (b.balance > 0) owedToMe += b.balance
    else iOwe += -b.balance
  }
  return { owedToMe, iOwe, net: owedToMe - iOwe }
}
