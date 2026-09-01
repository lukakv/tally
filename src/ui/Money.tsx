import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { moneyParts, symbolFor } from '../lib/money'
import { useStore } from '../lib/store'
import { cx } from './cx'

type Tone = 'auto' | 'pos' | 'neg' | 'save' | 'plain' | 'dim'

const TONE: Record<Exclude<Tone, 'auto'>, string> = {
  pos: 'text-pos',
  neg: 'text-neg',
  save: 'text-save',
  plain: 'text-text',
  dim: 'text-dim',
}

export interface MoneyProps {
  /** minor units */
  value: number
  tone?: Tone
  /** render a leading + on positive values */
  signed?: boolean
  /** hide the ".00" tail on whole amounts */
  compactCents?: boolean
  className?: string
  /** smaller, dimmer decimals — the default; off for dense tables */
  splitCents?: boolean
}

function toneClass(tone: Tone, value: number) {
  if (tone !== 'auto') return TONE[tone]
  if (value > 0) return 'text-pos'
  if (value < 0) return 'text-neg'
  return 'text-dim'
}

/** Static money. Uses tabular figures so columns line up. */
export function Money({
  value,
  tone = 'plain',
  signed = false,
  compactCents = false,
  splitCents = true,
  className,
}: MoneyProps) {
  const currency = useStore((s) => s.settings.currency)
  const { sign, symbol, whole, cents } = moneyParts(value, currency)
  const lead = sign === '-' ? '-' : signed && value > 0 ? '+' : ''
  const hideCents = compactCents && cents === '00'

  return (
    <span className={cx('tnum whitespace-nowrap', toneClass(tone, value), className)}>
      {lead}
      <span className="opacity-60">{symbol}</span>
      {whole}
      {!hideCents && (
        <span className={splitCents ? 'text-[0.72em] opacity-55' : undefined}>.{cents}</span>
      )}
    </span>
  )
}

export interface AnimatedMoneyProps extends MoneyProps {
  /** skip the spring on first paint */
  immediate?: boolean
}

/**
 * Hero figures spring to their new value rather than snapping, which makes
 * adding an entry feel like it landed somewhere.
 */
export function AnimatedMoney({
  value,
  tone = 'plain',
  signed = false,
  compactCents = false,
  className,
}: AnimatedMoneyProps) {
  const currency = useStore((s) => s.settings.currency)
  const mv = useSpring(value, { stiffness: 140, damping: 24, mass: 0.7 })

  useEffect(() => {
    mv.set(value)
  }, [value, mv])

  const lead = useTransform(mv, (v): string => (v < -0.5 ? '-' : signed && v > 0.5 ? '+' : ''))
  const whole = useTransform(mv, (v) =>
    new Intl.NumberFormat('en-US').format(Math.floor(Math.abs(Math.round(v)) / 100)),
  )
  const cents = useTransform(mv, (v) => String(Math.abs(Math.round(v)) % 100).padStart(2, '0'))
  const showCents = !(compactCents && Math.abs(value) % 100 === 0)

  return (
    <span className={cx('tnum whitespace-nowrap', toneClass(tone, value), className)}>
      <motion.span>{lead}</motion.span>
      <span className="opacity-60">{symbolFor(currency)}</span>
      <motion.span>{whole}</motion.span>
      {showCents && (
        <span className="text-[0.72em] opacity-55">
          .<motion.span>{cents}</motion.span>
        </span>
      )}
    </span>
  )
}
