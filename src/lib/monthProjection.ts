export interface MonthProjectionInput {
  /** Gasto variable acumulado hasta hoy (sin contar gastos fijos/recurrentes) */
  variableSpendSoFar: number
  /** Total de gastos fijos activos del mes (RecurringManager) */
  fixedMonthlyCosts: number
  /** Ingreso del mes hasta ahora (o el ingreso esperado del mes, lo que tengas) */
  monthlyIncome: number
  /** Día de hoy dentro del mes (1-31) */
  dayOfMonth: number
  /** Cantidad de días que tiene el mes en curso */
  daysInMonth: number
}

export interface MonthProjectionResult {
  averageDailyVariableSpend: number
  projectedVariableSpend: number
  projectedTotalExpense: number
  projectedBalance: number
}

/**
 * Proyecta cómo vas a cerrar el mes: toma el promedio diario de gasto
 * variable hasta hoy, lo extrapola a los días que quedan, y le suma los
 * gastos fijos (que asumimos se pagan completos, hayan vencido o no
 * todavía). Función pura para poder testearla sin tocar la base.
 */
export function projectMonthEnd(input: MonthProjectionInput): MonthProjectionResult {
  const { variableSpendSoFar, fixedMonthlyCosts, monthlyIncome, dayOfMonth, daysInMonth } = input

  const averageDailyVariableSpend = dayOfMonth > 0 ? variableSpendSoFar / dayOfMonth : 0
  const projectedVariableSpend = averageDailyVariableSpend * daysInMonth
  const projectedTotalExpense = projectedVariableSpend + fixedMonthlyCosts
  const projectedBalance = monthlyIncome - projectedTotalExpense

  return {
    averageDailyVariableSpend,
    projectedVariableSpend,
    projectedTotalExpense,
    projectedBalance,
  }
}
