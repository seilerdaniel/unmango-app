import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Tables = Database['public']['Tables']
type TableName = keyof Tables

/**
 * Una operación pendiente de la cola offline, en la forma mínima que
 * necesita la sincronización (entity/operation/payload). Se desacopla
 * de PendingOperation (que además lleva idLocal/createdAt) para que esta
 * función sea fácil de testear sin tocar localStorage.
 */
export interface PendingOperationForSync {
  entity: string
  operation: string
  payload: Record<string, unknown>
}

export interface SyncResult {
  error: { message: string } | null
}

/**
 * Vista mínima del query builder de Supabase que usa la sincronización.
 * Se tipa acá (y no contra el cliente real) para poder despachar a
 * cualquier tabla sin caer en uniones de tipos imposibles de resolver, y
 * para que el helper sea testeable con un fake chico.
 */
interface MinimalBuilder {
  insert: (rows: Record<string, unknown>[]) => PromiseLike<SyncResult>
  update: (values: Record<string, unknown>) => PromiseLike<SyncResult> & { eq: (...args: unknown[]) => PromiseLike<SyncResult> }
  delete: () => PromiseLike<SyncResult> & { eq: (...args: unknown[]) => PromiseLike<SyncResult> }
}

/**
 * Aplica una operación pendiente de la cola offline a su tabla real.
 * - insert  → inserta la fila (con user_id) y la base asigna el id.
 * - update  → actualiza la fila identificada por payload.id.
 * - delete  → borra la fila identificada por payload.id.
 *
 * Para update/delete el payload tiene que traer el `id` real de la fila;
 * si no, se rechaza la operación sin tocar la base (queda en la cola, no
 * se pierde — y no se arriesga un `.delete()` sin id).
 */
export async function applyPendingOperation(
  supabase: SupabaseClient<Database>,
  item: PendingOperationForSync,
  userId: string
): Promise<SyncResult> {
  const { entity, operation, payload } = item

  // Para update/delete el payload tiene que traer el id real de la fila;
  // si no, `.delete().eq(...)` con un id ausente podría borrar todo — por
  // eso se rechaza la operación sin tocar la base (queda en la cola).
  if (operation !== 'insert' && !payload.id) {
    console.error('Operación offline sin id, se deja en la cola:', item)
    return { error: { message: 'Falta el id de la fila' } }
  }

  const table = supabase.from(entity as TableName) as unknown as MinimalBuilder

  if (operation === 'insert') {
    return await table.insert([{ ...payload, user_id: userId }])
  }

  if (operation === 'update') {
    const { id, ...changes } = payload
    return await table.update(changes).eq('id', id)
  }

  return await table.delete().eq('id', payload.id)
}
