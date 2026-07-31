'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Budget } from '@/types'
import { usePrivacy } from '@/context/PrivacyContext'
import { useCategories } from '@/context/CategoriesContext'
import { suggestBudgets } from '@/lib/suggestedBudgets'
import { Target, Plus, Trash2, AlertCircle, Sparkles } from 'lucide-react'

export default function BudgetManager() {
  const { categories } = useCategories()
  const [budgets, setBudgets] = useState<Budget[]>([])
  // Gasto acumulado del mes actual por categoría, calculado en Postgres
  // (get_monthly_category_spend) en vez de sumarlo en el frontend a partir
  // de todas las transacciones cargadas.
  const [spendByCategory, setSpendByCategory] = useState<Record<string, number>>({})
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [limitAmount, setLimitAmount] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { isPrivate, formatAmount } = usePrivacy()

  function applySuggestedBudget(categoryId: string, amount: number) {
    setSelectedCategory(categoryId)
    setLimitAmount(String(amount))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function loadMonthlyIncome() {
    const { data, error } = await supabase.rpc('get_monthly_trend', { p_months: 1 })
    if (error) {
      console.error('Error cargando el ingreso mensual para sugerencias:', error)
      return
    }
    setMonthlyIncome(Number(data?.[0]?.total_income) || 0)
  }

  async function loadMonthlySpend() {
    const now = new Date()
    const { data, error } = await supabase.rpc('get_monthly_category_spend', {
      p_year: now.getFullYear(),
      p_month: now.getMonth() + 1,
    })
    if (error) {
      console.error('Error calculando gasto mensual por categoría:', error)
      return
    }
    const map: Record<string, number> = {}
    for (const row of data ?? []) {
      map[row.category_id] = Number(row.spent) || 0
    }
    setSpendByCategory(map)
  }

  // Carga inicial de datos con flag de montado para evitar cascading renders
  useEffect(() => {
    let isMounted = true

    const loadInitialData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [{ data: budgetsData }] = await Promise.all([
          supabase
            .from('budgets')
            .select('*, categories(*)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          loadMonthlySpend(),
          loadMonthlyIncome(),
        ])

        if (isMounted && budgetsData) setBudgets(budgetsData)
      } catch (err) {
        console.error('Error al cargar presupuestos:', err)
        if (isMounted) setLoadError('No se pudieron cargar los presupuestos. Reintentá más tarde.')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  // Función aux para recargar presupuestos tras una mutación (guardar/eliminar)
  const reloadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: budgetsData }] = await Promise.all([
        supabase
          .from('budgets')
          .select('*, categories(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        loadMonthlySpend(),
      ])

      if (budgetsData) setBudgets(budgetsData)
      setLoadError(null)
    } catch (err) {
      console.error('Error recargando presupuestos:', err)
      setLoadError('No se pudieron actualizar los presupuestos.')
    }
  }

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCategory || !limitAmount || Number(limitAmount) <= 0) return

    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSubmitting(false)
      return
    }

    // Insertar o actualizar presupuesto existente (UPSERT)
    const { error } = await supabase.from('budgets').upsert(
      {
        user_id: user.id,
        category_id: selectedCategory,
        monthly_limit: Number(limitAmount)
      },
      { onConflict: 'user_id,category_id' }
    )

    if (!error) {
      setSelectedCategory('')
      setLimitAmount('')
      await reloadData()
    } else {
      alert('Error al guardar el presupuesto: ' + error.message)
      console.error('Error guardando presupuesto:', error)
    }

    setSubmitting(false)
  }

  const handleDeleteBudget = async (id: string) => {
    const { error } = await supabase.from('budgets').delete().eq('id', id)
    if (!error) {
      setBudgets((prev) => prev.filter((b) => b.id !== id))
    } else {
      alert('Error al eliminar el presupuesto: ' + error.message)
      console.error('Error eliminando presupuesto:', error)
    }
  }

  const getSpentForCategory = (categoryId: string) => spendByCategory[categoryId] || 0

  const categoriesWithoutBudget = categories.filter((c) => !budgets.some((b) => b.category_id === c.id))
  const suggestedBudgets = suggestBudgets(monthlyIncome, categoriesWithoutBudget)

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando presupuestos...</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Presupuestos Mensuales</h2>
        </div>
        <span className="text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 px-2.5 py-1 rounded-full">
          Mes Actual
        </span>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-semibold px-3.5 py-2.5 rounded-xl">
          <AlertCircle size={14} className="shrink-0" /> {loadError}
        </div>
      )}

      {/* Formulario para asignar/modificar tope */}
      <form onSubmit={handleSaveBudget} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          required
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">Seleccionar Categoría...</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Límite Mensual ($ ARS)"
          value={limitAmount}
          onChange={(e) => setLimitAmount(e.target.value)}
          required
          min="1"
          step="any"
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Plus size={16} /> {submitting ? 'Guardando...' : 'Asignar Límite'}
        </button>
      </form>

      {/* Lista de Presupuestos Activos */}
      {budgets.length === 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 text-center">
            No tenés presupuestos asignados para este mes. Seleccioná una categoría para establecer
            un límite{suggestedBudgets.length > 0 ? ', o probá una de estas sugerencias' : ''}:
          </p>
          {suggestedBudgets.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {suggestedBudgets.map((s) => (
                <button
                  key={s.categoryId}
                  type="button"
                  onClick={() => applySuggestedBudget(s.categoryId, s.suggestedAmount)}
                  className="text-left p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                >
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-500" /> {s.categoryName}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {(s.percentOfIncome * 100).toFixed(0)}% de tu ingreso · {formatAmount(s.suggestedAmount)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          {budgets.map((b) => {
            const spent = getSpentForCategory(b.category_id)
            const limit = Number(b.monthly_limit)
            const rawPercentage = limit > 0 ? (spent / limit) * 100 : 0
            const displayPercentage = Math.round(rawPercentage)
            const widthPercentage = Math.min(rawPercentage, 100)

            const isExceeded = spent >= limit
            const isWarning = widthPercentage >= 75 && !isExceeded

            // Determinar colores de barra
            let progressColor = 'bg-emerald-500'
            let textColor = 'text-emerald-700'
            if (isWarning) {
              progressColor = 'bg-amber-500'
              textColor = 'text-amber-700'
            } else if (isExceeded) {
              progressColor = 'bg-rose-500'
              textColor = 'text-rose-600'
            }

            return (
              <div key={b.id} className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: b.categories?.color || '#3b82f6' }}
                    />
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                      {b.categories?.name || 'Categoría'}
                    </span>
                    {isExceeded && (
                      <span className="flex items-center gap-1 text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded-md">
                        <AlertCircle size={12} /> Excedido
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-extrabold ${textColor}`}>
                      {isPrivate ? '••••••' : `${displayPercentage}%`}
                    </span>
                    <button
                      onClick={() => b.id && handleDeleteBudget(b.id)}
                      className="text-gray-400 hover:text-rose-600 transition p-1 cursor-pointer"
                      title="Eliminar presupuesto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Barra de progreso */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${progressColor} transition-all duration-500`}
                    style={{ width: `${widthPercentage}%` }}
                  />
                </div>

                {/* Lectura de montos */}
                <div className="flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  <span>Gastado: {formatAmount(spent)}</span>
                  <span>Límite: {formatAmount(limit)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
