import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { enqueueOfflineMutation, enqueueOfflineTransaction, loadPendingQueue, dequeueSynced, countPending, isOffline } from '../offlineQueue'

const STORAGE_KEY = 'unmango_pending_sync'

function setRawStoredQueue(value: unknown) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

describe('offlineQueue — persistencia en localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('enqueueOfflineMutation guarda la operación con su entidad y operación', () => {
    enqueueOfflineMutation('savings_goals', 'update', { id: 'goal-1', current_amount: 500 })

    const queue = loadPendingQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].entity).toBe('savings_goals')
    expect(queue[0].operation).toBe('update')
    expect(queue[0].payload).toEqual({ id: 'goal-1', current_amount: 500 })
    expect(queue[0].idLocal).toMatch(/^temp_/)
  })

  it('acumula operaciones de entidades distintas sin pisarse', () => {
    enqueueOfflineMutation('debts', 'insert', { description: 'Préstamo' })
    enqueueOfflineMutation('recurring_expenses', 'delete', { id: 'rec-1' })
    enqueueOfflineMutation('transactions', 'insert', { description: 'Café' })

    const queue = loadPendingQueue()
    expect(queue).toHaveLength(3)
    expect(queue.map((i) => i.entity)).toEqual(['debts', 'recurring_expenses', 'transactions'])
  })

  it('enqueueOfflineTransaction sigue siendo un insert de transacciones', () => {
    const item = enqueueOfflineTransaction({ description: 'Super' })
    expect(item.entity).toBe('transactions')
    expect(item.operation).toBe('insert')
  })

  it('migra items viejos de una sesión offline anterior a transactions/insert', () => {
    setRawStoredQueue([
      { idLocal: 'temp_viejo', createdAt: '2026-07-01T00:00:00.000Z', payload: { description: 'Café' } },
    ])

    const queue = loadPendingQueue()
    expect(queue[0].entity).toBe('transactions')
    expect(queue[0].operation).toBe('insert')
    expect(queue[0].payload).toEqual({ description: 'Café' })
  })

  it('dequeueSynced saca solo las operaciones sincronizadas', () => {
    const a = enqueueOfflineMutation('debts', 'insert', { description: 'A' })
    const b = enqueueOfflineMutation('debts', 'insert', { description: 'B' })

    dequeueSynced([a.idLocal])

    const queue = loadPendingQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].idLocal).toBe(b.idLocal)
  })

  it('countPending devuelve cuántas operaciones quedan pendientes', () => {
    expect(countPending()).toBe(0)
    enqueueOfflineMutation('debts', 'insert', { description: 'A' })
    enqueueOfflineMutation('savings_goals', 'insert', { name: 'Meta' })
    expect(countPending()).toBe(2)
  })

  it('tolera un storage corrupto sin romper (devuelve cola vacía)', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json')
    expect(loadPendingQueue()).toEqual([])
  })
})

describe('isOffline', () => {
  const originalOnLine = navigator.onLine

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
  })

  it('reporta true cuando navigator.onLine es false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    expect(isOffline()).toBe(true)
  })

  it('reporta false cuando hay conexión', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    expect(isOffline()).toBe(false)
  })
})
