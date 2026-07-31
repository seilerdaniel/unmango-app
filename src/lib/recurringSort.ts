import { RecurringExpense } from '@/types'
import { daysUntilNextBilling } from './recurringBilling'

export type RecurringSortField = 'name' | 'amount' | 'nextDue'

/**
 * Ordena Pagos Recurrentes por nombre, monto o próximo vencimiento.
 * Función pura, no muta el array original.
 */
export function sortRecurringExpenses(
  items: RecurringExpense[],
  field: RecurringSortField,
  ascending: boolean,
  today: Date = new Date()
): RecurringExpense[] {
  const sorted = [...items].sort((a, b) => {
    let comparison = 0
    if (field === 'name') {
      comparison = a.title.localeCompare(b.title, 'es')
    } else if (field === 'amount') {
      comparison = Number(a.amount) - Number(b.amount)
    } else {
      comparison =
        daysUntilNextBilling(a.billing_day, a.billing_frequency, a.billing_month, today) -
        daysUntilNextBilling(b.billing_day, b.billing_frequency, b.billing_month, today)
    }
    return ascending ? comparison : -comparison
  })
  return sorted
}

/** 'all' (o cualquier valor no reconocido) devuelve la lista sin filtrar. */
export function filterRecurringByKind(items: RecurringExpense[], kind: string): RecurringExpense[] {
  if (kind === 'all') return items
  return items.filter((i) => i.expense_kind === kind)
}
