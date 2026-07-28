'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Category } from '@/types'
import { PlusCircle, DollarSign, ArrowUpCircle, ArrowDownCircle, Tag } from 'lucide-react'

interface TransactionFormProps {
  onTransactionAdded: () => void
}

export default function TransactionForm({ onTransactionAdded }: TransactionFormProps) {
  const [description, setDescription] = useState('')
  const [amountArs, setAmountArs] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [paymentMethod, setPaymentMethod] = useState('Billetera Virtual')
  const [walletProvider, setWalletProvider] = useState('Mercado Pago')
  const [categoryId, setCategoryId] = useState<string>('')
  const [categories, setCategories] = useState<Category[]>([])
  
  const [isUsd, setIsUsd] = useState(false)
  const [amountUsd, setAmountUsd] = useState('')
  const [exchangeRate, setExchangeRate] = useState('1200')
  const [loading, setLoading] = useState(false)

  async function loadCategories() {
    const { data } = await supabase.from('categories').select('*').order('name', { ascending: true })
    if (data) setCategories(data)
  }

  useEffect(() => {
    loadCategories()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      alert('Sesión no válida')
      setLoading(false)
      return
    }

    const finalAmountArs = isUsd 
      ? Number(amountUsd) * Number(exchangeRate) 
      : Number(amountArs)

    const { error } = await supabase.from('transactions').insert([
      {
        user_id: user.id,
        description,
        type,
        category_id: categoryId || null,
        payment_method: paymentMethod,
        wallet_provider: paymentMethod === 'Billetera Virtual' ? walletProvider : null,
        is_usd: isUsd,
        amount_usd: isUsd ? Number(amountUsd) : null,
        amount_ars: finalAmountArs,
        exchange_rate: isUsd ? Number(exchangeRate) : null,
      },
    ])

    if (error) {
      alert('Error al guardar el movimiento: ' + error.message)
    } else {
      setDescription('')
      setAmountArs('')
      setAmountUsd('')
      onTransactionAdded()
    }

    setLoading(false)
  }

  const inputStyle = "w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white !text-gray-900 font-semibold text-sm placeholder:!text-gray-400 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition shadow-sm"

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
          <PlusCircle className="text-amber-500" size={20} /> Cargar Movimiento
        </h2>
        
        {/* Toggle Ingreso / Gasto */}
        <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
              type === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowDownCircle size={14} /> Gasto
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${
              type === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
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
            <label className="block text-xs font-bold text-gray-800 mb-1">Concepto / Descripción</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Supermercado, Alquiler..."
              required
              className={inputStyle}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1">Categoría</label>
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
            <label className="block text-xs font-bold text-gray-800 mb-1">
              {isUsd ? 'Monto en USD' : 'Monto en Pesos (ARS)'}
            </label>
            <input
              type="number"
              step="0.01"
              value={isUsd ? amountUsd : amountArs}
              onChange={(e) => isUsd ? setAmountUsd(e.target.value) : setAmountArs(e.target.value)}
              placeholder="0.00"
              required
              className={inputStyle}
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setIsUsd(!isUsd)}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                isUsd 
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                  : 'bg-gray-50 border-gray-300 text-gray-800 hover:bg-gray-100'
              }`}
            >
              <DollarSign size={16} /> {isUsd ? 'Operación en USD' : 'Cambiar a USD'}
            </button>
          </div>
        </div>

        {/* Cotización USD */}
        {isUsd && (
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-amber-950 mb-1">Cotización / Tipo Cambio</label>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                placeholder="1200"
                className={inputStyle}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-amber-950 mb-1">Total Estimado ARS</label>
              <div className="py-2.5 font-extrabold text-amber-950 text-sm">
                $ {(Number(amountUsd || 0) * Number(exchangeRate || 0)).toLocaleString('es-AR')}
              </div>
            </div>
          </div>
        )}

        {/* Medio de Pago */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1">Medio de Pago</label>
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

          {paymentMethod === 'Billetera Virtual' && (
            <div>
              <label className="block text-xs font-bold text-gray-800 mb-1">Proveedor / App</label>
              <select
                value={walletProvider}
                onChange={(e) => setWalletProvider(e.target.value)}
                className={inputStyle}
              >
                <option value="Mercado Pago">Mercado Pago</option>
                <option value="Personal Pay">Personal Pay</option>
                <option value="Ualá">Ualá</option>
                <option value="Lemon Cash">Lemon Cash</option>
                <option value="Naranja X">Naranja X</option>
                <option value="Otra">Otra</option>
              </select>
            </div>
          )}
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