const STALLED_THRESHOLD_DAYS = 60

/**
 * Una meta se considera "estancada" si sigue en $0 después de un buen
 * tiempo de haberla creado (60+ días por defecto). No hay una columna
 * de "última vez que se le sumó algo" en savings_goals (no se trackea
 * un historial de aportes) — se usa `created_at` como aproximación: si
 * pasaron 60+ días desde que se creó y sigue sin nada adentro, es
 * bastante seguro asumir que no se le sumó nada en ese tiempo.
 */
export function isGoalStalled(currentAmount: number, createdAt: string, today: Date = new Date()): boolean {
  if (currentAmount > 0) return false

  const created = new Date(createdAt)
  const daysSinceCreated = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
  return daysSinceCreated >= STALLED_THRESHOLD_DAYS
}
