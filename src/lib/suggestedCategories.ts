export interface SuggestedCategory {
  name: string
  color: string
  icon: string
}

/**
 * 15 categorías típicas de finanzas personales (contexto Argentina),
 * para ofrecerle al usuario un punto de partida en vez de una lista
 * vacía. Colores tomados en su mayoría de PRESET_COLORS, repetidos donde
 * hace falta ya que hay más categorías que colores base.
 */
export const SUGGESTED_CATEGORIES: SuggestedCategory[] = [
  { name: 'Supermercado', color: '#10b981', icon: 'shopping-cart' },
  { name: 'Transporte', color: '#6366f1', icon: 'car' },
  { name: 'Alquiler/Vivienda', color: '#f59e0b', icon: 'home' },
  { name: 'Servicios', color: '#06b6d4', icon: 'zap' },
  { name: 'Salud', color: '#ef4444', icon: 'heart-pulse' },
  { name: 'Educación', color: '#8b5cf6', icon: 'graduation-cap' },
  { name: 'Entretenimiento', color: '#ec4899', icon: 'popcorn' },
  { name: 'Ropa y Calzado', color: '#f59e0b', icon: 'shirt' },
  { name: 'Restaurantes y Delivery', color: '#10b981', icon: 'utensils' },
  { name: 'Mascotas', color: '#6366f1', icon: 'paw-print' },
  { name: 'Cuidado Personal', color: '#ec4899', icon: 'sparkles' },
  { name: 'Tecnología', color: '#06b6d4', icon: 'laptop' },
  { name: 'Regalos', color: '#ef4444', icon: 'gift' },
  { name: 'Viajes', color: '#8b5cf6', icon: 'plane' },
  { name: 'Ahorro/Inversión', color: '#10b981', icon: 'piggy-bank' },
]
