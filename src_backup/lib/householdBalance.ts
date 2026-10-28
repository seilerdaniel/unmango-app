export interface HouseholdBalance {
  /** Positivo: la otra persona te debe esto. Negativo: vos le debés esto a la otra persona. */
  netBalanceForMe: number
  totalPaidByMe: number
  totalPaidByPartner: number
  totalHouseholdExpenses: number
}

/**
 * Calcula el balance de gastos de hogar entre dos personas: cada una
 * debería haber puesto la mitad del total. Si pagaste más de la mitad,
 * la otra persona te debe la diferencia; si pagaste menos, se la debés
 * vos. Función pura para poder testearla sin tocar la base.
 */
export function computeHouseholdBalance(totalPaidByMe: number, totalPaidByPartner: number): HouseholdBalance {
  const totalHouseholdExpenses = totalPaidByMe + totalPaidByPartner
  const fairShare = totalHouseholdExpenses / 2
  const netBalanceForMe = totalPaidByMe - fairShare

  return {
    netBalanceForMe,
    totalPaidByMe,
    totalPaidByPartner,
    totalHouseholdExpenses,
  }
}
