export type TxKind = 'income' | 'expense'

/** Which pot the money physically came out of. */
export type Account = 'main' | 'savings'

/** 'me' is a reserved participant id that always means the app's owner. */
export const ME = 'me'

export interface Category {
  id: string
  name: string
  /** key into ICONS in lib/icons.ts */
  icon: string
  color: string
  kind: TxKind
  /** system categories cannot be deleted and carry extra behaviour */
  system?: 'savings'
  archived?: boolean
}

export interface Person {
  id: string
  name: string
  color: string
}

export interface SplitShare {
  /** ME or a Person id */
  who: string
  amount: number
}

export interface Split {
  /** who actually handed over the money */
  paidBy: string
  /** how the cost is divided; always includes ME and sums to the tx amount */
  shares: SplitShare[]
}

export interface Transaction {
  id: string
  kind: TxKind
  /** full value of the transaction, always positive */
  amount: number
  /** yyyy-MM-dd, local */
  date: string
  categoryId: string
  note?: string
  createdAt: number
  updatedAt: number

  /** expense only — defaults to 'main' */
  account?: Account
  /** expense only — this expense is a transfer INTO savings */
  isSaving?: boolean
  /**
   * expense only — which pot a savings transfer goes into, or a
   * savings-funded expense comes out of. Always a pot in the main currency.
   */
  savingsPotId?: string
  /** expense only */
  split?: Split
}

export const MAIN_POT_ID = 'pot-main'

/**
 * A place savings actually sit — "Cash", "Bank", "Euros under the mattress".
 * Each pot holds ONE currency, and its amounts are always in that currency.
 */
export interface SavingsPot {
  id: string
  name: string
  currency: string
  color: string
  /** what was already in it before Tally knew about it, in the pot's currency */
  opening: number
  archived?: boolean
}

/**
 * A movement of savings recorded directly on a pot, in the pot's currency.
 *
 * Deliberately NOT a Transaction: the transaction ledger is single-currency and
 * describes the month's income and spending, whereas this is money being put
 * aside or taken back out — often money the person already held. It never
 * touches a monthly total.
 */
export interface SavingsEntry {
  id: string
  potId: string
  /** minor units of the pot's currency; positive added, negative taken out */
  amount: number
  date: string
  note?: string
  createdAt: number
}

/** A repayment between me and one person. Never counts as income or expense. */
export interface Settlement {
  id: string
  personId: string
  /** > 0 they paid me back, < 0 I paid them back */
  amount: number
  date: string
  note?: string
  createdAt: number
}

export type ThemeMode = 'dark' | 'light' | 'system'

export interface Settings {
  /** the currency everything in the transaction ledger is denominated in */
  currency: string
  theme: ThemeMode
  haptics: boolean
  /** shown once on first run */
  onboarded: boolean
  /**
   * How many units of the main currency one unit of another is worth, entered
   * by hand. Kept manual on purpose: fetching live rates would mean network
   * calls, and this app never makes any.
   */
  rates: Record<string, number>
}

export interface AppData {
  /** schema version, so old backups can be brought forward on import */
  version?: number
  transactions: Transaction[]
  savingsPots: SavingsPot[]
  savingsEntries: SavingsEntry[]
  categories: Category[]
  people: Person[]
  settlements: Settlement[]
  /** categoryId -> monthly budget */
  budgets: Record<string, number>
  /** `${yyyy-MM}:${categoryId}` -> budget for that month only */
  budgetOverrides: Record<string, number>
  settings: Settings
}
