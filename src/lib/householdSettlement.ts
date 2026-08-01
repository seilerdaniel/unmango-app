export interface HouseholdSettlement {
  /** Cuánto hay que transferir para quedar a mano. 0 = están a mano. */
  amount: number
  /** true si yo le debo a la pareja (pagué menos de la mitad). */
  iOwe: boolean
  /** true si la pareja me debe a mí (pagué más de la mitad). */
  iAmOwed: boolean
  /** Descripción para el movimiento de quien transfiere (gasto). */
  debtorDescription: string
  /** Descripción para el movimiento de quien recibe (ingreso). */
  creditorDescription: string
}

export const HOUSEHOLD_DEBTOR_DESCRIPTION = 'Liquidación hogar — pago a pareja'
export const HOUSEHOLD_CREDITOR_DESCRIPTION = 'Liquidación hogar — cobro de pareja'

/**
 * Convierte el balance de hogar en la dirección de la liquidación: si
 * uno pagó más de la mitad, la otra persona le transfiere exactamente
 * |netBalanceForMe| y quedan a mano. Es la contraparte "cuánto y en qué
 * sentido" de computeHouseholdBalance; función pura para testear sin
 * tocar la base.
 */
export function computeHouseholdSettlement(totalPaidByMe: number, totalPaidByPartner: number): HouseholdSettlement {
  const net = totalPaidByMe - (totalPaidByMe + totalPaidByPartner) / 2
  const amount = Math.abs(net)

  if (net === 0) {
    return {
      amount: 0,
      iOwe: false,
      iAmOwed: false,
      debtorDescription: HOUSEHOLD_DEBTOR_DESCRIPTION,
      creditorDescription: HOUSEHOLD_CREDITOR_DESCRIPTION,
    }
  }

  const iOwe = net < 0
  return {
    amount,
    iOwe,
    iAmOwed: !iOwe,
    debtorDescription: HOUSEHOLD_DEBTOR_DESCRIPTION,
    creditorDescription: HOUSEHOLD_CREDITOR_DESCRIPTION,
  }
}
