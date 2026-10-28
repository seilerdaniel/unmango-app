export interface InstallmentScheduleItem {
  installmentNumber: number
  dueDate: Date
  amount: number
}

/**
 * Arma el plan de N cuotas fijas a partir de un monto total, repartiendo
 * el resto del redondeo en la ÚLTIMA cuota (para que la suma de todas
 * las cuotas dé exactamente el monto total, ni un centavo de más ni de
 * menos). Las fechas de vencimiento son mensuales a partir de la fecha
 * de la primera cuota.
 */
export function computeInstallmentSchedule(
  totalAmount: number,
  installmentsCount: number,
  firstInstallmentDate: Date
): InstallmentScheduleItem[] {
  if (installmentsCount <= 0) return []

  const baseAmount = Math.floor((totalAmount / installmentsCount) * 100) / 100
  const schedule: InstallmentScheduleItem[] = []
  let accumulated = 0

  for (let i = 1; i <= installmentsCount; i++) {
    const isLast = i === installmentsCount
    const amount = isLast ? Math.round((totalAmount - accumulated) * 100) / 100 : baseAmount
    accumulated += amount

    const dueDate = new Date(firstInstallmentDate)
    dueDate.setMonth(dueDate.getMonth() + (i - 1))

    schedule.push({ installmentNumber: i, dueDate, amount })
  }

  return schedule
}

/**
 * De un plan de cuotas ya armado, cuáles vencen en un año/mes dado.
 */
export function getInstallmentsDueInMonth(
  schedule: InstallmentScheduleItem[],
  year: number,
  month: number // 1-12
): InstallmentScheduleItem[] {
  return schedule.filter((item) => item.dueDate.getFullYear() === year && item.dueDate.getMonth() + 1 === month)
}
