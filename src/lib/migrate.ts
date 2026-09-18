import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, defaultPot } from './seed'
import type { AppData, Settings } from './types'

/**
 * Schema upgrades, kept deliberately free of side effects.
 *
 * This lives apart from store.ts because that module instantiates the zustand
 * store — and therefore reaches for IndexedDB — the moment it is imported.
 * Anything that wants to upgrade a payload (including the test suite) should be
 * able to do so without booting a database.
 */

export const SCHEMA_VERSION = 2

export const emptyData = (): AppData => ({
  version: SCHEMA_VERSION,
  transactions: [],
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  people: [],
  settlements: [],
  savingsPots: [defaultPot(DEFAULT_SETTINGS.currency)],
  savingsEntries: [],
  budgets: {},
  budgetOverrides: {},
  settings: { ...DEFAULT_SETTINGS },
})

/**
 * Anything an older version might have written: every field optional, and
 * settings loose enough to still carry v1's single openingSavings figure.
 */
export type LegacyData = Omit<Partial<AppData>, 'settings'> & {
  settings?: Partial<Settings> & { openingSavings?: number }
}

/**
 * Brings any older shape forward. Used both when rehydrating this device and
 * when importing a backup written by an earlier version, so there is one
 * upgrade path rather than two that can drift.
 */
export function migrate(raw: LegacyData): AppData {
  const base = emptyData()
  const settings = { ...base.settings, ...(raw.settings ?? {}) }
  const currency = settings.currency
  settings.rates = settings.rates ?? {}

  let pots = raw.savingsPots?.length ? raw.savingsPots : []
  if (!pots.length) {
    // v1 kept a single opening figure on settings; it becomes the main pot.
    pots = [defaultPot(currency, raw.settings?.openingSavings ?? 0)]
  }
  // guarantee a landing place for monthly transfers
  if (!pots.some((p) => p.currency === currency && !p.archived)) {
    pots = [defaultPot(currency), ...pots]
  }

  delete (settings as { openingSavings?: number }).openingSavings

  const mainPot = pots.find((p) => p.currency === currency && !p.archived) ?? pots[0]

  return {
    version: SCHEMA_VERSION,
    transactions: (raw.transactions ?? []).map((t) =>
      // v1 transactions knew nothing about pots
      t.kind === 'expense' && (t.isSaving || t.account === 'savings') && !t.savingsPotId
        ? { ...t, savingsPotId: mainPot.id }
        : t,
    ),
    categories: raw.categories?.length ? raw.categories : base.categories,
    people: raw.people ?? [],
    settlements: raw.settlements ?? [],
    savingsPots: pots,
    savingsEntries: raw.savingsEntries ?? [],
    budgets: raw.budgets ?? {},
    budgetOverrides: raw.budgetOverrides ?? {},
    settings,
  }
}
