import { describe, expect, it } from 'vitest'
import { shouldStayOpen } from './swipe'

/**
 * Swipe-to-delete goes wrong in two ways: a careless flick destroys a row, or
 * the list feels twitchy because rows keep springing open while you scroll.
 *
 * The first is impossible by construction — finishing a drag can only reveal a
 * button, never delete — so these cover the second. The nasty case is a short,
 * sharp movement: it reports an enormous velocity while the finger has barely
 * moved, which is exactly what a vertical scroll that wandered sideways looks
 * like. Distance is therefore always required.
 */
describe('swiping a row open', () => {
  it('ignores a small wobble, however fast it was', () => {
    for (const offset of [0, -4, -8, -12, -19]) {
      expect(shouldStayOpen(offset, 0)).toBe(false)
      expect(shouldStayOpen(offset, -3000)).toBe(false)
    }
  })

  it('ignores a slow drift that never reaches the threshold', () => {
    expect(shouldStayOpen(-15, -100)).toBe(false)
    expect(shouldStayOpen(-27, -200)).toBe(false)
  })

  it('opens once the row has clearly been pulled across', () => {
    expect(shouldStayOpen(-29, 0)).toBe(true)
    expect(shouldStayOpen(-84, 0)).toBe(true)
  })

  it('lets a real flick open it from a shorter pull', () => {
    expect(shouldStayOpen(-22, -900)).toBe(true)
  })

  it('closes when flicked back to the right, whatever the offset says', () => {
    expect(shouldStayOpen(-70, 900)).toBe(false)
  })

  it('never opens from a rightward drag', () => {
    expect(shouldStayOpen(40, 0)).toBe(false)
    expect(shouldStayOpen(120, 300)).toBe(false)
  })
})
