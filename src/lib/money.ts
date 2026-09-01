import { CURRENCIES } from './seed'

/**
 * Every amount in this app is an integer number of minor units (tetri, cents).
 * Nothing is ever stored as a float, so sums never drift.
 */

export function symbolFor(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

/** "12.5" | 12.5  ->  1250 */
export function toMinor(value: string | number): number {
  if (typeof value === 'number') return Math.round(value * 100)
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(',', '.')
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

const groupers = new Map<number, Intl.NumberFormat>()
function grouper(decimals: number) {
  let f = groupers.get(decimals)
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    groupers.set(decimals, f)
  }
  return f
}

export interface MoneyParts {
  sign: '' | '-'
  symbol: string
  whole: string
  cents: string
}

export function moneyParts(minor: number, currency: string): MoneyParts {
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(Math.round(minor))
  return {
    sign,
    symbol: symbolFor(currency),
    whole: grouper(0).format(Math.floor(abs / 100)),
    cents: String(abs % 100).padStart(2, '0'),
  }
}

export interface FormatOpts {
  /** 'auto' drops ".00" on whole amounts */
  decimals?: 'auto' | 'always' | 'none'
  /** always render a leading + or - */
  signed?: boolean
  showSymbol?: boolean
}

export function formatMoney(minor: number, currency: string, opts: FormatOpts = {}): string {
  const { decimals = 'always', signed = false, showSymbol = true } = opts
  const rounded = Math.round(minor)
  const abs = Math.abs(rounded)
  const sign = rounded < 0 ? '-' : signed && rounded > 0 ? '+' : ''
  const sym = showSymbol ? symbolFor(currency) : ''

  if (decimals === 'none') return sign + sym + grouper(0).format(Math.round(abs / 100))
  const showCents = decimals === 'always' || abs % 100 !== 0
  return sign + sym + grouper(showCents ? 2 : 0).format(abs / 100)
}

/** Short form for axis labels and chips: ₾1.2k */
export function formatCompact(minor: number, currency: string): string {
  const abs = Math.abs(minor) / 100
  const sym = symbolFor(currency)
  const sign = minor < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (abs >= 1000) return `${sign}${sym}${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `${sign}${sym}${Math.round(abs)}`
}

/**
 * Divide a total into `n` whole minor-unit shares. The remainder is handed to
 * the earliest shares so the parts always add back up to exactly `total`.
 */
export function splitEvenly(total: number, n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(total / n)
  let rest = total - base * n
  return Array.from({ length: n }, () => {
    const extra = rest > 0 ? 1 : 0
    rest -= extra
    return base + extra
  })
}
