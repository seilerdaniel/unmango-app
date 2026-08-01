'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { RecurringExpense, Wallet } from '@/types'
import { usePrivacy } from '@/context/PrivacyContext'
import { useCategories } from '@/context/CategoriesContext'
import { useWallets } from '@/context/WalletsContext'
import { Repeat, Plus, Trash2, CheckCircle2, Calendar, Power, AlertTriangle, Pencil, X } from 'lucide-react'
import { applyTax } from '@/lib/applyTax'
import { daysUntilNextBilling, monthlyEquivalentAmount, BillingFrequency } from '@/lib/recurringBilling'
import { sortRecurringExpenses, filterRecurringByKind, RecurringSortField } from '@/lib/recurringSort'

interface RecurringManagerProps {
  onTransactionAdded?: () => void
}

// Ventana dentro de la cual avisamos que algo está por vencer.
const DUE_SOON_DAYS = 7

const PAYMENT_METHODS = ['Billetera Virtual', 'Efectivo', 'Transferencia', 'Tarjeta de Crédito', 'Tarjeta de Débito']

const WALLET_TYPES_BY_PAYMENT_METHOD: Record<string, Wallet['type'][]> = {
  'Billetera Virtual': ['virtual_wallet'],
  Efectivo: ['cash'],
  Transferencia: ['bank'],
  'Tarjeta de Crédito': ['credit_card'],
  'Tarjeta de Débito': ['debit_card'],
}

const EXPENSE_KIND_LABELS: Record<'subscription' | 'utility_rent', string> = {
  subscription: 'Suscripción',
  utility_rent: 'Servicio/Alquiler',
}

const emptyForm = {
  title: '',
  amount: '',
  billingDay: '',
  billingMonth: '1',
  billingFrequency: 'monthly' as BillingFrequency,
  expenseKind: 'subscription' as 'subscription' | 'utility_rent',
  categoryId: '',
  currency: 'ARS' as 'ARS' | 'USD',
  paymentMethod: '',
  walletId: '',
  membershipType: '',
  taxPercentage: '',
}

/**
 * "Pagos Recurrentes / Vencimientos" — unifica lo que antes eran dos
 * secciones separadas (Suscripciones y Servicios/Alquiler) en una
 * sola, con un selector de tipo en el formulario y un badge por ítem
 * para distinguirlos a simple vista. Se mantiene expense_kind en la
 * base (no se borró el dato, solo se dejó de usar como filtro de qué
 * sección mostrar).
 */
export default function RecurringManager({ onTransactionAdded }: RecurringManagerProps) {
  const { user } = useUser()
  const { categories } = useCategories()
  const { wallets } = useWallets()
  const [items, setItems] = useState<RecurringExpense[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<RecurringSortField>('nextDue')
  const [sortAscending, setSortAscending] = useState(true)
  const [filterKind, setFilterKind] = useState('all')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [impactingId, setImpactingId] = useState<string | null>(null)

  const { isPrivate, formatAmount } = usePrivacy()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        if (!user) return

        const { data: itemsData, error } = await supabase
          .from('recurring_expenses')
          .select('*, categories(*)')
          .eq('user_id', user.id)
          .order('billing_day', { ascending: true })

        if (error) throw error
        if (isMounted && itemsData) setItems(itemsData)
      } catch (err) {
        console.error('Error al cargar pagos recurrentes:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [user])

  const reloadData = async () => {
    try {
      if (!user) return

      const { data: itemsData } = await supabase
        .from('recurring_expenses')
        .select('*, categories(*)')
        .eq('user_id', user.id)
        .order('billing_day', { ascending: true })

      if (itemsData) setItems(itemsData)
    } catch (err) {
      console.error('Error recargando pagos recurrentes:', err)
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
      billingMonth: String(item.billing_month ?? 1),
      billingFrequency: item.billing_frequency,
      expenseKind: item.expense_kind,
      categoryId: item.category_id || '',
      currency: item.currency,
      paymentMethod: item.payment_method || '',
      walletId: item.wallet_id || '',
      membershipType: item.membership_type || '',
      taxPercentage: item.tax_percentage ? String(item.tax_percentage) : '',
    })
    if (typeof window !== 'undefined') containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.amount || !form.billingDay || Number(form.amount) <= 0) return

    setSubmitting(true)
    if (!user) {
      setSubmitting(false)
      return
    }

    const payload = {
      title: form.title,
      amount: Number(form.amount),
      currency: form.currency,
      billing_day: Number(form.billingDay),
      billing_frequency: form.billingFrequency,
      billing_month: form.billingFrequency === 'annual' ? Number(form.billingMonth) : null,
      expense_kind: form.expenseKind,
      category_id: form.categoryId || null,
      payment_method: form.paymentMethod || null,
      wallet_id: form.walletId || null,
      membership_type: form.expenseKind === 'subscription' ? form.membershipType || null : null,
      tax_percentage: Number(form.taxPercentage) || 0,
    }

    const { error } = editingId
      ? await supabase.from('recurring_expenses').update(payload).eq('id', editingId)
      : await supabase.from('recurring_expenses').insert([{ ...payload, user_id: user.id, is_active: true }])

    if (!error) {
      resetForm()
      await reloadData()
    } else {
      alert(`Error al ${editingId ? 'editar' : 'agregar'}: ` + error.message)
      console.error(`Error ${editingId ? 'editando' : 'agregando'}:`, error)
    }
    setSubmitting(false)
  }

  const handleToggleActive = async (item: RecurringExpense) => {
    if (!item.id) return
    const newStatus = !item.is_active
    setItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, is_active: newStatus } : r)))

    const { error } = await supabase.from('recurring_expenses').update({ is_active: newStatus }).eq('id', item.id)
    if (error) {
      alert('Error al actualizar: ' + error.message)
      console.error('Error actualizando estado:', error)
      await reloadData()
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
    if (!error) {
      setItems((prev) => prev.filter((r) => r.id !== id))
      if (editingId === id) resetForm()
    } else {
      alert('Error al eliminar: ' + error.message)
      console.error('Error eliminando:', error)
    }
  }

  const handleImpactTransaction = async (item: RecurringExpense) => {
    if (!item.id) return

    const taxedAmount = applyTax(Number(item.amount), item.tax_percentage ?? 0)

    let exchangeRate: number | null = null
    let amountArs = taxedAmount

    if (item.currency === 'USD') {
      const rateInput = window.prompt(`Cotización actual del dólar para registrar "${item.title}":`, '1200')
      if (rateInput === null) return
      exchangeRate = Number(rateInput)
      if (!exchangeRate || exchangeRate <= 0) {
        alert('Cotización inválida. No se registró el pago.')
        return
      }
      amountArs = taxedAmount * exchangeRate
    }

    setImpactingId(item.id)
    if (!user) {
      setImpactingId(null)
      return
    }

    const label = EXPENSE_KIND_LABELS[item.expense_kind]
    const { error } = await supabase.from('transactions').insert([
      {
        user_id: user.id,
        type: 'expense',
        description: `[${label}] ${item.title}`,
        payment_method: item.payment_method || 'Transferencia',
        wallet_id: item.wallet_id || null,
        is_usd: item.currency === 'USD',
        amount_usd: item.currency === 'USD' ? taxedAmount : null,
        exchange_rate: exchangeRate,
        amount_ars: amountArs,
        category_id: item.category_id || null,
      },
    ])

    if (!error) {
      if (onTransactionAdded) onTransactionAdded()
    } else {
      alert('Error al registrar el pago: ' + error.message)
      console.error('Error al registrar transacción:', error)
    }
    setImpactingId(null)
  }

  const totalFixedARS = items
    .filter((r) => r.is_active && r.currency === 'ARS')
    .reduce((acc, r) => acc + monthlyEquivalentAmount(applyTax(Number(r.amount), r.tax_percentage ?? 0), r.billing_frequency), 0)

  const dueSoon = items
    .filter((r) => r.is_active)
    .map((r) => ({ ...r, daysLeft: daysUntilNextBilling(r.billing_day, r.billing_frequency, r.billing_month) }))
    .filter((r) => r.daysLeft <= DUE_SOON_DAYS)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const relevantWalletTypes = WALLET_TYPES_BY_PAYMENT_METHOD[form.paymentMethod]
  const relevantWallets = relevantWalletTypes ? wallets.filter((w) => relevantWalletTypes.includes(w.type)) : []

  const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">
        <p className="text-xs font-semibold text-gray-400 animate-pulse">Cargando pagos recurrentes...</p>
      </div>
    )
  }

  return (
    <div id="pagos-recurrentes" ref={containerRef} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Repeat className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Pagos Recurrentes / Vencimientos</h2>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">Fijo Comprometido /mes</span>
          <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">
            {isPrivate ? '••••••' : formatAmount(totalFixedARS)}
          </span>
        </div>
      </div>

      {dueSoon.length > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-300 text-xs font-semibold px-3.5 py-2.5 rounded-xl">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Vencen pronto: {dueSoon.map((r) => `${r.title} (${r.daysLeft <= 0 ? 'hoy' : `en ${r.daysLeft}d`})`).join(', ')}
          </span>
        </div>
      )}

      {editingId && (
        <div className="flex items-center justify-between gap-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 text-xs font-bold px-3.5 py-2 rounded-xl">
          <span className="truncate min-w-0">Editando &quot;{form.title}&quot;</span>
          <button onClick={resetForm} className="flex items-center gap-1 hover:underline cursor-pointer shrink-0">
            <X size={12} /> Cancelar
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        <select
          value={form.expenseKind}
          onChange={(e) => setForm((f) => ({ ...f, expenseKind: e.target.value as 'subscription' | 'utility_rent' }))}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="subscription">Suscripción</option>
          <option value="utility_rent">Servicio / Alquiler</option>
        </select>

        <input
          type="text"
          placeholder="Nombre"
          title="Ej: Netflix, Luz, Alquiler"
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

        <select
          value={form.billingFrequency}
          onChange={(e) => setForm((f) => ({ ...f, billingFrequency: e.target.value as BillingFrequency }))}
          className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="monthly">Mensual</option>
          <option value="annual">Anual</option>
        </select>

        {form.billingFrequency === 'annual' && (
          <select
            value={form.billingMonth}
            onChange={(e) => setForm((f) => ({ ...f, billingMonth: e.target.value }))}
            className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        )}

        <input
          type="number"
          placeholder="Día"
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

        {form.expenseKind === 'subscription' && (
          <input
            type="text"
            placeholder="Membresía"
            title="Ej: Premium, Familiar, Individual"
            value={form.membershipType}
            onChange={(e) => setForm((f) => ({ ...f, membershipType: e.target.value }))}
            className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}

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
          No tenés ninguna billetera/cuenta de tipo &quot;{form.paymentMethod}&quot; creada todavía — es opcional.
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          No tenés suscripciones, servicios ni alquiler registrados todavía.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 font-semibold text-gray-600 dark:text-gray-300"
            >
              <option value="all">Todos los tipos</option>
              <option value="subscription">Suscripciones</option>
              <option value="utility_rent">Servicios / Alquiler</option>
            </select>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as RecurringSortField)}
              className="text-[11px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 font-semibold text-gray-600 dark:text-gray-300"
            >
              <option value="nextDue">Ordenar por vencimiento</option>
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
            {sortRecurringExpenses(filterRecurringByKind(items, filterKind), sortField, sortAscending).map((item) => (
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
                  title={item.is_active ? 'Pausar' : 'Activar'}
                >
                  <Power size={14} />
                </button>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{item.title}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                        item.expense_kind === 'subscription'
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                      }`}
                    >
                      {EXPENSE_KIND_LABELS[item.expense_kind]}
                    </span>
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
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {item.billing_frequency === 'annual' ? 'Anual' : 'Mensual'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5 flex-wrap">
                    <Calendar size={12} />
                    <span>
                      Vence el {item.billing_day}
                      {item.billing_frequency === 'annual' && item.billing_month
                        ? ` de ${MONTH_NAMES[item.billing_month - 1]}`
                        : ' de cada mes'}
                    </span>
                    {item.payment_method && <span>· {item.payment_method}</span>}
                    {item.is_active &&
                      daysUntilNextBilling(item.billing_day, item.billing_frequency, item.billing_month) <= DUE_SOON_DAYS && (
                        <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          {daysUntilNextBilling(item.billing_day, item.billing_frequency, item.billing_month) <= 0
                            ? 'Vence hoy'
                            : `Vence en ${daysUntilNextBilling(item.billing_day, item.billing_frequency, item.billing_month)}d`}
                        </span>
                      )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <span className="text-xs font-extrabold text-gray-900 dark:text-gray-100 block">
                    {isPrivate ? '••••••' : item.currency === 'USD' ? `USD $${item.amount}` : formatAmount(item.amount)}
                  </span>
                  {!isPrivate && item.tax_percentage > 0 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">
                      c/imp:{' '}
                      {item.currency === 'USD'
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
        </>
      )}
    </div>
  )
}
