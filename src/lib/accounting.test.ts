import { describe, expect, it } from 'vitest'
import { formatMoney, splitEvenly, toMinor } from './money'
import {
  budgetRows,
  budgetTotals,
  cashFlow,
  cashOut,
  categoryTotals,
  convert,
  monthSummary,
  myShare,
  personBalances,
  potState,
  savingsOverview,
  splitOverview,
} from './selectors'
import { migrate } from './migrate'
import { DEFAULT_CATEGORIES, SAVINGS_CATEGORY_ID } from './seed'
import {
  ME,
  MAIN_POT_ID,
  type Person,
  type SavingsEntry,
  type SavingsPot,
  type Settlement,
  type Transaction,
} from './types'

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

const GEL_POT: SavingsPot = {
  id: MAIN_POT_ID,
  name: 'Savings',
  currency: 'GEL',
  color: '#FBBF24',
  opening: 50000,
}
const USD_POT: SavingsPot = {
  id: 'pot-usd',
  name: 'Dollars',
  currency: 'USD',
  color: '#2DD4BF',
  opening: 200000,
}

/** the fixture month's savings transactions all target the main pot */
const potted = monthTx.map((t) =>
  t.isSaving || t.account === 'savings' ? { ...t, savingsPotId: MAIN_POT_ID } : t,
)

function entry(e: Partial<SavingsEntry> & Pick<SavingsEntry, 'potId' | 'amount' | 'date'>) {
  seq += 1
  return { id: 'e' + seq, createdAt: seq, ...e } as SavingsEntry
}

describe('a savings pot', () => {
  it('starts from what was already in it and tracks movements separately', () => {
    const st = potState(GEL_POT, potted, [], 'GEL', {}, MONTH)
    expect(st.opening).toBe(50000)
    expect(st.addedIn).toBe(30000) // the 300 set aside this month
    expect(st.takenOut).toBe(15000) // the 150 dentist
    expect(st.balance).toBe(65000)
    expect(st.monthNet).toBe(15000)
  })

  it('counts money recorded straight on the pot, in the pot currency', () => {
    const entries = [
      entry({ potId: USD_POT.id, amount: 20000, date: '2026-09-04' }),
      entry({ potId: USD_POT.id, amount: -5000, date: '2026-09-05' }),
    ]
    const st = potState(USD_POT, potted, entries, 'GEL', { USD: 2.7 }, MONTH)
    expect(st.opening).toBe(200000)
    expect(st.addedIn).toBe(20000)
    expect(st.takenOut).toBe(5000)
    expect(st.balance).toBe(215000)
    expect(st.monthNet).toBe(15000)
  })

  it('ignores movements belonging to another pot', () => {
    const entries = [entry({ potId: USD_POT.id, amount: 99999, date: '2026-09-04' })]
    expect(potState(GEL_POT, potted, entries, 'GEL', {}, MONTH).balance).toBe(65000)
  })

  it('takes out what actually left the pot, not just my share', () => {
    const t = [
      tx({
        kind: 'expense',
        amount: 10000,
        date: '2026-09-03',
        categoryId: 'cat-health',
        account: 'savings',
        savingsPotId: MAIN_POT_ID,
        split: { paidBy: ME, shares: [{ who: ME, amount: 5000 }, { who: NIKA, amount: 5000 }] },
      }),
    ]
    expect(potState({ ...GEL_POT, opening: 20000 }, t, [], 'GEL', {}).balance).toBe(10000)
  })

  it('leaves the pot alone when somebody else paid the savings-funded bill', () => {
    const t = [
      tx({
        kind: 'expense',
        amount: 10000,
        date: '2026-09-03',
        categoryId: 'cat-health',
        account: 'savings',
        savingsPotId: MAIN_POT_ID,
        split: { paidBy: NIKA, shares: [{ who: ME, amount: 5000 }, { who: NIKA, amount: 5000 }] },
      }),
    ]
    expect(potState({ ...GEL_POT, opening: 20000 }, t, [], 'GEL', {}).balance).toBe(20000)
  })
})

describe('savings across currencies', () => {
  const entries = [entry({ potId: USD_POT.id, amount: 20000, date: '2026-09-04' })]

  it('converts each pot at the rate you set and adds them up', () => {
    const o = savingsOverview([GEL_POT, USD_POT], potted, entries, 'GEL', { USD: 2.7 }, MONTH)
    expect(o.total).toBe(65000 + 594000)
    expect(o.multiCurrency).toBe(true)
    expect(o.missingRates).toEqual([])
  })

  it('separates what was already had from what has been added since', () => {
    const o = savingsOverview([GEL_POT, USD_POT], potted, entries, 'GEL', { USD: 2.7 }, MONTH)
    expect(o.totalOpening).toBe(50000 + 200000 * 2.7)
    expect(o.totalAdded).toBe(30000 + 20000 * 2.7)
  })

  it('leaves a pot out of the total rather than guess a rate', () => {
    const o = savingsOverview([GEL_POT, USD_POT], potted, entries, 'GEL', {}, MONTH)
    expect(o.total).toBe(65000)
    expect(o.missingRates).toEqual(['USD'])
    expect(o.pots.find((x) => x.pot.id === USD_POT.id)?.balance).toBe(220000)
    expect(o.pots.find((x) => x.pot.id === USD_POT.id)?.inMain).toBeNull()
  })

  it('needs no rate when everything is in one currency', () => {
    const o = savingsOverview([GEL_POT], potted, [], 'GEL', {}, MONTH)
    expect(o.multiCurrency).toBe(false)
    expect(o.total).toBe(65000)
    expect(o.missingRates).toEqual([])
  })

  it('refuses to convert without a usable rate', () => {
    expect(convert(1000, 'USD', 'GEL', {})).toBeNull()
    expect(convert(1000, 'USD', 'GEL', { USD: 0 })).toBeNull()
    expect(convert(1000, 'USD', 'GEL', { USD: Number.NaN })).toBeNull()
    expect(convert(1000, 'GEL', 'GEL', {})).toBe(1000)
    expect(convert(1000, 'USD', 'GEL', { USD: 2.7 })).toBe(2700)
  })
})

describe('upgrading older data', () => {
  it('turns a v1 single savings figure into the main pot', () => {
    const old = {
      transactions: [{ ...monthTx[7] }, { ...monthTx[8] }],
      settings: { currency: 'GEL', openingSavings: 50000 },
    }
    const upgraded = migrate(old)

    expect(upgraded.savingsPots).toHaveLength(1)
    expect(upgraded.savingsPots[0].currency).toBe('GEL')
    expect(upgraded.savingsPots[0].opening).toBe(50000)
    expect(
      upgraded.transactions.every((t) => t.savingsPotId === upgraded.savingsPots[0].id),
    ).toBe(true)
    // the balance survives the move unchanged
    expect(potState(upgraded.savingsPots[0], upgraded.transactions, [], 'GEL', {}).balance).toBe(
      65000,
    )
    expect('openingSavings' in upgraded.settings).toBe(false)
  })

  it('always leaves a pot in the main currency for transfers to land in', () => {
    const upgraded = migrate({ savingsPots: [USD_POT], settings: { currency: 'GEL' } })
    expect(upgraded.savingsPots.some((p) => p.currency === 'GEL')).toBe(true)
  })

  it('carries a current backup through untouched', () => {
    // Restore runs the same migration as a version upgrade, so a fresh backup
    // has to survive it byte for byte — this is the only safety net there is.
    const backup = {
      version: 2,
      transactions: potted,
      categories: DEFAULT_CATEGORIES,
      people,
      settlements: [{ id: 's1', personId: NIKA, amount: -1400, date: '2026-09-05', createdAt: 1 }],
      savingsPots: [GEL_POT, USD_POT],
      savingsEntries: [entry({ potId: USD_POT.id, amount: 20000, date: '2026-09-04' })],
      budgets: { 'cat-groceries': 40000 },
      budgetOverrides: { '2026-09:cat-fun': 5000 },
      settings: {
        currency: 'GEL',
        theme: 'dark' as const,
        haptics: true,
        onboarded: true,
        rates: { USD: 2.7 },
      },
    }

    const restored = migrate(backup)

    expect(restored.transactions).toEqual(backup.transactions)
    expect(restored.savingsPots).toEqual(backup.savingsPots)
    expect(restored.savingsEntries).toEqual(backup.savingsEntries)
    expect(restored.settlements).toEqual(backup.settlements)
    expect(restored.budgets).toEqual(backup.budgets)
    expect(restored.budgetOverrides).toEqual(backup.budgetOverrides)
    expect(restored.people).toEqual(backup.people)
    expect(restored.settings).toEqual(backup.settings)

    // and every figure it drives comes out the same
    expect(savingsOverview(restored.savingsPots, restored.transactions, restored.savingsEntries, 'GEL', restored.settings.rates).total).toBe(
      savingsOverview(backup.savingsPots, backup.transactions, backup.savingsEntries, 'GEL', backup.settings.rates).total,
    )
  })

  it('fills in the blanks for an empty or unknown payload', () => {
    const upgraded = migrate({})
    expect(upgraded.savingsPots).toHaveLength(1)
    expect(upgraded.savingsEntries).toEqual([])
    expect(upgraded.settings.rates).toEqual({})
    expect(upgraded.categories.length).toBeGreaterThan(0)
  })
})


/* ------------------- what the Add money sheet produces -------------------- */

/**
 * The savings sheet offers exactly one meaningful choice — is this money coming
 * out of THIS MONTH, or is it money you already had? These lock in what each
 * branch must do, because getting them the wrong way round would quietly
 * corrupt both the savings balance and the month.
 */
describe('adding money to savings', () => {
  const pot: SavingsPot = { ...GEL_POT, opening: 0 }

  it('money you already had lands in the pot and leaves the month alone', () => {
    // the sheet writes a SavingsEntry for this branch
    const entries = [entry({ potId: pot.id, amount: 25000, date: '2026-09-20' })]

    expect(potState(pot, [], entries, 'GEL', {}, MONTH).balance).toBe(25000)
    // nothing in the ledger, so the month cannot have moved
    const s = monthSummary([], MONTH)
    expect(s.saved).toBe(0)
    expect(s.left).toBe(0)
  })

  it('money out of this month counts as Saved and comes off what is left', () => {
    // the sheet writes a Transaction for this branch
    const ledger = [
      tx({ kind: 'income', amount: 100000, date: '2026-09-01', categoryId: 'cat-salary' }),
      tx({
        kind: 'expense',
        amount: 25000,
        date: '2026-09-20',
        categoryId: SAVINGS_CATEGORY_ID,
        isSaving: true,
        savingsPotId: pot.id,
      }),
    ]

    expect(potState(pot, ledger, [], 'GEL', {}, MONTH).balance).toBe(25000)

    const s = monthSummary(ledger, MONTH)
    expect(s.saved).toBe(25000)
    expect(s.spent).toBe(0) // setting money aside is never spending
    expect(s.left).toBe(75000)
  })

  it('reaches the same balance either way, but only one touches the month', () => {
    const viaEntry = potState(
      pot,
      [],
      [entry({ potId: pot.id, amount: 25000, date: '2026-09-20' })],
      'GEL',
      {},
    ).balance
    const viaLedger = potState(
      pot,
      [
        tx({
          kind: 'expense',
          amount: 25000,
          date: '2026-09-20',
          categoryId: SAVINGS_CATEGORY_ID,
          isSaving: true,
          savingsPotId: pot.id,
        }),
      ],
      [],
      'GEL',
      {},
    ).balance

    expect(viaEntry).toBe(viaLedger)
  })

  it('taking money out is the same entry with the sign flipped', () => {
    const entries = [
      entry({ potId: pot.id, amount: 25000, date: '2026-09-20' }),
      entry({ potId: pot.id, amount: -10000, date: '2026-09-21' }),
    ]
    const st = potState(pot, [], entries, 'GEL', {}, MONTH)
    expect(st.addedIn).toBe(25000)
    expect(st.takenOut).toBe(10000)
    expect(st.balance).toBe(15000)
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

/* ----------------------- cross-screen reconciliation ---------------------- */

/**
 * Regression guard for a reported bug: the per-day totals on Activity were
 * computed inline with a different rule from the headline on Home, so the two
 * screens disagreed whenever savings were involved.
 */
describe('every screen agrees on the month', () => {
  const s = monthSummary(monthTx, MONTH)

  it('Activity day totals add up to the figure Home shows as Left', () => {
    const perDay = new Map<string, number>()
    for (const t of monthTx) {
      if (t.date.slice(0, 7) !== MONTH) continue
      perDay.set(t.date, (perDay.get(t.date) ?? 0) + cashFlow(t))
    }
    const summed = [...perDay.values()].reduce((a, b) => a + b, 0)
    expect(summed).toBe(s.left)
  })

  it('category totals add up to what was spent and saved', () => {
    const rows = categoryTotals(monthTx, DEFAULT_CATEGORIES, MONTH, 'expense')
    const savings = rows.filter((r) => r.category.system === 'savings')
    const spending = rows.filter((r) => r.category.system !== 'savings')
    expect(spending.reduce((a, r) => a + r.total, 0)).toBe(s.spent)
    expect(savings.reduce((a, r) => a + r.total, 0)).toBe(s.saved)
  })

  it('income sources add up to the income figure', () => {
    const rows = categoryTotals(monthTx, DEFAULT_CATEGORIES, MONTH, 'income')
    expect(rows.reduce((a, r) => a + r.total, 0)).toBe(s.income)
  })
})
