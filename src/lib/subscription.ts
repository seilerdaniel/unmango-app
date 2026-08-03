import type { Subscription } from '@/types'

export type Plan = 'free' | 'pro' | 'hogar'

export type PlanFeature = 'quickchart' | 'tna' | 'roundup' | 'unlimited_wallets' | 'export_pdf'

/**
 * Límite de billeteras del plan FREE (Tanda 11d): un usuario gratuito
 * puede tener hasta 2 billeteras activas; PRO y HOGAR son ilimitadas.
 */
export const FREE_WALLET_LIMIT = 2

const PRO_FEATURES: readonly PlanFeature[] = [
  'quickchart',
  'tna',
  'roundup',
  'unlimited_wallets',
  'export_pdf',
]

/**
 * Plan efectivo de un usuario: sin fila en `subscriptions` (o con un
 * plan desconocido) asume 'free', igual que el default de la base.
 */
export function getUserPlan(subscription: Subscription | null): Plan {
  const plan = subscription?.plan
  if (plan === 'pro' || plan === 'hogar') return plan
  return 'free'
}

/** PRO accede a todo lo de PRO (HOGAR incluye PRO). */
export function hasProAccess(plan: string): boolean {
  return plan === 'pro' || plan === 'hogar'
}

/** HOGAR es el plan superior: todo lo de PRO + finanzas colaborativas. */
export function hasHogarAccess(plan: string): boolean {
  return plan === 'hogar'
}

/**
 * Matriz de permisos por feature:
 * - FREE: ninguna de las funciones de pago (billeteras limitadas a
 *   FREE_WALLET_LIMIT, sin TNA/roundup/gráficos/exportación PDF).
 * - PRO: todas las features de PRO.
 * - HOGAR: hereda todas las de PRO.
 */
export function canUseFeature(feature: PlanFeature, plan: string): boolean {
  if (plan === 'hogar') return true
  if (plan === 'pro') return PRO_FEATURES.includes(feature)
  return false
}
