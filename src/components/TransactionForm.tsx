'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { useCategories } from '@/context/CategoriesContext'
import { useWallets } from '@/context/WalletsContext'
import { evaluateMathExpression } from '@/lib/basicCalculator'
import { computeHoursOfWork } from '@/lib/hoursOfWork'
import { enqueueOfflineTransaction } from '@/lib/offlineQueue'
import { PlusCircle, DollarSign, ArrowUpCircle, ArrowDownCircle, Tag, Clock } from 'lucide-react'

interface TransactionFormProps {
  onTransactionAdded: () => void
}

export default function TransactionForm({ onTransactionAdded }: TransactionFormProps) {
  const { user } = useUser()
  const [description, setDescription] = useState('')
  const [amountArs, setAmountArs] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [paymentMethod, setPaymentMethod] = useState('Billetera Virtual')
  const [categoryId, setCategoryId] = useState<string>('')
  const { categories } = useCategories()
  const { wallets, refresh: refreshWallets } = useWallets()

  // Billetera asociada al movimiento (Fase 5 — saldo por billetera). Es
  // opcional: si no se elige ninguna, el movimiento no impacta el saldo
  // de ninguna cuenta, igual que las transacciones cargadas antes de
  // esta feature. Antes había ADEMÁS un selector separado y hardcodeado
  // de "Proveedor / App" (Mercado Pago, Ualá, etc.) que no tenía nada
  // que ver con las billeteras reales que se crean en WalletManager —
  // por eso una billetera nueva no aparecía ahí. Se unificó en este
  // único selector, que sí lee las billeteras reales del usuario.
  const [walletId, setWalletId] = useState<string>('')
  const [isUsd, setIsUsd] = useState(false)
  const [amountUsd, setAmountUsd] = useState('')
  const [exchangeRate, setExchangeRate] = useState('1200')
  const [loading, setLoading] = useState(false)

  // "Costo en Horas de Trabajo" — se carga una sola vez si el usuario
  // configuró su ingreso/horas en Configuración. Si no lo configuró,
  // workSettings queda null y el hint simplemente no se muestra.
  const [workSettings, setWorkSettings] = useState<{ monthlyIncome: number; monthlyWorkHours: number } | null>(null)

  useEffect(() => {
    async function loadWorkSettings() {
      if (!user) return
      const { data } = await supabase
        .from('user_work_settings')
        .select('monthly_income, monthly_work_hours')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data) {
        setWorkSettings({ monthlyIncome: Number(data.monthly_income), monthlyWorkHours: Number(data.monthly_work_hours) })
      }
    }
    loadWorkSettings()
  }, [user])

  async function handleQuickAddWallet() {
    const name = window.prompt('Nombre de la nueva billetera (ej: Mercado Pago, Banco Galicia):')
    if (!name || !name.trim()) return

    if (!user) return

    const { data, error } = await supabase
      .from('wallets')
      .insert([{ user_id: user.id, name: name.trim(), type: 'virtual_wallet', color: '#6366f1' }])
      .select('id')
      .single()

    if (error) {
      alert('Error al crear la billetera: ' + error.message)
      console.error('Error creando billetera desde el formulario:', error)
      return
    }

    await refreshWallets()
    if (data) setWalletId(data.id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    if (!user) {
      alert('Sesión no válida')
      setLoading(false)
      return
    }

    // Red de seguridad: si el usuario apretó Enter sin salir del campo
    // (el onBlur que resuelve "2500 + 1300" no llegó a dispararse),
    // igual evaluamos acá antes de guardar.
    const finalAmountArs = isUsd
      ? (evaluateMathExpression(amountUsd) ?? Number(amountUsd)) * Number(exchangeRate)
      : evaluateMathExpression(amountArs) ?? Number(amountArs)

    if (!Number.isFinite(finalAmountArs) || finalAmountArs <= 0) {
      alert('El monto ingresado no es válido. Revisá que sea un número o una cuenta como "2500 + 1300".')
      setLoading(false)
      return
    }

    const selectedWallet = wallets.find((w) => w.id === walletId)

    const payload = {
      user_id: user.id,
      description,
      type,
      category_id: categoryId || null,
      wallet_id: walletId || null,
      payment_method: paymentMethod,
      wallet_provider: selectedWallet?.name ?? null,
      is_usd: isUsd,
      amount_usd: isUsd ? Number(amountUsd) : null,
      amount_ars: finalAmountArs,
      exchange_rate: isUsd ? Number(exchangeRate) : null,
    }

    // Si ya sabemos que no hay conexión, ni intentamos pegarle a
    // Supabase — directo a la cola offline.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOfflineTransaction(payload)
      alert('Sin conexión: guardado en tu celular. Se va a sincronizar solo cuando vuelvas a tener internet.')
      setDescription('')
      setAmountArs('')
      setAmountUsd('')
      onTransactionAdded()
      setLoading(false)
      return
    }

    const { error } = await supabase.from('transactions').insert([payload])

    if (error) {
      // Si el error vino porque la conexión se cortó justo en el medio
      // del pedido (no un error de datos inválidos), lo guardamos
      // offline en vez de mostrar un error que asuste al usuario.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueueOfflineTransaction(payload)
        alert('Se cortó la conexión: guardado en tu celular, se sincroniza solo.')
        setDescription('')
        setAmountArs('')
        setAmountUsd('')
        onTransactionAdded()
      } else {
        alert('Error al guardar el movimiento: ' + error.message)
      }
    } else {
      setDescription('')
      setAmountArs('')
      setAmountUsd('')
      onTransactionAdded()
    }

    setLoading(false)
  }

  const inputStyle = "w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 !text-gray-900 dark:!text-gray-100 font-semibold text-sm placeholder:!text-gray-400 dark:placeholder:!text-gray-500 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition shadow-sm"

  return (
    <div id="transaction-form" className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <PlusCircle className="text-amber-500" size={20} /> Cargar Movimiento
        </h2>
        
        {/* Toggle Ingreso / Gasto */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
              type === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <ArrowDownCircle size={14} /> Gasto
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
              type === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <ArrowUpCircle size={14} /> Ingreso
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Descripción y Categoría */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-gray-300 mb-1">Concepto / Descripción</label>
            <input
              id="transaction-description-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Supermercado, Alquiler..."
              required
              className={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-gray-300 mb-1">Categoría</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputStyle}
            >
              <option value="">Sin Categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Moneda y Montos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-800 dark:text-gray-300 mb-1">
              {isUsd ? 'Monto en USD' : 'Monto en Pesos (ARS)'}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={isUsd ? amountUsd : amountArs}
              onChange={(e) => isUsd ? setAmountUsd(e.target.value) : setAmountArs(e.target.value)}
              onBlur={(e) => {
                // Matemática inline: si escribiste "2500 + 1300", al
                // salir del campo se reemplaza por el resultado (3800).
                // Si no es una expresión válida (es un número común, o
                // texto sin sentido), se deja el valor tal cual.
                const evaluated = evaluateMathExpression(e.target.value)
                if (evaluated !== null) {
                  if (isUsd) setAmountUsd(String(evaluated))
                  else setAmountArs(String(evaluated))
                }
              }}
              placeholder="0.00 (o 2500 + 1300)"
              required
              className={inputStyle}
            />
            {workSettings && type === 'expense' && !isUsd && (() => {
              const parsedAmount = evaluateMathExpression(amountArs) ?? Number(amountArs)
              const hoursResult = computeHoursOfWork(parsedAmount, workSettings.monthlyIncome, workSettings.monthlyWorkHours)
              if (!hoursResult) return null
              return (
                <p className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
                  <Clock size={10} />
                  Esto te cuesta {hoursResult.hours.toFixed(1)}h de trabajo (
                  {hoursResult.workDays.toFixed(1)} jornadas)
                </p>
              )
            })()}
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setIsUsd(!isUsd)}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                isUsd 
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <DollarSign size={16} /> {isUsd ? 'Operación en USD' : 'Cambiar a USD'}
            </button>
          </div>
        </div>

        {/* Cotización USD */}
        {isUsd && (
          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/50 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-amber-950 dark:text-amber-300 mb-1">Cotización / Tipo Cambio</label>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                placeholder="1200"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-950 dark:text-amber-300 mb-1">Total Estimado ARS</label>
              <div className="py-2.5 font-extrabold text-amber-950 dark:text-amber-300 text-sm">
                $ {(Number(amountUsd || 0) * Number(exchangeRate || 0)).toLocaleString('es-AR')}
              </div>
            </div>
          </div>
        )}

        {/* Billetera (opcional) — reemplaza al viejo selector hardcodeado
            de "Proveedor / App"; ahora lee las billeteras reales. */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-gray-800 dark:text-gray-300">
              Billetera (opcional)
            </label>
            <button
              type="button"
              onClick={handleQuickAddWallet}
              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              + Nueva
            </button>
          </div>
          <select
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            className={inputStyle}
          >
            <option value="">Sin asignar</option>
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          {wallets.length === 0 && (
            <p className="text-[10px] text-gray-400 mt-1">
              Todavía no tenés billeteras — creá una con &quot;+ Nueva&quot; o desde la sección
              Billeteras (donde también podés editarlas o eliminarlas).
            </p>
          )}
        </div>

        {/* Medio de Pago */}
        <div>
          <label className="block text-xs font-bold text-gray-800 dark:text-gray-300 mb-1">Medio de Pago</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className={inputStyle}
          >
            <option value="Billetera Virtual">Billetera Virtual</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia Bancaria</option>
            <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
            <option value="Tarjeta de Débito">Tarjeta de Débito</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl text-sm transition shadow-md shadow-amber-500/20 cursor-pointer"
        >
          {loading ? 'Guardando...' : 'Registrar Movimiento'}
        </button>
      </form>
    </div>
  )
}