export interface AntExpense {
  amount: number
}

export interface AntExpensesResult {
  count: number
  total: number
  averageAmount: number
}

/**
 * "Gastos hormiga": consumos chicos y frecuentes que, sumados, pesan más
 * de lo que parece. Filtra los gastos por debajo de un umbral y agrega
 * el total. Función pura para poder testearla sin tocar la base.
 */
export function detectAntExpenses(expenses: AntExpense[], threshold: number): AntExpensesResult {
  const small = expenses.filter((e) => e.amount > 0 && e.amount < threshold)
  const total = small.reduce((acc, e) => acc + e.amount, 0)

  return {
    count: small.length,
    total,
    averageAmount: small.length > 0 ? total / small.length : 0,
  }
}
