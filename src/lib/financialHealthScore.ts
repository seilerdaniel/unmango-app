export interface FinancialHealthInputs {
  monthlyIncome: number
  monthlyExpense: number
  /** Suma de cuotas, deudas y gastos fijos comprometidos del mes. */
  monthlyDebtPayments: number
  /** Plata "de colchón" disponible — se usa el total en billeteras. */
  emergencyFundBalance: number
  /** Total gastado del mes en compras chicas (gastos hormiga). */
  antExpensesTotal: number
}

export interface FinancialHealthPillar {
  label: string
  score: number
}

export interface FinancialHealthResult {
  totalScore: number
  pillars: {
    savings: FinancialHealthPillar
    debt: FinancialHealthPillar
    emergencyFund: FinancialHealthPillar
    antExpenses: FinancialHealthPillar
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * "Un Mango Score": puntaje de 0 a 100 basado en 4 pilares (25% cada
 * uno). No es un puntaje crediticio ni un dictamen financiero — es una
 * forma simple y visual de ver la salud financiera del mes, pensada
 * para dar una meta clara que mejorar, no un juicio de valor.
 *
 * - Ahorro: qué % del ingreso quedó sin gastar.
 * - Deuda: qué % del ingreso se va en cuotas/deudas/gastos fijos.
 * - Fondo de emergencia: cuántos meses de gastos cubre lo que tenés
 *   ahorrado/disponible.
 * - Gasto hormiga: qué % del ingreso se fue en compras chicas.
 */
export function computeFinancialHealthScore(inputs: FinancialHealthInputs): FinancialHealthResult {
  const { monthlyIncome, monthlyExpense, monthlyDebtPayments, emergencyFundBalance, antExpensesTotal } = inputs

  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0
  const savingsScore = clamp(savingsRate, 0, 100)

  const debtRatio = monthlyIncome > 0 ? (monthlyDebtPayments / monthlyIncome) * 100 : 100
  const debtScore = clamp(100 - debtRatio, 0, 100)

  const monthsCovered = monthlyExpense > 0 ? emergencyFundBalance / monthlyExpense : 0
  const emergencyFundScore = clamp((monthsCovered / 6) * 100, 0, 100)

  const antRatio = monthlyIncome > 0 ? (antExpensesTotal / monthlyIncome) * 100 : 0
  const antExpensesScore = clamp(100 - antRatio * 5, 0, 100)

  const totalScore = Math.round((savingsScore + debtScore + emergencyFundScore + antExpensesScore) / 4)

  return {
    totalScore,
    pillars: {
      savings: { label: 'Ahorro', score: Math.round(savingsScore) },
      debt: { label: 'Deuda', score: Math.round(debtScore) },
      emergencyFund: { label: 'Fondo de Emergencia', score: Math.round(emergencyFundScore) },
      antExpenses: { label: 'Gasto Hormiga', score: Math.round(antExpensesScore) },
    },
  }
}
