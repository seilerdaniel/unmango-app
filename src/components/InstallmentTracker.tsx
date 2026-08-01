'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { useCategories } from '@/context/CategoriesContext'
import { usePrivacy } from '@/context/PrivacyContext'
import { useToast } from '@/context/ToastContext'
import { computeInstallmentSchedule } from '@/lib/installments'
import { InstallmentPurchase } from '@/types'
import InstallmentsVsCashSimulator from '@/components/InstallmentsVsCashSimulator'
import { sortInstallmentPurchases, InstallmentSortField } from '@/lib/installmentsSort'
import { CreditCard, Plus, Trash2, CheckCircle2 } from 'lucide-react'

interface PurchaseWithPayments extends InstallmentPurchase {
  paidInstallmentNumbers: number[]
}

export default function InstallmentTracker({ onTransactionAdded }: { onTransactionAdded?: () => void }) {
  const { user } = useUser()
  const { categories } = useCategories()
  const { isPrivate, formatAmount } = usePrivacy()
  const { toast, confirmDialog } = useToast()

  const [purchases, setPurchases] = useState<PurchaseWithPayments[]>([])
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [installmentsCount, setInstallmentsCount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<InstallmentSortField>('name')
  const [sortAscending, setSortAscending] = useState(true)

  const loadPurchases = useCallback(async () => {
    try {
      if (!user) return

      const { data: purchasesData, error: purchasesError } = await supabase
        .from('installment_purchases')
        .select('*, categories(name, color)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (purchasesError) throw purchasesError

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('installment_payments')
        .select('installment_purchase_id, installment_number')
        .eq('user_id', user.id)

      if (paymentsError) throw paymentsError

      const paidByPurchase = new Map<string, number[]>()
      for (const p of paymentsData ?? []) {
        const list = paidByPurchase.get(p.installment_purchase_id) ?? []
        list.push(p.installment_number)
        paidByPurchase.set(p.installment_purchase_id, list)
      }

      setPurchases(
        (purchasesData ?? []).map((p) => ({
          ...p,
          paidInstallmentNumbers: paidByPurchase.get(p.id) ?? [],
        }))
      )
    } catch (err) {
      console.error('Error cargando compras en cuotas:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    // loadPurchases es async; sus setState ocurren post-await, no
    // sincrónicos en el effect (falso positivo de la regla).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPurchases()
  }, [loadPurchases])

  async function handleAddPurchase(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim() || !totalAmount || !installmentsCount) return

    setSubmitting(true)

    if (user) {
      const { error } = await supabase.from('installment_purchases').insert([
        {
          user_id: user.id,
          description: description.trim(),
          total_amount: Number(totalAmount),
          installments_count: Number(installmentsCount),
          category_id: categoryId || null,
          payment_method: paymentMethod || null,
          notes: notes.trim() || null,
        },
      ])

      if (!error) {
        setDescription('')
        setTotalAmount('')
        setInstallmentsCount('')
        setCategoryId('')
        setPaymentMethod('')
        setNotes('')
        await loadPurchases()
      } else {
        toast.error('Error al crear la compra en cuotas: ' + error.message)
        console.error('Error creando compra en cuotas:', error)
      }
    }
    setSubmitting(false)
  }

  async function handleDeletePurchase(id: string) {
    const ok = await confirmDialog({
      title: 'Eliminar compra en cuotas',
      message: '¿Eliminar esta compra en cuotas? Las cuotas ya pagadas quedan en tu historial de todos modos.',
      confirmText: 'Eliminar',
      variant: 'danger',
    })
    if (!ok) return

    const { error } = await supabase.from('installment_purchases').delete().eq('id', id)
    if (!error) {
      setPurchases((prev) => prev.filter((p) => p.id !== id))
    } else {
      toast.error('Error al eliminar: ' + error.message)
      console.error('Error eliminando compra en cuotas:', error)
    }
  }

  async function handlePayNextInstallment(purchase: PurchaseWithPayments) {
    const schedule = computeInstallmentSchedule(
      Number(purchase.total_amount),
      purchase.installments_count,
      new Date(`${purchase.first_installment_date}T00:00:00`)
    )
    const nextItem = schedule.find((s) => !purchase.paidInstallmentNumbers.includes(s.installmentNumber))
    if (!nextItem) return

    setPayingId(purchase.id)
    if (!user) {
      setPayingId(null)
      return
    }

    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .insert([
        {
          user_id: user.id,
          type: 'expense',
          description: `[Cuota ${nextItem.installmentNumber}/${purchase.installments_count}] ${purchase.description}`,
          payment_method: purchase.payment_method || 'Tarjeta de Crédito',
          is_usd: false,
          amount_usd: null,
          amount_ars: nextItem.amount,
          exchange_rate: null,
          category_id: purchase.category_id,
        },
      ])
      .select('id')
      .single()

    if (txError || !txData) {
      toast.error('Error al registrar el pago: ' + txError?.message)
      console.error('Error pagando cuota:', txError)
      setPayingId(null)
      return
    }

    const { error: paymentError } = await supabase.from('installment_payments').insert([
      {
        installment_purchase_id: purchase.id,
        user_id: user.id,
        installment_number: nextItem.installmentNumber,
        transaction_id: txData.id,
      },
    ])

    if (paymentError) {
      toast.error('El gasto se registró pero hubo un error marcando la cuota como pagada: ' + paymentError.message)
      console.error('Error registrando installment_payment:', paymentError)
    }

    await loadPurchases()
    if (onTransactionAdded) onTransactionAdded()
    setPayingId(null)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando compras en cuotas...</p>
      </div>
    )
  }

  return (
    <div id="cuotas" className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <CreditCard className="text-violet-600" size={20} /> Compras en Cuotas
      </h2>

      <InstallmentsVsCashSimulator />

      <form onSubmit={handleAddPurchase} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        <input
          type="text"
          placeholder="Descripción"
          title="Ej: Notebook"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        />
        <input
          type="number"
          placeholder="Monto total"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          required
          min="1"
          step="any"
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        />
        <input
          type="number"
          placeholder="Cuotas"
          value={installmentsCount}
          onChange={(e) => setInstallmentsCount(e.target.value)}
          required
          min="1"
          max="60"
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        >
          <option value="">Categoría (opcional)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        >
          <option value="">Medio de pago (opcional)</option>
          <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
          <option value="Tarjeta de Débito">Tarjeta de Débito</option>
          <option value="Billetera Virtual">Billetera Virtual</option>
          <option value="Transferencia">Transferencia</option>
          <option value="Efectivo">Efectivo</option>
        </select>
        <input
          type="text"
          placeholder="Notas"
          title="Ej: es una devolución a mi hermano, cuotas sin interés, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-300"
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <Plus size={16} /> {submitting ? 'Guardando...' : 'Agregar'}
        </button>
      </form>

      {purchases.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">No tenés compras en cuotas registradas.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as InstallmentSortField)}
              className="text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 font-semibold text-gray-600 dark:text-gray-300"
            >
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

        <div className="space-y-3">
          {sortInstallmentPurchases(purchases, sortField, sortAscending).map((purchase) => {
            const schedule = computeInstallmentSchedule(
              Number(purchase.total_amount),
              purchase.installments_count,
              new Date(`${purchase.first_installment_date}T00:00:00`)
            )
            const paidCount = purchase.paidInstallmentNumbers.length
            const isComplete = paidCount >= purchase.installments_count
            const nextItem = schedule.find((s) => !purchase.paidInstallmentNumbers.includes(s.installmentNumber))

            return (
              <div key={purchase.id} className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate block">{purchase.description}</span>
                    {purchase.payment_method && (
                      <span className="text-[10px] text-gray-400">{purchase.payment_method}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePurchase(purchase.id)}
                    className="text-gray-400 hover:text-rose-600 transition p-1 cursor-pointer shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {purchase.notes && (
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">{purchase.notes}</p>
                )}

                <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 transition-all duration-500"
                    style={{ width: `${(paidCount / purchase.installments_count) * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 flex-wrap gap-2">
                  <span>
                    {paidCount} de {purchase.installments_count} cuotas pagadas —{' '}
                    {isPrivate ? '••••••' : formatAmount(Number(purchase.total_amount))} total
                  </span>
                  {!isComplete && nextItem && (
                    <button
                      onClick={() => handlePayNextInstallment(purchase)}
                      disabled={payingId === purchase.id}
                      className="bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900 font-bold py-1 px-2.5 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-40 shrink-0"
                    >
                      <CheckCircle2 size={12} />
                      {payingId === purchase.id
                        ? 'Pagando...'
                        : `Pagar cuota ${nextItem.installmentNumber} (${formatAmount(nextItem.amount)})`}
                    </button>
                  )}
                  {isComplete && <span className="text-emerald-600 font-bold">Completado ✓</span>}
                </div>
              </div>
            )
          })}
        </div>
        </>
      )}
    </div>
  )
}
