import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { CATEGORY_COLORS, ICON_KEYS, icon as iconFor } from '../lib/icons'
import { useStore } from '../lib/store'
import type { Category, TxKind } from '../lib/types'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/primitives'
import { CategoryIcon } from '../ui/CategoryIcon'
import { TextField } from '../ui/Field'
import { confirm, toast } from '../ui/feedback'
import { haptic } from '../ui/haptics'
import { springSoft, stagger, tap } from '../ui/motion'
import { cx } from '../ui/cx'

/** Full grid of categories with an inline route to creating a new one. */
export function CategoryPickerSheet({
  open,
  onClose,
  kind,
  value,
  onPick,
}: {
  open: boolean
  onClose: () => void
  kind: TxKind
  value?: string
  onPick: (id: string) => void
}) {
  const categories = useStore((s) => s.categories)
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const list = categories.filter((c) => c.kind === kind && !c.archived)

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={kind === 'expense' ? 'Expense category' : 'Income source'}
      >
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-4 gap-2 px-4 pt-1 pb-8"
        >
          {list.map((c) => {
            const active = c.id === value
            return (
              <motion.button
                key={c.id}
                variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                whileTap={tap}
                onClick={() => {
                  haptic('select')
                  onPick(c.id)
                  onClose()
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  haptic('warn')
                  setEditing(c)
                }}
                className={cx(
                  'flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 transition-colors',
                  active ? 'bg-surface-2 ring-1 ring-accent/40' : 'active:bg-surface-2',
                )}
              >
                <div className="relative">
                  <CategoryIcon icon={c.icon} color={c.color} size="lg" />
                  {active && (
                    <motion.span
                      layoutId="cat-check"
                      className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-accent text-accent-ink"
                    >
                      <Check size={12} strokeWidth={3.5} />
                    </motion.span>
                  )}
                </div>
                <span className="w-full truncate text-center text-[11.5px] leading-tight text-dim">
                  {c.name}
                </span>
              </motion.button>
            )
          })}

          <motion.button
            variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
            whileTap={tap}
            onClick={() => {
              haptic('tap')
              setEditing('new')
            }}
            className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 active:bg-surface-2"
          >
            <div className="grid size-12 place-items-center rounded-[15px] border border-dashed border-line text-faint">
              <Plus size={20} strokeWidth={2.2} />
            </div>
            <span className="text-[11.5px] leading-tight text-faint">New</span>
          </motion.button>
        </motion.div>

        <p className="px-6 pb-7 text-center text-[12px] text-faint">
          Long-press a category to edit or remove it.
        </p>
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

export function CategoryEditorSheet({
  open,
  onClose,
  kind,
  category,
}: {
  open: boolean
  onClose: () => void
  kind: TxKind
  category: Category | null
}) {
  const addCategory = useStore((s) => s.addCategory)
  const updateCategory = useStore((s) => s.updateCategory)
  const deleteCategory = useStore((s) => s.deleteCategory)

  const [name, setName] = useState('')
  const [iconKey, setIconKey] = useState<string>('dots')
  const [color, setColor] = useState(CATEGORY_COLORS[0])

  useEffect(() => {
    if (!open) return
    setName(category?.name ?? '')
    setIconKey(category?.icon ?? 'dots')
    setColor(category?.color ?? CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)])
  }, [open, category])

  function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    if (category) updateCategory(category.id, { name: trimmed, icon: iconKey, color })
    else addCategory({ name: trimmed, icon: iconKey, color, kind })
    haptic('success')
    onClose()
  }

  async function remove() {
    if (!category) return
    const ok = await confirm({
      title: `Remove "${category.name}"?`,
      body: 'Entries in this category move to Other. Nothing is lost.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    const res = deleteCategory(category.id)
    if (!res.ok) toast(res.reason ?? 'Could not remove that category', { tone: 'warn' })
    else {
      haptic('success')
      onClose()
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={category ? 'Edit category' : 'New category'}
      action={
        category && !category.system ? (
          <button onClick={remove} aria-label="Remove category" className="mr-1 p-1 text-neg">
            <Trash2 size={17} strokeWidth={2.1} />
          </button>
        ) : undefined
      }
    >
      <div className="space-y-5 px-5 pt-1 pb-7">
        <div className="flex items-center gap-4">
          <motion.div layout transition={springSoft}>
            <CategoryIcon icon={iconKey} color={color} size="xl" />
          </motion.div>
          <div className="flex-1">
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              maxLength={24}
              autoFocus={!category}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 px-1 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
            Colour
          </h3>
          <div className="flex flex-wrap gap-2.5">
            {CATEGORY_COLORS.map((c) => (
              <motion.button
                key={c}
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  haptic('select')
                  setColor(c)
                }}
                className="grid size-9 place-items-center rounded-full"
                style={{ backgroundColor: c + '2E' }}
              >
                <span
                  className="rounded-full transition-all duration-150"
                  style={{
                    backgroundColor: c,
                    width: color === c ? 20 : 16,
                    height: color === c ? 20 : 16,
                  }}
                />
              </motion.button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 px-1 text-[12px] font-semibold tracking-[0.09em] text-faint uppercase">
            Icon
          </h3>
          <div className="grid grid-cols-7 gap-1.5">
            {ICON_KEYS.map((k) => {
              const Glyph = iconFor(k)
              const active = k === iconKey
              return (
                <motion.button
                  key={k}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    haptic('select')
                    setIconKey(k)
                  }}
                  className={cx(
                    'grid aspect-square place-items-center rounded-xl transition-colors',
                    active ? 'bg-surface-3' : 'bg-surface-2/50',
                  )}
                  style={active ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
                >
                  <Glyph
                    size={17}
                    strokeWidth={2}
                    style={{ color: active ? color : 'var(--text-faint)' }}
                  />
                </motion.button>
              )
            })}
          </div>
        </div>

        <Button block size="lg" variant="primary" disabled={!name.trim()} onClick={save}>
          {category ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </Sheet>
  )
}
