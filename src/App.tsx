import { useEffect } from 'react'
import { MotionConfig, motion } from 'motion/react'
import { useStore } from './lib/store'
import { useUI, type TabKey } from './lib/ui'
import { ConfirmHost, ToastHost } from './ui/feedback'
import { TabBar } from './components/TabBar'
import { TransactionSheet } from './components/TransactionSheet'
import { Home } from './screens/Home'
import { Activity } from './screens/Activity'
import { Report } from './screens/Report'
import { Split } from './screens/Split'
import { SavingsSheet } from './screens/Savings'
import { SettingsSheet } from './screens/Settings'
import { Onboarding } from './screens/Onboarding'

const THEME_COLOR = { dark: '#0A0B0D', light: '#F6F6F9' }

/**
 * Tab switches deliberately do NOT run through AnimatePresence. Waiting for the
 * outgoing screen to finish exiting both delayed the new one by ~200ms and — with
 * layout-animated rows in the outgoing tree — could leave the exit unresolved, which
 * wedged navigation entirely. Keying the screen on the tab remounts it instantly and
 * the enter animation in Screen still gives the transition its lift.
 */
const SCREENS: Record<TabKey, () => React.ReactElement> = {
  home: Home,
  activity: Activity,
  report: Report,
  split: Split,
}

function useTheme() {
  const theme = useStore((s) => s.settings.theme)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const mode = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = mode
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', THEME_COLOR[mode])
    }
    apply()
    if (theme !== 'system') return
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated)
  const tab = useUI((s) => s.tab)
  const entryOpen = useUI((s) => s.entryOpen)
  const editingTx = useUI((s) => s.editingTx)
  const entryKind = useUI((s) => s.entryKind)
  const entryPreset = useUI((s) => s.entryPreset)
  const closeEntry = useUI((s) => s.closeEntry)

  useTheme()

  const CurrentScreen = SCREENS[tab]

  if (!hydrated) return <Splash />

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-dvh bg-bg">
        <CurrentScreen key={tab} />

        <TabBar />

        <TransactionSheet
          open={entryOpen}
          onClose={closeEntry}
          editing={editingTx}
          defaultKind={entryKind}
          preset={entryPreset}
        />
        <SavingsSheet />
        <SettingsSheet />
        <Onboarding />

        <ToastHost />
        <ConfirmHost />
      </div>
    </MotionConfig>
  )
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        className="flex flex-col items-center gap-3"
      >
        <motion.div
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="grid size-14 place-items-center rounded-[18px] bg-accent text-accent-ink"
        >
          <span className="text-[26px] font-semibold tracking-[-0.04em]">T</span>
        </motion.div>
        <span className="text-[13px] text-faint">Tally</span>
      </motion.div>
    </div>
  )
}
