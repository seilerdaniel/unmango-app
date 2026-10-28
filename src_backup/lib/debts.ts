export interface DebtProgress {
  paidAmount: number
  paidPercent: number
  isPaidOff: boolean
}

/**
 * Calcula cuánto se pagó/cobró de una deuda y si ya quedó saldada.
 * Función pura para poder testearla.
 */
export function computeDebtProgress(totalAmount: number, remainingAmount: number): DebtProgress {
  const clampedRemaining = Math.max(0, remainingAmount)
  const paidAmount = totalAmount - clampedRemaining
  const paidPercent = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0

  return {
    paidAmount,
    paidPercent: Math.min(100, Math.max(0, paidPercent)),
    isPaidOff: clampedRemaining <= 0,
  }
}

/**
 * Días transcurridos desde el vencimiento (positivo = está vencida,
 * negativo = todavía faltan días). Devuelve null si la deuda no tiene
 * fecha de vencimiento cargada (es válido no ponerle una).
 */
export function daysOverdue(dueDate: string | null, today: Date = new Date()): number | null {
  if (!dueDate) return null

  const start = new Date(today)
  start.setHours(0, 0, 0, 0)
  const due = new Date(`${dueDate}T00:00:00`)

  return Math.round((start.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}
