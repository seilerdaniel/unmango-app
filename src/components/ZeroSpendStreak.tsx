'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { computeZeroSpendStats } from '@/lib/zeroSpendStats'
import { Flame, Sparkles } from 'lucide-react'

export default function ZeroSpendStreak() {
  const [stats, setStats] = useState<{ daysElapsed: number; zeroSpendDays: number; currentStreak: number } | null>(
    null
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        // Query liviana: solo la fecha de los gastos del mes, no las
        // transacciones completas.
        const { data, error } = await supabase
          .from('transactions')
          .select('created_at')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .gte('created_at', monthStart)

        if (error) throw error

        const expenseDays = (data ?? []).map((row) => new Date(row.created_at).getDate())
        setStats(computeZeroSpendStats(expenseDays, now))
      } catch (err) {
        console.error('Error calculando la racha de días sin gastos:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading || !stats) return null

  const { zeroSpendDays, daysElapsed, currentStreak } = stats

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-amber-500" />
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Días sin gastar</h3>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Flame
            size={22}
            className={currentStreak > 0 ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600'}
          />
          <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{currentStreak}</span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p className="font-semibold">
            {currentStreak === 0
              ? 'Racha actual (gastaste hoy)'
              : currentStreak === 1
                ? 'día seguido sin gastar'
                : 'días seguidos sin gastar'}
          </p>
          <p>
            {zeroSpendDays} de {daysElapsed} días este mes sin ningún gasto registrado
          </p>
        </div>
      </div>
    </div>
  )
}
