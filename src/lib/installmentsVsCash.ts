export interface InstallmentsVsCashResult {
  presentValueFinanced: number
  totalFinanced: number
  savingsAmount: number
  recommendation: 'contado' | 'cuotas'
}

import { round2 } from './money'

/**
 * Compara pagar al contado vs. financiar en cuotas fijas, considerando
 * la inflación mensual estimada.
 *
 * La idea: cada cuota futura, medida en el poder de compra de HOY, vale
 * menos que su valor nominal (por la inflación) — se descuenta cada
 * cuota al valor presente y se suman. Si esa suma (el costo REAL de
 * financiar) es menor al precio de contado, conviene financiar; si es
 * mayor, conviene pagar de una.
 *
 * No es asesoramiento financiero — es una cuenta simple con una tasa de
 * inflación ESTIMADA por el usuario, no una predicción real.
 */
export function compareInstallmentsVsCash(
  cashPrice: number,
  installmentAmount: number,
  installmentsCount: number,
  monthlyInflationPercent: number
): InstallmentsVsCashResult {
  const rate = monthlyInflationPercent / 100
  let presentValueFinanced = 0

  for (let i = 1; i <= installmentsCount; i++) {
    presentValueFinanced += installmentAmount / Math.pow(1 + rate, i)
  }
  presentValueFinanced = round2(presentValueFinanced)

  const totalFinanced = round2(installmentAmount * installmentsCount)
  const savingsAmount = round2(cashPrice - presentValueFinanced)

  return {
    presentValueFinanced,
    totalFinanced,
    savingsAmount,
    recommendation: savingsAmount > 0 ? 'cuotas' : 'contado',
  }
}
