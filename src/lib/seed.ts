import type { Category, Settings } from './types'

export const SAVINGS_CATEGORY_ID = 'cat-savings'

export const DEFAULT_CATEGORIES: Category[] = [
  // ---- expense ----
  { id: 'cat-groceries', name: 'Groceries', icon: 'cart', color: '#B7DF52', kind: 'expense' },
  { id: 'cat-eatingout', name: 'Eating out', icon: 'utensils', color: '#FF9F45', kind: 'expense' },
  { id: 'cat-transport', name: 'Transport', icon: 'car', color: '#38BDF8', kind: 'expense' },
  { id: 'cat-home', name: 'Rent & home', icon: 'house', color: '#8B9BFF', kind: 'expense' },
  { id: 'cat-utilities', name: 'Utilities', icon: 'zap', color: '#FFC94D', kind: 'expense' },
  { id: 'cat-health', name: 'Health', icon: 'health', color: '#F472B6', kind: 'expense' },
  { id: 'cat-shopping', name: 'Shopping', icon: 'bag', color: '#D084F5', kind: 'expense' },
  { id: 'cat-fun', name: 'Fun', icon: 'movie', color: '#A78BFA', kind: 'expense' },
  { id: 'cat-travel', name: 'Travel', icon: 'plane', color: '#2DD4BF', kind: 'expense' },
  { id: 'cat-subs', name: 'Subscriptions', icon: 'repeat', color: '#6BA5FF', kind: 'expense' },
  { id: 'cat-gifts', name: 'Gifts', icon: 'gift', color: '#FF7A5C', kind: 'expense' },
  {
    id: SAVINGS_CATEGORY_ID,
    name: 'Savings',
    icon: 'piggy',
    color: '#FBBF24',
    kind: 'expense',
    system: 'savings',
  },
  { id: 'cat-other-exp', name: 'Other', icon: 'dots', color: '#94A3B8', kind: 'expense' },

  // ---- income ----
  { id: 'cat-salary', name: 'Salary', icon: 'briefcase', color: '#2DD4BF', kind: 'income' },
  { id: 'cat-freelance', name: 'Freelance', icon: 'receipt', color: '#38BDF8', kind: 'income' },
  { id: 'cat-gift-in', name: 'Gift', icon: 'gift', color: '#F472B6', kind: 'income' },
  { id: 'cat-invest', name: 'Investment', icon: 'trending', color: '#B7DF52', kind: 'income' },
  { id: 'cat-refund', name: 'Refund', icon: 'undo', color: '#FF9F45', kind: 'income' },
  { id: 'cat-other-inc', name: 'Other', icon: 'dots', color: '#94A3B8', kind: 'income' },
]

export const PERSON_COLORS = [
  '#9B8CFF',
  '#2DD4BF',
  '#FF9F45',
  '#F472B6',
  '#38BDF8',
  '#B7DF52',
  '#D084F5',
  '#FF7A5C',
]

export const DEFAULT_SETTINGS: Settings = {
  currency: 'GEL',
  theme: 'dark',
  openingSavings: 0,
  haptics: true,
  onboarded: false,
}

export const CURRENCIES: { code: string; symbol: string; name: string }[] = [
  { code: 'GEL', symbol: '₾', name: 'Georgian lari' },
  { code: 'USD', symbol: '$', name: 'US dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British pound' },
  { code: 'TRY', symbol: '₺', name: 'Turkish lira' },
  { code: 'RUB', symbol: '₽', name: 'Russian ruble' },
  { code: 'AMD', symbol: '֏', name: 'Armenian dram' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE dirham' },
]
