import { WalletWithBalance } from '@/types'

export type WalletSortField = 'name' | 'balance' | 'type'

const WALLET_TYPE_LABELS: Record<string, string> = {
  bank: 'Banco',
  cash: 'Efectivo',
  virtual_wallet: 'Billetera Virtual',
  credit_card: 'Tarjeta de Crédito',
  debit_card: 'Tarjeta de Débito',
}

/**
 * Ordena una lista de billeteras por nombre, saldo o tipo. Función
 * pura (no muta el array original) para poder testearla sin
 * necesidad de renderizar nada.
 */
export function sortWallets(wallets: WalletWithBalance[], field: WalletSortField, ascending: boolean): WalletWithBalance[] {
  const sorted = [...wallets].sort((a, b) => {
    let comparison = 0
    if (field === 'name') {
      comparison = a.name.localeCompare(b.name, 'es')
    } else if (field === 'balance') {
      comparison = a.balance - b.balance
    } else {
      const labelA = WALLET_TYPE_LABELS[a.type] ?? a.type
      const labelB = WALLET_TYPE_LABELS[b.type] ?? b.type
      comparison = labelA.localeCompare(labelB, 'es')
    }
    return ascending ? comparison : -comparison
  })
  return sorted
}

/**
 * Filtra por tipo de billetera — 'all' (o cualquier valor no
 * reconocido) devuelve la lista completa sin filtrar.
 */
export function filterWalletsByType(wallets: WalletWithBalance[], type: string): WalletWithBalance[] {
  if (type === 'all') return wallets
  return wallets.filter((w) => w.type === type)
}
