export interface SuggestedGoal {
  name: string
  targetAmount: number
  monthlyContribution: number
  color: string
}

/**
 * Metas de ahorro de ejemplo para ofrecer cuando el usuario todavía no
 * cargó ninguna — mismo criterio que las categorías sugeridas: montos
 * de partida razonables, pensados para editarse antes de crear la
 * meta, no para usarse literal.
 */
export const SUGGESTED_GOALS: SuggestedGoal[] = [
  { name: 'Fondo de Emergencia', targetAmount: 300000, monthlyContribution: 20000, color: '#10b981' },
  { name: 'Vacaciones', targetAmount: 500000, monthlyContribution: 30000, color: '#f59e0b' },
  { name: 'Auto/Moto', targetAmount: 2000000, monthlyContribution: 50000, color: '#6366f1' },
]
