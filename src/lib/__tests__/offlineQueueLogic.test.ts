import { describe, it, expect } from 'vitest'
import { addToQueue, removeFromQueue } from '../offlineQueueLogic'

describe('addToQueue', () => {
  it('agrega un item nuevo a la cola con su idLocal y fecha', () => {
    const queue = addToQueue([], { description: 'Café' }, 'temp_1', '2026-07-30T10:00:00.000Z')
    expect(queue).toHaveLength(1)
    expect(queue[0].idLocal).toBe('temp_1')
    expect(queue[0].payload).toEqual({ description: 'Café' })
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

describe('removeFromQueue', () => {
  it('saca solo los items sincronizados, deja el resto', () => {
    const queue = [
      { idLocal: 'temp_1', createdAt: '', payload: {} },
      { idLocal: 'temp_2', createdAt: '', payload: {} },
      { idLocal: 'temp_3', createdAt: '', payload: {} },
    ]
    const result = removeFromQueue(queue, ['temp_1', 'temp_3'])
    expect(result).toHaveLength(1)
    expect(result[0].idLocal).toBe('temp_2')
  })

  it('no rompe si se pide sacar un idLocal que no existe', () => {
    const queue = [{ idLocal: 'temp_1', createdAt: '', payload: {} }]
    const result = removeFromQueue(queue, ['no-existe'])
    expect(result).toHaveLength(1)
  })

  it('devuelve la cola vacía si se sacan todos', () => {
    const queue = [{ idLocal: 'temp_1', createdAt: '', payload: {} }]
    expect(removeFromQueue(queue, ['temp_1'])).toHaveLength(0)
  })
})
