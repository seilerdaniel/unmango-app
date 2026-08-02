'use client'

import { useMemo } from 'react'
import { useDashboardData } from '@/context/DashboardDataContext'
import { useWallets } from '@/context/WalletsContext'
import { usePrivacy } from '@/context/PrivacyContext'
import { computeSafeToSpend, getDaysRemainingInMonth, type SafeToSpendStatus } from '@/lib/safeToSpend'
import { monthlyEquivalentAmount } from '@/lib/recurringBilling'
import { applyTax } from '@/lib/applyTax'
import { ShieldCheck, ShieldAlert, ShieldX, Wallet as WalletIcon } from 'lucide-react'

const STATUS_UI: Record<
  SafeToSpendStatus,
  { label: string; icon: typeof ShieldCheck; accent: string; iconColor: string; badge: string }
> = {
  safe: {
    label: 'Seguro',
    icon: ShieldCheck,
    accent: 'text-emerald-600',
    iconColor: 'text-emerald-600',
    badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  },
  tight: {
    label: 'Ajustado',
    icon: ShieldAlert,
    accent: 'text-amber-500',
    iconColor: 'text-amber-500',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  },
  over: {
    label: 'Sobregastado',
    icon: ShieldX,
    accent: 'text-rose-500',
    iconColor: 'text-rose-500',
    badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
  },
}

export default function SafeToSpendWidget() {
  const { isPrivate, formatAmount } = usePrivacy()
  const { data, loading } = useDashboardData()
  const { totalBalance } = useWallets()

  const result = useMemo(() => {
    if (!data) return null

    const daysRemaining = getDaysRemainingInMonth(new Date())

    // Mismo criterio que "Fijo Comprometido": solo ARS, prorrateando
    // las anuales a su equivalente mensual e incluyendo impuestos.
    const monthlyFixedCommitments = data.recurring
      .filter((r) => r.currency === 'ARS')
      .reduce(
        (acc, r) => acc + monthlyEquivalentAmount(applyTax(Number(r.amount), r.tax_percentage ?? 0), r.billing_frequency),
        0
      )

    return computeSafeToSpend({
      totalBalance,
      monthlyFixedCommitments,
      budgetedAllocations: data.budgetAllocation,
      savingsContributions: data.savingsContribution,
      installmentCommitments: data.installmentCommitments,
      monthlyIncome: data.monthlyIncome,
      daysRemaining,
    })
  }, [data, totalBalance])

  if (loading || !data || !result) return null

  const { availableBalance, daysRemaining, dailyLimit, status } = result
  const ui = STATUS_UI[status]
  const StatusIcon = ui.icon

  return (
    <div
      id="safe-to-spend"
      className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <WalletIcon size={16} className="text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Podés gastar hoy</h3>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${ui.badge}`}>
          <StatusIcon size={11} />
          {ui.label}
        </span>
      </div>

      <p className={`text-3xl font-extrabold ${ui.accent}`}>
        {isPrivate ? '••••••' : formatAmount(dailyLimit)}
      </p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
        {status === 'over'
          ? 'Tus compromisos del mes ya superan el balance disponible.'
          : `Por día, durante los ${daysRemaining} días que quedan del mes.`}
      </p>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-500 dark:text-gray-400">Disponible en billeteras</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            {isPrivate ? '••••••' : formatAmount(totalBalance)}
          </span>
        </div>

        {[
          {
            label: 'Gastos fijos del mes',
            value: data.recurring.reduce(
              (acc, r) =>
                acc +
                (r.currency === 'ARS' ? monthlyEquivalentAmount(applyTax(Number(r.amount), r.tax_percentage ?? 0), r.billing_frequency) : 0),
              0
            ),
          },
          { label: 'Presupuestos asignados', value: data.budgetAllocation },
          { label: 'Metas de ahorro', value: data.savingsContribution },
          { label: 'Cuotas del mes', value: data.installmentCommitments },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500 dark:text-gray-400">{row.label}</span>
            <span className="font-semibold text-rose-500">
              -{isPrivate ? '••••••' : formatAmount(row.value)}
            </span>
          </div>
        ))}

        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-100 dark:border-gray-800">
          <span className="text-gray-500 dark:text-gray-400">Queda disponible</span>
          <span className={`font-bold ${availableBalance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {isPrivate ? '••••••' : formatAmount(availableBalance)}
          </span>
        </div>
      </div>
    </div>
  )
}
