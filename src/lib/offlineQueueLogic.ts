export interface PendingTransaction {
  idLocal: string
  createdAt: string
  payload: Record<string, unknown>
}

/**
 * Agrega una transacción a la cola de pendientes, generándole un ID
 * local temporal (no es el ID real de la base — ese lo asigna Supabase
 * recién cuando se sincroniza). Función pura: recibe la cola actual y
 * devuelve la cola nueva, no toca localStorage directamente — eso lo
 * hace el wrapper de I/O en offlineQueue.ts.
 */
export function addToQueue(
  queue: PendingTransaction[],
  payload: Record<string, unknown>,
  idLocal: string,
  createdAt: string
): PendingTransaction[] {
  return [...queue, { idLocal, createdAt, payload }]
}

/**
 * Saca de la cola las transacciones que ya se sincronizaron
 * exitosamente (por su idLocal).
 */
export function removeFromQueue(queue: PendingTransaction[], syncedIdLocals: string[]): PendingTransaction[] {
  const syncedSet = new Set(syncedIdLocals)
  return queue.filter((item) => !syncedSet.has(item.idLocal))
}
