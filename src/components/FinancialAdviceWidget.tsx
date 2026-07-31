'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { computeFinancialHealthScore } from '@/lib/financialHealthScore'
import { generateFinancialAdvice, AdviceItem } from '@/lib/financialAdvice'
import { detectAntExpenses } from '@/lib/antExpenses'
import { detectPriceIncreases } from '@/lib/priceIncreases'
import { monthlyEquivalentAmount } from '@/lib/recurringBilling'
import { computeSafeToSpend } from '@/lib/safeToSpend'
import { Lightbulb, AlertTriangle, CheckCircle2, Info, AlertCircle, ArrowRight } from 'lucide-react'
import { TabId } from '@/components/nav/BottomNav'

const ANT_THRESHOLD_STORAGE_KEY = 'unmango_ant_expense_threshold'
const DEFAULT_ANT_THRESHOLD = 3000

const SEVERITY_STYLES: Record<AdviceItem['severity'], { icon: typeof Lightbulb; className: string }> = {
  danger: { icon: AlertCircle, className: 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300' },
  warning: { icon: AlertTriangle, className: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300' },
  success: { icon: CheckCircle2, className: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300' },
  info: { icon: Info, className: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-300' },
}

/**
 * Consejos en texto conectando los mismos 4 pilares del Un Mango Score
 * (que solo muestra números/barras) con reglas simples — no es IA, es
 * un conjunto de umbrales sobre datos que la app ya calcula en otro
 * lado, reutilizados acá para que los consejos no contradigan lo que
 * ya se ve en el Score.
 */
export default function FinancialAdviceWidget({ onNavigate }: { onNavigate: (tab: TabId, sectionId?: string) => void }) {
  const [advice, setAdvice] = useState<AdviceItem[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const dayOfMonth = now.getDate()
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        const daysRemaining = daysInMonth - dayOfMonth + 1

        const [trendResult, expensesResult, recurringResult, installmentsResult, walletsResult, priceChangesResult] =
          await Promise.all([
            supabase.rpc('get_monthly_trend', { p_months: 1 }),
            supabase
              .from('transactions')
              .select('amount_ars')
              .eq('user_id', user.id)
              .eq('type', 'expense')
              .gte('created_at', monthStart),
            supabase
              .from('recurring_expenses')
              .select('amount, currency, billing_frequency')
              .eq('user_id', user.id)
              .eq('is_active', true),
            supabase.from('installment_purchases').select('total_amount, installments_count'),
            supabase.rpc('get_wallet_balances'),
            supabase.rpc('get_recurring_price_changes'),
          ])

        const monthlyIncome = Number(trendResult.data?.[0]?.total_income) || 0
        const monthlyExpense = Number(trendResult.data?.[0]?.total_expense) || 0

        const fixedCommitments = (recurringResult.data ?? [])
          .filter((r) => r.currency === 'ARS')
          .reduce((acc, r) => acc + monthlyEquivalentAmount(Number(r.amount), r.billing_frequency), 0)

        const installmentsMonthlyObligation = (installmentsResult.data ?? []).reduce(
          (acc, p) => acc + Number(p.total_amount) / p.installments_count,
          0
        )

        const emergencyFundBalance = (walletsResult.data ?? []).reduce((acc, w) => acc + (Number(w.balance) || 0), 0)

        const savedThreshold = typeof window !== 'undefined' ? localStorage.getItem(ANT_THRESHOLD_STORAGE_KEY) : null
        const threshold = savedThreshold ? Number(savedThreshold) || DEFAULT_ANT_THRESHOLD : DEFAULT_ANT_THRESHOLD
        const antExpenses = detectAntExpenses(
          (expensesResult.data ?? []).map((t) => ({ amount: Number(t.amount_ars) })),
          threshold
        )

        const healthScore = computeFinancialHealthScore({
          monthlyIncome,
          monthlyExpense,
          monthlyDebtPayments: fixedCommitments + installmentsMonthlyObligation,
          emergencyFundBalance,
          antExpensesTotal: antExpenses.total,
        })

        const priceChanges = (priceChangesResult.data ?? []).map((row) => ({
          recurringExpenseId: row.recurring_expense_id,
          currentAmount: Number(row.current_amount),
          previousAmount: row.previous_amount !== null ? Number(row.previous_amount) : null,
          currency: row.currency,
        }))
        const hasSubscriptionPriceIncrease = detectPriceIncreases(priceChanges).length > 0

        const fixedARSDaily = fixedCommitments
        const safeToSpendToday =
          monthlyIncome > 0 ? computeSafeToSpend(monthlyIncome - monthlyExpense, fixedARSDaily, daysRemaining) : null

        setAdvice(
          generateFinancialAdvice({
            healthScore,
            hasSubscriptionPriceIncrease,
            safeToSpendToday,
          })
        )
      } catch (err) {
        console.error('Error generando recomendaciones financieras:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading || !advice) return null

  if (advice.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-2">
          <Lightbulb size={16} className="text-amber-500" /> Recomendaciones
        </h3>
        <p className="text-xs text-gray-400">
          Por ahora no hay ninguna alerta puntual — tus números están en un rango razonable en los 4
          pilares del Un Mango Score.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
        <Lightbulb size={16} className="text-amber-500" /> Recomendaciones
      </h3>

      <div className="space-y-2">
        {advice.map((item) => {
          const { icon: Icon, className } = SEVERITY_STYLES[item.severity]
          return (
            <div key={item.id} className={`p-3 rounded-xl border text-xs font-medium space-y-1.5 ${className}`}>
              <div className="flex items-start gap-2.5">
                <Icon size={15} className="shrink-0 mt-0.5" />
                <span>{item.message}</span>
              </div>
              {item.action && (
                <button
                  onClick={() => onNavigate(item.action!.tab, item.action!.sectionId)}
                  className="flex items-center gap-1 text-[11px] font-bold hover:underline cursor-pointer pl-[23px]"
                >
                  {item.action.label} <ArrowRight size={11} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-gray-400 pt-1">
        Consejos generados con reglas simples sobre tus propios números — no es asesoramiento
        financiero profesional.
      </p>
    </div>
  )
}
