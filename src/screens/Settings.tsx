import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  Coins,
  Download,
  HardDriveDownload,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
  Vibrate,
} from 'lucide-react'
import { CURRENCIES } from '../lib/seed'
import { exportData, useStore } from '../lib/store'
import { useUI } from '../lib/ui'
import type { AppData, Category, TxKind } from '../lib/types'
import { Sheet } from '../ui/Sheet'
import { Segmented } from '../ui/Segmented'
import { Button, Card } from '../ui/primitives'
import { Group, Row, Toggle } from '../ui/Field'
import { CategoryIcon } from '../ui/CategoryIcon'
import { confirm, toast } from '../ui/feedback'
import { haptic } from '../ui/haptics'
import { tap } from '../ui/motion'
import { cx } from '../ui/cx'
import { CategoryEditorSheet } from '../components/CategoryPicker'

export function SettingsSheet() {
  const open = useUI((s) => s.settingsOpen)
  const setOpen = useUI((s) => s.setSettingsOpen)

  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const replaceAll = useStore((s) => s.replaceAll)
  const resetAll = useStore((s) => s.resetAll)
  const transactions = useStore((s) => s.transactions)

  const [managing, setManaging] = useState(false)
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
  }, [open])

  function doExport() {
    const data = exportData()
    const stamp = new Date().toISOString().slice(0, 10)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tally-backup-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    haptic('success')
    toast('Backup saved')
  }

  async function doImport(file: File) {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as AppData
      if (!data || !Array.isArray(data.transactions)) throw new Error('bad shape')

      const ok = await confirm({
        title: 'Replace everything?',
        body: `This backup holds ${data.transactions.length} entries. Your current data will be overwritten.`,
        confirmLabel: 'Restore',
        danger: true,
      })
      if (!ok) return

      replaceAll(data)
      haptic('success')
      toast('Backup restored')
    } catch {
      haptic('error')
      toast('That file could not be read as a Tally backup', { tone: 'warn', duration: 5000 })
    }
  }

  async function doReset() {
    const ok = await confirm({
      title: 'Erase all data?',
      body: 'Every entry, budget and person is removed from this device. Export a backup first if you might want it back.',
      confirmLabel: 'Erase everything',
      danger: true,
    })
    if (!ok) return
    resetAll()
    haptic('success')
    toast('Everything erased')
  }

  async function makePersistent() {
    const granted = await navigator.storage?.persist?.()
    setPersisted(!!granted)
    toast(
      granted
        ? 'Storage is now permanent on this device'
        : 'The browser declined — install the app to home screen and try again',
      { tone: granted ? 'ok' : 'warn', duration: 5000 },
    )
  }

  const currency = CURRENCIES.find((c) => c.code === settings.currency)

  return (
    <>
      <Sheet open={open} onClose={() => setOpen(false)} title="Settings" tall>
        <div className="space-y-5 px-5 pt-1 pb-8">
          <Group title="Appearance">
            <div className="p-3">
              <Segmented
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                  { value: 'system', label: 'System' },
                ]}
                value={settings.theme}
                onChange={(theme) => updateSettings({ theme })}
              />
            </div>
            <Row
              icon={<IconBox><Vibrate size={17} strokeWidth={2.1} /></IconBox>}
              label="Haptics"
              sub="Small taps when you press things"
            >
              <Toggle
                checked={settings.haptics}
                onChange={(haptics) => updateSettings({ haptics })}
                label="Haptics"
              />
            </Row>
          </Group>

          <Group title="Money">
            <Row
              icon={<IconBox><Coins size={17} strokeWidth={2.1} /></IconBox>}
              label="Currency"
              sub={currency?.name}
              value={`${currency?.symbol} ${settings.currency}`}
              chevron
              onClick={() => setCurrencyOpen(true)}
            />
            <Row
              icon={<IconBox><Sparkles size={17} strokeWidth={2.1} /></IconBox>}
              label="Categories"
              sub="Rename, recolour, add your own"
              chevron
              onClick={() => setManaging(true)}
            />
          </Group>

          <Group
            title="Your data"
            footnote="Everything lives on this device only. Nothing is uploaded, and there is no account. Keep a backup somewhere safe."
          >
            <Row
              icon={<IconBox><Download size={17} strokeWidth={2.1} /></IconBox>}
              label="Export a backup"
              sub={`${transactions.length} entries as a JSON file`}
              chevron
              onClick={doExport}
            />
            <Row
              icon={<IconBox><Upload size={17} strokeWidth={2.1} /></IconBox>}
              label="Restore from backup"
              sub="Replaces everything on this device"
              chevron
              onClick={() => fileRef.current?.click()}
            />
            {persisted === false && (
              <Row
                icon={<IconBox><HardDriveDownload size={17} strokeWidth={2.1} /></IconBox>}
                label="Make storage permanent"
                sub="Stops the browser clearing your data if space runs low"
                chevron
                onClick={makePersistent}
              />
            )}
            {persisted === true && (
              <Row
                icon={
                  <IconBox tone="pos">
                    <ShieldCheck size={17} strokeWidth={2.1} />
                  </IconBox>
                }
                label="Storage is permanent"
                sub="Your data will not be cleared automatically"
              />
            )}
            <Row
              icon={<IconBox tone="neg"><RotateCcw size={17} strokeWidth={2.1} /></IconBox>}
              label="Erase all data"
              danger
              chevron
              onClick={doReset}
            />
          </Group>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) doImport(f)
              e.target.value = ''
            }}
          />

          <p className="px-2 text-center text-[12px] leading-relaxed text-faint">
            Tally · private, offline, yours
          </p>
        </div>
      </Sheet>

      <CurrencySheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} />
      <CategoryManagerSheet open={managing} onClose={() => setManaging(false)} />
    </>
  )
}

function IconBox({
  children,
  tone = 'dim',
}: {
  children: React.ReactNode
  tone?: 'dim' | 'pos' | 'neg'
}) {
  return (
    <div
      className={cx(
        'grid size-9 place-items-center rounded-xl',
        tone === 'pos'
          ? 'bg-pos-soft text-pos'
          : tone === 'neg'
            ? 'bg-neg-soft text-neg'
            : 'bg-surface-2 text-dim',
      )}
    >
      {children}
    </div>
  )
}

function CurrencySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)

  return (
    <Sheet open={open} onClose={onClose} title="Currency">
      <div className="px-5 pt-1 pb-8">
        <Card className="divide-y divide-line-soft overflow-hidden">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => {
                haptic('select')
                updateSettings({ currency: c.code })
                onClose()
              }}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-[15px] font-semibold text-dim">
                {c.symbol}
              </span>
              <span className="flex-1 text-[14.5px]">{c.name}</span>
              <span
                className={cx(
                  'text-[13px] font-medium',
                  c.code === settings.currency ? 'text-accent' : 'text-faint',
                )}
              >
                {c.code}
              </span>
            </button>
          ))}
        </Card>
        <p className="px-2 pt-3 text-[12px] leading-relaxed text-faint">
          Changing the currency only changes the symbol shown — amounts already recorded are not
          converted.
        </p>
      </div>
    </Sheet>
  )
}

function CategoryManagerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useStore((s) => s.categories)
  const [kind, setKind] = useState<TxKind>('expense')
  const [editing, setEditing] = useState<Category | 'new' | null>(null)

  const list = categories.filter((c) => c.kind === kind && !c.archived)

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Categories" tall>
        <div className="space-y-4 px-5 pt-1 pb-8">
          <Segmented
            options={[
              { value: 'expense', label: 'Expenses', color: 'var(--neg)' },
              { value: 'income', label: 'Income', color: 'var(--pos)' },
            ]}
            value={kind}
            onChange={setKind}
          />

          <Card className="divide-y divide-line-soft overflow-hidden">
            {list.map((c) => (
              <motion.button
                key={c.id}
                whileTap={tap}
                onClick={() => {
                  haptic('tap')
                  setEditing(c)
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
              >
                <CategoryIcon icon={c.icon} color={c.color} size="md" />
                <span className="flex-1 truncate text-[14.5px]">{c.name}</span>
                {c.system && (
                  <span className="rounded-full bg-save-soft px-2 py-0.5 text-[11px] font-medium text-save">
                    built in
                  </span>
                )}
              </motion.button>
            ))}
          </Card>

          <Button block variant="secondary" onClick={() => setEditing('new')}>
            New {kind === 'expense' ? 'expense' : 'income'} category
          </Button>
        </div>
      </Sheet>

      <CategoryEditorSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        kind={kind}
        category={editing === 'new' ? null : editing}
      />
    </>
  )
}
