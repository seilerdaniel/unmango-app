'use client'

import { useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useDashboardData } from '@/context/DashboardDataContext'
import { useWallets } from '@/context/WalletsContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { computeFinancialHealthScore, hasNoFinancialData } from '@/lib/financialHealthScore'
import { generateFinancialAdvice, AdviceItem } from '@/lib/financialAdvice'
import { detectAntExpenses } from '@/lib/antExpenses'
import { detectPriceIncreases } from '@/lib/priceIncreases'
import { monthlyEquivalentAmount } from '@/lib/recurringBilling'
import { computeSafeToSpend } from '@/lib/safeToSpend'
import { computeStreakBreak } from '@/lib/zeroSpendStats'
import { isGoalStalled } from '@/lib/savingsGoalStall'
import { computeHouseholdBalance } from '@/lib/householdBalance'
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

interface AdviceLoadResult {
  advice: AdviceItem[]
  noData: boolean
}

/**
 * Consejos en texto conectando los mismos 4 pilares del Un Mango Score
 * (que solo muestra números/barras) con reglas simples — no es IA, es
 * un conjunto de umbrales sobre datos que la app ya calcula en otro
 * lado, reutilizados acá para que los consejos no contradigan lo que
 * ya se ve en el Score.
 *
 * La carga usa `useAsyncData`: la base (tendencia del mes, gastos,
 * recurrentes, cuotas y billeteras) ya la trae DashboardDataContext /
 * WalletsContext una sola vez para todos los widgets de Inicio; acá el
 * loader solo pide las señales propias de las recomendaciones y se
 * vuelve a ejecutar cuando cambian esos contextos (ver AUDIT.md, #4).
 */
export default function FinancialAdviceWidget({
  onNavigate,
}: {
  onNavigate: (target: { tab?: TabId; sectionId?: string; openSettings?: boolean }) => void
}) {
  const { data: dashboard } = useDashboardData()
  const { wallets } = useWallets()

  const { data: loadResult, loading } = useAsyncData<AdviceLoadResult>(
    useCallback(async () => {
      if (!dashboard) return null

      const now = new Date()
      const dayOfMonth = now.getDate()
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const daysRemaining = daysInMonth - dayOfMonth + 1

      const [priceChangesResult, budgetsResult, categorySpendResult, debtsResult, goalsResult, categoriesResult] =
        await Promise.all([
          supabase.rpc('get_recurring_price_changes'),
          supabase.from('budgets').select('category_id, monthly_limit, categories(name)').eq('user_id', dashboard.userId),
          supabase.rpc('get_monthly_category_spend', { p_year: now.getFullYear(), p_month: now.getMonth() + 1 }),
          supabase.from('debts').select('interest_rate, remaining_amount, debt_type').eq('user_id', dashboard.userId),
          supabase.from('savings_goals').select('name, current_amount, created_at').eq('user_id', dashboard.userId),
          supabase.from('categories').select('id').eq('user_id', dashboard.userId),
        ])

      const monthlyIncome = dashboard.monthlyIncome
      const monthlyExpense = dashboard.monthlyExpense

      const fixedCommitments = dashboard.recurring
        .filter((r) => r.currency === 'ARS')
        .reduce((acc, r) => acc + monthlyEquivalentAmount(Number(r.amount), r.billing_frequency), 0)

      const installmentsMonthlyObligation = dashboard.installments.reduce(
        (acc, p) => acc + Number(p.total_amount) / p.installments_count,
        0
      )

      const emergencyFundBalance = wallets.reduce((acc, w) => acc + (Number(w.balance) || 0), 0)

      const savedThreshold = typeof window !== 'undefined' ? localStorage.getItem(ANT_THRESHOLD_STORAGE_KEY) : null
      const threshold = savedThreshold ? Number(savedThreshold) || DEFAULT_ANT_THRESHOLD : DEFAULT_ANT_THRESHOLD
      const antExpenses = detectAntExpenses(
        dashboard.monthExpenses.map((t) => ({ amount: Number(t.amount_ars) })),
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

      const safeToSpendToday =
        monthlyIncome > 0 ? computeSafeToSpend(monthlyIncome - monthlyExpense, fixedCommitments, daysRemaining) : null

      // Presupuesto excedido: cruzamos el límite de cada categoría con
      // lo gastado ese mes (misma función que ya usa BudgetManager).
      const spendByCategory = new Map((categorySpendResult.data ?? []).map((row) => [row.category_id, Number(row.spent)]))
      const exceededBudgetCategoryNames = (budgetsResult.data ?? [])
        .filter((b) => (spendByCategory.get(b.category_id) ?? 0) > Number(b.monthly_limit))
        .map((b) => (b.categories as { name: string } | null)?.name)
        .filter((name): name is string => !!name)

      // Deuda con interés: cualquier deuda "debo" activa con interés > 0.
      const hasHighInterestDebt = (debtsResult.data ?? []).some(
        (d) => d.debt_type === 'debo' && Number(d.remaining_amount) > 0 && Number(d.interest_rate) > 0
      )

      // Cuota grande: la primera compra cuya cuota mensual supere el
      // 20% del ingreso mensual (si no hay ingreso registrado, no se
      // puede evaluar "grande respecto a qué", se omite el aviso).
      const largeInstallment =
        monthlyIncome > 0
          ? dashboard.installments.find((p) => Number(p.total_amount) / p.installments_count / monthlyIncome > 0.2)
          : undefined
      const largeInstallmentDescription = largeInstallment?.description ?? null

      // Racha de gastos rota: mismo criterio que ZeroSpendStreak.tsx.
      const expenseDayNumbers = dashboard.monthExpenses.map((t) => new Date(t.created_at).getDate())
      const brokenStreakDays = computeStreakBreak(expenseDayNumbers, now)

      // Metas de ahorro estancadas.
      const stalledGoalNames = (goalsResult.data ?? [])
        .filter((g) => isGoalStalled(Number(g.current_amount), g.created_at, now))
        .map((g) => g.name)

      // Sin categorías creadas.
      const hasNoCategories = (categoriesResult.data ?? []).length === 0

      // Gastos este mes pero ningún ingreso registrado.
      const hasExpensesButNoIncome = monthlyIncome === 0 && monthlyExpense > 0

      // Balance de Hogar sin saldar hace tiempo — consulta aparte
      // porque primero hace falta saber el household_id (no se puede
      // resolver en el mismo Promise.all de arriba).
      let householdUnsettledDays: number | null = null
      const { data: householdLink } = await supabase
        .from('household_links')
        .select('id')
        .eq('status', 'active')
        .or(`user_a_id.eq.${dashboard.userId},user_b_id.eq.${dashboard.userId}`)
        .maybeSingle()

      if (householdLink) {
        const { data: householdExpenses } = await supabase
          .from('household_expenses')
          .select('amount, paid_by_user_id, created_at')
          .eq('household_id', householdLink.id)
          .order('created_at', { ascending: true })

        if (householdExpenses && householdExpenses.length > 0) {
          const totalPaidByMe = householdExpenses
            .filter((e) => e.paid_by_user_id === dashboard.userId)
            .reduce((acc, e) => acc + Number(e.amount), 0)
          const totalPaidByPartner = householdExpenses
            .filter((e) => e.paid_by_user_id !== dashboard.userId)
            .reduce((acc, e) => acc + Number(e.amount), 0)
          const householdBalance = computeHouseholdBalance(totalPaidByMe, totalPaidByPartner)

          if (householdBalance.netBalanceForMe !== 0) {
            const oldestExpenseDate = new Date(householdExpenses[0].created_at)
            householdUnsettledDays = Math.floor((now.getTime() - oldestExpenseDate.getTime()) / (1000 * 60 * 60 * 24))
          }
        }
      }

      return {
        noData: hasNoFinancialData(monthlyIncome, monthlyExpense),
        advice: generateFinancialAdvice({
          healthScore,
          hasSubscriptionPriceIncrease,
          safeToSpendToday,
          exceededBudgetCategoryNames,
          hasHighInterestDebt,
          largeInstallmentDescription,
          brokenStreakDays,
          stalledGoalNames,
          hasNoCategories,
          hasExpensesButNoIncome,
          householdUnsettledDays,
        }),
      }
    }, [dashboard, wallets]),
    'Error generando recomendaciones financieras'
  )

  if (loading || !loadResult) return null

  const { advice, noData } = loadResult

  if (noData) {
    return (
      <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-2">
          <Lightbulb size={16} className="text-amber-500" /> Recomendaciones
        </h3>
        <p className="text-xs text-gray-400">
          Todavía no hay nada cargado este mes, así que no hay mucho para recomendar todavía —
          cargá tu primer ingreso o gasto y las recomendaciones se arman solas a partir de tus
          números reales.
        </p>
      </div>
    )
  }

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
                  onClick={() => onNavigate(item.action!)}
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
