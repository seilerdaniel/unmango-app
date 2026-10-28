'use client'

import { useMemo } from 'react'
import { useDashboardData } from '@/context/DashboardDataContext'
import { usePrivacy } from '@/context/PrivacyContext'
import { projectMonthEnd } from '@/lib/monthProjection'
import { monthlyEquivalentAmount } from '@/lib/recurringBilling'
import { applyTax } from '@/lib/applyTax'
import { TrendingUp } from 'lucide-react'

export default function MonthEndProjection() {
  const { isPrivate, formatAmount } = usePrivacy()
  const { data, loading } = useDashboardData()

  const projection = useMemo(() => {
    if (!data) return null

    const now = new Date()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    // Separamos lo que ya vino de "Pagar" una suscripción o un
    // servicio/alquiler (fijo, usa el mismo prefijo que arma
    // RecurringManager) del resto (variable).
    const variableSpendSoFar = data.monthExpenses
      .filter((t) => !t.description?.startsWith('[Suscripción]') && !t.description?.startsWith('[Servicio/Alquiler]'))
      .reduce((acc, t) => acc + Number(t.amount_ars), 0)

    // Mismo criterio que "Fijo Comprometido" en Suscripciones: solo
    // ARS (para no depender de una cotización USD acá), los anuales
    // se prorratean a su equivalente mensual e incluyen impuestos.
    const fixedMonthlyCosts = data.recurring
      .filter((r) => r.currency === 'ARS')
      .reduce(
        (acc, r) => acc + monthlyEquivalentAmount(applyTax(Number(r.amount), r.tax_percentage ?? 0), r.billing_frequency),
        0
      )

    return projectMonthEnd({ variableSpendSoFar, fixedMonthlyCosts, monthlyIncome: data.monthlyIncome, dayOfMonth, daysInMonth })
  }, [data])

  if (loading || !data || !projection) return null

  const isNegative = projection.projectedBalance < 0

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={16} className={isNegative ? 'text-rose-500' : 'text-emerald-600'} />
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Proyección a fin de mes</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        A este ritmo, vas a cerrar el mes con{' '}
        <span className={`font-extrabold ${isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
          {isPrivate ? '••••••' : formatAmount(projection.projectedBalance)}
        </span>{' '}
        disponibles.
      </p>
      <p className="text-[10px] text-gray-400 mt-1">
        Basado en tu gasto variable promedio diario + los gastos fijos activos del mes. No tiene en
        cuenta compras grandes puntuales que todavía no hiciste.
      </p>
    </div>
  )
}
