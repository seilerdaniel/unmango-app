/**
 * "Safe-to-Spend": descuenta los gastos fijos comprometidos del
 * balance actual y divide lo que queda entre los días que faltan del
 * mes, para saber cuánto se puede gastar HOY sin comprometer lo que ya
 * está apalabrado (alquiler, suscripciones, etc.).
 *
 * Si el resultado da negativo (los gastos fijos ya superan el balance
 * disponible), se devuelve 0 en vez de un número negativo — no tiene
 * sentido decir "podés gastar -$500 por día".
 */
export function computeSafeToSpend(
  availableBalance: number,
  monthlyFixedCommitments: number,
  daysRemainingInMonth: number
): number {
  const safeDays = Math.max(1, daysRemainingInMonth)
  const remaining = availableBalance - monthlyFixedCommitments
  return Math.max(0, remaining / safeDays)
}
