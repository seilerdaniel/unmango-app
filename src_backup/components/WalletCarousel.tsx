'use client'

import { useWallets } from '@/context/WalletsContext'
import { usePrivacy } from '@/context/PrivacyContext'
import { WalletWithBalance } from '@/types'
import { Landmark, Banknote, Smartphone, CreditCard, WalletIcon } from 'lucide-react'
import { dailyYield, consolidatedDailyYield, consolidatedMonthlyYield } from '@/lib/walletYield'
import { convertArsToUsd } from '@/lib/exchangeRates'

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
  const { isPrivate, formatAmount, blueRate } = usePrivacy()
  const { wallets, loading } = useWallets()

  if (loading || wallets.length === 0) return null

  const totalDaily = consolidatedDailyYield(wallets)
  const totalMonthly = consolidatedMonthlyYield(wallets)

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
        Mis Billeteras
      </h3>

      {totalDaily > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400">
          <span className="text-xs font-bold">📈 Rendimiento estimado</span>
          {isPrivate ? (
            <span className="text-xs font-extrabold">••••••</span>
          ) : (
            <span className="text-xs font-extrabold">
              +{formatAmount(totalDaily)}/día · +{formatAmount(totalMonthly)}/mes
            </span>
          )}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {wallets.map((w) => {
          const Icon = walletIconFor(w.type)
          const yieldDaily = dailyYield(w.balance, w.tna_percentage ?? 0)
          const isUsd = w.currency === 'USD'
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
                {isUsd && (
                  <span className="ml-1 text-[9px] font-black text-emerald-600 dark:text-emerald-500 align-middle">
                    🇺🇸 USD
                  </span>
                )}
              </p>
              <p
                className={`text-sm font-extrabold mt-0.5 ${w.balance >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-rose-600'}`}
              >
                {isPrivate
                  ? '••••••'
                  : isUsd
                    ? formatAmount(convertArsToUsd(w.balance, blueRate), 'USD')
                    : formatAmount(w.balance)}
              </p>
              {!isPrivate && yieldDaily > 0 && (
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 mt-1">
                  📈 +{formatAmount(yieldDaily)}/día
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
