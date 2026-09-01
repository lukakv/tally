import { create } from 'zustand'
import { currentMonthKey, type MonthKey } from './date'
import type { Transaction, TxKind } from './types'

export type TabKey = 'home' | 'activity' | 'report' | 'split'

interface UIState {
  tab: TabKey
  setTab: (t: TabKey) => void

  /** shared by Activity and Report so switching tabs keeps your place */
  month: MonthKey
  setMonth: (m: MonthKey) => void

  entryOpen: boolean
  editingTx: Transaction | null
  entryKind: TxKind
  /** pre-fills a new entry — used by the shortcuts on the savings screen */
  entryPreset: { categoryId?: string; fromSavings?: boolean } | null
  openEntry: (opts?: {
    tx?: Transaction
    kind?: TxKind
    categoryId?: string
    fromSavings?: boolean
  }) => void
  closeEntry: () => void

  savingsOpen: boolean
  setSavingsOpen: (v: boolean) => void
  settingsOpen: boolean
  setSettingsOpen: (v: boolean) => void
}

export const useUI = create<UIState>((set) => ({
  tab: 'home',
  setTab: (tab) => set({ tab }),

  month: currentMonthKey(),
  setMonth: (month) => set({ month }),

  entryOpen: false,
  editingTx: null,
  entryKind: 'expense',
  entryPreset: null,
  openEntry: (opts) =>
    set({
      entryOpen: true,
      editingTx: opts?.tx ?? null,
      entryKind: opts?.tx?.kind ?? opts?.kind ?? 'expense',
      entryPreset:
        opts?.categoryId || opts?.fromSavings
          ? { categoryId: opts.categoryId, fromSavings: opts.fromSavings }
          : null,
    }),
  // keep the transaction around for the exit animation, clear it on next open
  closeEntry: () => set({ entryOpen: false }),

  savingsOpen: false,
  setSavingsOpen: (savingsOpen) => set({ savingsOpen }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
}))

// dev-only handle so the running app can be inspected from the console
if (import.meta.env.DEV) {
  ;(globalThis as unknown as { __ui: typeof useUI }).__ui = useUI
}
