import { useState } from 'react'
import { motion } from 'motion/react'
import { PiggyBank, Users, Wallet } from 'lucide-react'
import { CURRENCIES } from '../lib/seed'
import { symbolFor, toMinor } from '../lib/money'
import { useStore } from '../lib/store'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/primitives'
import { haptic } from '../ui/haptics'
import { riseItem, stagger, tap } from '../ui/motion'
import { cx } from '../ui/cx'

/**
 * One short screen on first launch: currency, and what is already saved.
 * Both are things that are annoying to fix retroactively; everything else
 * can be discovered by using the app.
 */
export function Onboarding() {
  const onboarded = useStore((s) => s.settings.onboarded)
  const currency = useStore((s) => s.settings.currency)
  const updateSettings = useStore((s) => s.updateSettings)

  const [raw, setRaw] = useState('')

  function finish() {
    updateSettings({ onboarded: true, openingSavings: toMinor(raw || '0') })
    haptic('success')
  }

  return (
    <Sheet open={!onboarded} onClose={finish} title="Welcome to Tally" hideClose>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="space-y-6 px-5 pt-1 pb-8"
      >
        <motion.p variants={riseItem} className="text-[14px] leading-relaxed text-dim">
          A quiet place to see what came in, what went out, and what is actually left. Everything
          stays on this phone.
        </motion.p>

        <motion.div variants={riseItem} className="space-y-2.5">
          <Feature
            icon={<Wallet size={17} strokeWidth={2.1} />}
            title="Two taps to log"
            body="Amount, category, done. Notes and dates only if you want them."
          />
          <Feature
            icon={<Users size={17} strokeWidth={2.1} />}
            title="Split without the maths"
            body="Halve a bill and Tally keeps the running balance with each person."
          />
          <Feature
            icon={<PiggyBank size={17} strokeWidth={2.1} />}
            title="Savings kept separate"
            body="Money you put aside is a transfer, not spending."
          />
        </motion.div>

        <motion.div variants={riseItem}>
          <h3 className="mb-2.5 px-1 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
            Currency
          </h3>
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => {
              const active = c.code === currency
              return (
                <motion.button
                  key={c.code}
                  whileTap={tap}
                  onClick={() => {
                    haptic('select')
                    updateSettings({ currency: c.code })
                  }}
                  className={cx(
                    'flex h-11 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium transition-colors',
                    active
                      ? 'bg-accent text-accent-ink'
                      : 'bg-surface-2 text-dim ring-1 ring-line/50',
                  )}
                >
                  <span className="text-[15px]">{c.symbol}</span>
                  {c.code}
                </motion.button>
              )
            })}
          </div>
        </motion.div>

        <motion.div variants={riseItem}>
          <h3 className="mb-2.5 px-1 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
            Already saved
          </h3>
          <span className="flex h-14 items-center gap-2 rounded-2xl bg-surface-2 px-4 ring-1 ring-line/50 focus-within:ring-accent/60">
            <span className="text-[20px] text-faint">{symbolFor(currency)}</span>
            <input
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
              placeholder="0"
              className="tnum min-w-0 flex-1 bg-transparent text-[20px] font-medium placeholder:text-faint"
            />
          </span>
          <p className="px-1 pt-2 text-[12.5px] leading-relaxed text-faint">
            Optional. Your savings balance starts from here — you can change it later.
          </p>
        </motion.div>

        <motion.div variants={riseItem}>
          <Button block size="lg" variant="primary" onClick={finish}>
            Start tracking
          </Button>
        </motion.div>
      </motion.div>
    </Sheet>
  )
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-surface-2/50 px-4 py-3">
      <span className="mt-0.5 shrink-0 text-accent">{icon}</span>
      <div>
        <p className="text-[14px] font-medium">{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-faint">{body}</p>
      </div>
    </div>
  )
}
