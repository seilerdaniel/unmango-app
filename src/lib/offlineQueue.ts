import { PendingTransaction, addToQueue, removeFromQueue } from './offlineQueueLogic'

const STORAGE_KEY = 'unmango_pending_sync'

/**
 * Wrapper de I/O sobre localStorage — la lógica de qué le pasa a la
 * cola (agregar, sacar sincronizados) vive en offlineQueueLogic.ts como
 * funciones puras testeadas; esto solo lee/escribe el storage real.
 *
 * Se usa localStorage en vez de IndexedDB porque el volumen de datos es
 * chico (una cola de transacciones pendientes de un usuario, no un
 * dataset grande) — no justifica la complejidad extra de IndexedDB para
 * este caso.
 */
export function loadPendingQueue(): PendingTransaction[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (err) {
    console.error('Error leyendo la cola de sincronización offline:', err)
    return []
  }
}

function saveQueue(queue: PendingTransaction[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
}

/**
 * Guarda una transacción en la cola offline. Se llama cuando un
 * insert a Supabase falla por falta de conexión.
 */
export function enqueueOfflineTransaction(payload: Record<string, unknown>): PendingTransaction {
  const queue = loadPendingQueue()
  const idLocal = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const createdAt = new Date().toISOString()
  const newQueue = addToQueue(queue, payload, idLocal, createdAt)
  saveQueue(newQueue)
  return { idLocal, createdAt, payload }
}

export function dequeueSynced(syncedIdLocals: string[]) {
  const queue = loadPendingQueue()
  saveQueue(removeFromQueue(queue, syncedIdLocals))
}

export function countPending(): number {
  return loadPendingQueue().length
}
