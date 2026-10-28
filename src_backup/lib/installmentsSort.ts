import { InstallmentPurchase } from '@/types'

export type InstallmentSortField = 'name' | 'amount'

/**
 * Ordena Compras en Cuotas por descripción o monto total. No incluye
 * "cuotas restantes" como campo de orden porque eso depende de
 * cuántas ya se pagaron (installment_payments, en una tabla aparte) —
 * se evaluó agregarlo pero hubiera necesitado pasar un mapa extra de
 * afuera solo para esto; nombre y monto cubren el caso de uso principal
 * (encontrar la compra más cara, o una por nombre) sin esa complejidad.
 */
export function sortInstallmentPurchases<T extends InstallmentPurchase>(
  items: T[],
  field: InstallmentSortField,
  ascending: boolean
): T[] {
  const sorted = [...items].sort((a, b) => {
    const comparison =
      field === 'name'
        ? a.description.localeCompare(b.description, 'es')
        : Number(a.total_amount) - Number(b.total_amount)
    return ascending ? comparison : -comparison
  })
  return sorted
}
