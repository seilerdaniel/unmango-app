'use client'

import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { supabase } from '@/lib/supabaseClient'
import { usePrivacy } from '@/context/PrivacyContext'
import { SavingsGoal } from '@/types'
import { SUGGESTED_GOALS } from '@/lib/suggestedGoals'
import { PiggyBank, Plus, Trash2, Pencil, Sparkles } from 'lucide-react'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler)

// Tope de seguridad: si con la tasa/aporte cargados nunca se llega a la
// meta (o tarda una eternidad), dejamos de simular en vez de colgar el
// navegador.
const MAX_MONTHS_SIMULATED = 600

/**
 * Simula mes a mes el crecimiento del ahorro (valor futuro de una
 * anualidad con aporte mensual constante e interés compuesto mensual) y
 * devuelve cuántos meses faltan para llegar a la meta, junto con la
 * serie de saldos proyectados para graficar.
 */
function projectGoal(goal: SavingsGoal) {
  const target = Number(goal.target_amount)
  const monthlyContribution = Number(goal.monthly_contribution)
  const rate = Number(goal.monthly_interest_rate)

  let balance = Number(goal.current_amount)
  const series: number[] = [balance]

  if (balance >= target) {
    return { monthsNeeded: 0, series, reachable: true }
  }

  let months = 0
  while (balance < target && months < MAX_MONTHS_SIMULATED) {
    balance = balance * (1 + rate) + monthlyContribution
    months += 1
    series.push(balance)
  }

  return {
    monthsNeeded: months,
    series,
    reachable: balance >= target,
  }
}

export default function SavingsGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [currentAmount, setCurrentAmount] = useState('')
  const [monthlyContribution, setMonthlyContribution] = useState('')
  const [monthlyInterestPercent, setMonthlyInterestPercent] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const { isPrivate, formatAmount } = usePrivacy()

  function applySuggestedGoal(suggested: (typeof SUGGESTED_GOALS)[number]) {
    setName(suggested.name)
    setTargetAmount(String(suggested.targetAmount))
    setMonthlyContribution(String(suggested.monthlyContribution))
    // El usuario todavía tiene que tocar "Crear Meta" — no se crea sola,
    // así puede ajustar los montos de ejemplo antes de guardar.
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function loadGoals() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setGoals(data ?? [])
      setLoadError(null)
    } catch (err) {
      console.error('Error cargando metas de ahorro:', err)
      setLoadError('No se pudieron cargar las metas de ahorro. Reintentá más tarde.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGoals()
  }, [])

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !targetAmount || Number(targetAmount) <= 0) return

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { error } = await supabase.from('savings_goals').insert([
        {
          user_id: user.id,
          name: name.trim(),
          target_amount: Number(targetAmount),
          current_amount: Number(currentAmount) || 0,
          monthly_contribution: Number(monthlyContribution) || 0,
          // El usuario carga la tasa en % (ej. "1" = 1% mensual);
          // guardamos el decimal.
          monthly_interest_rate: (Number(monthlyInterestPercent) || 0) / 100,
        },
      ])

      if (!error) {
        setName('')
        setTargetAmount('')
        setCurrentAmount('')
        setMonthlyContribution('')
        setMonthlyInterestPercent('')
        await loadGoals()
      } else {
        alert('Error al crear la meta: ' + error.message)
        console.error('Error creando meta de ahorro:', error)
      }
    }
    setSubmitting(false)
  }

  async function handleUpdateCurrentAmount(goal: SavingsGoal) {
    const input = window.prompt(
      `¿Cuánto llevás ahorrado hoy para "${goal.name}"?`,
      String(goal.current_amount)
    )
    if (input === null) return
    const newAmount = Number(input)
    if (Number.isNaN(newAmount) || newAmount < 0) {
      alert('Monto inválido.')
      return
    }

    const { error } = await supabase
      .from('savings_goals')
      .update({ current_amount: newAmount })
      .eq('id', goal.id)

    if (!error) {
      await loadGoals()
    } else {
      alert('Error al actualizar la meta: ' + error.message)
      console.error('Error actualizando meta de ahorro:', error)
    }
  }

  async function handleDeleteGoal(id: string) {
    if (confirm('¿Eliminar esta meta de ahorro?')) {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id)
      if (!error) {
        setGoals((prev) => prev.filter((g) => g.id !== id))
      } else {
        alert('Error al eliminar la meta: ' + error.message)
        console.error('Error eliminando meta de ahorro:', error)
      }
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando metas de ahorro...</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
      <div className="flex items-center gap-2">
        <PiggyBank className="w-5 h-5 text-emerald-600" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Metas de Ahorro</h2>
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-3">
        Son como una alcancía virtual: fijás un objetivo y vas actualizando a mano cuánto llevás
        ahorrado. No están conectadas a ninguna billetera real — el número es el que vos cargues.
      </p>

      {loadError && <p className="text-xs font-semibold text-rose-600">{loadError}</p>}

      {/* Formulario de alta */}
      <form onSubmit={handleAddGoal} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        <input
          type="text"
          placeholder="Nombre de la meta"
          title="Ej: Vacaciones"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <input
          type="number"
          placeholder="Objetivo ($)"
          title="Cuánto querés juntar en total"
          value={targetAmount}
          onChange={(e) => setTargetAmount(e.target.value)}
          required
          min="1"
          step="any"
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <input
          type="number"
          placeholder="Ya ahorrado ($)"
          title="Si ya tenés algo guardado para esto, poné cuánto. Si es una meta nueva, dejalo vacío (arranca en $0)."
          value={currentAmount}
          onChange={(e) => setCurrentAmount(e.target.value)}
          step="any"
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <input
          type="number"
          placeholder="Aporte mensual ($)"
          title="Cuánto pensás destinarle cada mes a esta meta"
          value={monthlyContribution}
          onChange={(e) => setMonthlyContribution(e.target.value)}
          step="any"
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <Plus size={16} /> {submitting ? 'Guardando...' : 'Crear Meta'}
        </button>
      </form>
      <div className="flex items-center gap-2 -mt-2">
        <label
          className="text-[11px] text-gray-500 font-medium"
          title="Si pensás que ese ahorro va a generar interés (ej. un plazo fijo o fondo), poné el % mensual acá. Si no, dejalo en 0."
        >
          Interés mensual estimado (opcional, en %):
        </label>
        <input
          type="number"
          placeholder="0"
          value={monthlyInterestPercent}
          onChange={(e) => setMonthlyInterestPercent(e.target.value)}
          step="any"
          className="w-20 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Lista de metas */}
      {goals.length === 0 ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 text-center">
            Todavía no creaste ninguna meta de ahorro. Podés arrancar de cero, o usar uno de estos
            ejemplos como punto de partida (los montos son solo sugerencias — los editás antes de
            crear la meta):
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {SUGGESTED_GOALS.map((suggested) => (
              <button
                key={suggested.name}
                type="button"
                onClick={() => applySuggestedGoal(suggested)}
                className="text-left p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
              >
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Sparkles size={12} style={{ color: suggested.color }} /> {suggested.name}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Objetivo {formatAmount(suggested.targetAmount)} · {formatAmount(suggested.monthlyContribution)}/mes
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          {goals.map((goal) => {
            const { monthsNeeded, series, reachable } = projectGoal(goal)
            const percentage = Math.min(
              (Number(goal.current_amount) / Number(goal.target_amount)) * 100,
              100
            )

            const chartData = {
              labels: series.map((_, i) => `${i}m`),
              datasets: [
                {
                  data: series,
                  borderColor: goal.color || '#10b981',
                  backgroundColor: `${goal.color || '#10b981'}22`,
                  fill: true,
                  tension: 0.3,
                  pointRadius: 0,
                },
              ],
            }

            return (
              <div key={goal.id} className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{goal.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateCurrentAmount(goal)}
                      className="text-gray-400 hover:text-emerald-600 transition p-1 cursor-pointer"
                      title="Actualizar cuánto llevás ahorrado"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-gray-400 hover:text-rose-600 transition p-1 cursor-pointer"
                      title="Eliminar meta"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                  <span>
                    {isPrivate
                      ? '••••••'
                      : `${formatAmount(Number(goal.current_amount))} de ${formatAmount(Number(goal.target_amount))}`}
                  </span>
                  <span>{Math.round(percentage)}%</span>
                </div>

                {series.length > 1 && (
                  <div className="h-24">
                    <Line
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { enabled: false } },
                        scales: { x: { display: false }, y: { display: false } },
                      }}
                    />
                  </div>
                )}

                <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                  {monthsNeeded === 0
                    ? '¡Meta alcanzada! 🎉'
                    : reachable
                      ? `Al ritmo actual, la alcanzás en ${monthsNeeded} ${monthsNeeded === 1 ? 'mes' : 'meses'}.`
                      : 'Con el aporte mensual actual, esta meta no se alcanza — probá subir el aporte.'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
