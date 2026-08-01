'use client'

import React, { createContext, useCallback, useContext } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAsyncData } from '@/hooks/useAsyncData'

export interface DashboardMonthExpense {
  description: string | null
  amount_ars: number | null
  created_at: string
}

export interface DashboardRecurring {
  amount: number | null
  currency: string | null
  billing_frequency: 'monthly' | 'annual'
}

export interface DashboardInstallment {
  description: string | null
  total_amount: number | null
  installments_count: number
}

export interface DashboardData {
  userId: string
  /** Inicio del mes en curso (ISO), para recomputar fechas en los widgets. */
  monthStart: string
  monthlyIncome: number
  monthlyExpense: number
  /** Gastos del mes en curso (solo columnas necesarias para los widgets). */
  monthExpenses: DashboardMonthExpense[]
  /** Recurrentes activos (misma fuente que el "Fijo Comprometido"). */
  recurring: DashboardRecurring[]
  /** Compras en cuotas del usuario. */
  installments: DashboardInstallment[]
  /** Ingreso/gasto de TODA la historia (get_transaction_totals). */
  totalIncome: number
  totalExpense: number
}

interface DashboardDataContextType {
  data: DashboardData | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const DashboardDataContext = createContext<DashboardDataContextType | undefined>(undefined)

/**
 * Conjunto de datos compartido por los widgets de la pestaña Inicio
 * (Un Mango Score, Recomendaciones, Días sin gastar, Proyección, Podés
 * gastar hoy). Antes cada widget consultaba las mismas agregaciones por
 * separado (~13 consultas al abrir Inicio); ahora se traen una sola vez
 * acá y cada widget deriva sus números. `refresh()` se llama cuando
 * cambia `dataVersion` en page.tsx (ver AUDIT.md, refactor #1).
 */
export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const { data, loading, error, refetch } = useAsyncData<DashboardData>(
    useCallback(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [trendResult, expensesResult, recurringResult, installmentsResult, totalsResult] = await Promise.all([
        supabase.rpc('get_monthly_trend', { p_months: 1 }),
        supabase
          .from('transactions')
          .select('description, amount_ars, created_at')
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
          .select('description, total_amount, installments_count')
          .eq('user_id', user.id),
        supabase.rpc('get_transaction_totals'),
      ])

      if (trendResult.error) throw trendResult.error
      if (expensesResult.error) throw expensesResult.error
      if (recurringResult.error) throw recurringResult.error
      if (installmentsResult.error) throw installmentsResult.error
      if (totalsResult.error) throw totalsResult.error

      return {
        userId: user.id,
        monthStart,
        monthlyIncome: Number(trendResult.data?.[0]?.total_income) || 0,
        monthlyExpense: Number(trendResult.data?.[0]?.total_expense) || 0,
        monthExpenses: (expensesResult.data ?? []).map((t) => ({
          description: t.description,
          amount_ars: t.amount_ars,
          created_at: t.created_at ?? '',
        })),
        recurring: (recurringResult.data ?? []).map((r) => ({
          amount: r.amount,
          currency: r.currency,
          billing_frequency: r.billing_frequency,
        })),
        installments: (installmentsResult.data ?? []).map((p) => ({
          description: p.description,
          total_amount: p.total_amount,
          installments_count: p.installments_count,
        })),
        totalIncome: Number(totalsResult.data?.[0]?.total_income) || 0,
        totalExpense: Number(totalsResult.data?.[0]?.total_expense) || 0,
      }
    }, []),
    'No se pudieron cargar los datos del panel.'
  )

  return (
    <DashboardDataContext.Provider value={{ data, loading, error, refresh: refetch }}>
      {children}
    </DashboardDataContext.Provider>
  )
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext)
  if (!context) {
    throw new Error('useDashboardData debe ser usado dentro de un DashboardDataProvider')
  }
  return context
}
