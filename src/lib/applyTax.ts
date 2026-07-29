/**
 * Calcula el monto final incluyendo impuestos, dado un % que el precio
 * base NO incluye (ej. IVA, impuesto PAIS en suscripciones del
 * exterior). Función pura para poder testearla.
 */
export function applyTax(baseAmount: number, taxPercentage: number): number {
  if (!(taxPercentage > 0)) return baseAmount
  return baseAmount * (1 + taxPercentage / 100)
}
