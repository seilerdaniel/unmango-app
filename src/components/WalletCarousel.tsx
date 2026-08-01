'use client'

import { useWallets } from '@/context/WalletsContext'
import { usePrivacy } from '@/context/PrivacyContext'
import { WalletWithBalance } from '@/types'
import { Landmark, Banknote, Smartphone, CreditCard, WalletIcon } from 'lucide-react'

function walletIconFor(type: WalletWithBalance['type']) {
  switch (type) {
    case 'bank':
      return Landmark
    case 'cash':
      return Banknote
    case 'virtual_wallet':
      return Smartphone
    case 'credit_card':
    case 'debit_card':
      return CreditCard
    default:
      return WalletIcon
  }
}

/**
 * Vista de solo lectura de los saldos, pensada para la pestaña Inicio
 * — desliza horizontal en vez de ocupar una columna entera. La gestión
 * completa (crear/editar/eliminar) sigue viviendo en Configuración
 * (WalletManager), esto es solo un vistazo rápido.
 */
export default function WalletCarousel() {
  const { isPrivate, formatAmount } = usePrivacy()
  const { wallets, loading } = useWallets()

  if (loading || wallets.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
        Mis Billeteras
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {wallets.map((w) => {
          const Icon = walletIconFor(w.type)
          return (
            <div
              key={w.id}
              className="shrink-0 w-40 snap-start bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                style={{ backgroundColor: `${w.color || '#6366f1'}18`, color: w.color || '#6366f1' }}
              >
                <Icon size={16} />
              </div>
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate" title={w.name}>
                {w.name}
              </p>
              <p
                className={`text-sm font-extrabold mt-0.5 ${w.balance >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-rose-600'}`}
              >
                {isPrivate ? '••••••' : formatAmount(w.balance)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
