export interface HoursOfWorkResult {
  hours: number
  workDays: number // jornadas de 8hs equivalentes
}

/**
 * Traduce un monto a cuántas horas de trabajo representa, dado el
 * ingreso mensual y las horas trabajadas por mes de la persona (su
 * "valor hora"). También lo expresa en jornadas de 8 horas, que suele
 * ser más intuitivo que un número grande de horas sueltas.
 */
export function computeHoursOfWork(amount: number, monthlyIncome: number, monthlyWorkHours: number): HoursOfWorkResult | null {
  if (!(monthlyIncome > 0) || !(monthlyWorkHours > 0) || !(amount > 0)) return null

  const hourlyWage = monthlyIncome / monthlyWorkHours
  const hours = amount / hourlyWage

  return {
    hours,
    workDays: hours / 8,
  }
}
