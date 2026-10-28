'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useCategories } from '@/context/CategoriesContext'
import { usePrivacy } from '@/context/PrivacyContext'
import { useToast } from '@/context/ToastContext'
import { computeRule502030, BudgetGroup } from '@/lib/rule502030'
import { PieChart, ChevronDown } from 'lucide-react'

const GROUP_LABELS: Record<BudgetGroup, string> = {
  necesidad: 'Necesidades (50%)',
  deseo: 'Deseos (30%)',
  ahorro: 'Ahorro/Inversión (20%)',
}

const GROUP_COLORS: Record<BudgetGroup, string> = {
  necesidad: '#3b82f6',
  deseo: '#f59e0b',
  ahorro: '#10b981',
}

export default function BudgetRule502030() {
  const { categories, refreshCategories } = useCategories()
  const { isPrivate, formatAmount } = usePrivacy()
  const { toast } = useToast()
  const [income, setIncome] = useState(0)
  const [categorySpends, setCategorySpends] = useState<{ categoryId: string; spent: number }[]>([])
  const [loading, setLoading] = useState(true)

  async function loadData() {
    try {
      const now = new Date()

      const [trendResult, spendResult] = await Promise.all([
        supabase.rpc('get_monthly_trend', { p_months: 1 }),
        supabase.rpc('get_monthly_category_spend', {
          p_year: now.getFullYear(),
          p_month: now.getMonth() + 1,
        }),
      ])

      if (trendResult.error) throw trendResult.error
      if (spendResult.error) throw spendResult.error

      setIncome(Number(trendResult.data?.[0]?.total_income) || 0)
      setCategorySpends(
        (spendResult.data ?? []).map((row) => ({ categoryId: row.category_id, spent: Number(row.spent) || 0 }))
      )
    } catch (err) {
      console.error('Error cargando datos de la regla 50/30/20:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // loadData es async; sus setState ocurren post-await, no sincrónicos en
    // el effect (falso positivo de react-hooks/set-state-in-effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData()
  }, [])

  async function handleAssignGroup(categoryId: string, group: BudgetGroup | '') {
    const { error } = await supabase
      .from('categories')
      .update({ budget_group: group || null })
      .eq('id', categoryId)

    if (error) {
      toast.error('Error al asignar el grupo: ' + error.message)
      console.error('Error asignando budget_group:', error)
      return
    }
    await refreshCategories()
  }

  const categoryGroups = Object.fromEntries(categories.map((c) => [c.id, c.budget_group]))
  const result = computeRule502030(income, categorySpends, categoryGroups)
  const unclassifiedCategories = categories.filter((c) => !c.budget_group)

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando regla 50/30/20...</p>
      </div>
    )
  }

  if (income === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-2">
          <PieChart size={16} className="text-indigo-600" /> Regla 50/30/20
        </h3>
        <p className="text-xs text-gray-400">
          Todavía no registraste ingresos este mes — necesitamos ese dato para calcular los objetivos.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
        <PieChart size={16} className="text-indigo-600" /> Regla 50/30/20
      </h3>

      <div className="space-y-3">
        {(['necesidad', 'deseo', 'ahorro'] as BudgetGroup[]).map((group) => {
          const breakdown = result[group]
          const widthPct = Math.min((breakdown.spent / breakdown.target) * 100 || 0, 100)
          const overBudget = breakdown.spent > breakdown.target

          return (
            <div key={group}>
              <div className="flex justify-between items-center text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                <span>{GROUP_LABELS[group]}</span>
                <span className={overBudget ? 'text-rose-600 font-bold' : ''}>
                  {isPrivate ? '••••••' : `${formatAmount(breakdown.spent)} / ${formatAmount(breakdown.target)}`}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${widthPct}%`, backgroundColor: overBudget ? '#e11d48' : GROUP_COLORS[group] }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {result.unclassifiedSpend > 0 && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          {isPrivate ? '••••••' : formatAmount(result.unclassifiedSpend)} en categorías sin clasificar (no entra en
          ningún grupo todavía) — asignalas abajo.
        </p>
      )}

      {unclassifiedCategories.length > 0 && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <p className="text-[11px] font-bold text-gray-600 dark:text-gray-400">
            Clasificar categorías ({unclassifiedCategories.length} sin asignar)
          </p>
          {unclassifiedCategories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
              <div className="relative">
                <select
                  defaultValue=""
                  onChange={(e) => handleAssignGroup(cat.id, e.target.value as BudgetGroup | '')}
                  className="text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-2 pr-6 py-1 font-medium text-gray-700 dark:text-gray-300 appearance-none cursor-pointer"
                >
                  <option value="">Sin clasificar</option>
                  <option value="necesidad">Necesidad</option>
                  <option value="deseo">Deseo</option>
                  <option value="ahorro">Ahorro</option>
                </select>
                <ChevronDown size={11} className="absolute right-1.5 top-1.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
