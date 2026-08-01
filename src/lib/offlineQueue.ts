import {
  PendingOperation,
  OfflineEntity,
  OfflineOperation,
  addToQueue,
  normalizePendingOperation,
  removeFromQueue,
} from './offlineQueueLogic'

const STORAGE_KEY = 'unmango_pending_sync'

/**
 * Wrapper de I/O sobre localStorage — la lógica de qué le pasa a la
 * cola (agregar, sacar sincronizados) vive en offlineQueueLogic.ts como
 * funciones puras testeadas; esto solo lee/escribe el storage real.
 *
 * Se usa localStorage en vez de IndexedDB porque el volumen de datos es
 * chico (una cola de operaciones pendientes de un usuario, no un dataset
 * grande) — no justifica la complejidad extra de IndexedDB para este caso.
 */
export function loadPendingQueue(): PendingOperation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizePendingOperation)
  } catch (err) {
    console.error('Error leyendo la cola de sincronización offline:', err)
    return []
  }
}

function saveQueue(queue: PendingOperation[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

/** true cuando el navegador reporta que no hay conexión. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

/**
 * Guarda una operación (insert/update/delete) de una entidad en la cola
 * offline. Se llama cuando una mutación a Supabase falla por falta de
 * conexión (o antes de intentarla, si ya sabemos que estamos offline).
 *
 * Para update/delete, `payload` debe incluir el `id` real de la fila
 * (con `.eq('id', ...)` se aplica al sincronizar).
 */
export function enqueueOfflineMutation(
  entity: OfflineEntity,
  operation: OfflineOperation,
  payload: Record<string, unknown>
): PendingOperation {
  const queue = loadPendingQueue()
  const idLocal = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const createdAt = new Date().toISOString()
  const newQueue = addToQueue(queue, payload, idLocal, createdAt, entity, operation)
  saveQueue(newQueue)
  return { idLocal, createdAt, entity, operation, payload }
}

/**
 * Caso particular de la Carga Manual de movimientos: un insert de
 * transacción. Se mantiene como alias para no tocar los call sites
 * existentes.
 */
export function enqueueOfflineTransaction(payload: Record<string, unknown>): PendingOperation {
  return enqueueOfflineMutation('transactions', 'insert', payload)
}

export function dequeueSynced(syncedIdLocals: string[]) {
  const queue = loadPendingQueue()
  saveQueue(removeFromQueue(queue, syncedIdLocals))
}

export function countPending(): number {
  return loadPendingQueue().length
}
