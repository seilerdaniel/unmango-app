/**
 * Motor de cálculo del "Simulador Anti-inflación para Compras en Cuotas".
 *
 * La idea central (igual que installmentsVsCash.ts, pero multi-opción y con
 * punto de equilibrio): cada cuota futura, medida en poder de compra de HOY,
 * vale menos que su valor nominal por la inflación. Se descuenta cada cuota
 * al valor presente y se suman. Si esa suma (el costo REAL de financiar) es
 * menor que el precio de contado, conviene financiar; si es mayor, conviene
 * pagar de una.
 *
 * Además se calcula el "break-even": la inflación mensual a partir de la
 * cual financiar pasa a convenir. Si tu expectativa de inflación es MÁS alta
 * que ese punto, las cuotas te convienen; si es más baja, el contado.
 *
 * No es asesoramiento financiero — es una cuenta simple con la inflación
 * ESTIMADA por el usuario, no una predicción real.
 */

import { round2 } from './money'

export { round2 }

export interface FinancingOptionInput {
  id: string
  /** Cantidad de cuotas (>= 1). */
  installmentsCount: number
  /** Monto nominal fijo de cada cuota (en pesos). */
  installmentAmount: number
}

export interface InstallmentPurchaseSimulationInput {
  /** Precio de contado (lo que se paga hoy si no se financia). */
  cashPrice: number
  /** Inflación mensual estimada en % (ej. 6 → 6%). */
  monthlyInflationPercent: number
  options: FinancingOptionInput[]
}

export interface InstallmentPurchaseSimulationResult {
  id: string
  installmentsCount: number
  installmentAmount: number
  /** Suma nominal de las cuotas (lo que se paga en total). */
  totalNominal: number
  /** Costo real: valor presente de las cuotas descontadas por inflación. */
  presentValue: number
  /** cashPrice - presentValue (positivo = financiar conviene). */
  savingsVsCash: number
  recommendation: 'cuotas' | 'contado'
  /** Inflación mensual (%) a partir de la cual financiar conviene. */
  breakEvenInflationPercent: number
  /** La opción con mayor ahorro en valor presente de la simulación. */
  isBestOption: boolean
}

/**
 * Valor presente de una serie de N cuotas fijas, descontadas mes a mes con
 * la inflación mensual indicada. Con inflación 0% es el nominal exacto.
 */
export function computePresentValue(
  installmentAmount: number,
  installmentsCount: number,
  monthlyInflationPercent: number
): number {
  if (installmentsCount <= 0) return 0

  const rate = monthlyInflationPercent / 100
  let sum = 0
  for (let i = 1; i <= installmentsCount; i++) {
    sum += installmentAmount / Math.pow(1 + rate, i)
  }
  return round2(sum)
}

/**
 * Inflación mensual (%) a la que financiar y pagar contado dan lo mismo
 * (el valor presente de las cuotas iguala al precio de contado).
 *
 * - Si el nominal total ni siquiera supera al contado (cuotas sin interés
 *   o más baratas), financiar ya conviene desde 0% → devuelve 0.
 * - Si no se encuentra raíz (financiación tan cara que ni con inflación
 *   extrema empata), devuelve el límite superior usado, que la UI muestra
 *   como "nunca conviene financiar".
 */
export function computeBreakEvenInflationPercent(
  cashPrice: number,
  installmentAmount: number,
  installmentsCount: number
): number {
  if (installmentsCount <= 0 || cashPrice <= 0 || installmentAmount <= 0) return 0

  const totalNominal = installmentAmount * installmentsCount
  if (totalNominal <= cashPrice) return 0

  const presentValueAt = (rate: number) =>
    computePresentValue(installmentAmount, installmentsCount, rate) - cashPrice

  // presentValue(0) = totalNominal > cashPrice, y el valor presente decrece
  // de forma estrictamente monótona con la tasa → hay una única raíz.
  let lo = 0
  let hi = 1
  while (presentValueAt(hi) > 0 && hi < 100000) hi *= 2
  if (presentValueAt(hi) > 0) return hi

  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    if (presentValueAt(mid) > 0) lo = mid
    else hi = mid
  }
  return round2((lo + hi) / 2)
}

/**
 * Arma una opción de financiación "sin interés": N cuotas iguales que suman
 * exactamente el precio de contado (reparte el redondeo de centavos en la
 * última cuota, como el resto de la app).
 */
export function buildInterestFreeOption(
  installmentsCount: number,
  cashPrice: number
): FinancingOptionInput {
  return {
    id: `sin-interes-${installmentsCount}`,
    installmentsCount,
    installmentAmount: installmentsCount > 0 ? round2(cashPrice / installmentsCount) : 0,
  }
}

/**
 * Simula todas las opciones de financiación contra el precio de contado.
 * Marca como mejor opción la de mayor ahorro en valor presente.
 */
export function simulateInstallmentPurchase(
  input: InstallmentPurchaseSimulationInput
): InstallmentPurchaseSimulationResult[] {
  const { cashPrice, monthlyInflationPercent, options } = input

  const results = options.map((option) => {
    const presentValue = computePresentValue(
      option.installmentAmount,
      option.installmentsCount,
      monthlyInflationPercent
    )
    const totalNominal = option.installmentAmount * option.installmentsCount
    const savingsVsCash = round2(cashPrice - presentValue)

    return {
      id: option.id,
      installmentsCount: option.installmentsCount,
      installmentAmount: option.installmentAmount,
      totalNominal,
      presentValue,
      savingsVsCash,
      recommendation: (savingsVsCash > 1e-6 ? 'cuotas' : 'contado') as 'cuotas' | 'contado',
      breakEvenInflationPercent: computeBreakEvenInflationPercent(
        cashPrice,
        option.installmentAmount,
        option.installmentsCount
      ),
      isBestOption: false,
    }
  })

  if (results.length > 0) {
    let bestIndex = 0
    for (let i = 1; i < results.length; i++) {
      if (results[i].savingsVsCash > results[bestIndex].savingsVsCash) bestIndex = i
    }
    results[bestIndex].isBestOption = true
  }

  return results
}
