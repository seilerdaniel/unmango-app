/**
 * Entidades que soporta la cola offline. Cada una corresponde a una
 * tabla de Supabase. La cola arrancó solo con transacciones (Carga
 * Manual de movimientos); se extendió a los 4 módulos que también
 * tienen formularios de alta/edición/eliminación: pagos recurrentes,
 * compras en cuotas, deudas y metas de ahorro.
 */
export type OfflineEntity =
  | 'transactions'
  | 'recurring_expenses'
  | 'installment_purchases'
  | 'debts'
  | 'savings_goals'

export type OfflineOperation = 'insert' | 'update' | 'delete'

export interface PendingOperation {
  idLocal: string
  createdAt: string
  entity: OfflineEntity
  operation: OfflineOperation
  payload: Record<string, unknown>
}

/**
 * Los items guardados antes de la Tanda 3 no traen `entity`/`operation`
 * (la cola solo guardaba transacciones para insertar). Al leerlos, se
 * normalizan a ese caso por defecto para no perder nada de una sesión
 * offline anterior.
 */
export function normalizePendingOperation(item: Partial<PendingOperation> & { idLocal: string; payload: Record<string, unknown> }): PendingOperation {
  return {
    idLocal: item.idLocal,
    createdAt: item.createdAt ?? '',
    entity: item.entity ?? 'transactions',
    operation: item.operation ?? 'insert',
    payload: item.payload,
  }
}

/**
 * Agrega una operación a la cola de pendientes, generándole un ID local
 * temporal (no es el ID real de la base — para insert lo asigna Supabase
 * recién cuando se sincroniza; para update/delete el payload ya trae el
 * `id` real de la fila). Función pura: recibe la cola actual y devuelve
 * la cola nueva, no toca localStorage directamente — eso lo hace el
 * wrapper de I/O en offlineQueue.ts.
 */
export function addToQueue(
  queue: PendingOperation[],
  payload: Record<string, unknown>,
  idLocal: string,
  createdAt: string,
  entity: OfflineEntity = 'transactions',
  operation: OfflineOperation = 'insert'
): PendingOperation[] {
  return [...queue, { idLocal, createdAt, entity, operation, payload }]
}

/**
 * Saca de la cola las operaciones que ya se sincronizaron exitosamente
 * (por su idLocal).
 */
export function removeFromQueue(queue: PendingOperation[], syncedIdLocals: string[]): PendingOperation[] {
  const syncedSet = new Set(syncedIdLocals)
  return queue.filter((item) => !syncedSet.has(item.idLocal))
}
