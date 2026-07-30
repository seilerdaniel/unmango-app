export interface SuggestedBudget {
  categoryName: string
  percentOfIncome: number
}

/**
 * Porcentajes de ejemplo (criterio general de finanzas personales, no
 * una recomendación financiera específica) para las primeras
 * categorías del usuario que todavía no tengan un presupuesto
 * asignado. Son solo un punto de partida editable, igual que las
 * categorías/metas sugeridas.
 */
const SUGGESTED_PERCENTAGES = [0.15, 0.1, 0.08]

export interface CategoryForSuggestion {
  id: string
  name: string
}

export interface SuggestedBudgetWithAmount extends SuggestedBudget {
  categoryId: string
  suggestedAmount: number
}

/**
 * Arma hasta 3 sugerencias de presupuesto para las categorías del
 * usuario que todavía no tienen un límite asignado, como % de su
 * ingreso mensual. Devuelve un array vacío si no hay ingreso registrado
 * o no hay categorías sin presupuesto — en ambos casos, no tiene
 * sentido mostrar sugerencias.
 */
export function suggestBudgets(
  monthlyIncome: number,
  categoriesWithoutBudget: CategoryForSuggestion[]
): SuggestedBudgetWithAmount[] {
  if (monthlyIncome <= 0 || categoriesWithoutBudget.length === 0) return []

  return categoriesWithoutBudget.slice(0, 3).map((category, index) => {
    const percent = SUGGESTED_PERCENTAGES[index] ?? SUGGESTED_PERCENTAGES[SUGGESTED_PERCENTAGES.length - 1]
    return {
      categoryId: category.id,
      categoryName: category.name,
      percentOfIncome: percent,
      suggestedAmount: Math.round(monthlyIncome * percent),
    }
  })
}
