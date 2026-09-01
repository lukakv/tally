import { useStore } from '../lib/store'

type Pattern = 'tap' | 'select' | 'success' | 'warn' | 'error'

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  select: 12,
  success: [14, 40, 22],
  warn: [18, 60, 18],
  error: [24, 50, 24, 50, 24],
}

/**
 * Android fires these through the Vibration API; iOS ignores them silently.
 * Kept deliberately short so the app feels responsive rather than buzzy.
 */
export function haptic(pattern: Pattern = 'tap') {
  try {
    if (!useStore.getState().settings.haptics) return
    navigator.vibrate?.(PATTERNS[pattern])
  } catch {
    /* vibration is a nicety, never a failure */
  }
}
