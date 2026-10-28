import { round2 } from './money'

/**
 * Ahorro por redondeo ("Bolsillo de Cambio"): cada gasto se redondea al
 * múltiplo superior del paso elegido y la diferencia va a un bolsillo de
 * ahorro. Ejemplos con paso $1.000: 3.200 → +800, 1.500 → +500, 4.000 → +0.
 * Un gasto que ya es múltiplo exacto del paso no redondea.
 *
 * Devuelve 0 con montos inválidos (NaN, negativos o cero) o pasos no
 * positivos, para que el consumo (frontend y bot) no tenga que validar.
 */
export function calculateRoundUp(amount: number, step = 1000): number {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(step) || step <= 0) return 0
  const remainder = amount % step
  if (remainder === 0) return 0
  return round2(step - remainder)
}

export interface RoundUpExpense {
  amount_ars: number | null
}

/**
 * Total del período: suma el redondeo de cada gasto (amount_ars) sobre el
 * paso elegido. Es el acumulado que muestra la tarjeta del Bolsillo de
 * Cambio y la nota del bot, y lo que se deriva a una Meta de Ahorro.
 */
export function computeTotalRoundUpSavings(expenses: RoundUpExpense[], step = 1000): number {
  return round2(
    expenses.reduce((acc, e) => acc + calculateRoundUp(Number(e.amount_ars) || 0, step), 0)
  )
}
