import { Debt } from '@/types'

export type DebtSortField = 'name' | 'amount' | 'dueDate'

/**
 * Ordena Deudas y Préstamos por descripción, monto restante o fecha de
 * vencimiento. Las que no tienen fecha de vencimiento (es opcional) van
 * siempre al final, sin importar el sentido del orden. Función pura.
 */
export function sortDebts(items: Debt[], field: DebtSortField, ascending: boolean): Debt[] {
  const sorted = [...items].sort((a, b) => {
    let comparison = 0
    if (field === 'name') {
      comparison = a.description.localeCompare(b.description, 'es')
    } else if (field === 'amount') {
      comparison = Number(a.remaining_amount) - Number(b.remaining_amount)
    } else {
      if (!a.due_date && !b.due_date) comparison = 0
      else if (!a.due_date) return 1
      else if (!b.due_date) return -1
      else comparison = a.due_date.localeCompare(b.due_date)
    }
    return ascending ? comparison : -comparison
  })
  return sorted
}

/** 'all' (o cualquier valor no reconocido) devuelve la lista sin filtrar. */
export function filterDebtsByType(items: Debt[], type: string): Debt[] {
  if (type === 'all') return items
  return items.filter((d) => d.debt_type === type)
}
