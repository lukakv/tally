import { motion } from 'motion/react'
import { PiggyBank, Users } from 'lucide-react'
import { myShare } from '../lib/selectors'
import { shortDate } from '../lib/date'
import { useStore } from '../lib/store'
import { ME, type Transaction } from '../lib/types'
import { CategoryIcon } from '../ui/CategoryIcon'
import { Money } from '../ui/Money'
import { haptic } from '../ui/haptics'
import { springSoft } from '../ui/motion'
import { cx } from '../ui/cx'

export function TransactionRow({
  tx,
  onClick,
  showDate = false,
}: {
  tx: Transaction
  onClick?: (tx: Transaction) => void
  showDate?: boolean
}) {
  const categories = useStore((s) => s.categories)
  const people = useStore((s) => s.people)
  const category = categories.find((c) => c.id === tx.categoryId)

  const share = myShare(tx)
  const isSplit = !!tx.split
  const isSaving = tx.kind === 'expense' && tx.isSaving
  const fromSavings = tx.kind === 'expense' && tx.account === 'savings' && !isSaving

  const others = tx.split?.shares.filter((s) => s.who !== ME) ?? []
  const otherName =
    others.length === 1
      ? (people.find((p) => p.id === others[0].who)?.name ?? 'someone')
      : `${others.length} people`

  const subtitle = [
    tx.note,
    showDate ? shortDate(tx.date) : null,
    isSplit ? `Split with ${otherName}` : null,
    fromSavings ? 'From savings' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <motion.button
      layout="position"
      transition={springSoft}
      whileTap={{ backgroundColor: 'var(--surface-2)' }}
      onClick={() => {
        if (!onClick) return
        haptic('tap')
        onClick(tx)
      }}
      className="flex w-full items-center gap-3 px-4 py-3 text-left"
    >
      <div className="relative">
        <CategoryIcon
          icon={category?.icon ?? 'dots'}
          color={category?.color ?? '#94A3B8'}
          size="md"
        />
        {(isSplit || fromSavings) && (
          <span
            className={cx(
              'absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full ring-2 ring-surface',
              fromSavings ? 'bg-save-soft text-save' : 'bg-accent-soft text-accent',
            )}
          >
            {fromSavings ? (
              <PiggyBank size={10} strokeWidth={2.6} />
            ) : (
              <Users size={10} strokeWidth={2.8} />
            )}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] leading-tight font-medium">
          {category?.name ?? 'Uncategorised'}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[12.5px] leading-snug text-faint">{subtitle}</div>
        )}
      </div>

      <div className="shrink-0 text-right">
        <Money
          value={share}
          tone={tx.kind === 'income' ? 'pos' : isSaving ? 'save' : 'plain'}
          signed={tx.kind === 'income'}
          className="text-[15px] font-medium"
        />
        {isSplit && tx.amount !== share && (
          <div className="tnum mt-0.5 text-[11.5px] text-faint">
            of <Money value={tx.amount} tone="dim" className="text-[11.5px]" splitCents={false} />
          </div>
        )}
      </div>
    </motion.button>
  )
}
