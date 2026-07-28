'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePrivacy } from '@/context/PrivacyContext'
import { projectMonthEnd } from '@/lib/monthProjection'
import { TrendingUp } from 'lucide-react'

export default function MonthEndProjection() {
  const { isPrivate, formatAmount } = usePrivacy()
  const [loading, setLoading] = useState(true)
  const [projection, setProjection] = useState<ReturnType<typeof projectMonthEnd> | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const now = new Date()
        const dayOfMonth = now.getDate()
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        const [trendResult, expensesResult, recurringResult] = await Promise.all([
          supabase.rpc('get_monthly_trend', { p_months: 1 }),
          supabase
            .from('transactions')
            .select('description, amount_ars')
            .eq('user_id', user.id)
            .eq('type', 'expense')
            .gte('created_at', monthStart),
          supabase.from('recurring_expenses').select('amount, currency').eq('user_id', user.id).eq('is_active', true),
        ])

        if (trendResult.error) throw trendResult.error
        if (expensesResult.error) throw expensesResult.error
        if (recurringResult.error) throw recurringResult.error

        const monthlyIncome = Number(trendResult.data?.[0]?.total_income) || 0

        // Separamos lo que ya vino de "Pagar" una suscripción (fijo,
        // usa el mismo prefijo que arma RecurringManager) del resto
        // (variable).
        const variableSpendSoFar = (expensesResult.data ?? [])
          .filter((t) => !t.description?.startsWith('[Suscripción]'))
          .reduce((acc, t) => acc + Number(t.amount_ars), 0)

        // Mismo criterio que "Fijo Comprometido" en Suscripciones: solo
        // ARS, para no depender de una cotización USD acá.
        const fixedMonthlyCosts = (recurringResult.data ?? [])
          .filter((r) => r.currency === 'ARS')
          .reduce((acc, r) => acc + Number(r.amount), 0)

        setProjection(
          projectMonthEnd({ variableSpendSoFar, fixedMonthlyCosts, monthlyIncome, dayOfMonth, daysInMonth })
        )
      } catch (err) {
        console.error('Error calculando la proyección de fin de mes:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading || !projection) return null

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
