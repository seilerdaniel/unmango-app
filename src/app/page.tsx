'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Transaction } from '@/types'
import { usePrivacy } from '@/context/PrivacyContext'
import TransactionForm from '@/components/TransactionForm'
import CategoryManager from '@/components/CategoryManager'
import BudgetManager from '@/components/BudgetManager'
import RecurringManager from '@/components/RecurringManager'
import DolarWidget from '@/components/DolarWidget'
import FinanceChart from '@/components/FinanceChart'
import TransactionFilters from '@/components/TransactionFilters'
import { Eye, EyeOff, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Trash2 } from 'lucide-react'

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const { isPrivate, togglePrivacy, formatAmount, displayCurrency } = usePrivacy()

  const fetchTransactions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, categories(*)')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setTransactions(data)
        setFilteredTransactions(data)
      }
    } catch (err) {
      console.error('Error al conectar con Supabase:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadInitialData = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*, categories(*)')
          .order('created_at', { ascending: false })

        if (isMounted) {
          if (!error && data) {
            setTransactions(data)
            setFilteredTransactions(data)
          }
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error en carga inicial:', err)
          setLoading(false)
        }
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  const handleDeleteTransaction = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) {
      fetchTransactions()
    }
  }

  // Totales calculados en ARS base (el PrivacyContext / DolarWidget se encarga del pasaje visual)
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount_ars), 0)

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount_ars), 0)

  const totalBalance = totalIncome - totalExpense

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      {/* Header / Top Bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
              🥭
            </div>
            <span className="font-black text-lg tracking-tight text-gray-900">
              UnMango <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">v2.0</span>
            </span>
          </div>

          <button
            onClick={togglePrivacy}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 py-2 px-3 rounded-xl transition cursor-pointer"
            title={isPrivate ? 'Mostrar montos' : 'Ocultar montos'}
          >
            {isPrivate ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="hidden sm:inline">{isPrivate ? 'Modo Privado' : 'Visible'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Resumen Global Integrado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Balance Total</span>
              <span className={`text-2xl font-black ${totalBalance >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>
                {formatAmount(totalBalance)}
              </span>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Wallet size={20} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Ingresos Totales</span>
              <span className="text-2xl font-black text-emerald-600">{formatAmount(totalIncome)}</span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={20} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">Gastos Totales</span>
              <span className="text-2xl font-black text-rose-600">{formatAmount(totalExpense)}</span>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown size={20} />
            </div>
          </div>
        </div>

        {/* Layout Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Columna Principal */}
          <div className="lg:col-span-2 space-y-6">
            <TransactionForm onTransactionAdded={fetchTransactions} />

            <RecurringManager onTransactionAdded={fetchTransactions} />

            <BudgetManager transactions={transactions} />

            {/* Listado con Filtros */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Historial de Movimientos</h2>
                <span className="text-xs font-semibold text-gray-400">{filteredTransactions.length} registros</span>
              </div>

              <TransactionFilters
                transactions={transactions}
                onFiltered={setFilteredTransactions}
              />

              {loading ? (
                <p className="text-xs font-semibold text-gray-400 text-center py-6 animate-pulse">
                  Cargando movimientos...
                </p>
              ) : filteredTransactions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No hay transacciones para mostrar.</p>
              ) : (
                <div className="space-y-2 pt-2">
                  {filteredTransactions.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-gray-50/60 rounded-xl border border-gray-100 flex items-center justify-between gap-3 hover:border-gray-200 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${
                            item.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {item.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{item.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.categories && (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-md font-medium text-white"
                                style={{ backgroundColor: item.categories.color }}
                              >
                                {item.categories.name}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400">
                              {item.created_at ? new Date(item.created_at).toLocaleDateString('es-AR') : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-extrabold ${
                            item.type === 'income' ? 'text-emerald-600' : 'text-gray-900'
                          }`}
                        >
                          {item.type === 'income' ? '+' : '-'} {formatAmount(item.amount_ars)}
                        </span>
                        <button
                          onClick={() => item.id && handleDeleteTransaction(item.id)}
                          className="text-gray-400 hover:text-rose-600 transition p-1 cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Columna Lateral */}
          <div className="lg:col-span-1 space-y-6">
            <DolarWidget />

            <FinanceChart income={totalIncome} expense={totalExpense} />

            <CategoryManager onCategoriesUpdated={fetchTransactions} />
          </div>
        </div>
      </main>
    </div>
  )
}