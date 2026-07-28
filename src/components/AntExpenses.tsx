'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePrivacy } from '@/context/PrivacyContext'
import { detectAntExpenses } from '@/lib/antExpenses'
import { Bug, Pencil } from 'lucide-react'

const STORAGE_KEY = 'unmango_ant_expense_threshold'
const DEFAULT_THRESHOLD = 3000

export default function AntExpenses() {
  const { isPrivate, formatAmount } = usePrivacy()
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [expenses, setExpenses] = useState<{ amount: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setThreshold(Number(saved) || DEFAULT_THRESHOLD)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        const { data, error } = await supabase
          .from('transactions')
          .select('amount_ars')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .gte('created_at', monthStart)

        if (error) throw error
        setExpenses((data ?? []).map((t) => ({ amount: Number(t.amount_ars) })))
      } catch (err) {
        console.error('Error cargando gastos hormiga:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function handleChangeThreshold() {
    const input = window.prompt('¿A partir de qué monto considerás que YA NO es un gasto hormiga?', String(threshold))
    if (input === null) return
    const num = Number(input)
    if (!num || num <= 0) return
    setThreshold(num)
    localStorage.setItem(STORAGE_KEY, String(num))
  }

  if (loading) return null

  const result = detectAntExpenses(expenses, threshold)

  if (result.count === 0) return null

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bug size={16} className="text-amber-500" />
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Gastos hormiga</h3>
        </div>
        <button
          onClick={handleChangeThreshold}
          className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 cursor-pointer"
        >
          <Pencil size={10} /> umbral: {formatAmount(threshold)}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Este mes tuviste <span className="font-bold text-gray-800 dark:text-gray-200">{result.count}</span> gastos
        menores a {formatAmount(threshold)} que suman{' '}
        <span className="font-extrabold text-amber-600 dark:text-amber-400">
          {isPrivate ? '••••••' : formatAmount(result.total)}
        </span>
        .
      </p>
    </div>
  )
}
