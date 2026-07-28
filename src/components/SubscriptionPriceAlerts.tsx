'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePrivacy } from '@/context/PrivacyContext'
import { detectPriceIncreases, PriceChange } from '@/lib/priceIncreases'
import { RecurringExpense } from '@/types'
import { TrendingUp } from 'lucide-react'

export default function SubscriptionPriceAlerts() {
  const { formatAmount } = usePrivacy()
  const [increases, setIncreases] = useState<
    { title: string; currentAmount: number; previousAmount: number; currency: string; increasePercent: number }[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [{ data: changesData, error: changesError }, { data: recurringData, error: recurringError }] =
          await Promise.all([
            supabase.rpc('get_recurring_price_changes'),
            supabase.from('recurring_expenses').select('*').eq('user_id', user.id),
          ])

        if (changesError) throw changesError
        if (recurringError) throw recurringError

        const changes: PriceChange[] = (changesData ?? []).map((row) => ({
          recurringExpenseId: row.recurring_expense_id,
          currentAmount: Number(row.current_amount),
          previousAmount: row.previous_amount !== null ? Number(row.previous_amount) : null,
          currency: row.currency,
        }))

        const titleById = new Map<string, string>(
          (recurringData as RecurringExpense[] ?? []).map((r) => [r.id, r.title])
        )

        const priceIncreases = detectPriceIncreases(changes)
          .filter((inc) => titleById.has(inc.recurringExpenseId))
          .map((inc) => ({
            title: titleById.get(inc.recurringExpenseId) as string,
            currentAmount: inc.currentAmount,
            previousAmount: inc.previousAmount as number,
            currency: inc.currency,
            increasePercent: inc.increasePercent,
          }))

        setIncreases(priceIncreases)
      } catch (err) {
        console.error('Error revisando aumentos de suscripciones:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading || increases.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={16} className="text-amber-600" />
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Aumentaron de precio</h3>
      </div>
      <ul className="space-y-1.5">
        {increases.map((inc) => (
          <li key={inc.title} className="text-xs text-gray-600 dark:text-gray-400">
            <span className="font-bold text-gray-800 dark:text-gray-200">{inc.title}</span> subió{' '}
            <span className="font-bold text-amber-600">{inc.increasePercent.toFixed(0)}%</span> —{' '}
            {inc.currency === 'USD' ? 'USD ' : ''}
            {formatAmount(inc.previousAmount)} → {formatAmount(inc.currentAmount)}
          </li>
        ))}
      </ul>
    </div>
  )
}
