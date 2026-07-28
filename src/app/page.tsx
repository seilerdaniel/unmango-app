'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { Transaction } from '@/types'
import TransactionForm from '@/components/TransactionForm'
import CategoryManager from '@/components/CategoryManager'
import BudgetManager from '@/components/BudgetManager'
import FinanceChart from '@/components/FinanceChart'
import TransactionFilters from '@/components/TransactionFilters'
import { LogOut, ArrowUpRight, ArrowDownRight, Trash2, Eye, EyeOff } from 'lucide-react'
import { usePrivacy } from '@/context/PrivacyContext'


export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Consumimos el contexto de privacidad
  const { isPrivate, togglePrivacy, formatAmount } = usePrivacy()

  async function fetchTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*, categories(*)')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setAllTransactions(data)
      setFilteredTransactions(data)
    }
  }

  async function handleDelete(id: string) {
    if (confirm('¿Quieres eliminar este movimiento?')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (!error) {
        fetchTransactions()
      }
    }
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
        await fetchTransactions()
      }
      setLoading(false)
    }

    init()
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const totalIncome = allTransactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount_ars), 0)

  const totalExpense = allTransactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount_ars), 0)

  const balance = totalIncome - totalExpense

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50/30 flex items-center justify-center">
        <p className="text-sm font-semibold text-amber-700 animate-pulse">Cargando UnMango 🥭...</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <main className="min-h-screen bg-gray-50/60 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header con botón de privacidad */}
        <header className="flex justify-between items-center bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🥭</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900">UnMango</h1>
              <p className="text-xs text-gray-500 font-medium">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Botón Modo Privacidad */}
            <button
              onClick={togglePrivacy}
              title={isPrivate ? 'Mostrar valores' : 'Ocultar valores'}
              className="p-2 sm:px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition shadow-sm flex items-center gap-2 text-xs font-semibold cursor-pointer"
            >
              {isPrivate ? (
                <>
                  <EyeOff size={16} className="text-amber-600" />
                  <span className="hidden sm:inline">Modo Privado</span>
                </>
              ) : (
                <>
                  <Eye size={16} className="text-gray-500" />
                  <span className="hidden sm:inline">Modo Visible</span>
                </>
              )}
            </button>

            {/* Botón Salir */}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 bg-gray-100 hover:bg-rose-50 hover:text-rose-600 text-gray-700 text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
            >
              <LogOut size={16} /> Salir
            </button>
          </div>
        </header>

        {/* Tarjetas de Métricas principales formateadas con formatAmount */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Balance Disponible</p>
            <h3 className={`text-2xl font-extrabold ${balance >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>
              {formatAmount(balance)}
            </h3>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1">
              <ArrowUpRight size={14} /> Total Ingresos
            </p>
            <h3 className="text-2xl font-extrabold text-emerald-600">
              {isPrivate ? formatAmount(totalIncome) : `+ ${formatAmount(totalIncome)}`}
            </h3>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <ArrowDownRight size={14} /> Total Gastos
            </p>
            <h3 className="text-2xl font-extrabold text-rose-600">
              {isPrivate ? formatAmount(totalExpense) : `- ${formatAmount(totalExpense)}`}
            </h3>
          </div>
        </div>

        {/* Formulario y Lateral (Gráfico + Categorías) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TransactionForm onTransactionAdded={fetchTransactions} />
          </div>

          <div className="lg:col-span-1 space-y-6">
            <FinanceChart income={totalIncome} expense={totalExpense} />
            <CategoryManager onCategoriesUpdated={fetchTransactions} />
          </div>
        </div>

        {/* Historial de Movimientos y Filtros */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">Historial de Movimientos</h2>
          </div>

          <TransactionFilters
            transactions={allTransactions}
            onFiltered={setFilteredTransactions}
          />

          {filteredTransactions.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              No se encontraron movimientos con los filtros seleccionados.
            </p>
          ) : (
            <div className="space-y-3 pt-2">
              {filteredTransactions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-gray-100 hover:bg-gray-50/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${
                      item.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {item.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{item.description}</p>
                        {item.categories && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: `${item.categories.color}18`,
                              color: item.categories.color,
                            }}
                          >
                            {item.categories.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-medium flex items-center gap-2 mt-0.5">
                        <span>{item.payment_method}{item.wallet_provider ? ` (${item.wallet_provider})` : ''}</span>
                        {item.is_usd && (
                          <span className="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.5 rounded font-bold">
                            USD {isPrivate ? '••••••' : item.amount_usd}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {/* Monto de cada transacción con privacidad */}
                      <p className={`text-sm font-extrabold ${
                        item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isPrivate
                          ? formatAmount(Number(item.amount_ars))
                          : `${item.type === 'income' ? '+' : '-'} ${formatAmount(Number(item.amount_ars))}`}
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium">
                        {new Date(item.created_at!).toLocaleDateString('es-AR')}
                      </p>
                    </div>

                    <button
                      onClick={() => item.id && handleDelete(item.id)}
                      className="text-gray-400 hover:text-rose-600 transition p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                      title="Eliminar movimiento"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}