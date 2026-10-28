import type { Database } from '@/types/database'

type CategoryInsert = Database['public']['Tables']['categories']['Insert']
type WalletInsert = Database['public']['Tables']['wallets']['Insert']
type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
type BudgetInsert = Database['public']['Tables']['budgets']['Insert']
type RecurringInsert = Database['public']['Tables']['recurring_expenses']['Insert']
type GoalInsert = Database['public']['Tables']['savings_goals']['Insert']

/** Tamaño de lote para las inserciones masivas del restore. */
export const RESTORE_BATCH_SIZE = 100

/**
 * Al restaurar, las categorías y billeteras se insertan con IDs nuevos
 * (generados acá con `generateId`), así que las tablas que las
 * referencian (transactions, budgets, recurring_expenses) necesitan que
 * sus category_id/wallet_id viejos se traduzcan a los nuevos.
 *
 * Si un id viejo no aparece en el mapa (por ejemplo, la categoría no se
 * pudo restaurar por algún motivo), se devuelve null en vez de romper el
 * insert — la fila queda sin esa categoría/billetera asignada, en vez de
 * perderse.
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
export function omit<T extends Record<string, unknown>>(obj: T, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = { ...obj }
  for (const key of keys) delete result[key]
  return result
}

/** Parte un array en lotes de hasta `size` elementos. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (!(size > 0)) throw new Error('El tamaño de lote debe ser mayor a 0')
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

/** Genera un uuid (con fallback si el entorno no expone crypto.randomUUID). */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Cede el hilo principal entre lotes para que el navegador pueda pintar
 * el avance de progreso y la UI no se congele durante restauraciones
 * grandes (los sets de state se vacían en el próximo tick).
 */
export function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Inserta filas en lotes de hasta `batchSize`. El `prepare` recibe cada
 * lote de filas crudas y devuelve las filas listas para insertar
 * (genera los IDs nuevos, remapea FKs, etc.).
 *
 * Si un lote falla, NO se aborta el resto: se sigue con los siguientes
 * (el restore es aditivo, mejor dejar entrar lo que sí puede) y el error
 * se acumula en `firstError` para que la UI lo notifique al final. Cada
 * lote reporta el progreso acumulado por `onProgress` y cede el hilo.
 */
export interface InsertBatchesDeps<T> {
  insert: (rows: T[]) => Promise<{ error: { message: string } | null }>
  onProgress: (processed: number) => void
}

export async function insertBatches<T>(
  raw: Record<string, unknown>[],
  prepare: (chunk: Record<string, unknown>[]) => T[],
  batchSize: number,
  deps: InsertBatchesDeps<T>
): Promise<{ inserted: number; failed: number; firstError: string | null }> {
  const batches = chunk(raw, batchSize)
  let inserted = 0
  let failed = 0
  let firstError: string | null = null
  let processed = 0

  for (const batch of batches) {
    const rows = prepare(batch)
    const { error } = await deps.insert(rows)
    if (error) {
      failed += rows.length
      firstError ??= error.message
    } else {
      inserted += rows.length
    }
    processed += rows.length
    deps.onProgress(processed)
    await yieldToUI()
  }

  return { inserted, failed, firstError }
}

export function buildCategoryInsertRows(
  raw: Record<string, unknown>[],
  userId: string
): { rows: CategoryInsert[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>()
  const rows = raw.map((record) => {
    const newId = generateId()
    if (typeof record.id === 'string') idMap.set(record.id, newId)
    return {
      ...omit(record, ['id', 'user_id']),
      id: newId,
      user_id: userId,
    } as CategoryInsert
  })
  return { rows, idMap }
}

export function buildWalletInsertRows(
  raw: Record<string, unknown>[],
  userId: string
): { rows: WalletInsert[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>()
  const rows = raw.map((record) => {
    const newId = generateId()
    if (typeof record.id === 'string') idMap.set(record.id, newId)
    return {
      ...omit(record, ['id', 'user_id']),
      id: newId,
      user_id: userId,
    } as WalletInsert
  })
  return { rows, idMap }
}

export function buildTransactionInsertRows(
  raw: Record<string, unknown>[],
  userId: string,
  categoryIdMap: Map<string, string>,
  walletIdMap: Map<string, string>
): TransactionInsert[] {
  return raw.map((record) => ({
    ...omit(record, ['id', 'user_id', 'category_id', 'wallet_id']),
    user_id: userId,
    category_id: remapForeignKey(record.category_id, categoryIdMap),
    wallet_id: remapForeignKey(record.wallet_id, walletIdMap),
  }) as TransactionInsert)
}

export function buildBudgetInsertRows(
  raw: Record<string, unknown>[],
  userId: string,
  categoryIdMap: Map<string, string>
): BudgetInsert[] {
  return raw
    .map((record) => {
      const newCategoryId = remapForeignKey(record.category_id, categoryIdMap)
      if (!newCategoryId) return null // budgets requiere category_id (no nullable)
      return {
        ...omit(record, ['id', 'user_id', 'category_id']),
        user_id: userId,
        category_id: newCategoryId,
      } as BudgetInsert
    })
    .filter((row): row is BudgetInsert => row !== null)
}

export function buildRecurringInsertRows(
  raw: Record<string, unknown>[],
  userId: string,
  categoryIdMap: Map<string, string>,
  walletIdMap: Map<string, string>
): RecurringInsert[] {
  return raw.map((record) => ({
    ...omit(record, ['id', 'user_id', 'category_id', 'wallet_id']),
    user_id: userId,
    category_id: remapForeignKey(record.category_id, categoryIdMap),
    wallet_id: remapForeignKey(record.wallet_id, walletIdMap),
  }) as RecurringInsert)
}

export function buildGoalInsertRows(
  raw: Record<string, unknown>[],
  userId: string
): GoalInsert[] {
  return raw.map((record) => ({
    ...omit(record, ['id', 'user_id']),
    user_id: userId,
  }) as GoalInsert)
}
