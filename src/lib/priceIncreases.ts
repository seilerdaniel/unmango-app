export interface PriceChange {
  recurringExpenseId: string
  currentAmount: number
  previousAmount: number | null
  currency: string
}

export interface PriceIncrease extends PriceChange {
  increasePercent: number
}

/**
 * Filtra los cambios de precio que son efectivamente AUMENTOS (no
 * bajas, no primeras cargas sin historial previo) y calcula el % de
 * incremento. Función pura, separada del fetch a Supabase para poder
 * testearla.
 */
export function detectPriceIncreases(changes: PriceChange[]): PriceIncrease[] {
  return changes
    .filter((c) => c.previousAmount !== null && c.currentAmount > c.previousAmount)
    .map((c) => ({
      ...c,
      increasePercent: ((c.currentAmount - (c.previousAmount as number)) / (c.previousAmount as number)) * 100,
    }))
}
