import { monthKeyOf, type MonthKey } from './date'
import {
  ME,
  type Category,
  type Person,
  type SavingsEntry,
  type SavingsPot,
  type Settlement,
  type Transaction,
} from './types'

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

/**
 * What one transaction does to the money this month had available.
 *
 * Every running total in the app goes through here, so the per-day figures on
 * Activity and the headline on Home cannot drift apart. The two cases that are
 * easy to get wrong:
 *
 *   - a transfer into savings spends nothing, but it does leave this month's
 *     pocket, so it counts against you;
 *   - an expense funded FROM savings is real spending, but it consumed the pot
 *     rather than this month's income, so it counts for nothing here.
 */
export function cashFlow(tx: Transaction): number {
  if (tx.kind === 'income') return tx.amount
  if (isContribution(tx)) return -tx.amount
  if (isWithdrawal(tx)) return 0
  return -myShare(tx)
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

/**
 * Savings are held in pots, and a pot holds exactly one currency. Two things
 * move money through a pot:
 *
 *   - a savings ENTRY, recorded straight on the pot in the pot's own currency.
 *     This is money you already had, or money moved in or out from elsewhere.
 *     It never touches a monthly total.
 *   - a TRANSACTION, which is always in the main currency. Setting money aside
 *     this month, or spending out of the pot, both show up in the month.
 */

/**
 * Value of `amount` (in `from`) expressed in the main currency.
 * null when the rate has not been entered — better a visible gap than a
 * confidently wrong total.
 */
export function convert(
  amount: number,
  from: string,
  main: string,
  rates: Record<string, number>,
): number | null {
  if (from === main) return amount
  const rate = rates[from]
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null
  return Math.round(amount * rate)
}

export interface PotState {
  pot: SavingsPot
  /** all figures below are in the pot's own currency */
  balance: number
  opening: number
  addedIn: number
  takenOut: number
  monthNet: number
  /** balance in the main currency, or null when no rate has been set */
  inMain: number | null
}

export function potState(
  pot: SavingsPot,
  transactions: Transaction[],
  entries: SavingsEntry[],
  main: string,
  rates: Record<string, number>,
  month?: MonthKey,
): PotState {
  let addedIn = 0
  let takenOut = 0
  let monthNet = 0

  for (const e of entries) {
    if (e.potId !== pot.id) continue
    if (e.amount >= 0) addedIn += e.amount
    else takenOut += -e.amount
    if (month && monthKeyOf(e.date) === month) monthNet += e.amount
  }

  for (const t of transactions) {
    if (t.kind !== 'expense' || t.savingsPotId !== pot.id) continue
    const inMonth = month ? monthKeyOf(t.date) === month : false
    if (isContribution(t)) {
      addedIn += t.amount
      if (inMonth) monthNet += t.amount
    } else if (isWithdrawal(t)) {
      // what actually left the pot, not just my share of it
      const out = cashOut(t)
      takenOut += out
      if (inMonth) monthNet -= out
    }
  }

  const balance = pot.opening + addedIn - takenOut
  return {
    pot,
    balance,
    opening: pot.opening,
    addedIn,
    takenOut,
    monthNet,
    inMain: convert(balance, pot.currency, main, rates),
  }
}

export interface SavingsOverview {
  pots: PotState[]
  /** every pot's balance in the main currency; pots without a rate are left out */
  total: number
  totalOpening: number
  totalAdded: number
  monthNet: number
  /** currencies that hold money but have no rate yet */
  missingRates: string[]
  /** true once more than one currency is in play */
  multiCurrency: boolean
}

export function savingsOverview(
  pots: SavingsPot[],
  transactions: Transaction[],
  entries: SavingsEntry[],
  main: string,
  rates: Record<string, number>,
  month?: MonthKey,
): SavingsOverview {
  const live = pots.filter((p) => !p.archived)
  const states = live.map((p) => potState(p, transactions, entries, main, rates, month))

  let total = 0
  let totalOpening = 0
  let totalAdded = 0
  let monthNet = 0
  const missing = new Set<string>()

  for (const st of states) {
    if (st.inMain === null) {
      if (st.balance !== 0) missing.add(st.pot.currency)
      continue
    }
    total += st.inMain
    totalOpening += convert(st.opening, st.pot.currency, main, rates) ?? 0
    totalAdded += convert(st.addedIn, st.pot.currency, main, rates) ?? 0
    monthNet += convert(st.monthNet, st.pot.currency, main, rates) ?? 0
  }

  return {
    pots: states,
    total,
    totalOpening,
    totalAdded,
    monthNet,
    missingRates: [...missing],
    multiCurrency: new Set(live.map((p) => p.currency)).size > 1,
  }
}

/** The pot monthly transfers land in — always one in the main currency. */
export function mainPot(pots: SavingsPot[], main: string): SavingsPot | undefined {
  return pots.find((p) => p.currency === main && !p.archived) ?? pots.find((p) => !p.archived)
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
