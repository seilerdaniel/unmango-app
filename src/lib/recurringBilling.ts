export type BillingFrequency = 'monthly' | 'annual'

import { round2 } from './money'

function clampToLastDayOfMonth(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Math.min(day, lastDay)
}

/**
 * Calcula cuántos días faltan para el próximo vencimiento de un gasto
 * recurrente, mensual o anual. Para mensual, ignora el mes/año y solo
 * mira el día (clampeado al último día del mes si no existe, ej. 31 en
 * febrero). Para anual, hace falta el mes de facturación además del
 * día.
 */
export function daysUntilNextBilling(
  billingDay: number,
  frequency: BillingFrequency = 'monthly',
  billingMonth: number | null = null,
  today: Date = new Date()
): number {
  const start = new Date(today)
  start.setHours(0, 0, 0, 0)

  if (frequency === 'annual' && billingMonth) {
    const monthIndex = billingMonth - 1
    const year = start.getFullYear()

    let nextBilling = new Date(year, monthIndex, clampToLastDayOfMonth(year, monthIndex, billingDay))
    if (nextBilling < start) {
      nextBilling = new Date(year + 1, monthIndex, clampToLastDayOfMonth(year + 1, monthIndex, billingDay))
    }
    return Math.round((nextBilling.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  }

  const year = start.getFullYear()
  const month = start.getMonth()

  let nextBilling = new Date(year, month, clampToLastDayOfMonth(year, month, billingDay))
  if (nextBilling < start) {
    nextBilling = new Date(year, month + 1, clampToLastDayOfMonth(year, month + 1, billingDay))
  }
  return Math.round((nextBilling.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Para poder sumar "cuánto comprometo por mes" cuando hay gastos
 * anuales mezclados con mensuales, se prorratea el anual dividiendo por
 * 12 — así un seguro de $120.000/año pesa $10.000 en el total mensual,
 * en vez de aparecer como si fuera un gasto mensual completo.
 */
export function monthlyEquivalentAmount(amount: number, frequency: BillingFrequency): number {
  return frequency === 'annual' ? round2(amount / 12) : amount
}
