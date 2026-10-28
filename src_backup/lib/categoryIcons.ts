import {
  ShoppingCart,
  Car,
  Home,
  Zap,
  HeartPulse,
  GraduationCap,
  Popcorn,
  Shirt,
  UtensilsCrossed,
  PawPrint,
  Sparkles,
  Laptop,
  Gift,
  Plane,
  PiggyBank,
  Tag,
  type LucideIcon,
} from 'lucide-react'

/**
 * Set curado de íconos disponibles para categorías. Se guarda el NOMBRE
 * (string) en la base de datos, no el componente — así el ícono elegido
 * sigue siendo válido aunque cambiemos qué librería de íconos usamos por
 * dentro.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'shopping-cart': ShoppingCart,
  car: Car,
  home: Home,
  zap: Zap,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  popcorn: Popcorn,
  shirt: Shirt,
  utensils: UtensilsCrossed,
  'paw-print': PawPrint,
  sparkles: Sparkles,
  laptop: Laptop,
  gift: Gift,
  plane: Plane,
  'piggy-bank': PiggyBank,
  tag: Tag,
}

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS)

/** Devuelve el componente de ícono para un nombre guardado, con Tag como fallback. */
export function getCategoryIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return Tag
  return CATEGORY_ICONS[iconName] ?? Tag
}
