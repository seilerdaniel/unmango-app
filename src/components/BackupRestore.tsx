'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/context/UserContext'
import { useToast } from '@/context/ToastContext'
import {
  RESTORE_BATCH_SIZE,
  buildBudgetInsertRows,
  buildCategoryInsertRows,
  buildGoalInsertRows,
  buildRecurringInsertRows,
  buildTransactionInsertRows,
  buildWalletInsertRows,
  insertBatches,
} from '@/lib/backupRestore'
import { Download, Upload, DatabaseBackup, CheckCircle2, AlertTriangle } from 'lucide-react'

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

interface RestoreProgress {
  label: string
  done: number
  total: number
}

export default function BackupRestore() {
  const { user } = useUser()
  const { toast, confirmDialog } = useToast()
  const [exporting, setExporting] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreSummary, setRestoreSummary] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress | null>(null)

  async function handleExport() {
    setExporting(true)
    try {
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
      toast.error('Error al generar la copia de seguridad: ' + (err instanceof Error ? err.message : String(err)))
      console.error('Error exportando backup:', err)
    } finally {
      setExporting(false)
    }
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // permite re-seleccionar el mismo archivo después

    const ok = await confirmDialog({
      title: 'Restaurar backup',
      message: 'Esto va a AGREGAR los datos del archivo a tu cuenta actual (no borra nada existente). ¿Continuar?',
      confirmText: 'Restaurar',
    })
    if (!ok) return

    setRestoring(true)
    setRestoreSummary(null)
    setRestoreError(null)
    setRestoreProgress(null)

    try {
      const text = await file.text()
      const payload = JSON.parse(text) as Partial<BackupPayload>

      if (!payload.categories && !payload.transactions) {
        throw new Error('El archivo no tiene el formato esperado de un backup de UnMango.')
      }

      if (!user) throw new Error('Sesión no válida.')

      const totalRows =
        (payload.categories?.length ?? 0) +
        (payload.wallets?.length ?? 0) +
        (payload.transactions?.length ?? 0) +
        (payload.budgets?.length ?? 0) +
        (payload.recurring_expenses?.length ?? 0) +
        (payload.savings_goals?.length ?? 0)

      const counts: Record<string, number> = {}
      let failedTotal = 0
      let firstError: string | null = null
      let processed = 0

      // 1) Categorías y billeteras primero: `buildCategoryInsertRows` /
      // `buildWalletInsertRows` generan los IDs nuevos y llenan estos
      // mapas, que las demás tablas usan para remapear sus FKs.
      const categoryIdMap = new Map<string, string>()
      const walletIdMap = new Map<string, string>()

      const onProgress = (label: string) => (n: number) => {
        processed += n
        setRestoreProgress({ label, done: processed, total: totalRows })
      }

      // Los inserts van por lotes (RESTORE_BATCH_SIZE) con yield entre
      // lote y lote: la UI pinta el avance en vez de congelarse, y si un
      // lote falla se anota el error y se sigue con el resto (additivo).
      const categories = await insertBatches(
        payload.categories ?? [],
        (rawChunk) => {
          const { rows, idMap } = buildCategoryInsertRows(rawChunk, user.id)
          for (const [oldId, newId] of idMap) categoryIdMap.set(oldId, newId)
          return rows
        },
        RESTORE_BATCH_SIZE,
        {
          insert: async (rows) => supabase.from('categories').insert(rows),
          onProgress: onProgress('Categorías'),
        }
      )
      counts.categories = categories.inserted
      failedTotal += categories.failed
      firstError ??= categories.firstError

      const wallets = await insertBatches(
        payload.wallets ?? [],
        (rawChunk) => {
          const { rows, idMap } = buildWalletInsertRows(rawChunk, user.id)
          for (const [oldId, newId] of idMap) walletIdMap.set(oldId, newId)
          return rows
        },
        RESTORE_BATCH_SIZE,
        {
          insert: async (rows) => supabase.from('wallets').insert(rows),
          onProgress: onProgress('Billeteras'),
        }
      )
      counts.wallets = wallets.inserted
      failedTotal += wallets.failed
      firstError ??= wallets.firstError

      // 2) El resto, remapeando category_id / wallet_id con los mapas de arriba.
      const transactions = await insertBatches(
        payload.transactions ?? [],
        (rawChunk) => buildTransactionInsertRows(rawChunk, user.id, categoryIdMap, walletIdMap),
        RESTORE_BATCH_SIZE,
        {
          insert: async (rows) => supabase.from('transactions').insert(rows),
          onProgress: onProgress('Movimientos'),
        }
      )
      counts.transactions = transactions.inserted
      failedTotal += transactions.failed
      firstError ??= transactions.firstError

      const budgets = await insertBatches(
        payload.budgets ?? [],
        (rawChunk) => buildBudgetInsertRows(rawChunk, user.id, categoryIdMap),
        RESTORE_BATCH_SIZE,
        {
          insert: async (rows) => supabase.from('budgets').insert(rows),
          onProgress: onProgress('Presupuestos'),
        }
      )
      counts.budgets = budgets.inserted
      failedTotal += budgets.failed
      firstError ??= budgets.firstError

      const recurring = await insertBatches(
        payload.recurring_expenses ?? [],
        (rawChunk) => buildRecurringInsertRows(rawChunk, user.id, categoryIdMap, walletIdMap),
        RESTORE_BATCH_SIZE,
        {
          insert: async (rows) => supabase.from('recurring_expenses').insert(rows),
          onProgress: onProgress('Pagos recurrentes'),
        }
      )
      counts.recurring_expenses = recurring.inserted
      failedTotal += recurring.failed
      firstError ??= recurring.firstError

      const goals = await insertBatches(
        payload.savings_goals ?? [],
        (rawChunk) => buildGoalInsertRows(rawChunk, user.id),
        RESTORE_BATCH_SIZE,
        {
          insert: async (rows) => supabase.from('savings_goals').insert(rows),
          onProgress: onProgress('Metas de ahorro'),
        }
      )
      counts.savings_goals = goals.inserted
      failedTotal += goals.failed
      firstError ??= goals.firstError

      if (failedTotal > 0) {
        const insertedTotal = Object.values(counts).reduce((acc, n) => acc + n, 0)
        setRestoreError(
          `Se insertaron ${insertedTotal} de ${totalRows} registros. ${failedTotal} no se pudieron ` +
            `insertar (primer error: ${firstError}).`
        )
      } else if (totalRows > 0) {
        const summary = Object.entries(counts)
          .map(([table, n]) => `${n} ${table}`)
          .join(', ')
        setRestoreSummary(summary)
      } else {
        setRestoreSummary('No se restauró ningún registro.')
      }
    } catch (err) {
      toast.error('Error al restaurar el backup: ' + (err instanceof Error ? err.message : String(err)))
      console.error('Error restaurando backup:', err)
    } finally {
      setRestoring(false)
      setRestoreProgress(null)
    }
  }

  const progressPercent =
    restoreProgress && restoreProgress.total > 0
      ? Math.round((restoreProgress.done / restoreProgress.total) * 100)
      : 0

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

      {restoreProgress && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
            <span>
              {restoreProgress.label} — {restoreProgress.done} de {restoreProgress.total}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {restoreError && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-semibold px-3.5 py-2.5 rounded-xl">
          <AlertTriangle size={14} className="shrink-0" /> {restoreError}
        </div>
      )}

      {restoreSummary && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-semibold px-3.5 py-2.5 rounded-xl">
          <CheckCircle2 size={14} /> Restaurado: {restoreSummary}
        </div>
      )}
    </div>
  )
}
