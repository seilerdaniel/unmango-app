'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Clock, CheckCircle2 } from 'lucide-react'

export default function WorkSettings() {
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [monthlyWorkHours, setMonthlyWorkHours] = useState('160')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('user_work_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) throw error
        if (data) {
          setMonthlyIncome(String(data.monthly_income))
          setMonthlyWorkHours(String(data.monthly_work_hours))
        }
      } catch (err) {
        console.error('Error cargando configuración de ingreso/horas:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!monthlyIncome || Number(monthlyIncome) <= 0) return

    setSaving(true)
    setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      return
    }

    const { error } = await supabase.from('user_work_settings').upsert(
      {
        user_id: user.id,
        monthly_income: Number(monthlyIncome),
        monthly_work_hours: Number(monthlyWorkHours) || 160,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (!error) {
      setSaved(true)
    } else {
      alert('Error al guardar: ' + error.message)
      console.error('Error guardando configuración de ingreso/horas:', error)
    }
    setSaving(false)
  }

  if (loading) return null

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
        <Clock size={16} className="text-amber-500" /> Costo en Horas de Trabajo
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Cargá tu ingreso mensual y cuántas horas trabajás por mes — con eso, al cargar un gasto te
        mostramos a cuántas horas de tu vida equivale. Es un cálculo tuyo, privado, no se comparte
        con nadie.
      </p>

      <form onSubmit={handleSave} className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Ingreso mensual</label>
          <input
            type="number"
            value={monthlyIncome}
            onChange={(e) => setMonthlyIncome(e.target.value)}
            placeholder="500000"
            required
            className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Horas/mes</label>
          <input
            type="number"
            value={monthlyWorkHours}
            onChange={(e) => setMonthlyWorkHours(e.target.value)}
            placeholder="160"
            className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-semibold text-gray-800 dark:text-gray-100"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="col-span-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </form>

      {saved && (
        <p className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
          <CheckCircle2 size={12} /> Guardado — ya se va a usar en el campo de monto.
        </p>
      )}
    </div>
  )
}
