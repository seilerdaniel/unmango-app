'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Budget } from '@/types'
import { usePrivacy } from '@/context/PrivacyContext'
import { useCategories } from '@/context/CategoriesContext'
import { Target, Plus, Trash2, AlertCircle } from 'lucide-react'

export default function BudgetManager() {
  const { categories } = useCategories()
  const [budgets, setBudgets] = useState<Budget[]>([])
  // Gasto acumulado del mes actual por categoría, calculado en Postgres
  // (get_monthly_category_spend) en vez de sumarlo en el frontend a partir
  // de todas las transacciones cargadas.
  const [spendByCategory, setSpendByCategory] = useState<Record<string, number>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [limitAmount, setLimitAmount] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { isPrivate, formatAmount } = usePrivacy()

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

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando presupuestos...</p>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-bold text-gray-900">Presupuestos Mensuales</h2>
        </div>
        <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full">
          Mes Actual
        </span>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl">
          <AlertCircle size={14} className="shrink-0" /> {loadError}
        </div>
      )}

      {/* Formulario para asignar/modificar tope */}
      <form onSubmit={handleSaveBudget} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          required
          className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
          className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
        <p className="text-xs text-gray-400 text-center py-4">
          No tenés presupuestos asignados para este mes. Seleccioná una categoría para establecer un límite.
        </p>
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
              <div key={b.id} className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: b.categories?.color || '#3b82f6' }}
                    />
                    <span className="text-xs font-bold text-gray-800">
                      {b.categories?.name || 'Categoría'}
                    </span>
                    {isExceeded && (
                      <span className="flex items-center gap-1 text-[10px] font-extrabold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md">
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
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${progressColor} transition-all duration-500`}
                    style={{ width: `${widthPercentage}%` }}
                  />
                </div>

                {/* Lectura de montos */}
                <div className="flex justify-between items-center text-[11px] text-gray-500 font-medium">
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
