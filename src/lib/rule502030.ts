export type BudgetGroup = 'necesidad' | 'deseo' | 'ahorro'

export interface CategorySpend {
  categoryId: string
  spent: number
}

const RULE_PERCENTAGES: Record<BudgetGroup, number> = {
  necesidad: 0.5,
  deseo: 0.3,
  ahorro: 0.2,
}

export interface GroupBreakdown {
  spent: number
  target: number
  percentOfIncome: number
}

export interface Rule502030Result {
  necesidad: GroupBreakdown
  deseo: GroupBreakdown
  ahorro: GroupBreakdown
  unclassifiedSpend: number
  income: number
}

/**
 * Calcula cuánto se gastó en cada balde (necesidad/deseo/ahorro) del mes
 * y lo compara contra el objetivo 50/30/20 sobre el ingreso del mes.
 * Función pura — no toca Supabase, solo hace la cuenta.
 *
 * @param income - ingreso total del mes
 * @param categorySpends - gasto por categoría del mes (de get_monthly_category_spend)
 * @param categoryGroups - mapa category_id -> grupo asignado (o sin entrada si no está clasificada)
 */
export function computeRule502030(
  income: number,
  categorySpends: CategorySpend[],
  categoryGroups: Record<string, BudgetGroup | null | undefined>
): Rule502030Result {
  const spentByGroup: Record<BudgetGroup, number> = { necesidad: 0, deseo: 0, ahorro: 0 }
  let unclassifiedSpend = 0

  for (const { categoryId, spent } of categorySpends) {
    const group = categoryGroups[categoryId]
    if (group === 'necesidad' || group === 'deseo' || group === 'ahorro') {
      spentByGroup[group] += spent
    } else {
      unclassifiedSpend += spent
    }
  }

  const buildBreakdown = (group: BudgetGroup): GroupBreakdown => ({
    spent: spentByGroup[group],
    target: income * RULE_PERCENTAGES[group],
    percentOfIncome: income > 0 ? (spentByGroup[group] / income) * 100 : 0,
  })

  return {
    necesidad: buildBreakdown('necesidad'),
    deseo: buildBreakdown('deseo'),
    ahorro: buildBreakdown('ahorro'),
    unclassifiedSpend,
    income,
  }
}
