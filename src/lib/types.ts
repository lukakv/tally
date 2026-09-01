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
  /** expense only */
  split?: Split
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
  currency: string
  theme: ThemeMode
  /** savings already in the pot before the first transaction was logged */
  openingSavings: number
  haptics: boolean
  /** shown once on first run */
  onboarded: boolean
}

export interface AppData {
  transactions: Transaction[]
  categories: Category[]
  people: Person[]
  settlements: Settlement[]
  /** categoryId -> monthly budget */
  budgets: Record<string, number>
  /** `${yyyy-MM}:${categoryId}` -> budget for that month only */
  budgetOverrides: Record<string, number>
  settings: Settings
}
