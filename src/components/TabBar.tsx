import { motion } from 'motion/react'
import { ChartPie, House, Plus, ReceiptText, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useUI, type TabKey } from '../lib/ui'
import { haptic } from '../ui/haptics'
import { spring, springSnappy } from '../ui/motion'
import { cx } from '../ui/cx'

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'home', label: 'Home', icon: House },
  { key: 'activity', label: 'Activity', icon: ReceiptText },
  { key: 'report', label: 'Report', icon: ChartPie },
  { key: 'split', label: 'Shared', icon: Users },
]

export function TabBar() {
  const tab = useUI((s) => s.tab)
  const setTab = useUI((s) => s.setTab)
  const openEntry = useUI((s) => s.openEntry)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40">
      <div className="hairline-t safe-b bg-bg/85 backdrop-blur-2xl">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-1 pt-1.5 pb-1">
          {TABS.slice(0, 2).map((t) => (
            <TabButton key={t.key} tab={t} active={tab === t.key} onSelect={setTab} />
          ))}

          <div className="flex justify-center">
            <motion.button
              whileTap={{ scale: 0.9 }}
              transition={springSnappy}
              onClick={() => {
                haptic('select')
                openEntry()
              }}
              aria-label="Add entry"
              className={cx(
                '-translate-y-3 grid size-14 place-items-center rounded-2xl bg-accent text-accent-ink',
                'shadow-[0_8px_24px_-6px_var(--accent)] ring-1 ring-white/10',
              )}
            >
              <Plus size={26} strokeWidth={2.6} />
            </motion.button>
          </div>

          {TABS.slice(2).map((t) => (
            <TabButton key={t.key} tab={t} active={tab === t.key} onSelect={setTab} />
          ))}
        </div>
      </div>
    </nav>
  )
}

function TabButton({
  tab,
  active,
  onSelect,
}: {
  tab: { key: TabKey; label: string; icon: LucideIcon }
  active: boolean
  onSelect: (k: TabKey) => void
}) {
  const Icon = tab.icon
  return (
    <button
      onClick={() => {
        if (!active) haptic('select')
        onSelect(tab.key)
      }}
      className="relative flex flex-col items-center gap-1 pt-1.5 pb-1.5"
    >
      <motion.span
        animate={{ scale: active ? 1.06 : 1, y: active ? -1 : 0 }}
        transition={springSnappy}
        className={cx('transition-colors duration-200', active ? 'text-accent' : 'text-faint')}
      >
        <Icon size={21} strokeWidth={active ? 2.4 : 2} />
      </motion.span>
      <span
        className={cx(
          'text-[10.5px] font-medium transition-colors duration-200',
          active ? 'text-accent' : 'text-faint',
        )}
      >
        {tab.label}
      </span>
      {active && (
        <motion.span
          layoutId="tab-dot"
          transition={spring}
          className="absolute -top-0.5 size-1 rounded-full bg-accent"
        />
      )}
    </button>
  )
}
