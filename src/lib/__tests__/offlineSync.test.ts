import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyPendingOperation } from '../offlineSync'

interface FakeCall {
  table: string
  method: string
  args: unknown[]
}

function createFakeSupabase(options: { errors?: Record<string, { message: string } | null> } = {}) {
  const calls: FakeCall[] = []
  const errors = options.errors ?? {}

  const builder = (table: string) => {
    const proxy: Record<string, unknown> = {}
    for (const method of ['insert', 'update', 'delete', 'eq']) {
      proxy[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return proxy
      }
    }
    proxy.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: errors[table] ?? null }).then(resolve)
    return proxy
  }

  const fake = {
    from: vi.fn((table: string) => builder(table)),
    _calls: calls,
  }
  return fake
}

describe('applyPendingOperation — insert', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('inserta en recurring_expenses con user_id agregado por la sincronización', async () => {
    const fake = createFakeSupabase()
    const res = await applyPendingOperation(
      fake as never,
      {
        entity: 'recurring_expenses',
        operation: 'insert',
        payload: { title: 'Netflix', amount: 5000, billing_day: 10, currency: 'ARS' },
      },
      'user-1'
    )

    expect(res.error).toBeNull()
    expect(fake.from).toHaveBeenCalledWith('recurring_expenses')
    const insertCall = fake._calls.find((c) => c.method === 'insert')
    expect(insertCall).toBeDefined()
    const rows = insertCall!.args[0] as Array<Record<string, unknown>>
    expect(rows[0]).toMatchObject({ title: 'Netflix', amount: 5000, user_id: 'user-1' })
  })

  it('inserta en installment_purchases con los campos del schema', async () => {
    const fake = createFakeSupabase()
    await applyPendingOperation(
      fake as never,
      {
        entity: 'installment_purchases',
        operation: 'insert',
        payload: { description: 'Notebook', total_amount: 120000, installments_count: 6 },
      },
      'user-42'
    )

    const insertCall = fake._calls.find((c) => c.method === 'insert')
    const rows = insertCall!.args[0] as Array<Record<string, unknown>>
    expect(rows[0].user_id).toBe('user-42')
    expect(rows[0].description).toBe('Notebook')
  })
})

describe('applyPendingOperation — update', () => {
  it('actualiza debts por id, sin mandar el id dentro de los valores a cambiar', async () => {
    const fake = createFakeSupabase()
    const res = await applyPendingOperation(
      fake as never,
      {
        entity: 'debts',
        operation: 'update',
        payload: { id: 'debt-1', remaining_amount: 500 },
      },
      'user-1'
    )

    expect(res.error).toBeNull()
    const updateCall = fake._calls.find((c) => c.method === 'update')
    expect(updateCall).toBeDefined()
    expect(updateCall!.args[0]).toEqual({ remaining_amount: 500 })

    const eqCall = fake._calls.find((c) => c.method === 'eq')
    expect(eqCall!.args).toEqual(['id', 'debt-1'])
  })

  it('actualiza el monto ahorrado de savings_goals por id', async () => {
    const fake = createFakeSupabase()
    await applyPendingOperation(
      fake as never,
      { entity: 'savings_goals', operation: 'update', payload: { id: 'goal-1', current_amount: 8000 } },
      'user-1'
    )

    const updateCall = fake._calls.find((c) => c.method === 'update')
    expect(updateCall!.args[0]).toEqual({ current_amount: 8000 })
    const eqCall = fake._calls.find((c) => c.method === 'eq')
    expect(eqCall!.args).toEqual(['id', 'goal-1'])
  })
})

describe('applyPendingOperation — delete', () => {
  it('borra la fila por id en recurring_expenses', async () => {
    const fake = createFakeSupabase()
    const res = await applyPendingOperation(
      fake as never,
      { entity: 'recurring_expenses', operation: 'delete', payload: { id: 'rec-9' } },
      'user-1'
    )

    expect(res.error).toBeNull()
    expect(fake._calls.some((c) => c.method === 'delete')).toBe(true)
    const eqCall = fake._calls.find((c) => c.method === 'eq')
    expect(eqCall!.args).toEqual(['id', 'rec-9'])
  })
})

describe('applyPendingOperation — guardas', () => {
  it('rechaza update sin id y no toca la base (la operación queda en la cola)', async () => {
    const fake = createFakeSupabase()
    const res = await applyPendingOperation(
      fake as never,
      { entity: 'debts', operation: 'update', payload: { remaining_amount: 0 } },
      'user-1'
    )

    expect(res.error).not.toBeNull()
    expect(fake.from).not.toHaveBeenCalled()
  })

  it('rechaza delete sin id para no arriesgar borrar todo', async () => {
    const fake = createFakeSupabase()
    const res = await applyPendingOperation(
      fake as never,
      { entity: 'savings_goals', operation: 'delete', payload: {} },
      'user-1'
    )

    expect(res.error).not.toBeNull()
    expect(fake._calls).toHaveLength(0)
  })

  it('propaga el error de la base (ej. sin conexión o dato inválido)', async () => {
    const fake = createFakeSupabase({ errors: { debts: { message: 'No connection' } } })
    const res = await applyPendingOperation(
      fake as never,
      { entity: 'debts', operation: 'insert', payload: { description: 'Préstamo' } },
      'user-1'
    )

    expect(res.error?.message).toBe('No connection')
  })
})
