export interface FinancialHealthInputs {
  monthlyIncome: number
  monthlyExpense: number
  monthlyDebtPayments: number
  emergencyFundBalance: number
  antExpensesTotal: number
}

export type HealthStatus = 'Excelente' | 'Saludable' | 'Atención' | 'En Riesgo'

export interface FinancialHealthDimension {
  label: string
  score: number
  description: string
}

export interface FinancialHealthResult {
  score: number
  status: HealthStatus
  dimensions: FinancialHealthDimension[]
  recommendations: string[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function hasNoFinancialData(monthlyIncome: number, monthlyExpense: number): boolean {
  return monthlyIncome === 0 && monthlyExpense === 0
}

function computeDimensionScores(
  monthlyIncome: number,
  monthlyExpense: number,
  monthlyDebtPayments: number,
  emergencyFundBalance: number,
): { debtScore: number; savingsScore: number; stabilityScore: number } {
  const debtRatio = monthlyIncome > 0 ? monthlyDebtPayments / monthlyIncome : 1
  const debtScore = clamp(100 - debtRatio * 100, 0, 100)

  const availableForSaving = monthlyIncome - monthlyDebtPayments
  const savingsRate =
    availableForSaving > 0 ? (availableForSaving - monthlyExpense) / availableForSaving : -1
  const savingsScore = clamp(savingsRate * 100, 0, 100)

  const budgetMargin = monthlyIncome - monthlyExpense - monthlyDebtPayments
  const emergencyMonths = monthlyExpense > 0 ? emergencyFundBalance / monthlyExpense : 0

  let stabilityScore: number
  if (budgetMargin <= 0) {
    stabilityScore = 0
  } else {
    const marginScore = clamp((budgetMargin / monthlyIncome) * 100, 0, 100)
    const emergencyScore = clamp((emergencyMonths / 6) * 100, 0, 100)
    stabilityScore = Math.round((marginScore + emergencyScore) / 2)
  }

  return { debtScore, savingsScore, stabilityScore }
}

function determineStatus(score: number): HealthStatus {
  if (score >= 80) return 'Excelente'
  if (score >= 60) return 'Saludable'
  if (score >= 40) return 'Atención'
  return 'En Riesgo'
}

function generateRecommendations(
  debtScore: number,
  savingsScore: number,
  stabilityScore: number,
): string[] {
  const recs: string[] = []

  if (debtScore < 50) {
    recs.push('Tus cuotas y gastos fijos comprometidos superan el 50% de tu ingreso. Reducí deudas o renegociá cuotas para mejorar tu endeudamiento.')
  } else if (debtScore < 80) {
    recs.push('Tenés un nivel de deuda moderado. Evitá sumar compromisos mensuales nuevos si no es necesario.')
  }

  if (savingsScore < 50) {
    recs.push('Tu capacidad de ahorro es baja. Revisá los gastos variables y intentá destinar al menos un 10% del ingreso disponible al ahorro.')
  } else if (savingsScore < 80) {
    recs.push('Podés mejorar tu capacidad de ahorro. Considerá crear una meta de ahorro automática para mes a mes.')
  }

  if (stabilityScore < 50) {
    recs.push('Tu margen presupuestario es ajustado. Armá un fondo de emergencia equivalente a al menos 3 meses de gastos para mayor tranquilidad.')
  } else if (stabilityScore < 80) {
    recs.push('Tu estabilidad presupuestaria es moderada. Seguí fortaleciendo el colchón de emergencia y revisá si hay gastos que puedan recortarse.')
  }

  if (recs.length === 0) {
    recs.push('¡Tu situación financiera es sólida en las 3 dimensiones! Mantenés los hábitos actuales.')
  }

  return recs
}

export function computeFinancialHealthScore(
  inputs: FinancialHealthInputs,
): FinancialHealthResult {
  const { monthlyIncome, monthlyExpense, monthlyDebtPayments, emergencyFundBalance } = inputs

  if (monthlyIncome <= 0) {
    return {
      score: 0,
      status: 'En Riesgo',
      dimensions: [
        { label: 'Endeudamiento', score: 0, description: 'Deuda vs ingreso' },
        { label: 'Capacidad de Ahorro', score: 0, description: 'Margen disponible para ahorrar' },
        { label: 'Estabilidad', score: 0, description: 'Margen presupuestario y fondo de emergencia' },
      ],
      recommendations: ['No hay ingresos registrados este mes. Cargá tu primer ingreso para obtener un puntaje real.'],
    }
  }

  const { debtScore, savingsScore, stabilityScore } = computeDimensionScores(
    monthlyIncome,
    monthlyExpense,
    monthlyDebtPayments,
    emergencyFundBalance,
  )

  const score = Math.round((debtScore + savingsScore + stabilityScore) / 3)
  const status = determineStatus(score)
  const recommendations = generateRecommendations(debtScore, savingsScore, stabilityScore)
  const dimensions: FinancialHealthDimension[] = [
    { label: 'Endeudamiento', score: debtScore, description: 'Deuda vs ingreso' },
    { label: 'Capacidad de Ahorro', score: savingsScore, description: 'Margen disponible para ahorrar' },
    { label: 'Estabilidad', score: stabilityScore, description: 'Margen presupuestario y fondo de emergencia' },
  ]

  return { score, status, dimensions, recommendations }
}