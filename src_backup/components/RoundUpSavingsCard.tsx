'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { useToast } from '@/context/ToastContext'
import { usePrivacy } from '@/context/PrivacyContext'
import { useDashboardData } from '@/context/DashboardDataContext'
import { computeTotalRoundUpSavings } from '@/lib/roundUpSavings'
import { enqueueOfflineMutation, isOffline } from '@/lib/offlineQueue'
import { TrendingUp, Sparkles } from 'lucide-react'

const STEPS = [100, 500, 1000]
const OFFLINE_TOAST = 'Sin conexión: guardado en tu celular. Se sincroniza solo cuando vuelvas a tener internet.'

interface RoundUpSettings {
  roundup_enabled: boolean
  roundup_step: number
}

interface GoalOption {
  id: string
  name: string
  current_amount: number
}

/**
 * "Bolsillo de Cambio": el ahorro por redondeo de la Tanda 11c. Muestra
 * cuánto se juntó este mes redondeando cada gasto al múltiplo del paso
 * elegido (motor puro en src/lib/roundUpSavings.ts), permite activar/
 * desactivar y elegir el paso, y deriva el total acumulado a una Meta de
 * Ahorro (sumando al current_amount de savings_goals).
 */
export default function RoundUpSavingsCard() {
  const { user } = useUser()
  const { toast } = useToast()
  const { formatAmount } = usePrivacy()
  const { data: dashboard } = useDashboardData()

  const [settings, setSettings] = useState<RoundUpSettings | null>(null)
  const [goals, setGoals] = useState<GoalOption[]>([])
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [deriving, setDeriving] = useState(false)

  const monthTotal = useMemo(
    () => computeTotalRoundUpSavings(dashboard?.monthExpenses ?? [], settings?.roundup_step ?? 1000),
    [dashboard?.monthExpenses, settings?.roundup_step]
  )

  const loadSettings = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('roundup_savings')
        .select('roundup_enabled, roundup_step')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      setSettings(
        data
          ? { roundup_enabled: data.roundup_enabled, roundup_step: Number(data.roundup_step) || 1000 }
          : { roundup_enabled: true, roundup_step: 1000 }
      )
    } catch (err) {
      console.error('Error cargando preferencias del Bolsillo de Cambio:', err)
      // Sin fila todavía: aplican los valores por defecto de la tabla.
      setSettings({ roundup_enabled: true, roundup_step: 1000 })
    }
  }, [user])

  const loadGoals = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('savings_goals')
      .select('id, name, current_amount')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('Error cargando metas para derivar el bolsillo:', error)
      return
    }
    setGoals((data ?? []).map((g) => ({ id: g.id, name: g.name, current_amount: Number(g.current_amount) || 0 })))
    setSelectedGoalId((prev) => (prev && (data ?? []).some((g) => g.id === prev) ? prev : (data?.[0]?.id ?? '')))
  }, [user])

  useEffect(() => {
    // loadSettings/loadGoals son async; sus setState ocurren post-await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings()
    loadGoals()
  }, [loadSettings, loadGoals])

  async function saveSettings(next: RoundUpSettings) {
    if (!user) return
    const prev = settings
    setSettings(next)
    if (isOffline()) {
      setSettings(prev)
      toast.error('Sin conexión: no pudimos guardar la preferencia.')
      return
    }
    const { error } = await supabase.from('roundup_savings').upsert(
      {
        user_id: user.id,
        roundup_enabled: next.roundup_enabled,
        roundup_step: next.roundup_step,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    if (error) {
      setSettings(prev)
      toast.error('Error al guardar la preferencia: ' + error.message)
      console.error('Error guardando preferencia del Bolsillo de Cambio:', error)
    }
  }

  async function handleDerive() {
    if (!user || monthTotal <= 0 || !selectedGoalId) return
    const goal = goals.find((g) => g.id === selectedGoalId)
    if (!goal) return
    const newAmount = goal.current_amount + monthTotal
    setDeriving(true)

    if (isOffline()) {
      enqueueOfflineMutation('savings_goals', 'update', { id: goal.id, current_amount: newAmount })
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, current_amount: newAmount } : g)))
      toast.info(OFFLINE_TOAST)
      setDeriving(false)
      return
    }

    const { error } = await supabase
      .from('savings_goals')
      .update({ current_amount: newAmount })
      .eq('id', goal.id)

    if (!error) {
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, current_amount: newAmount } : g)))
      toast.success(`Derivamos ${formatAmount(monthTotal)} a "${goal.name}".`)
    } else if (isOffline()) {
      enqueueOfflineMutation('savings_goals', 'update', { id: goal.id, current_amount: newAmount })
      toast.info(OFFLINE_TOAST)
    } else {
      toast.error('Error al derivar el bolsillo: ' + error.message)
      console.error('Error derivando el bolsillo de cambio:', error)
    }
    setDeriving(false)
  }

  const enabled = settings?.roundup_enabled ?? true
  const step = settings?.roundup_step ?? 1000

  return (
    <div
      id="bolsillo-cambio"
      className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Bolsillo de Cambio</h2>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Ahorro por redondeo</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Activar ahorro por redondeo"
            onClick={() => saveSettings({ roundup_enabled: !enabled, roundup_step: step })}
            className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
              enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                enabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </label>
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-3">
        Como el &ldquo;vuelto&rdquo; de un comercio: cada gasto se redondea al múltiplo de
        {` ${formatAmount(step)} `}y la diferencia se junta en este bolsillo para derivarla a una Meta de
        Ahorro.
      </p>

      {!enabled ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Activá el ahorro por redondeo para ir juntando el vuelto de tus gastos.
        </p>
      ) : (
        <>
          <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/30 p-4">
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              💡 Este mes acumulaste
            </p>
            <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {formatAmount(monthTotal)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              Redondear cada gasto a múltiplos de:
            </span>
            {STEPS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => saveSettings({ roundup_enabled: enabled, roundup_step: s })}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  step === s
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                ${s.toLocaleString('es-AR')}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">
              ¿Dónde va el vuelto?
            </p>
            {goals.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Creá una Meta de Ahorro acá arriba para poder derivar el bolsillo.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2.5">
                <select
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="flex-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleDerive}
                  disabled={deriving || monthTotal <= 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-sm flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Sparkles size={16} />
                  {deriving
                    ? 'Derivando...'
                    : monthTotal > 0
                      ? `Derivar ${formatAmount(monthTotal)} a la meta`
                      : 'Derivar'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
