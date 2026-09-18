/**
 * Geometry and the one decision rule behind SwipeRow.
 *
 * Kept in its own module with no imports so it can be reasoned about — and
 * tested — without dragging in the store, which anything touching haptics
 * would otherwise do.
 */

export const ACTION_WIDTH = 84

/** A slow, deliberate pull has to cross a third of the action's width. */
export const OPEN_THRESHOLD = ACTION_WIDTH / 3

/**
 * A quick flick may open the row from less distance — but not from none.
 * Velocity on its own is far too eager: a sharp twitch covers barely ten
 * pixels while reporting a huge speed, so a scroll that wandered sideways
 * would pop rows open. The finger still has to have gone somewhere.
 */
export const FLICK_MIN_TRAVEL = 20
export const FLICK_VELOCITY = 520

/**
 * Whether a finished drag should leave the row open.
 *
 * Nothing here can delete: the most a gesture achieves is revealing a button.
 * A rightward flick always closes, so throwing a row shut is never mistaken
 * for opening it.
 */
export function shouldStayOpen(offsetX: number, velocityX: number): boolean {
  if (velocityX > FLICK_VELOCITY) return false
  if (offsetX < -OPEN_THRESHOLD) return true
  return offsetX < -FLICK_MIN_TRAVEL && velocityX < -FLICK_VELOCITY
}
