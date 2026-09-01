import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval'
import { uid } from './id'
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, PERSON_COLORS } from './seed'
import type { AppData, Category, Person, Settings, Settlement, Transaction } from './types'

const STORE_KEY = 'tally-store-v1'

const idbStorage: StateStorage = {
  getItem: async (name) => (await idbGet<string>(name)) ?? null,
  setItem: async (name, value) => {
    await idbSet(name, value)
  },
  removeItem: async (name) => {
    await idbDel(name)
  },
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>

interface Actions {
  hydrated: boolean

  addTransaction: (tx: NewTransaction) => string
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void

  addCategory: (c: Omit<Category, 'id'>) => string
  updateCategory: (id: string, patch: Partial<Category>) => void
  /** Moves any orphaned transactions into the matching "Other" category. */
  deleteCategory: (id: string) => { ok: boolean; reason?: string }

  addPerson: (name: string) => string
  updatePerson: (id: string, patch: Partial<Person>) => void
  deletePerson: (id: string) => { ok: boolean; reason?: string }

  setBudget: (categoryId: string, minor: number | null) => void
  setBudgetOverride: (month: string, categoryId: string, minor: number | null) => void

  addSettlement: (s: Omit<Settlement, 'id' | 'createdAt'>) => void
  deleteSettlement: (id: string) => void

  updateSettings: (patch: Partial<Settings>) => void
  replaceAll: (data: AppData) => void
  resetAll: () => void
}

export type Store = AppData & Actions

const emptyData = (): AppData => ({
  transactions: [],
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  people: [],
  settlements: [],
  budgets: {},
  budgetOverrides: {},
  settings: { ...DEFAULT_SETTINGS },
})

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...emptyData(),
      hydrated: false,

      addTransaction: (tx) => {
        const id = uid()
        const now = Date.now()
        set((s) => ({
          transactions: [...s.transactions, { ...tx, id, createdAt: now, updatedAt: now }],
        }))
        return id
      },

      updateTransaction: (id, patch) =>
        set((s) => ({
          transactions: s.transactions.map((t) =>
            t.id === id ? { ...t, ...patch, id: t.id, updatedAt: Date.now() } : t,
          ),
        })),

      deleteTransaction: (id) =>
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),

      addCategory: (c) => {
        const id = uid()
        set((s) => ({ categories: [...s.categories, { ...c, id }] }))
        return id
      },

      updateCategory: (id, patch) =>
        set((s) => ({
          categories: s.categories.map((c) =>
            c.id === id ? { ...c, ...patch, id: c.id, system: c.system } : c,
          ),
        })),

      deleteCategory: (id) => {
        const s = get()
        const cat = s.categories.find((c) => c.id === id)
        if (!cat) return { ok: false, reason: 'Category not found.' }
        if (cat.system) return { ok: false, reason: 'The Savings category cannot be removed.' }

        const fallback = s.categories.find(
          (c) => c.kind === cat.kind && c.id !== id && c.name === 'Other',
        )
        if (!fallback) return { ok: false, reason: 'No "Other" category to move entries into.' }

        set({
          categories: s.categories.filter((c) => c.id !== id),
          transactions: s.transactions.map((t) =>
            t.categoryId === id ? { ...t, categoryId: fallback.id, updatedAt: Date.now() } : t,
          ),
          budgets: Object.fromEntries(Object.entries(s.budgets).filter(([k]) => k !== id)),
          budgetOverrides: Object.fromEntries(
            Object.entries(s.budgetOverrides).filter(([k]) => !k.endsWith(':' + id)),
          ),
        })
        return { ok: true }
      },

      addPerson: (name) => {
        const id = uid()
        set((s) => ({
          people: [
            ...s.people,
            { id, name: name.trim(), color: PERSON_COLORS[s.people.length % PERSON_COLORS.length] },
          ],
        }))
        return id
      },

      updatePerson: (id, patch) =>
        set((s) => ({
          people: s.people.map((p) => (p.id === id ? { ...p, ...patch, id: p.id } : p)),
        })),

      deletePerson: (id) => {
        const s = get()
        const inTx = s.transactions.filter(
          (t) => t.split && (t.split.paidBy === id || t.split.shares.some((x) => x.who === id)),
        ).length
        const inSettle = s.settlements.filter((x) => x.personId === id).length
        if (inTx || inSettle) {
          const bits = [
            inTx ? inTx + (inTx === 1 ? ' shared expense' : ' shared expenses') : '',
            inSettle ? inSettle + (inSettle === 1 ? ' payment' : ' payments') : '',
          ].filter(Boolean)
          return {
            ok: false,
            reason:
              'Still referenced by ' +
              bits.join(' and ') +
              '. Rename them instead, or remove those entries first.',
          }
        }
        set({ people: s.people.filter((p) => p.id !== id) })
        return { ok: true }
      },

      setBudget: (categoryId, minor) =>
        set((s) => {
          const next = { ...s.budgets }
          if (minor === null || minor <= 0) delete next[categoryId]
          else next[categoryId] = minor
          return { budgets: next }
        }),

      setBudgetOverride: (month, categoryId, minor) =>
        set((s) => {
          const next = { ...s.budgetOverrides }
          const key = month + ':' + categoryId
          if (minor === null) delete next[key]
          else next[key] = minor
          return { budgetOverrides: next }
        }),

      addSettlement: (input) =>
        set((s) => ({
          settlements: [...s.settlements, { ...input, id: uid(), createdAt: Date.now() }],
        })),

      deleteSettlement: (id) =>
        set((s) => ({ settlements: s.settlements.filter((x) => x.id !== id) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      replaceAll: (data) =>
        set({
          transactions: data.transactions ?? [],
          categories: data.categories?.length ? data.categories : DEFAULT_CATEGORIES,
          people: data.people ?? [],
          settlements: data.settlements ?? [],
          budgets: data.budgets ?? {},
          budgetOverrides: data.budgetOverrides ?? {},
          settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
        }),

      resetAll: () => set({ ...emptyData(), settings: { ...DEFAULT_SETTINGS, onboarded: true } }),
    }),
    {
      name: STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        transactions: s.transactions,
        categories: s.categories,
        people: s.people,
        settlements: s.settlements,
        budgets: s.budgets,
        budgetOverrides: s.budgetOverrides,
        settings: s.settings,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) console.error('Could not read saved data', error)
        useStore.setState({ hydrated: true })
      },
    },
  ),
)

/** Everything needed to rebuild the app on another device. */
export function exportData(): AppData {
  const s = useStore.getState()
  return {
    transactions: s.transactions,
    categories: s.categories,
    people: s.people,
    settlements: s.settlements,
    budgets: s.budgets,
    budgetOverrides: s.budgetOverrides,
    settings: s.settings,
  }
}
