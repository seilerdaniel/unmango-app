'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { computeFinancialHealthScore, FinancialHealthResult, hasNoFinancialData } from '@/lib/financialHealthScore'
import { detectAntExpenses } from '@/lib/antExpenses'
import { monthlyEquivalentAmount } from '@/lib/recurringBilling'
import { Gauge } from 'lucide-react'

// Mismo umbral/localStorage que AntExpenses.tsx — se duplica acá
// porque ese componente no expone el valor guardado como algo
// reutilizable, y crear un context solo para esto sería más
// complejidad de la que amerita un número de configuración.
const ANT_THRESHOLD_STORAGE_KEY = 'unmango_ant_expense_threshold'
const DEFAULT_ANT_THRESHOLD = 3000

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600'
  if (score >= 40) return 'text-amber-500'
  return 'text-rose-600'
}

function scoreRingColor(score: number): string {
  if (score >= 70) return '#10b981'
  if (score >= 40) return '#f59e0b'
  return '#e11d48'
}

export default function FinancialHealthScoreWidget() {
  const [result, setResult] = useState<FinancialHealthResult | null>(null)
  const [noData, setNoData] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        const [trendResult, expensesResult, recurringResult, installmentsResult, walletsResult] = await Promise.all([
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
          supabase
            .from('installment_purchases')
            .select('total_amount, installments_count'),
          supabase.rpc('get_wallet_balances'),
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

        setNoData(hasNoFinancialData(monthlyIncome, monthlyExpense, emergencyFundBalance))
        setResult(
          computeFinancialHealthScore({
            monthlyIncome,
            monthlyExpense,
            monthlyDebtPayments: fixedCommitments + installmentsMonthlyObligation,
            emergencyFundBalance,
            antExpensesTotal: antExpenses.total,
          })
        )
      } catch (err) {
        console.error('Error calculando el Score de Salud Financiera:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading || !result) return null

  if (noData) {
    return (
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-2">
          <Gauge size={16} className="text-amber-500" /> Un Mango Score
        </h3>
        <p className="text-xs text-gray-400">
          Todavía no tenés movimientos cargados este mes — cargá tu primer ingreso o gasto y acá
          vas a ver tu puntaje.
        </p>
      </div>
    )
  }

  const circumference = 2 * Math.PI * 40
  const offset = circumference - (result.totalScore / 100) * circumference

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-3">
        <Gauge size={16} className="text-amber-500" /> Un Mango Score
      </h3>

      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" className="text-gray-100 dark:text-gray-800" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={scoreRingColor(result.totalScore)}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-extrabold ${scoreColor(result.totalScore)}`}>{result.totalScore}</span>
          </div>
        </div>

        <div className="flex-1 space-y-1.5 min-w-0">
          {Object.values(result.pillars).map((pillar) => (
            <div key={pillar.label} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 w-28 shrink-0 truncate">{pillar.label}</span>
              <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pillar.score}%`, backgroundColor: scoreRingColor(pillar.score) }}
                />
              </div>
              <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 w-7 text-right shrink-0">
                {pillar.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-gray-400 mt-3">
        No es un puntaje crediticio ni un consejo financiero — es una foto simple de 4 números para
        tener una meta clara que mejorar mes a mes.
      </p>
    </div>
  )
}
