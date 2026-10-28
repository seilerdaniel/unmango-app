import { describe, it, expect } from 'vitest'
import { addToQueue, normalizePendingOperation, removeFromQueue } from '../offlineQueueLogic'
import type { OfflineEntity, OfflineOperation, PendingOperation } from '../offlineQueueLogic'

describe('addToQueue', () => {
  it('agrega un item nuevo a la cola con su idLocal y fecha', () => {
    const queue = addToQueue([], { description: 'Café' }, 'temp_1', '2026-07-30T10:00:00.000Z')
    expect(queue).toHaveLength(1)
    expect(queue[0].idLocal).toBe('temp_1')
    expect(queue[0].payload).toEqual({ description: 'Café' })
  })

  it('por defecto es un insert de transacción (comportamiento histórico)', () => {
    const [item] = addToQueue([], { amount_ars: 100 }, 'temp_1', '2026-07-30T10:00:00.000Z')
    expect(item.entity).toBe('transactions')
    expect(item.operation).toBe('insert')
  })

  it('guarda la entidad y operación cuando se pasan explícitamente', () => {
    const [item] = addToQueue(
      [],
      { id: 'rec-1', amount: 5000 },
      'temp_1',
      '2026-07-30T10:00:00.000Z',
      'recurring_expenses',
      'update'
    )
    expect(item.entity).toBe('recurring_expenses')
    expect(item.operation).toBe('update')
  })

  it('permite encolar delete de cualquiera de las 4 entidades nuevas', () => {
    const cases: Array<{ entity: OfflineEntity; operation: OfflineOperation }> = [
      { entity: 'recurring_expenses', operation: 'delete' },
      { entity: 'installment_purchases', operation: 'delete' },
      { entity: 'debts', operation: 'delete' },
      { entity: 'savings_goals', operation: 'delete' },
    ]
    for (const { entity, operation } of cases) {
      const [item] = addToQueue([], { id: 'x' }, 'temp_1', '2026-07-30T10:00:00.000Z', entity, operation)
      expect(item.entity).toBe(entity)
      expect(item.operation).toBe(operation)
    }
  })

  it('no muta la cola original, devuelve una nueva', () => {
    const original: never[] = []
    const result = addToQueue(original, { a: 1 }, 'temp_1', '2026-07-30T10:00:00.000Z')
    expect(original).toHaveLength(0)
    expect(result).toHaveLength(1)
  })

  it('agrega varios items sin pisar los anteriores', () => {
    let queue = addToQueue([], { a: 1 }, 'temp_1', '2026-07-30T10:00:00.000Z')
    queue = addToQueue(queue, { a: 2 }, 'temp_2', '2026-07-30T10:01:00.000Z')
    expect(queue).toHaveLength(2)
  })
})

describe('normalizePendingOperation', () => {
  it('deja intacto un item que ya trae entity/operation', () => {
    const item: PendingOperation = {
      idLocal: 'temp_1',
      createdAt: '2026-07-30T10:00:00.000Z',
      entity: 'debts',
      operation: 'insert',
      payload: { description: 'Préstamo' },
    }
    expect(normalizePendingOperation(item)).toEqual(item)
  })

  it('migra un item viejo (sin entity/operation) a transactions/insert', () => {
    const oldItem = {
      idLocal: 'temp_1',
      createdAt: '2026-07-30T10:00:00.000Z',
      payload: { description: 'Café' },
    }
    expect(normalizePendingOperation(oldItem)).toEqual({
      idLocal: 'temp_1',
      createdAt: '2026-07-30T10:00:00.000Z',
      entity: 'transactions',
      operation: 'insert',
      payload: { description: 'Café' },
    })
  })
})

describe('removeFromQueue', () => {
  it('saca solo los items sincronizados, deja el resto', () => {
    const queue: PendingOperation[] = [
      { idLocal: 'temp_1', createdAt: '', entity: 'transactions', operation: 'insert', payload: {} },
      { idLocal: 'temp_2', createdAt: '', entity: 'debts', operation: 'insert', payload: {} },
      { idLocal: 'temp_3', createdAt: '', entity: 'savings_goals', operation: 'delete', payload: {} },
    ]
    const result = removeFromQueue(queue, ['temp_1', 'temp_3'])
    expect(result).toHaveLength(1)
    expect(result[0].idLocal).toBe('temp_2')
  })

  it('no rompe si se pide sacar un idLocal que no existe', () => {
    const queue: PendingOperation[] = [{ idLocal: 'temp_1', createdAt: '', entity: 'transactions', operation: 'insert', payload: {} }]
    const result = removeFromQueue(queue, ['no-existe'])
    expect(result).toHaveLength(1)
  })

  it('devuelve la cola vacía si se sacan todos', () => {
    const queue: PendingOperation[] = [{ idLocal: 'temp_1', createdAt: '', entity: 'transactions', operation: 'insert', payload: {} }]
    expect(removeFromQueue(queue, ['temp_1'])).toHaveLength(0)
  })
})
