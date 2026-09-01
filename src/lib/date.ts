import { addMonths, format, parseISO, startOfMonth, subDays } from 'date-fns'

/** Month keys are 'yyyy-MM'; dates are 'yyyy-MM-dd', both in local time. */
export type MonthKey = string

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function monthKeyOf(dateISO: string): MonthKey {
  return dateISO.slice(0, 7)
}

export function currentMonthKey(): MonthKey {
  return format(new Date(), 'yyyy-MM')
}

export function monthDate(key: MonthKey): Date {
  return startOfMonth(parseISO(`${key}-01`))
}

export function shiftMonth(key: MonthKey, by: number): MonthKey {
  return format(addMonths(monthDate(key), by), 'yyyy-MM')
}

export function monthLabel(key: MonthKey, opts: { short?: boolean } = {}): string {
  const d = monthDate(key)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  if (opts.short) return format(d, sameYear ? 'MMM' : "MMM ''yy")
  return format(d, sameYear ? 'MMMM' : 'MMMM yyyy')
}

export function dayLabel(dateISO: string): string {
  if (dateISO === todayISO()) return 'Today'
  if (dateISO === format(subDays(new Date(), 1), 'yyyy-MM-dd')) return 'Yesterday'
  const d = parseISO(dateISO)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return format(d, sameYear ? 'EEE, d MMM' : 'd MMM yyyy')
}

export function shortDate(dateISO: string): string {
  return format(parseISO(dateISO), 'd MMM')
}

/** How far through the month we are, 0..1 — used to pace budget expectations. */
export function monthProgress(key: MonthKey): number {
  const now = new Date()
  if (key !== format(now, 'yyyy-MM')) return 1
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return now.getDate() / days
}
