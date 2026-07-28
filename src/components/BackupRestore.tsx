'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Database } from '@/types/database'
import { Download, Upload, DatabaseBackup, CheckCircle2 } from 'lucide-react'

const BACKUP_VERSION = 1

interface BackupPayload {
  version: number
  exported_at: string
  categories: Record<string, unknown>[]
  wallets: Record<string, unknown>[]
  budgets: Record<string, unknown>[]
  recurring_expenses: Record<string, unknown>[]
  savings_goals: Record<string, unknown>[]
  transactions: Record<string, unknown>[]
}

/**
 * Al restaurar, las categorías y billeteras se insertan con IDs nuevos
 * (Postgres genera uuids nuevos), así que las tablas que las referencian
 * (transactions, budgets, recurring_expenses) necesitan que sus
 * category_id/wallet_id viejos se traduzcan a los nuevos. Esta función
 * es pura para poder testearla sin tocar la base de datos.
 *
 * Si un id viejo no aparece en el mapa (por ejemplo, la categoría no se
 * pudo restaurar por algún motivo), se devuelve null en vez de romper el
 * insert — la transacción queda sin esa categoría/billetera asignada,
 * en vez de perderse.
 */
export function remapForeignKey(oldId: unknown, idMap: Map<string, string>): string | null {
  if (typeof oldId !== 'string') return null
  return idMap.get(oldId) ?? null
}

/**
 * Devuelve una copia del objeto sin las claves indicadas. Se usa en vez
 * de destructuring (`const { id, user_id, ...rest } = obj`) para no
 * terminar con variables declaradas y nunca usadas (id, user_id) que
 * ensucian el lint.
 */
function omit<T extends Record<string, unknown>>(obj: T, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = { ...obj }
  for (const key of keys) delete result[key]
  return result
}

export default function BackupRestore() {
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreSummary, setRestoreSummary] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const tables = ['categories', 'wallets', 'budgets', 'recurring_expenses', 'savings_goals', 'transactions'] as const

      const results = await Promise.all(
        tables.map((table) => supabase.from(table).select('*').eq('user_id', user.id))
      )

      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error

      const payload: BackupPayload = {
        version: BACKUP_VERSION,
        exported_at: new Date().toISOString(),
        categories: results[0].data ?? [],
        wallets: results[1].data ?? [],
        budgets: results[2].data ?? [],
        recurring_expenses: results[3].data ?? [],
        savings_goals: results[4].data ?? [],
        transactions: results[5].data ?? [],
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `unmango-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Error al generar la copia de seguridad: ' + (err instanceof Error ? err.message : String(err)))
      console.error('Error exportando backup:', err)
    } finally {
      setExporting(false)
    }
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // permite re-seleccionar el mismo archivo después

    if (
      !confirm(
        'Esto va a AGREGAR los datos del archivo a tu cuenta actual (no borra nada existente). ¿Continuar?'
      )
    ) {
      return
    }

    setRestoring(true)
    setRestoreSummary(null)

    try {
      const text = await file.text()
      const payload = JSON.parse(text) as Partial<BackupPayload>

      if (!payload.categories && !payload.transactions) {
        throw new Error('El archivo no tiene el formato esperado de un backup de UnMango.')
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sesión no válida.')

      const counts: Record<string, number> = {}

      // 1) Categorías y billeteras primero: generan IDs nuevos, y las
      // demás tablas los necesitan para remapear category_id/wallet_id.
      const categoryIdMap = new Map<string, string>()
      for (const cat of payload.categories ?? []) {
        const catRecord = cat as Record<string, unknown>
        const oldId = catRecord.id
        const insertRow = {
          ...omit(catRecord, ['id', 'user_id']),
          user_id: user.id,
        } as Database['public']['Tables']['categories']['Insert']
        const { data, error } = await supabase
          .from('categories')
          .insert([insertRow])
          .select('id')
          .single()
        if (!error && data && typeof oldId === 'string') {
          categoryIdMap.set(oldId, data.id)
          counts.categories = (counts.categories ?? 0) + 1
        }
      }

      const walletIdMap = new Map<string, string>()
      for (const wallet of payload.wallets ?? []) {
        const walletRecord = wallet as Record<string, unknown>
        const oldId = walletRecord.id
        const insertRow = {
          ...omit(walletRecord, ['id', 'user_id']),
          user_id: user.id,
        } as Database['public']['Tables']['wallets']['Insert']
        const { data, error } = await supabase
          .from('wallets')
          .insert([insertRow])
          .select('id')
          .single()
        if (!error && data && typeof oldId === 'string') {
          walletIdMap.set(oldId, data.id)
          counts.wallets = (counts.wallets ?? 0) + 1
        }
      }

      // 2) El resto, remapeando category_id / wallet_id con los mapas de arriba.
      for (const tx of payload.transactions ?? []) {
        const txRecord = tx as Record<string, unknown>
        const insertRow = {
          ...omit(txRecord, ['id', 'user_id', 'category_id', 'wallet_id']),
          user_id: user.id,
          category_id: remapForeignKey(txRecord.category_id, categoryIdMap),
          wallet_id: remapForeignKey(txRecord.wallet_id, walletIdMap),
        } as Database['public']['Tables']['transactions']['Insert']
        const { error } = await supabase.from('transactions').insert([insertRow])
        if (!error) counts.transactions = (counts.transactions ?? 0) + 1
      }

      for (const budget of payload.budgets ?? []) {
        const budgetRecord = budget as Record<string, unknown>
        const newCategoryId = remapForeignKey(budgetRecord.category_id, categoryIdMap)
        if (!newCategoryId) continue // budgets requiere category_id (no nullable)
        const insertRow = {
          ...omit(budgetRecord, ['id', 'user_id', 'category_id']),
          user_id: user.id,
          category_id: newCategoryId,
        } as Database['public']['Tables']['budgets']['Insert']
        const { error } = await supabase.from('budgets').insert([insertRow])
        if (!error) counts.budgets = (counts.budgets ?? 0) + 1
      }

      for (const rec of payload.recurring_expenses ?? []) {
        const recRecord = rec as Record<string, unknown>
        const insertRow = {
          ...omit(recRecord, ['id', 'user_id', 'category_id']),
          user_id: user.id,
          category_id: remapForeignKey(recRecord.category_id, categoryIdMap),
        } as Database['public']['Tables']['recurring_expenses']['Insert']
        const { error } = await supabase.from('recurring_expenses').insert([insertRow])
        if (!error) counts.recurring_expenses = (counts.recurring_expenses ?? 0) + 1
      }

      for (const goal of payload.savings_goals ?? []) {
        const goalRecord = goal as Record<string, unknown>
        const insertRow = {
          ...omit(goalRecord, ['id', 'user_id']),
          user_id: user.id,
        } as Database['public']['Tables']['savings_goals']['Insert']
        const { error } = await supabase.from('savings_goals').insert([insertRow])
        if (!error) counts.savings_goals = (counts.savings_goals ?? 0) + 1
      }

      const summary = Object.entries(counts)
        .map(([table, n]) => `${n} ${table}`)
        .join(', ')
      setRestoreSummary(summary || 'No se restauró ningún registro.')
    } catch (err) {
      alert('Error al restaurar el backup: ' + (err instanceof Error ? err.message : String(err)))
      console.error('Error restaurando backup:', err)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
      <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-2">
        <DatabaseBackup className="text-amber-500" size={18} /> Copia de Seguridad
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Descargá todos tus datos en un archivo JSON, o restaurá un backup anterior (se agrega a lo
        que ya tenés, no reemplaza nada).
      </p>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer disabled:opacity-50"
        >
          <Download size={15} /> {exporting ? 'Generando...' : 'Descargar backup'}
        </button>

        <label className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer disabled:opacity-50">
          <Upload size={15} /> {restoring ? 'Restaurando...' : 'Restaurar desde archivo'}
          <input type="file" accept=".json" onChange={handleRestore} disabled={restoring} className="hidden" />
        </label>
      </div>

      {restoreSummary && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-semibold px-3.5 py-2.5 rounded-xl">
          <CheckCircle2 size={14} /> Restaurado: {restoreSummary}
        </div>
      )}
    </div>
  )
}
