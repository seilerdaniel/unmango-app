/**
 * Calcula el monto final incluyendo impuestos, dado un % que el precio
 * base NO incluye (ej. IVA, impuesto PAIS en suscripciones del
 * exterior). Función pura para poder testearla. Redondea a 2 decimales
 * porque es un monto de dinero real (evita ruido de coma flotante, ej.
 * 999.99 * 1.21 = 1209.987899999...).
 */
import { round2 } from './money'

export function applyTax(baseAmount: number, taxPercentage: number): number {
  if (!(taxPercentage > 0)) return baseAmount
  return round2(baseAmount * (1 + taxPercentage / 100))
}
