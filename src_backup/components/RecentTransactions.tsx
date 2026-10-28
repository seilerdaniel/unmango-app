'use client'

import { Transaction } from '@/types'
import { usePrivacy } from '@/context/PrivacyContext'
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react'

interface RecentTransactionsProps {
  transactions: Transaction[]
  onSeeAll: () => void
  limit?: number
}

/**
 * Vista resumida de los últimos movimientos para la pestaña Inicio —
 * el historial completo con filtros vive en la pestaña Historial, esto
 * es solo un vistazo rápido de los últimos N (5 por defecto).
 */
export default function RecentTransactions({ transactions, onSeeAll, limit = 5 }: RecentTransactionsProps) {
  const { isPrivate, formatAmount } = usePrivacy()
  const recent = transactions.slice(0, limit)

  if (recent.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Clock size={16} className="text-gray-500" /> Últimos Movimientos
        </h3>
        <button
          onClick={onSeeAll}
          className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
        >
          Ver todo
        </button>
      </div>

      <div className="space-y-2">
        {recent.map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  item.type === 'income'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                }`}
              >
                {item.type === 'income' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              </div>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{item.description}</p>
            </div>
            <span
              className={`text-xs font-extrabold shrink-0 ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}
            >
              {isPrivate
                ? formatAmount(Number(item.amount_ars))
                : `${item.type === 'income' ? '+' : '-'} ${formatAmount(Number(item.amount_ars))}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
