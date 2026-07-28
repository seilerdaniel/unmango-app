'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { RecurringExpense } from '@/types'
import { usePrivacy } from '@/context/PrivacyContext'
import { useCategories } from '@/context/CategoriesContext'
import { Repeat, Plus, Trash2, CheckCircle2, Calendar, Power, AlertTriangle } from 'lucide-react'

interface RecurringManagerProps {
  onTransactionAdded?: () => void
}

// Ventana dentro de la cual avisamos que una suscripción está por vencer.
// Nota de alcance: esto es un aviso DENTRO de la app (no un email/push).
// Un recordatorio real que llegue aunque no abras UnMango necesitaría un
// cron en Supabase (Edge Function + pg_cron) más un servicio de email —
// eso requiere credenciales que no tenemos en esta sesión. Ver AUDIT.md.
const DUE_SOON_DAYS = 7

/**
 * Calcula cuántos días faltan para el próximo vencimiento de una
 * suscripción, dado el día de facturación (1-31). Si el mes actual no
 * tiene ese día (ej. 31 en febrero), usa el último día del mes.
 */
function daysUntilNextBilling(billingDay: number): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const clampToLastDayOfMonth = (year: number, month: number, day: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate()
    return Math.min(day, lastDay)
  }

  const year = today.getFullYear()
  const month = today.getMonth()

  let nextBilling = new Date(year, month, clampToLastDayOfMonth(year, month, billingDay))
  if (nextBilling < today) {
    nextBilling = new Date(year, month + 1, clampToLastDayOfMonth(year, month + 1, billingDay))
  }

  const diffMs = nextBilling.getTime() - today.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export default function RecurringManager({ onTransactionAdded }: RecurringManagerProps) {
  const { categories } = useCategories()
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [billingDay, setBillingDay] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [impactingId, setImpactingId] = useState<string | null>(null)

  const { isPrivate, formatAmount } = usePrivacy()

  // Carga inicial segura para React 19
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: recData } = await supabase
          .from('recurring_expenses')
          .select('*, categories(*)')
          .eq('user_id', user.id)
          .order('billing_day', { ascending: true })

        if (isMounted && recData) setRecurring(recData)
      } catch (err) {
        console.error('Error al cargar gastos recurrentes:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [])

  const reloadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: recData } = await supabase
        .from('recurring_expenses')
        .select('*, categories(*)')
        .eq('user_id', user.id)
        .order('billing_day', { ascending: true })

      if (recData) setRecurring(recData)
    } catch (err) {
      console.error('Error recargando suscripciones:', err)
    }
  }

  const handleAddRecurring = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !amount || !billingDay || Number(amount) <= 0) return

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setSubmitting(false)
      return
    }

    const { error } = await supabase.from('recurring_expenses').insert([
      {
        user_id: user.id,
        title,
        amount: Number(amount),
        currency,
        billing_day: Number(billingDay),
        category_id: categoryId || null,
        is_active: true
      }
    ])

    if (!error) {
      setTitle('')
      setAmount('')
      setBillingDay('')
      setCategoryId('')
      setCurrency('ARS')
      await reloadData()
    } else {
      alert('Error al agregar la suscripción: ' + error.message)
      console.error('Error agregando suscripción:', error)
    }

    setSubmitting(false)
  }

  const handleToggleActive = async (item: RecurringExpense) => {
    if (!item.id) return
    const newStatus = !item.is_active

    // Optimistic UI Update
    setRecurring((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, is_active: newStatus } : r))
    )

    const { error } = await supabase
      .from('recurring_expenses')
      .update({ is_active: newStatus })
      .eq('id', item.id)

    if (error) {
      alert('Error al actualizar la suscripción: ' + error.message)
      console.error('Error actualizando estado:', error)
      await reloadData()
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
    if (!error) {
      setRecurring((prev) => prev.filter((r) => r.id !== id))
    } else {
      alert('Error al eliminar la suscripción: ' + error.message)
      console.error('Error eliminando suscripción:', error)
    }
  }

  // Registrar la suscripción como un gasto real en las transacciones
  const handleImpactTransaction = async (item: RecurringExpense) => {
    if (!item.id) return

    // Si es en USD necesitamos una cotización real para calcular el ARS,
    // en vez del multiplicador fijo *1000 que quedaba desactualizado.
    let exchangeRate: number | null = null
    let amountArs = Number(item.amount)

    if (item.currency === 'USD') {
      const rateInput = window.prompt(
        `Cotización actual del dólar para registrar "${item.title}":`,
        '1200'
      )
      if (rateInput === null) return // el usuario canceló
      exchangeRate = Number(rateInput)
      if (!exchangeRate || exchangeRate <= 0) {
        alert('Cotización inválida. No se registró el pago.')
        return
      }
      amountArs = Number(item.amount) * exchangeRate
    }

    setImpactingId(item.id)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setImpactingId(null)
      return
    }

    // Campos alineados con el tipo Transaction / schema real de la tabla
    // (antes se mandaban "title" y "notes", que no existen, y faltaban
    // "description", "payment_method" e "is_usd", que son requeridos).
    const { error } = await supabase.from('transactions').insert([
      {
        user_id: user.id,
        type: 'expense',
        description: `[Suscripción] ${item.title}`,
        payment_method: 'Transferencia',
        is_usd: item.currency === 'USD',
        amount_usd: item.currency === 'USD' ? Number(item.amount) : null,
        exchange_rate: exchangeRate,
        amount_ars: amountArs,
        category_id: item.category_id || null,
      }
    ])

    if (!error) {
      if (onTransactionAdded) onTransactionAdded()
    } else {
      alert('Error al registrar el pago: ' + error.message)
      console.error('Error al registrar transacción:', error)
    }

    setImpactingId(null)
  }


  const totalFixedARS = recurring
    .filter((r) => r.is_active && r.currency === 'ARS')
    .reduce((acc, r) => acc + Number(r.amount), 0)

  const dueSoon = recurring
    .filter((r) => r.is_active)
    .map((r) => ({ ...r, daysLeft: daysUntilNextBilling(r.billing_day) }))
    .filter((r) => r.daysLeft <= DUE_SOON_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando suscripciones...</p>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-900">Suscripciones y Gastos Fijos</h2>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Fijo Comprometido</span>
          <span className="text-xs font-black text-indigo-700">
            {isPrivate ? '••••••' : formatAmount(totalFixedARS)}
          </span>
        </div>
      </div>

      {dueSoon.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold px-3.5 py-2.5 rounded-xl">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Vencen pronto:{' '}
            {dueSoon
              .map((r) => `${r.title} (${r.daysLeft <= 0 ? 'hoy' : `en ${r.daysLeft}d`})`)
              .join(', ')}
          </span>
        </div>
      )}

      {/* Formulario de Alta */}
      <form onSubmit={handleAddRecurring} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        <input
          type="text"
          placeholder="Servicio (ej. Netflix)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="flex gap-1">
          <input
            type="number"
            placeholder="Monto"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            min="1"
            step="any"
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as 'ARS' | 'USD')}
            className="text-xs bg-gray-100 border border-gray-200 rounded-xl px-2 font-bold text-gray-700 focus:outline-none"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <input
          type="number"
          placeholder="Día del mes (1-31)"
          value={billingDay}
          onChange={(e) => setBillingDay(e.target.value)}
          required
          min="1"
          max="31"
          className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Categoría (Opcional)...</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:col-span-2 lg:col-span-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <Plus size={16} /> {submitting ? 'Guardando...' : 'Agregar'}
        </button>
      </form>

      {/* Lista de Suscripciones */}
      {recurring.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          No tenés suscripciones o gastos fijos registrados.
        </p>
      ) : (
        <div className="space-y-2.5 pt-2">
          {recurring.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border transition-all flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 ${
                item.is_active ? 'bg-gray-50/60 border-gray-100' : 'bg-gray-100/40 border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggleActive(item)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    item.is_active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-500'
                  }`}
                  title={item.is_active ? 'Pausar suscripción' : 'Activar suscripción'}
                >
                  <Power size={14} />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{item.title}</span>
                    {item.categories && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-md font-medium text-white"
                        style={{ backgroundColor: item.categories.color || '#94a3b8' }}
                      >
                        {item.categories.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                    <Calendar size={12} />
                    <span>Vence el día {item.billing_day} de cada mes</span>
                    {item.is_active && daysUntilNextBilling(item.billing_day) <= DUE_SOON_DAYS && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {daysUntilNextBilling(item.billing_day) <= 0
                          ? 'Vence hoy'
                          : `Vence en ${daysUntilNextBilling(item.billing_day)}d`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-xs font-extrabold text-gray-900">
                  {isPrivate
                    ? '••••••'
                    : item.currency === 'USD'
                    ? `USD $${item.amount}`
                    : formatAmount(item.amount)}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleImpactTransaction(item)}
                    disabled={!item.is_active || impactingId === item.id}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 text-[11px] font-bold py-1 px-2.5 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Pagar / Registrar en gastos de este mes"
                  >
                    <CheckCircle2 size={13} />
                    {impactingId === item.id ? 'Impactando...' : 'Pagar'}
                  </button>

                  <button
                    onClick={() => item.id && handleDelete(item.id)}
                    className="text-gray-400 hover:text-rose-600 transition p-1 cursor-pointer"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}