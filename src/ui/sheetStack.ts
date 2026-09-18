/**
 * One owner for the back button.
 *
 * Every open sheet used to attach its own popstate listener, which meant a
 * single back press fired all of them at once — closing a parent sheet and its
 * child together, or in the wrong order. Worse, each listener decided on its
 * own whether a pop was "its" navigation, using a shared counter that could
 * only drift upward; once it did, real back presses were swallowed for the rest
 * of the session and sheets stopped closing at all.
 *
 * So there is exactly one listener, and one stack. A back press closes the
 * topmost sheet and nothing else.
 */

interface StackEntry {
  id: number
  close: () => void
}

const stack: StackEntry[] = []
let seq = 0
let listening = false

/**
 * True while we are waiting on a history.back() we asked for ourselves, so the
 * popstate it produces is not mistaken for the user pressing back. A single
 * flag, not a counter: it can only ever swallow one event before clearing.
 */
let selfPop = false

function handlePop() {
  if (selfPop) {
    selfPop = false
    return
  }
  // the browser has already stepped back over the top sheet's entry
  stack.pop()?.close()
}

/** Called when a sheet opens. Returns the id used to unwind it again. */
export function pushSheet(close: () => void): number {
  if (!listening) {
    window.addEventListener('popstate', handlePop)
    listening = true
  }
  const id = ++seq
  stack.push({ id, close })
  history.pushState({ tallySheet: id }, '')
  return id
}

/**
 * Called when a sheet closes by any route. Safe to call for a sheet the back
 * button already removed — that is the common case, and it must not unwind a
 * second entry.
 */
export function popSheet(id: number) {
  const index = stack.findIndex((e) => e.id === id)
  if (index === -1) return
  stack.splice(index, 1)

  if (history.state?.tallySheet === id) {
    selfPop = true
    history.back()
  }
}

/** Test seam: also drops the listener so a fresh fake window gets wired up. */
export function resetSheetStack() {
  if (listening) {
    window.removeEventListener('popstate', handlePop)
    listening = false
  }
  stack.length = 0
  seq = 0
  selfPop = false
}

export function sheetStackDepth() {
  return stack.length
}
