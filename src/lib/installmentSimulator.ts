export type InstallmentVerdict = 'BUY_INSTALLMENTS' | 'BUY_CASH' | 'EQUIVALENT'

export interface InstallmentSimulatorParams {
  cashPrice: number
  installmentCount: number
  /** Monto nominal de cada cuota. Si no se pasa, se deriva de totalInstallmentPrice. */
  installmentAmount?: number
  /** Precio total financiado (suma de todas las cuotas). Si no se pasa, se deriva de installmentAmount. */
  totalInstallmentPrice?: number
  /** Inflación mensual estimada en % (0-100). */
  monthlyInflationRate: number
  /** TNA (en %) que rendiría el efectivo si no se gasta hoy. Opcional. */
  investmentTna?: number
}

export interface MonthlyBreakdownRow {
  installmentNumber: number
  /** Cuota nominal (sin descuento). */
  nominalAmount: number
  /** Factor de descuento compuesto aplicado a la cuota. */
  discountFactor: number
  /** Costo real de la cuota en poder de compra de hoy. */
  presentValue: number
  /** Suma acumulada de valores presentes hasta esta cuota. */
  cumulativePresentValue: number
}

export interface InstallmentSimulatorResult {
  cashPrice: number
  installmentCount: number
  installmentAmount: number
  totalInstallmentPrice: number
  /** Tasa de descuento mensual compuesta (inflación × retorno de inversión). */
  monthlyDiscountRate: number
  presentValueFinanced: number
  /** Recargo nominal: total financiado − contado. */
  nominalSurcharge: number
  nominalSurchargePercent: number
  /** Recargo real a valor de hoy: valor presente financiado − contado. */
  realSurcharge: number
  realSurchargePercent: number
  verdict: InstallmentVerdict
  monthlyBreakdown: MonthlyBreakdownRow[]
}

const round2 = (value: number) => Math.round(value * 100) / 100
const round4 = (value: number) => Math.round(value * 10000) / 10000

/**
 * Simula una compra en cuotas frente al pago de contado, midiendo el costo
 * REAL en poder de compra de HOY: cada cuota futura se descuenta por la
 * inflación mensual estimada (compuesta) y, si se pasa una TNA de inversión,
 * también por el retorno que habría dado ese efectivo (costo de oportunidad).
 *
 * - Si el valor presente financiado es menor al contado → conviene en cuotas.
 * - Si es mayor → conviene pagar de contado.
 * - Si es igual (dentro de 1 centavo) → es equivalente.
 *
 * No es asesoramiento financiero — es una cuenta simple con una inflación y
 * una TNA ESTIMADAS por el usuario, no una predicción real.
 */
export function simulateInstallmentPurchase(params: InstallmentSimulatorParams): InstallmentSimulatorResult {
  const {
    cashPrice,
    installmentCount,
    installmentAmount: rawInstallmentAmount,
    totalInstallmentPrice: rawTotalInstallmentPrice,
    monthlyInflationRate,
    investmentTna,
  } = params

  const inflationRate = monthlyInflationRate / 100
  const investmentMonthlyRate = investmentTna ? investmentTna / 100 / 12 : 0
  const monthlyDiscountRate = (1 + inflationRate) * (1 + investmentMonthlyRate) - 1

  const totalInstallmentPrice =
    rawTotalInstallmentPrice !== undefined
      ? rawTotalInstallmentPrice
      : rawInstallmentAmount !== undefined
        ? rawInstallmentAmount * installmentCount
        : cashPrice

  const installmentAmount = rawInstallmentAmount ?? totalInstallmentPrice / Math.max(installmentCount, 1)

  let presentValueFinanced = 0
  const monthlyBreakdown: MonthlyBreakdownRow[] = []

  for (let i = 1; i <= installmentCount; i++) {
    const nominalAmount = round2(installmentAmount)
    const discountFactor = Math.pow(1 + monthlyDiscountRate, -i)
    const presentValue = round2(nominalAmount * discountFactor)
    presentValueFinanced = round2(presentValueFinanced + presentValue)

    monthlyBreakdown.push({
      installmentNumber: i,
      nominalAmount,
      discountFactor: round4(discountFactor),
      presentValue,
      cumulativePresentValue: presentValueFinanced,
    })
  }

  const nominalSurcharge = round2(totalInstallmentPrice - cashPrice)
  const nominalSurchargePercent = cashPrice > 0 ? round2((nominalSurcharge / cashPrice) * 100) : 0
  const realSurcharge = round2(presentValueFinanced - cashPrice)
  const realSurchargePercent = cashPrice > 0 ? round2((realSurcharge / cashPrice) * 100) : 0

  const tolerance = 0.01
  const verdict: InstallmentVerdict =
    presentValueFinanced < cashPrice - tolerance
      ? 'BUY_INSTALLMENTS'
      : presentValueFinanced > cashPrice + tolerance
        ? 'BUY_CASH'
        : 'EQUIVALENT'

  return {
    cashPrice,
    installmentCount,
    installmentAmount: round2(installmentAmount),
    totalInstallmentPrice: round2(totalInstallmentPrice),
    monthlyDiscountRate: round4(monthlyDiscountRate),
    presentValueFinanced,
    nominalSurcharge,
    nominalSurchargePercent,
    realSurcharge,
    realSurchargePercent,
    verdict,
    monthlyBreakdown,
  }
}
