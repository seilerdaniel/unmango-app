'use client'

import { useMemo } from 'react'
import { useDashboardData } from '@/context/DashboardDataContext'
import { computeZeroSpendStats } from '@/lib/zeroSpendStats'
import { Flame, Sparkles } from 'lucide-react'

export default function ZeroSpendStreak() {
  const { data, loading } = useDashboardData()

  const stats = useMemo(
    () => (data ? computeZeroSpendStats(data.monthExpenses.map((t) => new Date(t.created_at).getDate()), new Date()) : null),
    [data]
  )

  if (loading || !data || !stats) return null

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
