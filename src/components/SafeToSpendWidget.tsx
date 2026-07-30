'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePrivacy } from '@/context/PrivacyContext'
import { computeSafeToSpend } from '@/lib/safeToSpend'
import { monthlyEquivalentAmount } from '@/lib/recurringBilling'
import { Wallet as WalletIcon } from 'lucide-react'

export default function SafeToSpendWidget() {
  const { isPrivate, formatAmount } = usePrivacy()
  const [safeAmount, setSafeAmount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const now = new Date()
        const dayOfMonth = now.getDate()
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        // +1 porque el día de hoy también cuenta como "día disponible para gastar".
        const daysRemaining = daysInMonth - dayOfMonth + 1

        const [totalsResult, recurringResult] = await Promise.all([
          supabase.rpc('get_transaction_totals'),
          supabase
            .from('recurring_expenses')
            .select('amount, currency, billing_frequency')
            .eq('user_id', user.id)
            .eq('is_active', true),
        ])

        if (totalsResult.error) throw totalsResult.error
        if (recurringResult.error) throw recurringResult.error

        const totalIncome = Number(totalsResult.data?.[0]?.total_income) || 0
        const totalExpense = Number(totalsResult.data?.[0]?.total_expense) || 0
        const availableBalance = totalIncome - totalExpense

        // Mismo criterio que "Fijo Comprometido": solo ARS, prorrateando
        // las anuales a su equivalente mensual.
        const fixedCommitments = (recurringResult.data ?? [])
          .filter((r) => r.currency === 'ARS')
          .reduce((acc, r) => acc + monthlyEquivalentAmount(Number(r.amount), r.billing_frequency), 0)

        setSafeAmount(computeSafeToSpend(availableBalance, fixedCommitments, daysRemaining))
      } catch (err) {
        console.error('Error calculando el límite seguro de gasto diario:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading || safeAmount === null) return null

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <WalletIcon size={16} className="text-emerald-600" />
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Podés gastar hoy</h3>
      </div>
      <p className="text-2xl font-extrabold text-emerald-600">
        {isPrivate ? '••••••' : formatAmount(safeAmount)}
      </p>
      <p className="text-[10px] text-gray-400 mt-1">
        Sin salirte de tu presupuesto — ya descontamos tus gastos fijos comprometidos del mes.
      </p>
    </div>
  )
}
