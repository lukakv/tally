import type { Transition } from 'motion/react'

/** One place for timing so the whole app moves with the same personality. */
export const spring: Transition = { type: 'spring', stiffness: 400, damping: 34, mass: 0.9 }
export const springSoft: Transition = { type: 'spring', stiffness: 240, damping: 28 }
export const springSnappy: Transition = { type: 'spring', stiffness: 620, damping: 40 }
export const springBouncy: Transition = { type: 'spring', stiffness: 460, damping: 22 }

/** Children fade+rise in sequence — used for list and card entrances. */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
}

export const riseItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: springSoft },
}

export const tap = { scale: 0.97 }
