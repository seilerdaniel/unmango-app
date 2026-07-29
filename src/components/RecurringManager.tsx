'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { RecurringExpense, Wallet } from '@/types'
import { usePrivacy } from '@/context/PrivacyContext'
import { useCategories } from '@/context/CategoriesContext'
import { Repeat, Plus, Trash2, CheckCircle2, Calendar, Power, AlertTriangle, Pencil, X } from 'lucide-react'
import { applyTax } from '@/lib/applyTax'

interface RecurringManagerProps {
  onTransactionAdded?: () => void
}

// Ventana dentro de la cual avisamos que una suscripción está por vencer.
// Nota de alcance: esto es un aviso DENTRO de la app (no un email/push).
// Un recordatorio real que llegue aunque no abras UnMango necesitaría un
// cron en Supabase (Edge Function + pg_cron) más un servicio de email —
// eso requiere credenciales que no tenemos en esta sesión. Ver AUDIT.md.
const DUE_SOON_DAYS = 7

const PAYMENT_METHODS = ['Billetera Virtual', 'Efectivo', 'Transferencia', 'Tarjeta de Crédito', 'Tarjeta de Débito']

// A qué tipo(s) de billetera corresponde cada medio de pago, para
// filtrar el selector de "cuál billetera puntual" y no mostrar, por
// ejemplo, tarjetas de crédito cuando el medio de pago es "Efectivo".
const WALLET_TYPES_BY_PAYMENT_METHOD: Record<string, Wallet['type'][]> = {
  'Billetera Virtual': ['virtual_wallet'],
  Efectivo: ['cash'],
  Transferencia: ['bank'],
  'Tarjeta de Crédito': ['credit_card'],
  'Tarjeta de Débito': ['debit_card'],
}

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

const emptyForm = {
  title: '',
  amount: '',
  billingDay: '',
  categoryId: '',
  currency: 'ARS' as 'ARS' | 'USD',
  paymentMethod: '',
  walletId: '',
  membershipType: '',
  taxPercentage: '',
}

export default function RecurringManager({ onTransactionAdded }: RecurringManagerProps) {
  const { categories } = useCategories()
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [impactingId, setImpactingId] = useState<string | null>(null)

  const { isPrivate, formatAmount } = usePrivacy()

  async function loadWallets() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (data) setWallets(data)
  }

  // Carga inicial segura para React 19
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const [{ data: recData }] = await Promise.all([
          supabase
            .from('recurring_expenses')
            .select('*, categories(*)')
            .eq('user_id', user.id)
            .order('billing_day', { ascending: true }),
          loadWallets(),
        ])

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

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  function startEditing(item: RecurringExpense) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      amount: String(item.amount),
      billingDay: String(item.billing_day),
      categoryId: item.category_id || '',
      currency: item.currency,
      paymentMethod: item.payment_method || '',
      walletId: item.wallet_id || '',
      membershipType: item.membership_type || '',
      taxPercentage: item.tax_percentage ? String(item.tax_percentage) : '',
    })
    // Llevamos la vista arriba, al formulario, para que quede claro que
    // se está editando (si no, el usuario no ve el cambio si la lista es
    // larga y el formulario quedó scrolleado fuera de vista).
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.amount || !form.billingDay || Number(form.amount) <= 0) return

    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setSubmitting(false)
      return
    }

    const payload = {
      title: form.title,
      amount: Number(form.amount),
      currency: form.currency,
      billing_day: Number(form.billingDay),
      category_id: form.categoryId || null,
      payment_method: form.paymentMethod || null,
      wallet_id: form.walletId || null,
      membership_type: form.membershipType || null,
      tax_percentage: Number(form.taxPercentage) || 0,
    }

    const { error } = editingId
      ? await supabase.from('recurring_expenses').update(payload).eq('id', editingId)
      : await supabase.from('recurring_expenses').insert([{ ...payload, user_id: user.id, is_active: true }])

    if (!error) {
      resetForm()
      await reloadData()
    } else {
      alert(`Error al ${editingId ? 'editar' : 'agregar'} la suscripción: ` + error.message)
      console.error(`Error ${editingId ? 'editando' : 'agregando'} suscripción:`, error)
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
      if (editingId === id) resetForm()
    } else {
      alert('Error al eliminar la suscripción: ' + error.message)
      console.error('Error eliminando suscripción:', error)
    }
  }

  // Registrar la suscripción como un gasto real en las transacciones
  const handleImpactTransaction = async (item: RecurringExpense) => {
    if (!item.id) return

    // El monto cargado es el precio de lista, que en general NO incluye
    // impuestos (IVA, impuesto PAIS en suscripciones del exterior, etc.)
    // — se aplica el % configurado para registrar el gasto real.
    const taxedAmount = applyTax(Number(item.amount), item.tax_percentage ?? 0)

    // Si es en USD necesitamos una cotización real para calcular el ARS,
    // en vez del multiplicador fijo *1000 que quedaba desactualizado.
    let exchangeRate: number | null = null
    let amountArs = taxedAmount

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
      amountArs = taxedAmount * exchangeRate
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
    // wallet_id se copia de la suscripción para que el pago también
    // impacte el saldo de la billetera/tarjeta correspondiente.
    const { error } = await supabase.from('transactions').insert([
      {
        user_id: user.id,
        type: 'expense',
        description: `[Suscripción] ${item.title}`,
        payment_method: item.payment_method || 'Transferencia',
        wallet_id: item.wallet_id || null,
        is_usd: item.currency === 'USD',
        amount_usd: item.currency === 'USD' ? taxedAmount : null,
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
    .reduce((acc, r) => acc + applyTax(Number(r.amount), r.tax_percentage ?? 0), 0)

  const dueSoon = recurring
    .filter((r) => r.is_active)
    .map((r) => ({ ...r, daysLeft: daysUntilNextBilling(r.billing_day) }))
    .filter((r) => r.daysLeft <= DUE_SOON_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  // Billeteras relevantes para el medio de pago elegido en el formulario
  // (ej. si elegiste "Efectivo", solo billeteras de tipo cash).
  const relevantWalletTypes = WALLET_TYPES_BY_PAYMENT_METHOD[form.paymentMethod]
  const relevantWallets = relevantWalletTypes
    ? wallets.filter((w) => relevantWalletTypes.includes(w.type))
    : []

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando suscripciones...</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Suscripciones y Gastos Fijos</h2>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Fijo Comprometido</span>
          <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">
            {isPrivate ? '••••••' : formatAmount(totalFixedARS)}
          </span>
        </div>
      </div>

      {dueSoon.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 text-xs font-semibold px-3.5 py-2.5 rounded-xl">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Vencen pronto:{' '}
            {dueSoon
              .map((r) => `${r.title} (${r.daysLeft <= 0 ? 'hoy' : `en ${r.daysLeft}d`})`)
              .join(', ')}
          </span>
        </div>
      )}

      {editingId && (
        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 text-xs font-bold px-3.5 py-2 rounded-xl">
          <span>Editando &quot;{form.title}&quot;</span>
          <button onClick={resetForm} className="flex items-center gap-1 hover:underline cursor-pointer">
            <X size={12} /> Cancelar
          </button>
        </div>
      )}

      {/* Formulario de Alta / Edición */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        <input
          type="text"
          placeholder="Servicio"
          title="Ej: Netflix"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          required
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <div className="flex gap-1">
          <input
            type="number"
            placeholder="Monto"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            required
            min="1"
            step="any"
            className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value as 'ARS' | 'USD' }))}
            className="text-xs bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-2 font-bold text-gray-700 dark:text-gray-200 focus:outline-none"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <input
          type="number"
          placeholder="Día del mes"
          title="Entre 1 y 31"
          value={form.billingDay}
          onChange={(e) => setForm((f) => ({ ...f, billingDay: e.target.value }))}
          required
          min="1"
          max="31"
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <select
          value={form.categoryId}
          onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Categoría (Opcional)...</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        <select
          value={form.paymentMethod}
          onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value, walletId: '' }))}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Medio de pago (opcional)</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>

        {/* Solo aparece si el medio de pago elegido tiene billeteras
            creadas de ese tipo (ej. "Efectivo" -> billeteras tipo cash). */}
        {form.paymentMethod && relevantWallets.length > 0 && (
          <select
            value={form.walletId}
            onChange={(e) => setForm((f) => ({ ...f, walletId: e.target.value }))}
            className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">¿Cuál? (opcional)</option>
            {relevantWallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          placeholder="Membresía"
          title="Ej: Premium, Familiar, Individual"
          value={form.membershipType}
          onChange={(e) => setForm((f) => ({ ...f, membershipType: e.target.value }))}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <input
          type="number"
          placeholder="Impuestos %"
          title="% que el precio NO incluye (ej. IVA, impuesto PAIS)"
          value={form.taxPercentage}
          onChange={(e) => setForm((f) => ({ ...f, taxPercentage: e.target.value }))}
          min="0"
          step="any"
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:col-span-2 lg:col-span-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition shadow-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <Plus size={16} /> {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar'}
        </button>
      </form>

      {form.paymentMethod && relevantWallets.length === 0 && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 -mt-1">
          No tenés ninguna billetera/cuenta de tipo &quot;{form.paymentMethod}&quot; creada todavía
          — podés crear una en la sección Billeteras si querés vincular esta suscripción a una
          cuenta puntual (es opcional).
        </p>
      )}

      <p className="text-[10px] text-gray-400 dark:text-gray-500 -mt-1">
        El monto que cargás es el precio de lista — muchas suscripciones (sobre todo pagadas en
        USD desde Argentina) suman impuestos aparte. Si cargás el % de impuestos, el total real se
        calcula solo y se usa al registrar el pago.
      </p>

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
                item.is_active
                  ? 'bg-gray-50/60 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800'
                  : 'bg-gray-100/40 dark:bg-gray-800/20 border-gray-200 dark:border-gray-700 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggleActive(item)}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    item.is_active
                      ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}
                  title={item.is_active ? 'Pausar suscripción' : 'Activar suscripción'}
                >
                  <Power size={14} />
                </button>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{item.title}</span>
                    {item.categories && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-md font-medium text-white"
                        style={{ backgroundColor: item.categories.color || '#94a3b8' }}
                      >
                        {item.categories.name}
                      </span>
                    )}
                    {item.membership_type && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                        {item.membership_type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5 flex-wrap">
                    <Calendar size={12} />
                    <span>Vence el día {item.billing_day} de cada mes</span>
                    {item.payment_method && <span>· {item.payment_method}</span>}
                    {item.is_active && daysUntilNextBilling(item.billing_day) <= DUE_SOON_DAYS && (
                      <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {daysUntilNextBilling(item.billing_day) <= 0
                          ? 'Vence hoy'
                          : `Vence en ${daysUntilNextBilling(item.billing_day)}d`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <span className="text-xs font-extrabold text-gray-900 dark:text-gray-100 block">
                    {isPrivate
                      ? '••••••'
                      : item.currency === 'USD'
                      ? `USD $${item.amount}`
                      : formatAmount(item.amount)}
                  </span>
                  {!isPrivate && item.tax_percentage > 0 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">
                      c/imp: {item.currency === 'USD'
                        ? `USD $${applyTax(Number(item.amount), item.tax_percentage).toFixed(2)}`
                        : formatAmount(applyTax(Number(item.amount), item.tax_percentage))}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleImpactTransaction(item)}
                    disabled={!item.is_active || impactingId === item.id}
                    className="bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50 text-[11px] font-bold py-1 px-2.5 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Pagar / Registrar en gastos de este mes"
                  >
                    <CheckCircle2 size={13} />
                    {impactingId === item.id ? 'Impactando...' : 'Pagar'}
                  </button>

                  <button
                    onClick={() => startEditing(item)}
                    className="text-gray-400 hover:text-indigo-600 transition p-1 cursor-pointer"
                    title="Editar"
                  >
                    <Pencil size={14} />
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
