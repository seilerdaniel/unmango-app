'use client'

import { useMemo } from 'react'
import { useDashboardData } from '@/context/DashboardDataContext'
import { usePrivacy } from '@/context/PrivacyContext'
import { computeSafeToSpend } from '@/lib/safeToSpend'
import { monthlyEquivalentAmount } from '@/lib/recurringBilling'
import { Wallet as WalletIcon } from 'lucide-react'

export default function SafeToSpendWidget() {
  const { isPrivate, formatAmount } = usePrivacy()
  const { data, loading } = useDashboardData()

  const safeAmount = useMemo(() => {
    if (!data) return null

    const now = new Date()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    // +1 porque el día de hoy también cuenta como "día disponible para gastar".
    const daysRemaining = daysInMonth - dayOfMonth + 1

    const availableBalance = data.totalIncome - data.totalExpense

    // Mismo criterio que "Fijo Comprometido": solo ARS, prorrateando
    // las anuales a su equivalente mensual.
    const fixedCommitments = data.recurring
      .filter((r) => r.currency === 'ARS')
      .reduce((acc, r) => acc + monthlyEquivalentAmount(Number(r.amount), r.billing_frequency), 0)

    return computeSafeToSpend(availableBalance, fixedCommitments, daysRemaining)
  }, [data])

  if (loading || !data || safeAmount === null) return null

  return (
    <div id="safe-to-spend" className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <WalletIcon size={16} className="text-emerald-600" />
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Podés gastar hoy</h3>
      </div>
      <p className="text-2xl font-extrabold text-emerald-600">
        {isPrivate ? '••••••' : formatAmount(safeAmount)}
      </p>
      <p className="text-[10px] text-gray-400 mt-1">
        Sin salirte de tu presupuesto — ya descontamos tus gastos fijos comprometidos del mes.
      </p>
    </div>
  )
}
