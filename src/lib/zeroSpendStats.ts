/**
 * Lógica pura para el "Día Cero Gastos": cuenta cuántos días del mes en
 * curso (hasta hoy inclusive) no tuvieron ningún gasto registrado, y la
 * racha actual de días consecutivos sin gastos contando hacia atrás
 * desde hoy.
 *
 * Recibe solo las FECHAS (día del mes) en las que sí hubo al menos un
 * gasto — no hace falta traer las transacciones completas para esto,
 * alcanza con una query liviana tipo
 * `select created_at from transactions where type='expense' and
 * created_at >= inicio_de_mes`. Ver ZeroSpendStreak.tsx.
 */

export interface ZeroSpendStats {
  daysElapsed: number
  zeroSpendDays: number
  currentStreak: number
}

/**
 * @param expenseDayNumbers - días del mes (1-31) en los que hubo al menos un gasto
 * @param today - fecha de "hoy" (inyectable para poder testear)
 */
export function computeZeroSpendStats(
  expenseDayNumbers: number[],
  today: Date = new Date()
): ZeroSpendStats {
  const todayDayOfMonth = today.getDate()
  const expenseDaysSet = new Set(expenseDayNumbers)

  let zeroSpendDays = 0
  for (let day = 1; day <= todayDayOfMonth; day++) {
    if (!expenseDaysSet.has(day)) zeroSpendDays++
  }

  // Racha actual: contamos hacia atrás desde hoy mientras no haya gasto.
  let currentStreak = 0
  for (let day = todayDayOfMonth; day >= 1; day--) {
    if (expenseDaysSet.has(day)) break
    currentStreak++
  }

  return {
    daysElapsed: todayDayOfMonth,
    zeroSpendDays,
    currentStreak,
  }
}

/**
 * Si HOY hubo un gasto (se "rompió" la racha de días sin gastar),
 * devuelve cuántos días consecutivos sin gastar había antes de hoy.
 * Devuelve null si hoy no hubo gasto (no se rompió nada) o si no había
 * ninguna racha previa que romper (0 días antes de hoy). Pensado para
 * un mensaje motivacional tipo "veías 5 días sin gastos y hoy se
 * cortó" — no para alarmar, solo para dar ánimo de retomarla.
 */
export function computeStreakBreak(expenseDayNumbers: number[], today: Date = new Date()): number | null {
  const todayDayOfMonth = today.getDate()
  const expenseDaysSet = new Set(expenseDayNumbers)

  if (!expenseDaysSet.has(todayDayOfMonth)) return null

  let streakBeforeToday = 0
  for (let day = todayDayOfMonth - 1; day >= 1; day--) {
    if (expenseDaysSet.has(day)) break
    streakBeforeToday++
  }
  return streakBeforeToday > 0 ? streakBeforeToday : null
}
