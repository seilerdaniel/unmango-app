'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePrivacy } from '@/context/PrivacyContext'
import { computeHouseholdBalance } from '@/lib/householdBalance'
import { HouseholdExpense } from '@/types'
import { Home, Plus, Trash2, Scale } from 'lucide-react'

export default function HouseholdExpenses() {
  const { formatAmount } = usePrivacy()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [partnerEmail, setPartnerEmail] = useState<string | null>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<HouseholdExpense[]>([])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  async function loadHousehold() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMyUserId(user.id)

      const { data: link } = await supabase
        .from('household_links')
        .select('*')
        .eq('status', 'active')
        .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
        .maybeSingle()

      if (!link) {
        setHouseholdId(null)
        return
      }

      setHouseholdId(link.id)
      const { data: email } = await supabase.rpc('get_household_partner_email', { p_household_id: link.id })
      setPartnerEmail(email)

      const { data: expensesData } = await supabase
        .from('household_expenses')
        .select('*')
        .eq('household_id', link.id)
        .order('created_at', { ascending: false })

      setExpenses(expensesData ?? [])
    } catch (err) {
      console.error('Error cargando gastos de hogar:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHousehold()
  }, [])

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!householdId || !myUserId || !description.trim() || Number(amount) <= 0) return

    setSubmitting(true)
    const { error } = await supabase.from('household_expenses').insert([
      {
        household_id: householdId,
        paid_by_user_id: myUserId,
        description: description.trim(),
        amount: Number(amount),
      },
    ])

    if (!error) {
      setDescription('')
      setAmount('')
      await loadHousehold()
    } else {
      alert('Error al registrar el gasto: ' + error.message)
      console.error('Error creando gasto de hogar:', error)
    }
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('household_expenses').delete().eq('id', id)
    if (!error) {
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    } else {
      alert('Error al eliminar: ' + error.message)
    }
  }

  async function handleSettleUp() {
    if (!householdId) return
    if (!confirm('¿Marcar como saldado? Esto borra todos los gastos de hogar registrados y arranca de cero (hacelo después de arreglar cuentas en la vida real).')) return

    const { error } = await supabase.from('household_expenses').delete().eq('household_id', householdId)
    if (!error) {
      setExpenses([])
    } else {
      alert('Error al liquidar: ' + error.message)
    }
  }

  if (loading) return null

  // Si no hay hogar vinculado, esta tarjeta no se muestra — la
  // vinculación se hace desde Configuración (HouseholdLink.tsx).
  if (!householdId) return null

  const totalPaidByMe = expenses.filter((e) => e.paid_by_user_id === myUserId).reduce((acc, e) => acc + Number(e.amount), 0)
  const totalPaidByPartner = expenses
    .filter((e) => e.paid_by_user_id !== myUserId)
    .reduce((acc, e) => acc + Number(e.amount), 0)
  const balance = computeHouseholdBalance(totalPaidByMe, totalPaidByPartner)

  return (
    <div id="gastos-hogar" className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Home className="text-rose-500" size={20} /> Gastos de Hogar
        </h2>
        {expenses.length > 0 && (
          <button
            onClick={handleSettleUp}
            className="text-[11px] font-bold text-gray-400 hover:text-rose-600 cursor-pointer"
          >
            Marcar como saldado
          </button>
        )}
      </div>

      {balance.totalHouseholdExpenses > 0 && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2.5 ${
            balance.netBalanceForMe >= 0
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
              : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900'
          }`}
        >
          <Scale size={18} className={balance.netBalanceForMe >= 0 ? 'text-emerald-600' : 'text-amber-600'} />
          <p className="text-xs font-bold text-gray-800 dark:text-gray-100">
            {balance.netBalanceForMe === 0
              ? 'Están a mano — pagaron lo mismo.'
              : balance.netBalanceForMe > 0
                ? `${partnerEmail || 'Tu pareja'} te debe ${formatAmount(balance.netBalanceForMe)}`
                : `Le debés a ${partnerEmail || 'tu pareja'} ${formatAmount(Math.abs(balance.netBalanceForMe))}`}
          </p>
        </div>
      )}

      <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-[1fr_150px_120px] gap-2.5">
        <input
          type="text"
          placeholder="¿Qué gasto es? (ej. Alquiler, Supermercado)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        />
        <input
          type="number"
          placeholder="Monto"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="1"
          step="any"
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <Plus size={16} /> {submitting ? 'Guardando...' : 'Agregar'}
        </button>
      </form>

      {expenses.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Todavía no cargaron ningún gasto de hogar.</p>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between gap-2 p-3 rounded-xl border border-gray-100 dark:border-gray-800"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{expense.description}</p>
                <p className="text-[10px] text-gray-400">
                  Pagó {expense.paid_by_user_id === myUserId ? 'vos' : partnerEmail || 'tu pareja'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-extrabold text-gray-900 dark:text-gray-100">
                  {formatAmount(Number(expense.amount))}
                </span>
                <button
                  onClick={() => handleDelete(expense.id)}
                  className="text-gray-400 hover:text-rose-600 transition p-1 cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
