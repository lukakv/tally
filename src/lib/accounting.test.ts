import { describe, expect, it } from 'vitest'
import { formatMoney, splitEvenly, toMinor } from './money'
import {
  budgetRows,
  budgetTotals,
  categoryTotals,
  cashOut,
  monthSummary,
  myShare,
  personBalances,
  savingsState,
  splitOverview,
} from './selectors'
import { DEFAULT_CATEGORIES, SAVINGS_CATEGORY_ID } from './seed'
import { ME, type Person, type Settlement, type Transaction } from './types'

/* --------------------------------- fixtures -------------------------------- */

const NIKA = 'p-nika'
const ANA = 'p-ana'
const people: Person[] = [
  { id: NIKA, name: 'Nika', color: '#9B8CFF' },
  { id: ANA, name: 'Ana', color: '#2DD4BF' },
]

let seq = 0
function tx(t: Partial<Transaction> & Pick<Transaction, 'kind' | 'amount' | 'date' | 'categoryId'>) {
  seq += 1
  return { id: `t${seq}`, createdAt: seq, updatedAt: seq, ...t } as Transaction
}

const MONTH = '2026-09'

/* ---------------------------------- money ---------------------------------- */

describe('money', () => {
  it('parses decimal input into minor units', () => {
    expect(toMinor('12.50')).toBe(1250)
    expect(toMinor('12,50')).toBe(1250) // comma decimal separator
    expect(toMinor('0.1')).toBe(10)
    expect(toMinor('')).toBe(0)
    expect(toMinor('abc')).toBe(0)
    expect(toMinor(45.5)).toBe(4550)
  })

  it('avoids float drift when summing', () => {
    const cents = [10, 20, 30, 1, 2] // 0.10 + 0.20 + 0.30 + 0.01 + 0.02
    expect(cents.reduce((a, b) => a + b, 0)).toBe(63)
    expect(formatMoney(63, 'GEL')).toBe('₾0.63')
  })

  it('formats with grouping, symbol and sign', () => {
    expect(formatMoney(123456, 'GEL')).toBe('₾1,234.56')
    expect(formatMoney(-5000, 'USD')).toBe('-$50.00')
    expect(formatMoney(5000, 'EUR', { signed: true })).toBe('+€50.00')
    expect(formatMoney(5000, 'GEL', { decimals: 'auto' })).toBe('₾50')
    expect(formatMoney(5050, 'GEL', { decimals: 'auto' })).toBe('₾50.50')
    expect(formatMoney(5050, 'GEL', { showSymbol: false })).toBe('50.50')
  })

  it('splits a total into whole shares that add back up exactly', () => {
    expect(splitEvenly(1000, 2)).toEqual([500, 500])
    // 10.00 between three people cannot divide evenly
    const three = splitEvenly(1000, 3)
    expect(three).toEqual([334, 333, 333])
    expect(three.reduce((a, b) => a + b, 0)).toBe(1000)

    for (const total of [1, 7, 99, 100, 12345]) {
      for (const n of [2, 3, 4, 7]) {
        expect(splitEvenly(total, n).reduce((a, b) => a + b, 0)).toBe(total)
      }
    }
  })
})

/* ------------------------------- cost vs cash ------------------------------ */

describe('my share vs cash out', () => {
  it('charges the full amount when nothing is split', () => {
    const t = tx({ kind: 'expense', amount: 4550, date: '2026-09-02', categoryId: 'cat-groceries' })
    expect(myShare(t)).toBe(4550)
    expect(cashOut(t)).toBe(4550)
  })

  it('charges my slice but drains the whole bill when I paid', () => {
    const t = tx({
      kind: 'expense',
      amount: 3200,
      date: '2026-09-02',
      categoryId: 'cat-eatingout',
      split: { paidBy: ME, shares: [{ who: ME, amount: 1600 }, { who: NIKA, amount: 1600 }] },
    })
    expect(myShare(t)).toBe(1600)
    expect(cashOut(t)).toBe(3200)
  })

  it('still charges my slice when somebody else paid, but drains nothing', () => {
    const t = tx({
      kind: 'expense',
      amount: 6000,
      date: '2026-09-02',
      categoryId: 'cat-fun',
      split: { paidBy: NIKA, shares: [{ who: ME, amount: 3000 }, { who: NIKA, amount: 3000 }] },
    })
    expect(myShare(t)).toBe(3000)
    expect(cashOut(t)).toBe(0)
  })

  it('charges nothing when I paid for someone else entirely', () => {
    const t = tx({
      kind: 'expense',
      amount: 5000,
      date: '2026-09-02',
      categoryId: 'cat-gifts',
      split: { paidBy: ME, shares: [{ who: NIKA, amount: 5000 }] },
    })
    expect(myShare(t)).toBe(0)
    expect(cashOut(t)).toBe(5000)
  })
})

/* ------------------------------ month summary ------------------------------ */

const monthTx: Transaction[] = [
  tx({ kind: 'income', amount: 300000, date: '2026-09-01', categoryId: 'cat-salary' }),
  tx({ kind: 'income', amount: 20000, date: '2026-09-02', categoryId: 'cat-gift-in' }),
  tx({ kind: 'expense', amount: 4550, date: '2026-09-02', categoryId: 'cat-groceries' }),
  tx({
    kind: 'expense',
    amount: 3200,
    date: '2026-09-02',
    categoryId: 'cat-eatingout',
    split: { paidBy: ME, shares: [{ who: ME, amount: 1600 }, { who: NIKA, amount: 1600 }] },
  }),
  tx({ kind: 'expense', amount: 1200, date: '2026-09-01', categoryId: 'cat-transport' }),
  tx({ kind: 'expense', amount: 80000, date: '2026-09-01', categoryId: 'cat-home' }),
  tx({
    kind: 'expense',
    amount: 6000,
    date: '2026-09-02',
    categoryId: 'cat-fun',
    split: { paidBy: NIKA, shares: [{ who: ME, amount: 3000 }, { who: NIKA, amount: 3000 }] },
  }),
  tx({
    kind: 'expense',
    amount: 30000,
    date: '2026-09-01',
    categoryId: SAVINGS_CATEGORY_ID,
    isSaving: true,
  }),
  tx({
    kind: 'expense',
    amount: 15000,
    date: '2026-09-02',
    categoryId: 'cat-health',
    account: 'savings',
  }),
  // a different month, must never leak in
  tx({ kind: 'expense', amount: 99999, date: '2026-08-30', categoryId: 'cat-groceries' }),
]

describe('month summary', () => {
  const s = monthSummary(monthTx, MONTH)

  it('adds up income', () => {
    expect(s.income).toBe(320000)
  })

  it('counts my share of split expenses, not the full bill', () => {
    // 45.50 + 16.00 + 12.00 + 800.00 + 30.00 + 150.00
    expect(s.spent).toBe(105350)
  })

  it('treats savings transfers as saved, not spent', () => {
    expect(s.saved).toBe(30000)
    // dropping the ₾300 transfer must not change what was spent
    const withoutTransfer = monthTx.filter((t) => !t.isSaving)
    expect(monthSummary(withoutTransfer, MONTH).spent).toBe(s.spent)
    expect(monthSummary(withoutTransfer, MONTH).saved).toBe(0)
  })

  it('reports how much spending came out of savings', () => {
    expect(s.fromSavings).toBe(15000)
  })

  it('leaves income untouched by money that came from savings', () => {
    // 3200 - 1053.50 - 300 + 150
    expect(s.left).toBe(199650)
  })

  it('ignores other months', () => {
    expect(monthSummary(monthTx, '2026-08').spent).toBe(99999)
  })
})

/* --------------------------------- savings --------------------------------- */

describe('savings', () => {
  it('adds contributions and subtracts withdrawals from the opening balance', () => {
    const s = savingsState(monthTx, 50000, MONTH)
    expect(s.opening).toBe(50000)
    expect(s.contributed).toBe(30000)
    expect(s.withdrawn).toBe(15000)
    expect(s.balance).toBe(65000)
    expect(s.monthNet).toBe(15000)
  })

  it('withdraws what actually left the pot, not just my share', () => {
    // I paid ₾100 out of savings and split it with Nika: ₾100 left the pot.
    const t = [
      tx({
        kind: 'expense',
        amount: 10000,
        date: '2026-09-03',
        categoryId: 'cat-health',
        account: 'savings',
        split: { paidBy: ME, shares: [{ who: ME, amount: 5000 }, { who: NIKA, amount: 5000 }] },
      }),
    ]
    expect(savingsState(t, 20000).balance).toBe(10000)
  })

  it('does not touch savings when someone else paid the savings-funded bill', () => {
    const t = [
      tx({
        kind: 'expense',
        amount: 10000,
        date: '2026-09-03',
        categoryId: 'cat-health',
        account: 'savings',
        split: { paidBy: NIKA, shares: [{ who: ME, amount: 5000 }, { who: NIKA, amount: 5000 }] },
      }),
    ]
    expect(savingsState(t, 20000).balance).toBe(20000)
  })
})

/* ---------------------------------- splits --------------------------------- */

describe('shared balances', () => {
  it('nets what each person owes me against what I owe them', () => {
    const [nika] = personBalances(monthTx, [], [people[0]])
    // Nika owes 16.00 from dinner, I owe 30.00 from the cinema
    expect(nika.gross).toBe(1600 - 3000)
    expect(nika.balance).toBe(-1400)
    expect(nika.entries).toHaveLength(2)
  })

  it('clears the balance once a settlement is recorded', () => {
    const settle: Settlement[] = [
      { id: 's1', personId: NIKA, amount: -1400, date: '2026-09-05', createdAt: 1 },
    ]
    const [nika] = personBalances(monthTx, settle, [people[0]])
    expect(nika.balance).toBe(0)
    expect(nika.settled).toBe(-1400)
  })

  it('ignores splits between two other people', () => {
    const t = [
      tx({
        kind: 'expense',
        amount: 4000,
        date: '2026-09-04',
        categoryId: 'cat-fun',
        split: { paidBy: NIKA, shares: [{ who: NIKA, amount: 2000 }, { who: ANA, amount: 2000 }] },
      }),
    ]
    const balances = personBalances(t, [], people)
    expect(balances.find((b) => b.person.id === ANA)?.balance).toBe(0)
  })

  it('separates what I am owed from what I owe', () => {
    const t = [
      tx({
        kind: 'expense',
        amount: 2000,
        date: '2026-09-04',
        categoryId: 'cat-fun',
        split: { paidBy: ME, shares: [{ who: ME, amount: 1000 }, { who: NIKA, amount: 1000 }] },
      }),
      tx({
        kind: 'expense',
        amount: 6000,
        date: '2026-09-04',
        categoryId: 'cat-fun',
        split: { paidBy: ANA, shares: [{ who: ME, amount: 3000 }, { who: ANA, amount: 3000 }] },
      }),
    ]
    const o = splitOverview(personBalances(t, [], people))
    expect(o.owedToMe).toBe(1000)
    expect(o.iOwe).toBe(3000)
    expect(o.net).toBe(-2000)
  })
})

/* -------------------------------- categories ------------------------------- */

describe('category totals', () => {
  const rows = categoryTotals(monthTx, DEFAULT_CATEGORIES, MONTH, 'expense')

  it('ranks categories by what they cost me', () => {
    expect(rows[0].category.id).toBe('cat-home')
    expect(rows[0].total).toBe(80000)
  })

  it('uses my share for split rows', () => {
    expect(rows.find((r) => r.category.id === 'cat-eatingout')?.total).toBe(1600)
    expect(rows.find((r) => r.category.id === 'cat-fun')?.total).toBe(3000)
  })

  it('keeps savings out of the percentage base so spending shares total 100%', () => {
    const spendingOnly = rows.filter((r) => r.category.system !== 'savings')
    const sum = spendingOnly.reduce((a, r) => a + r.fraction, 0)
    expect(sum).toBeCloseTo(1, 6)
  })

  it('separates income sources', () => {
    const income = categoryTotals(monthTx, DEFAULT_CATEGORIES, MONTH, 'income')
    expect(income.map((r) => r.category.id)).toEqual(['cat-salary', 'cat-gift-in'])
  })
})

/* --------------------------------- budgets --------------------------------- */

describe('budgets', () => {
  const budgets = { 'cat-groceries': 40000, 'cat-eatingout': 30000, 'cat-transport': 1000 }

  it('reports planned, actual and the difference', () => {
    const rows = budgetRows(monthTx, DEFAULT_CATEGORIES, budgets, {}, MONTH)
    const groceries = rows.find((r) => r.category.id === 'cat-groceries')!
    expect(groceries.budget).toBe(40000)
    expect(groceries.spent).toBe(4550)
    expect(groceries.diff).toBe(35450)

    const transport = rows.find((r) => r.category.id === 'cat-transport')!
    expect(transport.diff).toBe(-200) // ₾12 spent against a ₾10 budget
    expect(transport.progress).toBeCloseTo(1.2, 6)
  })

  it('lets a single month override the standing budget', () => {
    const rows = budgetRows(
      monthTx,
      DEFAULT_CATEGORIES,
      budgets,
      { [`${MONTH}:cat-groceries`]: 10000 },
      MONTH,
    )
    expect(rows.find((r) => r.category.id === 'cat-groceries')?.budget).toBe(10000)
    // a different month falls back to the standing figure
    const other = budgetRows(
      monthTx,
      DEFAULT_CATEGORIES,
      budgets,
      { [`${MONTH}:cat-groceries`]: 10000 },
      '2026-08',
    )
    expect(other.find((r) => r.category.id === 'cat-groceries')?.budget).toBe(40000)
  })

  it('hides categories with neither a budget nor any spending', () => {
    const rows = budgetRows(monthTx, DEFAULT_CATEGORIES, budgets, {}, MONTH)
    expect(rows.some((r) => r.category.id === 'cat-travel')).toBe(false)
  })

  it('totals only the budgeted categories and counts the overspends', () => {
    const t = budgetTotals(budgetRows(monthTx, DEFAULT_CATEGORIES, budgets, {}, MONTH))
    expect(t.budget).toBe(71000)
    expect(t.spent).toBe(4550 + 1600 + 1200)
    expect(t.overCount).toBe(1)
  })
})
