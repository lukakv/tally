import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval'
import { uid } from './id'
import { PERSON_COLORS, POT_COLORS } from './seed'
import { SCHEMA_VERSION, emptyData, migrate, type LegacyData } from './migrate'
import {
  type AppData,
  type Category,
  type Person,
  type SavingsEntry,
  type SavingsPot,
  type Settings,
  type Settlement,
  type Transaction,
} from './types'

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

  addPot: (p: Omit<SavingsPot, 'id'>) => string
  updatePot: (id: string, patch: Partial<SavingsPot>) => void
  /** The last pot in the main currency cannot go — transfers need a home. */
  deletePot: (id: string) => { ok: boolean; reason?: string }

  addSavingsEntry: (e: Omit<SavingsEntry, 'id' | 'createdAt'>) => string
  updateSavingsEntry: (id: string, patch: Partial<SavingsEntry>) => void
  deleteSavingsEntry: (id: string) => void

  setRate: (currency: string, rate: number | null) => void

  updateSettings: (patch: Partial<Settings>) => void
  replaceAll: (data: AppData) => void
  resetAll: () => void
}

export type Store = AppData & Actions

export { SCHEMA_VERSION, migrate } from './migrate'

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

      addPot: (pot) => {
        const id = uid()
        set((s) => ({
          savingsPots: [
            ...s.savingsPots,
            { ...pot, id, color: pot.color || POT_COLORS[s.savingsPots.length % POT_COLORS.length] },
          ],
        }))
        return id
      },

      updatePot: (id, patch) =>
        set((s) => ({
          savingsPots: s.savingsPots.map((p) => (p.id === id ? { ...p, ...patch, id: p.id } : p)),
        })),

      deletePot: (id) => {
        const s = get()
        const pot = s.savingsPots.find((p) => p.id === id)
        if (!pot) return { ok: false, reason: 'Pot not found.' }

        const lastInMainCurrency =
          pot.currency === s.settings.currency &&
          s.savingsPots.filter((p) => p.currency === s.settings.currency && !p.archived).length === 1
        if (lastInMainCurrency) {
          return {
            ok: false,
            reason: 'This is the only pot in your main currency, and monthly transfers need somewhere to land. Rename it instead.',
          }
        }

        const usedByTx = s.transactions.filter((t) => t.savingsPotId === id).length
        if (usedByTx) {
          return {
            ok: false,
            reason: `${usedByTx} ${usedByTx === 1 ? 'entry moves' : 'entries move'} money through this pot. Rename it instead, or remove those entries first.`,
          }
        }

        set({
          savingsPots: s.savingsPots.filter((p) => p.id !== id),
          savingsEntries: s.savingsEntries.filter((e) => e.potId !== id),
        })
        return { ok: true }
      },

      addSavingsEntry: (entry) => {
        const id = uid()
        set((s) => ({
          savingsEntries: [...s.savingsEntries, { ...entry, id, createdAt: Date.now() }],
        }))
        return id
      },

      updateSavingsEntry: (id, patch) =>
        set((s) => ({
          savingsEntries: s.savingsEntries.map((e) =>
            e.id === id ? { ...e, ...patch, id: e.id } : e,
          ),
        })),

      deleteSavingsEntry: (id) =>
        set((s) => ({ savingsEntries: s.savingsEntries.filter((e) => e.id !== id) })),

      setRate: (currency, rate) =>
        set((s) => {
          const rates = { ...s.settings.rates }
          if (rate === null || !Number.isFinite(rate) || rate <= 0) delete rates[currency]
          else rates[currency] = rate
          return { settings: { ...s.settings, rates } }
        }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      // a backup may have been written by an older version, so it takes the
      // same upgrade path as locally stored data
      replaceAll: (data) => set(migrate(data as LegacyData)),

      // a reset keeps the person past onboarding — they have already seen it
      resetAll: () => {
        const fresh = emptyData()
        set({ ...fresh, settings: { ...fresh.settings, onboarded: true } })
      },
    }),
    {
      name: STORE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({
        version: s.version,
        transactions: s.transactions,
        categories: s.categories,
        people: s.people,
        settlements: s.settlements,
        savingsPots: s.savingsPots,
        savingsEntries: s.savingsEntries,
        budgets: s.budgets,
        budgetOverrides: s.budgetOverrides,
        settings: s.settings,
      }),
      migrate: (persisted) => migrate((persisted ?? {}) as LegacyData),
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
    version: SCHEMA_VERSION,
    transactions: s.transactions,
    categories: s.categories,
    people: s.people,
    settlements: s.settlements,
    savingsPots: s.savingsPots,
    savingsEntries: s.savingsEntries,
    budgets: s.budgets,
    budgetOverrides: s.budgetOverrides,
    settings: s.settings,
  }
}
