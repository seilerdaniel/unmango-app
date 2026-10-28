/**
 * "Safe-to-Spend": descuenta todo lo que ya está comprometido (gastos
 * fijos recurrentes, presupuestos asignados, aportes a metas de ahorro
 * y cuotas del mes) del balance real en billeteras, y divide lo que
 * queda entre los días que faltan del mes. El resultado dice cuánto se
 * puede gastar HOY sin romper lo ya apalabrado.
 *
 * Criterio del semáforo (documentado en AUDIT.md, Fase 2 UX/UI):
 * - Rojo (sobregastado): el disponible real ya es ≤ 0 — los
 *   compromisos superan el balance, no hay margen.
 * - Amarillo (ajustado): el límite diario queda por debajo del 10% del
 *   ingreso mensual prorrateado por día (ej. $100k/mes → umbral
 *   $333/día). Podés gastar, pero poco.
 * - Verde (seguro): el resto.
 */
export type SafeToSpendStatus = 'safe' | 'tight' | 'over'

export interface SafeToSpendInput {
  /** Saldo real actual en billeteras (ARS, get_wallet_balances). */
  totalBalance: number
  /** Recurrentes ARS activos, prorrateados a su equivalente mensual. */
  monthlyFixedCommitments: number
  /** Suma de los límites mensuales asignados en presupuestos. */
  budgetedAllocations: number
  /** Suma de los aportes mensuales planificados a metas de ahorro. */
  savingsContributions: number
  /** Suma de las cuotas del mes (total_amount / installments_count). */
  installmentCommitments: number
  /** Ingreso del mes en curso, para el umbral del amarillo. */
  monthlyIncome: number
  /** Días que quedan del mes, incluyendo hoy. */
  daysRemaining: number
}

export interface SafeToSpendResult {
  /** Balance menos todos los compromisos (puede ser negativo). */
  availableBalance: number
  daysRemaining: number
  /** Límite diario recomendado (nunca negativo; 0 si está sobregastado). */
  dailyLimit: number
  status: SafeToSpendStatus
}

/**
 * Días que quedan del mes contando hoy (+1 porque hoy también es un día
 * disponible para gastar). Función pura para poder testearla.
 */
export function getDaysRemainingInMonth(today: Date): number {
  const dayOfMonth = today.getDate()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  return daysInMonth - dayOfMonth + 1
}

/**
 * Fracción del ingreso mensual que define el umbral del estado
 * "Amarillo": el límite diario tiene que superar el 10% del ingreso
 * mensual prorrateado por día para considerarse "Verde".
 */
export function tightStatusThreshold(monthlyIncome: number): number {
  return (monthlyIncome / 30) * 0.1
}

export function computeSafeToSpend(input: SafeToSpendInput): SafeToSpendResult {
  const {
    totalBalance,
    monthlyFixedCommitments,
    budgetedAllocations,
    savingsContributions,
    installmentCommitments,
    monthlyIncome,
    daysRemaining,
  } = input

  const commitments =
    monthlyFixedCommitments + budgetedAllocations + savingsContributions + installmentCommitments
  const availableBalance = totalBalance - commitments

  // Al final del mes (0 días) usamos 1 para no dividir por cero.
  const safeDays = Math.max(1, daysRemaining)
  const dailyLimit = Math.max(0, availableBalance / safeDays)

  let status: SafeToSpendStatus = 'safe'
  if (availableBalance <= 0) {
    status = 'over'
  } else if (dailyLimit < tightStatusThreshold(monthlyIncome)) {
    status = 'tight'
  }

  return { availableBalance, daysRemaining, dailyLimit, status }
}
