'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { usePrivacy } from '@/context/PrivacyContext'
import { useUser } from '@/context/UserContext'
import { computeDebtProgress, daysOverdue } from '@/lib/debts'
import { applyTax } from '@/lib/applyTax'
import { Debt } from '@/types'
import SplitExpenseTool from '@/components/SplitExpenseTool'
import { sortDebts, filterDebtsByType, DebtSortField } from '@/lib/debtsSort'
import { HandCoins, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'

const emptyForm = {
  description: '',
  counterpartyName: '',
  debtType: 'debo' as 'debo' | 'me_deben',
  currency: 'ARS' as 'ARS' | 'USD',
  totalAmount: '',
  interestRate: '',
  dueDate: '',
  notes: '',
}

interface DebtsManagerProps {
  onTransactionAdded?: () => void
}

export default function DebtsManager({ onTransactionAdded }: DebtsManagerProps) {
  const { user } = useUser()
  const { isPrivate, formatAmount } = usePrivacy()
  const [debts, setDebts] = useState<Debt[]>([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [showPaidOff, setShowPaidOff] = useState(false)
  const [sortField, setSortField] = useState<DebtSortField>('dueDate')
  const [sortAscending, setSortAscending] = useState(true)
  const [filterType, setFilterType] = useState('all')

  const loadDebts = useCallback(async () => {
    try {
      if (!user) return

      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false })

      if (error) throw error
      setDebts(data ?? [])
    } catch (err) {
      console.error('Error cargando deudas:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadDebts()
  }, [loadDebts])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim() || !form.counterpartyName.trim() || !form.totalAmount || Number(form.totalAmount) <= 0) return

    setSubmitting(true)
    if (!user) {
      setSubmitting(false)
      return
    }

    const { error } = await supabase.from('debts').insert([
      {
        user_id: user.id,
        description: form.description.trim(),
        counterparty_name: form.counterpartyName.trim(),
        debt_type: form.debtType,
        currency: form.currency,
        total_amount: Number(form.totalAmount),
        remaining_amount: Number(form.totalAmount),
        interest_rate: Number(form.interestRate) || 0,
        due_date: form.dueDate || null,
        notes: form.notes.trim() || null,
      },
    ])

    if (!error) {
      setForm(emptyForm)
      await loadDebts()
    } else {
      alert('Error al crear la deuda: ' + error.message)
      console.error('Error creando deuda:', error)
    }
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este registro? Los pagos/cobros ya registrados quedan en tu historial de todos modos.')) return

    const { error } = await supabase.from('debts').delete().eq('id', id)
    if (!error) {
      setDebts((prev) => prev.filter((d) => d.id !== id))
    } else {
      alert('Error al eliminar: ' + error.message)
      console.error('Error eliminando deuda:', error)
    }
  }

  async function handleRegisterPayment(debt: Debt) {
    const actionLabel = debt.debt_type === 'debo' ? 'pagaste' : 'te pagaron'
    const input = window.prompt(`¿Cuánto ${actionLabel} de "${debt.description}"?`, String(debt.remaining_amount))
    if (input === null) return

    const amount = Number(input)
    if (!amount || amount <= 0) {
      alert('Monto inválido.')
      return
    }

    setPayingId(debt.id)
    if (!user) {
      setPayingId(null)
      return
    }

    const newRemaining = Math.max(0, Number(debt.remaining_amount) - amount)

    const { error: updateError } = await supabase
      .from('debts')
      .update({ remaining_amount: newRemaining })
      .eq('id', debt.id)

    if (updateError) {
      alert('Error al registrar el pago: ' + updateError.message)
      console.error('Error actualizando deuda:', updateError)
      setPayingId(null)
      return
    }

    // Además de actualizar el saldo de la deuda, registramos el
    // movimiento real: si "debo" y pago, es un gasto; si "me deben" y
    // me pagan, es un ingreso.
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: user.id,
          type: debt.debt_type === 'debo' ? 'expense' : 'income',
          description: `[${debt.debt_type === 'debo' ? 'Pago deuda' : 'Cobro préstamo'}] ${debt.description} (${debt.counterparty_name})`,
          payment_method: 'Efectivo',
          is_usd: debt.currency === 'USD',
          amount_usd: debt.currency === 'USD' ? amount : null,
          amount_ars: amount,
          exchange_rate: null,
          category_id: null,
        },
      ])
      .select('id')
      .single()

    if (!txError && txData) {
      await supabase.from('debt_payments').insert([
        { debt_id: debt.id, user_id: user.id, amount, transaction_id: txData.id },
      ])
    } else if (txError) {
      console.error('El saldo de la deuda se actualizó pero no se pudo registrar la transacción:', txError)
    }

    await loadDebts()
    if (onTransactionAdded) onTransactionAdded()
    setPayingId(null)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando deudas y préstamos...</p>
      </div>
    )
  }

  const activeDebts = debts.filter((d) => Number(d.remaining_amount) > 0)
  const paidOffDebts = debts.filter((d) => Number(d.remaining_amount) <= 0)

  const totalIOwe = activeDebts
    .filter((d) => d.debt_type === 'debo' && d.currency === 'ARS')
    .reduce((acc, d) => acc + applyTax(Number(d.remaining_amount), d.interest_rate), 0)
  const totalOwedToMe = activeDebts
    .filter((d) => d.debt_type === 'me_deben' && d.currency === 'ARS')
    .reduce((acc, d) => acc + applyTax(Number(d.remaining_amount), d.interest_rate), 0)

  return (
    <div id="deudas-prestamos" className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <HandCoins className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Deudas y Préstamos</h2>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Debo</span>
            <span className="text-xs font-black text-rose-600">{isPrivate ? '••••••' : formatAmount(totalIOwe)}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Me deben</span>
            <span className="text-xs font-black text-emerald-600">{isPrivate ? '••••••' : formatAmount(totalOwedToMe)}</span>
          </div>
        </div>
      </div>

      <SplitExpenseTool onDebtCreated={loadDebts} />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        <input
          type="text"
          placeholder="Descripción"
          title="Ej: Préstamo para el viaje"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          required
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        />
        <input
          type="text"
          placeholder="¿Con quién?"
          title="Ej: Mi hermano, Juan"
          value={form.counterpartyName}
          onChange={(e) => setForm((f) => ({ ...f, counterpartyName: e.target.value }))}
          required
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        />
        <select
          value={form.debtType}
          onChange={(e) => setForm((f) => ({ ...f, debtType: e.target.value as 'debo' | 'me_deben' }))}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        >
          <option value="debo">Yo debo</option>
          <option value="me_deben">Me deben</option>
        </select>
        <div className="flex gap-1">
          <input
            type="number"
            placeholder="Monto"
            value={form.totalAmount}
            onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
            required
            min="1"
            step="any"
            className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
          />
          <select
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as 'ARS' | 'USD' }))}
            className="text-xs bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-2 font-bold text-gray-700 dark:text-gray-300"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <input
          type="date"
          title="Fecha límite (opcional)"
          value={form.dueDate}
          onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        />
        <input
          type="number"
          placeholder="Interés % (opcional)"
          value={form.interestRate}
          onChange={(e) => setForm((f) => ({ ...f, interestRate: e.target.value }))}
          min="0"
          step="any"
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        />
        <input
          type="text"
          placeholder="Notas (opcional)"
          title="Ej: acordamos pagar en 3 cuotas"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <Plus size={16} /> {submitting ? 'Guardando...' : 'Agregar'}
        </button>
      </form>

      {activeDebts.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No tenés deudas ni préstamos activos.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 font-semibold text-gray-600 dark:text-gray-300"
            >
              <option value="all">Todos</option>
              <option value="debo">Yo debo</option>
              <option value="me_deben">Me deben</option>
            </select>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as DebtSortField)}
              className="text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 font-semibold text-gray-600 dark:text-gray-300"
            >
              <option value="dueDate">Ordenar por vencimiento</option>
              <option value="name">Ordenar por nombre</option>
              <option value="amount">Ordenar por monto</option>
            </select>
            <button
              onClick={() => setSortAscending((v) => !v)}
              title={sortAscending ? 'Ascendente' : 'Descendente'}
              className="text-[11px] font-bold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 cursor-pointer"
            >
              {sortAscending ? '↑' : '↓'}
            </button>
          </div>

        <div className="space-y-2.5 pt-2">
          {sortDebts(filterDebtsByType(activeDebts, filterType), sortField, sortAscending).map((debt) => {
            const progress = computeDebtProgress(Number(debt.total_amount), Number(debt.remaining_amount))
            const overdueDays = daysOverdue(debt.due_date)
            const isOverdue = overdueDays !== null && overdueDays > 0
            const isDebo = debt.debt_type === 'debo'

            return (
              <div
                key={debt.id}
                className={`p-3.5 rounded-xl border space-y-2 ${
                  isDebo
                    ? 'bg-rose-50/40 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/40'
                    : 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/40'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md text-white ${
                        isDebo ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                    >
                      {isDebo ? 'Yo debo' : 'Me deben'}
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{debt.description}</span>
                    <span className="text-[11px] text-gray-400">— {debt.counterparty_name}</span>
                    {isOverdue && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400">
                        <AlertTriangle size={11} /> Vencida hace {overdueDays}d
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(debt.id)}
                    className="text-gray-400 hover:text-rose-600 transition p-1 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${isDebo ? 'bg-rose-500' : 'bg-emerald-500'}`}
                    style={{ width: `${progress.paidPercent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 flex-wrap gap-2">
                  <span>
                    {isPrivate
                      ? '••••••'
                      : `${debt.currency === 'USD' ? 'USD ' : ''}${formatAmount(Number(debt.remaining_amount))} de ${formatAmount(Number(debt.total_amount))} restante`}
                  </span>
                  <button
                    onClick={() => handleRegisterPayment(debt)}
                    disabled={payingId === debt.id}
                    className={`font-bold py-1 px-2.5 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-40 ${
                      isDebo
                        ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-200'
                        : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200'
                    }`}
                  >
                    <CheckCircle2 size={12} />
                    {payingId === debt.id ? 'Guardando...' : isDebo ? 'Registrar pago' : 'Registrar cobro'}
                  </button>
                </div>

                {debt.notes && <p className="text-[11px] text-gray-400 italic">{debt.notes}</p>}
              </div>
            )
          })}
        </div>
        </>
      )}

      {paidOffDebts.length > 0 && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setShowPaidOff((v) => !v)}
            className="text-[11px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
          >
            {showPaidOff ? 'Ocultar' : 'Ver'} {paidOffDebts.length} saldada(s) ✓
          </button>
          {showPaidOff && (
            <div className="mt-2 space-y-1.5">
              {paidOffDebts.map((debt) => (
                <div key={debt.id} className="flex items-center justify-between text-[11px] text-gray-400">
                  <span>
                    {debt.description} — {debt.counterparty_name}
                  </span>
                  <button onClick={() => handleDelete(debt.id)} className="hover:text-rose-600 cursor-pointer">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
