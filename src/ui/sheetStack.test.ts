import { beforeEach, describe, expect, it, vi } from 'vitest'
import { popSheet, pushSheet, resetSheetStack, sheetStackDepth } from './sheetStack'

/**
 * These pin down the behaviour that two user-visible bugs came from: a back
 * press closing more than one sheet, and the guard drifting until back presses
 * stopped working at all.
 */

/** Just enough of the History API to model entries and back(). */
function installFakeHistory() {
  const entries: unknown[] = [null]
  let index = 0
  const listeners: (() => void)[] = []

  const fake = {
    get state() {
      return entries[index]
    },
    pushState(state: unknown) {
      entries.length = index + 1
      entries.push(state)
      index++
    },
    back() {
      if (index > 0) index--
      // the real thing dispatches this asynchronously
      queueMicrotask(() => listeners.forEach((l) => l()))
    },
  }

  vi.stubGlobal('history', fake)
  vi.stubGlobal('window', {
    addEventListener: (type: string, fn: () => void) => {
      if (type === 'popstate') listeners.push(fn)
    },
    removeEventListener: () => {},
  })

  return {
    /** what pressing the hardware back button does */
    pressBack: async () => {
      fake.back()
      await Promise.resolve()
    },
    depth: () => index,
  }
}

describe('the back button and a stack of sheets', () => {
  let h: ReturnType<typeof installFakeHistory>

  beforeEach(() => {
    vi.unstubAllGlobals()
    h = installFakeHistory()
    resetSheetStack()
  })

  it('closes only the topmost sheet, not the one underneath', async () => {
    const parent = vi.fn()
    const child = vi.fn()
    pushSheet(parent)
    pushSheet(child)

    await h.pressBack()

    expect(child).toHaveBeenCalledTimes(1)
    expect(parent).not.toHaveBeenCalled()
    expect(sheetStackDepth()).toBe(1)
  })

  it('closes them one press at a time, innermost first', async () => {
    const order: string[] = []
    const a = pushSheet(() => order.push('parent'))
    const b = pushSheet(() => order.push('child'))
    expect(a).not.toBe(b)

    await h.pressBack()
    await h.pressBack()

    expect(order).toEqual(['child', 'parent'])
    expect(sheetStackDepth()).toBe(0)
  })

  it('does not unwind a second entry when a sheet is closed from its own button', async () => {
    const parent = vi.fn()
    const child = vi.fn()
    pushSheet(parent)
    const childId = pushSheet(child)

    // tapping the child's close button
    popSheet(childId)
    await Promise.resolve()

    // the parent must still be standing, and untouched
    expect(parent).not.toHaveBeenCalled()
    expect(sheetStackDepth()).toBe(1)
  })

  it('ignores the unwind for a sheet the back button already removed', async () => {
    const parent = vi.fn()
    const child = vi.fn()
    pushSheet(parent)
    const childId = pushSheet(child)

    await h.pressBack() // closes the child
    popSheet(childId) // React then cleans the same sheet up

    expect(parent).not.toHaveBeenCalled()
    expect(sheetStackDepth()).toBe(1)
  })

  it('keeps working after sheets are opened and closed repeatedly', async () => {
    // the reported lockup: open, back out, and the next attempt did nothing
    for (let i = 0; i < 5; i++) {
      const close = vi.fn()
      pushSheet(close)
      await h.pressBack()
      expect(close).toHaveBeenCalledTimes(1)
      expect(sheetStackDepth()).toBe(0)
    }

    // and a nested pair still behaves on the sixth go
    const parent = vi.fn()
    const child = vi.fn()
    pushSheet(parent)
    pushSheet(child)
    await h.pressBack()
    expect(child).toHaveBeenCalledTimes(1)
    expect(parent).not.toHaveBeenCalled()
  })

  it('survives a mix of button closes and back presses', async () => {
    const a = vi.fn()
    const b = vi.fn()
    const c = vi.fn()

    pushSheet(a)
    const bId = pushSheet(b)
    popSheet(bId) // b closed by its own button
    await Promise.resolve()

    pushSheet(c)
    await h.pressBack() // must close c, not a

    expect(c).toHaveBeenCalledTimes(1)
    expect(a).not.toHaveBeenCalled()
    expect(sheetStackDepth()).toBe(1)
  })
})
