/**
 * crypto.randomUUID is only available in secure contexts, and the dev server
 * over a LAN IP is not one — so keep a plain fallback.
 */
export function uid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  if (c && typeof c.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16))
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}
