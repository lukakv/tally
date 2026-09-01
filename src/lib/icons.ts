import {
  Baby,
  Banknote,
  Briefcase,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  CreditCard,
  Dog,
  Dumbbell,
  Ellipsis,
  Fuel,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  TrendingUp,
  Undo2,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/** Serializable icon keys so categories stay plain JSON. */
export const ICONS = {
  cart: ShoppingCart,
  utensils: UtensilsCrossed,
  coffee: Coffee,
  car: Car,
  bus: Bus,
  fuel: Fuel,
  house: House,
  zap: Zap,
  wifi: Wifi,
  phone: Smartphone,
  health: HeartPulse,
  gym: Dumbbell,
  bag: ShoppingBag,
  shirt: Shirt,
  scissors: Scissors,
  movie: Clapperboard,
  plane: Plane,
  school: GraduationCap,
  gift: Gift,
  repeat: Repeat,
  piggy: PiggyBank,
  baby: Baby,
  dog: Dog,
  wrench: Wrench,
  sparkles: Sparkles,
  briefcase: Briefcase,
  receipt: Receipt,
  trending: TrendingUp,
  undo: Undo2,
  wallet: Wallet,
  card: CreditCard,
  bank: Landmark,
  coins: HandCoins,
  cash: Banknote,
  dots: Ellipsis,
} satisfies Record<string, LucideIcon>

export type IconKey = keyof typeof ICONS

export function icon(key: string): LucideIcon {
  return ICONS[key as IconKey] ?? ICONS.dots
}

/** Offered in the category editor, roughly grouped by theme. */
export const ICON_KEYS = Object.keys(ICONS) as IconKey[]

/**
 * Categorical hues chosen to stay legible on both the near-black and the
 * off-white canvas. Deliberately excludes the income green and expense rose
 * so those two never lose their meaning.
 */
export const CATEGORY_COLORS = [
  '#FF7A5C',
  '#FF9F45',
  '#FFC94D',
  '#B7DF52',
  '#2DD4BF',
  '#38BDF8',
  '#6BA5FF',
  '#8B9BFF',
  '#A78BFA',
  '#D084F5',
  '#F472B6',
  '#F0A0A0',
  '#B0A48C',
  '#94A3B8',
]
