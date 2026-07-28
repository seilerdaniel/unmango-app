'use client'

import { useState, useEffect } from 'react'
import { useCategories } from '@/context/CategoriesContext'
import { Transaction } from '@/types'
import { Search, Filter, Download } from 'lucide-react'

interface TransactionFiltersProps {
  transactions: Transaction[]
  onFiltered: (filtered: Transaction[]) => void
}

export default function TransactionFilters({ transactions, onFiltered }: TransactionFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const { categories } = useCategories()
  // Guardamos el resultado del filtrado para que "Exportar CSV" exporte
  // lo que el usuario está viendo, no siempre la lista completa.
  const [visibleTransactions, setVisibleTransactions] = useState<Transaction[]>(transactions)

  // Aplicar filtros localmente en tiempo real
  useEffect(() => {
    let result = [...transactions]

    if (typeFilter !== 'all') {
      result = result.filter((t) => t.type === typeFilter)
    }

    if (categoryFilter !== 'all') {
      if (categoryFilter === 'none') {
        result = result.filter((t) => !t.category_id)
      } else {
        result = result.filter((t) => t.category_id === categoryFilter)
      }
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(term) ||
          (t.payment_method && t.payment_method.toLowerCase().includes(term)) ||
          (t.wallet_provider && t.wallet_provider.toLowerCase().includes(term))
      )
    }

    setVisibleTransactions(result)
    onFiltered(result)
  }, [searchTerm, typeFilter, categoryFilter, transactions])

  // Función para exportar los datos filtrados a CSV
  function exportToCSV() {
    if (visibleTransactions.length === 0) return

    const headers = ['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Medio de Pago', 'Monto (ARS)', 'Es USD', 'Monto USD']
    
    const rows = visibleTransactions.map((t) => [
      new Date(t.created_at!).toLocaleDateString('es-AR'),
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      `"${t.description.replace(/"/g, '""')}"`,
      t.categories ? `"${t.categories.name}"` : 'Sin Categoría',
      `"${t.payment_method}${t.wallet_provider ? ` (${t.wallet_provider})` : ''}"`,
      t.amount_ars,
      t.is_usd ? 'Sí' : 'No',
      t.amount_usd || ''
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `UnMango_Movimientos_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const selectStyle = "px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 !text-gray-900 dark:!text-gray-100 font-semibold text-xs outline-none focus:ring-2 focus:ring-amber-500/50"

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-gray-50/80 dark:bg-gray-800/40 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800">
      <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
        {/* Buscar por texto */}
        <div className="relative flex-1 sm:w-48">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
          <input
            id="transaction-search-input"
            type="text"
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 !text-gray-900 dark:!text-gray-100 font-semibold text-xs placeholder:!text-gray-400 dark:placeholder:!text-gray-500 outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        {/* Filtrar por tipo */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className={selectStyle}
        >
          <option value="all">Todos los Tipos</option>
          <option value="income">Solo Ingresos</option>
          <option value="expense">Solo Gastos</option>
        </select>

        {/* Filtrar por Categoría */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={selectStyle}
        >
          <option value="all">Todas las Categorías</option>
          <option value="none">Sin Categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Botón Exportar CSV */}
      <button
        onClick={exportToCSV}
        className="w-full sm:w-auto bg-gray-900 hover:bg-black text-white font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
      >
        <Download size={14} /> Exportar CSV
      </button>
    </div>
  )
}