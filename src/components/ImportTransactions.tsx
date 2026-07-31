'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabaseClient'
import { useCategories } from '@/context/CategoriesContext'
import { Wallet } from '@/types'
import { Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react'

interface ImportTransactionsProps {
  onImported?: () => void
}

interface ParsedRow {
  raw: Record<string, string>
  date: Date | null
  description: string
  amount: number | null
  type: 'income' | 'expense'
}

/**
 * Intenta parsear una fecha en los formatos más comunes de resúmenes
 * bancarios/exportaciones CSV: ISO (yyyy-mm-dd) y dd/mm/yyyy o
 * dd-mm-yyyy (el formato habitual en Argentina).
 */
export function parseDate(raw: string): Date | null {
  const trimmed = raw.trim()
  let m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))

  m = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))

  return null
}

/**
 * Parsea un monto que puede venir en formato "1234.56", "1234,56" o
 * "1.234,56" (miles con punto, decimales con coma — formato habitual en
 * resúmenes bancarios argentinos).
 */
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[^\d,.-]/g, '')
  if (!s) return null

  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (lastComma > -1) {
    s = s.replace(',', '.')
  }

  const num = Number(s)
  return Number.isNaN(num) ? null : num
}

export default function ImportTransactions({ onImported }: ImportTransactionsProps) {
  const { categories } = useCategories()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [dateColumn, setDateColumn] = useState('')
  const [descriptionColumn, setDescriptionColumn] = useState('')
  const [amountColumn, setAmountColumn] = useState('')
  const [negativeIsExpense, setNegativeIsExpense] = useState(true)
  const [categoryId, setCategoryId] = useState('')
  const [walletId, setWalletId] = useState('')
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)

  async function ensureWalletsLoaded() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (data) setWallets(data)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImportedCount(null)
    ensureWalletsLoaded()

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const cols = result.meta.fields ?? []
        setHeaders(cols)
        setRawRows(result.data)

        // Intento de auto-detección de columnas por nombre habitual.
        const findCol = (candidates: string[]) =>
          cols.find((c) => candidates.some((cand) => c.toLowerCase().includes(cand))) ?? ''

        setDateColumn(findCol(['fecha', 'date']))
        setDescriptionColumn(findCol(['descrip', 'concepto', 'detalle', 'description']))
        setAmountColumn(findCol(['monto', 'importe', 'amount', 'valor']))
      },
      error: (err: Error) => {
        alert('No se pudo leer el archivo CSV: ' + err.message)
      },
    })
  }

  const parsedRows: ParsedRow[] = rawRows.map((raw) => {
    const rawAmount = amountColumn ? parseAmount(raw[amountColumn] ?? '') : null
    const isNegative = rawAmount !== null && rawAmount < 0
    const type: 'income' | 'expense' =
      rawAmount === null
        ? 'expense'
        : negativeIsExpense
          ? isNegative
            ? 'expense'
            : 'income'
          : isNegative
            ? 'income'
            : 'expense'

    return {
      raw,
      date: dateColumn ? parseDate(raw[dateColumn] ?? '') : null,
      description: descriptionColumn ? (raw[descriptionColumn] ?? '').trim() : '',
      amount: rawAmount !== null ? Math.abs(rawAmount) : null,
      type,
    }
  })

  const validRows = parsedRows.filter((r) => r.date && r.description && r.amount !== null)
  const invalidCount = parsedRows.length - validRows.length

  async function handleImport() {
    if (validRows.length === 0) return
    setImporting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setImporting(false)
      return
    }

    const rowsToInsert = validRows.map((r) => ({
      user_id: user.id,
      description: r.description,
      type: r.type,
      payment_method: 'Importado (CSV)',
      wallet_id: walletId || null,
      category_id: categoryId || null,
      is_usd: false,
      amount_usd: null,
      amount_ars: r.amount as number,
      exchange_rate: null,
      created_at: (r.date as Date).toISOString(),
    }))

    // Insertamos en tandas para no mandar un array gigante en una sola
    // request si el CSV tiene muchas filas.
    const BATCH_SIZE = 200
    let insertedTotal = 0
    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const batch = rowsToInsert.slice(i, i + BATCH_SIZE)
      const { error } = await supabase.from('transactions').insert(batch)
      if (error) {
        alert(
          `Se importaron ${insertedTotal} movimientos antes de un error: ${error.message}`
        )
        console.error('Error importando transacciones:', error)
        setImporting(false)
        setImportedCount(insertedTotal)
        return
      }
      insertedTotal += batch.length
    }

    setImportedCount(insertedTotal)
    setRawRows([])
    setHeaders([])
    setImporting(false)
    if (onImported) onImported()
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
      <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <FileSpreadsheet className="text-amber-500" size={18} /> Importar Resumen (CSV)
      </h3>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Subí un CSV exportado de tu banco o billetera. Funciona con cualquier formato que tenga
        una columna de fecha, una de descripción y una de monto — vos elegís cuál es cuál abajo.
      </p>

      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition text-xs font-semibold text-gray-500 dark:text-gray-400">
        <Upload size={16} />
        {rawRows.length > 0 ? `${rawRows.length} filas cargadas — elegí otro archivo` : 'Elegí un archivo .csv'}
        <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
      </label>

      {headers.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Columna de fecha</label>
              <select
                value={dateColumn}
                onChange={(e) => setDateColumn(e.target.value)}
                className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-medium text-gray-700 dark:text-gray-200"
              >
                <option value="">Elegir...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Columna de descripción</label>
              <select
                value={descriptionColumn}
                onChange={(e) => setDescriptionColumn(e.target.value)}
                className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-medium text-gray-700 dark:text-gray-200"
              >
                <option value="">Elegir...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Columna de monto</label>
              <select
                value={amountColumn}
                onChange={(e) => setAmountColumn(e.target.value)}
                className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-medium text-gray-700 dark:text-gray-200"
              >
                <option value="">Elegir...</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={negativeIsExpense}
                onChange={(e) => setNegativeIsExpense(e.target.checked)}
              />
              Los montos negativos son gastos (convención habitual)
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-medium text-gray-700 dark:text-gray-200"
            >
              <option value="">Categoría para todo el lote (opcional)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className="w-full text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 font-medium text-gray-700 dark:text-gray-200"
            >
              <option value="">Billetera para todo el lote (opcional)</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {dateColumn && descriptionColumn && amountColumn && (
            <>
              <div className="max-h-56 overflow-y-auto overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                <table className="w-full min-w-[420px] text-[11px]">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-bold text-gray-500 dark:text-gray-400">Fecha</th>
                      <th className="text-left px-2 py-1.5 font-bold text-gray-500 dark:text-gray-400">Descripción</th>
                      <th className="text-right px-2 py-1.5 font-bold text-gray-500 dark:text-gray-400">Monto</th>
                      <th className="text-left px-2 py-1.5 font-bold text-gray-500 dark:text-gray-400">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-t border-gray-50 dark:border-gray-800">
                        <td className="px-2 py-1 text-gray-600 dark:text-gray-400">
                          {r.date?.toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-2 py-1 text-gray-800 dark:text-gray-200 font-medium">{r.description}</td>
                        <td className="px-2 py-1 text-right text-gray-800 dark:text-gray-200">{r.amount?.toFixed(2)}</td>
                        <td className="px-2 py-1">
                          <span
                            className={
                              r.type === 'income'
                                ? 'text-emerald-600 font-bold'
                                : 'text-rose-600 font-bold'
                            }
                          >
                            {r.type === 'income' ? 'Ingreso' : 'Gasto'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                <span>
                  {validRows.length} filas listas para importar
                  {invalidCount > 0 && ` · ${invalidCount} se descartaron (fecha/monto/descripción vacíos)`}
                  {validRows.length > 100 && ' · mostrando las primeras 100 en la vista previa'}
                </span>
              </div>

              <button
                onClick={handleImport}
                disabled={importing || validRows.length === 0}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing ? 'Importando...' : `Importar ${validRows.length} movimientos`}
              </button>
            </>
          )}
        </div>
      )}

      {importedCount !== null && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400 text-xs font-semibold px-3.5 py-2.5 rounded-xl">
          <CheckCircle2 size={14} /> Se importaron {importedCount} movimientos.
        </div>
      )}
    </div>
  )
}
